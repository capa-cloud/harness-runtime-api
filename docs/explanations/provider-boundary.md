# Portable and Provider-Native Boundary

Status: current

Protocol version: `2026-09-02`

![Provider SPI separates stable portable lifecycle semantics from provider-native harness behavior.](../../assets/provider-boundary-en.png)

Harness Runtime API does not make harness implementations identical. It makes their integration
differences explicit and negotiable.

## Portable Contract Owns

- caller-facing Conversation identity;
- Execution state and terminal outcome;
- event sequence, replay cursor, and portable event meaning;
- Action identity and response correlation;
- validated Artifact descriptors;
- required capability names and support levels.

## Provider-Native Runtime Owns

- native sessions and checkpoints;
- the internal agent loop and prompting strategy;
- model, tool, MCP, Skill, and subagent implementation;
- subprocess, embedded, or remote lifecycle behavior;
- native observations that remain under `provider.event`.

## Provider SPI Maps

Commands move from the portable side into a native execution. Provider observations move back as
portable events or explicitly namespaced provider events. An adapter must declare `native`,
`emulated`, `degraded`, or `unsupported` support instead of silently inventing equivalent behavior.

Portable state does not imply portable model behavior or provider checkpoint compatibility.
