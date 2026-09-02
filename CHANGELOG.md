# Changelog

All notable changes to this project are documented in this file. The project follows Semantic
Versioning for runtime/package releases and uses a dated protocol version for portable contract
changes.

## [Unreleased]

## [0.1.0] - 2026-09-02

### Added

- Provider-neutral Conversation, Execution, Event, Action, and Artifact schemas.
- In-memory reference runtime with idempotency, capability preflight, event replay, SSE streaming,
  action correlation, cancellation, and Artifact descriptor listing.
- Mock and optional DeepSeek Harness providers.
- HTTP/JSON server, TypeScript SDK, OpenAPI 3.1 contract, and provider conformance runner.
- English and Simplified Chinese documentation with validated architecture and lifecycle diagrams.

### Hardened

- Concurrent cancellation shares one provider cleanup operation and one terminal event.
- Duplicate Action responses return `ACTION_ALREADY_RESOLVED`.
- Cancellation request bodies are schema-validated.
- DSH cleanup is idempotent across abort, explicit cancellation, and finalization.
- Early SSE consumer exit cancels the underlying response reader.

### Boundaries

- Reference state is process-local and not durable.
- Authentication, authorization, tenant isolation, content storage, and distributed scheduling are
  deployment responsibilities.
- Workspace packages are not yet published to a package registry.
