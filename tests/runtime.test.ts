import { describe, expect, it, vi } from 'vitest'
import {
  type HarnessProvider,
  InMemoryHarnessRuntime,
  type RuntimeError,
} from '../packages/core/src/index.js'
import { MockProvider } from '../packages/provider-mock/src/index.js'

describe('in-memory runtime', () => {
  it.each(['reserved-event', 'non-json', 'invalid-delta', 'invalid-output', 'invalid-action'])(
    'rejects %s without corrupting portable events',
    async (mode) => {
      const provider: HarnessProvider = {
        manifest: new MockProvider().manifest,
        async run(context) {
          if (mode === 'reserved-event')
            context.emit('run.completed' as Parameters<typeof context.emit>[0], {})
          if (mode === 'non-json')
            context.emit('provider.event', { invalid: Number.POSITIVE_INFINITY })
          if (mode === 'invalid-delta') context.emit('output.text.delta', { text: 42 })
          if (mode === 'invalid-output') return { finalOutput: 42 as unknown as string }
          if (mode === 'invalid-action')
            await context.requestAction({ kind: 'approval', title: '' })
          return { finalOutput: 'unreachable' }
        },
      }
      const runtime = new InMemoryHarnessRuntime([provider])
      const execution = runtime.startExecution({
        conversationId: runtime.createConversation().id,
        providerId: 'mock',
        input: 'synthetic boundary probe',
      })
      const events = await collect(runtime.subscribeEvents(execution.id))
      expect(runtime.getExecution(execution.id).state).toBe('failed')
      expect(
        events.filter((event) =>
          ['run.completed', 'run.failed', 'run.cancelled'].includes(event.type),
        ),
      ).toHaveLength(1)
      expect(events.at(-1)?.type).toBe('run.failed')
      expect(events.map((event) => event.sequence)).toEqual(events.map((_, index) => index + 1))
    },
  )

  it.each(['return', 'throw'])(
    'settles abandoned actions when a provider chooses to %s',
    async (mode) => {
      let rejectedAction: Promise<string> | undefined
      const provider: HarnessProvider = {
        manifest: new MockProvider().manifest,
        async run(context) {
          rejectedAction = context
            .requestAction({ kind: 'approval', title: 'Synthetic approval' })
            .then(
              () => 'unexpected resolution',
              (error: Error) => error.message,
            )
          if (mode === 'throw') throw new Error('synthetic provider failure')
          return { finalOutput: 'premature success' }
        },
      }
      const runtime = new InMemoryHarnessRuntime([provider])
      const execution = runtime.startExecution({
        conversationId: runtime.createConversation().id,
        providerId: 'mock',
        input: 'synthetic abandoned action',
      })
      const events = await collect(runtime.subscribeEvents(execution.id))
      expect(runtime.getExecution(execution.id).state).toBe('failed')
      expect(await rejectedAction).toBe(
        mode === 'return'
          ? 'Provider finished with an unresolved action'
          : 'synthetic provider failure',
      )
      const action = events.find((event) => event.type === 'action.required')
      expect(() =>
        runtime.respondAction(execution.id, String(action?.data.id), { approved: true }),
      ).toThrowError(expect.objectContaining({ code: 'ACTION_NOT_FOUND' }))
    },
  )

  it('runs an execution with contiguous, replayable events', async () => {
    const runtime = new InMemoryHarnessRuntime([new MockProvider()])
    const conversation = runtime.createConversation({ metadata: { tenant: 'example' } })
    const execution = runtime.startExecution({
      conversationId: conversation.id,
      providerId: 'mock',
      input: 'hello runtime',
      idempotencyKey: 'basic',
    })

    const events = await collect(runtime.subscribeEvents(execution.id))
    const completed = runtime.getExecution(execution.id)

    expect(completed.state).toBe('succeeded')
    expect(completed.finalOutput).toBe('Echo: hello runtime')
    expect(events.map((event) => event.sequence)).toEqual(events.map((_, index) => index + 1))
    expect(events.at(-1)?.type).toBe('run.completed')
    expect(runtime.listEvents(execution.id, 2).events[0]?.sequence).toBe(3)
  })

  it('returns the same execution for a matching idempotency key', () => {
    const runtime = new InMemoryHarnessRuntime([new MockProvider()])
    const conversation = runtime.createConversation()
    const request = {
      conversationId: conversation.id,
      providerId: 'mock',
      input: 'same request',
      idempotencyKey: 'stable-key',
    }

    expect(runtime.startExecution(request).id).toBe(runtime.startExecution(request).id)
    expect(() => runtime.startExecution({ ...request, input: 'different request' })).toThrowError(
      expect.objectContaining<Partial<RuntimeError>>({ code: 'IDEMPOTENCY_CONFLICT' }),
    )
  })

  it('rejects unsupported required capabilities before execution', () => {
    const runtime = new InMemoryHarnessRuntime([new MockProvider()])
    const conversation = runtime.createConversation()

    expect(() =>
      runtime.startExecution({
        conversationId: conversation.id,
        providerId: 'mock',
        input: 'probe',
        requiredCapabilities: ['extension.sandbox'],
      }),
    ).toThrowError(
      expect.objectContaining<Partial<RuntimeError>>({ code: 'CAPABILITY_UNSUPPORTED' }),
    )
  })

  it('pauses for approval and resumes after a response', async () => {
    const runtime = new InMemoryHarnessRuntime([new MockProvider()])
    const conversation = runtime.createConversation()
    const execution = runtime.startExecution({
      conversationId: conversation.id,
      providerId: 'mock',
      input: 'approved task',
      config: { requireApproval: true },
    })

    const required = await waitForEvent(runtime, execution.id, 'action.required')
    expect(runtime.getExecution(execution.id).state).toBe('awaiting_approval')
    runtime.respondAction(execution.id, String(required.data.id), { approved: true })
    expect(() =>
      runtime.respondAction(execution.id, String(required.data.id), { approved: true }),
    ).toThrowError(
      expect.objectContaining<Partial<RuntimeError>>({ code: 'ACTION_ALREADY_RESOLVED' }),
    )

    await collect(runtime.subscribeEvents(execution.id, required.sequence))
    expect(runtime.getExecution(execution.id).state).toBe('succeeded')
    expect(
      runtime.listEvents(execution.id).events.some((event) => event.type === 'action.responded'),
    ).toBe(true)
  })

  it('cancels a running execution exactly once', async () => {
    const runtime = new InMemoryHarnessRuntime([new MockProvider()])
    const conversation = runtime.createConversation()
    const execution = runtime.startExecution({
      conversationId: conversation.id,
      providerId: 'mock',
      input: 'one two three four',
      config: { delayMs: 100 },
    })

    await waitForEvent(runtime, execution.id, 'run.started')
    await runtime.cancelExecution(execution.id, 'test cancellation')
    const events = runtime.listEvents(execution.id).events

    expect(runtime.getExecution(execution.id).state).toBe('cancelled')
    expect(events.filter((event) => event.type === 'run.cancelled')).toHaveLength(1)
    expect(events.at(-1)?.type).toBe('run.cancelled')
  })

  it('deduplicates concurrent cancellation and records provider cleanup failure', async () => {
    const mock = new MockProvider()
    const cancel = vi.fn(async () => {
      throw new Error('provider cleanup failed')
    })
    const provider: HarnessProvider = {
      manifest: mock.manifest,
      cancel,
      run: (context) =>
        new Promise((_, reject) => {
          context.signal.addEventListener('abort', () => reject(new Error('aborted')), {
            once: true,
          })
        }),
    }
    const runtime = new InMemoryHarnessRuntime([provider])
    const conversation = runtime.createConversation()
    const execution = runtime.startExecution({
      conversationId: conversation.id,
      providerId: 'mock',
      input: 'concurrent cancellation',
    })

    await waitForEvent(runtime, execution.id, 'run.started')
    const [first, second] = await Promise.all([
      runtime.cancelExecution(execution.id, 'caller stopped'),
      runtime.cancelExecution(execution.id, 'caller stopped'),
    ])
    const cancelledEvents = runtime
      .listEvents(execution.id)
      .events.filter((event) => event.type === 'run.cancelled')

    expect(first.state).toBe('cancelled')
    expect(second.state).toBe('cancelled')
    expect(cancel).toHaveBeenCalledTimes(1)
    expect(cancelledEvents).toHaveLength(1)
    expect(cancelledEvents[0]?.data).toEqual({
      reason: 'caller stopped',
      providerCleanupError: 'provider cleanup failed',
    })
  })

  it('lets immediate cancellation own terminalization before provider startup', async () => {
    const mock = new MockProvider()
    const cancel = vi.fn(async () => {
      await Promise.resolve()
      throw new Error('startup cleanup failed')
    })
    const run = vi.fn(mock.run.bind(mock))
    const provider: HarnessProvider = { manifest: mock.manifest, cancel, run }
    const runtime = new InMemoryHarnessRuntime([provider])
    const conversation = runtime.createConversation()
    const execution = runtime.startExecution({
      conversationId: conversation.id,
      providerId: 'mock',
      input: 'cancel before startup',
    })

    const cancelled = await runtime.cancelExecution(execution.id, 'immediate cancellation')
    const events = runtime.listEvents(execution.id).events

    expect(cancelled.state).toBe('cancelled')
    expect(run).not.toHaveBeenCalled()
    expect(cancel).toHaveBeenCalledTimes(1)
    expect(events.filter((event) => event.type === 'run.cancelled')).toHaveLength(1)
    expect(events.at(-1)?.data).toEqual({
      reason: 'immediate cancellation',
      providerCleanupError: 'startup cleanup failed',
    })
  })

  it('stores validated artifact descriptors for replay and listing', async () => {
    const runtime = new InMemoryHarnessRuntime([new MockProvider()])
    const conversation = runtime.createConversation()
    const execution = runtime.startExecution({
      conversationId: conversation.id,
      providerId: 'mock',
      input: 'produce an artifact',
      config: { artifactName: 'analysis.txt' },
    })

    await collect(runtime.subscribeEvents(execution.id))
    const artifact = runtime.listArtifacts(execution.id).artifacts[0]
    const artifactEvent = runtime
      .listEvents(execution.id)
      .events.find((event) => event.type === 'artifact.created')

    expect(artifact).toEqual(
      expect.objectContaining({
        id: `artifact-${execution.id}`,
        executionId: execution.id,
        name: 'analysis.txt',
        mediaType: 'text/plain',
        metadata: {},
      }),
    )
    expect(artifactEvent?.data).toEqual(artifact)
  })

  it('fails the execution when a provider emits an invalid artifact descriptor', async () => {
    const mock = new MockProvider()
    const provider: HarnessProvider = {
      manifest: mock.manifest,
      async run(context) {
        context.emit('artifact.created', { name: 'missing-required-fields' })
        return { finalOutput: 'unreachable' }
      },
    }
    const runtime = new InMemoryHarnessRuntime([provider])
    const conversation = runtime.createConversation()
    const execution = runtime.startExecution({
      conversationId: conversation.id,
      providerId: 'mock',
      input: 'invalid artifact',
    })

    await collect(runtime.subscribeEvents(execution.id))

    expect(runtime.getExecution(execution.id)).toEqual(
      expect.objectContaining({
        state: 'failed',
        error: {
          code: 'PROVIDER_ERROR',
          message: 'Provider emitted an invalid artifact descriptor',
        },
      }),
    )
    expect(runtime.listArtifacts(execution.id).artifacts).toEqual([])
  })

  it('rejects duplicate artifact ids without duplicating event history', async () => {
    const mock = new MockProvider()
    const provider: HarnessProvider = {
      manifest: mock.manifest,
      async run(context) {
        const descriptor = {
          id: 'artifact-duplicate',
          name: 'result.txt',
          mediaType: 'text/plain',
        }
        context.emit('artifact.created', descriptor)
        context.emit('artifact.created', descriptor)
        return { finalOutput: 'unreachable' }
      },
    }
    const runtime = new InMemoryHarnessRuntime([provider])
    const conversation = runtime.createConversation()
    const execution = runtime.startExecution({
      conversationId: conversation.id,
      providerId: 'mock',
      input: 'duplicate artifact',
    })

    await collect(runtime.subscribeEvents(execution.id))

    expect(runtime.getExecution(execution.id)).toEqual(
      expect.objectContaining({
        state: 'failed',
        error: {
          code: 'PROVIDER_ERROR',
          message: 'Provider emitted duplicate artifact id: artifact-duplicate',
        },
      }),
    )
    expect(runtime.listArtifacts(execution.id).artifacts).toHaveLength(1)
    expect(
      runtime.listEvents(execution.id).events.filter((event) => event.type === 'artifact.created'),
    ).toHaveLength(1)
  })
})

async function collect<T>(events: AsyncIterable<T>): Promise<T[]> {
  const result: T[] = []
  for await (const event of events) result.push(event)
  return result
}

async function waitForEvent(runtime: InMemoryHarnessRuntime, executionId: string, type: string) {
  for await (const event of runtime.subscribeEvents(executionId)) {
    if (event.type === type) return event
  }
  throw new Error(`Execution ended before ${type}`)
}
