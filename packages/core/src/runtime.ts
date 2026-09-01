import { randomUUID } from 'node:crypto'
import {
  ActionResponseSchema,
  type Artifact,
  type ArtifactList,
  CreateConversationRequestSchema,
  CreateArtifactInputSchema,
  type ActionRequest,
  type ActionResponse,
  type Conversation,
  type EventList,
  type Execution,
  type ExecutionState,
  type JsonObject,
  type ProviderManifest,
  ProviderManifestSchema,
  PROTOCOL_VERSION,
  type RuntimeDescription,
  type RuntimeEvent,
  StartExecutionRequestSchema,
  type StartExecutionRequest,
  type StandardEventType,
  isTerminalExecutionState,
} from '@harness-runtime/protocol'
import { ExecutionAbortedError, RuntimeError } from './errors.js'
import type {
  HarnessProvider,
  ProviderActionInput,
  ProviderEventType,
  ProviderRunContext,
} from './provider.js'

interface ExecutionRecord {
  public: Execution
  provider: HarnessProvider
  controller: AbortController
  terminalEventAppended: boolean
}

interface PendingAction {
  request: ActionRequest
  resolve: (response: ActionResponse) => void
  reject: (error: Error) => void
  settled: boolean
}

interface IdempotencyRecord {
  fingerprint: string
  executionId: string
}

type EventListener = () => void

export interface InMemoryRuntimeOptions {
  name?: string
  version?: string
}

export class InMemoryHarnessRuntime {
  private readonly name: string
  private readonly version: string
  private readonly providers = new Map<string, HarnessProvider>()
  private readonly conversations = new Map<string, Conversation>()
  private readonly executions = new Map<string, ExecutionRecord>()
  private readonly events = new Map<string, RuntimeEvent[]>()
  private readonly artifacts = new Map<string, Artifact[]>()
  private readonly pendingActions = new Map<string, PendingAction>()
  private readonly idempotency = new Map<string, IdempotencyRecord>()
  private readonly listeners = new Map<string, Set<EventListener>>()

  constructor(providers: HarnessProvider[] = [], options: InMemoryRuntimeOptions = {}) {
    this.name = options.name ?? 'harness-runtime-reference'
    this.version = options.version ?? '0.1.0'
    for (const provider of providers) this.registerProvider(provider)
  }

  registerProvider(provider: HarnessProvider): void {
    const manifest = ProviderManifestSchema.parse(provider.manifest)
    if (this.providers.has(manifest.id)) {
      throw new RuntimeError('INVALID_STATE', `Provider already registered: ${manifest.id}`, 409)
    }
    this.providers.set(manifest.id, provider)
  }

  describe(): RuntimeDescription {
    return {
      name: this.name,
      version: this.version,
      protocolVersion: PROTOCOL_VERSION,
      providers: this.providerManifests(),
    }
  }

  providerManifests(): ProviderManifest[] {
    return [...this.providers.values()].map((provider) => structuredClone(provider.manifest))
  }

  createConversation(input: unknown = {}): Conversation {
    const parsed = CreateConversationRequestSchema.safeParse(input)
    if (!parsed.success) throw validationError('Invalid conversation request')
    const request = parsed.data
    const conversation: Conversation = {
      id: makeId('conv'),
      createdAt: now(),
      metadata: structuredClone(request.metadata ?? {}),
    }
    this.conversations.set(conversation.id, conversation)
    return structuredClone(conversation)
  }

  getConversation(id: string): Conversation {
    const conversation = this.conversations.get(id)
    if (!conversation) throw notFound('Conversation', id)
    return structuredClone(conversation)
  }

