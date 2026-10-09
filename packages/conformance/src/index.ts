import { InMemoryHarnessRuntime, RuntimeError, type HarnessProvider } from '@harness-runtime/core'
import {
  type ActionResponse,
  type JsonObject,
  type StandardEventType,
  ProviderManifestSchema,
  type RuntimeEvent,
  isTerminalExecutionState,
} from '@harness-runtime/protocol'

export interface ConformanceCheck {
  name: string
  passed: boolean
  detail?: string
}

export interface ConformanceReport {
  providerId: string
  passed: boolean
  checks: ConformanceCheck[]
}

export interface ConformanceOptions {
  input?: string
  timeoutMs?: number
  cleanupTimeoutMs?: number
  config?: JsonObject
  requiredCapabilities?: string[]
  actionResponse?: ActionResponse
  cancelAfterEvent?: StandardEventType
  expectedState?: 'succeeded' | 'failed' | 'cancelled'
  expectedArtifacts?: number
}

export async function runProviderConformance(
  provider: HarnessProvider,
  options: ConformanceOptions = {},
): Promise<ConformanceReport> {
  const checks: ConformanceCheck[] = []
  const add = (name: string, passed: boolean, detail?: string): void => {
    checks.push({ name, passed, ...(detail === undefined ? {} : { detail }) })
  }

  const manifest = ProviderManifestSchema.safeParse(provider.manifest)
  add(
    'manifest-valid',
    manifest.success,
    manifest.success ? undefined : manifest.error.issues.map((issue) => issue.message).join('; '),
  )
  if (!manifest.success) return report(provider.manifest.id, checks)

  const runtime = new InMemoryHarnessRuntime([provider])
  const subscription = new AbortController()
  let executionId: string | undefined
  try {
    const conversation = runtime.createConversation({ metadata: { suite: 'conformance' } })
    const request = {
      conversationId: conversation.id,
      providerId: provider.manifest.id,
      input: options.input ?? 'portable conformance probe',
      idempotencyKey: 'conformance-basic',
      config: options.config ?? {},
      requiredCapabilities: options.requiredCapabilities ?? [],
    }
    const execution = runtime.startExecution(request)
    executionId = execution.id
    add('idempotency-reuse', runtime.startExecution(request).id === execution.id)
    try {
      runtime.startExecution({ ...request, input: `${request.input} (conflicting request)` })
      add('idempotency-conflict', false)
    } catch (error) {
      add(
        'idempotency-conflict',
        error instanceof RuntimeError && error.code === 'IDEMPOTENCY_CONFLICT',
      )
    }
    const events = await withTimeout(
      collect(runtime.subscribeEvents(execution.id, 0, subscription.signal), async (event) => {
        if (event.type === 'action.required' && options.actionResponse !== undefined) {
          runtime.respondAction(execution.id, String(event.data.id), options.actionResponse)
        }
        if (event.type === options.cancelAfterEvent) {
          await runtime.cancelExecution(execution.id, 'Conformance cancellation probe')
        }
      }),
      options.timeoutMs ?? 10_000,
    )
    const finalExecution = runtime.getExecution(execution.id)

    const expectedState = options.expectedState ?? 'succeeded'
    add(`execution-${expectedState}`, finalExecution.state === expectedState, finalExecution.state)
    add('events-present', events.length >= 3, `${events.length} events`)
    add(
      'event-sequence-contiguous',
      events.every((event, index) => event.sequence === index + 1),
    )
    const terminalEvents = events
      .filter((event) => event.type.startsWith('run.'))
      .filter((event) => ['run.completed', 'run.failed', 'run.cancelled'].includes(event.type))
    add(
      'one-terminal-event',
      terminalEvents.length === 1,
      `${terminalEvents.length} terminal events`,
    )
    add('terminal-state', isTerminalExecutionState(finalExecution.state), finalExecution.state)
    add(
      'final-output-event',
      events.some((event) => event.type === 'output.text.done') === (expectedState === 'succeeded'),
    )
    add('terminal-event-last', terminalEvents[0]?.sequence === events.at(-1)?.sequence)
    if (options.actionResponse !== undefined) {
      const actions = events.filter((event) => event.type === 'action.required')
      add(
        'action-response-correlation',
        actions.length > 0 &&
          actions.every(
            (action) =>
              events.filter(
                (event) =>
                  event.type === 'action.responded' && event.data.actionId === action.data.id,
              ).length === 1,
          ),
      )
    }
    const terminalTypes = {
      succeeded: 'run.completed',
      failed: 'run.failed',
      cancelled: 'run.cancelled',
    }
    add('terminal-event-matches-state', terminalEvents[0]?.type === terminalTypes[expectedState])
    const cursor = Math.floor(events.length / 2)
    add(
      'cursor-replay',
      JSON.stringify(runtime.listEvents(execution.id, cursor).events) ===
        JSON.stringify(events.filter((event) => event.sequence > cursor)),
    )
    const artifacts = runtime.listArtifacts(execution.id).artifacts
    const artifactEvents = events.filter((event) => event.type === 'artifact.created')
    add(
      'artifact-event-correlation',
      artifactEvents.length === artifacts.length &&
        artifacts.every(
          (artifact) =>
            events.filter(
              (event) => event.type === 'artifact.created' && event.data.id === artifact.id,
            ).length === 1,
        ),
    )
    if (options.expectedArtifacts !== undefined) {
      add(
        'artifact-count',
        artifacts.length === options.expectedArtifacts,
        `${artifacts.length} artifacts`,
      )
    }
  } catch (error) {
    add('execution-probe', false, error instanceof Error ? error.message : String(error))
  } finally {
    subscription.abort()
    if (executionId && !isTerminalExecutionState(runtime.getExecution(executionId).state)) {
      try {
        await withTimeout(
          runtime.cancelExecution(executionId, 'Conformance probe stopped'),
          options.cleanupTimeoutMs ?? 1_000,
          'Conformance cleanup timed out',
        )
        const cleanupError = runtime.listEvents(executionId).events.at(-1)
          ?.data.providerCleanupError
        add(
          'execution-cleanup',
          cleanupError === undefined,
          typeof cleanupError === 'string' ? cleanupError : undefined,
        )
      } catch (error) {
        add('execution-cleanup', false, error instanceof Error ? error.message : String(error))
      }
    }
  }

  return report(provider.manifest.id, checks)
}

async function collect(
  events: AsyncIterable<RuntimeEvent>,
  onEvent: (event: RuntimeEvent) => Promise<void>,
): Promise<RuntimeEvent[]> {
  const result: RuntimeEvent[] = []
  for await (const event of events) {
    result.push(event)
    await onEvent(event)
  }
  return result
}

async function withTimeout<T>(
  promise: Promise<T>,
  milliseconds: number,
  message = 'Conformance probe timed out',
): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined
  try {
    return await Promise.race([
      promise,
      new Promise<never>((_, reject) => {
        timer = setTimeout(() => reject(new Error(message)), milliseconds)
      }),
    ])
  } finally {
    if (timer) clearTimeout(timer)
  }
}

function report(providerId: string, checks: ConformanceCheck[]): ConformanceReport {
  return {
    providerId,
    passed: checks.every((check) => check.passed),
    checks,
  }
}
