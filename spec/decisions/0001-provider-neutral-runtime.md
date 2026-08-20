# ADR 0001: Provider-Neutral Runtime Contract

Status: accepted

Date: 2026-08-19

## Context

Agent harness frameworks expose overlapping lifecycle capabilities through framework-specific SDKs,
subprocess protocols, or hosted APIs. Coupling a control plane directly to one framework makes
provider upgrades and replacement expensive.

## Decision

Define a transport-neutral runtime contract and provider SPI. Offer both embedded SDK use and an
optional HTTP/SSE binding. Use explicit capability manifests and conformance checks instead of a
single large interface with methods that fail only when called.

## Consequences

- Applications can integrate once and select providers at deployment time.
- Provider-specific behavior remains available through extension events.
- Checkpoints and behavioral output are not assumed portable.
- The protocol requires more lifecycle semantics than a request-response abstraction.
- Adapters must document native, emulated, degraded, and unsupported capabilities.
