# Phase 0 Research: AI 游戏陪玩 Agent（基于 Project AIRI 的黑客松四层分级交付）

**Feature**: [spec.md](./spec.md) | **Plan**: [plan.md](./plan.md) | **Date**: 2026-07-22

本文档解决 `plan.md` Technical Context 中的技术决策。与上一版本（见 `_archive-v1-full-product/research.md`）不同，本次研究不是从零设计架构，而是**实际检索了 Project AIRI 的公开仓库**（通过 GitHub API 与官方文档），把决策建立在已验证的现状之上，而非假设。

---

## 1. Project AIRI 现状核实（决定第一层实现方式的基础事实）

**Decision**: 第一层直接复用 `services/minecraft`（`@proj-airi/minecraft-bot`）现有实现，不重写、不重构。

**核实到的事实**（via `gh api repos/moeru-ai/airi/...`，2026-07-22）：
- AIRI 主仓库是 pnpm monorepo，TypeScript 为主（72.4%），目录组织为 `packages/`（共享库）、`services/`（后端服务）、`apps/`（Web/Desktop/Mobile）、`engines/`（Godot）、`plugins/`。
- `services/minecraft` 是一个独立的 Node.js/TypeScript 服务（`@proj-airi/minecraft-bot`），通过 `tsx --env-file=.env` 启动，依赖 `mineflayer` 系列插件与 `prismarine-*` 协议库——**这是 Minecraft Java 版协议实现**（Bedrock 版不使用这套技术栈），与本项目此前基于 PRD.md 版本的判断一致。
- 该服务已经实现了一套**四层认知架构**：
  - **Layer A 感知（Perception）**：`src/cognitive/perception/` —— 事件定义把 Mineflayer 原始事件绑定为标准化事件，规则引擎（YAML 规则）产出派生信号。
  - **Layer B 反射（Reflex）**：`src/cognitive/reflex/` —— 基于有限状态机（FSM）的快速、本能反应，可通过"抑制信号（Inhibition Signal）"阻止意识层做冗余处理。
  - **Layer C 意识（Conscious）**：`src/cognitive/conscious/` —— `brain.ts`（事件队列编排、LLM 轮次生命周期、安全/预算护栏）、`js-planner.ts`（沙箱化的 JS 规划执行）、`query-dsl.ts`（只读世界/物品栏/实体查询）。
  - **Layer D 行动（Action）**：`src/cognitive/action/` —— `task-executor.ts`（执行标准化动作指令）、`action-registry.ts`（校验参数、分发工具调用）、`llm-actions.ts`（绑定到 mineflayer 技能的工具目录）。
  - 官方 README 明确写道该架构"受认知科学启发，支持反应式、有意识和物理落地的行为"，并列出了未来计划中的反射层增强方向：**"躲避敌对生物""紧急战斗响应"**——这与本规格 User Story 4（SLM/SSM 反射模型）的目标高度重合，说明第三层 A 的正确集成点就是这里的 Reflex Manager，而不是另建一套。
- 该服务通过 `@proj-airi/server-sdk`（WebSocket 客户端 SDK，支持鉴权 + 模块自我声明握手 + 事件订阅/发布）与 AIRI 核心通信；README 原文："自动连接到 AIRI 与 Minecraft 服务器"两端。
- LLM 接入通过 OpenAI 兼容的环境变量配置（`OPENAI_API_BASEURL`/`OPENAI_API_KEY`/`OPENAI_MODEL`），`.env` 模板默认示例为 `deepseek-chat`；AIRI 更广泛的 `xsAI` 库支持 25+ 家 LLM 提供商（含 Claude、OpenAI、DeepSeek、Ollama、vLLM 等），因此模型提供商是 Phase 0（范围冻结）阶段的**配置选择**，不是需要新建的能力。
- **⚠️ 已标注的废弃路径**：该服务 README 明确写道"This service is on a deprecation path. The current Mineflayer-based bot is expected to be replaced by a Fabric mod based runtime... avoid building new long-term features around the Mineflayer runtime unless they are also part of the migration plan."
- **安全提示**：LLM 生成的 JS 动作计划在 `isolated-vm` 沙箱中执行，但仍驱动一个可访问本机网络/文件系统的真实进程；README 明确警告"不要连接到不受信任的公共服务器"；MCP Server/Debug Server/Prismarine Viewer 默认无鉴权，暴露到公网/不受信网络存在 RCE 风险。

**Rationale**：这一核实直接决定了整个计划的复杂度分布——第一层几乎不需要写新代码（只需部署、配置 `.env`、连接受控服务器、固化演示脚本），真正的工程量集中在第二层起的新增能力。同时，废弃路径的存在是一个必须被记录、而非被规划掩盖的真实风险。

