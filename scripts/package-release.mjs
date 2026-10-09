import { execFileSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { mkdir, readFile, realpath, writeFile } from 'node:fs/promises'
import { basename, dirname, isAbsolute, relative, resolve, sep } from 'node:path'
import { fileURLToPath } from 'node:url'

async function canonicalPath(path) {
  const suffix = []
  for (;;) {
    try {
      return resolve(await realpath(path), ...suffix.reverse())
    } catch (error) {
      if (error.code !== 'ENOENT') throw error
      suffix.push(basename(path))
      path = dirname(path)
    }
  }
}

const root = await realpath(fileURLToPath(new URL('..', import.meta.url)))
const git = (...args) => execFileSync('git', args, { cwd: root, encoding: 'utf8' }).trim()
const outputArgument = process.argv[2]
if (!outputArgument) throw new Error('Usage: node scripts/package-release.mjs <output-directory>')
const output = await canonicalPath(resolve(outputArgument))
const location = relative(root, output)
if (!isAbsolute(location) && location !== '..' && !location.startsWith(`..${sep}`)) {
  throw new Error('Release output must be outside the repository')
}
if (git('status', '--porcelain'))
  throw new Error('Release packaging requires a clean committed tree')
const commit = git('rev-parse', 'HEAD')
const manifest = JSON.parse(git('show', 'HEAD:package.json'))
if (!/^\d+\.\d+\.\d+$/.test(manifest.version))
  throw new Error('Expected a stable SemVer base version')
const name = `harness-runtime-api-${manifest.version}`
const archive = `${name}-source.tar.gz`
await mkdir(output, { recursive: true })
execFileSync(
  'git',
  ['archive', '--format=tar.gz', `--prefix=${name}/`, '-o', resolve(output, archive), commit],
  { cwd: root },
)
const sha256 = createHash('sha256')
  .update(await readFile(resolve(output, archive)))
  .digest('hex')
await writeFile(
  resolve(output, 'release-manifest.json'),
  `${JSON.stringify(
    {
      version: manifest.version,
      commit,
      format: 'source-only',
      install: 'pnpm install --frozen-lockfile',
      verification: 'pnpm check && pnpm sanitize',
      packageRegistryPublished: false,
      assets: [{ name: archive, sha256 }],
    },
    null,
    2,
  )}\n`,
)
const metadataHash = createHash('sha256')
  .update(await readFile(resolve(output, 'release-manifest.json')))
  .digest('hex')
await writeFile(
  resolve(output, 'SHA256SUMS'),
  `${sha256}  ${archive}\n${metadataHash}  release-manifest.json\n`,
)
console.log(JSON.stringify({ version: manifest.version, commit, archive, sha256 }))
