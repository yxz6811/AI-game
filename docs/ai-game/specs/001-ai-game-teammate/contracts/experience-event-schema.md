# Contract: 统一体验事件 Schema（Experience Event）

**Feature**: [../spec.md](../spec.md) | **Research**: [../research.md](../research.md) §6 | **Data Model**: [../data-model.md](../data-model.md) §5

第三层 B（实体硬件桌宠）与其软件降级方案（浏览器状态卡）共用的事件协议（对应 H3-02、FR-031）。事件源可以是 AIRI 既有的 Conscious/Action 层生命周期事件，也可以是 Reflex 层状态变化。

## 事件类型

| `type` | 触发时机 | `payload` 建议字段 |
|---|---|---|
| `speaking` | TTS 开始/结束播放一段语音 | `text`, `audio_ref`, `phase: start\|end` |
| `thinking` | Conscious 层 Brain 进入一次 LLM 规划轮次 | `trigger_reason` |
| `action` | Action 层开始/完成执行一个动作 | `action_name`, `phase: start\|end`, `result: success\|failed` |
| `success` | 一次任务/目标完成 | `mission_id` |
| `danger` | Perception/Reflex 层检测到威胁 | `danger_type`, `severity` |
| `hurt` | 角色受击 | `damage_amount` |
| `death` | 角色死亡 | `cause` |

## 消息包络

```json
{
  "event_id": "string",
  "type": "speaking | thinking | action | success | danger | hurt | death",
  "priority": 0,
  "payload": {},
  "emitted_at": "ISO8601"
}
```

`priority` 用于桥接进程/硬件端处理节流与状态覆盖时的排序依据（H3-03）——高优先级事件（如 `danger`、`death`）应能打断正在展示的低优先级事件（如 `thinking`）。

## 消费方一致性要求

Mock 环境、实体桌宠固件、浏览器软件降级状态卡 MUST 消费同一份上述 Schema，不得为任一消费方分叉出专属字段（FR-031）。事件映射到具体表现形式（表情/灯光/摆动/口型/音效）的映射表由各消费方自行维护，但输入事件的形状必须一致。

## 传输协议

WebSocket / MQTT / 串口三选一（H3-03），由部署环境决定；局域网场景建议优先 WebSocket，与项目内其余服务的协议习惯保持一致（见 `server-sdk-integration.md`）。
