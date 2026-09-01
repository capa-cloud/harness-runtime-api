# Protocol Responsibility Map (Chinese)

- Date: 2026-09-01
- Producer: AnyCap with deterministic text correction
- Model: GPT Image 2
- Mode: text-to-image after a two-model comparison
- Output: `assets/protocol-responsibility-zh.png`
- Assurance class: T1 validated explanation

## Fact Graph

- Peer rows: 界面投射 and AG-UI; Agent 协作 and A2A; Harness 执行控制 and Harness Runtime API;
  Coding Client and ACP; 工具与上下文 and MCP.
- Emphasis: only the Harness Runtime API row.
- Forbidden semantics: arrows, sequence, containment between protocols, replacement claims, invented
  relationships, logos, or gradients.

## Generation Summary

The selected AnyCap candidate had correct rows and layout but rendered `AG-UI` as `AG - UI`. One
deterministic local overlay replaced only that label. A second model candidate was rejected for
gradient-heavy styling.

## Validation

- File: PNG, 2048 x 1152
- Direct inspection: passed at original size
- AnyCap image-read: passed all row, text, no-arrow, and flat-style checks after one transient retry
- Sensitive information review: passed
