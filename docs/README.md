# Documentation Map

Current protocol version: `2026-09-02`

## Choose a Path

| Goal | Read in order |
| --- | --- |
| Evaluate the project | [Main README](../README.md) → [Provider boundary](explanations/provider-boundary.md) → [Production boundary](guides/production-deployment.md) |
| Integrate an application | [Quickstart](tutorials/quickstart.md) → [Execution control loop](explanations/execution-control-loop.md) → [OpenAPI 3.1](../spec/openapi.yaml) |
| Build a Provider | [Provider boundary](explanations/provider-boundary.md) → [Capability preflight](explanations/capability-preflight.md) → [Conformance package](../packages/conformance/README.md) |
| Operate safely | [Production boundary](guides/production-deployment.md) → [Security policy](../SECURITY.md) → [Release process](../RELEASING.md) |

## Document Index

| Need | Document |
| --- | --- |
| Run the reference server | [Quickstart](tutorials/quickstart.md) |
| Run an application or implement a Provider | [Runnable examples](../examples/README.md) |
| Review delivery acceptance and remaining work | [Delivery plan](development/delivery-plan.md) |
| Integrate over HTTP/SSE | [OpenAPI 3.1](../spec/openapi.yaml) |
| Understand lifecycle semantics | [Protocol](../spec/protocol.md) |
| Review state and invariants | [Runtime model](../spec/runtime-model.md) |
| Implement Artifact handling | [Artifact descriptors](guides/artifacts.md) |
| Configure the DSH adapter | [DeepSeek Harness Provider](guides/dsh-provider.md) |
| Configure an ACP executable | [ACP v1 Provider](guides/acp-provider.md) |
| Compare neighboring protocols | [Protocol stack](explanations/protocol-stack.md) |
| Understand execution transitions | [Execution lifecycle](explanations/execution-lifecycle.md) |
| Understand one complete run | [Execution control loop](explanations/execution-control-loop.md) |
| Understand capability rejection | [Capability preflight](explanations/capability-preflight.md) |
| Separate portable and native ownership | [Provider boundary](explanations/provider-boundary.md) |
| Plan a production deployment | [Production boundary](guides/production-deployment.md) |
| Review architecture decisions | [Specification index](../spec/README.md) |
| Review deployment risk | [Security policy](../SECURITY.md) |
| Audit visual provenance | [Visual asset index](../assets/README.md) |
| Review release history | [Changelog](../CHANGELOG.md) |
| Prepare a release | [Release process](../RELEASING.md) |

## Source of Truth

- Zod schemas in `packages/protocol` are the executable portable contract.
- `spec/openapi.yaml` is the HTTP binding.
- `spec/protocol.md` and `spec/runtime-model.md` define portable behavior and invariants.
- Provider guides document adapter-specific support and degradation.
- Generated images explain the model but never override schemas or normative text.
