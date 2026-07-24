# Contract: 真全双工语音架构（True Full-Duplex）

**Status**: Active demo path（2026-07-24）— Brain A = 本机 Comni Audio Full-Duplex；Brain B = duplex-voice Intent Bridge
**Scope**: 第二层 A / User Story 2 的**目标架构**
**非目标**: 本文件描述的是真全双工；**不是**「持续麦 + 流式 STT/TTS + barge-in」级联半双工。

> **当前演示落地**：`bash demo/start-brain-a.sh` + Comni `audio_duplex`。媒体双流在 Comni 进程内；本仓持有 Intent Bridge 与游戏工具，不把 Comni 音频帧再拷进 Node。

---

## 0. 术语：两种架构必须分开

| | **级联可打断（半双工 + barge-in）** | **真全双工（本架构）** |
|--|-----------------------------------|------------------------|
| 音频 | 上行听完/边听边转写 → 文本 LLM → 下行 TTS | **用户音频流与 AI 音频流并行、同一会话内同时存在** |
| 对话态 | 轮次制：你说完 → 我说；打断 = 停播 + 开新一轮 | 通话制：可重叠、可抢话、可边说边听 |
| 典型实现 | VAD → STT → LLM → TTS + 打断控制器 | Speech-to-speech 双流模型 / Realtime API |
| 本仓库现状 | **未实现**（旧 tasks US2 曾按此规划，已废弃为第二层主路径） | **待按本文新建** |

> 产品口述「像 GPT Live」时，一律按右列验收，不得用左列冒充。

---

## 1. 设计目标

1. **真双流会话**：玩家与 AI 的音频在同一 session 内同时进出，允许重叠与自然抢话。
2. **游戏可控**：语音会话能驱动 Minecraft 动作（follow/stop/move/…），且可取消进行中任务。
3. **与第一层解耦**：全双工服务以外围进程存在；关闭后第一层文本/既有演示仍可跑（FR-049）。
4. **可部署**：优先选用当前可跑的开源或可自托管组件；tool use 不绑架在尚不成熟的「一体 S2S+FC」模型上。

---

## 1a. 现有开源项目盘点与推荐组合（2026-07 检索；Brain A 已切换为 MiniCPM-o 4.5）

> 原则：**尽量组装现成可部署项目**，少从零写媒体栈与推理服。

### 可用组件（已确认可自托管）

