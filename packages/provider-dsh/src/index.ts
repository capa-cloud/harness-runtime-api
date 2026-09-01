import type { HarnessProvider, ProviderRunContext } from '@harness-runtime/core'
import {
  PROTOCOL_VERSION,
  type JsonObject,
  type ProviderManifest,
  StandardCapability,
} from '@harness-runtime/protocol'

export interface DshLaunchOptions {
  command: string
  args?: string[]
  cwd?: string
  env?: Record<string, string | undefined>
  requestTimeoutMs?: number
  shutdownTimeoutMs?: number
  disposeEofGraceMs?: number
  disposeGraceMs?: number
}

export interface DshHarnessOptions {
  launch: DshLaunchOptions
  cwd?: string
  provider?: string
  model?: string
  maxTokens?: number
}

export interface DshNotification {
  method: string
  params: Record<string, unknown>
}

export interface DshRunResult {
  sessionId: string
  finalResponse: string
  events: unknown[]
  notifications: DshNotification[]
}

export interface DshHarnessClient {
  run(
    input: string,
    options?: {
      sessionId?: string
      onNotification?: (notification: DshNotification) => void
    },
  ): Promise<DshRunResult>
  close(): Promise<void>
}

export type DshHarnessFactory = (
  options: DshHarnessOptions,
) => DshHarnessClient | Promise<DshHarnessClient>

export interface DshProviderOptions {
  launch: DshLaunchOptions
  workspace?: string
  modelProvider?: string
  model?: string
  maxTokens?: number
  harnessFactory?: DshHarnessFactory
}

interface ActiveDshClient {
  close(): Promise<void>
}

const manifest: ProviderManifest = {
  id: 'dsh',
  name: 'DeepSeek Harness Adapter',
  version: '0.1.0',
  protocolVersion: PROTOCOL_VERSION,
  topologies: ['subprocess'],
  capabilities: {
    [StandardCapability.actionApproval]: 'unsupported',
    [StandardCapability.actionInput]: 'unsupported',
    [StandardCapability.artifacts]: 'unsupported',
    [StandardCapability.cancellation]: 'emulated',
    [StandardCapability.conversationContinuity]: 'unsupported',
    [StandardCapability.eventReplay]: 'emulated',
    [StandardCapability.eventStreaming]: 'native',
    [StandardCapability.mcp]: 'native',
    [StandardCapability.sandbox]: 'native',
    [StandardCapability.skills]: 'native',
    [StandardCapability.subagents]: 'native',
  },
  metadata: {
    upstream: 'https://github.com/deepseek-ai/deepseek-harness',
    sdkCompatibility: '>=0.1.0-rc.7 <0.2.0',
  },
}

export class DshProvider implements HarnessProvider {
  readonly manifest = manifest
  private readonly options: DshProviderOptions
  private readonly factory: DshHarnessFactory
  private readonly active = new Map<string, ActiveDshClient>()

  constructor(options: DshProviderOptions) {
    this.options = options
    this.factory = options.harnessFactory ?? defaultFactory
  }

  async run(context: ProviderRunContext): Promise<{ finalOutput: string }> {
    const client = await this.factory({
      launch: {
        ...this.options.launch,
        env: this.options.launch.env ?? {},
      },
      ...(this.options.workspace === undefined ? {} : { cwd: this.options.workspace }),
      ...(this.options.modelProvider === undefined ? {} : { provider: this.options.modelProvider }),
      ...(this.options.model === undefined ? {} : { model: this.options.model }),
      ...(this.options.maxTokens === undefined ? {} : { maxTokens: this.options.maxTokens }),
    })
    const active = closeOnce(client)
    this.active.set(context.executionId, active)

    const abort = (): void => {
      void active.close().catch(() => undefined)
    }
    context.signal.addEventListener('abort', abort, { once: true })

    try {
      if (context.signal.aborted) throw new Error('Execution aborted before DSH started')
      const result = await client.run(context.input, {
        sessionId: `conversation-${context.conversationId}`,
        onNotification: (notification) => this.forwardNotification(context, notification),
      })
      return { finalOutput: result.finalResponse }
    } finally {
      context.signal.removeEventListener('abort', abort)
      if (this.active.get(context.executionId) === active) this.active.delete(context.executionId)
      await active.close()
    }
  }

  async cancel(executionId: string): Promise<void> {
    await this.active.get(executionId)?.close()
  }

  private forwardNotification(context: ProviderRunContext, notification: DshNotification): void {
    const text = textDelta(notification)
    if (text !== undefined) context.emit('output.text.delta', { text })
    context.emit('provider.event', {
      provider: 'dsh',
      method: notification.method,
      params: toJsonObject(notification.params),
    })
  }
}

function closeOnce(client: DshHarnessClient): ActiveDshClient {
  let closing: Promise<void> | undefined
  return {
    close: () => {
      closing ??= Promise.resolve().then(() => client.close())
      return closing
    },
  }
}

async function defaultFactory(options: DshHarnessOptions): Promise<DshHarnessClient> {
  const packageName = '@deepseek-ai/dsh-sdk-client'
  const candidate: unknown = await import(packageName)
  if (!isRecord(candidate) || typeof candidate.DeepSeekHarness !== 'function') {
    throw new Error(`${packageName} does not export DeepSeekHarness`)
  }
  const module = candidate as {
    DeepSeekHarness: new (input: DshHarnessOptions) => DshHarnessClient
  }
  return new module.DeepSeekHarness(options)
}

function textDelta(notification: DshNotification): string | undefined {
  if (notification.method !== 'session.event') return undefined
  const event = notification.params.event
  if (!isRecord(event) || event.type !== 'assistant/chunk') return undefined
  const data = event.data
  if (!isRecord(data)) return undefined
  const chunk = data.chunk
  if (!isRecord(chunk) || chunk.type !== 'text-delta' || typeof chunk.text !== 'string') {
    return undefined
  }
  return chunk.text
}

function toJsonObject(value: Record<string, unknown>): JsonObject {
  return JSON.parse(JSON.stringify(value)) as JsonObject
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}
