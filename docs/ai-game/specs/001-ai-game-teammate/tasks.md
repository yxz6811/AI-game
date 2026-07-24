# Tasks: AI 游戏陪玩 Agent（基于 Project AIRI 的黑客松四层分级交付）

**Input**: Design documents from `/docs/ai-game/specs/001-ai-game-teammate/`

**Prerequisites**: spec.md、plan.md、research.md、data-model.md、contracts/、quickstart.md（均已就绪，基于 `docs/ai-game/PRD2.md`）

## Current Status（2026-07-23 盘点）

| 项 | 状态 | 说明 |
|----|------|------|
| 仓库形态 | ✅ 已落地（布局变更） | 仓库根目录即为 Project AIRI 工作区（非 `airi/` 子模块）；黑客松文档在 `docs/ai-game/` |
| 规格/PRD | ✅ 已就绪 | `docs/ai-game/PRD.md`、`PRD2.md`、`specs/001-ai-game-teammate/*` |
| AIRI Minecraft 服务源码 | ✅ 已存在 | `services/minecraft`（`@proj-airi/minecraft-bot`）、含 `reflex-manager.ts` |
| server-sdk / 音频包 | ✅ 已存在 | `packages/server-sdk`、`packages/audio*`、`packages/pipelines-audio` |
| 锁定 commit 记录 | ✅ | `demo/version-matrix.md`：`1c65d4b83` + Paper `1.21.1` |
| `hackathon-services/` | ✅ 已有 | 含 `duplex-voice`（第二层 A 旁路，不挡 Gate 1） |
| `demo/` | ✅ 骨架就绪 | runbook / setup-guide / tier1-script / stage-gate / regression / mc-server |
| `pnpm i` / `node_modules` | ✅ 基本可用 | 官方 registry；`sharp` postinstall 曾失败可忽略；需 turbo build 总线包 |
| Minecraft 运行配置 | ✅ | `.env.local`：GLM `glm-4-flash` + Bot/服对齐（密钥勿提交） |
| Gate 1 / US1 | ✅ PASSED | L1-01～L1-07 / FR-008 / FR-050 已勾；解锁 Phase 4/5 |

**进度摘要**：Gate 1 已通过。Phase 5 Minecraft Adapter（T051–T057）已完成。并行已落地归档版「人设闲聊」于 `hackathon-services/persona`（情绪价值 / FR-013~022），并接入 `duplex-voice`。下一优先 = persona 场景 C 联调，或 T058 / DST / Phase 4。

**任务优先级说明（应用户要求，独立于下方 `[Story]` 标签，直接继承 PRD2 自身的 必须/目标/可选 三级分类而非另造标准）**：
- **P0** = 对应 PRD2 中标注为"必须"的工作项，或是其他任务的阻断性前置条件——第一层（User Story 1）全部任务为 P0，因为第一层整体就是"必须"层级；第二层及以上，只有 PRD2 明确标注"必须"的能力（如打断机制本身、故障隔离、跨游戏复用）才是 P0，具体的量化达标验收（如"20 次测试 ≥18 次"）属于 PRD2 标注的"目标"级，记为 P1
- **P1** = 对应 PRD2 中标注为"目标"的量化验收，或对故事完整交付有重要价值但不阻断其他工作的任务
- **P2** = 对应 PRD2 中标注为"可选"的整体层级（第三、四层的具体能力目标本身），或纯粹的辅助/文档性任务

每个任务后以 `— 优先级：Pn，预估：Xh` 形式标注。预估以单人专注工时计，不含评审/联调等待时间。

**Organization**: 按用户故事分组（US1~US6 对应 spec.md 的六个用户故事 / PRD2 的四个层级），组内按 PRD2 原始工作项编号（L1-xx/V2-xx/G2-xx/M3-xx/H3-xx/A4-xx/S4-xx/W4-xx）保持可追溯性。

> **本版本变更记录**：
> - **2026-07-23（Brain A = MiniCPM-o 4.5）**：默认全双工后端改为 `openbmb/MiniCPM-o-4_5` + MiniCPM-o-Demo；PersonaPlex/LiveKit 降为备胎。
> - **2026-07-23（真全双工架构）**：新增 `contracts/full-duplex-architecture.md`；research §2 / spec US2 / FR-009~014 / Phase 4 改为双脑真双流。
> - **2026-07-23（仓库布局对齐）**：仓库根 = AIRI 工作区；文档迁至 `docs/ai-game/`。路径约定从 `airi/` 子模块改为根目录直接引用 `services/`、`packages/`。T001/T002 按新布局改写并勾选已完成部分。
> - **先前（对齐 `/speckit-analyze`）**：新增 5 条任务（原 140 → 145）；C1/C2/U1/I1/U2 见历史说明。

## Format: `[ID] [P?] [Story] Description — 优先级，预估`

- **[P]**：可与其他标记 [P] 的任务并行执行（不同文件、无相互依赖）
- **[Story]**：任务所属用户故事（US1~US6），Setup/Foundational/Polish 阶段不标注
- 每个任务包含明确文件路径

## Path Conventions（2026-07-23 更新）

```
.                                  # 仓库根 = Project AIRI monorepo（仅在明确必要处做最小侵入式修改）
├── services/minecraft/            # AIRI 现有 Minecraft Bot（复用）
├── packages/server-sdk/           # 事件总线客户端 SDK
├── docs/ai-game/                  # 黑客松 PRD + specs（本任务文档所在处）
├── hackathon-services/            # 【待建】本项目新增外围服务，经 @proj-airi/server-sdk 接入
│   └── duplex-voice/              # 真全双工（见 contracts/full-duplex-architecture.md）
└── demo/                          # 【待建】演示脚本、Runbook、版本矩阵、录屏、交付说明
```

> **布局变更说明**：原计划「`airi/` git submodule」已改为「AIRI 内容直接作为本仓库根」。凡旧文中的 `airi/services/minecraft` 一律读作 `services/minecraft`；冻结版本改为锁定本仓库 commit（当前参考：`1c65d4b83`），而非 submodule SHA。

---

## Phase 1: Setup（共享基础设施 / 对应 PRD2 Phase 0）

**Purpose**: 范围冻结与版本锁定，项目骨架初始化

