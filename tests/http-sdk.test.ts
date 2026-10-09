import { describe, expect, it, vi } from 'vitest'
import { InMemoryHarnessRuntime } from '../packages/core/src/index.js'
import { MockProvider } from '../packages/provider-mock/src/index.js'
import {
  HarnessRuntimeClient,
  HarnessRuntimeHttpError,
  HarnessRuntimeStreamInterruptedError,
} from '../packages/sdk-typescript/src/index.js'
import { createApp } from '../packages/server/src/index.js'

describe('HTTP API and TypeScript SDK', () => {
  it('runs an execution through HTTP and SSE', async () => {
    const app = createApp(new InMemoryHarnessRuntime([new MockProvider()]))
    const client = new HarnessRuntimeClient({
      baseUrl: 'http://runtime.test',
      fetch: async (input, init) => app.request(input, init),
    })

    const description = await client.describeRuntime()
    const conversation = await client.createConversation({ metadata: { source: 'sdk-test' } })
    const execution = await client.startExecution({
      conversationId: conversation.id,
      providerId: 'mock',
      input: 'from sdk',
      config: { artifactName: 'sdk-result.txt' },
    })
    const streamed = []
    for await (const event of client.streamEvents(execution.id)) streamed.push(event)
    const completed = await client.getExecution(execution.id)
    const artifacts = await client.listArtifacts(execution.id)

    expect(description.providers.map((provider) => provider.id)).toContain('mock')
    expect(conversation.metadata).toEqual({ source: 'sdk-test' })
    expect(completed.finalOutput).toBe('Echo: from sdk')
    expect(artifacts.artifacts).toEqual([
      expect.objectContaining({
        executionId: execution.id,
        name: 'sdk-result.txt',
        mediaType: 'text/plain',
      }),
    ])
    expect(streamed.at(-1)?.type).toBe('run.completed')

    const replayed = []
    for await (const event of client.streamEvents(execution.id, { after: 2 })) replayed.push(event)
    expect(replayed.at(-1)?.type).toBe('run.completed')
  })

  it('returns a stable validation problem for malformed input', async () => {
    const app = createApp(new InMemoryHarnessRuntime([new MockProvider()]))
    const response = await app.request('/v1/executions', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ providerId: 'mock' }),
    })

    expect(response.status).toBe(400)
    expect(await response.json()).toEqual({
      code: 'VALIDATION_ERROR',
      message: 'Invalid execution request',
    })

    const invalidCancellation = await app.request('/v1/executions/missing:cancel', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ reason: 42 }),
    })
    expect(invalidCancellation.status).toBe(400)
    expect(await invalidCancellation.json()).toEqual({
      code: 'VALIDATION_ERROR',
      message: 'Invalid cancellation request',
    })
  })

  it('surfaces protocol errors as typed SDK errors', async () => {
    const app = createApp(new InMemoryHarnessRuntime([new MockProvider()]))
    const client = new HarnessRuntimeClient({
      baseUrl: 'http://runtime.test',
      fetch: async (input, init) => app.request(input, init),
    })

    await expect(client.getExecution('missing')).rejects.toBeInstanceOf(HarnessRuntimeHttpError)
  })

  it('supports approval responses and cancellation through command routes', async () => {
    const app = createApp(new InMemoryHarnessRuntime([new MockProvider()]))
    const client = new HarnessRuntimeClient({
      baseUrl: 'http://runtime.test',
      fetch: async (input, init) => app.request(input, init),
    })
    const conversation = await client.createConversation()
    const awaiting = await client.startExecution({
      conversationId: conversation.id,
      providerId: 'mock',
      input: 'approval route',
      config: { requireApproval: true },
    })
    const required = await waitForEvent(client, awaiting.id, 'action.required')

    await client.respondAction(awaiting.id, String(required.data.id), { approved: true })
    expect((await client.waitForTerminal(awaiting.id)).state).toBe('succeeded')

    const cancellable = await client.startExecution({
      conversationId: conversation.id,
      providerId: 'mock',
      input: 'cancel route',
      config: { delayMs: 100 },
    })
    expect((await client.cancelExecution(cancellable.id, 'route test')).state).toBe('cancelled')
  })

  it('cancels the response stream when event consumption stops early', async () => {
    const cancel = vi.fn()
    const body = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(
          new TextEncoder().encode(
            `data: ${JSON.stringify({
              id: 'exec_example:1',
              executionId: 'exec_example',
              sequence: 1,
              type: 'run.queued',
              time: '2026-08-20T00:00:00.000Z',
              data: {},
            })}\n\n`,
          ),
        )
      },
      cancel,
    })
    const client = new HarnessRuntimeClient({
      baseUrl: 'http://runtime.test',
      fetch: vi.fn(async () => new Response(body, { status: 200 })),
    })

    for await (const _event of client.streamEvents('exec_example')) break

    expect(cancel).toHaveBeenCalledTimes(1)
  })

  it('rejects premature SSE EOF when the execution is still awaiting approval', async () => {
    const runtime = new InMemoryHarnessRuntime([new MockProvider()])
    const app = createApp(runtime)
    const client = new HarnessRuntimeClient({
      baseUrl: 'http://runtime.test',
      fetch: async (input, init) =>
        new Headers(init?.headers).get('accept') === 'text/event-stream'
          ? new Response('', { headers: { 'content-type': 'text/event-stream' } })
          : app.request(input, init),
    })
    const conversation = await client.createConversation()
    const execution = await client.startExecution({
      conversationId: conversation.id,
      providerId: 'mock',
      input: 'interrupted approval',
      config: { requireApproval: true },
    })
    try {
      await expect(client.waitForTerminal(execution.id)).rejects.toMatchObject({
        name: 'HarnessRuntimeStreamInterruptedError',
        execution: { id: execution.id, state: 'awaiting_approval' },
      })
      await expect(client.waitForTerminal(execution.id)).rejects.toBeInstanceOf(
        HarnessRuntimeStreamInterruptedError,
      )
    } finally {
      await runtime.cancelExecution(execution.id)
    }
  })

  it('accepts EOF without replayed events when the execution is already terminal', async () => {
    const runtime = new InMemoryHarnessRuntime([new MockProvider()])
    const execution = runtime.startExecution({
      conversationId: runtime.createConversation().id,
      providerId: 'mock',
      input: 'already terminal',
    })
    await runtime.cancelExecution(execution.id)
    const app = createApp(runtime)
    const client = new HarnessRuntimeClient({
      baseUrl: 'http://runtime.test',
      fetch: async (input, init) =>
        new Headers(init?.headers).get('accept') === 'text/event-stream'
          ? new Response('')
          : app.request(input, init),
    })
    expect((await client.waitForTerminal(execution.id)).state).toBe('cancelled')
  })

  it('stops waiting on a terminal event even when the SSE connection remains open', async () => {
    const cancel = vi.fn()
    const execution = {
      id: 'exec_terminal',
      conversationId: 'conv_terminal',
      providerId: 'mock',
      state: 'succeeded',
      input: 'done',
      requiredCapabilities: [],
      effectiveConfig: {},
      createdAt: '2026-09-02T00:00:00.000Z',
      updatedAt: '2026-09-02T00:00:00.000Z',
    }
    const body = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(
          new TextEncoder().encode(
            `data: ${JSON.stringify({
              id: 'exec_terminal:3',
              executionId: execution.id,
              sequence: 3,
              type: 'run.completed',
              time: execution.updatedAt,
              data: { finalOutput: 'done' },
            })}\n\n`,
          ),
        )
      },
      cancel,
    })
    const client = new HarnessRuntimeClient({
      baseUrl: 'http://runtime.test',
      fetch: async (_input, init) =>
        new Headers(init?.headers).get('accept') === 'text/event-stream'
          ? new Response(body)
          : Response.json(execution),
    })
    expect((await client.waitForTerminal(execution.id)).state).toBe('succeeded')
    expect(cancel).toHaveBeenCalledTimes(1)
  })

  it('preserves the abort signal during the final execution read', async () => {
    const controller = new AbortController()
    const fetch = vi.fn(async (_input, init) => {
      if (new Headers(init?.headers).get('accept') === 'text/event-stream') return new Response('')
      expect(init?.signal).toBe(controller.signal)
      controller.abort()
      init?.signal?.throwIfAborted()
      throw new Error('Expected abort')
    })
    const client = new HarnessRuntimeClient({ baseUrl: 'http://runtime.test', fetch })
    await expect(client.waitForTerminal('exec_aborted', controller.signal)).rejects.toMatchObject({
      name: 'AbortError',
    })
  })
})

async function waitForEvent(client: HarnessRuntimeClient, executionId: string, type: string) {
  for await (const event of client.streamEvents(executionId)) {
    if (event.type === type) return event
  }
  throw new Error(`Execution ended before ${type}`)
}
