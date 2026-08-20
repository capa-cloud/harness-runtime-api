import type {
  ActionKind,
  ActionResponse,
  JsonObject,
  ProviderManifest,
  StandardEventType,
} from '@harness-runtime/protocol'

export type ProviderEventType = Extract<
  StandardEventType,
  'output.text.delta' | 'artifact.created' | 'provider.event'
>

export interface ProviderActionInput {
  kind: ActionKind
  title: string
  description?: string
  payload?: JsonObject
}

export interface ProviderRunContext {
  executionId: string
  conversationId: string
  input: string
  config: JsonObject
  signal: AbortSignal
  emit(type: ProviderEventType, data: JsonObject): void
  requestAction(input: ProviderActionInput): Promise<ActionResponse>
}

export interface ProviderRunResult {
  finalOutput?: string
}

export interface HarnessProvider {
  readonly manifest: ProviderManifest
  run(context: ProviderRunContext): Promise<ProviderRunResult>
  cancel?(executionId: string, reason?: string): Promise<void>
}
