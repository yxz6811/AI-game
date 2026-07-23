# Tasks: AI 游戏队友（实时语音 AI 队友系统）

**Input**: Design documents from `/specs/001-ai-game-teammate/`

**Prerequisites**: plan.md、spec.md、research.md、data-model.md、contracts/、quickstart.md（均已就绪）

**任务优先级说明（应用户要求，独立于下方 `[Story]` 标签）**：
- **P0** = 关键路径/阻断性任务，必须尽早完成，缺失则后续任务无法进行或 MVP 无法演示
- **P1** = 重要任务，支撑用户故事完整交付，但不阻断更基础的工作
- **P2** = 增强/打磨任务，可在核心路径完成后进行，延后不影响 MVP 可用性

每个任务后以 `— 优先级：Pn，预估：Xh` 形式标注。预估以单人专注工时计，不含评审/联调等待时间。

**Organization**: 按用户故事分组（US1=spec.md User Story 1 / P1，US2=User Story 2 / P2，US3=User Story 3 / P3），组内进一步按感知/操控/语音/可靠性等技术维度细分，便于并行认领。

## Format: `[ID] [P?] [Story] Description — 优先级，预估`

- **[P]**：可与其他标记 [P] 的任务并行执行（不同文件、无相互依赖）
- **[Story]**：任务所属用户故事（US1/US2/US3），Setup/Foundational/Polish 阶段不标注
- 每个任务包含明确文件路径

## Path Conventions（对应 plan.md Project Structure）

```
services/bot-client/          # Node.js/TypeScript — Minecraft 协议连接 + 本地反射层
services/strategy-service/    # Python — 云端 AI 大脑（Claude API 调用、语音管线、人设）
services/player-voice-client/ # 玩家端语音采集/播放
```

---

## Phase 1: Setup（共享基础设施）

**Purpose**: 项目初始化与基础工程结构

- [ ] T001 按 plan.md Project Structure 创建 `services/bot-client/`、`services/strategy-service/`、`services/player-voice-client/` 三个目录骨架 — 优先级：P0，预估：0.5h
- [ ] T002 [P] 初始化 `services/bot-client` 的 Node.js/TypeScript 项目（`package.json`、`tsconfig.json`） — 优先级：P0，预估：1h
- [ ] T003 [P] 初始化 `services/strategy-service` 的 Python 项目（`pyproject.toml`、虚拟环境） — 优先级：P0，预估：1h
- [ ] T004 [P] 初始化 `services/player-voice-client` 项目骨架 — 优先级：P0，预估：0.5h
- [ ] T005 [P] 在 `services/bot-client` 安装 `mineflayer`、`mineflayer-pathfinder`、`mineflayer-pvp`、`ws` 依赖 — 优先级：P0，预估：0.5h
- [ ] T006 [P] 在 `services/strategy-service` 安装 `anthropic`、`fastapi`、`uvicorn`、`websockets`、`pydantic` 依赖 — 优先级：P0，预估：0.5h
- [ ] T007 [P] 配置 `services/bot-client` 的 ESLint + Prettier — 优先级：P1，预估：1h
- [ ] T008 [P] 配置 `services/strategy-service` 的 ruff/black + mypy — 优先级：P1，预估：1h
- [ ] T009 配置两个服务的环境变量管理（`.env.example`，含 `ANTHROPIC_API_KEY`、Minecraft 账号凭证占位、WebSocket 端口） — 优先级：P0，预估：1h
- [ ] T010 编写 Docker Compose 配置，启动本地 Minecraft Java 版测试服务端（Paper，启用 RCON/命令接口，对应 research.md §4） — 优先级：P0，预估：1.5h
- [ ] T011 [P] 搭建 CI 骨架（push 时执行两个服务的 lint + 类型检查） — 优先级：P1，预估：1h

---

## Phase 2: Foundational（阻断性前置任务）

**Purpose**: 所有用户故事开始前必须完成的核心基础设施

**⚠️ CRITICAL**: 本阶段完成前不得开始任何用户故事的实现

