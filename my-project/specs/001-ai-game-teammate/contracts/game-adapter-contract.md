# Contract: 统一 Game Adapter 契约

**Feature**: [../spec.md](../spec.md) §3.3 | **Research**: [../research.md](../research.md) §3, §4

第二层新增的统一契约，Minecraft Adapter 与 DST Adapter 均须实现以下五个接口（对应 FR-015~023）。Minecraft Adapter 是对 `airi/services/minecraft` 现有 `action-registry.ts`/`task-executor.ts` 的薄包装；DST Adapter 对接新建的 DST Bridge。

## 接口定义

### `observe(): GameState`

返回标准化的游戏状态。

```json
{
  "character": { "position": {"x": 0, "y": 0, "z": 0}, "health": 20, "hunger": 20, "sanity": 100 },
  "nearby_entities": [ { "id": "string", "type": "string", "position": {"x":0,"y":0,"z":0}, "hostile": false } ],
  "resources": [ { "item": "string", "quantity": 0 } ],
  "dangers": [ { "type": "string", "position": {"x":0,"y":0,"z":0}, "severity": "low|medium|high" } ],
  "mission_progress": { "mission_id": "string", "status": "not_started|in_progress|completed|blocked" }
}
```

`sanity` 字段仅 DST 有意义（对应精神值）；Minecraft Adapter 可省略或恒为 `null`。两款游戏均须填充 `character.position/health`、`nearby_entities`、`resources`、`dangers`、`mission_progress`（FR-015）。

### `act(action): ActionResult`

接收高层动作并映射为游戏内操作。

```json
{
  "action": "follow | move | collect | interact | stop | say",
  "params": { "target": "string (可选，实体ID或坐标)", "text": "string (仅 say 使用)" }
}
```

响应：

```json
{ "status": "accepted | rejected | completed | failed", "reason": "string (仅 rejected/failed 时必填，需可解释，对应 FR-023)" }
```

最小动作集固定为 `follow/move/collect/interact/stop/say`（FR-016）；新增动作须先在 `capabilities()` 中声明，Adapter 不得静默接受未声明的动作。

### `events(): EventStream`

输出事件流（受击、死亡、资源获得、目标完成、玩家指令等）。事件 Schema 与 AIRI 既有 Perception 层的标准化事件保持一致（`airi/services/minecraft/src/cognitive/perception/events/definitions/*`），Minecraft Adapter 直接转发这些既有事件；DST Adapter 需要把 Bridge 转发来的原始事件映射为同一形状。

```json
{ "type": "hit | death | resource_gained | objective_completed | player_command", "detail": {}, "occurred_at": "ISO8601" }
```

### `capabilities(): Capability[]`

声明当前游戏支持的动作，供上层 Agent 规划时避免规划不可执行能力（FR-023）。

```json
[ { "action": "follow", "supported": true }, { "action": "collect", "supported": true, "constraints": "仅限已知资源类型" } ]
```

### `health(): HealthStatus`

报告连接、延迟、错误与可恢复状态，支持演示时快速降级判断。

```json
{ "connection": "connected | disconnected | reconnecting", "latency_ms": 0, "last_error": "string | null", "recoverable": true }
```

## 动作可靠性约束（对应 §5.3）

- 每个 `act()` 调用 SHOULD 具备超时与重试语义，防止 Agent 长时间卡在不可达目标（FR-022）。
- 不支持的动作 MUST 立即通过 `rejected` + `reason` 返回，不得静默挂起。
- Adapter 内部 SHOULD 用小型状态机或技能函数承接执行，LLM 只负责意图与高层规划，不做逐帧控制（§5.3 建议）。

## Minecraft Adapter 特化说明

包装对象：`airi/services/minecraft/src/cognitive/action/action-registry.ts` + `task-executor.ts`。`act()` 的实现只做参数格式转换，调用既有的工具调用入口；`events()` 直接订阅既有 Perception 事件总线并做形状归一化；不修改这两个文件的内部逻辑（对应第一层"不破坏可运行基线"的硬约束，G2-03）。

## DST Adapter 特化说明

依赖 `dst-bridge`（Lua 服务端 Mod + Node.js 本地桥接进程）。`observe()`/`events()` 的数据来源于 Mod 通过桥接进程转发的状态快照与事件；`act()` 把标准化动作翻译为 Mod 能理解的指令，经桥接进程下发。DST 特有的"精神值（sanity）"等字段填入 `observe()` 的 `character.sanity`。
