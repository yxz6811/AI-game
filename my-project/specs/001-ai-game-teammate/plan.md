# Implementation Plan: AI 游戏陪玩 Agent（基于 Project AIRI 的黑客松四层分级交付）

**Branch**: `001-ai-game-teammate` | **Date**: 2026-07-22 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/001-ai-game-teammate/spec.md`

**Note**: This template is filled in by the `/speckit-plan` command; its definition describes the execution workflow.

## Summary

在 Project AIRI（开源 AI 伙伴项目）现有代码基础上，按四个严格分级、Stage-Gate 依赖的层级交付：第一层零新增代码，只部署/配置/连接 AIRI 现有的 `services/minecraft`（Mineflayer 驱动的 Minecraft 服务）并固化演示脚本；第二层新增全双工语音打断能力与一套统一 Game Adapter 契约（`observe/act/events/capabilities/health`），并接入 Don't Starve Together 作为第二款游戏验证架构可迁移；第三层是两条并列可选的超高收益轨道——训练本地 Transformer SLM/SSM 反射模型、以及实体硬件桌宠；第四层是三选一的前沿研究增强——Agent Arena 自动评测、Replay-to-Skill、Shadow Observer 视觉影子模型。

**关键技术前提（通过实际检索 Project AIRI 仓库确认，非假设）**：AIRI 的 `services/minecraft`（`@proj-airi/minecraft-bot`）已经是一个 TypeScript/Node.js 服务，基于 `mineflayer` + `prismarine-*` 协议栈连接 **Minecraft Java 版**，并且**已经实现了一套四层认知架构**（感知 Perception → 反射 Reflex/FSM → 意识 Conscious/LLM Planner → 行动 Action/Task Executor），通过 `@proj-airi/server-sdk`（WebSocket 事件总线客户端）与 AIRI 核心通信。这意味着第一层的"感知—操控—反馈"闭环、乃至第三层 SLM/SSM 所要替换/增强的"反射层"，在 AIRI 中已有现成骨架可以复用，而不需要从零设计——**但该服务的官方 README 明确标注它正处于"废弃路径"，未来会被 Fabric mod 运行时取代**，这是本计划必须正面记录的既有风险，而非需要我们解决的新问题。

## Technical Context

<!--
  ACTION REQUIRED: Replace the content in this section with the technical details
  for the project. The structure here is presented in advisory capacity to guide
  the iteration process.
-->

**Language/Version**:
- 第一 / 二层：跟随 Project AIRI 现有技术栈——TypeScript 5.x + Node.js（pnpm monorepo，服务通过 `tsx` 运行）；不引入新语言。
- 第二层 B（DST）：Klei 官方模组系统要求服务端 Mod 用 **Lua** 编写；本地桥接进程用 TypeScript/Node.js（与其余服务技术栈一致）。
- 第三层 A（SLM/SSM）：训练管线新增 Python 3.11+（PyTorch/Transformers 或轻量 SSM 实现）；推理侧导出为 ONNX，在 Node.js 内用 `onnxruntime-node` 原地加载，避免跨进程调用给决策延迟预算带来额外开销。
- 第三层 B（硬件桌宠）：ESP32 → C++/Arduino 固件；Raspberry Pi → Python（PRD2 明确两者二选一，由团队硬件能力决定）。

**Primary Dependencies**:
- 第一层：**不引入任何新依赖**——完全复用 `services/minecraft` 现有依赖：`mineflayer` 系列插件（`mineflayer-pathfinder`、`mineflayer-pvp`、`mineflayer-auto-eat`、`mineflayer-collectblock`、`mineflayer-armor-manager`、`mineflayer-tool`）、`prismarine-*` 协议库（`prismarine-block/entity/item/recipe/viewer/windows`）、`@proj-airi/server-sdk`（连接 AIRI 核心的 WebSocket 事件总线客户端）、`isolated-vm`（LLM 生成的 JS 动作计划的沙箱执行环境）。
- 第二层 A（语音）：复用 AIRI 既有的 VAD / STT / TTS 模块与 `unspeech` 统一音频代理；新增工作是"打断信号如何贯穿 Conscious 层的 LLM 调用与 Action 层正在执行的任务"这一编排逻辑——**可直接复用 Reflex 层已有的"抑制信号（Inhibition Signal）"机制**作为打断信号的传递通道，而非另起一套。
- 第二层 B（Game Adapter + DST）：新增语言无关的 Adapter 契约（`observe/act/events/capabilities/health`，见 `contracts/game-adapter-contract.md`）；Minecraft Adapter 直接包装 `services/minecraft` 现有的 Action Registry / Task Executor；DST Bridge 由 Klei Lua 服务端 Mod + Node.js 本地桥接进程组成，桥接进程复用 `@proj-airi/server-sdk` 同款协议接入事件总线。
- 第三层 A：Python 训练管线产出模型，导出 ONNX 后接入 `services/minecraft` 现有的 `src/cognitive/reflex/reflex-manager.ts`，作为其决策来源之一（而非另建一套反射系统）。
- 第三层 B：新增独立通信进程消费统一 Experience Event（WebSocket / MQTT / 串口三选一），固件依硬件选型而定。
- 第四层：Agent Arena / Replay-to-Skill 复用第二层 Adapter 的 `observe/act/events` 接口驱动场景重置与轨迹记录，不重新定义游戏交互方式；Shadow Observer 新增独立的画面采集 + 轻量视觉推理服务，把识别结果作为新的"原始事件源"接入 AIRI 已有的 Perception 事件总线（`src/cognitive/perception/events/`）。

**Storage**:
- 第一层无需持久化存储。
- 第三层 A 需要冻结、版本化的训练/验证/测试数据集（文件形式，非数据库；按场景/种子隔离）。
- 第四层 Arena 需要轨迹记录存储（结构化文件如 JSONL，按场景/种子隔离并冻结版本，避免轨迹泄漏）。
- Replay-to-Skill 生成的技能为版本化的可读配置文件（YAML/JSON），存入技能库目录，须经人工确认后才可用于主世界。

**Testing**:
- 第一层：以固定演示脚本连续 3 次成功作为验收标准（Runbook 驱动的人工验证），辅以 `services/minecraft` 自带的 `vitest` 单元测试套件（`pnpm test`）与 `pnpm typecheck`。
- 第二层：语音打断/取消成功率通过固定协议的人工重复测试统计（20 次 / 10 次）；延迟埋点通过结构化日志/看板验证可定位到具体阶段。
- 第三层 A：冻结测试集上的自动化离线评测报告 + 固定 Demo 场景的人工重复对比测试。
- 第三层 B：断电/断线隔离测试（人工触发故障，验证主链路不受影响）。
- 第四层：Arena 的多轮自动化运行本身即是测试基础设施；Replay-to-Skill 与 Shadow Observer 均有明确的重复性/准确率验收协议（见 spec.md Acceptance Scenarios）。

**Target Platform**:
- 第一至三层 A：目标演示机器（Windows/macOS/Linux，具体型号由执行阶段 Phase 0"范围冻结与版本锁定"确认），需可运行 Node.js/pnpm；若含模型训练需 Python/PyTorch 环境，具备 GPU 可选（"单卡可完成训练"为验收标准之一，非强制多卡）。
- 第三层 B：ESP32 或 Raspberry Pi 实体硬件。
- Minecraft 服务器与 DST 专用服务器均为受控本地/局域网部署，非公网服务（安全约束，见下）。

**Project Type**: 基于既有开源单体仓库（Project AIRI）的分层扩展，而非从零构建的独立系统——第一层零新增代码（仅部署配置）；第二层起的新增能力优先作为独立的外围服务，通过 AIRI 既有的 `@proj-airi/server-sdk` WebSocket 事件协议接入，只在确有必要时（如 Game Adapter 需要包装 AIRI 自身的 Action 层）才对 AIRI 代码做最小侵入式修改，以降低与上游代码分支漂移的合并成本，也降低"废弃路径"风险兑现时的迁移代价。

**Performance Goals**:
- 第一层：无量化延迟目标；只要求演示脚本连续 3 次成功、常见故障可在 2 分钟内按 Runbook 恢复（FR-006/007，SC-002/003）。
- 第二层：语音打断成功率 ≥90%（20 次测试中 ≥18 次，SC-004）；动作取消成功率 ≥80%（10 次测试中 ≥8 次，SC-005）；连续 10 分钟对话无自激对话（FR-013）；延迟需可观测到 VAD/STT/LLM/TTS/行动各阶段（FR-014）。
- 第三层 A：本地模型动作正确率目标 ≥90%；决策延迟相比 AIRI 基线降低目标 ≥50%，且成功率无明显下降（SC-007）。
- 第三层 B：≥5 类事件肉眼可区分，事件触发后 1 秒内可感知到设备状态变化（SC-008）。
- 第四层：Arena 每场景自动运行 10 轮（SC-010）；Replay 技能 3 次中至少成功 2 次（SC-011）；视觉事件识别准确率目标 ≥80%，延迟目标 ≤1 秒（SC-012）。

**Constraints**:
- **已知重大风险（非本计划引入，而是既有事实）**：`services/minecraft` 官方 README 明确标注该 Mineflayer 运行时处于"废弃路径"（deprecation path），未来将被基于 Fabric mod 的运行时取代，README 原文建议"不要围绕 Mineflayer 运行时构建新的长期功能，除非它们也是迁移计划的一部分"。第一层选择基于当前实现完全符合 PRD2"不先设计完美通用框架，先按现状跑通"的架构原则（对应架构原则 §3.1），是明确且合理的权衡，但团队应避免对该服务内部做深度定制，为后续可能的 Fabric mod 迁移留出空间。
- 第一层 MUST NOT 对 AIRI 核心架构做通用化重构。
- 安全约束（源自 `services/minecraft` 自带的安全提示）：LLM 生成的 JS 动作计划虽运行在 `isolated-vm` 沙箱中，但仍驱动一个可访问本机网络与文件系统的真实进程——**不得连接到不受信任的公共 Minecraft 服务器**；MCP Server / Debug Server / Prismarine Viewer 默认无鉴权，**不得对公网暴露**。
- 不做任何绕过反作弊或破坏公平性的竞技类自动化能力（贯穿全部四层，FR-051）。
- 每次跨层合并 MUST 运行第一层回归脚本，MUST 保留可快速回滚的版本标记（FR-050）。
- 第三层两条轨道（SLM/SSM、硬件桌宠）相互独立，互不阻塞；第四层三个方向任选其一。

**Scale/Scope**: 单机/局域网黑客松演示规模，非生产级多租户系统；不追求覆盖任意数量游戏或大规模并发会话；不承诺 7×24 服务可用性。

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

`.specify/memory/constitution.md` 目前仍是未填写的占位模板（`[PROJECT_NAME]`、`[PRINCIPLE_1_NAME]` 等占位符未被替换），项目尚未定义具体的治理原则。**本次规划未发现可执行的宪法门禁，此项检查视为通过（无门禁可评估）。**

**Post-Phase 1 Re-check（2026-07-22）**：完成 research.md / data-model.md / contracts/ / quickstart.md 后重新确认——本次设计的核心决策（最小侵入式修改 AIRI 代码、新增能力以外围服务形式接入既有事件总线、Stage Gate 纪律）均直接来自 PRD2 自身的架构原则，未引入额外的复杂度或需要豁免的工程实践。宪法文件仍为空白模板，结论不变：无门禁违规。

## Project Structure

### Documentation (this feature)

```text
specs/001-ai-game-teammate/
├── plan.md              # This file (/speckit-plan command output)
├── research.md          # Phase 0 output (/speckit-plan command)
├── data-model.md        # Phase 1 output (/speckit-plan command)
├── quickstart.md        # Phase 1 output (/speckit-plan command)
├── contracts/           # Phase 1 output (/speckit-plan command)
├── checklists/          # /speckit-specify quality checklist
└── tasks.md             # Phase 2 output (/speckit-tasks command - NOT created by /speckit-plan)
```

### Source Code (repository root)

```text
airi/                            # Project AIRI 的固定版本/commit（git submodule 或 vendored clone）
│                                 # 第一层锁定后冻结；仅在第二层 Game Adapter 包装时做最小侵入式修改
├── services/minecraft/           # AIRI 现有 Minecraft 服务（复用，不重写）
│   └── src/cognitive/
│       ├── perception/           # 第四层 Shadow Observer 将在此接入新的视觉事件源
│       ├── reflex/               # 第三层 A 的 SLM/SSM 将接入此处的 reflex-manager.ts
│       ├── conscious/             # 第二层 A 的语音打断复用此处 Brain 的抑制信号机制
│       └── action/                # 第二层 B 的 Minecraft Adapter 包装此处的 Action Registry
├── packages/server-sdk/           # AIRI 既有的 WebSocket 事件总线客户端 SDK，供外围新服务接入
└── ...                            # AIRI 自身其余目录，保持不变