**Alternatives Considered**：
- *假设 AIRI 的 Minecraft 集成情况并凭经验设计*（上一版本 `_archive-v1-full-product/` 的做法，当时面对的是完全不同的 PRD.md）：本次不再适用，因为 PRD2 明确要求"先按 AIRI 当前主仓库和 services/minecraft 的真实组织方式跑通"，必须以实测为准。
- *绕开废弃风险，直接从零构建新的 Minecraft 服务*：与 PRD2"第一层不重构、不新增产品功能"的硬边界直接冲突，排除。

---

## 2. 真全双工语音架构（对应 User Story 2）

**Decision（2026-07-23 修订）**: 第二层 A 采用 **真全双工双流架构**，详见 [`contracts/full-duplex-architecture.md`](./contracts/full-duplex-architecture.md)。**默认组装**：**openbmb/MiniCPM-o-4_5**（Brain A，经 [MiniCPM-o-Demo](https://github.com/OpenBMB/MiniCPM-o-Demo) Gateway/Realtime Audio Full-Duplex）+ 本仓库 **Intent Bridge → `@proj-airi/server-sdk` → minecraft-bot**（Brain B）；Moshi/PersonaPlex 为备胎。**不**采用 Unmute / STT→LLM→TTS 级联作为主路径。

**Rationale**：
- 级联 + barge-in 本质是可打断的半双工，与真全双工不是同一架构。
- MiniCPM-o 4.5 在开源侧提供更强的双语/多模态全双工与官方可部署 Demo；**双工路径仍以旁路 tool 接 MC**（不假设原生 FC 已就绪）。
- 全双工进程与第一层解耦：关闭后第一层演示仍可运行。

**Alternatives Considered**：
- *PersonaPlex + LiveKit（前一版默认）*：真双流可部署，但英主、无官方中文优势；已降为备胎。
- *级联半双工*：已明确非主路径。
- *等待一体 S2S+FC*：不阻塞交付。
- *仅用托管 Realtime*：P1 逃生舱。

---

## 3. 统一 Game Adapter 契约的落地方式（对应 User Story 3 / FR-015~023）

**Decision**: Adapter 契约（`observe/act/events/capabilities/health`）作为一个独立的、语言无关的接口定义（`contracts/game-adapter-contract.md`），Minecraft Adapter 以最薄的包装层形式包裹 `services/minecraft` 现有的 `action-registry.ts`/`task-executor.ts`，不改变其内部实现；DST Adapter 对接一个新建的 DST Bridge。

**Rationale**：PRD2 §5.2 明确要求"第一层演示仍可通过回归测试"（G2-03），因此 Minecraft Adapter 必须是包装而非重写。已确认 `action-registry.ts` 本身就承担"校验参数、分发工具调用"的职责，天然适合在其外层加一个坐标转换层，把 Adapter 的 `act(action)` 调用翻译为该服务已有的工具调用格式，无需触碰 Task Executor 内部逻辑。

**Alternatives Considered**：
- *重写 `services/minecraft` 的行动层以原生支持 Adapter 接口*：违反"不破坏第一层可运行基线"的硬性要求，且加大了未来 Fabric mod 迁移的合并成本，排除。

---

## 4. Don't Starve Together 集成技术选型（对应 User Story 3 / FR-019~020）

**Decision**: DST 服务端 Mod 使用 **Lua**（Klei 官方模组系统的原生语言），本地桥接进程使用 TypeScript/Node.js（与其余新增服务技术栈一致），通过进程间通信（本地 Socket/HTTP，具体协议由桥接进程自行选择）把 Mod 内的状态/事件转发给桥接进程，再由桥接进程经 `@proj-airi/server-sdk` 同款协议接入 AIRI 事件总线。

**Rationale**：Don't Starve Together 的官方模组系统（Klei 自有的 Mod API）要求服务端 Mod 用 Lua 编写，这是该游戏引擎的既定事实，不是可选的技术决策；PRD2 §5.2 本身也建议"优先采用受控专用服务器与服务端 Mod / 本地桥接方式，避免依赖屏幕视觉和通用键鼠自动化"，与 Lua Mod + 桥接进程的组合完全吻合。桥接进程选用 Node.js 是为了与 Game Adapter、其余外围服务保持技术栈一致，降低团队认知负担。

**Alternatives Considered**：
- *纯屏幕视觉 + 键鼠自动化接入 DST，不用 Mod*：PRD2 明确不建议此路径（"避免依赖屏幕视觉和通用键鼠自动化"），且延迟与可靠性远不如 Mod 直连，排除；该方案对应的通用能力保留给第四层 Shadow Observer（其目的本就是验证"没有结构化接口时"的场景，而不是作为主要接入方式）。

---

## 5. 本地 SLM/SSM 的训练与推理集成方式（对应 User Story 4 / FR-024~029）

**Decision**: 训练管线用 Python（PyTorch/Transformers 生态，或轻量 SSM 开源实现），产出模型后导出为 ONNX 格式；推理侧在 Node.js 进程内用 `onnxruntime-node` 原地加载执行，直接接入 `services/minecraft` 现有的 `src/cognitive/reflex/reflex-manager.ts` 作为其决策来源之一（低置信度或未覆盖动作时回退到 AIRI 既有的 Conscious 层）。

**Rationale**：训练生态的成熟度决定了 Python 是唯一合理选择；但推理侧若继续用 Python 会引入跨进程/跨语言调用，与"决策延迟降低 ≥50%"的目标（SC-007）直接冲突——把推理放进 Node.js 主进程（`services/minecraft` 本就是 Node.js 服务）能省掉这一跳网络/IPC 开销。集成点选择 `reflex-manager.ts` 而非新建模块，是因为该文件已经是"反射层"的既有骨架，且官方 README 的"未来增强"清单里已列出"躲避敌对生物""紧急战斗响应"这类正是 SLM/SSM 想要覆盖的高频动作类型，说明这是上游也认可的自然演进方向。

**Alternatives Considered**：
- *推理侧继续用 Python，通过 HTTP/gRPC 供 Node.js 服务调用*：架构更解耦，但引入的跨进程延迟直接侵蚀"决策延迟降低 ≥50%"的收益空间，排除（除非离线评测证明 ONNX Node 内推理不可行，作为备选保留在此记录）。

---

## 6. 实体硬件桌宠的固件与通信选型（对应 User Story 5 / FR-030~036）

**Decision**: 固件语言由团队按硬件选型决定——ESP32 用 C++/Arduino，Raspberry Pi 用 Python；通信协议在 WebSocket / MQTT / 串口三者中按部署环境选择（局域网内建议 WebSocket，与其余外围服务技术栈/协议习惯一致）。

**Rationale**：PRD2 §6.3 本身把 ESP32/Raspberry Pi 列为二选一，未强制单一路线，符合黑客松阶段"按团队能力选择"的原则；WebSocket 作为默认建议是因为 AIRI 生态本身大量使用 WebSocket（`server-sdk`、各服务与核心的通信），选用同一协议家族有利于用同一套调试工具排查问题。

**Alternatives Considered**：
- *强制统一为某一种硬件/协议*：与 PRD2 明确的"团队按能力择一"矛盾，排除。

---

## 7. 第四层三个研究方向的接入点（对应 User Story 6 / FR-037~047）

**Decision**：
- **Agent Arena**：复用第二层 Game Adapter 的 `observe/act/events` 接口驱动场景初始化、复位与轨迹记录，不重新定义与游戏的交互方式。
- **Replay-to-Skill**：消费 Arena 产出的轨迹（或人工录制的轨迹），生成的技能通过统一 Adapter 的 `act()` 执行，天然获得取消/超时/回退能力，无需另建执行通道。
- **Shadow Observer**：新增一个独立的画面采集 + 轻量视觉推理服务，把识别结果作为新的"原始事件源"接入 AIRI 已确认存在的 Perception 事件总线（`src/cognitive/perception/events/definitions/*`），与 Mineflayer 原始事件享受同一条"事件定义 → 事件总线 → 规则引擎"管线。

**Rationale**：三个方向都能复用第二层已经建好的抽象（Adapter 契约、事件总线），不需要为第四层单独设计一套新的接入方式；这也直接体现了 PRD2 §7.1 强调的"第四层不是第三层前置条件"——它是叠加在已有基础设施之上的验证层，而不是平行的新系统。

**Alternatives Considered**：
- *Shadow Observer 直接控制角色，绕过 Adapter*：与 spec.md FR-047（视觉事件 MUST 仅只读、MUST NOT 直接控制角色）矛盾，排除。

---

## 8. 仓库集成策略：子模块 + 外围服务，而非 Fork 深度修改

**Decision**: 以 git submodule（或 vendored clone，锁定具体 commit）的方式引入 AIRI 到 `airi/` 目录；本项目新增的所有第二层及以上能力，优先以 `hackathon-services/` 下的独立服务形式存在，仅在 Game Adapter 需要包装 AIRI 自身 Action 层等确有必要之处，才对 `airi/` 内部代码做最小侵入式修改。

**Rationale**：这一策略同时服务于三个已确认的真实约束：(1) PRD2 §8.3/§8.4 要求"每次跨层合并必须运行第一层回归脚本，并保留可快速回滚的 tag/分支"——外围服务结构让"回归测试"的对象范围更清晰（AIRI 子模块本身几乎不变）；(2) `services/minecraft` 已被上游标注为废弃路径，深度耦合的定制会在未来 Fabric mod 迁移时产生高昂合并成本；(3) 新增能力通过 `@proj-airi/server-sdk` 这一 AIRI 官方公开的 WebSocket 协议接入，符合"不重构 AIRI 核心架构"的第一层硬边界原则，且该协议已被 AIRI 自身多个服务（Discord Bot、Telegram Bot 等）验证可用，不是我们自己发明的接口。

**Alternatives Considered**：
- *直接 Fork AIRI 仓库并在其内部大量修改*：会让"回归测试第一层"的判断标准模糊化（改动散落在整个仓库中），也增加了后续把改动贡献回上游或跟随上游更新的难度，排除。
