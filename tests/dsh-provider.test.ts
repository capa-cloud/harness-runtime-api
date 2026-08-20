import { describe, expect, it, vi } from 'vitest'
import { InMemoryHarnessRuntime } from '../packages/core/src/index.js'
import {
  DshProvider,
  type DshHarnessClient,
  type DshHarnessFactory,
} from '../packages/provider-dsh/src/index.js'

describe('DSH provider adapter', () => {
  it('maps text deltas and preserves raw provider notifications', async () => {
    const close = vi.fn(async () => undefined)
    const factory: DshHarnessFactory = async (): Promise<DshHarnessClient> => ({
      close,
      async run(_input, options) {
        options?.onNotification?.({
          method: 'session.event',
          params: {
            event: {
              type: 'assistant/chunk',
              data: { chunk: { type: 'text-delta', text: 'portable ' } },
            },
          },
        })
        options?.onNotification?.({ method: 'session.status', params: { status: 'idle' } })
        return {
          sessionId: 'session-example',
          finalResponse: 'portable result',
          events: [],
          notifications: [],
        }
      },
    })
    const provider = new DshProvider({
      launch: { command: 'dsh' },
      harnessFactory: factory,
    })
    const runtime = new InMemoryHarnessRuntime([provider])
    const conversation = runtime.createConversation()
    const execution = runtime.startExecution({
      conversationId: conversation.id,
      providerId: 'dsh',
      input: 'analyze this',
    })

    for await (const _event of runtime.subscribeEvents(execution.id)) {
      // Drain the complete execution stream.
    }
    const events = runtime.listEvents(execution.id).events

    expect(runtime.getExecution(execution.id).finalOutput).toBe('portable result')
    expect(events).toContainEqual(
      expect.objectContaining({ type: 'output.text.delta', data: { text: 'portable ' } }),
    )
    expect(events.filter((event) => event.type === 'provider.event')).toHaveLength(2)
    expect(close).toHaveBeenCalledTimes(1)
    expect(provider.manifest.capabilities['action.approval']).toBe('unsupported')
  })

  it('closes the subprocess once when abort and explicit cancellation race', async () => {
    let rejectRun: ((error: Error) => void) | undefined
    const close = vi.fn(async () => {
      rejectRun?.(new Error('subprocess closed'))
    })
    const factory: DshHarnessFactory = async () => ({
      close,
      run: () =>
        new Promise((_, reject) => {
          rejectRun = reject
        }),
    })
    const runtime = new InMemoryHarnessRuntime([
      new DshProvider({ launch: { command: 'dsh' }, harnessFactory: factory }),
    ])
    const conversation = runtime.createConversation()
    const execution = runtime.startExecution({
      conversationId: conversation.id,
      providerId: 'dsh',
      input: 'cancel this run',
    })

    await waitForState(runtime, execution.id, 'running')
    await runtime.cancelExecution(execution.id, 'test cancellation')
    await vi.waitFor(() => expect(runtime.getExecution(execution.id).state).toBe('cancelled'))

    expect(close).toHaveBeenCalledTimes(1)
  })

  it('closes a client that becomes available after cancellation', async () => {
    let resolveFactory: ((client: DshHarnessClient) => void) | undefined
    const close = vi.fn(async () => undefined)
    const run = vi.fn(async () => ({
      sessionId: 'late-session',
      finalResponse: 'should not run',
      events: [],
      notifications: [],
    }))
    const factory: DshHarnessFactory = () =>
      new Promise((resolve) => {
        resolveFactory = resolve
      })
    const runtime = new InMemoryHarnessRuntime([
      new DshProvider({ launch: { command: 'dsh' }, harnessFactory: factory }),
    ])
    const conversation = runtime.createConversation()
    const execution = runtime.startExecution({
      conversationId: conversation.id,
      providerId: 'dsh',
      input: 'cancel during startup',
    })

    await waitForState(runtime, execution.id, 'running')
    await runtime.cancelExecution(execution.id, 'startup cancellation')
    resolveFactory?.({ close, run })
    await vi.waitFor(() => expect(close).toHaveBeenCalledTimes(1))

    expect(run).not.toHaveBeenCalled()
    expect(runtime.getExecution(execution.id).state).toBe('cancelled')
  })
})

async function waitForState(
  runtime: InMemoryHarnessRuntime,
  executionId: string,
  state: string,
): Promise<void> {
  await vi.waitFor(() => expect(runtime.getExecution(executionId).state).toBe(state))
}
