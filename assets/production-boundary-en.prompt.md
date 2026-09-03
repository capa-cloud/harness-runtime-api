# Production Boundary (English)

- Date: 2026-09-03
- Producer: AnyCap
- Model: GPT Image 2
- Mode: text-to-image after a two-model comparison
- Output: `assets/production-boundary-en.png`
- Assurance class: T1 validated explanation

## Fact Graph

- Reference MVP: loopback HTTP server, in-memory state, Mock Provider, single process.
- Invariant portable contract: executions/events, capability preflight, actions/Artifacts.
- Production deployment additions: trusted gateway, durable store, scheduler/workers, provider
  isolation, telemetry export, Artifact Store.
- Forbidden: arrows or migration sequence; production concerns inside the portable contract.

## Validation

- File: PNG, 2048 x 1152
- Candidate comparison: Nano Banana 2 rejected for gradient-heavy styling
- Direct inspection: passed
- AnyCap image-read: passed all column counts, labels, and boundary checks
- Sensitive information review: passed
