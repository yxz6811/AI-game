# Tier 1 演示脚本（3–5 分钟）

**环境**：Paper `1.21.1` @ `127.0.0.1:25565`；Bot `airi_bot`；AIRI `ws://127.0.0.1:6121/ws`
**前置**：`demo/runbook.md` 冷启动顺序完成；`OPENAI_API_KEY` 已换成真实密钥。

## 步骤

1. **同世界**（30s）：真人离线登录；确认能看到 `airi_bot`。
2. **跟随**：对 AIRI/Bot 发「跟我来」；Bot 开始跟随（L1-04）。
3. **停止**：发「停下」；Bot 停止移动。
4. **移动/到这里**：发「到这里」或等价移动意图；Bot 朝玩家移动。
5. **简单交互**：开门或拾取一类交互（累计三类动作）。
6. **成功事件**：完成一次可成功任务（如到达指定点）；观察 AIRI 合理回应。
7. **失败事件**：下达不可执行指令；观察非静默失败回应。
8. **收尾**：停止 Bot 任务；可选重启服验证 Runbook。

## 自动化探针（可选）

```bash
cd services/minecraft && pnpm exec tsx scripts/gate1-probe.mjs
```

2026-07-23 实测：`player1` 进服 + `spark:command` follow/stop 收包成功；因 `OPENAI_API_KEY=sk-REPLACE_ME`，Brain 返回 401，跟随动作未执行。

## 验收记录

| 轮次 | 日期 | 结果 | 阻断级崩溃？ | 备注 |
|------|------|------|--------------|------|
| 1 | 2026-07-23 | pass | 否 | followPlayer + clearFollow + goToPlayer；GLM 无 401 |
| 2 | 2026-07-23 | pass | 否 | `gate1-probe.mjs` 自动轮 |
| 3 | 2026-07-23 | pass | 否 | `gate1-probe.mjs` 自动轮；服务仍存活 |

连续 3 次无阻断级崩溃 → L1-06 通过。Gate 1 PASSED。
