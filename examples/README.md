# Runnable Examples

Requirements: Node.js 22+, pnpm 10, a clean checkout, and no model credentials.

```bash
pnpm install --frozen-lockfile
pnpm build
node examples/provider.mjs
```

The provider example implements the existing SPI, declares only the capabilities it implements, and
passes the reusable lifecycle conformance probe before starting an embedded execution.

For the HTTP application example, start the reference server in another terminal:

```bash
pnpm dev
```

Then run:

```bash
node examples/application.mjs
```

The application uses synthetic input, responds to a Mock approval, checks the terminal state,
lists one Artifact descriptor, and replays the terminal event. Set `RUNTIME_URL` only to a server
you own. The example approves its synthetic Mock action; real applications must apply their own
human approval and authorization policy.

The DSH wire integration suite uses the pinned public SDK and a synthetic JSON-RPC peer:

```bash
pnpm test:integration
```

It verifies handshake, streaming, cancellation, subprocess exit, and environment isolation. It
does not call a model, establish native sandbox support, or test a complete DSH runtime composition.

For a native runtime you own, build the project and explicitly configure the opt-in probe:

```bash
DSH_COMMAND=node DSH_ARGS_JSON='["path/to/dsh-runtime.js","path/to/cordis.yml"]' \
  DSH_ENV_KEYS_JSON='["PATH","DEEPSEEK_API_KEY"]' node scripts/probe-dsh.mjs
```

The example names environment variables only; obtain their values through your credential manager.
The probe copies only the named variables and prints check names/booleans, never native errors,
prompts, output, paths, or credential values. It has bounded execution and cleanup waits. This
command is not run by default tests or CI and may contact a model when the selected composition does.
