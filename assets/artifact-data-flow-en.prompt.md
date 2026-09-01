# Artifact Data Flow (English)

- Date: 2026-09-01
- Producer: AnyCap
- Model: GPT Image 2
- Mode: text-to-image regeneration after a two-model comparison
- Output: `assets/artifact-data-flow-en.png`
- Assurance class: T1 validated explanation
- Reading order: left to right, with a separate deployment-owned content path

## Fact Graph

- Nodes: one Harness Provider; Harness Runtime API containing descriptor validation, event
  recording, and descriptor storage; one application/control plane; deployment-owned Artifact Store.
- Descriptor edges: provider to runtime; runtime to application through peer SSE and list outputs.
- Content edges: provider to Artifact Store; Artifact Store to application.
- Forbidden edges: runtime to Artifact Store; artifact bytes through runtime; application writes to
  the store.

## Generation Summary

The source prompt requested one provider and one application node shared by the descriptor and
content paths, an exhaustive English text whitelist, flat white styling, and no runtime-to-store
connector. The first candidate duplicated endpoint nodes and was rejected. A second model candidate
used gradients and was rejected. The selected regeneration corrected both issues.

## Validation

- File: PNG, 2048 x 1152
- Direct inspection: passed text, node count, edge direction, and no-proxy boundary checks
- AnyCap image-read: unavailable after two bounded retries returned a service-side internal error
- Sensitive information review: passed
