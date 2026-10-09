import { resolve } from 'node:path'
import { Readable, Writable } from 'node:stream'
import * as acp from '@agentclientprotocol/sdk'
import type { HarnessProvider, ProviderRunContext } from '@harness-runtime/core'
import {
  JsonObjectSchema,
  PROTOCOL_VERSION,
  type ActionResponse,
  type JsonObject,
  type ProviderManifest,
  ProviderManifestSchema,
  StandardCapability,
} from '@harness-runtime/protocol'
import { startProcess, within } from './process.js'
import { safeStream } from './boundary.js'

export interface AcpProviderOptions {
  command: string
  args?: string[]
  cwd?: string
  env?: Record<string, string | undefined>
  id?: string
  initializationTimeoutMs?: number
  runTimeoutMs?: number
  shutdownGraceMs?: number
  maxMessageBytes?: number
  maxPendingPermissions?: number
}

export class AcpProvider implements HarnessProvider {
  readonly manifest: ProviderManifest
  private readonly options: Required<AcpProviderOptions>
  private readonly active = new Map<string, { cancel(): Promise<void> }>()

  constructor(options: AcpProviderOptions) {
    if (!options.command) throw new Error('ACP command is required')
    this.options = {
      command: options.command,
      args: [...(options.args ?? [])],
      cwd: resolve(options.cwd ?? '.'),
      env: { ...(options.env ?? {}) },
      id: options.id ?? 'acp',
      initializationTimeoutMs: positive(options.initializationTimeoutMs ?? 10_000),
      runTimeoutMs: positive(options.runTimeoutMs ?? 300_000),
      shutdownGraceMs: positive(options.shutdownGraceMs ?? 500),
      maxMessageBytes: positive(options.maxMessageBytes ?? 1_048_576),
      maxPendingPermissions: positive(options.maxPendingPermissions ?? 16),
    }
    this.manifest = ProviderManifestSchema.parse({
      id: this.options.id,
      name: 'ACP v1 Agent Adapter',
      version: '0.1.0',
      protocolVersion: PROTOCOL_VERSION,
      topologies: ['subprocess'],
      capabilities: {
        [StandardCapability.actionApproval]: 'native',
        [StandardCapability.actionInput]: 'unsupported',
        [StandardCapability.artifacts]: 'unsupported',
        [StandardCapability.cancellation]: 'emulated',
        [StandardCapability.conversationContinuity]: 'unsupported',
        [StandardCapability.eventReplay]: 'emulated',
        [StandardCapability.eventStreaming]: 'native',
        [StandardCapability.mcp]: 'unsupported',
        [StandardCapability.sandbox]: 'unsupported',
        [StandardCapability.skills]: 'unsupported',
        [StandardCapability.subagents]: 'unsupported',
      },
      metadata: {
        upstream: 'https://agentclientprotocol.com',
        sdkVersion: '1.7.0',
        nativeSessions: 'per-execution',
        clientFilesystem: false,
        clientTerminal: false,
      },
    })
  }

