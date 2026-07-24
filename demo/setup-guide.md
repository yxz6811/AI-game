# Gate 1 Setup Guide（第一层）

## 一次装好

```bash
# 仓库根
pnpm i --registry=https://registry.npmjs.org
# 若 sharp postinstall 失败可：
pnpm i --ignore-scripts --registry=https://registry.npmjs.org
pnpm exec turbo run build -F=@proj-airi/server-runtime... -F=@proj-airi/server-sdk...
```

`stockfish@18.0.7` 在 npmmirror 上 404，整仓安装请用官方 npm registry。

## 配置

1. 复制并编辑 `services/minecraft/.env.local`（已有 Gate 1 模板）
   **必须**把 `OPENAI_API_KEY` 换成真实密钥，否则指令会 401、无法执行跟随。
2. Minecraft 服：见 `demo/mc-server/README.md`（Paper 1.21.1 / offline / `demo_world`）。

## 启动三件套

```bash
# 终端 1
cd demo/mc-server && ./start.sh

# 终端 2
node packages/server-runtime/dist/bin/run.mjs
# → ws://127.0.0.1:6121

# 终端 3
pnpm -F @proj-airi/minecraft-bot start
# → airi_bot 进服
```

## 验收

- 人工：`demo/tier1-script.md`
- 探针（同世界 + spark 收包）：`cd services/minecraft && pnpm exec tsx scripts/gate1-probe.mjs`
- 回归骨架：`demo/regression.sh`
- Gate 勾选：`demo/stage-gate-checklist.md`
- 故障：`demo/runbook.md`