- [x] T001 确认仓库骨架：根目录为 AIRI 工作区；创建顶层 `hackathon-services/`、`demo/`（AIRI 已在根目录，无需再放 `airi/` 子模块） — 优先级：P0，预估：0.5h — **部分完成（2026-07-23）**：AIRI 根布局已到位；`hackathon-services/`、`demo/` 仍待创建
- [x] T002 [P] ~~将 Project AIRI 引入为 git submodule 于 `airi/`~~ → **已由「AIRI 作为仓库根」替代完成**（commit `1c65d4b83`，remote `yxz6811/AI-game`） — 优先级：P0，预估：0.5h — **完成（布局变更）**
- [x] T001b 创建尚缺目录：`hackathon-services/`、`demo/`（补齐 T001 剩余项） — 优先级：P0，预估：0.25h — **完成（Phase 4 一并创建）**
- [ ] T003 确认并锁定 AIRI/本仓库版本 commit，记录到 `demo/version-matrix.md`（对应 PRD2 Phase 0 范围冻结；当前候选 `1c65d4b83`） — 优先级：P0，预估：1h（依赖 T001b, T002）
- [ ] T004 确认目标演示机器、Minecraft 服务器版本、模型提供商、Demo 世界与各阶段负责人，记录到 `demo/version-matrix.md` — 优先级：P0，预估：1.5h
- [ ] T005 在目标机器安装 pnpm 并执行 `pnpm i` 完成 AIRI workspace 依赖安装（当前环境 `pnpm` 未就绪、无 `node_modules`） — 优先级：P0，预估：0.5h（依赖 T003）
- [ ] T006 [P] 搭建受控 Minecraft Java 版测试服务器与专用测试世界 — 优先级：P0，预估：1.5h
- [ ] T007 [P] 初始化 `hackathon-services/` 下各子包的 package.json/tsconfig 骨架（game-adapter/dst-bridge/`duplex-voice` 等空目录先占位） — 优先级：P1，预估：1h（依赖 T001b）
- [ ] T008 [P] 搭建 CI 骨架（push 时对 `hackathon-services/` 跑 lint + typecheck；不对 AIRI 既有 `services/`/`packages/`/`apps/` 做无关修改） — 优先级：P1，预估：1h
- [ ] T009 编写 `demo/runbook.md` 骨架（故障排查清单模板，L1-07 的载体） — 优先级：P0，预估：1h（依赖 T001b）
- [ ] T010 [P] 配置 Git 分支/Tag 策略，确保"跨层合并前打 tag，可快速回滚"（对应 PRD2 §8.3/8.4，FR-050） — 优先级：P1，预估：0.5h

---

## Phase 2: Foundational（阻断性前置任务）

**Purpose**: 所有用户故事开始前必须完成的核心基础设施

**⚠️ CRITICAL**: 本阶段完成前不得开始任何用户故事的实现

- [ ] T011 配置 `services/minecraft/.env.local`（`OPENAI_API_BASEURL`/`OPENAI_API_KEY`/`OPENAI_MODEL`/`BOT_USERNAME`/`BOT_HOSTNAME`/`BOT_PORT`/`BOT_VERSION`），保持 `ENABLE_MCP_SERVER`/`ENABLE_DEBUG_SERVER`/`ENABLE_MINECRAFT_VIEWER` 为 `false` — 优先级：P0，预估：1h（依赖 T004, T006）
- [ ] T012 验证 AIRI 核心服务可从冷启动进入可用状态（L1-01 前置验证） — 优先级：P0，预估：1h（依赖 T005, T011）
- [ ] T013 按 `contracts/server-sdk-integration.md` 编写一个最小的 `@proj-airi/server-sdk` 客户端示例，验证 `connect()`/`onEvent()`/`send()` 握手可用，作为后续所有外围服务的参考模板，于 `hackathon-services/_shared/sdk-client-example.ts` — 优先级：P0，预估：2h（依赖 T012）
- [ ] T014 编写第一层回归脚本骨架（跑固定演示脚本并断言无阻断级崩溃），供"每次跨层合并必须运行"使用，于 `demo/regression.sh` — 优先级：P0，预估：2h
- [ ] T015 确认 `services/minecraft` 自带 `pnpm test`/`pnpm typecheck` 可正常运行，建立基线 — 优先级：P0，预估：1h（依赖 T012）
- [ ] T016 编写跨层治理检查清单（Stage Gate 判定标准、FR-048/049/050/051 对照表，**含 FR-008 第一层范围排除项逐条核对清单**——语音/第二游戏/模型训练/Agent Arena/长期记忆/语音克隆/自定义人格编辑器/实体硬件/直播推流/移动端主机支持/100ms 延迟承诺均须逐条确认未被引入），于 `demo/stage-gate-checklist.md` — 优先级：P0，预估：1.5h *(对齐 U1)*

**Checkpoint**：基础设施就绪，可开始 User Story 1。

---

## Phase 3: User Story 1 - 保底交付：Project AIRI × Minecraft 全链路打通 (Priority: P1) 🎯 MVP

**Goal**: 部署、配置并连接 AIRI 现有模块到 Minecraft，不新增任何产品功能，验证完整闭环并固化可重复演示脚本。

**Independent Test**: 从冷启动开始，连续三次跑完固定演示脚本（问候/指令响应/简单交互/成功事件/失败事件），无阻断级崩溃。

> 第一层在 PRD2 中整体标注为"必须"（Must Have），因此本阶段全部任务均为 P0——这不是本文档另加的判断，而是直接继承 PRD2 §2 的分级定义。

