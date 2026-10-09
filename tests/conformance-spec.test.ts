import { readFile } from 'node:fs/promises'
import { describe, expect, it, vi } from 'vitest'
import type { HarnessProvider, ProviderRunContext } from '../packages/core/src/index.js'
import { parse } from 'yaml'
import {
  runProviderConformance,
  type ConformanceOptions,
} from '../packages/conformance/src/index.js'
import { PROTOCOL_VERSION } from '../packages/protocol/src/index.js'
import { MockProvider } from '../packages/provider-mock/src/index.js'

describe('conformance and published specification', () => {
  it('passes the basic provider conformance suite', async () => {
    const report = await runProviderConformance(new MockProvider())
    expect(report.passed).toBe(true)
    expect(report.checks.every((check) => check.passed)).toBe(true)
  })

  it('fails an approval scenario when the provider never requests an action', async () => {
    const provider: HarnessProvider = {
      manifest: new MockProvider().manifest,
      run: async () => ({ finalOutput: 'synthetic no-action result' }),
    }
    const report = await runProviderConformance(provider, {
      requiredCapabilities: ['action.approval'],
      actionResponse: { approved: true },
    })
    expect(report.passed).toBe(false)
    expect(report.checks).toContainEqual({ name: 'action-response-correlation', passed: false })
  })

  it.each<ConformanceOptions & { name: string }>([
    {
      name: 'approval',
      config: { requireApproval: true },
      requiredCapabilities: ['action.approval'],
      actionResponse: { approved: true },
    },
    {
      name: 'input',
      config: { requestInput: true },
      requiredCapabilities: ['action.input'],
      actionResponse: { value: 'synthetic response' },
    },
    {
      name: 'artifacts',
      config: { artifactName: 'synthetic.txt' },
      requiredCapabilities: ['artifact.list'],
      expectedArtifacts: 1,
    },
    {
      name: 'denial',
      config: { requireApproval: true },
      requiredCapabilities: ['action.approval'],
      actionResponse: { approved: false },
      expectedState: 'failed' as const,
    },
    {
      name: 'cancellation',
      config: { delayMs: 100 },
      requiredCapabilities: ['execution.cancel'],
      cancelAfterEvent: 'run.started' as const,
      expectedState: 'cancelled' as const,
    },
  ])('passes the $name capability scenario', async ({ name: _name, ...options }) => {
    const report = await runProviderConformance(new MockProvider(), options)
    expect(report.passed).toBe(true)
  })

  it('aborts the subscription and cancels provider work after a probe timeout', async () => {
    let context: ProviderRunContext | undefined
    const cancel = vi.fn(async () => undefined)
    const provider: HarnessProvider = {
      manifest: new MockProvider().manifest,
      run: (input) => {
        context = input
        return new Promise((_, reject) => {
          input.signal.addEventListener('abort', () => reject(new Error('aborted')), { once: true })
        })
      },
      cancel,
    }
    const report = await runProviderConformance(provider, { timeoutMs: 20 })
    expect(report.passed).toBe(false)
    expect(report.checks).toContainEqual({
      name: 'execution-probe',
      passed: false,
      detail: 'Conformance probe timed out',
    })
    expect(context?.signal.aborted).toBe(true)
    expect(cancel).toHaveBeenCalledTimes(1)
    expect(report.checks).toContainEqual({ name: 'execution-cleanup', passed: true })
  })

  it('reports provider cleanup failures alongside the probe timeout', async () => {
    const provider: HarnessProvider = {
      manifest: new MockProvider().manifest,
      run: (context) =>
        new Promise((_, reject) => {
          context.signal.addEventListener('abort', () => reject(new Error('aborted')), {
            once: true,
          })
        }),
      cancel: async () => {
        throw new Error('cleanup rejected')
      },
    }
    const report = await runProviderConformance(provider, { timeoutMs: 20 })
    expect(report.passed).toBe(false)
    expect(report.checks).toContainEqual({
      name: 'execution-cleanup',
      passed: false,
      detail: 'cleanup rejected',
    })
  })

  it('bounds cleanup when a provider cancel hook does not settle', async () => {
    let releaseCleanup: (() => void) | undefined
    const provider: HarnessProvider = {
      manifest: new MockProvider().manifest,
      run: (context) =>
        new Promise((_, reject) => {
          context.signal.addEventListener('abort', () => reject(new Error('aborted')), {
            once: true,
          })
        }),
      cancel: () =>
        new Promise((resolve) => {
          releaseCleanup = resolve
        }),
    }
    try {
      const report = await runProviderConformance(provider, { timeoutMs: 20, cleanupTimeoutMs: 20 })
      expect(report.passed).toBe(false)
      expect(report.checks).toContainEqual({
        name: 'execution-cleanup',
        passed: false,
        detail: 'Conformance cleanup timed out',
      })
    } finally {
      releaseCleanup?.()
      await new Promise((resolve) => setImmediate(resolve))
    }
  })

  it('ships a parseable OpenAPI 3.1 document with all MVP operations', async () => {
    const source = await readFile(new URL('../spec/openapi.yaml', import.meta.url), 'utf8')
    const document = parse(source) as {
      openapi?: string
      paths?: Record<string, Record<string, unknown>>
      components?: {
        schemas?: {
          RuntimeDescription?: {
            properties?: { protocolVersion?: { const?: string } }
          }
        }
      }
    }

    expect(document.openapi).toBe('3.1.0')
    expect(document.paths?.['/v1/runtime']?.get).toBeDefined()
    expect(document.paths?.['/v1/conversations']?.post).toBeDefined()
    expect(document.paths?.['/v1/executions']?.post).toBeDefined()
    expect(document.paths?.['/v1/executions/{id}/artifacts']?.get).toBeDefined()
    expect(document.paths?.['/v1/executions/{id}:cancel']?.post).toBeDefined()
    expect(document.paths?.['/v1/executions/{id}/events']?.get).toBeDefined()
    expect(document.paths?.['/v1/executions/{id}/actions/{actionId}:respond']?.post).toBeDefined()
    expect(
      document.components?.schemas?.RuntimeDescription?.properties?.protocolVersion?.const,
    ).toBe(PROTOCOL_VERSION)
  })
})
