import { z } from 'zod'

export const PROTOCOL_VERSION = '2026-08-19' as const

export type JsonPrimitive = string | number | boolean | null
export type JsonValue = JsonPrimitive | JsonValue[] | { [key: string]: JsonValue }
export type JsonObject = { [key: string]: JsonValue }

export const JsonValueSchema: z.ZodType<JsonValue> = z.lazy(() =>
  z.union([
    z.string(),
    z.number().finite(),
    z.boolean(),
    z.null(),
    z.array(JsonValueSchema),
    z.record(z.string(), JsonValueSchema),
  ]),
)

export const JsonObjectSchema: z.ZodType<JsonObject> = z.record(z.string(), JsonValueSchema)

export const SupportLevelSchema = z.enum(['native', 'emulated', 'degraded', 'unsupported'])
export type SupportLevel = z.infer<typeof SupportLevelSchema>

export const RuntimeTopologySchema = z.enum(['embedded', 'subprocess', 'remote'])
export type RuntimeTopology = z.infer<typeof RuntimeTopologySchema>

export const StandardCapability = {
  actionApproval: 'action.approval',
  actionInput: 'action.input',
  artifacts: 'artifact.list',
  cancellation: 'execution.cancel',
  conversationContinuity: 'conversation.continuity',
  eventReplay: 'event.replay',
  eventStreaming: 'event.streaming',
  mcp: 'extension.mcp',
  sandbox: 'extension.sandbox',
  skills: 'extension.skills',
  subagents: 'extension.subagents',
} as const

export type StandardCapabilityName = (typeof StandardCapability)[keyof typeof StandardCapability]

export const ProviderManifestSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  version: z.string().min(1),
  protocolVersion: z.literal(PROTOCOL_VERSION),
  topologies: z.array(RuntimeTopologySchema).min(1),
  capabilities: z.record(z.string().min(1), SupportLevelSchema),
  metadata: JsonObjectSchema.optional(),
})
export type ProviderManifest = z.infer<typeof ProviderManifestSchema>

export const RuntimeDescriptionSchema = z.object({
  name: z.string().min(1),
  version: z.string().min(1),
  protocolVersion: z.literal(PROTOCOL_VERSION),
  providers: z.array(ProviderManifestSchema),
})
export type RuntimeDescription = z.infer<typeof RuntimeDescriptionSchema>

export const ConversationSchema = z.object({
  id: z.string().min(1),
  createdAt: z.iso.datetime(),
  metadata: JsonObjectSchema,
})
export type Conversation = z.infer<typeof ConversationSchema>

export const CreateConversationRequestSchema = z.object({
  metadata: JsonObjectSchema.optional(),
})
export type CreateConversationRequest = z.infer<typeof CreateConversationRequestSchema>

export const ExecutionStateSchema = z.enum([
  'queued',
  'starting',
  'running',
  'awaiting_input',
  'awaiting_approval',
  'cancelling',
  'succeeded',
  'failed',
  'cancelled',
])
export type ExecutionState = z.infer<typeof ExecutionStateSchema>

export const TerminalExecutionStates = new Set<ExecutionState>(['succeeded', 'failed', 'cancelled'])

export function isTerminalExecutionState(state: ExecutionState): boolean {
  return TerminalExecutionStates.has(state)
}

export const ExecutionErrorSchema = z.object({
  code: z.string().min(1),
  message: z.string().min(1),
})
export type ExecutionError = z.infer<typeof ExecutionErrorSchema>

export const ExecutionSchema = z.object({
  id: z.string().min(1),
  conversationId: z.string().min(1),
  providerId: z.string().min(1),
  state: ExecutionStateSchema,
  input: z.string(),
  requiredCapabilities: z.array(z.string().min(1)),
  effectiveConfig: JsonObjectSchema,
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
  startedAt: z.iso.datetime().optional(),
  endedAt: z.iso.datetime().optional(),
  finalOutput: z.string().optional(),
  error: ExecutionErrorSchema.optional(),
})
export type Execution = z.infer<typeof ExecutionSchema>

export const StartExecutionRequestSchema = z.object({
  conversationId: z.string().min(1),
  providerId: z.string().min(1),
  input: z.string(),
  requiredCapabilities: z.array(z.string().min(1)).optional(),
  config: JsonObjectSchema.optional(),
  idempotencyKey: z.string().min(1).max(200).optional(),
})
export type StartExecutionRequest = z.infer<typeof StartExecutionRequestSchema>

export const ActionKindSchema = z.enum(['approval', 'input'])
export type ActionKind = z.infer<typeof ActionKindSchema>

export const ActionRequestSchema = z.object({
  id: z.string().min(1),
  executionId: z.string().min(1),
  kind: ActionKindSchema,
  title: z.string().min(1),
  description: z.string().optional(),
  payload: JsonObjectSchema,
  createdAt: z.iso.datetime(),
})
export type ActionRequest = z.infer<typeof ActionRequestSchema>

export const ActionResponseSchema = z.object({
  approved: z.boolean().optional(),
  value: JsonValueSchema.optional(),
  metadata: JsonObjectSchema.optional(),
})
export type ActionResponse = z.infer<typeof ActionResponseSchema>

export const StandardEventTypeSchema = z.enum([
  'run.queued',
  'run.started',
  'output.text.delta',
  'output.text.done',
  'action.required',
  'action.responded',
  'artifact.created',
  'provider.event',
  'run.completed',
  'run.failed',
  'run.cancelled',
])
export type StandardEventType = z.infer<typeof StandardEventTypeSchema>

export const RuntimeEventSchema = z.object({
  id: z.string().min(1),
  executionId: z.string().min(1),
  sequence: z.number().int().positive(),
  type: StandardEventTypeSchema,
  time: z.iso.datetime(),
  data: JsonObjectSchema,
})
export type RuntimeEvent = z.infer<typeof RuntimeEventSchema>

export const EventListSchema = z.object({
  events: z.array(RuntimeEventSchema),
  nextCursor: z.number().int().nonnegative(),
})
export type EventList = z.infer<typeof EventListSchema>

export const ProblemSchema = z.object({
  code: z.string().min(1),
  message: z.string().min(1),
  details: JsonObjectSchema.optional(),
})
export type Problem = z.infer<typeof ProblemSchema>