- [ ] T017 [US1] 执行 `pnpm -F @proj-airi/minecraft-bot dev`，确认 Bot 自动连接 AIRI 与 Minecraft 服务器（L1-01/03） — 优先级：P0，预估：2h（依赖 T013）
- [ ] T018 [US1] 真人测试玩家与 AIRI Bot 分别登录测试世界，确认二者进入同一世界（L1-02） — 优先级：P0，预估：1h（依赖 T017）
- [ ] T019 [US1] 测试"跟我来"意图，验证 Bot 执行跟随（L1-04） — 优先级：P0，预估：1h（依赖 T018）
- [ ] T020 [US1] 测试"停止"意图，验证 Bot 执行停止（L1-04） — 优先级：P0，预估：0.5h（依赖 T019）
- [ ] T021 [US1] 测试"到这里"/移动类意图，验证 Bot 执行移动（L1-04） — 优先级：P0，预估：0.5h（依赖 T019）
- [ ] T022 [US1] 测试至少一类简单交互意图（如开门/拾取），验证 Bot 正确执行（L1-04，累计满足"至少三类动作"验收） — 优先级：P0，预估：1h（依赖 T019）
- [ ] T023 [US1] 制造一次成功事件（如任务完成/资源获得），验证事件回传 AIRI 并产生合理回应（L1-05） — 优先级：P0，预估：1.5h（依赖 T022）
- [ ] T024 [US1] 制造一次失败/不可执行事件，验证 AIRI 产生合理回应而非静默失败（L1-05） — 优先级：P0，预估：1.5h（依赖 T023）
- [ ] T025 [US1] 限定地图、任务与指令范围，固化 3-5 分钟演示脚本文档，于 `demo/tier1-script.md`（L1-06） — 优先级：P0，预估：2h（依赖 T024）
- [ ] T026 [US1] 按固化脚本连续演练 3 次，记录每次结果，确认均无阻断级崩溃（L1-06 验收） — 优先级：P0，预估：2h（依赖 T025）
- [ ] T027 [US1] 整理常见故障列表与 2 分钟恢复步骤（**含"回归失败时 MUST 立即回滚到已打 Tag 的验证版本，不在现场版本上继续调试"的明确策略，对应 PRD2 §10.2**），补全 `demo/runbook.md`（L1-07） — 优先级：P0，预估：2h（依赖 T026） *(对齐 U2)*
- [ ] T028 [US1] 邀请非核心开发者按 `demo/runbook.md` 独立完成一次故障恢复演练，验证 Runbook 可用（L1-07 验收标准之一） — 优先级：P0，预估：1.5h（依赖 T027）
- [ ] T029 [US1] 整理版本清单、环境模板、启动命令为可复现交付包，于 `demo/setup-guide.md`（L1-07） — 优先级：P0，预估：2h（依赖 T028）
- [ ] T030 [US1] 邀请非核心开发者按 `demo/setup-guide.md` 从零复现一次完整启动+演示，验证"非核心开发者可按文档重启演示"（L1-07 验收标准） — 优先级：P0，预估：2h（依赖 T029）
- [ ] T031 [US1] 冻结 AIRI commit 与第一层配置，打版本 Tag（对应 PRD2 §4.4"第一层代码被冻结"） — 优先级：P0，预估：0.5h（依赖 T030）
- [ ] T032 [US1] 运行 `demo/regression.sh`，确认第一层回归脚本可自动化捕捉演示脚本关键步骤 — 优先级：P0，预估：1.5h（依赖 T031）
- [ ] T033 [US1] Gate 1 判定：对照 `demo/stage-gate-checklist.md` 逐项确认第一层达标，正式解锁第二层开发 — 优先级：P0，预估：1h（依赖 T032）

**Checkpoint**：第一层（MVP）应可独立完整演示，Gate 1 通过。

---

## Phase 4: User Story 2 - 真全双工语音（双脑架构）(Priority: P2)

**Goal**: 按 `contracts/full-duplex-architecture.md` 交付真双流语音会话，并通过 Intent Bridge 驱动 Minecraft 工具；**不**实现级联 STT→LLM→TTS + barge-in。

**Independent Test**: AI 出声时上行仍被消费；重叠发言会话不崩；语音「跟随/停止」工具成功率达标；关闭 `duplex-voice` 后第一层仍可演示。

> **架构变更（2026-07-23）**：旧级联 barge-in 作废；默认 Brain A 为 **MiniCPM-o 4.5**（非 PersonaPlex）。任务 ID 仍用 T034–T050。

- [x] T034 [US2] 选定 Brain A：**默认 MiniCPM-o-4_5 + MiniCPM-o-Demo**（备胎 PersonaPlex/Moshi）；记录权重、Docker 后端（PyTorch vs llama.cpp-omni）、端口、Realtime API URL 到 `demo/version-matrix.md`（对照架构 §1a、§5.2） — 优先级：P0，预估：2h（依赖 Gate 1 / T033） — **代码侧完成 2026-07-23；现场 URL/GPU 待你填写**
- [x] T035 [US2] 搭建 `hackathon-services/duplex-voice/`：以 **Intent Bridge + game-tools** 为主；README 写清与 MiniCPM-o-Demo Gateway 的旁路关系 — 优先级：P0，预估：2h（依赖 T001b, T034）
- [ ] T036 [US2] 按官方文档部署 MiniCPM-o-Demo（Docker Gateway/Worker/Backend），打通 **Audio Full-Duplex** 页可对话 — 优先级：P0，预估：6h（依赖 T034） — **需你本机/GPU 操作**
- [x] T037 [US2] 实现薄适配：订阅 Demo/Realtime 的文本/事件旁路（或官方 Realtime API），供 Intent Bridge 消费 — 优先级：P0，预估：5h（依赖 T036） — **客户端已实现；联调依赖 T036**
- [ ] T038 [US2] 验证真双流：AI 出声时上行仍被消费；重叠发言不崩（FR-009） — 优先级：P0，预估：2h（依赖 T036） — **需你人工验收**
- [x] T039 [US2] 实现 Intent Bridge MVP：规则闸门「跟我来/停下/到这里」→ tool — 优先级：P0，预估：4h（依赖 T037）
- [x] T040 [US2] 实现 game-tools → `@proj-airi/server-sdk`（follow/stop/move + `task.cancel`） — 优先级：P0，预估：5h（依赖 T039, T013）
- [ ] T041 [US2] 语音指令测试：跟随/停止各 10 次，目标 ≥8/10 — 优先级：P1，预估：2h（依赖 T040） — **需你人工**
- [ ] T042 [US2] 重叠发言压力测试 ≥10 次 — 优先级：P1，预估：2h（依赖 T038） — **需你人工**
- [x] T043 [US2] 回声策略：演示默认耳机；文档化外放限制 — 优先级：P0，预估：1.5h（依赖 T036）
- [x] T044 [US2] 延迟埋点：minicpm-demo / intent-bridge / tool / action — 优先级：P0，预估：2h（依赖 T040）
- [ ] T045 [US2] 人为慢响应，验证可定位阶段（FR-014） — 优先级：P1，预估：1h（依赖 T044） — **联调时做**
- [x] T046 [P] [US2] 文本输入降级通道 — 优先级：P1，预估：1.5h — **stdin 已实现**
- [ ] T047 [US2] 端到端联调：MiniCPM-o 双流 + 语音工具 + 杀 Demo/Bridge 后第一层仍可用 — 优先级：P0，预估：4h（依赖 T041, T042, T043, T045） — **需你联调**
- [ ] T048 [US2] Gate 2A 判定：对照架构 §8 与 FR-009~014a — 优先级：P0，预估：1h（依赖 T047）
- [x] T049 [P] [US2] 契约/集成测试于 `hackathon-services/duplex-voice/**/tests/` — 优先级：P1，预估：3h
- [x] T050 [P] [US2] 编写 `demo/duplex-runbook.md`：MiniCPM-o-Demo + Bridge + AIRI 启动顺序与故障 — 优先级：P1，预估：2h（依赖 T048） — **文档已写；Gate 判定仍待联调后**