| 项目 | 角色 | 真全双工 | Tool use | 部署方式 | 备注 |
|------|------|----------|----------|----------|------|
| **[openbmb/MiniCPM-o-4_5](https://huggingface.co/openbmb/MiniCPM-o-4_5)** + **[MiniCPM-o-Demo](https://github.com/OpenBMB/MiniCPM-o-Demo)** | Brain A **首选** | ✅ 官方 Omnimodal / Audio Full-Duplex（输入输出流不互堵） | ⚠️ 双工 Realtime 主路径仍以旁路 tools 为准 | 官方 Docker：Gateway + Worker + PyTorch/`llama.cpp-omni` Backend；Realtime API 文档 | 9B；中英双语语音；可看+听+说；端侧 INT4 / Mac 可用 llama.cpp-omni |
| [kyutai-labs/moshi](https://github.com/kyutai-labs/moshi) | Brain A 备胎 | ✅ 双流 S2S | ❌ | `docker compose` / `:8998` | 英主；协议与 MiniCPM Realtime 不同 |
| [NVIDIA/personaplex](https://github.com/NVIDIA/personaplex) | Brain A 备胎 | ✅ 基于 Moshi | ❌ | `python -m moshi.server` | 人设/音色强；无原生 FC |
| [livekit/agents](https://github.com/livekit/agents) | 可选会话壳 | 取决于 model | ✅ | 自托管 | **无**官方 MiniCPM-o 插件；若坚持 LiveKit 需自写 Realtime 适配，非默认 |
| [kyutai-labs/unmute](https://github.com/kyutai-labs/unmute) | 级联听说 | ❌ | ⚠️ | Docker | 半双工降级用 |
| AIRI `@proj-airi/server-sdk` + `services/minecraft` | 游戏执行面 | n/a | 动作执行 | 本仓库已有 | Brain B 出口 |

### 推荐组合（黑客松默认 · MiniCPM-o 4.5）

```text
[玩家浏览器 / 薄客户端]
        │ 官方 Realtime / Demo 的 Audio Full-Duplex WebSocket
        ▼
[MiniCPM-o-Demo Gateway] ──► [Worker] ──► [Backend: MiniCPM-o-4_5]
        │  PyTorch CUDA（精度优先）或 llama.cpp-omni（端侧/Mac）
        │
        │ 旁路：partial text / 会话事件（供意图）
        ▼
[duplex-voice Intent Bridge + game-tools]
        └──► @proj-airi/server-sdk ──► minecraft-bot ──► MC
```

**为何换 MiniCPM-o 4.5：**

1. **更强多模态与双语**：相对 Moshi/PersonaPlex，中文对话与「听+说（可选看）」综合能力更贴黑客松演示。
2. **官方可部署全双工栈**：`MiniCPM-o-Demo` 已提供 Gateway/Worker/Backend、Audio Full-Duplex 页与 Realtime API，不必绑 LiveKit+PersonaPlex。
3. **硬件更友好**：论文/README 称端侧可压到较低显存/内存（llama.cpp-omni INT4）；精度演示仍用 GPU PyTorch。
4. **Tool 仍旁路**：双工 live 路径不假设原生 FC 稳定；MC 动作继续走 Intent Bridge（与此前双脑原则一致）。

### 明确不推荐当「真全双工主路径」

- Unmute / STT→LLM→TTS 级联。
- 仅用 Ollama 文本/非双工入口冒充全双工（Ollama 有模型，但 **Audio Full-Duplex 以 Demo/Realtime 为准**）。

### 硬件与许可（写入 version-matrix）

- 权重：`openbmb/MiniCPM-o-4_5`（Apache-2.0 生态；以 HF/仓库声明为准）。
- 演示优先：NVIDIA GPU + Demo PyTorch backend；笔记本/Mac：`llama.cpp-omni` / `docker-compose.cpp.yml`。
- 记录 Demo 端口（常见文档页 `:8006`，以实际 compose 为准）与 Realtime API base URL。

---

## 2. 总览：双脑架构

开源界尚无「真全双工 S2S + 可靠 tool use」一体模型。本项目采用 **双脑**：

```text
┌─────────────────────────────────────────────────────────────┐
│                     Player Client                            │
│         mic ──► WebRTC/WS ──► speaker                        │
└───────────────────────┬─────────────────────────────────────┘
                        │ 双向 PCM / Opus（常开）
                        ▼
┌─────────────────────────────────────────────────────────────┐
│              duplex-gateway（本项目新建）                      │
│  · Session 生命周期 · 回声策略 · 延迟埋点 · 鉴权/本机绑定       │
└───────────────┬─────────────────────────────┬───────────────┘
                │                             │
                ▼                             ▼
┌───────────────────────────┐   ┌─────────────────────────────┐
│ Brain A: Duplex Speech    │   │ Brain B: Tool / Game Agent  │
│ （听+说，真双流）            │   │ （意图→工具→MC 动作）          │
│ · MiniCPM-o 4.5（默认）    │   │ · 文本 LLM + function call  │
│   via MiniCPM-o-Demo       │   │ · 经 server-sdk → AIRI      │
│ · 备胎 Moshi/PersonaPlex   │   │ · 取消令牌 → Action 层       │
└─────────────┬─────────────┘   └──────────────▲──────────────┘
              │ 旁路文本/事件                     │
              │ （inner monologue / 意图快照）      │
              └──────────► Intent Bridge ─────────┘
```

- **Brain A**：只负责「像真人打电话」——双流听写、抢话、韵律。
- **Brain B**：只负责「像队友执行指令」——解析意图、调工具、取消任务。
- **Intent Bridge**：把 A 侧可观测文本/事件转成 B 侧 tool 调用；把 B 侧执行结果压缩成短提示回灌 A（可选，避免 A「说了跟没做」）。

---

## 3. 组件与目录约定

建议落在仓库根（与 AIRI monorepo 并列的外围服务）：

```text
hackathon-services/
└── duplex-voice/                 # 真全双工栈（新建，替代旧 voice-orchestration 构想）
    ├── gateway/                  # duplex-gateway：媒体入口 + session
    │   └── src/
    │       ├── session-manager.ts
    │       ├── media-bridge.ts   # WebRTC 或原始 WS 音频帧
    │       ├── aec-policy.ts     # 耳机优先 / 播放窗抑制
    │       └── latency.ts
    ├── speech-runtime/           # Brain A 适配层（可插拔后端）
    │   └── src/
    │       ├── types.ts          # DuplexSpeechBackend 接口
    │       ├── backends/
    │       │   ├── moshi.ts      # 默认开源路径
    │       │   └── personaplex.ts
    │       └── runtime-host.ts
    ├── intent-bridge/            # A → B 桥
    │   └── src/
    │       ├── trigger.ts        # 关键词 / 语义闸门 / 并行旁路 STT（可选）
    │       ├── tool-router.ts
    │       └── result-injector.ts
    ├── game-tools/               # Brain B 的工具面
    │   └── src/
    │       ├── tools.ts          # follow/stop/move/collect/interact/say
    │       ├── cancel.ts         # 任务取消令牌 → minecraft Action
    │       └── airi-sdk-client.ts
    └── README.md
```

AIRI 侧：**默认不改** `services/minecraft` 内部；仅通过 `@proj-airi/server-sdk` 发既有事件/动作（与第一层同一通道）。确需取消进行中任务时，走既有 Action 取消语义（可最小侵入接 `reflex` 抑制信号，但是 **B 脑触发**，不是「VAD 打断 TTS」那条旧链路）。

---

## 4. 关键协议（Session）

### 4.1 媒体

| 方向 | 内容 | 要求 |
|------|------|------|
| Client → Gateway | 连续上行音频帧 | 会话建立后常开；不按「按完再说」 |
| Gateway → Client | 连续下行音频帧 | 与上行并行；允许与上行时间重叠 |
| 编码 | PCM 16k/24k 或 Opus | 与所选 Brain A 原生采样率对齐（Moshi/Mimi 多为 24 kHz） |

### 4.2 控制面（JSON over 同一 WS 或旁路通道）

```ts
/** 会话控制事件（示意） */
type DuplexControlEvent
  = | { type: 'session.start', sessionId: string, persona?: string }
    | { type: 'session.end', sessionId: string }
    | { type: 'speech.partial_text', role: 'user' | 'assistant', text: string, t_ms: number }
    | { type: 'intent.candidate', text: string, confidence: number, t_ms: number }
    | { type: 'tool.invoked', name: string, args: Record<string, unknown>, callId: string }
    | { type: 'tool.result', callId: string, ok: boolean, summary: string }
    | { type: 'task.cancel', reason: 'user_stop' | 'replan', t_ms: number }
    | { type: 'metrics.stage', stage: string, ms: number }
```

Brain A 若提供 inner monologue / 对齐文本流，Gateway 必须转发为 `speech.partial_text`，供 Intent Bridge 消费。

---

## 5. Brain A：Duplex Speech Runtime

### 5.1 后端接口（可插拔）

```ts
/**
 * 真全双工语音后端：双流同时推进，不得建模成「先 STT 再 TTS」的单轮管道。
 */
export interface DuplexSpeechBackend {
  startSession: (opts: { sessionId: string, voicePrompt?: Uint8Array, textPersona?: string }) => Promise<void>
  /** 持续喂入用户音频；调用方不得在 AI 说话时停喂 */
  pushUserAudio: (frame: AudioFrame) => void
  /** 订阅 AI 音频输出（与 push 并行） */
  onAssistantAudio: (cb: (frame: AudioFrame) => void) => void
  /** 可选：对齐文本 / 内心独白，供 Intent Bridge */
  onText?: (cb: (evt: { role: 'user' | 'assistant', text: string, partial: boolean }) => void) => void
  /** 硬停会话（非「半双工打断」语义，而是拆会话） */
  endSession: () => Promise<void>
}
```

### 5.2 默认选型（黑客松可部署）

| 优先级 | 后端 | 说明 |
|--------|------|------|
| **P0 默认** | **MiniCPM-o 4.5** + **MiniCPM-o-Demo**（Audio Full-Duplex / Realtime API） | 见 §1a；中英双语；官方 Gateway；tools 仍走 Intent Bridge |
| P0 备胎 | PersonaPlex 或 Moshi Docker | 同属真双流；协议不同，需另适配 |
| P1 逃生 | 托管 Realtime（闭源） | 仅开源 GPU 路径卡死时 |
| 明确不选作 Brain A | Unmute / `unspeech` 级联 | 半双工架构，见 §0 / §1a |

### 5.3 回声

- 演示优先 **耳机**。
- 外放时：Gateway 在 assistant 播放活跃窗对上行做抑制或依赖后端自带双流分离；禁止「把 AI TTS 再送进 STT」的级联自激路径（本架构无独立 TTS 环，但仍要防扬声器回路）。

---

## 6. Brain B + Intent Bridge：Tool Use

### 6.1 为什么拆开

MiniCPM-o 4.5 的 **全双工 Realtime / Demo 路径**不保证稳定、可编排的原生 Minecraft function calling。游戏动作必须由 **Intent Bridge + 带 tools 的执行面**完成（可后续再评估把 FC 并进 Chat Completions 非双工通道，但不得阻塞双工主演示）。

### 6.2 触发策略（由易到难，可渐进）

1. **规则闸门（MVP）**：从 `speech.partial_text(user)` 匹配「跟我来 / 停下 / 到这里 / 捡起来」等 → 直接 `tool.invoked`。
2. **旁路 STT + 小分类器**：与 Brain A 并行跑轻量识别，只做意图，不承担对话生成。
3. **语义触发**：检测到「要执行游戏动作」再唤醒 Brain B 完整 LLM（成本高，后置）。

### 6.3 工具面（与 Game Adapter / 第一层动作对齐）

最少工具集：`follow` | `stop` | `move` | `collect` | `interact` | `say`。

- 调用经 `game-tools` → `@proj-airi/server-sdk` → AIRI / `services/minecraft`。
- `stop` / 改派：**MUST** 发 `task.cancel`，取消 Action 层进行中任务（验收对齐原 SC 动作取消意图，但触发源是 Intent Bridge，不是 VAD barge-in 控制器）。

### 6.4 结果回灌（SHOULD）

`tool.result.summary` 压缩为短文本，经 Gateway 注入 Brain A 的 text prompt / 侧信道，使 AI 口头确认与世界状态一致。注入失败不得阻断工具执行本身。

---

## 7. 与旧「US2 级联方案」的关系

| 旧构件（tasks 曾规划） | 本架构 |
|----------------------|--------|
| `voice-orchestration` + VAD/STT/TTS | **不作为主路径**；目录名改为 `duplex-voice` |
| `barge-in-controller.ts` | **删除语义**；双流模型内部处理抢话 |
| `aec.ts` 防 TTS 回灌 STT | 改为播放窗/耳机策略 + 后端双流 |
| Reflex 抑制信号当「开口打断 TTS」 | 仅保留给 **Brain B 取消游戏任务**（可选） |
| 延迟看板 VAD/STT/LLM/TTS | 改为：`media_up` / `speech_runtime` / `intent_bridge` / `tool` / `action` |

---

## 8. 验收标准（替代旧 FR-009~014 的语义）

1. **双流并存**：AI 正在出声时，上行用户音频仍被 Brain A 消费（日志/指标可证），而非「停听等说完」。
2. **可重叠**：人工制造玩家与 AI 同时说话 ≥10 次，会话不崩溃；至少 8 次后系统仍能继续合理对话或执行指令。
3. **工具可达**：语音说「跟我来」「停下」各测 10 次，动作正确执行 ≥8 次。
4. **隔离**：杀掉 `duplex-voice` 进程后，第一层演示脚本仍可通过。
5. **可观测**：一次慢响应可定位到 §7 新阶段名之一。

---

## 9. 部署拓扑（最小可演示）

```text
[玩家浏览器/薄客户端]
        │ MiniCPM-o Realtime / Audio Full-Duplex WS
        ▼
[MiniCPM-o-Demo Gateway + Worker + Backend(MiniCPM-o-4_5)]
        │ partial text / 事件旁路
        ▼
[duplex-voice intent-bridge + game-tools]
        └──► [@proj-airi/server-sdk] ──► [AIRI + minecraft-bot] ──► [MC 测试服]
```

硬件：GPU PyTorch 精度优先；无足够 GPU 时用官方 `llama.cpp-omni` 路径并在 `demo/version-matrix.md` 标注延迟预期。无任一可跑后端时不得宣称「已上真全双工」。

---

## 10. 明确不做

- 不用级联 STT→LLM→TTS 冒充全双工。
- 不把 tool schema 硬塞进尚不支持 FC 的 S2S 权重里「碰运气」。
- 不在第一层 Gate 1 之前强绑 GPU 全双工（全双工是第二层；Gate 1 仍是 MC 文本闭环）。
- 不承诺与闭源 GPT Live 完全同级的多语/推理质量；验收以 §8 为准。
