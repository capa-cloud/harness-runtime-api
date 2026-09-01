# Harness Runtime Architecture (English)

- Date: 2026-09-01
- Producer: AnyCap
- Model: GPT Image 2
- Mode: image-to-image final text repair after a two-model comparison
- Output: `assets/harness-runtime-architecture-en.png`
- Assurance class: T1 validated explanation
- Reading order: left to right, with one normalized-event feedback path

## Fact Graph

- Nodes: application/control plane; Harness Runtime API containing conversations, executions, event
  stream, and human actions; Provider SPI containing capability preflight and execution adapter;
  Mock Provider, DSH Provider, and Custom Harness as peers.
- Forward edges: application to runtime; runtime to Provider SPI; Provider SPI to each peer provider.
- Feedback edge: Provider SPI to runtime for normalized events.
- Forbidden semantics: provider ordering, provider-specific feedback, invented nodes, private
  infrastructure, logos, or gradients.

## Generation Summary

The source prompt requested a flat white 16:9 architecture diagram with an exhaustive English text
whitelist and exact node, containment, peer, and edge relationships. A second model candidate was
rejected for gradient-heavy styling. The selected candidate received one local repair that changed
the misspelled lower branch label from `Adat` to `Adapt` without changing topology.

## Validation

- File: PNG, 2048 x 1152
- Direct inspection: passed at original size
- AnyCap image-read: passed text, containment, peer-provider, and edge-direction checks
- Sensitive information review: passed
