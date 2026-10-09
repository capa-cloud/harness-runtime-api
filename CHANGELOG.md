# Changelog

All notable changes to this project are documented in this file. The project follows Semantic
Versioning for runtime/package releases and uses a dated protocol version for portable contract
changes.

## [Unreleased]

### Added

- ACP v1 subprocess Provider through the official SDK, with correlated human permissions,
  one-time versus explicit remembered choices, serialized concurrent requests, and bounded process
  teardown. Client filesystem/terminal access is disabled; native isolation remains deployment-owned.
- Generated OpenAPI schema projection and independent contract/HTTP compatibility checks.
- Real ACP transport tests using a synthetic Agent, including scope violations, malformed
  messages, diagnostic redaction, process exit, and permission cancellation.

### Fixed

- Provider emissions now reject reserved lifecycle events and malformed portable payloads before
  appending them. Providers cannot report success while an Action remains unresolved.
- Capability conformance now supports explicit approval/input/denial/cancellation/Artifact scenarios
  and verifies observed Action correlation, idempotency conflicts, and cursor replay.
- Public-content scanning detects common credential prefixes and has synthetic regression fixtures.
- DSH compatibility is pinned to the verified public SDK `0.1.0-rc.7`. Launch configuration is
  snapshotted, per-execution overrides are rejected, and native runtime extensions default to
  unsupported unless explicitly declared by a trusted deployment.
- SDK terminal waits now confirm execution state after SSE EOF and report interrupted active runs
  with `HarnessRuntimeStreamInterruptedError`.
- SDK terminal events end observation without waiting for the connection to close; abort signals
  also cover the final execution read.
- Conformance probe failures now abort subscriptions and request bounded provider cleanup, with
  cleanup errors and timeouts included in the report.
- Updated Hono to 4.13.7 to clear four production dependency advisories, including
  [GHSA-hxh3-vqpv-xpqv](https://github.com/honojs/hono/security/advisories/GHSA-hxh3-vqpv-xpqv).

### Documentation

- Added runnable application/Provider examples and real SDK/subprocess integration checks using
  synthetic data only. The delivery plan records remaining acceptance requirements.
- Replaced the English control-loop raster with an exact SVG after correcting Action response
  direction and retiring inaccurate image validation records.
- Added bilingual execution-control, provider-boundary, and production-boundary diagrams.
- Added focused guides for one complete execution, provider ownership, and production deployment.
- Reorganized the documentation map around evaluation, integration, provider development, and
  operations paths.

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
