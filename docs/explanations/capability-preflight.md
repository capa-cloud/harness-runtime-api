# Capability Preflight

Status: current

Protocol version: `2026-09-02`

![Capability preflight decision flow from manifest inspection to provider start or rejection.](../../assets/capability-preflight-en.svg)

Each Provider Manifest maps capability names to one support level:

- `native`: implemented by the provider;
- `emulated`: supplied by the adapter or runtime;
- `degraded`: available with documented semantic limits;
- `unsupported`: unavailable.

Before starting provider work, Runtime checks every name in `requiredCapabilities`. A present
`native`, `emulated`, or `degraded` capability passes. An absent or `unsupported` capability returns
`422 CAPABILITY_UNSUPPORTED`; no provider work starts.

Runtime intentionally does not accept a required minimum support level in the MVP request. A caller
that rejects `emulated` or `degraded` behavior must inspect the manifest and apply that policy before
starting the execution.
