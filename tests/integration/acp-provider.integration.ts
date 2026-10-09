import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it, vi } from 'vitest'
import { InMemoryHarnessRuntime } from '../../packages/core/src/index.js'
import { runProviderConformance } from '../../packages/conformance/src/index.js'
import { AcpProvider } from '../../packages/provider-acp/src/index.js'
import type { ActionResponse } from '../../packages/protocol/src/index.js'

const fixture = fileURLToPath(new URL('../fixtures/acp-agent.mjs', import.meta.url))

interface Trace {
  pid: number
  inheritedParent: boolean
  clientFilesystem: boolean
  clientTerminal: boolean
  cwdAbsolute: boolean
  cancellationNotified: boolean
  permissions: Array<{ outcome: string; optionId?: string }>
  forbiddenErrors: number[]
  exited: boolean
  parseErrors: number
}

async function setup(mode: string, maxMessageBytes?: number, maxPendingPermissions?: number) {
  const directory = await mkdtemp(join(tmpdir(), 'harness-acp-'))
  const tracePath = join(directory, 'trace.json')
  const deniedTarget = join(directory, 'protected.txt')
  await writeFile(deniedTarget, 'synthetic protected text')
  const provider = new AcpProvider({
    command: process.execPath,
    args: [fixture],
    env: { FIXTURE_MODE: mode, FIXTURE_TRACE_PATH: tracePath, FIXTURE_DENIED_TARGET: deniedTarget },
    initializationTimeoutMs: 5_000,
    runTimeoutMs: 10_000,
    shutdownGraceMs: 100,
    ...(maxMessageBytes === undefined ? {} : { maxMessageBytes }),
    ...(maxPendingPermissions === undefined ? {} : { maxPendingPermissions }),
  })
  const runtime = new InMemoryHarnessRuntime([provider])
  const execution = runtime.startExecution({
    conversationId: runtime.createConversation().id,
    providerId: 'acp',
    input: 'synthetic ACP prompt',
  })
  return {
    provider,
    runtime,
    execution,
    trace: async () => JSON.parse(await readFile(tracePath, 'utf8')) as Trace,
    protectedText: () => readFile(deniedTarget, 'utf8'),
    cleanup: async () => {
      await runtime.cancelExecution(execution.id)
      await rm(directory, { recursive: true, force: true })
    },
  }
}

async function drain(runtime: InMemoryHarnessRuntime, id: string, response?: ActionResponse) {
  const events = []
  for await (const event of runtime.subscribeEvents(id)) {
    events.push(event)
    if (event.type === 'action.required' && response !== undefined) {
      runtime.respondAction(id, String(event.data.id), response)
    }
  }
  return events
}

function assertExited(trace: Trace) {
  expect(trace.pid).toBeGreaterThan(0)
  expect(() => process.kill(trace.pid, 0)).toThrowError(expect.objectContaining({ code: 'ESRCH' }))
}

