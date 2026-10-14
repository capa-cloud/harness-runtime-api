# Contributing

## Development

```bash
pnpm install
pnpm check
```

Use Node.js 22 or later. Keep changes scoped to one protocol or provider concern and add tests for
observable behavior.

`pnpm check` includes `pnpm security:audit`, which covers development and production dependencies
at the moderate severity threshold. Registry access is required; advisory-service/network errors
fail the gate rather than silently skipping it. `pnpm test` remains the credential-free local
test command, but does not substitute for the complete check.

## Contract Changes

Public protocol changes must include:

1. the schema or state-machine change;
2. reference runtime behavior;
3. HTTP and SDK updates when affected;
4. conformance coverage;
5. migration or compatibility notes.

Provider-specific features should first be represented as a capability or an extension event. Do not
expand the portable core solely to mirror one framework.

## Pull Requests

- Run `pnpm check` and `pnpm sanitize`.
- Document unsupported or degraded provider behavior.
- Do not include credentials, private infrastructure names, real user data, or proprietary code.
- Update the relevant package README and specification when behavior changes.

Contributions are accepted under the Apache License 2.0.
