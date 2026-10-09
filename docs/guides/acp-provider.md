# ACP v1 Provider

As of 2026-10-09. SDK version: `1.7.0`, stable ACP v1 entry point.

The adapter connects a trusted ACP executable through the official TypeScript SDK. It does not
use the experimental v2 protocol, implement an agent loop, or require a model credential by itself.

```ts
import { AcpProvider } from '@harness-runtime/provider-acp'

const provider = new AcpProvider({
  command: 'path/to/your-acp-agent',
  args: ['--acp'],
  cwd: 'path/to/isolated-workspace',
  env: allowlistedAgentEnvironment(),
  initializationTimeoutMs: 10_000,
  runTimeoutMs: 300_000,
  shutdownGraceMs: 500,
  maxMessageBytes: 1_048_576,
})
```

`allowlistedAgentEnvironment()` is application-owned; the default environment is empty. Prefer an
absolute executable path. Arguments are passed directly without a shell. Constructor arguments and
environment are copied, while per-execution `config` must remain empty. Register multiple native
agents with distinct trusted `id` values rather than letting requests select arbitrary executables.

## Mapping

| ACP surface | Portable behavior |
| --- | --- |
| Initialization and new session | One fresh native session per execution |
| Assistant text chunks | `output.text.delta`; concatenated assistant text becomes final output |
| Other session updates | Namespaced `provider.event` observations |
| Permission request | `action.required`, awaiting approval, then a correlated response |
| Prompt result | Native stop reason retained under `provider.event` |
| Native cancellation | Hint plus bounded EOF/SIGTERM/SIGKILL teardown; advertised as emulated |
| Client filesystem and terminal | Disabled capabilities and no registered handlers |
| Artifacts, user input, continuity, native extensions | Unsupported by this adapter |

The [official prompt-turn contract](https://agentclientprotocol.com/protocol/v1/prompt-turn) separates
session updates from prompt completion. A portable success means the native turn and teardown
completed normally, not that the agent fulfilled the business task. Non-text content stays in
native events; the adapter never fetches files or converts tool output into Artifact descriptors.

## Human Permissions

The [official permission contract](https://agentclientprotocol.com/protocol/v1/tool-calls) distinguishes
one-time decisions from remembered decisions. This adapter never silently expands an approval:

- `{ approved: true }` selects an available `allow_once` option, otherwise cancels.
- `{ approved: false }` selects an available `reject_once` option, otherwise cancels.
- An explicit option may be supplied as `value: { optionId: "..." }` or a string ID. Grant options
  also require `approved: true`; contradictory, unknown, malformed, or ambiguous choices cancel.
- `allow_always` is honored only when that specific option was explicitly selected and approved.
- Cancellation answers pending requests with a cancelled outcome before process teardown.

The application supplies business approval policy. The adapter serializes concurrent permissions
but does not automatically approve them. Remembered decisions are owned by the native agent, not a
portable permission store.

## Security Boundary

The adapter rejects unrelated-session updates, bounds inbound message size and run duration,
discards stderr, and returns generic request errors instead of forwarding native diagnostics.
Native updates may still contain sensitive tool or file information; restrict access and redact
before exporting those events. These protections do not isolate the native process's filesystem,
network, subprocesses, or descendants. Use a deployment-owned sandbox and least-privilege account.

The process teardown confirms the direct owned child's exit and transport closure. It does not
certify that every descendant, remote request, or native side effect has stopped.

## Verification

```bash
pnpm test:integration
```

Credential-free tests use the actual public SDK on both sides of a real subprocess connection.
They cover text normalization, environment isolation, permission choices and cancellation,
concurrent permission requests, forced exit, malformed peers, unrelated sessions, message limits,
and denied client file/terminal access. No private platform or model endpoint is contacted.

This proves adapter/protocol behavior against a synthetic Agent. Verify each real executable's
authentication, tool policy, native isolation, and model behavior separately before deployment.
