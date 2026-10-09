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

DSH process launch and model options belong to the trusted constructor; execution requests cannot
override them. Native runtime extensions are explicit deployment declarations and do not imply
verified sandbox isolation. The runtime validates Provider emissions and prevents a Provider from
reporting portable success while a human Action remains unresolved.

Provider-native events and errors can contain prompt, tool, file, and process output. Deployments
must restrict access to them and apply their own redaction policy before logging or exporting them.
The reference implementation does not write execution transcripts to disk or log request bodies.

`pnpm sanitize` uses ripgrep when available and a grep fallback otherwise. Scanner/tool errors fail
the check. Matches list file names only; suspected credential values are never printed by the scanner.
