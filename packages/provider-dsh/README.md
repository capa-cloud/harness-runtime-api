# DeepSeek Harness Provider

Optional subprocess adapter for exactly `@deepseek-ai/dsh-sdk-client` `0.1.0-rc.7`.

The dependency is loaded only when the provider starts an execution. Unit tests use an injected
structural client and never invoke a model or require a credential.

See the [integration guide](../../docs/guides/dsh-provider.md) for limitations and configuration.

The default client requires exactly SDK `0.1.0-rc.7`. Optional native runtime extensions are
unsupported unless explicitly declared by the trusted deployment. Execution requests cannot
override trusted process or model configuration.
