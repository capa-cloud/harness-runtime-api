# Protocol

Status: current

Protocol version: `2026-09-02`

## Commands

- Describe runtime and provider capabilities.
- Create and read a conversation.
- Start and read an execution.
- Cancel an execution.
- Replay or stream execution events after a cursor.
- List validated artifact descriptors emitted by an execution.
- Respond to a pending action.

## Standard Events

| Event | Meaning |
| --- | --- |
| `run.queued` | Portable execution record was created |
| `run.started` | Provider work started |
| `output.text.delta` | Incremental assistant text |
| `output.text.done` | Final normalized text for the execution |
| `action.required` | Execution requires input or approval |
| `action.responded` | Caller supplied an accepted response |
| `artifact.created` | Provider produced an artifact descriptor |
| `provider.event` | Namespaced provider-native observation |
| `run.completed` | Execution succeeded |
| `run.failed` | Execution failed |
| `run.cancelled` | Execution stopped after cancellation |

## Replay

`GET /v1/executions/{id}/events?after=N` returns events whose sequence is greater than `N`. With
`Accept: text/event-stream`, the server first emits that backlog and then follows new events through
the terminal event.

Delivery is at least once across reconnects. Consumers must deduplicate by `(executionId, sequence)`.

## Artifacts

`artifact.created` carries a validated descriptor with `id`, `executionId`, `name`, `mediaType`,
`createdAt`, optional `uri`, and metadata. `GET /v1/executions/{id}/artifacts` returns the descriptors
in creation order. The portable contract does not store or proxy artifact bytes; the URI, retention,
authorization, and content transport remain deployment responsibilities.

## Idempotency

`POST /v1/executions` accepts `idempotencyKey`. Reusing a key with an equivalent conversation,
provider, input, required capabilities, and config returns the original execution. Reusing it with a
different request returns `409 IDEMPOTENCY_CONFLICT`.

## Cancellation

`POST /v1/executions/{id}:cancel` accepts an optional non-empty `reason` of at most 500 characters.
Concurrent requests share one provider cleanup operation and one terminal event. A provider cleanup
failure does not create a contradictory HTTP failure after portable cancellation is confirmed; the
message is recorded as `run.cancelled.providerCleanupError`.

## Capability Preflight

![Exact capability preflight decision flow.](../assets/capability-preflight-en.svg)

Each requested capability must be advertised as `native`, `emulated`, or `degraded`. `unsupported`
or an absent capability fails before the provider starts. A caller that cannot tolerate degradation
should compare the provider manifest before starting the execution.

## Errors

Errors use a stable code plus a human-readable message. Current codes include:

- `VALIDATION_ERROR`
- `NOT_FOUND`
- `PROVIDER_NOT_FOUND`
- `CAPABILITY_UNSUPPORTED`
- `IDEMPOTENCY_CONFLICT`
- `INVALID_STATE`
- `ACTION_NOT_FOUND`
- `ACTION_ALREADY_RESOLVED`
- `PROVIDER_ERROR`
