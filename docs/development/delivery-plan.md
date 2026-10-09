# Delivery Plan

As of 2026-10-09. Target: the public Harness Runtime API repository's first experimental delivery.

The accepted ADRs define a portable control/event contract with explicit provider adapters. Durable
storage, tenant administration, and production scheduling remain deployment responsibilities; this
delivery does not claim those features exist in the reference server.

## Acceptance Checklist

- [ ] DSH compatibility is pinned to an actually tested public SDK, with subprocess integration
  tests, cancellation, startup failure, and explicit environment isolation.
- [ ] A second public Harness integration proves the provider boundary beyond Mock and DSH.
- [ ] Capability-specific conformance probes cover advertised actions, cancellation, replay,
  idempotency, and artifacts without assuming model behavior portability.
- [ ] HTTP and SDK verification uses real loopback connections, including disconnection and
  malformed inputs, rather than only in-process request helpers.
- [ ] Runnable examples cover application integration and provider implementation; a fresh checkout
  can follow documented commands without private services or model credentials.
- [ ] Protocol, OpenAPI, bilingual README, provider guides, and release materials agree with code.
- [ ] The final tree, public history, dependency inventory, and publishable artifacts pass privacy
  and security review; findings and exclusions are stated explicitly.
- [ ] Local checks and the reviewed GitHub commit's CI pass; the worktree is clean and synchronized.
- [ ] The exact release candidate, version, packaging decision, and any required publication
  authorization are recorded before claiming final delivery.

## Current Evidence

- Baseline commit: `d299a4f`.
- Baseline: 27 unit/contract tests and Node 22/24 CI passed.
- SDK interruption and bounded conformance cleanup defects were fixed in that baseline.
- DSH tests currently inject clients; real SDK/process compatibility has not yet been established.
- Workspace packages remain unpublished; there is no GitHub Release or immutable version tag.

## Verification Boundaries

Default tests use synthetic data and local processes only. Native Harness/model integration is
opt-in and must identify the selected runtime and environment. No private platform, tenant,
production credentials, user session history, or operational data belongs in test fixtures or
published evidence. A synthetic JSON-RPC peer proves wire integration, not model quality or native
sandbox behavior.
