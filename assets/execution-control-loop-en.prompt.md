# Execution Control Loop (English)

- Date: 2026-10-09
- Producer: deterministic SVG after rejected AnyCap candidates
- Output: `assets/execution-control-loop-en.svg`
- Assurance class: T0 exact diagram

## Fact Graph

- Nodes: Caller; Harness Runtime API with start/preflight, ordered events, and action correlation;
  Harness Provider with native agent loop; terminal outcome.
- Commands: Caller to Runtime; Runtime to Provider.
- Observations: Provider to Runtime; Runtime to Caller; Runtime to terminal outcome.
- Human loop: Runtime requests an Action; Caller responds to the same Runtime execution.
- Forbidden: reversed Action response, a second execution, provider-to-caller bypass, invented storage.

## Validation

- File: SVG, 2048 x 1152; labels and all eight connectors are editable source.
- The former PNG was retired after review found a double-headed Action response. The earlier
  direct-inspection and image-read PASS records did not establish correct topology.
- Two fresh AnyCap GPT Image 2 candidates used the same node and edge inventory. Candidate A
  incorrectly emitted the terminal event from Provider; candidate B joined the Provider into the
  terminal path and invented a sequence between Runtime responsibilities. Both were rejected.
- The replacement uses only destination arrowheads. Action response is Caller to Runtime;
  the terminal-event path originates only at Runtime.
- Chrome rendering: inspected at original 2048 x 1152 and consumer 1024 x 576; no clipping,
  overlap, invented connections, or illegible labels.
- AnyCap image-read: PASS; independently enumerated the eight directed edges and single
  destination arrowheads, including Runtime as the sole terminal-event origin.
- Source edge checks and public-content review: passed.