- [ ] T012 [P] 按 `contracts/websocket-protocol.md` 定义 WebSocket 消息类型（TypeScript）于 `services/bot-client/src/ws-client/protocol-types.ts` — 优先级：P0，预估：2h
- [ ] T013 [P] 按 `contracts/websocket-protocol.md` 定义 WebSocket 消息类型（Python pydantic 模型）于 `services/strategy-service/src/api/protocol_models.py` — 优先级：P0，预估：2h
- [ ] T014 实现 Bot Client 的 WebSocket 客户端连接器（建连、`connection.hello` 握手、指数退避重连骨架）于 `services/bot-client/src/ws-client/index.ts` — 优先级：P0，预估：2h（依赖 T012）
- [ ] T015 实现 Strategy Service 的 WebSocket 服务端端点（接受 Bot Client 连接、会话注册表）于 `services/strategy-service/src/api/ws_server.py` — 优先级：P0，预估：2h（依赖 T013）
- [ ] T016 [P] 实现 mineflayer 机器人连接封装（使用独立 Minecraft 账号登录，对应 FR-027）于 `services/bot-client/src/minecraft/connection.ts` — 优先级：P0，预估：1h
- [ ] T017 按 data-model.md §4 实现 Game Session 生命周期状态机（initializing/active/disconnected/ended）于 `services/strategy-service/src/api/session.py` — 优先级：P0，预估：1.5h
- [ ] T018 [P] 实现 Anthropic Claude API 客户端封装（鉴权、基础配置、流式调用 helper）于 `services/strategy-service/src/decision/claude_client.py` — 优先级：P0，预估：1.5h
- [ ] T019 [P] 实现 Bot Client 结构化日志基础设施（按动作/延迟分类）于 `services/bot-client/src/logging.ts` — 优先级：P0，预估：1h
- [ ] T020 [P] 实现 Strategy Service 结构化日志基础设施于 `services/strategy-service/src/logging.py` — 优先级：P0，预估：1h
- [ ] T021 实现 Strategy Service 统一错误处理与类型化异常模块于 `services/strategy-service/src/errors.py` — 优先级：P0，预估：1h
- [ ] T022 按 `contracts/tool-schema.md` 注册 Claude 工具集定义（`move_to`/`attack`/`use_item`/`interact`/`chat_say`/`set_autonomy_level`/`suggest_action`）于 `services/strategy-service/src/decision/tools.py` — 优先级：P0，预估：2h（依赖 T018）

**Checkpoint**：基础设施就绪，可开始并行实现各用户故事。

---

## Phase 3: User Story 1 - 日常闯关陪玩：核心感知—操控—对话闭环 (Priority: P1) 🎯 MVP

**Goal**: AI 队友自动加入双人合作会话，实时感知游戏状态、用与人类玩家相同的方式操控角色，并进行可被打断的低延迟语音对话。

**Independent Test**: 一名玩家与 AI 队友从关卡开始独立玩到结束，全程不需要人工干预，验证自动加入、语音指令响应、语音打断、掉线重连均按预期工作（对应 quickstart.md 场景 A）。

### 感知（Perception）

- [ ] T023 [P] [US1] 实现结构化游戏状态提取（服务端命令/RCON，FR-001）于 `services/bot-client/src/minecraft/state-extractor.ts` — 优先级：P0，预估：3h
- [ ] T024 [US1] 按 data-model.md §5 定义 Game State Snapshot 数据模型（TypeScript）于 `services/bot-client/src/minecraft/types.ts` — 优先级：P0，预估：1h
- [ ] T025 [P] [US1] 按 data-model.md §5 定义 Game State Snapshot 数据模型（Python）于 `services/strategy-service/src/perception/models.py` — 优先级：P0，预估：1h
- [ ] T026 [US1] 实现快照定期上报（`state.snapshot` 消息）于 `services/bot-client/src/ws-client/state-reporter.ts` — 优先级：P0，预估：2h（依赖 T023, T024）
- [ ] T027 [US1] 实现离散游戏事件检测与上报（受击/死亡/任务完成，FR-004）于 `services/bot-client/src/minecraft/event-detector.ts` — 优先级：P0，预估：1.5h
- [ ] T028 [P] [US1] 实现周期性截图/关键帧采集兜底方案（FR-002）于 `services/bot-client/src/minecraft/vision-capture.ts` — 优先级：P1，预估：3h
- [ ] T029 [US1] 实现 Claude 视觉状态理解调用（Sonnet 5，effort:medium，research.md §2/§7）于 `services/strategy-service/src/perception/vision_analyzer.py` — 优先级：P1，预估：3h（依赖 T018, T028）
- [ ] T030 [US1] 实现动态元素世界模型追踪（敌人位置预测、可交互物体状态，FR-003）于 `services/strategy-service/src/perception/world_model.py` — 优先级：P1，预估：2h
- [ ] T031 [US1] 实现快照过期检测与降级提示（data-model.md §5 校验规则）于 `services/strategy-service/src/perception/staleness.py` — 优先级：P0，预估：1h

