import { fileURLToPath } from 'node:url'
import { describe, expect, it, vi } from 'vitest'
import { InMemoryHarnessRuntime } from '../../packages/core/src/index.js'
import { DshProvider, DSH_SDK_VERSION } from '../../packages/provider-dsh/src/index.js'
import { runProviderConformance } from '../../packages/conformance/src/index.js'

const fixture = fileURLToPath(new URL('../fixtures/dsh-peer.mjs', import.meta.url))

function runtimeFor(mode: string) {
  return new InMemoryHarnessRuntime([providerFor(mode)])
}

function providerFor(mode: string) {
  return new DshProvider({
    launch: {
      command: process.execPath,
      args: [fixture],
      env: { FIXTURE_MODE: mode },
      requestTimeoutMs: 1_000,
      shutdownTimeoutMs: 100,
      disposeEofGraceMs: 200,
      disposeGraceMs: 200,
    },
  })
}

function start(runtime: InMemoryHarnessRuntime) {
  return runtime.startExecution({
    conversationId: runtime.createConversation().id,
    providerId: 'dsh',
    input: 'synthetic prompt',
  })
}

async function drain(runtime: InMemoryHarnessRuntime, id: string) {
  for await (const _event of runtime.subscribeEvents(id)) {
    // Await the portable terminal outcome.
  }
}

describe('Pinned public DSH SDK with a real synthetic subprocess', () => {
  it('maps native wire notifications and reaps the child after success', async () => {
    vi.stubEnv('HARNESS_PARENT_SENTINEL', 'synthetic-parent-value')
    try {
      const runtime = runtimeFor('success')
      const execution = start(runtime)
      await drain(runtime, execution.id)
      expect(runtime.getExecution(execution.id)).toMatchObject({
        state: 'succeeded',
        finalOutput: 'fixture-result',
      })
      const events = runtime.listEvents(execution.id).events
      expect(events).toContainEqual(
        expect.objectContaining({ type: 'output.text.delta', data: { text: 'fixture-result' } }),
      )
      const status = events.find(
        (event) =>
          event.type === 'provider.event' &&
          (event.data.params as { status?: string }).status === 'running',
      )
      expect(status?.data.params).toMatchObject({ inheritedParent: false })
      if (!status) throw new Error('Missing synthetic child status')
      const pid = (status.data.params as { fixturePid: number }).fixturePid
      expect(pid).toBeGreaterThan(0)
      expect(() => process.kill(pid, 0)).toThrowError(expect.objectContaining({ code: 'ESRCH' }))
      expect(providerFor('success').manifest.metadata?.sdkCompatibility).toBe(DSH_SDK_VERSION)
    } finally {
      vi.unstubAllEnvs()
    }
  })

  it('cancels a live subprocess and emits exactly one terminal event', async () => {
    const runtime = runtimeFor('hang')
    const execution = start(runtime)
    let pid: number | undefined
    try {
      for await (const event of runtime.subscribeEvents(execution.id)) {
        if (event.type !== 'provider.event') continue
        const params = event.data.params as { fixturePid?: number }
        if (params.fixturePid) {
          pid = params.fixturePid
          break
        }
      }
      expect(pid).toBeTypeOf('number')
      await runtime.cancelExecution(execution.id)
      expect(runtime.getExecution(execution.id).state).toBe('cancelled')
      expect(
        runtime.listEvents(execution.id).events.filter((event) => event.type === 'run.cancelled'),
      ).toHaveLength(1)
      if (pid === undefined) throw new Error('Missing synthetic child PID')
      const exitedPid = pid
      expect(() => process.kill(exitedPid, 0)).toThrowError(
        expect.objectContaining({ code: 'ESRCH' }),
      )
    } finally {
      await runtime.cancelExecution(execution.id)
    }
  })

  it.each(['bad-handshake', 'crash'])('reports %s as a failed execution', async (mode) => {
    const runtime = runtimeFor(mode)
    const execution = start(runtime)
    await drain(runtime, execution.id)
    expect(runtime.getExecution(execution.id).state).toBe('failed')
    expect(runtime.listEvents(execution.id).events.at(-1)?.type).toBe('run.failed')
  })

  it('passes the reusable conformance probe through the actual SDK', async () => {
    const report = await runProviderConformance(providerFor('success'), { timeoutMs: 5_000 })
    expect(report.passed).toBe(true)
  })
})
