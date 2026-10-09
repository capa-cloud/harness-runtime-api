import { createInterface } from 'node:readline'

const mode = process.env.FIXTURE_MODE ?? 'success'
const input = createInterface({ input: process.stdin })
const send = (message) =>
  process.stdout.write(`${JSON.stringify({ jsonrpc: '2.0', ...message })}\n`)
const notify = (sessionId, method, params) => send({ method, params: { sessionId, ...params } })

input.on('line', (line) => {
  const message = JSON.parse(line)
  if (message.method === 'initialize') {
    send({
      id: message.id,
      result:
        mode === 'bad-handshake' ? {} : { serverInfo: { name: 'synthetic-peer', version: '1' } },
    })
  } else if (message.method === 'session/prompt') {
    const sessionId = message.params.sessionId
    const receiptId = 'message-fixture'
    send({ id: message.id, result: { messageId: receiptId } })
    notify(sessionId, 'session.event', {
      event: { type: 'agent/inbox/spliced', data: { inserted: [{ id: receiptId }] } },
    })
    notify(sessionId, 'session.status', {
      status: 'running',
      fixturePid: process.pid,
      inheritedParent: process.env.HARNESS_PARENT_SENTINEL !== undefined,
    })
    if (mode === 'hang') return
    if (mode === 'crash') {
      process.exitCode = 1
      input.close()
      process.stdin.destroy()
      return
    }
    notify(sessionId, 'session.event', {
      event: {
        type: 'assistant/chunk',
        data: { chunk: { type: 'text-delta', text: 'fixture-result' } },
      },
    })
    notify(sessionId, 'session.event', {
      event: {
        type: 'assistant/message',
        data: { message: { content: [{ type: 'text', text: 'fixture-result' }] } },
      },
    })
    notify(sessionId, 'session.status', { status: 'idle' })
  } else if (message.method === 'shutdown') {
    send({ id: message.id, result: {} })
    input.close()
    process.stdin.destroy()
  }
})
