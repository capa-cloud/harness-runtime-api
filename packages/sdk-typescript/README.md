# TypeScript SDK

Typed HTTP client with JSON response validation and resumable SSE parsing. It uses the caller's
`fetch` implementation and stores no credentials.

`listArtifacts(executionId)` returns validated portable descriptors. It does not download artifact
content or attach deployment credentials to descriptor URIs.

Breaking out of `streamEvents()` before a terminal event cancels the underlying response reader, so
callers can stop a live stream without leaving the HTTP connection open.

`waitForTerminal(executionId, signal?)` stops consuming on a terminal event and reads the execution
to confirm its terminal state. If SSE ends while the execution is still active, it throws
`HarnessRuntimeStreamInterruptedError` with the last fetched execution in `error.execution`. It does
not automatically restart work or reconnect. Callers can read the execution again or resume
`streamEvents()` from their last observed sequence, deduplicating by execution ID and sequence.

The optional abort signal also covers the final execution read. Aborting an observation request
does not cancel provider work; call `cancelExecution()` separately when that is intended.