**Checkpoint**：第一层 + 真全双工第二层 A 可独立演示，Gate 2A 通过。

---

## Phase 5: User Story 3 - 统一 Game Adapter 与 DST 第二游戏迁移 (Priority: P3)

**Goal**: 定义统一契约，包装 Minecraft 链路，新增 DST 适配，验证同一套高层意图可跨游戏复用。

**Independent Test**: 同一组高层意图分别在 Minecraft 与 DST 执行跟随/停止/采集；第一层回归测试仍通过。

- [x] T051 [US3] 按 `contracts/game-adapter-contract.md` 定义 Adapter 契约的 TypeScript 类型（observe/act/events/capabilities/health），于 `hackathon-services/game-adapter/src/contract/types.ts` — 优先级：P0，预估：2.5h — **完成 2026-07-23（Gate 1 通过后启动）**
- [x] T052 [US3] 定义统一 GameState Schema（角色位置/生命/饥饿/精神值/附近实体/资源/危险/任务状态），于 `hackathon-services/game-adapter/src/contract/game-state.ts`（G2-01，MUST） — 优先级：P0，预估：2h（依赖 T051） — **完成 2026-07-23**
- [x] T053 [US3] 定义统一 Action Schema（follow/move/collect/interact/stop/say），于 `hackathon-services/game-adapter/src/contract/actions.ts`（G2-02，MUST） — 优先级：P0，预估：1.5h（依赖 T051） — **完成 2026-07-23**
- [x] T054 [US3] 实现 Minecraft Adapter：包装 `services/minecraft` 的 `action-registry.ts`/`task-executor.ts`，不修改其内部逻辑，于 `hackathon-services/game-adapter/src/minecraft-adapter/index.ts`（G2-03，MUST） — 优先级：P0，预估：4h（依赖 T052, T053） — **完成 2026-07-23（DI 注入 performAction，不改 MC 内部）**
- [x] T055 [US3] 实现 Minecraft Adapter 的 `observe()`：从既有 Perception 层状态映射到统一 GameState — 优先级：P0，预估：2h（依赖 T054） — **完成 2026-07-23（readSnapshot 投影 + sanity=null）**
- [x] T056 [US3] 实现 Minecraft Adapter 的 `events()`：转发既有 Perception 事件总线事件并做形状归一化 — 优先级：P0，预估：2h（依赖 T054） — **完成 2026-07-23（normalizePerceptionEvent）**
- [x] T057 [US3] 实现 Minecraft Adapter 的 `capabilities()`/`health()` — 优先级：P0，预估：1.5h（依赖 T054） — **完成 2026-07-23**
- [ ] T058 [US3] 运行第一层回归脚本，确认 Minecraft Adapter 包装后原有演示仍可通过（G2-03 验收） — 优先级：P0，预估：2h（依赖 T055, T056, T057, T014）
- [ ] T059 [US3] 编写 Klei DST 服务端 Mod（Lua），暴露角色位置/生命/饥饿/精神值/附近实体/资源/危险状态，于 `hackathon-services/dst-bridge/mod/`（research.md §4） — 优先级：P0，预估：5h
- [ ] T060 [US3] 编写 DST Mod 的动作接收接口（follow/move/collect/interact/stop/say），于 `hackathon-services/dst-bridge/mod/actions.lua` — 优先级：P0，预估：4h（依赖 T059）
- [ ] T061 [US3] 实现 Node.js 本地桥接进程，转发 Mod 状态/事件/动作，于 `hackathon-services/dst-bridge/bridge/index.ts`（G2-04，MUST） — 优先级：P0，预估：4h（依赖 T060）
- [ ] T062 [US3] 桥接进程接入 `@proj-airi/server-sdk` 事件总线（参考 T013 模板） — 优先级：P0，预估：2h（依赖 T061, T013）
- [ ] T063 [US3] 验证 AI 角色可进入受控 DST 世界并执行最小动作集（G2-04 验收） — 优先级：P0，预估：2h（依赖 T062）
- [ ] T064 [US3] 实现 DST Adapter：把 DST 状态/动作映射到统一契约，于 `hackathon-services/game-adapter/src/dst-adapter/index.ts`（G2-05，MUST） — 优先级：P0，预估：3h（依赖 T052, T053, T062）
- [ ] T065 [US3] 验证同一意图"跟随/停止/收集"可在 DST 中正确执行（G2-05 验收） — 优先级：P0，预估：1.5h（依赖 T064）
- [ ] T066 [US3] 跨游戏代码审查：确认核心编排逻辑未被复制，仅 Adapter/Bridge 层不同（G2-06，MUST） — 优先级：P0，预估：2h（依赖 T057, T065）
- [ ] T067 [US3] 为每个动作实现超时、重试与取消机制（§5.3，SHOULD） — 优先级：P1，预估：2.5h（依赖 T054, T064）
- [ ] T068 [US3] 实现 `capabilities()` 对不支持动作立即返回可解释失败，而非静默挂起（§5.3） — 优先级：P1，预估：1.5h（依赖 T057）
- [ ] T069 [US3] 端到端联调：同一组高层意图分别在 Minecraft 与 DST 执行跟随/停止/采集（quickstart.md 场景 C） — 优先级：P0，预估：3h（依赖 T065, T066）
- [ ] T070 [US3] Gate 2B 判定：确认 DST 适配器复用同一上层意图与任务编排接口 — 优先级：P0，预估：1h（依赖 T069）
- [ ] T071 [P] [US3] 编写 Game Adapter 契约的契约测试（对两个 Adapter 实现跑同一套断言），于 `hackathon-services/game-adapter/tests/contract/` — 优先级：P1，预估：3h（依赖 T057, T065）

**Checkpoint**：第一层 + 第二层 A/B 均应可独立正常工作，Gate 2B 通过；只要 Gate 2A 或 Gate 2B 任一稳定即可投入第三层。

---

