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

The ACP adapter uses a copied allowlist environment and direct argv launch. Client-side filesystem
and terminal capabilities are disabled; this does not constrain an agent process's own OS access.
Permission grants require explicit approval and remembered grants require an explicit option ID.
Inbound protocol envelopes are validated before SDK routing to avoid raw diagnostic logging.
Apply a deployment-owned sandbox and policies for native events before using real agents.

## Dependency Gate

`pnpm security:audit` checks the complete dependency graph, including development tooling, and
fails on moderate-or-higher advisories. `pnpm check` invokes it, so existing CI covers both runtime
and build/test dependencies. Registry/network failures also fail the command; a production-only
audit is not an equivalent substitute.

The workspace pins the patched `source-map-js@1.2.2` through a targeted override for
[GHSA-68fv-2mgg-jv7q](https://github.com/advisories/GHSA-68fv-2mgg-jv7q).
Keep the override, frozen lockfile, and regression checks aligned when changing this policy.

## Data Handling Checklist

- Authenticate callers and authorize each Conversation, Execution, Event, Action, and Artifact
  operation before exposing the reference API to untrusted users. Resource IDs are not credentials.
- Inputs, outputs, native events, Provider errors, and Artifact URIs can contain sensitive data.
  Restrict access and apply explicit redaction before external logging or export.
- Limit request size, execution concurrency, event volume, and retention at the deployment boundary.
  In-memory reference collections are not a bounded retention or deletion policy.
- Isolate the agent's OS privileges, workspace, and network access. Disabling ACP client methods
  and using direct argv launch do not sandbox the native process.
- Review both visible image content and metadata, including C2PA/JUMBF containers, before publishing
  generated media. Content credentials are provenance metadata, not proof of privacy or safe content.
