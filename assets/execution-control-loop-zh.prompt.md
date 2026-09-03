# Execution Control Loop (Chinese)

- Date: 2026-09-03
- Producer: AnyCap
- Model: GPT Image 2
- Mode: text-to-image after a two-model comparison
- Output: `assets/execution-control-loop-zh.png`
- Assurance class: T1 validated explanation

## Fact Graph

- Nodes: 调用方；包含启动/预检、有序事件、Action 关联的 Runtime；包含原生 Agent Loop 的
  Provider；终态结果。
- Commands: 调用方到 Runtime；Runtime 到 Provider。
- Observations: Provider 到 Runtime；Runtime 到调用方；Runtime 到终态结果。
- Human loop: Runtime 请求 Action；调用方响应同一次 Runtime 执行。
- Forbidden: Action 响应反向、新建第二次执行、Provider 绕过 Runtime、发明存储。

## Validation

- File: PNG, 2048 x 1152
- Candidate comparison: Nano Banana 2 rejected for gradient-heavy styling
- Direct inspection: passed
- AnyCap image-read: passed all text, node, and edge-direction checks
- Sensitive information review: passed
