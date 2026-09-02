# Execution Lifecycle

Status: current

Protocol version: `2026-09-02`

![Portable execution lifecycle from queue through action waits, cancellation, and terminal outcomes.](../../assets/execution-lifecycle-en.svg)

An Execution is one bounded attempt. Runtime creates it as `queued`, starts provider work through
`starting`, and enters `running`. A provider can request input or approval; the correlated response
returns the same execution to `running`.

Exactly one of three terminal outcomes is retained:

- `succeeded` after normalized final output;
- `failed` after an unrecovered provider error;
- `cancelled` after cancellation finalization.

A cancellation request is accepted from any non-terminal state. Runtime moves through `cancelling`,
aborts the provider context, rejects pending actions, invokes optional provider cleanup, and appends
one `run.cancelled` terminal event. Terminal executions never return to active states.

Concurrent cancellation calls share one provider cleanup operation. If that cleanup hook fails,
Runtime still returns the confirmed portable `cancelled` state and records the failure message in
`run.cancelled.providerCleanupError`. Providers must avoid placing credentials or private
payloads in thrown error messages.

The diagram is a deterministic projection of `packages/core/src/runtime.ts`. The normative
invariants remain in the [runtime model](../../spec/runtime-model.md).