### 角色操控（Control）

- [ ] T032 [US1] 使用 mineflayer-pathfinder 实现 `move_to` 工具执行器于 `services/bot-client/src/minecraft/actions/move.ts` — 优先级：P0，预估：3h
- [ ] T033 [P] [US1] 使用 mineflayer-pvp 实现 `attack` 工具执行器于 `services/bot-client/src/minecraft/actions/attack.ts` — 优先级：P0，预估：2h
- [ ] T034 [P] [US1] 实现 `use_item` / `interact` 工具执行器于 `services/bot-client/src/minecraft/actions/interact.ts` — 优先级：P0，预估：2h
- [ ] T035 [US1] 实现组合操作支持（方向+技能+闪避同时执行，FR-006）于 `services/bot-client/src/minecraft/actions/combo.ts` — 优先级：P0，预估：2h（依赖 T032-T034）
- [ ] T036 [US1] 实现 `tool.command` 消息分发（路由到对应动作执行器）于 `services/bot-client/src/ws-client/command-handler.ts` — 优先级：P0，预估：1.5h（依赖 T032-T035）
- [ ] T037 [US1] 实现 `tool.result` 执行结果回传于 `services/bot-client/src/ws-client/command-handler.ts` — 优先级：P0，预估：1h（依赖 T036）
- [ ] T038 [US1] 实现拟人化操作噪声（轻度误差注入 + 开关，FR-009）于 `services/bot-client/src/humanizer/index.ts` — 优先级：P0，预估：2h
- [ ] T039 [US1] 将 humanizer 开关接入 Player.preferences.humanizer_enabled（默认开启）于 `services/strategy-service/src/api/session.py` — 优先级：P0，预估：1h（依赖 T017, T038）
- [ ] T040 [US1] 实现动作范围守卫（仅操控本地授权角色，禁止竞技作弊能力，FR-008）于 `services/bot-client/src/minecraft/actions/guard.ts` — 优先级：P0，预估：1h

### 本地反射层（Reflex Layer）

- [ ] T041 [US1] 实现反射触发检测（即将受到近战伤害、脚下方块消失等）于 `services/bot-client/src/reflex/detector.ts` — 优先级：P0，预估：3h
- [ ] T042 [US1] 实现反射动作执行器（闪避/脱离危险，<100ms，不经云端，FR-007）于 `services/bot-client/src/reflex/executor.ts` — 优先级：P0，预估：3h（依赖 T041）
- [ ] T043 [US1] 实现 `reflex.executed` 上报（记录 latency_ms）于 `services/bot-client/src/reflex/reporter.ts` — 优先级：P0，预估：1h（依赖 T042）
- [ ] T044 [US1] 实现反射层优先级仲裁（反射动作不可被云端指令抢占，见 contracts/websocket-protocol.md）于 `services/bot-client/src/reflex/arbiter.ts` — 优先级：P0，预估：1h（依赖 T036, T042）
- [ ] T045 [P] [US1] 编写反射触发/执行延迟单元测试于 `services/bot-client/tests/unit/reflex.test.ts` — 优先级：P1，预估：2h（依赖 T041-T043）

### 实时语音（Voice — MVP 范围：基础闲聊 + 简单指令 + 打断）

