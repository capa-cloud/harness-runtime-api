# DeepSeek Harness Provider

Read the [portable and provider-native boundary](../explanations/provider-boundary.md) before mapping
additional DSH notifications into portable events.

The DSH provider is an optional adapter for the public `@deepseek-ai/dsh-sdk-client` package. It runs
one DSH subprocess per portable execution and translates DSH notifications into portable events.

As of 2026-10-09, the tested SDK is exactly `0.1.0-rc.7`. The adapter checks the installed version
before constructing a default client. Later prereleases have a different launcher API and are not
covered by this adapter's compatibility claim. See the
[public SDK source](https://github.com/deepseek-ai/deepseek-harness/tree/master/packages/sdk/client)
and the pinned package's bundled README rather than assuming the current upstream launcher matches
this release.

The adapter passes an explicit environment object to the DSH SDK. Deployments should construct that
object from an allowlist and verify the subprocess behavior of the selected SDK version.

```ts
import { DshProvider } from '@harness-runtime/provider-dsh'

const provider = new DshProvider({
  launch: {
    command: 'node',
    args: ['path/to/dsh-runtime.js', 'path/to/cordis.yml'],
    env: allowlistedProviderEnvironment(),
  },
  modelProvider: 'deepseek-official',
  model: 'deepseek-v4-flash',
  // Declare only extensions verified in the selected native runtime composition.
  extensions: ['extension.skills'],
})
```

`allowlistedProviderEnvironment()` is an application-owned helper in this example. It should return
only the variables required by the selected provider, never the complete parent environment.

`extension.mcp`, `extension.sandbox`, `extension.skills`, and `extension.subagents` default to
`unsupported`. A trusted deployment may explicitly declare the extensions its runtime composition
provides. This is a deployment assertion, not sandbox certification by the adapter. Extension
declarations are instance-local and do not alter other registered providers.

Launch options are copied at construction. Per-execution `config` must be empty: requests cannot
override the command, working directory, environment, model, or shutdown policy. Configure those
values through the trusted Provider constructor.

## Reproducible Verification

```bash
pnpm install --frozen-lockfile
pnpm test:integration
```

The integration suite uses the actual pinned SDK against a synthetic local JSON-RPC subprocess. It
verifies initialization, inbox receipt, text notifications, final output, startup failure, transport
failure, cancellation, process exit, and a non-inherited environment. No model or private platform
is contacted. `pnpm check` includes these credential-free integration checks.

This evidence proves SDK/transport integration. It does not prove a complete native Harness
composition, model quality, tool correctness, or isolation. Native deployments must separately
verify their executable, composed extensions, environment allowlist, and sandbox.

The pinned SDK owns activity from an inbox receipt until whole-agent idle. A portable `succeeded`
outcome means that SDK interval and cleanup completed normally; it does not certify that the model
fulfilled the business task. Native model/tool outcomes remain in `provider.event`, and final output
may be empty if the native interval committed no assistant message.

## MVP Limitations

- Consumers install the pinned DSH SDK client separately; the repository includes it as a test-only
  development dependency.
- Cancellation closes the per-execution DSH subprocess because the current DSH SDK wire has no
  mid-turn cancel method.
- Abort, explicit cancellation, and final cleanup share one idempotent close operation per process.
- DSH checkpoint portability and cross-process conversation continuity are not advertised.
- Native DSH events are preserved under `provider.event`; recognized text deltas are also normalized.
- No live provider test runs in the default suite or requires a model credential.
