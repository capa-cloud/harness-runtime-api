import { readFile } from 'node:fs/promises'
import { describe, expect, it } from 'vitest'
import { parse } from 'yaml'
import { runProviderConformance } from '../packages/conformance/src/index.js'
import { MockProvider } from '../packages/provider-mock/src/index.js'

describe('conformance and published specification', () => {
  it('passes the basic provider conformance suite', async () => {
    const report = await runProviderConformance(new MockProvider())
    expect(report.passed).toBe(true)
    expect(report.checks.every((check) => check.passed)).toBe(true)
  })

  it('ships a parseable OpenAPI 3.1 document with all MVP operations', async () => {
    const source = await readFile(new URL('../spec/openapi.yaml', import.meta.url), 'utf8')
    const document = parse(source) as {
      openapi?: string
      paths?: Record<string, Record<string, unknown>>
    }

    expect(document.openapi).toBe('3.1.0')
    expect(document.paths?.['/v1/runtime']?.get).toBeDefined()
    expect(document.paths?.['/v1/conversations']?.post).toBeDefined()
    expect(document.paths?.['/v1/executions']?.post).toBeDefined()
    expect(document.paths?.['/v1/executions/{id}:cancel']?.post).toBeDefined()
    expect(document.paths?.['/v1/executions/{id}/events']?.get).toBeDefined()
    expect(document.paths?.['/v1/executions/{id}/actions/{actionId}:respond']?.post).toBeDefined()
  })
})
