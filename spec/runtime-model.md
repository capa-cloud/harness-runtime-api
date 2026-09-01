# Runtime Model

Status: current

Protocol version: `2026-09-01`

## Scope

Harness Runtime API standardizes how an application controls a harness execution. It does not
standardize the model, prompt, tool implementation, internal agent loop, or checkpoint format.

## Objects

### Provider Manifest

A provider manifest identifies one adapter and declares topology plus capability support. Support is
one of `native`, `emulated`, `degraded`, or `unsupported`.

### Conversation

A conversation is the caller-facing multi-turn identity. A provider may map it to a native session,
create a fresh native session per execution, or reject continuity requirements during preflight.

### Execution

An execution is one bounded attempt. It owns a state, effective provider configuration, event stream,
pending actions, artifacts, and terminal outcome.

### Event

Events are append-only and numbered from one within an execution. Sequence is the replay cursor. An
event already observed may be delivered again after reconnect; consumers deduplicate by execution ID
and sequence.

### Action Request

An action request pauses progress until a caller supplies input or approval. The request has its own
identity and may be answered at most once.

### Checkpoint and Artifact

Artifacts are validated portable descriptors. They identify the owning execution, media type,
creation time, optional URI, and metadata, but do not carry bytes. Checkpoints are not part of the
MVP. A future checkpoint contract must distinguish provider-opaque state from a portable
representation.

## State Machine

![Exact portable execution lifecycle.](../assets/execution-lifecycle-en.svg)

```text
queued -> starting -> running
                       |-> awaiting_input -> running
                       |-> awaiting_approval -> running
                       |-> succeeded
                       |-> failed
any non-terminal state -> cancelling -> cancelled
```

Terminal states are `succeeded`, `failed`, and `cancelled`. A terminal execution never returns to a
non-terminal state. Cancellation can begin from any non-terminal state; the provider-specific cancel
hook and abort signal determine how native work is stopped.

## Authority

- The caller owns identity, authorization, business policy, and credentials.
- The runtime owns portable execution state, event ordering, and action correlation.
- The provider owns its native session and process lifecycle.
- A deployment owns persistence, isolation, scheduling, telemetry export, and retention.

## Invariants

1. Event sequence is contiguous and strictly increasing per execution.
2. Exactly one terminal event is appended.
3. `requiredCapabilities` is checked before provider work begins.
4. An idempotency key returns the original execution only for an equivalent request.
5. Cancellation is a request; terminal cancellation is confirmed by `run.cancelled`.
6. Provider-native payloads do not silently redefine portable event semantics.
7. Artifact IDs are unique within one execution and every listed artifact has one matching creation
   event.
