# Execution Control Loop (English)

- Date: 2026-09-03
- Producer: AnyCap
- Model: GPT Image 2
- Mode: image-to-image text repair after a two-model comparison
- Output: `assets/execution-control-loop-en.png`
- Assurance class: T1 validated explanation

## Fact Graph

- Nodes: Caller; Harness Runtime API with start/preflight, ordered events, and action correlation;
  Harness Provider with native agent loop; terminal outcome.
- Commands: Caller to Runtime; Runtime to Provider.
- Observations: Provider to Runtime; Runtime to Caller; Runtime to terminal outcome.
- Human loop: Runtime requests an Action; Caller responds to the same Runtime execution.
- Forbidden: reversed Action response, a second execution, provider-to-caller bypass, invented storage.

## Validation

- File: PNG, 2048 x 1152
- Candidate comparison: Nano Banana 2 rejected for reversed Action response
- Final repair: changed one duplicate `Action Required` label to `Action Response`
- Direct inspection: passed
- AnyCap image-read: passed all text, node, and edge-direction checks
- Sensitive information review: passed
