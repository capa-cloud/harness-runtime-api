# Protocol Stack

Harness Runtime API complements existing agent protocols:

![Protocol responsibility map showing five complementary protocol concerns without implying a call sequence.](../../assets/protocol-responsibility-en.png)

```text
User interface       AG-UI or application-specific events
Agent peers          A2A
Control plane        Harness Runtime API
Coding client        ACP
Tools and context    MCP
```

An adapter may internally use ACP or a framework SDK, but the portable runtime contract additionally
defines execution idempotency, capability preflight, cursor replay, terminal-state semantics, and
action correlation.

The rows are responsibilities, not a network stack or required request order. One product may use
several of these protocols at the same time.
