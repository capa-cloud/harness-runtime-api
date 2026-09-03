# Provider Boundary (English)

- Date: 2026-09-03
- Producer: AnyCap
- Model: GPT Image 2
- Mode: text-to-image after a two-model comparison
- Output: `assets/provider-boundary-en.png`
- Assurance class: T1 validated explanation

## Fact Graph

- Portable boundary: conversation identity, execution state, ordered events, action correlation,
  Artifact descriptors, and required capabilities.
- Provider-native boundary: native session, agent loop, model/tool calls, process lifecycle, and
  provider events.
- Provider SPI maps commands left-to-right and normalizes events right-to-left.
- Forbidden: bypassing the SPI, claiming native behavior or checkpoints are portable.

## Validation

- File: PNG, 2048 x 1152
- Candidate comparison: Nano Banana 2 rejected for gradients and bridge overlap
- Direct inspection: passed
- AnyCap image-read: passed row count, containment, text, and direction checks
- Sensitive information review: passed
