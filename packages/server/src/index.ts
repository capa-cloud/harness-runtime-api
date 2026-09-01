import { RuntimeError, type InMemoryHarnessRuntime } from '@harness-runtime/core'
import type { Problem } from '@harness-runtime/protocol'
import { Hono } from 'hono'
import { streamSSE } from 'hono/streaming'

export function createApp(runtime: InMemoryHarnessRuntime): Hono {
  const app = new Hono()

  app.onError((error, context) => {
    if (isRuntimeError(error)) {
      const problem: Problem = {
        code: error.code,
        message: error.message,
        ...(error.details === undefined ? {} : { details: error.details }),
      }
      return context.json(problem, statusCode(error.status))
    }
    if (isSyntaxError(error)) {
      return context.json(
        { code: 'VALIDATION_ERROR', message: 'Request body is not valid JSON' },
        400,
      )
    }
    return context.json({ code: 'INTERNAL_ERROR', message: 'Unexpected server error' }, 500)
  })

  app.get('/healthz', (context) => context.json({ status: 'ok' }))

  app.get('/v1/runtime', (context) => context.json(runtime.describe()))
  app.get('/v1/runtime/capabilities', (context) =>
    context.json({ providers: runtime.providerManifests() }),
  )

  app.post('/v1/conversations', async (context) => {
    const body = await optionalJson(context.req.raw)
    return context.json(runtime.createConversation(body), 201)
  })

  app.get('/v1/conversations/:id', (context) =>
    context.json(runtime.getConversation(context.req.param('id'))),
  )

  app.post('/v1/executions', async (context) => {
    const body = await requiredJson(context.req.raw)
    return context.json(runtime.startExecution(body), 202)
  })

  app.get('/v1/executions/:id', (context) =>
    context.json(runtime.getExecution(context.req.param('id'))),
  )

  app.get('/v1/executions/:id/artifacts', (context) =>
    context.json(runtime.listArtifacts(context.req.param('id'))),
  )

  app.post('/v1/executions/:id:cancel', async (context) => {
    const body = await optionalJson(context.req.raw)
    const reason = readReason(body)
    const executionId = suffixedParam(context.req.param('id:cancel'), ':cancel')
    return context.json(await runtime.cancelExecution(executionId, reason))
  })

  app.post('/v1/executions/:id/actions/:actionId:respond', async (context) => {
    const body = await requiredJson(context.req.raw)
    return context.json(
      runtime.respondAction(
        requiredParam(context.req.param('id')),
        suffixedParam(context.req.param('actionId:respond'), ':respond'),
        body,
      ),
    )
  })

  app.get('/v1/executions/:id/events', (context) => {
    const executionId = context.req.param('id')
    const after = readCursor(context.req.query('after'))
    if (!context.req.header('accept')?.includes('text/event-stream')) {
      return context.json(runtime.listEvents(executionId, after))
    }

    runtime.getExecution(executionId)
    return streamSSE(context, async (stream) => {
      for await (const event of runtime.subscribeEvents(
        executionId,
        after,
        context.req.raw.signal,
      )) {
        await stream.writeSSE({
          id: String(event.sequence),
          event: event.type,
          data: JSON.stringify(event),
        })
        if (isTerminalEvent(event.type)) break
      }
    })
  })

  return app
}

async function optionalJson(request: Request): Promise<unknown> {
  const text = await request.text()
  return text.trim() === '' ? {} : JSON.parse(text)
}

async function requiredJson(request: Request): Promise<unknown> {
  const text = await request.text()
  if (text.trim() === '') {
    throw new RuntimeError('VALIDATION_ERROR', 'Request body is required', 400)
  }
  return JSON.parse(text)
}

function readCursor(value: string | undefined): number {
  if (value === undefined) return 0
  const cursor = Number(value)
  if (!Number.isSafeInteger(cursor) || cursor < 0) {
    throw new RuntimeError('VALIDATION_ERROR', 'after must be a non-negative integer', 400)
  }
  return cursor
}

function readReason(value: unknown): string | undefined {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return undefined
  const reason = (value as Record<string, unknown>).reason
  return typeof reason === 'string' ? reason : undefined
}

function requiredParam(value: string | undefined): string {
  if (value === undefined || value === '') {
    throw new RuntimeError('VALIDATION_ERROR', 'Required path parameter is missing', 400)
  }
  return value
}

function suffixedParam(value: string | undefined, suffix: string): string {
  const parameter = requiredParam(value)
  if (!parameter.endsWith(suffix) || parameter.length === suffix.length) {
    throw new RuntimeError('VALIDATION_ERROR', 'Path parameter suffix is invalid', 400)
  }
  return parameter.slice(0, -suffix.length)
}

function isTerminalEvent(type: string): boolean {
  return type === 'run.completed' || type === 'run.failed' || type === 'run.cancelled'
}

function isSyntaxError(error: unknown): error is SyntaxError {
  return error instanceof SyntaxError
}

function isRuntimeError(error: unknown): error is RuntimeError {
  return (
    error instanceof RuntimeError ||
    (error instanceof Error &&
      error.name === 'RuntimeError' &&
      typeof (error as Partial<RuntimeError>).code === 'string' &&
      typeof (error as Partial<RuntimeError>).status === 'number')
  )
}

function statusCode(status: number): 400 | 404 | 409 | 422 | 500 {
  if (status === 400 || status === 404 || status === 409 || status === 422) return status
  return 500
}
