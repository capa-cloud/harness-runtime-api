#!/usr/bin/env node
import { serve } from '@hono/node-server'
import { InMemoryHarnessRuntime } from '@harness-runtime/core'
import { MockProvider } from '@harness-runtime/provider-mock'
import { createApp } from './index.js'

const hostname = process.env.HOST ?? '127.0.0.1'
const parsedPort = Number(process.env.PORT ?? '4310')
if (!Number.isSafeInteger(parsedPort) || parsedPort < 0 || parsedPort > 65_535) {
  throw new Error('PORT must be an integer between 0 and 65535')
}

const runtime = new InMemoryHarnessRuntime([new MockProvider()])
const app = createApp(runtime)
const server = serve({ fetch: app.fetch, hostname, port: parsedPort }, (info) =>
  process.stdout.write(`Harness Runtime API listening on http://${hostname}:${info.port}\n`),
)

const shutdown = (): void => {
  server.close(() => process.exit(0))
}
process.once('SIGINT', shutdown)
process.once('SIGTERM', shutdown)