hackathon-services/                # 本项目新增的外围服务，均通过 @proj-airi/server-sdk 接入 AIRI 事件总线
├── _shared/                        # 跨服务共享的 server-sdk 接入参考实现（见 T013），各外围服务接入事件总线时参照此模板
├── game-adapter/                  # 第二层：统一 Game Adapter 契约 + Minecraft/DST 两个具体实现
│   ├── src/
│   │   ├── contract/              # observe/act/events/capabilities/health 接口定义
│   │   ├── minecraft-adapter/     # 包装 airi/services/minecraft 的 Action Registry
│   │   └── dst-adapter/           # 对接 dst-bridge 的状态/动作映射
│   └── tests/
├── dst-bridge/                    # 第二层：DST 服务端 Mod（Lua）+ 本地桥接进程（Node.js）
│   ├── mod/                       # Klei DST 服务端 Mod（Lua）
│   └── bridge/                    # Node.js 桥接进程，转发状态/事件/动作
├── voice-orchestration/           # 第二层：全双工语音打断/取消编排
│   └── src/
├── slm-training/                  # 第三层 A：Python 训练管线（数据集、训练脚本、离线评测）
│   ├── datasets/
│   ├── train.py
│   └── eval/
├── slm-inference-bridge/          # 第三层 A：ONNX 推理接入 reflex-manager.ts
│   └── src/
├── hardware-companion/            # 第三层 B：Experience Event Schema + 硬件通信进程 + 固件
│   ├── experience-event-schema/
│   ├── bridge/
│   └── firmware/
├── agent-arena/                   # 第四层（可选子方向 a）：标准任务、自动复位、多轮运行、报告
├── replay-to-skill/               # 第四层（可选子方向 b）：轨迹抽象、技能生成、沙箱验证
└── shadow-observer/                # 第四层（可选子方向 c）：画面采集、视觉事件识别、只读事件消费

demo/                               # 演示脚本、Runbook、故障排查清单、录屏
└── runbook.md
```

**Structure Decision**: 采用"固定版本的 AIRI 子模块 + 外围新服务"的结构，而非把新功能直接塞进 AIRI 自身目录、也不是从零重写一个独立系统。理由直接来自本次检索到的真实约束：(1) `services/minecraft` 已经实现了感知/反射/意识/行动四层认知架构，第一层的任务是部署验证而非重建；(2) 该服务已被上游标注为"废弃路径"，新增能力若深度耦合进其内部实现，会在未来 Fabric mod 迁移时产生高昂的合并成本，因此第二层起的新能力优先以外围服务形式、通过既有的 `@proj-airi/server-sdk` WebSocket 协议接入，只在 Game Adapter 包装等确有必要之处做最小侵入式修改；(3) PRD2 §8.4 明确要求"每次跨层修改必须跑第一层回归脚本，并保留可快速回滚的 tag/分支"，外围服务结构天然降低了误伤第一层基线的概率。

## Complexity Tracking

> **Fill ONLY if Constitution Check has violations that must be justified**

无——宪法文件为未填写的占位模板，本次规划未触发任何门禁违规，故不填写本表。
