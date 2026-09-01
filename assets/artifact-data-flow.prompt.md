# Artifact Data Flow Image

- Date: 2026-09-01
- Producer: AnyCap
- Model: GPT Image 2
- Mode: text-to-image after a two-model comparison
- Output: `assets/artifact-data-flow.png`
- Assurance class: T1 validated explanation
- Reading order: left to right, with a separate deployment-owned content path

## Fact Graph

- Nodes: Harness Provider; Harness Runtime API containing descriptor validation, event recording,
  and descriptor storage; application/control plane; deployment-owned Artifact Store.
- Descriptor edges: provider to runtime; runtime to application through two peer outputs, SSE events
  and the Artifact list.
- Content edges: provider to Artifact Store; Artifact Store to application.
- Forbidden edges: runtime to Artifact Store; artifact bytes through the runtime; application writes
  to the store.

## Generation Prompt

Create a clean, white, 16:9 technical data-flow diagram for an open-source GitHub document. Show a
left-to-right descriptor flow from a Harness Provider through the Harness Runtime API to an
application/control plane. Inside the runtime show descriptor validation, event recording, and
descriptor storage. Show SSE events and the Artifact list as peer outputs. In a separate lower lane,
show artifact bytes moving from the provider to a deployment-owned Artifact Store and authorized
reads moving from that store to the application. State that the runtime does not proxy content. Use
short Simplified Chinese labels, restrained blue and amber accents, and no gradients, logos,
watermarks, provider icons, or private infrastructure.

## Validation

- File: PNG, 2048 x 1152
- Direct inspection: passed at original size
- AnyCap image-read: passed text, node, edge-direction, containment, and peer-output checks
- Sensitive information review: passed
- Rejected candidate: reversed the authorized content-read direction
