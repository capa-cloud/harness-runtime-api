# TypeScript SDK

Typed HTTP client with JSON response validation and resumable SSE parsing. It uses the caller's
`fetch` implementation and stores no credentials.

Breaking out of `streamEvents()` before a terminal event cancels the underlying response reader, so
callers can stop a live stream without leaving the HTTP connection open.
