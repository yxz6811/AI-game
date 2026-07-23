# Phase 0 Research: AI 游戏队友（实时语音 AI 队友系统）

**Feature**: [spec.md](./spec.md) | **Plan**: [plan.md](./plan.md) | **Date**: 2026-07-22

本文档解决 `plan.md` Technical Context 中需要研究澄清的技术决策。每一项按 Decision / Rationale / Alternatives Considered 的格式记录。

---

## 1. 语音/多模态 AI 后端选型

**Decision**: 不存在单一"实时语音大模型"厂商可以同时满足"视觉游戏状态理解 + 战术工具调用 + 全双工语音对话"。采用**分层组合方案**：
- Claude API（Anthropic）承担"大脑"职责——视觉状态理解（图像输入）、战术规划与工具调用（游戏动作决策）、对话文本生成（含人设/身份披露策略）。
- 一个独立的流式语音管线（STT + TTS）承担"耳朵和嘴巴"职责，与 Claude 的文本生成分段流水线拼接，而非等待 Claude 完整回复后才开始合成语音。

**Rationale**: 通过检索 Claude API 官方能力文档确认：Claude 的 Messages API 是文本（+ 图像/文档）输入、文本（+ 工具调用）输出的模型，**不提供音频输入/输出模态**，没有类似业界"实时语音"方案的 speech-to-speech 能力——PRD 中提到的"借鉴 GPT-4o Realtime API 等方案"是市场对标，不是可以直接复用的现成能力。因此语音层必须是独立的 STT/TTS 组件，Claude 只负责其中的"理解玩家说了什么的语义 + 决定说什么"这一环，而非端到端语音本身。这与 FR-007 已经确立的"本地反射层 + 云端策略层"混合架构是同一类工程权衡的延伸：不能假设单一云端大模型可以覆盖所有延迟敏感环节。

**Alternatives Considered**:
- *等待/寻找具备原生语音能力的 Claude 变体*：截至研究时不存在，且产品路线图对语音延迟要求明确（<500ms），不能押注于未确定的未来能力。
- *完全放弃分段流水线、等 Claude 全部文本生成完再合成语音*：会显著超出 500ms 预算（尤其在长回复时），故排除；分段流式喂给 TTS 是必需设计，而非可选优化。

---

## 2. Claude 模型选型（按角色区分）

**Decision**: 采用多模型分工，而非单一模型覆盖所有场景：
- **对话/闲聊短回复**（User Story 1/3，需要最低延迟）：Claude Sonnet 5，`thinking: adaptive`，`effort: low`，配合流式输出（`client.messages.stream()`）逐段喂给 TTS。
- **视觉游戏状态理解**（FR-002 视觉兜底方案，中等频率、中等延迟容忍度 <300ms）：Claude Sonnet 5（支持高分辨率视觉，2576px 长边），`effort: medium`。
- **战术规划与工具调用/指令分解**（User Story 2，TC-02/FR-016，延迟容忍度更高、正确性优先）：Claude Sonnet 5 起步，`effort: high`；若评测显示 Boss 战等复杂场景下 Sonnet 5 决策质量不足，升级到 Claude Opus 4.8（`effort: high`/`xhigh`）作为可插拔的更高档位，而非默认档位。

**Rationale**: 三类调用的延迟/质量权衡完全不同——对话短回复必须最快（`effort: low` + Sonnet 5 是速度与质量的合理平衡点，且 Sonnet 5 是 Sonnet 系列中首个支持 `xhigh` 的模型，未来可按需上调）；视觉理解需要平衡准确率与调用频率带来的成本；战术规划场景延迟预算最宽松（策略层 <300ms 起步，且用户故事 2 本身容忍度更高），适合更高 `effort` 换取更好的分工决策质量。统一使用单一模型/单一 `effort` 会在快场景浪费延迟预算、在难场景牺牲决策质量。

