# Harness Runtime API

<p align="center">
  <strong>English</strong> | <a href="README.zh-CN.md">简体中文</a>
</p>

Harness Runtime API is a provider-neutral contract for starting, observing, controlling, and
recovering AI agent harness executions. Applications integrate with one stable lifecycle while
runtime providers adapt frameworks such as DeepSeek Harness or an application-specific agent loop.

The project is an early MVP. It standardizes integration semantics, not model behavior or portable
checkpoints.

## Why

Agent harnesses expose similar concepts through incompatible APIs: sessions, streaming events,
human approval, cancellation, artifacts, and recovery. This project separates those concepts into:

- a versioned protocol and state machine;
- a provider SPI with explicit capability negotiation;
- an embeddable in-memory runtime;
- an optional HTTP/SSE server;
- client SDKs and provider conformance checks.

```text
Application or control plane
            |
   Harness Runtime API
            |
  +---------+----------+
  |         |          |
 Mock      DSH       Custom
Provider  Provider   Provider
```

## MVP Features

- Conversations and bounded executions
- Append-only events with monotonic cursors
- Explicit execution state machine
- Provider capability manifests and required-capability preflight
- Idempotent execution creation
- Cancellation and human action responses
- HTTP JSON API and resumable SSE stream
- TypeScript client SDK
- Mock provider and optional DeepSeek Harness adapter
- Reusable provider conformance runner

## Quick Start

Requirements: Node.js 22 or later and pnpm 10.

```bash
pnpm install
pnpm check
pnpm dev
```

The reference server listens on `127.0.0.1:4310` by default. It is intentionally unauthenticated
and must not be exposed to an untrusted network.

```bash
curl -s http://127.0.0.1:4310/v1/runtime

curl -s -X POST http://127.0.0.1:4310/v1/conversations \
  -H 'content-type: application/json' \
  -d '{"metadata":{"example":"quickstart"}}'
```

See [Quickstart](docs/tutorials/quickstart.md) for a complete execution and SSE example.

## Packages

| Package | Purpose |
| --- | --- |
| `@harness-runtime/protocol` | Schemas, types, events, and capability vocabulary |
| `@harness-runtime/core` | Provider SPI and in-memory reference runtime |
| `@harness-runtime/provider-mock` | Deterministic provider for development and tests |
| `@harness-runtime/provider-dsh` | Optional DeepSeek Harness subprocess adapter |
| `@harness-runtime/server` | HTTP/SSE reference server |
| `@harness-runtime/sdk-typescript` | TypeScript HTTP client |
| `@harness-runtime/conformance` | Provider lifecycle conformance runner |

Package names are workspace identifiers during the MVP and are not yet published to a package
registry.

## Protocol Boundaries

- MCP connects a harness to tools and context.
- ACP connects coding-agent clients and agents.
- AG-UI can project execution events into a frontend.
- A2A connects independent agents.
- Harness Runtime API connects a control plane or application to a harness execution provider.

See [Runtime model](spec/runtime-model.md) and [Protocol](spec/protocol.md) for normative behavior.

## Security

The reference runtime is not a multi-tenant platform. Authentication, authorization, credential
brokering, durable distributed scheduling, sandbox isolation, and long-term memory remain deployment
responsibilities. See [SECURITY.md](SECURITY.md).

## Status

Version `0.1.0` is experimental. Backward compatibility is not guaranteed before `1.0.0`.

## License

Apache License 2.0.
