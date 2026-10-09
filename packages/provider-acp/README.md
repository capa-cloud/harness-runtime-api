# ACP v1 Provider

Subprocess adapter built on the public `@agentclientprotocol/sdk` `1.7.0` stable v1 entry point.
It maps assistant text updates and native permission requests into the portable Runtime contract.

The trusted constructor owns executable, arguments, working directory, environment, timeouts, and
message limits. Execution requests cannot override those values. Each execution owns one process
and a fresh native session; conversation continuity and checkpoint portability are not advertised.

Permission requests become correlated approval Actions. Approve-once selects `allow_once` only;
`allow_always` requires an explicit option ID and `approved: true`. Invalid or contradictory choices
are cancelled. Concurrent requests are serialized into the Runtime's single pending Action slot.

Client filesystem and terminal capabilities are disabled and no handlers implement them. Native
agent processes retain their own operating-system privileges, so this is not sandbox isolation.
Cancellation uses a native notification followed by bounded owned-process teardown.

See the [integration guide](../../docs/guides/acp-provider.md) for usage and verification boundaries.
