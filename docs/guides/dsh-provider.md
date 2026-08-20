# DeepSeek Harness Provider

The DSH provider is an optional adapter for the public `@deepseek-ai/dsh-sdk-client` package. It runs
one DSH subprocess per portable execution and translates DSH notifications into portable events.

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
})
```

`allowlistedProviderEnvironment()` is an application-owned helper in this example. It should return
only the variables required by the selected provider, never the complete parent environment.

## MVP Limitations

- Requires the DSH SDK client to be installed separately.
- Cancellation closes the per-execution DSH subprocess because the current DSH SDK wire has no
  mid-turn cancel method.
- Abort, explicit cancellation, and final cleanup share one idempotent close operation per process.
- DSH checkpoint portability and cross-process conversation continuity are not advertised.
- Native DSH events are preserved under `provider.event`; recognized text deltas are also normalized.
- No live provider test runs in the default suite or requires a model credential.