**Alternatives Considered**:
- *全部场景统一用 Opus 4.8*：决策质量上限最高，但对话短回复场景的延迟/成本不必要地增加；作为"评测后按需升级"的选项保留，不作为 V1 默认。
- *全部场景统一用 Haiku 4.5*：满足极限速度，但视觉理解与复杂战术分解的准确率存在风险；保留作为对话层的进一步优化候选（如简单确认性短语可能足够用 Haiku），需通过实测评估后再决定是否引入第三档模型。
- *使用 Fast Mode（Opus 4.8 专属 beta，`speed:"fast"`）*：可提升 Opus 输出速度，但 Sonnet 5 不支持 Fast Mode；若未来因质量原因切换到 Opus 4.8 作为对话模型，Fast Mode 是值得纳入的延迟优化手段，记录为后续任务而非 V1 阻塞项。

---

## 3. 工具调用（Function Calling）驱动游戏动作

**Decision**: 使用 Claude API 原生工具调用（Tool Use）能力定义游戏动作工具集（如 `move_to`、`attack`、`use_item`、`follow_player`、`chat_say`、`set_autonomy_level` 等，具体 schema 见 `contracts/`），由 Strategy Service 的决策模块（`decision/`）驱动一次工具调用循环：Claude 接收当前状态与玩家指令 → 输出一个或多个 `tool_use` 块 → Strategy Service 将其翻译为通过 WebSocket 下发给 Bot Client 的具体指令 → 执行结果作为 `tool_result` 回传，供下一轮决策参考（战斗失误识别 FR-019 等场景）。

**Rationale**: 工具调用是 Claude API 中专为"让模型驱动结构化外部动作"设计的机制，天然匹配 FR-016（战术指令拆解为具体动作序列）与 FR-015（自主度档位切换）的需求；工具的 JSON Schema 输入天然对应 Minecraft 可执行动作的参数化描述，比要求模型输出自由文本再做解析更可靠。

**Alternatives Considered**:
- *自由文本输出 + 正则/关键词解析成动作*：脆弱、容易随 prompt 变化而解析失败，排除。
- *Programmatic Tool Calling（代码执行容器内组合调用）*：适合"多次连续工具调用、中间结果无需进入上下文"的场景，但游戏动作需要逐步观察世界状态变化再决策（不是纯脚本化批处理），当前阶段收益不明显，标记为后续可评估的优化项，不纳入 V1。

---

## 4. Minecraft Java 版协议接入方式（Bot Client 技术选型）

**Decision**: 使用 `mineflayer`（Node.js/TypeScript 生态下成熟的 Minecraft Java 版协议兼容机器人客户端库）作为 AI 队友"独立机器人客户端账号"（FR-027）的底层实现，配合 `mineflayer-pathfinder`（寻路移动）与 `mineflayer-pvp`（近战辅助）等社区扩展。

**Rationale**: `mineflayer` 直接实现 Minecraft Java 版客户端-服务端协议，可以作为一个真实的"第二名玩家"连接到世界/服务器，具备完整的移动、交互、战斗操作能力，与 FR-005（使用和人类玩家相同的输入方式）及 FR-027（真实客户端身份而非服务端模拟实体）的要求高度契合；Clarifications 中已确认选择 Java 版正是基于其"机器人客户端支持成熟"的判断，`mineflayer` 是这一判断在实现层面的直接落地。

**Alternatives Considered**:
- *服务端模组模拟"伪玩家"（如 Carpet fake player 机制）*：已在 `/speckit-clarify` 阶段被明确否决（见 spec.md Clarifications），因为不是真实客户端、操作能力有差异。
- *Java 原生客户端 mod 注入*：需要修改/挂载到真实 Minecraft 客户端进程，与"不修改游戏客户端反作弊/完整性校验机制"的假设冲突，且与"独立账号连接"的已确认方向不符，排除。

---

## 5. 本地反射层的实现方式（非 LLM 驱动）

