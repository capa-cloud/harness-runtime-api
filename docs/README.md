# Documentation Map

Current protocol version: `2026-09-01`

## Start Here

| Need | Document |
| --- | --- |
| Run the reference server | [Quickstart](tutorials/quickstart.md) |
| Integrate over HTTP/SSE | [OpenAPI 3.1](../spec/openapi.yaml) |
| Understand lifecycle semantics | [Protocol](../spec/protocol.md) |
| Review state and invariants | [Runtime model](../spec/runtime-model.md) |
| Implement Artifact handling | [Artifact descriptors](guides/artifacts.md) |
| Configure the DSH adapter | [DeepSeek Harness Provider](guides/dsh-provider.md) |
| Compare neighboring protocols | [Protocol stack](explanations/protocol-stack.md) |
| Review architecture decisions | [Specification index](../spec/README.md) |
| Review deployment risk | [Security policy](../SECURITY.md) |

## Source of Truth

- Zod schemas in `packages/protocol` are the executable portable contract.
- `spec/openapi.yaml` is the HTTP binding.
- `spec/protocol.md` and `spec/runtime-model.md` define portable behavior and invariants.
- Provider guides document adapter-specific support and degradation.
- Generated images explain the model but never override schemas or normative text.
