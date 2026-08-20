# Specification Index

| Document | Status | Purpose |
| --- | --- | --- |
| [Runtime model](runtime-model.md) | current | Portable objects, authority, state, and invariants |
| [Protocol](protocol.md) | current | Commands, events, replay, idempotency, and errors |
| [OpenAPI](openapi.yaml) | current | HTTP binding for protocol version `2026-08-19` |
| [ADR 0001](decisions/0001-provider-neutral-runtime.md) | accepted | Provider-neutral core with embedded and remote bindings |

TypeScript schemas in `packages/protocol/src` are the executable source for payload validation. The
OpenAPI document is the public HTTP projection and is checked for parseability in CI.
