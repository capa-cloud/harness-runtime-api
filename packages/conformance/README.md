# Provider Conformance

The conformance runner executes one bounded turn and verifies portable lifecycle invariants. It is
an embeddable check, not a certification program.

`timeoutMs` bounds the execution probe (default: 10,000 ms). If a probe stops before reaching a
terminal state, the runner aborts its event subscription and requests execution cancellation.
`cleanupTimeoutMs` bounds that cleanup wait separately (default: 1,000 ms). Cleanup failures or
timeouts add a failed `execution-cleanup` check alongside the original probe failure.

A cleanup timeout bounds the test runner's wait; it cannot force an uncooperative provider process
to stop. Providers must implement their own bounded shutdown and respond to the abort signal.

Every successful probe checks idempotency reuse/conflict, contiguous events, cursor replay, exactly
one matching terminal event, final-output semantics, and Artifact/event correlation. For advertised
capabilities, supply a provider-owned scenario through `config`, `requiredCapabilities`, and optional
`actionResponse`, `cancelAfterEvent`, `expectedState`, or `expectedArtifacts`:

```ts
const report = await runProviderConformance(new MockProvider(), {
  requiredCapabilities: ['action.approval'],
  config: { requireApproval: true },
  actionResponse: { approved: true },
})
```

`actionResponse` is explicit synthetic test policy, not production auto-approval. A cancellation
scenario must keep native work active until the selected event is observed; a Provider that finishes
first fails the expected-state check. The runner does not infer how to trigger a native capability or
certify every manifest entry from one happy-path probe. Provider repositories should separately test
native recovery, tool permissions, and security behavior advertised by their manifest.
