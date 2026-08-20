import type { JsonObject } from '@harness-runtime/protocol'

export type RuntimeErrorCode =
  | 'VALIDATION_ERROR'
  | 'NOT_FOUND'
  | 'PROVIDER_NOT_FOUND'
  | 'CAPABILITY_UNSUPPORTED'
  | 'IDEMPOTENCY_CONFLICT'
  | 'INVALID_STATE'
  | 'ACTION_NOT_FOUND'
  | 'ACTION_ALREADY_RESOLVED'
  | 'PROVIDER_ERROR'

export class RuntimeError extends Error {
  readonly code: RuntimeErrorCode
  readonly status: number
  readonly details?: JsonObject

  constructor(code: RuntimeErrorCode, message: string, status: number, details?: JsonObject) {
    super(message)
    this.name = 'RuntimeError'
    this.code = code
    this.status = status
    if (details !== undefined) this.details = details
  }
}

export class ExecutionAbortedError extends Error {
  constructor(message = 'Execution aborted') {
    super(message)
    this.name = 'ExecutionAbortedError'
  }
}
