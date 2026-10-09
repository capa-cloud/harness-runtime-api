import { describe, expect, it } from 'vitest'
import { InMemoryHarnessRuntime } from '../packages/core/src/index.js'
import { AcpProvider } from '../packages/provider-acp/src/index.js'

describe('ACP provider configuration and preflight', () => {
  it('rejects invalid limits and missing commands', () => {
    expect(() => new AcpProvider({ command: '' })).toThrow('ACP command is required')
    for (const limit of [0, -1, Number.POSITIVE_INFINITY, 1.5]) {
      expect(
        () => new AcpProvider({ command: 'synthetic-agent', shutdownGraceMs: limit }),
      ).toThrow()
    }
  })

  it('rejects unsupported continuity before any subprocess is scheduled', () => {
    const provider = new AcpProvider({ command: 'must-not-launch' })
    const runtime = new InMemoryHarnessRuntime([provider])
    expect(() =>
      runtime.startExecution({
        conversationId: runtime.createConversation().id,
        providerId: 'acp',
        input: 'synthetic preflight',
        requiredCapabilities: ['conversation.continuity'],
      }),
    ).toThrowError(expect.objectContaining({ code: 'CAPABILITY_UNSUPPORTED' }))
    expect(provider.manifest.capabilities['execution.cancel']).toBe('emulated')
    expect(provider.manifest.capabilities['extension.sandbox']).toBe('unsupported')
  })

  it('rejects untrusted execution config before spawning a process', async () => {
    const runtime = new InMemoryHarnessRuntime([new AcpProvider({ command: 'must-not-launch' })])
    const execution = runtime.startExecution({
      conversationId: runtime.createConversation().id,
      providerId: 'acp',
      input: 'synthetic request',
      config: { command: 'untrusted-command' },
    })
    for await (const _event of runtime.subscribeEvents(execution.id)) {
    }
    expect(runtime.getExecution(execution.id)).toMatchObject({
      state: 'failed',
      error: {
        message: 'ACP execution config must be empty; configure the trusted provider constructor',
      },
    })
  })
})
