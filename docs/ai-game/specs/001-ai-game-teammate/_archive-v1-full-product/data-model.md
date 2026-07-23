# Phase 1 Data Model: AI 游戏队友（实时语音 AI 队友系统）

**Feature**: [spec.md](./spec.md) | **Plan**: [plan.md](./plan.md) | **Research**: [research.md](./research.md)

本文档将 spec.md 的 Key Entities 展开为具体字段、关系与状态转移，供 Phase 2 任务拆解与实现使用。所有实体均为 Strategy Service（Python 侧）内的运行时/存储模型；MVP 阶段（User Story 1）除 Player Preference Profile 外均为会话内瞬态状态，不落库（参见 research.md §9）。

---

## 1. Player（玩家）

真实玩家用户，控制自己的 Minecraft 角色，通过语音与游戏内动作与 AI 队友互动。

| 字段 | 类型 | 说明 |
|---|---|---|
| `player_id` | string | 玩家的 Minecraft 账号标识（唯一） |
| `display_name` | string | 游戏内显示名 |
| `preferences` | object | 会话级偏好设置：`autonomy_level`（跟随/半自主/全自主，默认"半自主"，对应 FR-015）、`humanizer_enabled`（拟人化噪声开关，默认开启，对应 FR-009）、`processing_mode`（本地/云端，对应 FR-026）、`voice_training_opt_in`（语音数据是否可用于训练，默认否，对应 FR-026） |
| `session_id` | string (FK) | 当前所在的 Game Session |

**校验规则**：`autonomy_level` 取值枚举必须是 {`follow`, `semi_autonomous`, `full_autonomous`} 之一（对应 FR-015 三档）；未设置时默认为 `semi_autonomous`。

---

## 2. AI 队友（AI Teammate）

AI 控制的合作角色，具备人设/性格、感知理解与决策能力，在一个会话内与一名玩家配对。

| 字段 | 类型 | 说明 |
|---|---|---|
| `teammate_id` | string | AI 队友实例标识 |
| `bot_identity_id` | string (FK) | 关联的机器人账号（见下） |
| `persona` | object | 人设配置：`personality_style`（如沉稳型/活泼型，对应 FR-013）、`background_story`（背景故事，对应 CP-03/FR-022） |
| `autonomy_level` | enum | 当前生效档位（跟随玩家偏好设置，可在对局中被语音切换，FR-015） |
| `session_id` | string (FK) | 所属 Game Session |
| `current_decision_layer` | enum | `reflex`（本地反射层正在处理）或 `strategy`（云端策略层正在处理），用于观测/调试 |

**状态转移**：`current_decision_layer` 在"反射级触发"与"非反射级触发"之间切换，不是持久化字段，仅为运行时可观测状态（对应 FR-007 的分层架构）。

---

## 3. 机器人账号（Bot Client Identity）

AI 队友接入游戏世界所使用的独立 Minecraft 账号与客户端连接身份。

| 字段 | 类型 | 说明 |
|---|---|---|
| `bot_identity_id` | string | 唯一标识 |
| `minecraft_account_ref` | string | 关联的 Minecraft（Java 版）账号引用（凭证本身不在此模型中，由独立的凭证管理组件持有） |
| `connection_status` | enum | `connected` / `disconnected` / `reconnecting`（对应 FR-023 掉线重连） |
| `last_connected_at` | timestamp | 最近一次成功连接时间 |
| `provisioning_cost_tag` | string | 用于运营成本归因的标签（对应 research.md 中账号是运营成本一部分的假设） |

**校验规则**：`connection_status = reconnecting` 状态下，系统 MUST 在 5 秒内转为 `connected` 或触发降级流程（FR-023）；不得长期停留在 `reconnecting`。

---

## 4. 游戏会话（Game Session）

一次有边界的双人合作游玩过程。

| 字段 | 类型 | 说明 |
|---|---|---|
| `session_id` | string | 唯一标识 |
| `player_id` | string (FK) | 参与玩家 |
| `teammate_id` | string (FK) | 参与 AI 队友 |
| `game_target` | string | 固定为 `minecraft_java` |
| `mission_id` | string (FK, nullable) | 当前追踪的任务/目标 |
| `status` | enum | `initializing` / `active` / `disconnected` / `ended` |
| `started_at` | timestamp | 会话开始时间 |
| `ended_at` | timestamp (nullable) | 会话结束时间 |
| `disconnect_events` | array | 掉线重连记录列表，每条含 `disconnected_at` / `reconnected_at` / `duration_ms` |

**状态转移**：
```
initializing → active → disconnected → active（5 秒内重连成功，FR-023）
                                     → ended（重连失败或玩家主动结束）
active → ended（正常结束）
```

---

## 5. 游戏状态快照（Game State Snapshot）

某一时刻的结构化或视觉推导得到的世界状态。会话内高频更新的瞬态数据，不持久化。

