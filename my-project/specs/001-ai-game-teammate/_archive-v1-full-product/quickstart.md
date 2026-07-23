# Quickstart: AI 游戏队友验证指南

**Feature**: [spec.md](./spec.md) | **Plan**: [plan.md](./plan.md) | **Data Model**: [data-model.md](./data-model.md) | **Contracts**: [contracts/](./contracts/)

本指南描述如何在本地环境端到端验证 AI 队友功能，覆盖 spec.md 中 User Story 1/2/3 的 Acceptance Scenarios。不包含实现代码——具体模型/服务/控制器代码属于 `tasks.md` 与实现阶段。

## 前置条件

- Docker（用于运行本地 Minecraft Java 版测试服务端，如 Paper/Vanilla server）
- Node.js 20 LTS（Bot Client）
- Python 3.11+（Strategy Service）
- 一个用于 AI 队友的独立 Minecraft Java 版账号（FR-027；测试环境可使用离线模式测试服，正式环境需符合 Mojang/Microsoft 服务条款）
- Anthropic API Key（Claude API 调用）
- 一个可用的流式 STT/TTS 测试凭证（供应商待定，见 research.md §未解决事项；本地验证可先用录制音频 + 固定转写文本的替身跑通非语音部分）

## 环境搭建（概述）

1. 启动本地 Minecraft Java 版测试服务端（Docker），确认服务端已安装用于结构化状态读取的模组/命令接口（对应 FR-001，见 spec.md Assumptions）。
2. 启动 Strategy Service（Python），配置 Anthropic API Key，加载 `contracts/tool-schema.md` 中定义的工具集。
3. 启动 Bot Client（Node/TS），使用 AI 队友的独立账号连接测试服务端，并与 Strategy Service 建立 WebSocket 连接（`connection.hello`，见 `contracts/websocket-protocol.md`）。
4. 使用真实玩家账号登录同一测试服务端，进入双人合作场景（如联合建造、生存过夜防御等，见 spec.md 对"关卡"一词的说明）。

## 验证场景

### 场景 A — User Story 1：核心感知—操控—对话闭环

对应 spec.md User Story 1 的 5 条 Acceptance Scenarios：

1. **自动加入与问候**：玩家进入已启用 AI 队友的会话后，观察 Bot Client 日志确认 `connection.hello` 已完成，并在数秒内收到一条 `voice.speak` 消息（问候语）。**预期**：AI 队友在数秒内出现在游戏世界中并说出问候语。
2. **简单语音指令**：玩家对着 player-voice-client 说"跟上"。**预期**：观察 `contracts/voice-pipeline.md` 定义的分段延迟——`response_text` 对应 `move_to`（跟随）工具调用，在语音指令解析后由云端策略层在 300ms 内下达；同时人为制造一次紧急情况（如靠近生物），确认本地反射层在 100ms 内独立完成反应（不经过云端往返，检查 Bot Client 日志中 `reflex.executed` 的 `latency_ms` 字段）。
3. **打断说话**：在 AI 队友说话过程中，玩家开始说话。**预期**：Bot Client/player-voice-client 发出 `voice.interrupt`，AI 队友立即停止播放，对应 Voice Exchange 记录中 `interrupted = true`；整体感知延迟 < 500ms（验证 `latency_ms.total_ms` 字段，对应 SC-005）。
4. **掉线重连**：人为断开 Bot Client 与 Minecraft 服务器的连接（或断开与 Strategy Service 的 WebSocket）。**预期**：5 秒内自动恢复（`connection.reconnected` 事件），Game Session 的 `disconnect_events` 记录本次断线时长，验证 SC-007。
5. **视觉兜底**：临时禁用结构化状态接口（模拟"无官方接口"场景），确认系统改用视觉解析（`state.snapshot` 的 `source = vision`），行为与有接口时一致。

**验收标准**：以上 5 项均通过，即可判定 User Story 1（MVP）交付。

### 场景 B — User Story 2：战术协作

对应 spec.md User Story 2 的 3 条 Acceptance Scenarios，需要一个可触发分工的战斗/复杂遭遇场景（如 Boss 战）：

1. 玩家语音下达"我吸引火力，你绕后打弱点"，观察 Strategy Service 决策日志：Claude 是否输出了对应的 `move_to` + `attack` 工具调用组合（`contracts/tool-schema.md`），且未与玩家自身动作冲突。
2. 在玩家未下达指令的情况下，人为制造一个"有意义的决策点"（如陷阱），观察是否触发 `suggest_action` 工具调用并通过语音输出建议，而非强行代替玩家决策。
3. 人为制造一次协作失误（如不响应支援请求），观察下一轮 Claude 决策是否体现 FR-019 描述的"识别失败并调整/致歉"。

### 场景 C — User Story 3：情感陪伴与人设化闲聊

1. 跑图过程中发起游戏相关话题闲聊，验证 AI 队友接话自然、不冷场。
2. 发起轻度游戏外话题，验证适度回应；发起偏敏感话题，验证得体转移（FR-021）。
3. 分别用玩笑语气与认真语气询问"你是不是 AI"，验证 FR-022 的折中披露策略——玩笑语气下维持角色扮演，认真语气下如实承认。

## 延迟与成功率验证

以下指标建议在多次重复运行（建议 ≥ 20 次交互样本）后统计，而非单次验证：

| 指标 | 目标 | 数据来源 |
|---|---|---|
| 反射级操作延迟 | < 100ms | Bot Client `reflex.executed` 的 `latency_ms` |
| 非反射级指令延迟 | < 300ms | Strategy Service 决策日志时间戳 |
| 语音交互总延迟 | < 500ms（≥95% 样本） | Voice Exchange 的 `latency_ms.total_ms`（对应 SC-005） |
| 打断响应成功率 | ≥ 95%（对应 SC-002） | Voice Exchange 的 `interrupted` 字段统计 |
| 掉线恢复时间 | < 5s（对应 SC-007） | Game Session 的 `disconnect_events` |
| 任务完成率 | ≥ 90%（对应 SC-001） | 场景 A/B 端到端跑通次数统计 |

## 已知限制（V1）

- STT/TTS 供应商未最终锁定（research.md 未解决事项），本指南中语音相关步骤在供应商确定前可用固定音频+转写文本替身跑通非语音路径。
- 玩家偏好档案持久化（FR-018）尚未实现存储层，场景验证中"记住玩家偏好"相关行为暂不覆盖。