## Phase 6: User Story 4 - 游戏专用本地 SLM/SSM 反射模型 (Priority: P4，可选)

**Goal**: 训练本地反射模型，验证正确率与延迟收益，低置信度时自动回退 AIRI。

**Independent Test**: 现场对比模型与 AIRI 基线；断开模型服务验证主链路继续运行。

> 第三层整体在 PRD2 中标注为"可选"（Stretch），因此本阶段大部分任务为 P1/P2；只有"故障隔离/回退"相关任务因 SC-009 被单独标注为"必须"而保留 P0。

- [ ] T072 [US4] 限定动作边界（follow/stop/collect/interact/avoid/return，至少 5 类），排除开放式聊天，于 `hackathon-services/slm-training/action-labels.md`（M3-01） — 优先级：P1，预估：1.5h（依赖 Gate 2A 或 2B 达成，即 T049 或 T070 通过） *(对齐 I1)*
- [ ] T073 [US4] 整合人工标注/规则生成/教师模型标注/已有轨迹，构建最小数据集，于 `hackathon-services/slm-training/datasets/`（M3-02） — 优先级：P1，预估：5h（依赖 T072）
- [ ] T074 [US4] 编写 Dataset Manifest（来源、版本、许可、训练/测试集划分说明），于 `hackathon-services/slm-training/datasets/manifest.md` — 优先级：P1，预估：1.5h（依赖 T073）
- [ ] T075 [US4] 验证训练集与测试集无重复（M3-02 验收） — 优先级：P1，预估：1h（依赖 T074）
- [ ] T076 [US4] 选择轻量 Transformer SLM 或 SSM 架构，编写训练脚本（行为克隆/监督微调/策略蒸馏），于 `hackathon-services/slm-training/train.py`（M3-03） — 优先级：P1，预估：5h（依赖 T075）
- [ ] T077 [US4] 在目标机器/单卡上完成训练或加载既有训练结果，产出模型权重（M3-03 验收） — 优先级：P1，预估：4h（依赖 T076）
- [ ] T078 [US4] 编写离线评测脚本，计算动作正确率、推理延迟、错误类型，于 `hackathon-services/slm-training/eval/offline_eval.py`（M3-04） — 优先级：P1，预估：3h（依赖 T077）
- [ ] T079 [US4] 运行离线评测，确认动作正确率 ≥90% 目标且报告可复现（M3-04 验收，对应 SC-007"可选"级） — 优先级：P1，预估：2h（依赖 T078）
- [ ] T080 [US4] 将模型导出为 ONNX 格式，于 `hackathon-services/slm-training/export_onnx.py` — 优先级：P1，预估：2h（依赖 T077）
- [ ] T081 [US4] 实现 ONNX 推理桥接：用 `onnxruntime-node` 在 Node.js 内加载模型，于 `hackathon-services/slm-inference-bridge/src/inference.ts` — 优先级：P1，预估：3h（依赖 T080）
- [ ] T082 [US4] 实现置信度路由：模型输出动作/参数/置信度，低置信度或未知任务时回退 AIRI，于 `hackathon-services/slm-inference-bridge/src/router.ts`（M3-05） — 优先级：P0，预估：3h（依赖 T081）
- [ ] T083 [US4] 将推理桥接接入 `services/minecraft` 的 `reflex-manager.ts`（最小侵入式修改，合并前打 Tag 便于回滚） — 优先级：P0，预估：3h（依赖 T082）
- [ ] T084 [US4] 运行第一层回归脚本，确认接入 SLM 后不破坏第一层基线（FR-050） — 优先级：P0，预估：1.5h（依赖 T083, T014）
- [ ] T085 [US4] 现场关闭模型服务，验证自动回退 AIRI 基线且主链路继续运行（M3-05 验收，对应 SC-009"必须"级） — 优先级：P0，预估：1.5h（依赖 T083）
- [ ] T086 [US4] 在固定 Demo 场景人工重复测试，对比模型与 AIRI 基线的成功率/延迟（M3-06） — 优先级：P1，预估：3h（依赖 T085）
- [ ] T087 [US4] 确认决策延迟相比 AIRI 基线降低 ≥50% 且成功率无明显下降（M3-06 验收，对应 SC-007"可选"级） — 优先级：P1，预估：1.5h（依赖 T086）
- [ ] T088 [US4] 端到端联调（quickstart.md 场景 D） — 优先级：P1，预估：2h（依赖 T079, T087）
- [ ] T089 [P] [US4] 编写训练/评测脚本的可复现性说明文档，于 `hackathon-services/slm-training/README.md` — 优先级：P2，预估：1.5h

**Checkpoint**：若本轨道被选择，第三层 A 完成后第一、二层不受影响（可通过关闭模型服务验证）。

---

## Phase 7: User Story 5 - 实体硬件桌宠具身体验 (Priority: P5，可选)

**Goal**: 实体硬件消费统一体验事件，转化为表情/灯光/动作/声音，故障时不影响主链路。

**Independent Test**: 触发 ≥5 类事件验证可区分；拔电/断网验证主链路不受影响。

> 与第三层 A 同理，故障隔离相关任务因 SC-009"必须"保留 P0，其余体验质量目标为 P1/P2。

