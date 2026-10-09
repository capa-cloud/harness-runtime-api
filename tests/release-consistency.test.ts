import { execFileSync } from 'node:child_process'
import { readFile } from 'node:fs/promises'
import { describe, expect, it } from 'vitest'
import { parse } from 'yaml'
import { InMemoryHarnessRuntime } from '../packages/core/src/index.js'
import { MockProvider } from '../packages/provider-mock/src/index.js'
import { DshProvider } from '../packages/provider-dsh/src/index.js'
import { AcpProvider } from '../packages/provider-acp/src/index.js'

const root = new URL('..', import.meta.url)
const read = (path: string) => readFile(new URL(path, root), 'utf8')

describe('release metadata and exact diagrams', () => {
  it('keeps workspace, runtime, provider, and OpenAPI versions aligned', async () => {
    const { version } = JSON.parse(await read('package.json'))
    for (const name of [
      'protocol',
      'core',
      'provider-mock',
      'provider-dsh',
      'provider-acp',
      'conformance',
      'server',
      'sdk-typescript',
    ]) {
      expect(JSON.parse(await read(`packages/${name}/package.json`)).version).toBe(version)
    }
    expect(new InMemoryHarnessRuntime().describe().version).toBe(version)
    expect(new MockProvider().manifest.version).toBe(version)
    expect(new DshProvider({ launch: { command: 'synthetic-agent' } }).manifest.version).toBe(
      version,
    )
    expect(new AcpProvider({ command: 'synthetic-agent' }).manifest.version).toBe(version)
    expect(parse(await read('spec/openapi.yaml')).info.version).toBe(version)
  })

  it('keeps both lifecycle diagrams synchronized with the deterministic generator', () => {
    expect(() =>
      execFileSync(
        process.execPath,
        [new URL('scripts/generate-lifecycle.mjs', root).pathname, '--check'],
        { stdio: 'pipe' },
      ),
    ).not.toThrow()
  })

  it.each(['en', 'zh'])(
    'shows failure during both human waits in the %s diagram',
    async (language) => {
      const diagram = await read(`assets/execution-lifecycle-${language}.svg`)
      expect(diagram.match(/data-state=/g)).toHaveLength(9)
      expect(diagram.match(/data-from=/g)).toHaveLength(12)
      for (const state of ['running', 'awaiting_input', 'awaiting_approval']) {
        expect(diagram).toContain(`data-from="${state}" data-to="failed"`)
      }
    },
  )
})
