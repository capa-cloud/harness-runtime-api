# Production Boundary (Chinese)

- Date: 2026-09-03
- Producer: AnyCap
- Model: GPT Image 2
- Mode: text-to-image after a two-model comparison
- Output: `assets/production-boundary-zh.png`
- Assurance class: T1 validated explanation

## Fact Graph

- 参考 MVP: Loopback HTTP 服务、内存状态、Mock Provider、单进程。
- 不变 Portable Contract: Execution/Event、能力预检、Action/Artifact。
- 生产部署增加: 可信网关、持久化存储、调度器/Worker、Provider 隔离、遥测、Artifact Store。
- Forbidden: 箭头或迁移顺序；把生产能力放入 Portable Contract。

## Validation

- File: PNG, 2048 x 1152
- Candidate comparison: Nano Banana 2 rejected for gradient-heavy styling
- Direct inspection: passed
- AnyCap image-read: passed all column counts, labels, and boundary checks
- Sensitive information review: passed
