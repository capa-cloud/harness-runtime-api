# Harness Runtime API Architecture Image

- Date: 2026-08-19
- Producer: AnyCap
- Model: GPT Image 2
- Mode: image-to-image final repair after a two-model comparison
- Output: `assets/harness-runtime-architecture.png`
- Assurance class: T1 validated explanation
- Reading order: left to right, with one event feedback path

## Fact Graph

- Nodes: application/control plane; Harness Runtime API with conversation, execution, event stream,
  and human action; Provider SPI with capability preflight and execution adaptation; Mock, DSH, and
  custom Harness providers.
- Forward edges: application to runtime; runtime to Provider SPI; Provider SPI to three peer
  providers.
- Feedback edge: Provider SPI to runtime for normalized events.
- Independent set: Mock, DSH, and custom Harness providers.
- Forbidden semantics: provider ordering, provider-specific event feedback, invented nodes, logos,
  watermarks, private infrastructure, or company identifiers.

## Generation Prompt

Create a clean, white, 16:9 technical architecture diagram for an open-source GitHub README. Use a
single left-to-right reading path. Show an application/control plane, a central Harness Runtime API
boundary, a Provider SPI boundary, and three peer providers: Mock, DSH, and a custom Harness. Keep
the runtime capabilities and Provider SPI capabilities visibly contained. Use restrained blue and
amber accents, flat lines, short Simplified Chinese labels, and no gradients, logos, pseudo-text,
watermarks, dashboard chrome, or decorative card wall.

## Validation

- File: PNG, 2048 x 1152
- Direct inspection: passed at original and README scale
- AnyCap image-read: passed full node, edge, containment, text, and independence checks
- Sensitive information review: passed
- Rejected candidate: incorrect capability-to-provider edge semantics
- Final repair: moved event feedback from one provider to the Provider SPI boundary