- [ ] T046 [US1] 接入流式 STT 客户端 SDK（供应商待定，接口先行，见 research.md 未解决事项）于 `services/strategy-service/src/voice/stt_client.py` — 优先级：P0，预估：2h
- [ ] T047 [US1] 接入流式 TTS 客户端 SDK（同上，接口先行）于 `services/strategy-service/src/voice/tts_client.py` — 优先级：P0，预估：2h
- [ ] T048 [US1] 按 `contracts/voice-pipeline.md` 实现"流式 STT→Claude 流式文本→流式 TTS"分段流水线编排于 `services/strategy-service/src/voice/pipeline.py` — 优先级：P0，预估：4h（依赖 T018, T046, T047）
- [ ] T049 [US1] 实现 `chat_say` 工具调用处理与语音分段输出于 `services/strategy-service/src/voice/speak_handler.py` — 优先级：P0，预估：2h（依赖 T022, T048）
- [ ] T050 [US1] 实现语音打断处理（`voice.interrupt` 立即终止 TTS/生成，FR-010）于 `services/strategy-service/src/voice/interrupt_handler.py` — 优先级：P0，预估：2h（依赖 T048）
- [ ] T051 [US1] 实现 Bot Client 语音下发/播放桥接（`voice.speak` → player-voice-client）于 `services/bot-client/src/ws-client/voice-relay.ts` — 优先级：P0，预估：1.5h
- [ ] T052 [US1] 实现 WebRTC 音频采集与播放于 `services/player-voice-client/src/audio.ts` — 优先级：P0，预估：3h
- [ ] T053 [US1] 编写游戏黑话/专有名词理解的系统提示词与词表（FR-012）于 `services/strategy-service/src/voice/game_vocabulary.py` — 优先级：P0，预估：2h
- [ ] T054 [US1] 实现 Voice Exchange 分段延迟记录（stt/llm/tts/total_ms，data-model.md §6，SC-005 验证依据）于 `services/strategy-service/src/voice/latency_tracker.py` — 优先级：P0，预估：2h（依赖 T048）
- [ ] T055 [US1] 实现 AI 队友加入时的自动问候语生成于 `services/strategy-service/src/persona/greeting.py` — 优先级：P1，预估：2h（依赖 T049）

### 可靠性（Reliability）

- [ ] T056 [US1] 实现 Bot Client 端断线检测与指数退避重连（FR-023）于 `services/bot-client/src/ws-client/reconnect.ts` — 优先级：P0，预估：2h（依赖 T014）
- [ ] T057 [US1] 实现断线期间反射层独立运行保障（不因失去云端连接而停止基础安全反射）于 `services/bot-client/src/reflex/offline-guard.ts` — 优先级：P0，预估：1.5h（依赖 T042, T056）
- [ ] T058 [US1] 实现重连成功事件处理与 disconnect_events 记录（data-model.md §4）于 `services/strategy-service/src/api/session.py` — 优先级：P0，预估：1h（依赖 T017, T056）
- [ ] T059 [US1] 配置 Bot Client ↔ Strategy Service 传输加密（WSS/TLS，FR-024）于 `services/strategy-service/src/api/ws_server.py` — 优先级：P0，预估：1h
- [ ] T060 [US1] 实现原始语音数据不落盘保障（临时缓冲区清理策略，FR-025）于 `services/strategy-service/src/voice/pipeline.py` — 优先级：P0，预估：1h（依赖 T048）

### 账号接入（Bot Identity）

- [ ] T061 [US1] 实现独立机器人账号凭证管理（配置加载、连接握手，FR-027）于 `services/bot-client/src/minecraft/credentials.ts` — 优先级：P0，预估：1.5h（依赖 T016）
- [ ] T062 [US1] 按 data-model.md §3 实现 Bot Client Identity 状态模型与 connection_status 追踪于 `services/strategy-service/src/api/bot_identity.py` — 优先级：P0，预估：1h

### 自主度（Autonomy）

- [ ] T063 [US1] 实现自主度档位默认值（半自主）与语音切换处理（FR-015）于 `services/strategy-service/src/decision/autonomy.py` — 优先级：P0，预估：1.5h（依赖 T022）
- [ ] T064 [US1] 实现半自主档位下"常规子任务自主执行 vs 关键决策点等待"的判断逻辑于 `services/strategy-service/src/decision/orchestrator.py` — 优先级：P0，预估：2h（依赖 T063）

### 集成与验收

