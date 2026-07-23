# Contract: Claude 工具调用 Schema（游戏动作）

**Feature**: [../spec.md](../spec.md) | **Research**: [../research.md](../research.md) §3

Strategy Service 的 `decision/` 模块在调用 Claude API 时注册以下工具集，供模型将战术指令（FR-016）与自主推进决策（FR-015/FR-017）拆解为具体游戏动作。**反射级动作（战斗闪避、脱离突发危险）不在此工具集中**——它们由 Bot Client 的本地 `reflex/` 模块直接执行，不经过 Claude（research.md §5）。所有工具调用结果以 `tool_result` 形式回传给 Claude，供其判断下一步（如识别协作失败 FR-019）。

## 工具定义

### `move_to`

移动到指定坐标或跟随目标。

```json
{
  "name": "move_to",
  "description": "移动 AI 队友角色到指定坐标，或跟随一个目标实体。用于响应移动类指令（如'跟上''去左边机关那里'）或半自主/全自主档位下的自主走位。",
  "input_schema": {
    "type": "object",
    "properties": {
      "target_type": { "type": "string", "enum": ["coordinates", "entity", "player"] },
      "x": { "type": "number", "description": "target_type=coordinates 时必填" },
      "y": { "type": "number" },
      "z": { "type": "number" },
      "target_entity_id": { "type": "string", "description": "target_type=entity 时必填" },
      "follow_distance": { "type": "number", "description": "跟随时保持的距离（方块数），默认 2" }
    },
    "required": ["target_type"]
  }
}
```

### `attack`

攻击指定目标（非反射级——用于战术分工中"你打这个"类明确指令，区别于反射层的即时自保闪避）。

```json
{
  "name": "attack",
  "description": "对指定目标发起攻击。用于响应战术分工指令（如'你绕后打弱点'）或半自主/全自主档位下对已识别威胁的主动交战决策。不用于需要 <100ms 反应的紧急自保闪避——那部分由本地反射层处理。",
  "input_schema": {
    "type": "object",
    "properties": {
      "target_entity_id": { "type": "string" },
      "weapon_or_ability": { "type": "string", "description": "使用的武器/技能标识，如 '火属性技能'" }
    },
    "required": ["target_entity_id"]
  }
}
```

### `use_item`

使用/装备物品。

```json
{
  "name": "use_item",
  "description": "使用或装备背包中的物品（如切换武器、放置方块、使用药水）。",
  "input_schema": {
    "type": "object",
    "properties": {
      "item_id": { "type": "string" },
      "target_x": { "type": "number" },
      "target_y": { "type": "number" },
      "target_z": { "type": "number" }
    },
    "required": ["item_id"]
  }
}
```

### `interact`

与方块/实体交互（开门、拾取、激活装置）。

```json
{
  "name": "interact",
  "description": "与目标方块或实体交互，如开门、拾取物品、激活红石装置。",
  "input_schema": {
    "type": "object",
    "properties": {
      "target_type": { "type": "string", "enum": ["block", "entity"] },
      "target_x": { "type": "number" },
      "target_y": { "type": "number" },
      "target_z": { "type": "number" },
      "target_entity_id": { "type": "string" }
    },
    "required": ["target_type"]
  }
}
```

### `chat_say`

生成语音/文字对话输出（本身也是工具调用而非纯文本回复，便于统一携带语气/情绪元数据）。

```json
{
  "name": "chat_say",
  "description": "以 AI 队友的身份说一句话（会被送入语音合成管线）。用于问候、建议、闲聊、致歉等场景，不用于游戏动作。",
  "input_schema": {
    "type": "object",
    "properties": {
      "message": { "type": "string" },
      "tone": { "type": "string", "enum": ["calm", "urgent", "cheerful", "apologetic", "neutral"], "description": "对应 FR-014 的情景语气动态调整" }
    },
    "required": ["message"]
  }
}
```

### `set_autonomy_level`

响应玩家语音切换自主度档位（FR-015）。

```json
{
  "name": "set_autonomy_level",
  "description": "当玩家明确要求切换 AI 队友的自主度档位时调用（如'你自己决定就好''都听我的'）。",
  "input_schema": {
    "type": "object",
    "properties": {
      "level": { "type": "string", "enum": ["follow", "semi_autonomous", "full_autonomous"] }
    },
    "required": ["level"]
  }
}
```

### `suggest_action`

主动建议（FR-017），不直接执行动作，仅生成建议供玩家确认或忽略。

```json
{
  "name": "suggest_action",
  "description": "在半自主档位下，于有意义的决策点主动向玩家提出建议（不代替玩家做决定）。例如提示前方陷阱、建议路线。会通过语音输出。",
  "input_schema": {
    "type": "object",
    "properties": {
      "suggestion_text": { "type": "string" },
      "decision_point": { "type": "string", "description": "触发该建议的决策点标识，用于 Mission.autonomy_checkpoints 记录" }
    },
    "required": ["suggestion_text"]
  }
}
```

## 工具调用循环约定

1. 每轮 Strategy Service 向 Claude 提交：当前 Game State Snapshot 摘要 + 最近的 Voice Exchange/Tactical Instruction（若有）+ 可用工具集。
2. Claude 可能在一次响应中返回多个并行 `tool_use` 块（如同时 `move_to` + `chat_say`）——Strategy Service 需并发执行后在**同一条**用户消息中合并所有 `tool_result` 回传（遵循 Claude API 并行工具调用惯例，见 claude-api 技能 Tool Use Patterns）。
3. 工具执行结果（成功/失败/超时）必须如实包含在 `tool_result` 中，供 Claude 在下一轮判断是否需要 FR-019 描述的"识别协作失败并调整"。
