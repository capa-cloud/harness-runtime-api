import { DshProvider, DSH_SDK_VERSION } from '../packages/provider-dsh/dist/index.js'
import { runProviderConformance } from '../packages/conformance/dist/index.js'

function strings(value, pattern) {
  const parsed = JSON.parse(value ?? '[]')
  if (
    !Array.isArray(parsed) ||
    !parsed.every(
      (item) => typeof item === 'string' && (pattern === undefined || pattern.test(item)),
    )
  )
    throw new Error('Invalid probe options')
  return parsed
}

try {
  const command = process.env.DSH_COMMAND
  if (!command) throw new Error('DSH_COMMAND is required')
  const args = strings(process.env.DSH_ARGS_JSON)
  const names = strings(process.env.DSH_ENV_KEYS_JSON, /^[A-Za-z_][A-Za-z0-9_]*$/)
  const env = Object.fromEntries(
    names
      .filter((name) => process.env[name] !== undefined)
      .map((name) => [name, process.env[name]]),
  )
  const timeoutMs = Number(process.env.DSH_PROBE_TIMEOUT_MS ?? 30_000)
  if (!Number.isSafeInteger(timeoutMs) || timeoutMs < 1 || timeoutMs > 120_000) {
    throw new Error('Invalid probe timeout')
  }
  const provider = new DshProvider({
    launch: {
      command,
      args,
      env,
      requestTimeoutMs: timeoutMs,
      shutdownTimeoutMs: 500,
      disposeEofGraceMs: 500,
      disposeGraceMs: 500,
    },
    ...(process.env.DSH_WORKSPACE === undefined ? {} : { workspace: process.env.DSH_WORKSPACE }),
    ...(process.env.DSH_MODEL === undefined ? {} : { model: process.env.DSH_MODEL }),
    ...(process.env.DSH_MODEL_PROVIDER === undefined
      ? {}
      : { modelProvider: process.env.DSH_MODEL_PROVIDER }),
  })
  const report = await runProviderConformance(provider, {
    input: 'Reply with harness-runtime-ready. Do not run tools.',
    timeoutMs,
    cleanupTimeoutMs: 2_500,
  })
  console.log(
    JSON.stringify({
      sdk: DSH_SDK_VERSION,
      passed: report.passed,
      checks: report.checks.map(({ name, passed }) => ({ name, passed })),
    }),
  )
  if (!report.passed) process.exitCode = 1
} catch {
  console.error('DSH probe failed. Check trusted launch options and runtime diagnostics privately.')
  process.exitCode = 1
}