- [ ] T090 [US5] 选定硬件形态（ESP32 或 Raspberry Pi）并准备屏幕、LED、舵机或扬声器组件（H3-01） — 优先级：P1，预估：2h（依赖 Gate 2A 或 2B 达成，即 T049 或 T070 通过） *(对齐 I1)*
- [ ] T091 [US5] 按 `contracts/experience-event-schema.md` 定义体验事件 Schema 的 TypeScript/固件双端类型，于 `hackathon-services/hardware-companion/experience-event-schema/` — 优先级：P1，预估：2h
- [ ] T092 [US5] 编写基础固件，使设备上电后可独立进入待机状态（H3-01 验收） — 优先级：P1，预估：3h（依赖 T090）
- [ ] T093 [US5] 实现通信桥接进程（WebSocket/MQTT/串口三选一），接入 `@proj-airi/server-sdk` 事件总线，于 `hackathon-services/hardware-companion/bridge/index.ts`（H3-03） — 优先级：P1，预估：3h（依赖 T091, T013）
- [ ] T094 [US5] 实现事件消费的节流、超时与状态覆盖处理（H3-03） — 优先级：P1，预估：2.5h（依赖 T093）
- [ ] T095 [US5] 连续事件压力测试，确认无明显卡死或状态混乱（H3-03 验收） — 优先级：P1，预估：1.5h（依赖 T094）
- [ ] T096 [US5] 设计事件到表情/灯光/动作/口型/音效的映射表，于 `hackathon-services/hardware-companion/mapping-table.md`（H3-04） — 优先级：P1，预估：2h（依赖 T091）
- [ ] T097 [US5] 实现映射逻辑，确认至少 5 类状态肉眼可清晰区分（H3-04 验收，对应 SC-008"可选"级） — 优先级：P1，预估：3h（依赖 T092, T096）
- [ ] T098 [US5] 实现语音同步（AI 说话时口型/灯效与音频开始/结束保持同步，H3-05，SHOULD；需 User Story 2 的 TTS 输出） — 优先级：P2，预估：3h（依赖 T097, T037）
- [ ] T099 [US5] 实现桌宠独立进程运行与断线重连逻辑（H3-06） — 优先级：P0，预估：2h（依赖 T093）
- [ ] T100 [US5] 代码审查：确认硬件通信桥接进程未读取模型内部思维链、未向游戏控制链路写入任何指令（FR-036） — 优先级：P1，预估：1h（依赖 T093, T099） *(新增，对齐 U1)*
- [ ] T101 [US5] 实现浏览器软件状态卡降级方案，复用同一 Experience Event 协议，于 `hackathon-services/hardware-companion/software-fallback/` — 优先级：P1，预估：2.5h（依赖 T091）
- [ ] T102 [US5] 现场拔电测试，验证主 Demo（第一、二层）继续运行不受影响（H3-06 验收，对应 SC-009"必须"级） — 优先级：P0，预估：1h（依赖 T099）
- [ ] T103 [US5] 现场断网测试，验证主 Demo 不受影响（H3-06 验收） — 优先级：P0，预估：1h（依赖 T099）
- [ ] T104 [US5] 关闭桌宠进程测试，验证主 Demo 不受影响（H3-06 验收） — 优先级：P0，预估：1h（依赖 T099）
- [ ] T105 [US5] 端到端联调（quickstart.md 场景 E） — 优先级：P1，预估：2h（依赖 T097, T102, T103, T104）
- [ ] T106 [US5] 运行 `demo/regression.sh`，确认接入硬件桌宠事件消费后不破坏第一层基线（FR-050） — 优先级：P0，预估：1h（依赖 T105） *(新增，对齐 C1)*
- [ ] T107 [P] [US5] 编写硬件组装与烧录说明文档，于 `hackathon-services/hardware-companion/firmware/README.md` — 优先级：P2，预估：1.5h

**Checkpoint**：若本轨道被选择，第三层 B 完成后第一、二层不受影响（可通过拔电/断网/关进程/回归脚本验证）。

---

## Phase 8: User Story 6 - 研究型增强验证：Agent Arena / Replay-to-Skill / Shadow Observer（任选其一）(Priority: P6，可选)

**Goal**: 从三个研究方向中至少完成一项，形成可重复证据或受控演示。

**Independent Test**: 任选子方向按其验收标准独立验证；关闭该模块后前三层不受影响。

> 第四层整体优先级最低（PRD2 §2.1 明确"优先级低于第三层"），除"研究模块隔离"（SC-013"必须"）外，其余任务统一为 P2。团队只需完成三个子方向之一即可满足本故事，其余两个子方向的任务可不执行。三个子方向均新增了对称的"关闭后前三层不受影响"验证任务（T116/T124/T131），不再仅 Shadow Observer 一个方向有此验证。

### 子方向 a：Agent Arena

- [ ] T108 [US6] 建立标准任务定义（follow/collect/stop-danger 等至少 3 个）与世界快照，于 `hackathon-services/agent-arena/tasks/`（A4-01） — 优先级：P2，预估：3h
- [ ] T109 [US6] 实现场景自动初始化与复位脚本，复用 Game Adapter 的 `act()`（A4-01） — 优先级：P2，预估：3h（依赖 T108, T053）
- [ ] T110 [US6] 定义统一轨迹 Schema（状态/指令/动作/事件/结果/各阶段延迟），于 `hackathon-services/agent-arena/trajectory-schema.ts`（A4-02） — 优先级：P2，预估：2h
- [ ] T111 [US6] 实现 Arena Runner：同一场景连续自动运行 10 轮，于 `hackathon-services/agent-arena/runner.ts`（A4-03） — 优先级：P2，预估：4h（依赖 T109, T110）
- [ ] T112 [US6] 实现指标与失败归因报告生成，于 `hackathon-services/agent-arena/report.ts`（A4-04） — 优先级：P2，预估：3h（依赖 T111）
- [ ] T113 [US6] 按场景/种子隔离数据划分，冻结版本，避免轨迹泄漏（A4-05） — 优先级：P2，预估：1.5h（依赖 T111）
- [ ] T114 [US6] 保存 AIRI 基线运行结果，支持可选加入第三层模型对比（A4-06） — 优先级：P2，预估：2h（依赖 T112）
- [ ] T115 [US6] 端到端验证：3 个任务各自动运行 10 轮并生成报告（quickstart.md 场景 F-Arena） — 优先级：P2，预估：2h（依赖 T113, T114）
- [ ] T116 [US6] 验证关闭 Agent Arena 后前三层任务执行不受影响（对应 SC-013"必须"级） — 优先级：P0，预估：1h（依赖 T115） *(新增，对齐 C2)*

### 子方向 b：Replay-to-Skill

- [ ] T117 [US6] 收集已确认成功的候选轨迹（Arena 或人工录制），于 `hackathon-services/replay-to-skill/candidates/`（S4-01） — 优先级：P2，预估：2h
- [ ] T118 [US6] 实现轨迹抽象：坐标/对象 → 目标/条件/动作/终止条件，于 `hackathon-services/replay-to-skill/abstraction.ts`（S4-02） — 优先级：P2，预估：4h（依赖 T117）
- [ ] T119 [US6] 实现技能生成（行为树/FSM/参数化定义，含进入/成功/超时/失败/取消五分支），于 `hackathon-services/replay-to-skill/skill-generator.ts`（S4-03） — 优先级：P2，预估：4h（依赖 T118）
- [ ] T120 [US6] 实现人工确认与沙箱测试流程（Review Gate），于 `hackathon-services/replay-to-skill/review-gate.ts`（S4-04） — 优先级：P2，预估：2.5h（依赖 T119）
- [ ] T121 [US6] 实现技能安全执行（通过 Game Adapter `act()`，支持 cancel/timeout/回退，S4-05） — 优先级：P2，预估：2.5h（依赖 T120, T053）
- [ ] T122 [US6] 在不同初始位置连续运行 3 次，验证至少成功 2 次，且"停止"可中断（S4-06 验收） — 优先级：P2，预估：2h（依赖 T121）
- [ ] T123 [US6] 端到端验证（quickstart.md 场景 F-Replay） — 优先级：P2，预估：1.5h（依赖 T122）
- [ ] T124 [US6] 验证关闭 Replay-to-Skill 后前三层任务执行不受影响（对应 SC-013"必须"级） — 优先级：P0，预估：1h（依赖 T123） *(新增，对齐 C2)*

