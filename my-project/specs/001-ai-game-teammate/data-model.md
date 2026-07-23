# Phase 1 Data Model: AI 游戏陪玩 Agent（基于 Project AIRI 的黑客松四层分级交付）

**Feature**: [spec.md](./spec.md) | **Plan**: [plan.md](./plan.md) | **Research**: [research.md](./research.md)

本文档将 spec.md 的 Key Entities 展开为具体字段、关系与状态转移。与上一版本不同，这里的多个实体不是从零设计，而是对 AIRI 既有概念（事件、任务状态、反射抑制信号）的复用或最小扩展——凡是复用 AIRI 既有机制的地方，均在字段说明中标注对应的源码位置。

---

## 1. AIRI 实例 (AIRI Instance)

第一层的核心承载对象；一次 Project AIRI 的部署运行。

| 字段 | 类型 | 说明 |
|---|---|---|
| `instance_id` | string | 本地实例标识 |
| `airi_commit` | string | 锁定的 AIRI 仓库 commit/tag（Phase 0 范围冻结阶段确定，第一层通过后冻结） |
| `model_provider_config` | object | LLM 提供商配置（对应 `.env` 中 `OPENAI_API_BASEURL`/`OPENAI_API_KEY`/`OPENAI_MODEL`/`OPENAI_REASONING_MODEL`，经由 `xsAI` 统一接口，可指向任意兼容提供商） |
| `voice_config` | object | VAD/STT/TTS 提供商配置（第二层起使用） |
| `status` | enum | `cold` / `starting` / `ready` / `degraded`（对应 L1-01 冷启动验收标准） |

**校验规则**：`airi_commit` 一经第一层 Gate 1 通过即冻结（FR-006、PRD2 §4.4），后续修改必须走"跨层合并 + 回归脚本"流程（FR-050）。

---

## 2. 游戏会话 (Game Session)

一次有边界的玩家与 AI 队友共同游玩过程。

| 字段 | 类型 | 说明 |
|---|---|---|
| `session_id` | string | 唯一标识 |
| `game` | enum | `minecraft` / `dst`（第一层仅 `minecraft`，第二层起可为 `dst`） |
| `bridge_status` | enum | `connecting` / `connected` / `disconnected`（第一层：对应 Bot 是否在线并被 AIRI 识别，L1-03；第二层起：对应 Adapter `health()` 报告） |
| `active_mission` | string \| null | 当前任务/目标描述 |
| `demo_script_ref` | string \| null | 若本次会话为固化演示脚本的一次执行，关联脚本标识（L1-06） |

---

## 3. Game Adapter

把上层统一状态/动作契约映射到具体游戏实现的适配模块（第二层起存在；契约定义见 `contracts/game-adapter-contract.md`）。

| 字段 | 类型 | 说明 |
|---|---|---|
| `adapter_id` | string | `minecraft-adapter` 或 `dst-adapter` |
| `game` | enum | `minecraft` / `dst` |
| `capabilities` | array | 当前游戏支持的动作列表（对应 `capabilities()` 接口，FR-023） |
| `health` | object | 连接、延迟、错误、可恢复状态（对应 `health()` 接口） |

**Minecraft Adapter 特有说明**：直接包装 `services/minecraft` 已有的 `action-registry.ts`（工具目录）与 `task-executor.ts`（执行与生命周期事件），不改变其内部行为，只做参数/事件格式转换（research.md §3）。

**DST Adapter 特有说明**：状态/动作通过 DST Bridge 转发（见下），不直接与游戏进程通信。

---

## 4. Bridge

位于游戏侧或本地进程中的连接层。

| 字段 | 类型 | 说明 |
|---|---|---|
| `bridge_id` | string | `minecraft-bot`（AIRI 既有，第一层复用）或 `dst-bridge`（第二层新增） |
| `game` | enum | `minecraft` / `dst` |
| `implementation` | string | Minecraft：`mineflayer`（既有）；DST：`klei-lua-mod + node-bridge`（新增） |
| `connection_status` | enum | `online` / `offline` / `reconnecting` |

---

## 5. 体验事件 (Experience Event)

供实体桌宠、软件降级方案消费的统一事件（第三层 B 起存在；Schema 定义见 `contracts/experience-event-schema.md`）。

| 字段 | 类型 | 说明 |
|---|---|---|
| `event_id` | string | 唯一标识 |
| `type` | enum | `speaking` / `thinking` / `action` / `success` / `danger` / `hurt` / `death` |
| `priority` | int | 用于节流/覆盖时的优先级排序（H3-03） |
| `payload` | object | 事件相关的附加数据（如 speaking 事件的文本/音频引用） |
| `emitted_at` | timestamp | 触发时间 |

