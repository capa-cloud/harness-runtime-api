import { describe, expect, it } from 'vitest'
import { InMemoryHarnessRuntime, type RuntimeError } from '../packages/core/src/index.js'
import { MockProvider } from '../packages/provider-mock/src/index.js'

describe('in-memory runtime', () => {
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
