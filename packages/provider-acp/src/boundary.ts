import type { AnyMessage, Stream } from '@agentclientprotocol/sdk'
import schema from '@agentclientprotocol/sdk/schema/schema.json' with { type: 'json' }
import { Ajv2020 } from 'ajv/dist/2020.js'

const validator = new Ajv2020({ strict: false, strictNumbers: true, validateFormats: false })
validator.addSchema({ ...schema, $id: 'https://runtime.test/acp-schema' })
const messageValid = validator.compile({ $ref: 'https://runtime.test/acp-schema' })
const parameterValidators = {
  'session/update': validator.compile({
    $ref: 'https://runtime.test/acp-schema#/$defs/SessionNotification',
  }),
  'session/request_permission': validator.compile({
    $ref: 'https://runtime.test/acp-schema#/$defs/RequestPermissionRequest',
  }),
  '$/cancel_request': validator.compile({
    $ref: 'https://runtime.test/acp-schema#/$defs/CancelRequestNotification',
  }),
}

export function safeStream(stream: Stream, fail: () => void): Stream {
  const reader = stream.readable.getReader()
  const writer = stream.writable.getWriter()
  const outstanding = new Set<string | number>()
  let readerReleased = false
  const releaseReader = () => {
    if (!readerReleased) {
      readerReleased = true
      reader.releaseLock()
    }
  }
  return {
    writable: new WritableStream<AnyMessage>({
      async write(message) {
        if ('method' in message && 'id' in message && message.id !== null)
          outstanding.add(message.id)
        await writer.write(message)
      },
      async close() {
        try {
          await writer.close()
        } finally {
          writer.releaseLock()
        }
      },
      async abort() {
        try {
          await writer.abort(new Error('ACP connection closed'))
        } finally {
          writer.releaseLock()
        }
      },
    }),
    readable: new ReadableStream<AnyMessage>({
      async pull(controller) {
        try {
          const item = await reader.read()
          if (item.done) {
            releaseReader()
            controller.close()
            return
          }
          const message = item.value
          if (!messageValid(message)) throw new Error('Invalid ACP envelope')
          if ('method' in message) {
            const check = parameterValidators[message.method as keyof typeof parameterValidators]
            if (!('id' in message) && !check) throw new Error('Unsupported ACP notification')
            if (check && !check(message.params)) throw new Error('Invalid ACP parameters')
          } else if ('id' in message) {
            if (message.id === null || !outstanding.delete(message.id))
              throw new Error('Uncorrelated ACP response')
          }
          controller.enqueue(message)
        } catch {
          fail()
          controller.error(new Error('ACP transport failed'))
          await reader.cancel().catch(() => undefined)
          releaseReader()
        }
      },
      async cancel() {
        if (readerReleased) return
        try {
          await reader.cancel()
        } finally {
          releaseReader()
        }
      },
    }),
  }
}