  startExecution(input: unknown): Execution {
    const parsed = StartExecutionRequestSchema.safeParse(input)
    if (!parsed.success) throw validationError('Invalid execution request')
    const request = parsed.data
    this.getConversation(request.conversationId)

    const provider = this.providers.get(request.providerId)
    if (!provider) {
      throw new RuntimeError('PROVIDER_NOT_FOUND', `Provider not found: ${request.providerId}`, 404)
    }

    const requiredCapabilities = [...new Set(request.requiredCapabilities ?? [])].sort()
    this.assertCapabilities(provider.manifest, requiredCapabilities)

    const normalizedRequest = {
      conversationId: request.conversationId,
      providerId: request.providerId,
      input: request.input,
      requiredCapabilities,
      config: request.config ?? {},
    }
    const fingerprint = stableStringify(normalizedRequest)
    if (request.idempotencyKey) {
      const idempotencyKey = `${request.conversationId}:${request.idempotencyKey}`
      const existing = this.idempotency.get(idempotencyKey)
      if (existing) {
        if (existing.fingerprint !== fingerprint) {
          throw new RuntimeError(
            'IDEMPOTENCY_CONFLICT',
            'Idempotency key was already used with a different execution request',
            409,
          )
        }
        return this.getExecution(existing.executionId)
      }
    }

    const timestamp = now()
    const execution: Execution = {
      id: makeId('exec'),
      conversationId: request.conversationId,
      providerId: request.providerId,
      state: 'queued',
      input: request.input,
      requiredCapabilities,
      effectiveConfig: structuredClone(request.config ?? {}),
      createdAt: timestamp,
      updatedAt: timestamp,
    }
    const record: ExecutionRecord = {
      public: execution,
      provider,
      controller: new AbortController(),
      terminalEventAppended: false,
    }
    this.executions.set(execution.id, record)
    this.events.set(execution.id, [])
    this.artifacts.set(execution.id, [])
    this.appendEvent(execution.id, 'run.queued', { providerId: request.providerId })

    if (request.idempotencyKey) {
      this.idempotency.set(`${request.conversationId}:${request.idempotencyKey}`, {
        fingerprint,
        executionId: execution.id,
      })
    }

    queueMicrotask(() => {
      void this.runExecution(execution.id)
    })
    return structuredClone(execution)
  }

  getExecution(id: string): Execution {
    return structuredClone(this.executionRecord(id).public)
  }

  listEvents(executionId: string, after = 0): EventList {
    this.executionRecord(executionId)
    if (!Number.isSafeInteger(after) || after < 0) {
      throw new RuntimeError('VALIDATION_ERROR', 'Event cursor must be a non-negative integer', 400)
    }
    const events = (this.events.get(executionId) ?? []).filter((event) => event.sequence > after)
    const nextCursor = events.at(-1)?.sequence ?? after
    return { events: structuredClone(events), nextCursor }
  }

  listArtifacts(executionId: string): ArtifactList {
    this.executionRecord(executionId)
    return { artifacts: structuredClone(this.artifacts.get(executionId) ?? []) }
  }

  async *subscribeEvents(
    executionId: string,
    after = 0,
    signal?: AbortSignal,
  ): AsyncGenerator<RuntimeEvent> {
    this.executionRecord(executionId)
    let cursor = after
    while (true) {
      if (signal?.aborted) return
      const batch = this.listEvents(executionId, cursor).events
      for (const event of batch) {
        cursor = event.sequence
        yield event
      }
      if (batch.length > 0) continue
      const execution = this.executionRecord(executionId).public
      if (isTerminalExecutionState(execution.state)) return
      await this.waitForChange(executionId, cursor, signal)
    }
  }

  async cancelExecution(executionId: string, reason?: string): Promise<Execution> {
    const record = this.executionRecord(executionId)
    if (isTerminalExecutionState(record.public.state)) return structuredClone(record.public)

    this.setState(record, 'cancelling')
    record.controller.abort(new ExecutionAbortedError(reason))
    this.rejectPendingActions(executionId, new ExecutionAbortedError(reason))

    try {
      await record.provider.cancel?.(executionId, reason)
    } finally {
      this.finalizeCancelled(record, reason)
    }
    return structuredClone(record.public)
  }

  respondAction(executionId: string, actionId: string, input: unknown): Execution {
    const record = this.executionRecord(executionId)
    const pending = this.pendingActions.get(actionId)
    if (!pending || pending.request.executionId !== executionId) {
      throw new RuntimeError('ACTION_NOT_FOUND', `Action not found: ${actionId}`, 404)
    }
    if (pending.settled) {
      throw new RuntimeError('ACTION_ALREADY_RESOLVED', `Action already resolved: ${actionId}`, 409)
    }
    if (record.public.state !== 'awaiting_approval' && record.public.state !== 'awaiting_input') {
      throw new RuntimeError(
        'INVALID_STATE',
        `Execution cannot accept an action response while ${record.public.state}`,
        409,
      )
    }

    const response = actionResponse(input)
    pending.settled = true
    this.pendingActions.delete(actionId)
    this.setState(record, 'running')
    this.appendEvent(executionId, 'action.responded', {
      actionId,
      ...(response.approved === undefined ? {} : { approved: response.approved }),
    })
    pending.resolve(response)
    return structuredClone(record.public)
  }