### 子方向 c：Shadow Observer

- [ ] T125 [US6] 实现低帧率画面采集，确认不明显影响游戏帧率，于 `hackathon-services/shadow-observer/capture.ts`（W4-01） — 优先级：P2，预估：3h
- [ ] T126 [US6] 定义至少 3 类视觉事件（低血量/附近危险/目标资源或UI完成），于 `hackathon-services/shadow-observer/vision-event-schema.ts`（W4-02） — 优先级：P2，预估：2h
- [ ] T127 [US6] 接入现有或轻量视觉检测模型，输出事件与置信度，于 `hackathon-services/shadow-observer/observer-service.ts`（W4-03） — 优先级：P2，预估：4h（依赖 T125, T126）
- [ ] T128 [US6] 验证画面到事件延迟 ≤1 秒（W4-03 验收） — 优先级：P2，预估：1.5h（依赖 T127）
- [ ] T129 [US6] 实现视觉事件与 Adapter 结构化状态的一致性/漏检/误报对照，于 `hackathon-services/shadow-observer/cross-check.ts`（W4-04） — 优先级：P2，预估：3h（依赖 T127, T055）
- [ ] T130 [US6] 将视觉事件接入 AIRI 既有 Perception 事件总线作为只读事件源（W4-05） — 优先级：P2，预估：2.5h（依赖 T127）
- [ ] T131 [US6] 验证关闭视觉服务后任务执行不受影响（W4-05 验收，对应 SC-013"必须"级） — 优先级：P0，预估：1h（依赖 T130）
- [ ] T132 [US6] 在预设场景测试三类事件识别准确率，确认 ≥80% 目标（W4-06 验收） — 优先级：P2，预估：2h（依赖 T129）
- [ ] T133 [US6] 端到端验证（quickstart.md 场景 F-Shadow） — 优先级：P2，预估：1.5h（依赖 T131, T132）

### 收尾

- [ ] T134 [US6] 运行 `demo/regression.sh`，确认接入已完成的第四层模块后不破坏第一层基线（FR-050） — 优先级：P0，预估：1h（依赖 T116 或 T124 或 T133 任一完成） *(新增，对齐 C1)*
- [ ] T135 [US6] 团队按成功概率择一（或多个）子方向完成 Definition of Done 判定，于 `demo/tier4-selection.md` — 优先级：P2，预估：1h（依赖 T134）

**Checkpoint**：若第四层任一子方向被选择并完成，前三层不受影响（可通过关闭该模块+回归脚本验证）。

---

## Phase 9: Polish & Cross-Cutting Concerns

**Purpose**: 影响多个层级的收尾工作

- [ ] T136 [P] 完善 `demo/runbook.md` 覆盖全部已完成层级的已知故障与降级步骤（对照 spec.md Edge Cases 与 PRD2 §10.1 风险表，含 T027 已明确的回归失败回滚策略） — 优先级：P1，预估：3h
- [ ] T137 [P] 录制第一层保底 Demo 完整视频作为兜底备份 — 优先级：P1，预估：1.5h
- [ ] T138 [P] 录制第二层竞争力 Demo 完整视频作为兜底备份 — 优先级：P1，预估：1.5h
- [ ] T139 [P] 若第三/四层有稳定主线，录制对应 Demo 视频作为兜底备份 — 优先级：P2，预估：1.5h
- [ ] T140 每日/每阶段执行"先修阻断，再修瑕疵，最后做新功能"检查（§8.4），记录到 `demo/daily-log.md` — 优先级：P1，预估：每次 0.5h（持续性任务）
- [ ] T141 距最终演示剩余时间不足总周期 20% 时，执行范围冻结：停止新功能开发，只做稳定化（§0.2, §8.4） — 优先级：P0，预估：0.5h（触发式决策任务）
- [ ] T142 [P] 编写整体交付说明文档，汇总各层完成情况与已知限制，于 `demo/delivery-summary.md` — 优先级：P1，预估：2h（依赖已完成的用户故事阶段）
- [ ] T143 安全复查：确认 MCP Server/Debug Server/Prismarine Viewer 等调试端口均未暴露公网（对照 plan.md 安全约束） — 优先级：P0，预估：1h
- [ ] T144 [P] 安全复查：确认所有新增外围服务未提供任何绕过反作弊或破坏公平性的能力（FR-051） — 优先级：P0，预估：1.5h
- [ ] T145 最终运行 `demo/regression.sh` 全量回归，确认第一层基线仍然稳定 — 优先级：P0，预估：1h（依赖 T142）

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup（Phase 1）**：无前置依赖，可立即开始（对应 PRD2 Phase 0）
- **Foundational（Phase 2）**：依赖 Phase 1 完成——**阻断所有用户故事**
- **User Story 1（Phase 3）**：依赖 Phase 2 完成；**Gate 1 未通过则禁止开始 Phase 4 及以后的任何开发**（FR-048，PRD2 §10.2 全局停止条件）
- **User Story 2 / 3（Phase 4 / 5）**：依赖 Gate 1 通过；二者相互独立，可并行，也可按成功概率择一优先（PRD2 §2.2 推荐决策路径）
- **User Story 4 / 5（Phase 6 / 7）**：依赖 Gate 2A（T049）或 Gate 2B（T070）至少一项通过（FR-048）——T072、T090 已显式标注此依赖；二者相互独立，团队按能力择一或都做
- **User Story 6（Phase 8）**：依赖第三层至少一条主线稳定（PRD2 §2.2）；三个子方向互斥于"至少完成一个"，不要求全部完成
- **Polish（Phase 9）**：贯穿全程（T140/T141 为持续性/触发式任务），收尾任务（T142/T145）依赖已完成的用户故事阶段

