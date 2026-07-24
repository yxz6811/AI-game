# Gate 1 Runbook（第一层）

## 冷启动顺序

1. **Minecraft 测试服**
   `cd demo/mc-server && ./start.sh`
   等到日志 `Done (...)!`（端口 `25565`，世界 `demo_world`，`online-mode=false`）

2. **构建 AIRI 总线依赖（首次 / 清 dist 后）**
   ```bash
   pnpm exec turbo run build -F=@proj-airi/server-runtime... -F=@proj-airi/server-sdk...
   ```

3. **AIRI 事件总线**
   ```bash
   node packages/server-runtime/dist/bin/run.mjs
   ```
   日志应出现：`started on ws://127.0.0.1:6121`
   （`pnpm -F @proj-airi/server-runtime dev` 在未 build 时易缺 dist，优先用上面的 node 启动）

4. **Minecraft Bot**
   先在 `services/minecraft/.env.local` 填入**真实** `OPENAI_API_KEY`（占位 `sk-REPLACE_ME` 会导致指令 401）
   ```bash
   pnpm -F @proj-airi/minecraft-bot start
   ```
   期望：`Connected to AIRI server` + Paper 日志 `airi_bot joined the game`

5. **真人 / 探针同世界**
   - 真人：Java 客户端离线进 `127.0.0.1:25565`
   - 或：`cd services/minecraft && pnpm exec tsx scripts/gate1-probe.mjs`

## 常见故障（2 分钟恢复）

| 症状 | 处理 |
|------|------|
| Bot 连不上服 | Paper 已 `Done`；`BOT_VERSION=1.21.1`；`BOT_AUTH=offline` |
| `Invalid environment configuration` | 检查 `.env.local` 必填项 |
| `Authentication Fails` / 401 | 更换真实 `OPENAI_API_KEY` 后重启 Bot |
| `Cannot find module .../dist/...` | 重新跑 turbo build（见上） |
| AIRI WS 失败 | 确认 `6121`；`AIRI_WS_BASEURL=ws://127.0.0.1:6121/ws` |
| 端口占用 | `lsof -i :25565` / `lsof -i :6121` 后杀旧进程 |
| 回归失败 | **立即回滚到已打 Tag 的验证版本**，不在现场版本上继续调试 |

## 安全

- MCP / Debug / Viewer 保持 `false`
- 测试服勿对公网开放；`online-mode=false` 仅本机演示
- **API Key**：若 key 曾出现在聊天/截图中，到 [智谱开放平台](https://open.bigmodel.cn) **作废并新建**，只写回 `services/minecraft/.env.local`，勿提交、勿贴聊天。Agent 无法代你在控制台轮换。