| 字段 | 类型 | 说明 |
|---|---|---|
| `snapshot_id` | string | 单次快照标识（用于追踪决策依据） |
| `session_id` | string (FK) | 所属会话 |
| `source` | enum | `structured_api`（FR-001，官方/模组接口）或 `vision`（FR-002，视觉解析兜底） |
| `captured_at` | timestamp | 采集时间 |
| `player_position` | object | 玩家坐标 |
| `teammate_position` | object | AI 队友坐标 |
| `health` | object | 双方血量 |
| `inventory` | array | 物品栏摘要 |
| `nearby_entities` | array | 附近敌人/可交互物体（世界模型追踪对象，FR-003） |
| `active_events` | array | 触发本次决策的离散事件列表（受击/死亡/任务完成等，FR-004） |

**校验规则**：当 `source = vision` 时，`captured_at` 与实际画面采集时间的间隔应在决策延迟预算内（非反射级 <300ms），超出预算的快照应被标记为过期并触发降级提示（对应 spec.md Edge Cases 中"感知不可靠"场景）。

---

## 6. 语音交互回合（Voice Exchange）

玩家与 AI 队友之间的一次语音对话单元。

| 字段 | 类型 | 说明 |
|---|---|---|
| `exchange_id` | string | 唯一标识 |
| `session_id` | string (FK) | 所属会话 |
| `initiator` | enum | `player` 或 `teammate` |
| `transcript` | string | STT 转写文本 |
| `response_text` | string | AI 生成的回复文本（流式生成，落地时为完整文本） |
| `interrupted` | boolean | 本回合是否被打断（FR-010） |
| `latency_ms` | object | 分段延迟记录：`stt_ms` / `llm_first_token_ms` / `tts_first_byte_ms` / `total_ms`，用于验证 SC-005 |
| `intent_category` | enum | `game_related`（游戏相关闲聊，FR-020）/ `casual_light`（轻度游戏外话题，FR-021）/ `tactical_command`（战术指令，转交 Tactical Instruction 处理）/ `identity_inquiry`（身份询问，触发 FR-022 披露策略） |

**状态转移**（单次回合内）：`listening → transcribing → generating → speaking → completed`，其中 `interrupted = true` 可在 `speaking` 状态被打断，立即转入下一回合的 `listening`（不进入 `completed`，记录为提前终止）。

---

## 7. 战术指令（Tactical Instruction）

玩家下达的、需要被拆解为具体动作序列的自然语言指令。

| 字段 | 类型 | 说明 |
|---|---|---|
| `instruction_id` | string | 唯一标识 |
| `session_id` | string (FK) | 所属会话 |
| `source_exchange_id` | string (FK) | 来源的 Voice Exchange |
| `raw_text` | string | 原始指令文本（如"掩护我""从右边绕"） |
| `decomposed_actions` | array | Claude 工具调用拆解出的具体动作序列（见 `contracts/tool-schema.md`） |
| `execution_status` | enum | `pending` / `in_progress` / `completed` / `failed` |
| `conflict_detected` | boolean | 是否与玩家同时下达的其他指令冲突（对应 spec.md Edge Cases） |

---

## 8. 任务/目标（Mission / Objective）

AI 队友追踪并可自主推进或等待指令的当前关卡目标结构。

| 字段 | 类型 | 说明 |
|---|---|---|
| `mission_id` | string | 唯一标识 |
| `session_id` | string (FK) | 所属会话 |
| `description` | string | 目标描述（如"联合建造""击败凋灵""红石装置解谜"） |
| `progress_status` | enum | `not_started` / `in_progress` / `completed` / `blocked` |
| `autonomy_checkpoints` | array | 半自主档位下需要征询玩家的决策点记录 |

---

## 9. 玩家偏好档案（Player Preference Profile）

跨会话保留的玩家战术偏好与互动风格记忆（User Story 2 后期增量，见 research.md §9）。

| 字段 | 类型 | 说明 |
|---|---|---|
| `player_id` | string (FK) | 关联玩家 |
| `preferred_tactics` | array | 历史场景 → 偏好战术的映射摘要（FR-018） |
| `interaction_style_notes` | string | 互动风格备注 |
| `updated_at` | timestamp | 最近更新时间 |

**注**：本实体的存储介质在 Phase 0 未锁定（research.md §9），实现时按当时的部署形态选型；MVP 不要求该实体存在。

---

## 关系总览

```
Player 1───1 Game Session 1───1 AI Teammate 1───1 Bot Client Identity
                  │                    │
                  │                    └── 产生多个 Game State Snapshot（perception）
                  │
                  ├── 产生多个 Voice Exchange
                  │        └── 可派生出 0..1 个 Tactical Instruction
                  │
                  └── 关联 0..1 个 Mission / Objective

Player 1───0..1 Player Preference Profile（跨会话，独立于 Game Session 生命周期）
```
