# Provider Conformance

The conformance runner executes one synthetic turn and verifies portable lifecycle invariants. It is
an embeddable check, not a certification program.

`timeoutMs` bounds the execution probe (default: 10,000 ms). If a probe stops before reaching a
terminal state, the runner aborts its event subscription and requests execution cancellation.
`cleanupTimeoutMs` bounds that cleanup wait separately (default: 1,000 ms). Cleanup failures or
timeouts add a failed `execution-cleanup` check alongside the original probe failure.

A cleanup timeout bounds the test runner's wait; it cannot force an uncooperative provider process
to stop. Providers must implement their own bounded shutdown and respond to the abort signal.

Provider repositories should add their own tests for cancellation, actions, artifacts, recovery, and
security behavior advertised by their manifest.
