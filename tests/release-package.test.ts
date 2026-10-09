import { execFileSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { copyFile, mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'

const directories: string[] = []
afterEach(async () => {
  await Promise.all(
    directories.splice(0).map((directory) => rm(directory, { recursive: true, force: true })),
  )
})

async function fixture() {
  const directory = await mkdtemp(join(tmpdir(), 'harness-release-test-'))
  directories.push(directory)
  const repo = join(directory, 'repo')
  const output = join(directory, 'output')
  await mkdir(join(repo, 'scripts'), { recursive: true })
  await copyFile(
    new URL('../scripts/package-release.mjs', import.meta.url),
    join(repo, 'scripts/package-release.mjs'),
  )
  await writeFile(join(repo, 'package.json'), JSON.stringify({ version: '0.2.0', private: true }))
  const git = (...args: string[]) =>
    execFileSync('git', args, { cwd: repo, encoding: 'utf8', stdio: 'pipe' }).trim()
  git('init', '--quiet')
  git('add', '.')
  git(
    '-c',
    'user.name=Synthetic Test',
    '-c',
    'user.email=test@example.invalid',
    '-c',
    'commit.gpgsign=false',
    'commit',
    '--quiet',
    '-m',
    'Synthetic fixture',
  )
  const run = (destination = output) =>
    execFileSync(process.execPath, [join(repo, 'scripts/package-release.mjs'), destination], {
      cwd: repo,
      encoding: 'utf8',
      stdio: 'pipe',
    })
  return { repo, output, git, run }
}

describe('source-only release packaging', () => {
  it('binds archive and checksums to the exact clean commit without Git metadata', async () => {
    const { output, git, run } = await fixture()
    const result = JSON.parse(run())
    expect(result.commit).toBe(git('rev-parse', 'HEAD'))
    const archive = await readFile(join(output, result.archive))
    expect(result.sha256).toBe(createHash('sha256').update(archive).digest('hex'))
    const metadata = await readFile(join(output, 'release-manifest.json'))
    expect(JSON.parse(metadata.toString()).packageRegistryPublished).toBe(false)
    expect(await readFile(join(output, 'SHA256SUMS'), 'utf8')).toContain(
      `${createHash('sha256').update(metadata).digest('hex')}  release-manifest.json`,
    )
    const files = execFileSync('tar', ['-tzf', join(output, result.archive)], { encoding: 'utf8' })
      .trim()
      .split('\n')
    expect(files.every((file) => file.startsWith('harness-runtime-api-0.2.0/'))).toBe(true)
    expect(files.some((file) => file.includes('/.git/'))).toBe(false)
  })

  it('rejects uncommitted source', async () => {
    const { repo, run } = await fixture()
    await writeFile(join(repo, 'unreviewed.txt'), 'synthetic')
    expect(run).toThrow()
  })

  it('rejects output inside the source repository', async () => {
    const { repo, run } = await fixture()
    expect(() => run(join(repo, 'release'))).toThrow()
  })
})
