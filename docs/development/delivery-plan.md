# Delivery Plan

As of 2026-10-09. Target: the public Harness Runtime API repository's first experimental delivery.

The accepted ADRs define a portable control/event contract with explicit provider adapters. Durable
storage, tenant administration, and production scheduling remain deployment responsibilities; this
delivery does not claim those features exist in the reference server.

## Acceptance Checklist

- [x] DSH compatibility is pinned to an actually tested public SDK, with subprocess integration
  tests, cancellation, startup failure, and explicit environment isolation.
- [x] A second public Harness integration proves the provider boundary beyond Mock and DSH.
- [x] Capability-specific conformance probes cover advertised actions, cancellation, replay,
  idempotency, and artifacts without assuming model behavior portability.
- [x] HTTP and SDK verification uses real loopback connections, including disconnection and
  malformed inputs, rather than only in-process request helpers.
- [x] Runnable examples cover application integration and provider implementation; a fresh checkout
  can follow documented commands without private services or model credentials.
- [x] Protocol, OpenAPI, bilingual README, provider guides, and release materials agree with code.
- [x] The final tree, public history, dependency inventory, and publishable artifacts pass privacy
  and security review; findings and exclusions are stated explicitly.
- [x] Local checks and the reviewed GitHub commit's CI pass; the worktree is clean and synchronized.
- [ ] The exact release candidate, version, packaging decision, and any required publication
  authorization are recorded before claiming final delivery.

## Current Evidence

- Baseline commit: `d299a4f`.
- Baseline: 27 unit/contract tests and Node 22/24 CI passed.
- SDK interruption and bounded conformance cleanup defects were fixed in that baseline.
- Implementation commits: `e38a35a` and `351dd11`.
- [Reviewed code CI](https://github.com/capa-cloud/harness-runtime-api/actions/runs/37898601176):
  Node 22 and 24 each passed 46 unit/contract tests plus eight credential-free integration tests,
  build, type checking, lint, public scanning, and production dependency audit.
- Local full checks passed 42 unit tests and eight integration tests before the final scanner
  changes; the final three scanner regression tests separately passed locally. The last full local
  rerun was queued behind unrelated heavy tasks and cancelled; final code verification used CI.
- Both scanner backends passed against the current tree; local Markdown navigation has 116
  references and zero missing targets.
- Application and embedded Provider examples ran successfully against synthetic data. The opt-in
  DSH probe was verified with the local synthetic peer; no native model deployment was contacted.
- DSH SDK/process compatibility is now established for exactly `0.1.0-rc.7` using a synthetic peer.
  Native composition and sandbox behavior remain deployment-owned verification.
- Workspace packages remain unpublished; there is no GitHub Release or immutable version tag.

## Remaining Work

1. Record the final merged commit for `v0.2.0` and obtain separate immutable-tag/GitHub prerelease
   publication approval. Source-only packaging is prepared; npm publication is not part of delivery.

No completion claim has been made for the unchecked acceptance items.

## 0.2.0 Candidate

- [PR 12](https://github.com/capa-cloud/harness-runtime-api/pull/12) prepares runtime/workspace
  version `0.2.0`, retaining portable protocol `2026-09-02` and adding migration notes.
- Bilingual lifecycle diagrams now show failure during both human waits. Chrome inspections at
  original and reading size passed; automated checks cover nine states, twelve transitions, and
  deterministic regeneration.
- Source packaging requires a clean commit and an output directory outside the repository,
  including through symbolic links. Archives exclude Git metadata and include commit-bound
  metadata and SHA-256 checksums. Packages remain unpublished.
- Seven added version/diagram/packaging regression tests passed. Candidate
  `c97c45d` passed [Node 22/24 CI](https://github.com/capa-cloud/harness-runtime-api/actions/runs/37911321061)
  with 62 unit/contract tests and 35 integration tests per environment.
- A complete local reachable-history scan found no credentials or private fingerprints; the
  current-tree audit covered 137 files and metadata of eleven PNGs. Final artifacts are rechecked
  after the reviewed commit is frozen; scans do not prove an absence of every possible secret.
- Initial local source/archive reruns exposed overly tight subprocess deadlines and a partial
  synthetic trace write under load. The tests now run serially with bounded startup allowances;
  trace writes use atomic replacement. The assertions and production provider defaults are unchanged.
  The final code revision `c8aa77e` passed both full local and isolated-archive reruns: each had
  62 unit/contract tests and 35 integration tests, format/lint/type/build checks, and public scanning.
  The exact revision also passed [Node 22/24 CI](https://github.com/capa-cloud/harness-runtime-api/actions/runs/37912523565).
  ACP fixture initialization and cleanup allowances are 10 seconds and one second; failure
  diagnostics are explicit, and production defaults remain unchanged.
- The final code audit covered 137 files, eleven PNGs, and 29 reachable commits, with zero private
  fingerprint or credential findings. Source archive and manifest SHA-256 verification passed.
  Source bundles include the frozen dependency inventory; production dependency auditing reported
  no known vulnerabilities. Native model quality, operating-system isolation, and production load
  testing remain outside this credential-free delivery validation.

## ACP and Schema Verification

- ACP v1 implementation and boundary hardening were developed in
  [PR 11](https://github.com/capa-cloud/harness-runtime-api/pull/11).
- [Reviewed provider/schema CI](https://github.com/capa-cloud/harness-runtime-api/actions/runs/37906236553)
  passed on Node 22 and 24. The final bounded-permission revision passed local full checks with
  55 unit/contract tests and 35 integration tests.
- ACP tests use the official SDK on both sides of a real synthetic subprocess. They verify human
  permission choices, simultaneous requests, cancellation while awaiting approval, forced process
  exit, isolated environments, denied client file/terminal requests, unrelated-session updates,
  malformed-message handling, and no raw diagnostic logging.
- Pending native permissions are bounded (default: 16); the overflow regression confirms an agent
  cannot create an unbounded queue while awaiting a human response.
- OpenAPI now projects 23 named Zod schemas with generated references and constraints. Independent
  JSON Schema samples and actual HTTP payload checks passed; native timestamp patterns carry the
  input constraints and format is treated as an annotation.
- No real model, private platform, production resource, or user session history was accessed.

## Verification Boundaries

Default tests use synthetic data and local processes only. Native Harness/model integration is
opt-in and must identify the selected runtime and environment. No private platform, tenant,
production credentials, user session history, or operational data belongs in test fixtures or
published evidence. A synthetic JSON-RPC peer proves wire integration, not model quality or native
sandbox behavior.
