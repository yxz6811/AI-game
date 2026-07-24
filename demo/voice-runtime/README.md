# Brain A · 真全双工（本机 Comni MiniCPM-o）

默认路径：**Comni Audio Full-Duplex（听+说）** + **duplex-voice Intent Bridge（动作）**。
stdin 打字只是降级，不是真全双工。

## 一键启动

```bash
# 1) Comni.app → Start（:8006）
# 2) 首次建议注入桥（永久）
bash demo/voice-runtime/patch-comni-bridge.sh

# 3) 启动 Brain A 旁路 + Intent Bridge
bash demo/start-brain-a.sh
# 无 Bot 冒烟：bash demo/start-brain-a.sh --dry-run
```

浏览器打开 `https://localhost:8006/audio_duplex`，戴耳机，页内 **Stop → Start**，说「过来 / 停下 / 自己去发育」。

## 分工

| 层 | 组件 | 作用 |
|----|------|------|
| Brain A | Comni `:8006` Audio Full-Duplex | 真双流听+说 |
| 旁路 | `127.0.0.1:8787` comni-bridge | 听写 / Web Speech → 文本 |
| Brain B | Intent Bridge → AIRI → minecraft-bot | 跟我来 / 停下 / 发育… |

## 模型下载

```bash
bash demo/voice-runtime/download-comni-model.sh
```

## 接 Minecraft Bot

另开终端：Paper → AIRI `:6121` → `pnpm -F @proj-airi/minecraft-bot start`。
`hackathon-services/duplex-voice/.env.local` 里设 `FOLLOW_PLAYER_NAME=你的游戏名`、`DRY_RUN=0`。

完整联调步骤见 [`demo/duplex-runbook.md`](../duplex-runbook.md)。

## 验收

- [ ] Comni 能本地说话（戴耳机）
- [ ] `lsof -iTCP:8006 -sTCP:LISTEN` 有进程
- [ ] duplex 日志有 `[brain-a] 模式=本机 Comni`
- [ ] 语音「过来」出现 `[utterance] comni-…` / `[intent-bridge]`
- [ ] Bot 在游戏里跟过来
