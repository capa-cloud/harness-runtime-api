# Specification Index

| Document | Status | Purpose |
| --- | --- | --- |
| [Runtime model](runtime-model.md) | current | Portable objects, authority, state, and invariants |
| [Protocol](protocol.md) | current | Commands, events, replay, idempotency, and errors |
| [OpenAPI](openapi.yaml) | current | HTTP binding for protocol version `2026-09-02` |
| [ADR 0001](decisions/0001-provider-neutral-runtime.md) | accepted | Provider-neutral core with embedded and remote bindings |
| [ADR 0002](decisions/0002-artifact-descriptors.md) | accepted | Portable descriptors with deployment-owned content storage |

TypeScript schemas in `packages/protocol/src` are the executable source for payload validation. The
OpenAPI document is the public HTTP projection. Its schemas are generated from the portable Zod
schemas with `pnpm spec:generate`; routes and HTTP operation descriptions remain maintained in the
OpenAPI file. CI checks generated component equality, independent JSON Schema boundary samples,
and actual HTTP response compatibility. Timestamp constraints use generated patterns; format is
an annotation under the document's JSON Schema dialect.
