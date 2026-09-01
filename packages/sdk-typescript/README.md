# TypeScript SDK

Typed HTTP client with JSON response validation and resumable SSE parsing. It uses the caller's
`fetch` implementation and stores no credentials.

`listArtifacts(executionId)` returns validated portable descriptors. It does not download artifact
content or attach deployment credentials to descriptor URIs.

Breaking out of `streamEvents()` before a terminal event cancels the underlying response reader, so
callers can stop a live stream without leaving the HTTP connection open.
