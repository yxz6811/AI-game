# MiniCPM-o 真全双工联调 Runbook（Brain A 默认）

## 架构

```text
玩家麦/耳机 ←→ Comni Audio Full-Duplex (:8006)     ← Brain A 真双流
                     │ listen / Web Speech 旁路
                     ▼
              duplex-voice :8787 → Intent Bridge → AIRI → minecraft-bot
```

- **Brain A**：本机 Comni（MiniCPM-o 4.5）— 听+说同时进行
- **Brain B**：`hackathon-services/duplex-voice` — 意图与游戏动作
- **stdin**：仅降级；不要用打字冒充「已上真全双工」

## 推荐：本机 Brain A（一键）

```bash
# Comni.app GUI：下载模型 → Start
bash demo/voice-runtime/patch-comni-bridge.sh   # 首次
bash demo/start-brain-a.sh                      # 或 --dry-run
open 'https://localhost:8006/audio_duplex'
```

页内 Stop→Start，说「过来」「停下」。duplex 终端应见 `[brain-a]` / `[utterance] comni-…` / `[intent-bridge]`。

## 接真 Bot（4 终端）

| 终端 | 作用 |
|------|------|
| A | Paper `demo/mc-server/./start.sh` |
| B | AIRI `pnpm -F @proj-airi/server-runtime …`（:6121） |
| C | `pnpm -F @proj-airi/minecraft-bot start` |
| D | `bash demo/start-brain-a.sh` |

`.env.local`（`hackathon-services/duplex-voice/`）：

```bash
MINICPM_REALTIME_URL=ws://127.0.0.1:8006/v1/realtime?mode=audio
COMNI_BRIDGE=1
DRY_RUN=0
FOLLOW_PLAYER_NAME=你的游戏内用户名
AIRI_WS_URL=ws://127.0.0.1:6121/ws
```

## 故障表

| 现象 | 处理 |
|------|------|
| :8006 无进程 | 开 Comni.app → Start |
| 有语音无 `[utterance]` | 跑 `patch-comni-bridge.sh` 或打开 `http://127.0.0.1:8787/health` 复制 inject |
| Bot 不动 | `DRY_RUN=0`、FOLLOW 名与客户端一致、AIRI+bot 在线 |
| 公网排队 | 改回本机 Comni；勿用公网冒充本机双流 |

## 公网协议联调（可选，非默认）

仅验证 Realtime text 旁路时：

```bash
# .env.local
MINICPM_REALTIME_URL=wss://minicpmo45.modelbest.cn/v1/realtime?mode=audio
COMNI_BRIDGE=0
DRY_RUN=1
pnpm -C hackathon-services/duplex-voice start
open 'https://minicpmo45.modelbest.cn'
```

旁路不稳时仍可用 stdin；**这不等于 Brain A 本机真全双工。**

## 验收（契约对齐）

- [ ] 戴耳机可与 Comni 重叠说话（Brain A）
- [ ] 语音指令驱动 Bot（Brain B）
- [ ] 「停下」能打断当前动作
- [ ] 关掉 duplex 后第一层文本/Bot 仍可独立跑
