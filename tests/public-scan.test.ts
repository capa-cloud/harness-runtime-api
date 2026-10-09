import { spawnSync } from 'node:child_process'
import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

async function scanFixture(files: Record<string, string>) {
  const directory = await mkdtemp(join(tmpdir(), 'harness-public-scan-'))
  try {
    for (const [name, content] of Object.entries(files))
      await writeFile(join(directory, name), content)
    const result = spawnSync('bash', ['scripts/scan-public.sh', directory], { encoding: 'utf8' })
    return { status: result.status, output: result.stdout }
  } finally {
    await rm(directory, { recursive: true, force: true })
  }
}

describe('public-content scanner', () => {
  it('accepts public environment templates and synthetic loopback examples', async () => {
    const result = await scanFixture({
      '.env.example': 'MODEL_API_KEY=<your-token>',
      'README.md': 'Use http://127.0.0.1:4310 for the synthetic reference server.',
    })
    expect(result.status).toBe(0)
    expect(result.output).toBe('')
  })

  it('blocks dangerous files and generated credential-shaped values', async () => {
    const result = await scanFixture({
      '.env': 'SYNTHETIC_SETTING=example',
      'README.md': ['ghp_', 'x'.repeat(36)].join(''),
    })
    expect(result.status).toBe(1)
    expect(result.output).toContain('dangerous files found')
    expect(result.output).toContain('credential token prefix')
  })
})