**Decision**: 本地反射层（Bot Client 内的 `reflex/` 模块）用确定性/启发式代码实现（如"检测到即将受到的近战伤害 → 触发预设闪避位移"），**不经过 Claude API 或任何云端大模型调用**，纯本地计算+执行，目标延迟 <100ms。

**Rationale**: FR-007 明确要求反射级操作"不依赖云端多模态大模型的实时往返"；即使是最快的 Claude 模型配置，一次网络往返 + 推理也难以稳定压到 100ms 以内。反射层的决策空间本身也远小于战术规划（"是否需要立即闪避/躲避"这类二元或少量枚举判断），用规则引擎/简单状态机比调用 LLM 更适合，也更符合 PRD 6.2 节"基础操作由传统游戏 AI 保证帧级响应"的技术方案描述。

**Alternatives Considered**:
- *在 Bot Client 本地部署轻量本地推理模型做反射决策*：增加了本地计算资源需求与模型维护成本，收益不确定（反射场景的规则通常明确、无需生成式推理），暂不采用；如未来场景复杂度提升（如需要预测性走位），可作为后续演进方向记录。

---

## 6. Bot Client ↔ Strategy Service 通信协议

**Decision**: WebSocket 双向长连接，Bot Client 持续上报游戏状态增量（结构化数据或视觉帧引用）与反射层执行记录，Strategy Service 下发非反射级动作指令、语音相关事件与自主度设置变更。协议消息 schema 见 `contracts/websocket-protocol.md`。

**Rationale**: WebSocket 提供低开销的双向实时通信，适合高频状态上报与低延迟指令下发的场景；相比 HTTP 轮询能显著降低延迟与请求开销，相比 gRPC 流式在两个技术栈（Node.js/Python）之间的互操作与调试成本更低（无需维护跨语言 protobuf 编译链）。

**Alternatives Considered**:
- *gRPC 双向流*：类型安全更强，但引入跨语言 protobuf 工具链的额外复杂度，对 V1 单一游戏、单一语言对（TS↔Python）的场景收益不足以抵消复杂度增加，排除，可在多语言/多游戏扩展阶段重新评估。
- *HTTP 长轮询*：延迟与吞吐特性明显劣于 WebSocket，排除。

---

## 7. 视觉游戏状态感知的输入形式

**Decision**: FR-002 的视觉兜底方案通过**周期性截图/关键帧采样**实现——Bot Client 或一个屏幕捕获组件按需（或固定频率）截取画面，编码为图像后通过 Claude API 的图像输入（base64/URL）传给 Strategy Service 的视觉理解模块，而非试图做连续视频流的原生理解。

**Rationale**: Claude API 的多模态输入是图像（含高分辨率支持）与文档，**没有原生的"视频"内容类型**——视觉理解必须以离散帧的形式提供。这与"非反射级决策 <300ms"的预算也是一致的：每次决策点采集一帧、发起一次视觉推理调用，天然符合"事件/决策点驱动"而非"逐帧连续处理"的调用模式，也控制了视觉调用的频率与成本。

**Alternatives Considered**:
- *持续视频流理解*：API 不支持，且即使支持，逐帧连续推理的延迟与成本也远超预算，排除。
- *仅依赖结构化接口（FR-001），完全不做视觉兜底*：与 spec 中 FR-002 的 MUST 要求冲突，排除；视觉方案作为结构化接口不可用时的兜底路径予以保留。

---

## 8. 玩家端语音采集/播放形式

**Decision**: `player-voice-client` 采用 WebRTC 音频流作为默认技术路线（麦克风采集、低延迟上行；AI 语音下行播放），具体是浏览器叠加层还是游戏内原生叠加层留待 Phase 2 任务阶段结合实际用户体验测试确定，本阶段先以"独立于游戏进程之外的伴侣客户端"为默认形态（与 FR-027 的"独立机器人客户端"架构保持一致：玩家语音客户端同样不侵入 Minecraft 客户端本身）。

