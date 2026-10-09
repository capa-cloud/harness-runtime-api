import { spawn, type ChildProcess } from 'node:child_process'
import { once } from 'node:events'
import { createInterface } from 'node:readline'
import { fileURLToPath } from 'node:url'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import {
  HarnessRuntimeClient,
  HarnessRuntimeStreamInterruptedError,
} from '../../packages/sdk-typescript/src/index.js'

let server: ChildProcess
let client: HarnessRuntimeClient
let baseUrl: string

async function stopServer() {
  if (!server || server.exitCode !== null || server.signalCode !== null) return
  const exited = once(server, 'exit')
  server.kill('SIGTERM')
  const escalation = setTimeout(() => server.kill('SIGKILL'), 1_000)
  try {
    await exited
  } finally {
    clearTimeout(escalation)
  }
}

beforeAll(async () => {
  server = spawn(
    process.execPath,
    [fileURLToPath(new URL('../../packages/server/dist/cli.js', import.meta.url))],
    {
      env: { HOST: '127.0.0.1', PORT: '0' },
      stdio: ['ignore', 'pipe', 'ignore'],
    },
  )
  if (!server.stdout) {
    await stopServer()
    throw new Error('Reference server did not expose readiness output')
  }
  const lines = createInterface({ input: server.stdout })
  try {
    baseUrl = await new Promise<string>((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error('Reference server startup timed out')), 3_000)
      const cleanup = () => {
        clearTimeout(timer)
        server.removeListener('exit', failed)
        server.removeListener('error', failed)
      }
      const failed = () => {
        cleanup()
        reject(new Error('Reference server failed before readiness'))
      }
      server.once('exit', failed)
      server.once('error', failed)
      lines.on('line', (line) => {
        const address = line.match(
          /^Harness Runtime API listening on (http:\/\/127\.0\.0\.1:\d+)$/,
        )?.[1]
        if (address) {
          cleanup()
          resolve(address)
        }
      })
    })
    client = new HarnessRuntimeClient({ baseUrl })
  } catch (error) {
    await stopServer()
    throw error
  } finally {
    lines.close()
  }
})

afterAll(stopServer)

describe('Built reference server over real loopback HTTP', () => {
  it.each(['-1', '1.5', 'not-a-number', String(Number.MAX_SAFE_INTEGER + 1)])(
    'rejects invalid cursor %s before opening an SSE stream',
    async (cursor) => {
      const response = await fetch(
        `${baseUrl}/v1/executions/missing/events?after=${encodeURIComponent(cursor)}`,
        {
          headers: { accept: 'text/event-stream' },
        },
      )
      expect(response.status).toBe(400)
      expect(await response.json()).toMatchObject({ code: 'VALIDATION_ERROR' })
    },
  )

  it('rejects an invalid action response without resolving approval, then rejects duplicate responses', async () => {
    const execution = await client.startExecution({
      conversationId: (await client.createConversation()).id,
      providerId: 'mock',
      input: 'synthetic invalid response',
      config: { requireApproval: true },
    })
    try {
      let actionId: string | undefined
      for await (const event of client.streamEvents(execution.id, {
        signal: AbortSignal.timeout(5_000),
      })) {
        if (event.type === 'action.required') {
          actionId = String(event.data.id)
          break
        }
      }
      if (!actionId) throw new Error('Expected a synthetic approval')
      const invalid = await fetch(
        `${baseUrl}/v1/executions/${execution.id}/actions/${actionId}:respond`,
        {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ approved: 'yes' }),
        },
      )
      expect(invalid.status).toBe(400)
      expect((await client.getExecution(execution.id)).state).toBe('awaiting_approval')
      await client.respondAction(execution.id, actionId, { approved: true })
      expect((await client.waitForTerminal(execution.id)).state).toBe('succeeded')
      await expect(
        client.respondAction(execution.id, actionId, { approved: true }),
      ).rejects.toMatchObject({ status: 409, problem: { code: 'ACTION_ALREADY_RESOLVED' } })
    } finally {
      await client.cancelExecution(execution.id)
    }
  })

  it('supports idempotency, approval, Artifact listing, and replay on the network', async () => {
    expect((await client.describeRuntime()).providers[0]?.id).toBe('mock')
    const request = {
      conversationId: (await client.createConversation()).id,
      providerId: 'mock',
      input: 'synthetic HTTP integration',
      idempotencyKey: 'network-test',
      config: { requireApproval: true, artifactName: 'synthetic.txt' },
    }
    const execution = await client.startExecution(request)
    try {
      expect((await client.startExecution(request)).id).toBe(execution.id)
      await expect(
        client.startExecution({ ...request, input: 'conflicting input' }),
      ).rejects.toMatchObject({ status: 409, problem: { code: 'IDEMPOTENCY_CONFLICT' } })
      const events = []
      for await (const event of client.streamEvents(execution.id, {
        signal: AbortSignal.timeout(5_000),
      })) {
        events.push(event)
        if (event.type === 'action.required') {
          await client.respondAction(execution.id, String(event.data.id), { approved: true })
        }
      }
      expect((await client.waitForTerminal(execution.id)).state).toBe('succeeded')
      expect(events.at(-1)?.type).toBe('run.completed')
      expect((await client.listArtifacts(execution.id)).artifacts).toHaveLength(1)
      expect((await client.listEvents(execution.id, events.length - 1)).events).toEqual([
        events.at(-1),
      ])
    } finally {
      await client.cancelExecution(execution.id)
    }
  })

  it('rejects malformed input and unsupported capabilities on the network', async () => {
    const response = await fetch(`${baseUrl}/v1/executions`, { method: 'POST', body: '{' })
    expect(response.status).toBe(400)
    expect(await response.json()).toMatchObject({ code: 'VALIDATION_ERROR' })
    await expect(
      client.startExecution({
        conversationId: (await client.createConversation()).id,
        providerId: 'mock',
        input: 'synthetic unsupported capability',
        requiredCapabilities: ['extension.sandbox'],
      }),
    ).rejects.toMatchObject({ status: 422, problem: { code: 'CAPABILITY_UNSUPPORTED' } })
  })

  it('rejects truncated SSE without cancelling the underlying approval', async () => {
    const execution = await client.startExecution({
      conversationId: (await client.createConversation()).id,
      providerId: 'mock',
      input: 'synthetic disconnect',
      config: { requireApproval: true },
    })
    const interrupted = new HarnessRuntimeClient({
      baseUrl,
      fetch: async (url, init) => {
        const response = await fetch(url, init)
        if (new Headers(init?.headers).get('accept') !== 'text/event-stream') return response
        if (!response.body) throw new Error('Expected an SSE response body')
        const reader = response.body.getReader()
        const chunk = await reader.read()
        await reader.cancel()
        reader.releaseLock()
        return new Response(
          new ReadableStream({
            start(controller) {
              if (chunk.value) controller.enqueue(chunk.value)
              controller.close()
            },
          }),
          { headers: { 'content-type': 'text/event-stream' } },
        )
      },
    })
    try {
      await expect(
        interrupted.waitForTerminal(execution.id, AbortSignal.timeout(5_000)),
      ).rejects.toBeInstanceOf(HarnessRuntimeStreamInterruptedError)
      expect((await client.getExecution(execution.id)).state).toBe('awaiting_approval')
      expect((await client.cancelExecution(execution.id)).state).toBe('cancelled')
    } finally {
      await client.cancelExecution(execution.id)
    }
  })
})
