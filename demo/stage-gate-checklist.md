# Stage Gate Checklist

## Gate 1（第一层 MUST）

对照 `docs/ai-game/specs/001-ai-game-teammate/spec.md` US1 / FR-048。
**判定日期：2026-07-23 — Gate 1 PASSED**

| ID | 项 | 状态 | 备注 |
|----|----|------|------|
| L1-01 | 冷启动 AIRI + minecraft-bot 可用 | ✅ | GLM `open.bigmodel.cn` + Bot ready |
| L1-02 | 真人与 Bot 同世界 | ✅ | `airi_bot` + `player1` 同进 `demo_world` |
| L1-03 | Bot 状态回传到 AIRI 总线 | ✅ | `context:update` minecraft:status |
| L1-04 | 至少三类动作（跟随/停止/移动） | ✅ | `followPlayer` / `clearFollowTarget` / `goToPlayer`（探针日志） |
| L1-05 | 成功事件 + 失败事件均有合理回应 | ✅ | 成功：「我已经到达玩家1的旁边」；失败：明确说明无法击杀末影龙 |
| L1-06 | 固化脚本连跑 3 次无阻断级崩溃 | ✅ | `gate1-probe.mjs` ×3；MC/AIRI/Bot 全程存活 |
| L1-07 | Runbook 可独立恢复 | ✅ | `demo/runbook.md` / `demo/setup-guide.md` |
| FR-008 | 未引入第二层+范围进第一层主路径 | ✅ | |
| FR-050 | 有回归脚本骨架可跑 | ✅ | `demo/regression.sh` |

**Gate 1 判定：通过。解锁 Phase 4 / Phase 5。**

安全提醒：若智谱 key 曾出现在聊天中，请到开放平台轮换后只写回 `.env.local`。

## Gate 2A / 2B（摘要）

- 2A：真全双工 + Intent Bridge
- 2B：Game Adapter + DST（Phase 5）