- [ ] T065 [US1] 端到端联调：自动加入 + 语音问候（quickstart.md 场景 A-1） — 优先级：P0，预估：4h（依赖 T036, T055, T061）
- [ ] T066 [US1] 端到端联调：简单语音指令 + 反射验证（quickstart.md 场景 A-2） — 优先级：P0，预估：3h（依赖 T044, T048）
- [ ] T067 [US1] 端到端联调：语音打断验证（quickstart.md 场景 A-3） — 优先级：P0，预估：2h（依赖 T050, T054）
- [ ] T068 [US1] 端到端联调：掉线重连验证（quickstart.md 场景 A-4） — 优先级：P0，预估：2h（依赖 T057, T058）
- [ ] T069 [US1] 端到端联调：视觉兜底验证（quickstart.md 场景 A-5） — 优先级：P1，预估：2h（依赖 T029, T031）
- [ ] T070 [P] [US1] 编写 Strategy Service 决策编排单元测试（工具调用循环）于 `services/strategy-service/tests/unit/test_orchestrator.py` — 优先级：P1，预估：2h
- [ ] T071 [P] [US1] 编写 Bot Client 对接本地 Docker Minecraft 测试服的集成测试于 `services/bot-client/tests/integration/` — 优先级：P1，预估：3h（依赖 T010, T032-T035）

**Checkpoint**：User Story 1（MVP）应可独立完整演示。

---

## Phase 4: User Story 2 - 策略讨论与动态分工：战术协作 (Priority: P2)

**Goal**: AI 队友能理解并拆解玩家的自然语言战术指令为具体动作序列，在无指令时主动建议，识别协作失误并调整。

**Independent Test**: 在需要明确分工的 Boss 战或复杂遭遇场景中，独立验证战术指令拆解、主动建议、失误识别是否按预期工作（对应 quickstart.md 场景 B），无需依赖 User Story 3。

- [ ] T072 [US2] 按 data-model.md §7 定义 Tactical Instruction 数据模型于 `services/strategy-service/src/decision/models.py` — 优先级：P0，预估：1.5h
- [ ] T073 [P] [US2] 按 data-model.md §8 定义 Mission/Objective 数据模型于 `services/strategy-service/src/decision/mission.py` — 优先级：P0，预估：1h
- [ ] T074 [US2] 实现战术指令解析与工具调用拆解编排（TC-02/FR-016）于 `services/strategy-service/src/decision/tactical_decomposer.py` — 优先级：P0，预估：3h（依赖 T022, T072）
- [ ] T075 [US2] 实现多工具并行调用结果合并处理（同一用户消息内回传全部 tool_result，见 contracts/tool-schema.md 工具调用循环约定）于 `services/strategy-service/src/decision/orchestrator.py` — 优先级：P0，预估：2h（依赖 T064, T074）
- [ ] T076 [US2] 实现玩家同时下达冲突战术指令的检测（对应 spec.md Edge Cases）于 `services/strategy-service/src/decision/conflict_detector.py` — 优先级：P1，预估：2h（依赖 T072）
- [ ] T077 [US2] 实现 `suggest_action` 主动建议触发逻辑（有意义决策点识别，FR-017）于 `services/strategy-service/src/decision/proactive_suggester.py` — 优先级：P1，预估：2h（依赖 T030, T063）
- [ ] T078 [US2] 实现决策点记录到 Mission.autonomy_checkpoints 于 `services/strategy-service/src/decision/mission.py` — 优先级：P1，预估：1.5h（依赖 T073, T077）
- [ ] T079 [US2] 实现协作失败识别与调整/致歉逻辑（FR-019）于 `services/strategy-service/src/decision/failure_recovery.py` — 优先级：P1，预估：2h（依赖 T075）
- [ ] T080 [US2] 实现跨会话战术偏好记忆存储层（选型见 research.md §9，FR-018）于 `services/strategy-service/src/memory/preference_store.py` — 优先级：P2，预估：2h
- [ ] T081 [US2] 将 Player Preference Profile 读取接入决策编排于 `services/strategy-service/src/decision/orchestrator.py` — 优先级：P2，预估：1h（依赖 T080）
- [ ] T082 [US2] 端到端联调：Boss 战战术分工验证（quickstart.md 场景 B-1） — 优先级：P1，预估：3h（依赖 T074, T075）
- [ ] T083 [US2] 端到端联调：主动建议验证（quickstart.md 场景 B-2） — 优先级：P1，预估：2h（依赖 T077）
- [ ] T084 [US2] 端到端联调：协作失误识别验证（quickstart.md 场景 B-3） — 优先级：P1，预估：2h（依赖 T079）
- [ ] T085 [P] [US2] 编写战术分解模块单元测试于 `services/strategy-service/tests/unit/test_tactical_decomposer.py` — 优先级：P2，预估：2h