**Rationale**: WebRTC 是浏览器与桌面场景下低延迟音频流的行业标准方案，原生支持回声消除、抖动缓冲等特性，减少自研音频管道的工程量；不侵入游戏客户端进程也避免了触碰"不修改游戏客户端反作弊/完整性校验机制"的边界假设。

**Alternatives Considered**:
- *游戏内原生 mod 集成语音采集*：体验更沉浸（无需切换窗口/叠加层），但会更接近"修改游戏客户端"的边界，且大幅增加 Java 版客户端 mod 开发的工程范围，作为 Phase 2 打磨阶段的候选优化，不纳入 V1 阻塞路径。

---

## 9. 玩家偏好档案（FR-018）持久化策略

**Decision**: MVP（User Story 1）不引入持久化存储；User Story 2 落地后期视 FR-018 实现需要，为 Strategy Service 增加一个轻量文档/键值存储（候选：Redis 持久化模式或 SQLite，视部署环境单机/多实例而定），存储玩家 ID → 战术偏好摘要的简单映射，不在 Phase 0 现在就锁定具体产品，留给对应任务阶段的实现细节。

**Rationale**: spec.md 的 Assumptions 已明确"长期偏好记忆的深度个性化…不构成本阶段（User Story 1、2）的验收门槛"，过早引入持久化存储会增加不必要的基础设施复杂度；FR-018 本身也是 SHOULD 而非 MUST。保留决策空间到真正需要实现时，能根据届时的部署形态（单实例/多实例/云托管）做更贴合的选型。

**Alternatives Considered**:
- *V1 起步就引入 PostgreSQL*：为一个当前明确排除在验收门槛之外的能力预先构建持久化层，属于过度设计，排除。

---

## 10. 测试策略

**Decision**:
- Bot Client（Node/TS）：Vitest 做 `reflex/`、`humanizer/` 等纯逻辑单元测试；对接 Docker 化的本地 Minecraft 测试服务端（Paper 或原版服务端）做集成测试，验证 mineflayer 连接、移动、交互的真实性。
- Strategy Service（Python）：pytest 做单元测试；Claude API 调用在测试中使用固定/录制响应（避免测试依赖真实网络调用与产生真实费用），STT/TTS 同样使用测试替身（fake streaming source）。
- 端到端：编写脚本化场景，按 spec.md 中 User Story 1/2/3 的 Acceptance Scenarios 驱动一次完整的人机协作流程（可用真人测试者配合脚本化断言，或半自动化脚本模拟语音输入），并在关键节点记录时间戳以验证延迟预算（SC-005/SC-006/SC-007）是否达标。

**Rationale**: 分层测试策略匹配分层架构；对真实 Minecraft 服务端做集成测试是验证"真实客户端身份、真实操作能力"（FR-027 的核心诉求）唯一可靠的方式，纯 mock 无法覆盖协议层面的正确性。

**Alternatives Considered**:
- *仅用 mock/单元测试，不接入真实 Minecraft 测试服*：无法验证 mineflayer 与真实协议的兼容性及"真实第二名玩家"体验，排除。

---

## 未解决事项（明确记录，非阻塞）

- **STT/TTS 具体厂商选型**：research 阶段仅确定了技术模式（流式 ASR + 流式 TTS，目标延迟量级）与集成方式，未锁定具体供应商，因为这类选型对市场价格/延迟实测数据的时效性要求高，且不属于影响架构落地的阻塞决策——留待 Phase 2 任务阶段安排一个"供应商选型 spike"任务，基于当时可获得的实测延迟/成本数据决定。
- **视觉调用触发频率的具体数值**：research 阶段确定"事件/决策点驱动"而非"固定帧率轮询"的模式，但具体触发阈值（如"每 N 秒或状态变化超过阈值时触发"）留给实现阶段结合真实游戏内测数据调优。
