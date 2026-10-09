import {
  type ActionResponse,
  ArtifactListSchema,
  ConversationSchema,
  type CreateConversationRequest,
  EventListSchema,
  ExecutionSchema,
  type Execution,
  type Problem,
  ProblemSchema,
  RuntimeDescriptionSchema,
  RuntimeEventSchema,
  isTerminalExecutionState,
  type StartExecutionRequest,
  type RuntimeEvent,
} from '@harness-runtime/protocol'
import type { z } from 'zod'

export interface HarnessRuntimeClientOptions {
  baseUrl: string
  fetch?: typeof globalThis.fetch
  headers?: Record<string, string>
}

export class HarnessRuntimeHttpError extends Error {
  readonly status: number
  readonly problem: Problem

  constructor(status: number, problem: Problem) {
    super(problem.message)
    this.name = 'HarnessRuntimeHttpError'
    this.status = status
    this.problem = problem
  }
}

export class HarnessRuntimeStreamInterruptedError extends Error {
  readonly execution: Execution

  constructor(execution: Execution) {
    super(
      `Event stream ended before execution ${execution.id} became terminal (${execution.state})`,
    )
    this.name = 'HarnessRuntimeStreamInterruptedError'
    this.execution = execution
  }
}

export class HarnessRuntimeClient {
  private readonly baseUrl: string
  private readonly fetchImpl: typeof globalThis.fetch
  private readonly headers: Record<string, string>

  constructor(options: HarnessRuntimeClientOptions) {
    this.baseUrl = options.baseUrl.replace(/\/$/, '')
    this.fetchImpl = options.fetch ?? globalThis.fetch
    this.headers = options.headers ?? {}
  }

  describeRuntime() {
    return this.request('/v1/runtime', RuntimeDescriptionSchema)
  }

  createConversation(input: CreateConversationRequest = {}) {
    return this.request('/v1/conversations', ConversationSchema, {
      method: 'POST',
      body: JSON.stringify(input),
    })
  }

  getConversation(id: string) {
    return this.request(`/v1/conversations/${encodeURIComponent(id)}`, ConversationSchema)
  }

  startExecution(input: StartExecutionRequest) {
    return this.request('/v1/executions', ExecutionSchema, {
      method: 'POST',
      body: JSON.stringify(input),
    })
  }

  getExecution(id: string, signal?: AbortSignal) {
    return this.request(
      `/v1/executions/${encodeURIComponent(id)}`,
      ExecutionSchema,
      signal === undefined ? {} : { signal },
    )
  }

  listArtifacts(id: string) {
    return this.request(`/v1/executions/${encodeURIComponent(id)}/artifacts`, ArtifactListSchema)
  }

  cancelExecution(id: string, reason?: string) {
    return this.request(`/v1/executions/${encodeURIComponent(id)}:cancel`, ExecutionSchema, {
      method: 'POST',
      body: JSON.stringify(reason === undefined ? {} : { reason }),
    })
  }

  respondAction(id: string, actionId: string, response: ActionResponse) {
    return this.request(
      `/v1/executions/${encodeURIComponent(id)}/actions/${encodeURIComponent(actionId)}:respond`,
      ExecutionSchema,
      { method: 'POST', body: JSON.stringify(response) },
    )
  }

  listEvents(id: string, after = 0) {
    return this.request(
      `/v1/executions/${encodeURIComponent(id)}/events?after=${after}`,
      EventListSchema,
    )
  }

  async *streamEvents(
    id: string,
    options: { after?: number; signal?: AbortSignal } = {},
  ): AsyncGenerator<RuntimeEvent> {
    const after = options.after ?? 0
    const response = await this.fetchImpl(
      `${this.baseUrl}/v1/executions/${encodeURIComponent(id)}/events?after=${after}`,
      {
        headers: { ...this.headers, accept: 'text/event-stream' },
        ...(options.signal === undefined ? {} : { signal: options.signal }),
      },
    )
    if (!response.ok) throw await httpError(response)
    if (!response.body) throw new Error('SSE response did not include a body')

    const reader = response.body.getReader()
    const decoder = new TextDecoder()
    let buffer = ''
    let streamEnded = false
    try {
      while (true) {
        const { done, value } = await reader.read()
        buffer += decoder.decode(value, { stream: !done })
        const blocks = buffer.replaceAll('\r\n', '\n').split('\n\n')
        buffer = blocks.pop() ?? ''
        for (const block of blocks) {
          const event = parseSseBlock(block)
          if (event) yield event
        }
        if (done) {
          streamEnded = true
          const event = parseSseBlock(buffer)
          if (event) yield event
          return
        }
      }
    } finally {
      if (!streamEnded) await reader.cancel().catch(() => undefined)
      reader.releaseLock()
    }
  }

  async waitForTerminal(id: string, signal?: AbortSignal): Promise<Execution> {
    signal?.throwIfAborted()
    const options = signal === undefined ? {} : { signal }
    for await (const event of this.streamEvents(id, options)) {
      if (['run.completed', 'run.failed', 'run.cancelled'].includes(event.type)) break
    }
    signal?.throwIfAborted()
    const execution = await this.getExecution(id, signal)
    signal?.throwIfAborted()
    if (!isTerminalExecutionState(execution.state)) {
      throw new HarnessRuntimeStreamInterruptedError(execution)
    }
    return execution
  }

  private async request<T>(path: string, schema: z.ZodType<T>, init: RequestInit = {}): Promise<T> {
    const response = await this.fetchImpl(`${this.baseUrl}${path}`, {
      ...init,
      headers: {
        ...this.headers,
        ...(init.body === undefined ? {} : { 'content-type': 'application/json' }),
        ...normalizeHeaders(init.headers),
      },
    })
    if (!response.ok) throw await httpError(response)
    return schema.parse(await response.json())
  }
}

function parseSseBlock(block: string): RuntimeEvent | undefined {
  const data = block
    .split('\n')
    .filter((line) => line.startsWith('data:'))
    .map((line) => line.slice(5).trimStart())
    .join('\n')
  if (data === '') return undefined
  return RuntimeEventSchema.parse(JSON.parse(data))
}

async function httpError(response: Response): Promise<HarnessRuntimeHttpError> {
  let problem: Problem
  try {
    problem = ProblemSchema.parse(await response.json())
  } catch {
    problem = { code: 'HTTP_ERROR', message: `HTTP request failed with status ${response.status}` }
  }
  return new HarnessRuntimeHttpError(response.status, problem)
}

function normalizeHeaders(headers: HeadersInit | undefined): Record<string, string> {
  if (!headers) return {}
  return Object.fromEntries(new Headers(headers).entries())
}
