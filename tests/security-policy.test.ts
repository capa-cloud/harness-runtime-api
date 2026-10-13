import { readFile } from 'node:fs/promises'
import { describe, expect, it } from 'vitest'
import { parse } from 'yaml'

const read = (path: string) => readFile(new URL(`../${path}`, import.meta.url), 'utf8')

describe('dependency security policy', () => {
  it('audits development and production dependencies through the existing CI check command', async () => {
    const manifest = JSON.parse(await read('package.json'))
    expect(manifest.scripts['security:audit']).toBe('pnpm audit --audit-level moderate')
    expect(manifest.scripts.check).toMatch(/&& pnpm security:audit$/)
    const workflow = parse(await read('.github/workflows/ci.yml'))
    expect(
      workflow.jobs.check.steps.some((step: { run?: string }) => step.run === 'pnpm check'),
    ).toBe(true)
  })

  it('locks the patched source-map dependency without retaining the vulnerable version', async () => {
    const workspace = parse(await read('pnpm-workspace.yaml'))
    const lockfile = parse(await read('pnpm-lock.yaml'))
    expect(workspace.overrides['source-map-js']).toBe('1.2.2')
    expect(lockfile.overrides['source-map-js']).toBe('1.2.2')
    expect(
      Object.keys(lockfile.packages).filter((name) => name.startsWith('source-map-js@')),
    ).toEqual(['source-map-js@1.2.2'])
    expect(
      Object.keys(lockfile.snapshots).filter((name) => name.startsWith('source-map-js@')),
    ).toEqual(['source-map-js@1.2.2'])
  })
})
