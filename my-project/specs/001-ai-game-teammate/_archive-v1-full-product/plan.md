# Implementation Plan: AI 游戏队友（实时语音 AI 队友系统）

**Branch**: `001-ai-game-teammate` | **Date**: 2026-07-22 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/001-ai-game-teammate/spec.md`

**Note**: This template is filled in by the `/speckit-plan` command; its definition describes the execution workflow.

## Summary

构建一个 AI 游戏队友：以独立机器人客户端账号接入《我的世界》Java 版双人合作会话，通过结构化模组接口或视觉解析感知游戏状态，用与人类玩家相同的输入方式操控角色，并与玩家进行低延迟全双工语音对话、战术协作与陪伴闲聊。

技术方案的核心矛盾——FR-007 要求反射级操作 < 100ms、语音交互 < 500ms，但云端多模态大模型（含网络往返）不可能稳定达到这一延迟——通过**本地反射层 + 云端策略层的混合架构**解决：一个运行在贴近 Minecraft 服务器网络位置的轻量 Node.js/TypeScript **Bot Client**（基于 mineflayer 协议库）承担协议连接、反射级动作与掉线重连；一个 Python **Strategy Service** 承担视觉理解、语音管线编排、战术规划与人设对话，通过 Anthropic Claude API（视觉输入 + 工具调用）驱动决策，经 WebSocket 向 Bot Client 下发非反射级指令。由于 Claude API 不提供原生实时语音（speech-to-speech）能力，语音层采用"流式 STT → Claude 流式文本生成 → 流式 TTS"级联管线，通过分段流水线（而非等待完整回复）逼近 500ms 预算。

## Technical Context

<!--
  ACTION REQUIRED: Replace the content in this section with the technical details
  for the project. The structure here is presented in advisory capacity to guide
  the iteration process.
-->

**Language/Version**: TypeScript 5.x / Node.js 20 LTS（Bot Client：Minecraft 协议连接与本地反射层）；Python 3.11+（Strategy Service：视觉/语音/决策编排，调用 Claude API）

**Primary Dependencies**:
- Bot Client（Node/TS）：`mineflayer`（Minecraft Java 版协议兼容机器人客户端库）、`mineflayer-pathfinder`（寻路/移动）、`mineflayer-pvp`（近战辅助）、`ws`（与 Strategy Service 的 WebSocket 连接）
- Strategy Service（Python）：`anthropic`（Claude API 官方 SDK，用于视觉理解 + 工具调用 + 对话生成）、`fastapi` + `uvicorn`（对外服务，WebSocket/HTTP 端点）、流式 STT/TTS 客户端 SDK（具体厂商见 research.md，选型标准为支持流式部分结果、WebSocket/gRPC 接口、端到端延迟可控在 200ms 量级）
- 玩家端语音采集/播放：WebRTC 或 WebSocket 音频流（浏览器/游戏内叠加层，具体形式见 research.md）

**Storage**: MVP（User Story 1/2）阶段无需持久化存储，游戏状态快照/语音回合/战术指令均为会话内瞬态内存状态；User Story 2 后期起为支持 FR-018（跨会话战术偏好记忆）引入轻量文档存储（如 Redis 持久化或 SQLite/PostgreSQL），具体选型延后到该增量的任务阶段决定

**Testing**: Node/TS 层用 Vitest 做 Bot Client 单元测试，对本地 Minecraft 测试服（Docker 化的 Paper/Vanilla 服务端）做集成测试；Python 层用 pytest，Claude API 调用在测试中用 SDK 提供的 mock/固定响应替身，STT/TTS 同样替身化；端到端验证脚本对照 spec.md 的 Acceptance Scenarios 驱动一次完整人机协作会话并断言延迟预算

**Target Platform**: 玩家端为 PC（Windows），Bot Client 与 Strategy Service 部署为云端/自托管 Linux 容器服务；Bot Client 需部署在与目标 Minecraft 服务器网络时延最小的位置（同区域/同机房）以满足反射层 <100ms 预算

**Project Type**: 多服务分布式系统（非单体 web 应用）——反射级低延迟要求迫使"协议连接 + 反射层"与"云端策略大脑"物理拆分为两个独立进程/服务，通过 WebSocket 通信

**Performance Goals**:
- 反射级操作（感知到执行）< 100ms，由 Bot Client 本地完成，不经云端往返（FR-007、SC-006）
- 非反射级策略指令 < 300ms（自云端接收触发信息起算）（FR-007、SC-006）
- 语音交互整体感知延迟 < 500ms（FR-011、SC-005），STT 分段延迟与 TTS 首字延迟需分别控制在约 200ms / 300ms 量级以留出预算
- 掉线重连 < 5s（FR-023、SC-007）
- 任务完成率 ≥ 90%（SC-001）、语音打断响应成功率 ≥ 95%（SC-002）

**Constraints**:
- 仅支持《我的世界》Java 版（Bedrock 不在范围内）
- AI 队友必须使用独立 Minecraft 账号接入，遵守 Mojang/Microsoft 自动化客户端条款（FR-027）
- 不得修改游戏客户端反作弊/完整性校验机制
- 反射级操作严格不依赖云端网络往返（架构约束，非仅性能目标）
- 语音数据需支持"不用于训练"选项，原始声纹不持久化（FR-025、FR-026）

**Scale/Scope**: V1 面向单一"一名玩家 + 一个 AI 队友"会话模型，非大规模多租户系统；每个并发 AI 队友对应一个独立机器人账号 + 一个 Strategy Service 会话实例

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

`.specify/memory/constitution.md` 目前仍是未填写的占位模板（`[PROJECT_NAME]`、`[PRINCIPLE_1_NAME]` 等占位符未被替换），项目尚未定义具体的治理原则。**本次规划未发现可执行的宪法门禁，此项检查视为通过（无门禁可评估）。** 如需要引入工程原则（如强制测试先行、简洁性约束等），建议后续运行 `/speckit-constitution` 补充，并在下一次 `/speckit-plan` 时重新评估。

**Post-Phase 1 Re-check（2026-07-22）**：完成 research.md / data-model.md / contracts/ / quickstart.md 后重新确认——设计过程中未引入任何可能违反常规工程原则的选择（多服务拆分是延迟约束的直接推论，见 Complexity Tracking 说明），宪法文件仍为空白模板，结论不变：无门禁违规。

## Project Structure

### Documentation (this feature)

```text
specs/001-ai-game-teammate/
├── plan.md              # This file (/speckit-plan command output)
├── research.md          # Phase 0 output (/speckit-plan command)
├── data-model.md        # Phase 1 output (/speckit-plan command)
├── quickstart.md        # Phase 1 output (/speckit-plan command)
├── contracts/           # Phase 1 output (/speckit-plan command)
└── tasks.md             # Phase 2 output (/speckit-tasks command - NOT created by /speckit-plan)
```

### Source Code (repository root)

```text
services/
├── bot-client/                    # Node.js/TypeScript — Minecraft 协议连接 + 本地反射层
│   ├── src/
│   │   ├── reflex/                # 反射级决策逻辑（战斗闪避、脱离危险），<100ms，不依赖云端
│   │   ├── minecraft/             # mineflayer 封装：连接、状态提取（FR-001）、动作执行（FR-005/006）
│   │   ├── humanizer/             # 拟人化操作噪声（FR-009）
│   │   ├── ws-client/             # 与 Strategy Service 的 WebSocket 客户端，指令接收/状态上报
│   │   └── index.ts
│   └── tests/
│       ├── unit/                  # reflex/humanizer 单元测试
│       └── integration/           # 对接本地 Docker 化 Minecraft 测试服的集成测试
│
├── strategy-service/              # Python — 云端 AI 大脑
│   ├── src/
│   │   ├── perception/            # 结构化状态整合 + 视觉解析兜底（FR-001/002/003/004）
│   │   ├── decision/              # Claude 工具调用编排：战术分解（FR-016）、自主度档位（FR-015）
│   │   ├── voice/                 # 流式 STT → Claude 流式文本 → 流式 TTS 级联管线（FR-010/011/012/013/014）
│   │   ├── persona/                # 人设/身份披露策略（FR-022）、陪伴闲聊（FR-020/021）
│   │   ├── memory/                # 玩家偏好档案（FR-018，User Story 2 后期增量）
│   │   ├── privacy/                # 本地/云端模式切换、训练数据授权（FR-026）
│   │   └── api/                    # 对 Bot Client 与玩家语音客户端暴露的 WebSocket/HTTP 端点
│   └── tests/
│       ├── unit/
│       └── contract/               # 针对 contracts/ 中工具schema与协议的契约测试
│
└── player-voice-client/            # 玩家端语音采集/播放接入层（浏览器或游戏内叠加层）
    └── src/
```

**Structure Decision**: 采用多服务结构而非单体项目，直接对应混合决策架构的物理约束：`bot-client` 必须运行在贴近 Minecraft 服务器、无云端网络往返的位置以满足 FR-007 的 <100ms 反射预算；`strategy-service` 承载可以容忍 <300ms 的策略/语音/人设逻辑，是 Claude API 与语音管线的调用方。`player-voice-client` 独立拆分是因为它运行在玩家设备而非后端，且其语音采集/播放实现（浏览器 WebRTC vs. 游戏内叠加层）是 research.md 中待确定的开放问题之一。

## Complexity Tracking

> **Fill ONLY if Constitution Check has violations that must be justified**

无——宪法文件为未填写的占位模板，本次规划未触发任何门禁违规，故不填写本表。