**Checkpoint**：User Story 1 + 2 均应可独立正常工作。

---

## Phase 5: User Story 3 - 情感陪伴与人设化闲聊 (Priority: P3)

**Goal**: AI 队友能就游戏内容及适度游戏外话题自然闲聊，保持一致人设，并在被直接询问身份时按既定策略回应。

**Independent Test**: 在跑图或关卡间歇独立发起游戏相关及适度游戏外话题，验证自然接话、人设一致性、身份披露策略是否按预期工作（对应 quickstart.md 场景 C）。

- [ ] T086 [US3] 实现人设/性格配置加载（背景故事、性格风格，FR-013/CP-03）于 `services/strategy-service/src/persona/config.py` — 优先级：P1，预估：2h
- [ ] T087 [US3] 编写游戏内容闲聊系统提示词（FR-020）于 `services/strategy-service/src/persona/game_chat.py` — 优先级：P1，预估：2h（依赖 T086）
- [ ] T088 [US3] 实现游戏外话题边界与敏感话题转移逻辑（FR-021）于 `services/strategy-service/src/persona/topic_boundary.py` — 优先级：P1，预估：2h（依赖 T086）
- [ ] T089 [US3] 实现身份披露折中策略（玩笑维持角色 vs 认真如实告知的语气判断，FR-022）于 `services/strategy-service/src/persona/disclosure_policy.py` — 优先级：P1，预估：2.5h（依赖 T086）
- [ ] T090 [US3] 实现情景语气动态调整（危险紧张/胜利欢呼/陪伴平和，FR-014）于 `services/strategy-service/src/persona/tone_modulator.py` — 优先级：P2，预估：2h（依赖 T030, T086）
- [ ] T091 [US3] 端到端联调：游戏相关闲聊验证（quickstart.md 场景 C-1） — 优先级：P2，预估：2h（依赖 T087）
- [ ] T092 [US3] 端到端联调：游戏外话题边界验证（quickstart.md 场景 C-2） — 优先级：P2，预估：1.5h（依赖 T088）
- [ ] T093 [US3] 端到端联调：身份披露策略验证（quickstart.md 场景 C-3） — 优先级：P1，预估：1.5h（依赖 T089）
- [ ] T094 [P] [US3] 编写身份披露策略单元测试（玩笑 vs 认真语气判断）于 `services/strategy-service/tests/unit/test_disclosure_policy.py` — 优先级：P2，预估：2h

**Checkpoint**：User Story 1 + 2 + 3 均应可独立正常工作。

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: 影响多个用户故事的收尾工作

- [ ] T095 [P] 实现本地/云端处理模式切换与训练数据授权设置（FR-026）于 `services/strategy-service/src/privacy/mode_switch.py` — 优先级：P1，预估：2h
- [ ] T096 [P] 安全复查：确认无竞技作弊能力泄漏路径（复查 FR-008 / T040 覆盖面） — 优先级：P1，预估：1.5h
- [ ] T097 [P] 性能调优：跨阶段延迟采样与瓶颈分析，对照 SC-005/SC-006 目标值调优 — 优先级：P2，预估：3h
- [ ] T098 [P] 编写 `services/bot-client` 与 `services/strategy-service` 的 README 与部署文档 — 优先级：P2，预估：2h
- [ ] T099 完整运行 quickstart.md 全部验证场景（≥20 次交互样本）并记录延迟/成功率统计表 — 优先级：P1，预估：4h（依赖 Phase 3-5 全部完成）
- [ ] T100 代码整理：移除调试日志、统一命名规范 — 优先级：P1，预估：2h
- [ ] T101 [P] 补充 SC-009（开发者预注册）相关的接入文档与 SDK 说明草稿（面向未来开放接入） — 优先级：P2，预估：2h

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup（Phase 1）**：无前置依赖，可立即开始
- **Foundational（Phase 2）**：依赖 Phase 1 完成——**阻断所有用户故事**
- **User Stories（Phase 3+）**：均依赖 Phase 2 完成
  - 各用户故事之间彼此独立，可并行（若人力允许）或按 P1→P2→P3 顺序串行
