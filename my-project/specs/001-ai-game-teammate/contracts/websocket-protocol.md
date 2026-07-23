# Contract: Bot Client ↔ Strategy Service WebSocket 协议

**Feature**: [../spec.md](../spec.md) | **Research**: [../research.md](../research.md) §6

Bot Client（Node/TS，运行在贴近 Minecraft 服务器的位置）与 Strategy Service（Python，云端 AI 大脑）之间维持一条 WebSocket 长连接。消息均为 JSON，顶层结构统一为 `{ "type": "<message_type>", "session_id": "...", "payload": {...}, "timestamp": "<ISO8601>" }`。

## 方向：Bot Client → Strategy Service

| `type` | 触发时机 | `payload` 关键字段 |
|---|---|---|
| `state.snapshot` | 结构化状态有更新，或达到最小上报间隔 | 对应 data-model.md 的 Game State Snapshot 字段（不含 `source=vision` 的场景，那部分由独立的截图/视觉采集路径提交） |
| `state.event` | 离散游戏事件发生（受击/死亡/任务完成，FR-004） | `event_type`, `event_detail` |
| `reflex.executed` | 本地反射层完成一次动作（供云端观测，不等待其确认） | `action`, `trigger`, `latency_ms`（应 < 100） |
| `tool.result` | 云端下发的 `tool_command` 执行完毕 | `instruction_id` 或 `tool_call_id`, `status`（`success`/`failed`/`timeout`）, `detail` |
| `connection.hello` | 建连后握手 | `bot_identity_id`, `minecraft_account_ref`, `client_version` |
| `connection.reconnected` | 掉线后重连成功（FR-023） | `disconnected_at`, `reconnected_at`, `gap_ms` |

## 方向：Strategy Service → Bot Client

| `type` | 触发时机 | `payload` 关键字段 |
|---|---|---|
| `tool.command` | Claude 输出一个非反射级 `tool_use`（见 `tool-schema.md`），需要 Bot Client 执行 | `tool_call_id`, `tool_name`, `tool_input` |
| `voice.speak` | 语音管线生成了一段待播放的语音（配合 `chat_say` 工具调用） | `exchange_id`, `audio_stream_ref` 或分段 `audio_chunk`, `text` |
| `voice.interrupt` | 玩家打断了 AI 队友说话（FR-010），要求立即停止播放 | `exchange_id` |
| `autonomy.updated` | 自主度档位变更生效（FR-015） | `level` |
| `session.end` | 会话正常/异常结束 | `reason` |

## 反射层与云端指令的优先级仲裁

本地反射层的动作**不经过此协议下发**——它是 Bot Client 内部直接执行的（research.md §5）。但反射层执行的动作需要通过 `reflex.executed` 上报给云端，以便 Strategy Service 在下一轮决策时感知到"世界状态已经因反射动作而改变"，避免下发与反射结果冲突的指令。

若云端下发的 `tool.command` 与反射层正在进行的动作冲突（例如反射层正在闪避，云端同时要求移动到某坐标），Bot Client MUST 优先完成反射级动作，云端指令排队等待反射动作结束后执行，不得抢占反射层（对应 FR-007 "不依赖云端网络往返"的不可抢占语义）。

## 连接韧性

- Bot Client 检测到连接断开后，MUST 在本地维持反射层独立运行（不因失去云端连接而停止基础安全反射，对应 spec.md 新增的 Edge Case），并以指数退避重试连接。
- 重连成功后，Bot Client MUST 发送 `connection.reconnected`，Strategy Service 据此更新 Game Session 的 `disconnect_events` 记录并校验 5 秒 SLA（SC-007）。
