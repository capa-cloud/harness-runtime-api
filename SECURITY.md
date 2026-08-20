# Security Policy

## Supported Versions

The project is pre-1.0. Security fixes are applied to the latest release only.

## Reporting a Vulnerability

Use GitHub private vulnerability reporting when it is enabled for the repository. Do not open a
public issue containing exploit details, credentials, private prompts, or user data.

## Deployment Boundary

The reference server is a development implementation. It does not provide authentication,
authorization, tenant isolation, secret storage, network policy, or durable distributed scheduling.
Bind it to loopback unless a trusted gateway supplies those controls.

Reference adapters do not inject credentials automatically. A deployment that passes an environment
to a provider owns allowlisting and redaction, and must verify the subprocess behavior of the
selected provider SDK version.
