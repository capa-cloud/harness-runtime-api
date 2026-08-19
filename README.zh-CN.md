# Harness Runtime API

<p align="center">
  <a href="README.md">English</a> | <strong>简体中文</strong>
</p>

Harness Runtime API 是一套面向 AI Agent Harness 的厂商中立运行时契约，用于统一启动、观察、
控制和恢复 Agent 执行。应用只需对接一套稳定的生命周期接口，不同 Harness 则通过 Provider
适配器接入，例如 DeepSeek Harness 或应用自定义的 Agent Loop。

该项目目前处于早期 MVP 阶段。它标准化的是集成语义，而不是模型行为，也不承诺不同 Harness
之间的检查点可移植性。

![Harness Runtime API 架构：应用与控制面通过统一接口调用运行时，由 Provider SPI 完成能力预检和 Harness 适配，执行事件统一回流。](assets/harness-runtime-architecture.png)

## 为什么需要它

不同 Agent Harness 通常都提供会话、流式事件、人工审批、取消、产物和恢复能力，但 API、状态
语义和事件格式并不一致。Harness Runtime API 将这些共性拆分为：

- 版本化协议和显式执行状态机；
- 带能力协商的 Provider SPI；
- 可嵌入的内存参考运行时；
- 可选的 HTTP/SSE 服务；
- 客户端 SDK 和 Provider 一致性测试。

它的目标不是再实现一个通用 Agent，而是在应用或控制面与具体 Harness 之间建立稳定边界。

## MVP 能力

- 会话与有界执行
- 追加式事件和单调递增游标
- 显式执行状态机
- Provider 能力清单与执行前能力预检
- 幂等执行创建
- 执行取消与人工审批/输入响应
- HTTP JSON API 与支持断点续传的 SSE 事件流
- TypeScript 客户端 SDK
- Mock Provider 与可选的 DeepSeek Harness 适配器
- 可复用的 Provider 一致性测试工具

## 快速开始

环境要求：Node.js 22 或更高版本，pnpm 10。

```bash
pnpm install
pnpm check
pnpm dev
```

参考服务默认监听 `127.0.0.1:4310`。它没有内置身份认证，只适合本地开发，不应直接暴露到
不可信网络。

```bash
curl -s http://127.0.0.1:4310/v1/runtime

curl -s -X POST http://127.0.0.1:4310/v1/conversations \
  -H 'content-type: application/json' \
  -d '{"metadata":{"example":"quickstart"}}'
```

完整的执行与 SSE 示例参见[快速入门](docs/tutorials/quickstart.md)。

## 项目结构

| Package | 作用 |
| --- | --- |
| `@harness-runtime/protocol` | Schema、类型、事件和能力词汇表 |
| `@harness-runtime/core` | Provider SPI 与内存参考运行时 |
| `@harness-runtime/provider-mock` | 用于开发和测试的确定性 Provider |
| `@harness-runtime/provider-dsh` | 可选的 DeepSeek Harness 子进程适配器 |
| `@harness-runtime/server` | HTTP/SSE 参考服务 |
| `@harness-runtime/sdk-typescript` | TypeScript HTTP 客户端 |
| `@harness-runtime/conformance` | Provider 生命周期一致性测试工具 |

MVP 阶段这些名称仅作为 workspace 标识使用，尚未发布到包注册中心。

## 核心设计

### 执行状态

一次 Execution 表示一次有界执行。核心状态包括：

```text
queued -> starting -> running
                       |-> awaiting_input -> running
                       |-> awaiting_approval -> running
                       |-> cancelling -> cancelled
                       |-> succeeded
                       |-> failed
```

终态为 `succeeded`、`failed` 和 `cancelled`。进入终态后不能回到非终态。

### 能力协商

每个 Provider 必须通过 Manifest 声明能力支持等级：

- `native`：Provider 原生支持；
- `emulated`：由适配器模拟；
- `degraded`：可以运行，但语义有所降级；
- `unsupported`：不支持。

调用方可以声明 `requiredCapabilities`。运行时会在启动 Provider 之前完成预检，避免执行到一半
才发现关键能力缺失。

### 事件与恢复

每次执行的事件都按连续序号追加。客户端可以通过游标重放历史事件，并在同一个接口上继续接收
SSE 实时事件。跨重连采用至少一次投递语义，客户端应使用 `(executionId, sequence)` 去重。

## 与其他协议的边界

- MCP 连接 Harness 与工具、数据和上下文；
- ACP 连接 Coding Agent 客户端与 Agent；
- AG-UI 可以将执行事件投射到前端界面；
- A2A 连接相互独立的 Agent；
- Harness Runtime API 连接应用或控制面与 Harness 执行 Provider。

详细定义参见[运行时模型](spec/runtime-model.md)和[协议说明](spec/protocol.md)。

## 安全边界

参考运行时不是多租户平台。身份认证、权限控制、凭据代理、持久化调度、沙箱隔离、长期记忆和
数据保留策略属于部署层职责。详见 [SECURITY.md](SECURITY.md)。

## 项目状态

当前版本为实验性的 `0.1.0`。在 `1.0.0` 之前不保证向后兼容。

## 许可证

Apache License 2.0。