  private async runExecution(executionId: string): Promise<void> {
    const record = this.executionRecord(executionId)
    if (record.controller.signal.aborted || record.public.state === 'cancelled') {
      this.finalizeCancelled(record)
      return
    }

    try {
      this.setState(record, 'starting')
      this.setState(record, 'running', { startedAt: now() })
      this.appendEvent(executionId, 'run.started', { providerId: record.provider.manifest.id })

      const context: ProviderRunContext = {
        executionId,
        conversationId: record.public.conversationId,
        input: record.public.input,
        config: structuredClone(record.public.effectiveConfig),
        signal: record.controller.signal,
        emit: (type: ProviderEventType, data: JsonObject) => {
          if (isTerminalExecutionState(record.public.state)) return
          if (type === 'artifact.created') {
            this.appendArtifact(record, data)
            return
          }
          this.appendEvent(executionId, type, structuredClone(data))
        },
        requestAction: (input: ProviderActionInput) => this.requestAction(record, input),
      }

      const result = await record.provider.run(context)
      if (record.controller.signal.aborted) {
        this.finalizeCancelled(record)
        return
      }
      if (isTerminalExecutionState(record.public.state)) return

      const finalOutput = result.finalOutput ?? ''
      this.appendEvent(executionId, 'output.text.done', { text: finalOutput })
      this.setState(record, 'succeeded', { endedAt: now(), finalOutput })
      this.appendTerminalEvent(record, 'run.completed', { finalOutput })
    } catch (error) {
      if (record.controller.signal.aborted || record.public.state === 'cancelling') {
        this.finalizeCancelled(record, errorMessage(error))
        return
      }
      if (isTerminalExecutionState(record.public.state)) return
      const message = errorMessage(error)
      this.setState(record, 'failed', {
        endedAt: now(),
        error: { code: 'PROVIDER_ERROR', message },
      })
      this.appendTerminalEvent(record, 'run.failed', {
        code: 'PROVIDER_ERROR',
        message,
      })
    }
  }

  private requestAction(
    record: ExecutionRecord,
    input: ProviderActionInput,
  ): Promise<ActionResponse> {
    if (record.controller.signal.aborted) {
      return Promise.reject(new ExecutionAbortedError())
    }
    if (record.public.state !== 'running') {
      return Promise.reject(
        new RuntimeError(
          'INVALID_STATE',
          `Provider requested an action while execution was ${record.public.state}`,
          409,
        ),
      )
    }

    const request: ActionRequest = {
      id: makeId('action'),
      executionId: record.public.id,
      kind: input.kind,
      title: input.title,
      payload: structuredClone(input.payload ?? {}),
      createdAt: now(),
      ...(input.description === undefined ? {} : { description: input.description }),
    }
    this.setState(record, input.kind === 'approval' ? 'awaiting_approval' : 'awaiting_input')
    this.appendEvent(record.public.id, 'action.required', actionRequestData(request))

    return new Promise<ActionResponse>((resolve, reject) => {
      this.pendingActions.set(request.id, { request, resolve, reject, settled: false })
    })
  }

  private assertCapabilities(manifest: ProviderManifest, required: string[]): void {
    const unsupported = required.filter((capability) => {
      const support = manifest.capabilities[capability]
      return support === undefined || support === 'unsupported'
    })
    if (unsupported.length > 0) {
      throw new RuntimeError(
        'CAPABILITY_UNSUPPORTED',
        `Provider ${manifest.id} does not support required capabilities`,
        422,
        { providerId: manifest.id, capabilities: unsupported },
      )
    }
  }

  private setState(
    record: ExecutionRecord,
    state: ExecutionState,
    patch: Partial<Pick<Execution, 'startedAt' | 'endedAt' | 'finalOutput' | 'error'>> = {},
  ): void {
    record.public = {
      ...record.public,
      ...patch,
      state,
      updatedAt: now(),
    }
  }

