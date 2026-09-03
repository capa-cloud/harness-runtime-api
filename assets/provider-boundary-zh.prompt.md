# Provider Boundary (Chinese)

- Date: 2026-09-03
- Producer: AnyCap
- Model: GPT Image 2
- Mode: text-to-image after a two-model comparison
- Output: `assets/provider-boundary-zh.png`
- Assurance class: T1 validated explanation

## Fact Graph

- Portable boundary: Conversation 身份、Execution 状态、有序事件、Action 关联、Artifact 描述符、
  必需能力。
- Provider-native boundary: 原生 Session、Agent Loop、模型/工具调用、进程生命周期、Provider 事件。
- Provider SPI 向右映射命令，向左规范化事件。
- Forbidden: 绕过 SPI，声称 Native 行为或 Checkpoint 可移植。

## Validation

- File: PNG, 2048 x 1152
- Candidate comparison: Nano Banana 2 rejected for gradient-heavy styling
- Direct inspection: passed
- AnyCap image-read: passed row count, containment, text, and direction checks
- Sensitive information review: passed
