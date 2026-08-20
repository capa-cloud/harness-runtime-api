# Repository Guidelines

## Scope

This repository owns the public Harness Runtime API specification, reference implementation,
provider adapters, SDKs, and conformance checks.

## Read First

- `README.md`
- `spec/runtime-model.md`
- `spec/protocol.md`
- nearest package README before changing a package contract

## Commands

- Install: `pnpm install`
- Full check: `pnpm check`
- Build: `pnpm build`
- Tests: `pnpm test`
- Public-content scan: `pnpm sanitize`

## Contract Rules

- Keep protocol schemas transport-neutral.
- Add capabilities through explicit manifests, not default methods that fail at runtime.
- Preserve event ordering, cursor replay, idempotency, and terminal-state invariants.
- Provider-specific payloads belong under `provider.event` or provider extension namespaces.
- Do not claim checkpoint or behavior portability unless a conformance test proves it.

## Public Repository Safety

- Do not add private endpoints, organization names, customer data, access tokens, local absolute
  paths, or unpublished dependencies.
- Examples use synthetic identifiers and public services only.
- Never commit `.env`, credentials, generated session logs, or model outputs containing user data.
- A real provider integration test must be opt-in and excluded from the default test suite.

## Verification

Protocol changes require schema tests and HTTP/SDK compatibility tests. Provider changes require the
conformance runner plus provider-specific negative tests.
