import { InMemoryHarnessRuntime, type HarnessProvider } from '@harness-runtime/core'
import {
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

  try {
    const runtime = new InMemoryHarnessRuntime([provider])
    const conversation = runtime.createConversation({ metadata: { suite: 'conformance' } })
    const execution = runtime.startExecution({
      conversationId: conversation.id,
      providerId: provider.manifest.id,
      input: options.input ?? 'portable conformance probe',
      idempotencyKey: 'conformance-basic',
    })
    const events = await withTimeout(
      collect(runtime.subscribeEvents(execution.id)),
      options.timeoutMs ?? 10_000,
    )
    const finalExecution = runtime.getExecution(execution.id)

    add('execution-succeeded', finalExecution.state === 'succeeded', finalExecution.state)
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
      events.some((event) => event.type === 'output.text.done'),
    )
    add('terminal-event-last', terminalEvents[0]?.sequence === events.at(-1)?.sequence)
  } catch (error) {
    add('execution-probe', false, error instanceof Error ? error.message : String(error))
  }

  return report(provider.manifest.id, checks)
}

async function collect(events: AsyncIterable<RuntimeEvent>): Promise<RuntimeEvent[]> {
  const result: RuntimeEvent[] = []
  for await (const event of events) result.push(event)
  return result
}

async function withTimeout<T>(promise: Promise<T>, milliseconds: number): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined
  try {
    return await Promise.race([
      promise,
      new Promise<never>((_, reject) => {
        timer = setTimeout(() => reject(new Error('Conformance probe timed out')), milliseconds)
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