- **Polish（Phase 6）**：依赖期望交付的用户故事全部完成（T099 显式依赖 Phase 3-5）

### User Story Dependencies

- **User Story 1 (P1)**：Phase 2 完成后即可开始，不依赖其他用户故事——**MVP，建议优先且独立交付**
- **User Story 2 (P2)**：Phase 2 完成后即可开始；工具调用循环（T075）复用 US1 的 orchestrator（T064），属于集成而非阻断依赖，US2 仍可独立测试
- **User Story 3 (P3)**：Phase 2 完成后即可开始；人设配置（T086）与语音管线（US1 的 chat_say 路径）集成，同样是集成而非阻断依赖

### 故事内部顺序

- 感知/数据模型任务先于依赖它们的操控/决策任务
- 反射层与语音管线是 US1 的两条相对独立的子线，可并行推进
- 集成联调任务（T065-T071、T082-T085、T091-T094）应在对应子模块任务完成后进行

### Parallel Opportunities

- Phase 1 中标 [P] 的任务可全部并行
- Phase 2 中标 [P] 的任务可全部并行（T012/T013 语言对分别独立，T016/T018/T019/T020 相互独立）
- Phase 2 完成后，US1/US2/US3 可由不同人员并行推进（US2/US3 对 US1 的依赖仅为集成点，非阻断）
- 每个用户故事内部，感知/操控/语音/可靠性/账号/自主度六条子线中标 [P] 的任务可并行

---

## Parallel Example: User Story 1

```bash
# 感知与操控可并行推进（不同文件、无相互阻断）：
Task: "实现结构化游戏状态提取于 services/bot-client/src/minecraft/state-extractor.ts"
Task: "使用 mineflayer-pathfinder 实现 move_to 工具执行器于 services/bot-client/src/minecraft/actions/move.ts"

# 反射层与语音管线可并行推进（两条独立子线）：
Task: "实现反射触发检测于 services/bot-client/src/reflex/detector.ts"
Task: "接入流式 STT 客户端 SDK 于 services/strategy-service/src/voice/stt_client.py"
```

---

## Implementation Strategy

### MVP 优先（仅 User Story 1）

1. 完成 Phase 1：Setup（约 9h）
2. 完成 Phase 2：Foundational（约 17h，关键阻断项）
3. 完成 Phase 3：User Story 1（约 98h，含集成联调）
4. **停下并验证**：独立运行 quickstart.md 场景 A 全部 5 项
5. 若通过，可视为 MVP（对应 PRD Phase 1"能玩+能聊"目标）就绪，可演示/内测

### 增量交付

1. Setup + Foundational 完成 → 基础就绪
2. 加入 User Story 1 → 独立验证 → 演示/内测（MVP！）
3. 加入 User Story 2 → 独立验证 → 演示/内测
4. 加入 User Story 3 → 独立验证 → 演示/内测
5. 每个故事都在不破坏前一故事的前提下增加价值

### 多人并行策略

Phase 2 完成后：
- 开发者 A：User Story 1 感知 + 操控 + 反射层（Node/TS 为主）
- 开发者 B：User Story 1 语音管线 + 可靠性（Python 为主）
- 开发者 C：待 US1 主干稳定后并行推进 User Story 2 / 3（Python 为主，复用 US1 的 orchestrator 与语音出口）

---

## Notes

- `[P]` 任务 = 不同文件、无依赖，可并行
- `[Story]` 标签用于将任务追溯到具体用户故事
- 优先级（P0/P1/P2）与预估时间按用户要求标注在每条任务末尾，独立于 `[P]` 并行标记与 `[Story]` 标签
- 测试任务（单元/集成/端到端联调）已按 plan.md 中确立的测试策略融入各故事流程，未采用"测试先行必须先失败"的严格 TDD 顺序（spec.md 与本次任务生成请求均未显式要求 TDD）
- 每个用户故事应可独立完成与验证
- 完成任务后建议提交（commit），到达任一 Checkpoint 时停下独立验证该故事
- 避免：模糊任务描述、同文件冲突、破坏故事独立性的跨故事强依赖
