# duplex-voice（Brain A 真全双工 + Brain B 意图）

实现 [`full-duplex-architecture.md`](../../docs/ai-game/specs/001-ai-game-teammate/contracts/full-duplex-architecture.md) 的 **双脑** 中的 **Brain B + Intent Bridge**；
**Brain A 听感**由本机 [Comni](https://github.com/OpenBMB/MiniCPM-o-Demo) / MiniCPM-o Audio Full-Duplex 承担。

```text
[Comni :8006 Audio Full-Duplex]  ← Brain A（真双流听+说）
        │ 旁路文本（Web Speech / listen）
        ▼
[duplex-voice :8787] → intent-bridge → game-tools → AIRI → minecraft-bot
```

默认 **不是** STT→LLM→TTS 半双工；默认也 **不是** stdin 聊天。

## 快速开始（本机）

```bash
# 仓库根
bash demo/voice-runtime/patch-comni-bridge.sh
bash demo/start-brain-a.sh
```

详见 `demo/voice-runtime/README.md`、`demo/duplex-runbook.md`。

## 环境变量

见 `.env.example`。默认指向本机 Comni：

- `MINICPM_REALTIME_URL=ws://127.0.0.1:8006/v1/realtime?mode=audio`
- `COMNI_BRIDGE=1`
- `DRY_RUN=0`
- `FOLLOW_PLAYER_NAME=Steve`

## 脚本

```bash
cd hackathon-services/duplex-voice
pnpm start          # 读 .env / .env.local
pnpm test
pnpm typecheck
```