### User Story Dependencies

- **User Story 1 (P1)**：Phase 2 完成后即可开始，不依赖其他用户故事——**MVP，第一层，必须交付**
- **User Story 2 (P2)**：Gate 1 通过后可开始；与 User Story 3 相互独立
- **User Story 3 (P3)**：Gate 1 通过后可开始；与 User Story 2 相互独立；其 Minecraft Adapter 包装需在 User Story 1 冻结的基线上进行
- **User Story 4 (P4，可选)**：Gate 2A（T049）或 Gate 2B（T070）通过后可开始（见 T072 依赖标注）；与 User Story 5 相互独立；其模型需接入的 `reflex-manager.ts` 来自 AIRI 既有代码，不依赖 User Story 2/3 的新增代码
- **User Story 5 (P5，可选)**：Gate 2A（T049）或 Gate 2B（T070）通过后可开始（见 T090 依赖标注）；与 User Story 4 相互独立；T098（语音同步）例外地依赖 User Story 2 的 TTS 输出（跨故事集成点，不影响故事整体独立性）
- **User Story 6 (P6，可选)**：第三层至少一条主线稳定后可开始；三个子方向均复用 User Story 3 的 Game Adapter 契约（`observe/act/events`），不依赖 User Story 4/5 的具体实现；每个已完成子方向均须在收尾阶段（T134）跑一次第一层回归脚本，再进入 DoD 判定（T135）

### Parallel Opportunities

- Phase 1/2 中标 [P] 的任务可并行
- Gate 1 通过后，User Story 2 与 User Story 3 可由不同人员并行推进
- 第三层解锁后，User Story 4 与 User Story 5 可由不同人员并行推进（分别需要模型/ML 背景与嵌入式/硬件背景）
- User Story 6 的三个子方向互相独立，若团队人力允许可并行探索，最终只需保留一个作为主 Demo

---

## Parallel Example: Gate 1 通过后

```bash
# User Story 2（真全双工）与 User Story 3（Adapter+DST）可并行推进：
Task: "部署 MiniCPM-o-Demo Audio Full-Duplex 并接 Intent Bridge"
Task: "定义统一 GameState Schema 于 hackathon-services/game-adapter/src/contract/game-state.ts"

# 第三层解锁后，User Story 4（模型）与 User Story 5（硬件）可并行推进：
Task: "整合数据集，构建最小训练集于 hackathon-services/slm-training/datasets/"
Task: "编写基础固件，使设备上电后可独立进入待机状态"
```

---

## Implementation Strategy

### 当前下一步（2026-07-23）

1. **立刻**：T001b 创建 `hackathon-services/`、`demo/` → T003/T004 写 `demo/version-matrix.md` → T005 安装 pnpm 并 `pnpm i`
2. **随后**：T006 MC 测试服 + T011 `.env.local` → T012~T016 Foundational → Phase 3 冲 Gate 1
3. 剩余估算（相对原总表）：Setup 约 **6.5h 剩余**（T002 已完成；T001 部分完成）；Foundational ~8.5h + US1 ~24.5h 仍全部待做

### 保底优先（仅 User Story 1）

1. 完成 Phase 1：Setup（原约 8h；当前约剩 6.5h）
2. 完成 Phase 2：Foundational（约 8.5h，关键阻断项）
3. 完成 Phase 3：User Story 1（约 24.5h，含 Runbook 与可复现性验证）
4. **Gate 1 判定**：对照 `demo/stage-gate-checklist.md`
5. 若通过，项目已"可交付"（对应 PRD2 最终交付判断："第一层完成 = 项目可以交付"）

### 增量交付

1. Setup + Foundational 完成 → 基础就绪
2. 完成 User Story 1 → Gate 1 判定通过 → **项目可交付**
3. 完成 User Story 2 和/或 User Story 3 → Gate 2A/2B 判定 → **项目具备明显竞争力**
4. 完成 User Story 4 和/或 User Story 5（团队按能力择一或都做）→ **项目获得专用模型壁垒或强具身记忆点**
5. 完成 User Story 6 任一子方向 → **项目具备自动评测/技能学习/无接口视觉迁移的研究扩展性**
6. 任一层级停止或失败，不影响已完成的更低层级继续演示（FR-049）

### 多人并行策略（对应 PRD2 §8.2 建议团队并行方式）

- **AIRI/基础设施负责人**：Phase 0-9 全程守护第一层基线，版本锁定、启动、模型配置、回归脚本
- **Minecraft 负责人**：Phase 3 第一层验证；Phase 5 Minecraft Adapter 包装
- **语音负责人**：Phase 4（User Story 2）
- **DST/适配层负责人**：Phase 5（User Story 3）
- **模型负责人**：Gate 2 后进入 Phase 6（User Story 4）
- **硬件/体验负责人**：Gate 1 后可用 Mock 体验事件提前开发；Gate 2 后正式进入 Phase 7（User Story 5）
- **研究增强负责人**：第三层主线冻结后进入 Phase 8（User Story 6）

---

## Notes

- `[P]` 任务 = 不同文件、无依赖，可并行
- `[Story]` 标签用于将任务追溯到具体用户故事（对应 PRD2 层级）
- 优先级（P0/P1/P2）直接继承 PRD2 自身的"必须/目标/可选"三级分类，而非另造标准——第一层全部 P0；第二层区分"机制本身 MUST"（P0）与"量化达标验收 目标"（P1）；第三、四层区分"故障隔离/研究隔离 必须"（P0）与其余"可选"能力（P1/P2）
- 预估时间按用户要求标注在每条任务末尾，独立于 `[P]` 并行标记与 `[Story]` 标签
- 测试任务已按 plan.md 中确立的测试策略融入各故事流程，未采用严格 TDD 顺序（spec.md 与本次任务生成请求均未显式要求 TDD）
- 每个用户故事应可独立完成与验证；User Story 4/5 之间、以及 User Story 6 三个子方向之间互不阻塞
- 完成任务后建议提交（commit）并打 Tag，到达任一 Gate/Checkpoint 时停下独立验证
- 避免：模糊任务描述、同文件冲突、破坏第一层基线的跨层强依赖（对照 FR-050 每次跨层合并须跑回归脚本——现已对 Phase 6/7/8 全部补齐对应任务）
- **路径别名**：文中若仍出现 `airi/...`，一律映射到仓库根对应路径（例如 `airi/services/minecraft` → `services/minecraft`）
