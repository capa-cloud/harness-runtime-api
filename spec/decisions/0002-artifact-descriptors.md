# ADR 0002: Keep Artifact Content Outside the Runtime

Status: accepted

Date: 2026-09-01

## Context

Harness providers can produce files, reports, patches, images, logs, and other outputs. A control
plane needs a stable way to discover those outputs, but content storage introduces deployment-specific
concerns: object stores, tenant authorization, retention, malware scanning, encryption, signed URLs,
and size limits.

Putting bytes or storage credentials into the portable runtime would couple the protocol to one
deployment model and enlarge the trust boundary.

## Decision

The portable protocol standardizes only validated Artifact descriptors and their lifecycle:

- providers emit an input descriptor;
- the runtime assigns execution ownership and acceptance time;
- one `artifact.created` event is appended;
- descriptors can be listed in creation order;
- content bytes and URI authorization remain deployment-owned.

Artifact IDs are unique within an execution. Invalid or duplicate provider descriptors fail the
execution instead of entering the portable event history.

## Consequences

- Runtime clients can discover outputs consistently across providers.
- Deployments retain freedom to use local files, object stores, opaque handles, or another content
  plane.
- A descriptor URI is not implicitly public, permanent, or trusted.
- Content upload, download, integrity, signing, retention, and deletion are intentionally outside the
  MVP contract.