describe('ACP v1 adapter through the official SDK and owned subprocess', () => {
  it('bounds pending permissions instead of allowing an unbounded approval queue', async () => {
    const task = await setup('permission-parallel', undefined, 1)
    try {
      await drain(task.runtime, task.execution.id)
      expect(task.runtime.getExecution(task.execution.id).state).toBe('failed')
      assertExited(await task.trace())
    } finally {
      await task.cleanup()
    }
  })
  it('normalizes streamed text, disables client capabilities, and isolates environment', async () => {
    vi.stubEnv('HARNESS_PARENT_SENTINEL', 'synthetic-parent-value')
    const task = await setup('success')
    try {
      const events = await drain(task.runtime, task.execution.id)
      expect(task.runtime.getExecution(task.execution.id)).toMatchObject({
        state: 'succeeded',
        finalOutput: 'ACP fixture',
      })
      expect(
        events
          .filter((event) => event.type === 'output.text.delta')
          .map((event) => event.data.text),
      ).toEqual(['', 'ACP ', 'fixture'])
      const trace = await task.trace()
      expect(trace).toMatchObject({
        inheritedParent: false,
        clientFilesystem: false,
        clientTerminal: false,
        cwdAbsolute: true,
      })
      assertExited(trace)
    } finally {
      vi.unstubAllEnvs()
      await task.cleanup()
    }
  })

  it.each<{ response: ActionResponse; outcome: string; optionId?: string; state: string }>([
    {
      response: { approved: true },
      outcome: 'selected',
      optionId: 'allow-once',
      state: 'succeeded',
    },
    {
      response: { approved: false },
      outcome: 'selected',
      optionId: 'reject-once',
      state: 'succeeded',
    },
    {
      response: { approved: true, value: { optionId: 'allow-always' } },
      outcome: 'selected',
      optionId: 'allow-always',
      state: 'succeeded',
    },
    {
      response: { approved: false, value: { optionId: 'allow-once' } },
      outcome: 'cancelled',
      state: 'failed',
    },
    {
      response: { approved: true, value: { optionId: 'unknown' } },
      outcome: 'cancelled',
      state: 'failed',
    },
    {
      response: { approved: true, value: { malformed: true } },
      outcome: 'cancelled',
      state: 'failed',
    },
  ])(
    'maps explicit permission response $response to $outcome',
    async ({ response, outcome, optionId, state }) => {
      const task = await setup('permission')
      try {
        const events = await drain(task.runtime, task.execution.id, response)
        expect(events.filter((event) => event.type === 'action.required')).toHaveLength(1)
        expect(task.runtime.getExecution(task.execution.id).state).toBe(state)
        expect((await task.trace()).permissions).toEqual([
          { outcome, ...(optionId === undefined ? {} : { optionId }) },
        ])
        assertExited(await task.trace())
      } finally {
        await task.cleanup()
      }
    },
  )

  it('does not convert approve-once into an always grant', async () => {
    const task = await setup('permission-always')
    try {
      await drain(task.runtime, task.execution.id, { approved: true })
      expect((await task.trace()).permissions).toEqual([{ outcome: 'cancelled' }])
      expect(task.runtime.getExecution(task.execution.id).state).toBe('failed')
    } finally {
      await task.cleanup()
    }
  })

  it('serializes concurrent native permission requests into correlated Actions', async () => {
    const task = await setup('permission-parallel')
    try {
      const events = await drain(task.runtime, task.execution.id, { approved: true })
      expect(task.runtime.getExecution(task.execution.id).state).toBe('succeeded')
      expect(events.filter((event) => event.type === 'action.required')).toHaveLength(2)
      expect(events.filter((event) => event.type === 'action.responded')).toHaveLength(2)
      expect((await task.trace()).permissions).toHaveLength(2)
    } finally {
      await task.cleanup()
    }
  })

  it.each(['hang', 'stubborn', 'permission'])(
    'cancels %s, reaps the process, and emits one terminal event',
    async (mode) => {
      const task = await setup(mode)
      try {
        for await (const event of task.runtime.subscribeEvents(task.execution.id)) {
          if (event.type === (mode === 'permission' ? 'action.required' : 'output.text.delta'))
            break
        }
        await task.runtime.cancelExecution(task.execution.id)
        const events = task.runtime.listEvents(task.execution.id).events
        expect(task.runtime.getExecution(task.execution.id).state).toBe('cancelled')
        expect(events.filter((event) => event.type === 'run.cancelled')).toHaveLength(1)
        expect(events.at(-1)?.data.providerCleanupError).toBeUndefined()
        const trace = await task.trace()
        expect(trace.cancellationNotified).toBe(true)
        if (mode === 'permission') expect(trace.permissions).toEqual([{ outcome: 'cancelled' }])
        assertExited(trace)
      } finally {
        await task.cleanup()
      }
    },
  )

  it.each(['bad-version', 'crash', 'foreign-session', 'oversized', 'bad-envelope', 'bad-params'])(
    'fails %s without leaking diagnostics',
    async (mode) => {
      const diagnostics = vi.spyOn(console, 'error')
      const task = await setup(mode, mode === 'oversized' ? 1_024 : undefined)
      try {
        await drain(task.runtime, task.execution.id)
        expect(task.runtime.getExecution(task.execution.id)).toMatchObject({
          state: 'failed',
          error: { code: 'PROVIDER_ERROR', message: 'ACP agent request failed' },
        })
        expect(
          task.runtime
            .listEvents(task.execution.id)
            .events.some((event) => event.data.text === 'foreign data'),
        ).toBe(false)
        assertExited(await task.trace())
        expect(diagnostics).not.toHaveBeenCalled()
      } finally {
        diagnostics.mockRestore()
        await task.cleanup()
      }
    },
  )

  it('uses the SDK parse-error recovery without logging malformed raw input', async () => {
    const diagnostics = vi.spyOn(console, 'error')
    const task = await setup('bad-json')
    try {
      await drain(task.runtime, task.execution.id)
      expect(task.runtime.getExecution(task.execution.id).state).toBe('succeeded')
      expect((await task.trace()).parseErrors).toBe(1)
      expect(diagnostics).not.toHaveBeenCalled()
      assertExited(await task.trace())
    } finally {
      diagnostics.mockRestore()
      await task.cleanup()
    }
  })

  it('denies unadvertised filesystem and terminal requests without modifying files', async () => {
    const task = await setup('forbidden-client')
    try {
      await drain(task.runtime, task.execution.id)
      expect(task.runtime.getExecution(task.execution.id).state).toBe('succeeded')
      expect((await task.trace()).forbiddenErrors).toEqual([-32601, -32601, -32601])
      expect(await task.protectedText()).toBe('synthetic protected text')
    } finally {
      await task.cleanup()
    }
  })

  it('passes capability conformance through the actual ACP transport', async () => {
    const task = await setup('permission')
    try {
      await drain(task.runtime, task.execution.id, { approved: true })
      const report = await runProviderConformance(task.provider, {
        requiredCapabilities: ['action.approval'],
        actionResponse: { approved: true },
        timeoutMs: 15_000,
      })
      expect(report.passed, JSON.stringify(report)).toBe(true)
    } finally {
      await task.cleanup()
    }
  })
})
