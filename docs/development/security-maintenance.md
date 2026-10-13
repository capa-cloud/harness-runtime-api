# Security Maintenance Checkpoint

As of 2026-10-13. Runtime `0.2.0`, portable protocol `2026-09-02`.

## Repair

An all-dependency audit identified
[GHSA-68fv-2mgg-jv7q](https://github.com/advisories/GHSA-68fv-2mgg-jv7q) in the development path
`vitest -> vite -> postcss -> source-map-js@1.2.1`. Production-only auditing did not expose it.
This is a development-tooling denial-of-service advisory, not a demonstrated data-exfiltration
or remote reference-server vulnerability.

The workspace now overrides only `source-map-js` to the patched `1.2.2`. The frozen lockfile
contains that version and no affected predecessor. Other dependency versions are unchanged.

## Continuous Gate

- `pnpm security:audit` checks the full dependency graph at the moderate severity threshold.
- `pnpm check` requires that command after the existing format/lint/type/build/test checks.
- Existing Node 22/24 CI invokes `pnpm check`; no workflow permission expansion is needed.
- Registry/network errors fail the gate rather than silently skipping the audit.
- Two regression tests bind the workspace override, lockfile, command policy, and CI entry point.

## Local Verification

The repaired tree passed `pnpm check`: 64 unit/contract tests and 35 credential-free integration
tests, format, lint, type checking, workspace builds, and the all-dependency audit. A separate
`pnpm security:audit` reported no known vulnerabilities. Remote CI and sanitization evidence must
be bound to the final submitted revision before claiming submission complete.

## Data And Publication Boundaries

The [security policy](../../SECURITY.md) and
[production guide](../guides/production-deployment.md) remain normative for deployment controls.
Authentication, resource ownership, event/error redaction, request/state quotas, and OS isolation
are not supplied by this reference implementation. A passing source audit or synthetic integration
test is not approval to expose it to untrusted tenants or process real sensitive data.

Media review includes visible content and structured provenance metadata such as C2PA/JUMBF.
Keep private audit tooling, raw diagnostics, local handoffs, and workstation/session history outside
the public repository and published assets. Use synthetic data for tests and public examples.

The earlier `4902b3f` source candidate still contains the affected development dependency; its
archive/checksums are historical evidence, not a repaired release. Security maintenance changes
require a new source bundle and reviewed commit. Immutable tags, GitHub Releases, and npm publication
remain separate authorization steps; this maintenance task does not publish them.