  async run(context: ProviderRunContext): Promise<{ finalOutput: string }> {
    context.signal.throwIfAborted()
    if (Object.keys(context.config).length > 0) {
      throw new Error(
        'ACP execution config must be empty; configure the trusted provider constructor',
      )
    }
    if (this.active.has(context.executionId)) throw new Error('ACP execution is already active')
    const owned = startProcess(
      this.options.command,
      this.options.args,
      this.options.cwd,
      this.options.env,
      this.options.shutdownGraceMs,
    )
    let connection: acp.ClientConnection | undefined
    let sessionId: string | undefined
    let permissionTail: Promise<void> = Promise.resolve()
    const pendingPermissions = new Set<Promise<acp.RequestPermissionResponse>>()
    const output: string[] = []
    let cancellation: Promise<void> | undefined
    let rejectViolation: () => void = () => undefined
    const violation = new Promise<never>((_resolve, reject) => {
      rejectViolation = () => reject(new Error('ACP peer violated the adapter boundary'))
    })
    void violation.catch(() => undefined)
    const cancel = (): Promise<void> => {
      cancellation ??= (async () => {
        try {
          await within(
            Promise.allSettled([...pendingPermissions]),
            this.options.shutdownGraceMs,
            'ACP permission cancellation timed out',
          )
          if (connection && sessionId && !connection.signal.aborted) {
            await within(
              connection.agent.notify(acp.methods.agent.session.cancel, { sessionId }),
              this.options.shutdownGraceMs,
              'ACP cancellation notification timed out',
            )
          }
        } catch {
          // Native cancellation is best effort; owned process exit still requires confirmation.
        }
        await owned.close()
      })()
      return cancellation
    }
    const active = { cancel }
    this.active.set(context.executionId, active)
    const abort = () => {
      void cancel().catch(() => undefined)
    }
    context.signal.addEventListener('abort', abort, { once: true })
    try {
      const app = acp
        .client({ name: 'harness-runtime-api' })
        .onNotification(acp.methods.client.session.update, ({ params }) => {
          if (!sessionId || params.sessionId !== sessionId) {
            rejectViolation()
            return
          }
          try {
            nativeEvent(context, 'session/update', params)
            if (
              params.update.sessionUpdate === 'agent_message_chunk' &&
              params.update.content.type === 'text'
            ) {
              output.push(params.update.content.text)
              context.emit('output.text.delta', { text: params.update.content.text })
            }
          } catch {
            rejectViolation()
          }
        })
        .onRequest(acp.methods.client.session.requestPermission, ({ params }) => {
          if (pendingPermissions.size >= this.options.maxPendingPermissions) {
            rejectViolation()
            return Promise.resolve(cancelledPermission())
          }
          const permission = permissionTail.then(async () => {
            if (context.signal.aborted || !sessionId || params.sessionId !== sessionId) {
              return cancelledPermission()
            }
            try {
              const response = await context.requestAction({
                kind: 'approval',
                title: params.toolCall.title || 'ACP permission request',
                payload: {
                  toolCallId: params.toolCall.toolCallId,
                  options: params.options.map(({ optionId, name, kind }) => ({
                    optionId,
                    name,
                    kind,
                  })),
                },
              })
              return permissionOutcome(params.options, response)
            } catch {
              return cancelledPermission()
            }
          })
          permissionTail = permission.then(
            () => undefined,
            () => undefined,
          )
          pendingPermissions.add(permission)
          void permission.then(
            () => pendingPermissions.delete(permission),
            () => pendingPermissions.delete(permission),
          )
          return permission
        })
      connection = app.connect(
        safeStream(
          acp.ndJsonStream(
            Writable.toWeb(owned.child.stdin),
            Readable.toWeb(owned.child.stdout) as ReadableStream<Uint8Array>,
            { maxMessageBytes: this.options.maxMessageBytes },
          ),
          rejectViolation,
        ),
      )
      const agent = connection.agent
      return await within(
        Promise.race([
          (async () => {
            const initialized = await within(
              agent.request(acp.methods.agent.initialize, {
                protocolVersion: acp.PROTOCOL_VERSION,
                clientCapabilities: {
                  fs: { readTextFile: false, writeTextFile: false },
                  terminal: false,
                },
              }),
              this.options.initializationTimeoutMs,
              'ACP initialization timed out',
            )
            if (initialized.protocolVersion !== acp.PROTOCOL_VERSION)
              throw new Error('ACP protocol version mismatch')
            context.signal.throwIfAborted()
            sessionId = (
              await agent.request(acp.methods.agent.session.new, {
                cwd: this.options.cwd,
                mcpServers: [],
              })
            ).sessionId
            context.signal.throwIfAborted()
            const result = await agent.request(acp.methods.agent.session.prompt, {
              sessionId,
              prompt: [{ type: 'text', text: context.input }],
            })
            if (result.stopReason === 'cancelled') throw new Error('ACP native turn was cancelled')
            nativeEvent(context, 'turn.completed', { stopReason: result.stopReason })
            return { finalOutput: output.join('') }
          })(),
          violation,
        ]),
        this.options.runTimeoutMs,
        'ACP execution timed out',
      )
    } catch {
      throw new Error('ACP agent request failed')
    } finally {
      context.signal.removeEventListener('abort', abort)
      try {
        if (context.signal.aborted && cancellation) await cancellation
        else await owned.close()
      } finally {
        connection?.close()
        if (this.active.get(context.executionId) === active) this.active.delete(context.executionId)
      }
    }
  }

  async cancel(executionId: string): Promise<void> {
    await this.active.get(executionId)?.cancel()
  }
}

function positive(value: number): number {
  if (!Number.isSafeInteger(value) || value <= 0)
    throw new Error('ACP limits must be positive safe integers')
  return value
}

function nativeEvent(context: ProviderRunContext, method: string, params: unknown): void {
  const parsed = JsonObjectSchema.safeParse(params)
  if (!parsed.success) throw new Error('ACP agent emitted invalid JSON')
  context.emit('provider.event', { provider: 'acp', method, params: parsed.data })
}

function cancelledPermission(): acp.RequestPermissionResponse {
  return { outcome: { outcome: 'cancelled' } }
}

function permissionOutcome(
  options: acp.PermissionOption[],
  response: ActionResponse,
): acp.RequestPermissionResponse {
  if (
    new Set(options.map((option) => option.optionId)).size !== options.length ||
    options.some((option) => option.optionId === '')
  )
    return cancelledPermission()
  const selected =
    typeof response.value === 'string'
      ? response.value
      : response.value && typeof response.value === 'object' && !Array.isArray(response.value)
        ? (response.value as JsonObject).optionId
        : undefined
  if (response.value !== undefined && selected === undefined) return cancelledPermission()
  const option =
    selected === undefined
      ? options.find(
          (item) => item.kind === (response.approved === true ? 'allow_once' : 'reject_once'),
        )
      : options.find((item) => item.optionId === selected)
  if (
    !option ||
    (option.kind.startsWith('allow_') && response.approved !== true) ||
    (option.kind.startsWith('reject_') && response.approved === true)
  )
    return cancelledPermission()
  if (response.approved === undefined && selected === undefined) return cancelledPermission()
  return { outcome: { outcome: 'selected', optionId: option.optionId } }
}
