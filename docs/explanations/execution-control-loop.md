# Execution Control Loop

Status: current

Protocol version: `2026-09-02`

![One portable execution control loop between caller, Runtime, Provider, and terminal outcome.](../../assets/execution-control-loop-en.svg)

The caller controls an Execution through Runtime rather than invoking a native harness directly.
Runtime checks required capabilities, starts Provider work, orders emitted observations, and exposes
replayable events to the caller.

## Normal Path

1. The caller creates a Conversation and starts an Execution.
2. Runtime validates the request and required capabilities.
3. Runtime invokes the selected Provider with a bounded context and abort signal.
4. Provider deltas and native observations return through Runtime as ordered portable events.
5. Runtime appends normalized final output and exactly one terminal event.

## Human Action Path

Provider code can request input or approval through the Runtime context. Runtime correlates the
Action, moves the Execution into an awaiting state, and exposes `action.required`. The caller answers
through Runtime; the same suspended provider call resumes. An Action response never creates a second
Execution.

## Replay and Recovery Boundary

SSE and JSON event reads use the same monotonic sequence cursor. Reconnecting clients may receive an
event more than once and must deduplicate by `(executionId, sequence)`. The reference implementation
replays only process-local history; durable restart recovery belongs to a future storage boundary.

A closed SSE connection alone does not prove that an Execution ended. The TypeScript SDK's
`waitForTerminal()` confirms the state with an execution read and throws
`HarnessRuntimeStreamInterruptedError` if the stream ended while work is still active. Callers
control reconnection using their last observed sequence. Stopping observation does not cancel work.

See [Execution lifecycle](execution-lifecycle.md) for exact states and
[Protocol](../../spec/protocol.md) for normative event semantics.
