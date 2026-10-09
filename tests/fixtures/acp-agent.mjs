import { writeFileSync } from 'node:fs'
import { isAbsolute } from 'node:path'
import { Readable, Writable } from 'node:stream'
import { createInterface } from 'node:readline'
import * as acp from '@agentclientprotocol/sdk'

const mode = process.env.FIXTURE_MODE ?? 'success'
const state = {
  pid: process.pid,
  inheritedParent: process.env.HARNESS_PARENT_SENTINEL !== undefined,
  clientFilesystem: false,
  clientTerminal: false,
  cwdAbsolute: false,
  cancellationNotified: false,
  permissions: [],
  forbiddenErrors: [],
  exited: false,
  parseErrors: 0,
}
const record = () => {
  if (process.env.FIXTURE_TRACE_PATH)
    writeFileSync(process.env.FIXTURE_TRACE_PATH, JSON.stringify(state))
}
record()
const inputObserver = createInterface({ input: process.stdin })
inputObserver.on('line', (line) => {
  try {
    if (JSON.parse(line).error?.code === -32700) {
      state.parseErrors += 1
      record()
    }
  } catch {
    /* Observe only protocol parse-error replies, not prompt contents. */
  }
})
process.on('exit', () => {
  state.exited = true
  record()
})
if (mode === 'stubborn') {
  process.on('SIGTERM', () => undefined)
  setInterval(() => undefined, 100)
}
let pendingPrompt
const app = acp
  .agent({ name: 'synthetic-agent' })
  .onRequest(acp.methods.agent.initialize, ({ params }) => {
    state.clientFilesystem = Boolean(
      params.clientCapabilities?.fs?.readTextFile || params.clientCapabilities?.fs?.writeTextFile,
    )
    state.clientTerminal = params.clientCapabilities?.terminal === true
    record()
    return {
      protocolVersion: mode === 'bad-version' ? 999 : acp.PROTOCOL_VERSION,
      agentCapabilities: {},
      authMethods: [],
    }
  })
  .onRequest(acp.methods.agent.session.new, ({ params }) => {
    state.cwdAbsolute = isAbsolute(params.cwd)
    record()
    return { sessionId: 'fixture-session' }
  })
  .onNotification(acp.methods.agent.session.cancel, () => {
    state.cancellationNotified = true
    record()
    if (mode !== 'stubborn') pendingPrompt?.({ stopReason: 'cancelled' })
  })
  .onRequest(acp.methods.agent.session.prompt, async ({ client, params }) => {
    const update = (text, sessionId = params.sessionId) =>
      client.notify(acp.methods.client.session.update, {
        sessionId,
        update: { sessionUpdate: 'agent_message_chunk', content: { type: 'text', text } },
      })
    await update('')
    if (mode === 'bad-envelope')
      process.stdout.write(`${JSON.stringify({ invalid: 'synthetic-boundary-canary' })}\n`)
    if (mode === 'bad-json') process.stdout.write('{synthetic-boundary-canary\n')
    if (mode === 'bad-params') {
      await client.notify(acp.methods.client.session.update, {
        sessionId: params.sessionId,
        update: {
          sessionUpdate: 'agent_message_chunk',
          content: { type: 'text', text: { canary: 'synthetic-boundary-canary' } },
        },
      })
    }
    if (mode === 'hang' || mode === 'stubborn') {
      return new Promise((resolve) => {
        pendingPrompt = resolve
      })
    }
    if (mode === 'crash') {
      process.stderr.write('synthetic-private-diagnostic')
      process.exit(2)
    }
    if (mode === 'foreign-session') {
      await update('foreign data', 'foreign-session')
    }
    if (mode === 'oversized') await update('x'.repeat(4_096))
    if (mode.startsWith('permission')) {
      const ask = async (toolCallId) => {
        const result = await client.request(acp.methods.client.session.requestPermission, {
          sessionId: params.sessionId,
          toolCall: { toolCallId, title: 'Synthetic permission' },
          options:
            mode === 'permission-always'
              ? [{ optionId: 'allow-always', name: 'Allow always', kind: 'allow_always' }]
              : [
                  { optionId: 'allow-once', name: 'Allow once', kind: 'allow_once' },
                  { optionId: 'allow-always', name: 'Allow always', kind: 'allow_always' },
                  { optionId: 'reject-once', name: 'Reject once', kind: 'reject_once' },
                ],
        })
        state.permissions.push(result.outcome)
        record()
        return result
      }
      const results =
        mode === 'permission-parallel'
          ? await Promise.all([ask('tool-one'), ask('tool-two')])
          : [await ask('tool-one')]
      if (results.some((result) => result.outcome.outcome === 'cancelled')) {
        return { stopReason: 'cancelled' }
      }
    }
    if (mode === 'forbidden-client') {
      const requests = [
        [
          acp.methods.client.fs.readTextFile,
          { sessionId: params.sessionId, path: process.env.FIXTURE_DENIED_TARGET },
        ],
        [
          acp.methods.client.fs.writeTextFile,
          {
            sessionId: params.sessionId,
            path: process.env.FIXTURE_DENIED_TARGET,
            content: 'mutated',
          },
        ],
        [
          acp.methods.client.terminal.create,
          { sessionId: params.sessionId, command: 'untrusted-command' },
        ],
      ]
      for (const [method, request] of requests) {
        try {
          await client.request(method, request)
        } catch (error) {
          state.forbiddenErrors.push(error.code)
        }
      }
      record()
    }
    await update('ACP ')
    await update('fixture')
    return { stopReason: 'end_turn' }
  })
const connection = app.connect(
  acp.ndJsonStream(Writable.toWeb(process.stdout), Readable.toWeb(process.stdin)),
)
void connection.closed.then(() => {
  if (mode !== 'stubborn') process.stdin.destroy()
})