**校验规则**：Mock 环境、实体桌宠、软件降级方案 MUST 消费同一份 Schema（FR-031），不得分叉出多套事件定义。

---

## 6. 模型动作输出 (Model Action Output)

本地 SLM/SSM 针对一次决策请求输出的动作、参数与置信度（第三层 A 起存在）。

| 字段 | 类型 | 说明 |
|---|---|---|
| `request_id` | string | 对应一次反射层决策请求 |
| `action` | string | 输出动作（限定于 follow/stop/collect/interact/avoid/return 等，FR-024） |
| `params` | object | 动作参数 |
| `confidence` | float (0-1) | 置信度 |
| `routed_to` | enum | `local_model` / `airi_fallback`（对应 FR-028 的置信度路由：未知任务或低置信度时回退 AIRI 基线） |
| `decision_latency_ms` | number | 决策耗时，用于对照 AIRI 基线计算延迟降低幅度（SC-007） |

**状态转移**：`routed_to` 的判定发生在每次决策请求时，不是持久化状态，而是路由逻辑的运行时输出——本地模型服务关闭、超时、或置信度低于阈值时，`routed_to` 恒为 `airi_fallback`，确保主链路继续运行。

---

## 7. 轨迹 (Trajectory)

Agent Arena 单次运行记录的完整序列（第四层 Arena 方向存在）。

| 字段 | 类型 | 说明 |
|---|---|---|
| `trajectory_id` | string | 唯一标识 |
| `task_id` | string | 所属标准任务（follow/collect/stop-danger 等，A4-01） |
| `seed` | string | 场景初始化种子，用于场景/种子隔离（A4-05） |
| `steps` | array | 状态、指令、动作、事件、结果与各阶段延迟的完整序列（A4-02） |
| `outcome` | enum | `success` / `failure` |
| `dataset_split` | enum | `train` / `validation` / `test`（冻结后不可变更，避免轨迹泄漏） |

---

## 8. 技能 (Skill)

Replay-to-Skill 从成功轨迹抽象出的参数化行为定义（第四层 Replay 方向存在）。

| 字段 | 类型 | 说明 |
|---|---|---|
| `skill_id` | string | 唯一标识 |
| `source_trajectory_id` | string (FK) | 来源轨迹（MUST 为 `outcome=success`，FR-040） |
| `goal` | string | 抽象后的目标（如"找到树木"） |
| `preconditions` | array | 前置条件 |
| `entry_branch` / `success_branch` / `timeout_branch` / `failure_branch` / `cancel_branch` | object | 五种执行分支（FR-041） |
| `review_status` | enum | `pending_review` / `approved` / `rejected`（FR-042：未经确认不能用于主世界） |
| `reproducibility_runs` | array | 不同初始位置的重复性验证记录（FR-043：3 次至少成功 2 次） |

**状态转移**：`review_status` 从 `pending_review` 只能人工转移到 `approved` 或 `rejected`；只有 `approved` 的技能才能被 Game Adapter 的 `act()` 执行。

---

## 9. 视觉事件 (Vision Event)

Shadow Observer 从画面识别输出的只读事件（第四层视觉方向存在）。

| 字段 | 类型 | 说明 |
|---|---|---|
| `event_id` | string | 唯一标识 |
| `category` | enum | `low_health` / `nearby_danger` / `target_resource_or_ui_complete`（至少 3 类，W4-02） |
| `confidence` | float (0-1) | 识别置信度 |
| `latency_ms` | number | 画面到事件产生的延迟（MUST ≤1000ms，W4-03） |
| `cross_checked_with_structured_state` | boolean | 是否已与 Adapter 结构化状态完成一致性对照（W4-04） |

**校验规则**：视觉事件 MUST 仅作为只读输入接入 Perception 事件总线，MUST NOT 携带任何可直接触发游戏动作执行的字段（FR-047）。

---

## 关系总览

```
AIRI 实例 1───N Game Session
                  │
                  ├── Session.game = minecraft → Bridge(minecraft-bot, 既有) → Game Adapter(minecraft-adapter, 第二层新增包装)
                  └── Session.game = dst        → Bridge(dst-bridge, 新增)     → Game Adapter(dst-adapter, 新增)

Game Adapter ──produces──> 体验事件（消费方：实体桌宠 / 软件降级 / Mock）
Game Adapter ──produces──> 轨迹（消费方：Agent Arena）
轨迹 ──(success 轨迹)──> 技能（Replay-to-Skill 生成，经人工确认后由 Game Adapter 执行）

Reflex Manager（AIRI 既有）──consumes──> 模型动作输出（第三层 A 新增，未覆盖/低置信度时回退 AIRI 基线）
Perception 事件总线（AIRI 既有）──consumes──> 视觉事件（Shadow Observer 新增，只读补充）
```