  private appendEvent(
    executionId: string,
    type: StandardEventType,
    data: JsonObject,
  ): RuntimeEvent {
    const events = this.events.get(executionId)
    if (!events) throw notFound('Execution', executionId)
    const sequence = events.length + 1
    const event: RuntimeEvent = {
      id: `${executionId}:${sequence}`,
      executionId,
      sequence,
      type,
      time: now(),
      data,
    }
    events.push(event)
    this.notify(executionId)
    return event
  }

  private appendArtifact(record: ExecutionRecord, data: JsonObject): Artifact {
    const parsed = CreateArtifactInputSchema.safeParse(data)
    if (!parsed.success) throw new Error('Provider emitted an invalid artifact descriptor')

    const artifacts = this.artifacts.get(record.public.id)
    if (!artifacts) throw notFound('Execution', record.public.id)
    if (artifacts.some((artifact) => artifact.id === parsed.data.id)) {
      throw new Error(`Provider emitted duplicate artifact id: ${parsed.data.id}`)
    }

    const artifact: Artifact = {
      ...parsed.data,
      executionId: record.public.id,
      createdAt: now(),
      metadata: structuredClone(parsed.data.metadata ?? {}),
    }
    artifacts.push(artifact)
    this.appendEvent(record.public.id, 'artifact.created', artifactData(artifact))
    return artifact
  }

  private appendTerminalEvent(
    record: ExecutionRecord,
    type: Extract<StandardEventType, 'run.completed' | 'run.failed' | 'run.cancelled'>,
    data: JsonObject,
  ): void {
    if (record.terminalEventAppended) return
    record.terminalEventAppended = true
    this.appendEvent(record.public.id, type, data)
  }

  private finalizeCancelled(record: ExecutionRecord, reason?: string): void {
    if (record.public.state === 'cancelled' && record.terminalEventAppended) return
    if (record.public.state === 'succeeded' || record.public.state === 'failed') return
    this.setState(record, 'cancelled', { endedAt: now() })
    this.appendTerminalEvent(record, 'run.cancelled', reason ? { reason } : {})
  }

  private executionRecord(id: string): ExecutionRecord {
    const record = this.executions.get(id)
    if (!record) throw notFound('Execution', id)
    return record
  }

  private rejectPendingActions(executionId: string, error: Error): void {
    for (const [id, pending] of this.pendingActions) {
      if (pending.request.executionId !== executionId || pending.settled) continue
      pending.settled = true
      this.pendingActions.delete(id)
      pending.reject(error)
    }
  }

  private notify(executionId: string): void {
    for (const listener of this.listeners.get(executionId) ?? []) listener()
  }

  private waitForChange(executionId: string, cursor: number, signal?: AbortSignal): Promise<void> {
    return new Promise((resolve) => {
      const listeners = this.listeners.get(executionId) ?? new Set<EventListener>()
      this.listeners.set(executionId, listeners)

      const cleanup = (): void => {
        listeners.delete(onChange)
        signal?.removeEventListener('abort', onChange)
      }
      const onChange = (): void => {
        cleanup()
        resolve()
      }
      listeners.add(onChange)
      signal?.addEventListener('abort', onChange, { once: true })

      const latest = this.events.get(executionId)?.at(-1)?.sequence ?? 0
      const state = this.executionRecord(executionId).public.state
      if (latest > cursor || isTerminalExecutionState(state) || signal?.aborted) onChange()
    })
  }
}

function actionResponse(input: unknown): ActionResponse {
  const parsed = ActionResponseSchema.safeParse(input)
  if (!parsed.success) throw validationError('Invalid action response')
  return parsed.data
}

function validationError(message: string): RuntimeError {
  return new RuntimeError('VALIDATION_ERROR', message, 400)
}

function actionRequestData(request: ActionRequest): JsonObject {
  return structuredClone(request) as unknown as JsonObject
}

function artifactData(artifact: Artifact): JsonObject {
  return structuredClone(artifact) as unknown as JsonObject
}

function notFound(kind: string, id: string): RuntimeError {
  return new RuntimeError('NOT_FOUND', `${kind} not found: ${id}`, 404)
}

function makeId(prefix: string): string {
  return `${prefix}_${randomUUID().replaceAll('-', '')}`
}

function now(): string {
  return new Date().toISOString()
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}

function stableStringify(value: StartExecutionRequest | JsonObject): string {
  return JSON.stringify(sortJson(value as unknown as JsonObject))
}

function sortJson(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sortJson)
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, item]) => [key, sortJson(item)]),
    )
  }
  return value
}
