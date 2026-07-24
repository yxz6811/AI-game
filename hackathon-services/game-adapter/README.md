# game-adapter（Phase 5 / US3）

统一 Game Adapter 契约与 Minecraft / DST 实现。

## 契约

见 `src/contract/`：

- `types.ts` — `GameAdapter`（observe / act / events / capabilities / health）
- `game-state.ts` — `GameState`（G2-01）
- `actions.ts` — `ActionRequest` / `ActionResult`（G2-02）

对齐：`docs/ai-game/specs/001-ai-game-teammate/contracts/game-adapter-contract.md`

## Minecraft Adapter（T054–T057）

`src/minecraft-adapter/` 是对 `services/minecraft` 的 **薄包装**：

| 高层动作 | 映射到既有工具 |
|---------|----------------|
| `follow` | `followPlayer` |
| `move` | `goToPlayer` 或 `goToCoordinate`（`x,y,z`） |
| `collect` | `collectBlocks` |
| `interact` | `activate` |
| `stop` | `clearFollowTarget` → `stop` |
| `say` | `chat` |

不修改 `action-registry.ts` / `task-executor.ts`；由集成方注入 runner：

```ts
import { createMinecraftAdapter } from '@hackathon/game-adapter/minecraft-adapter'

const adapter = createMinecraftAdapter({
  runner: {
    // 包装既有 ActionRegistry / TaskExecutor
    performAction: step => actionRegistry.performAction(step),
  },
  readSnapshot: () => ({
    connected: true,
    latency_ms: bot.player?.ping ?? 0,
    game_state: projectGameState(bot),
  }),
  eventSource: {
    subscribe: (listener) => {
      // 订阅 Perception onRawEvent，再 listener(raw)
      return () => { /* unsubscribe */ }
    },
  },
})
```

## 状态

- ✅ T051–T053 契约类型
- ✅ T054–T057 Minecraft Adapter（DI 包装 + observe/events/capabilities/health）
- ⬜ T058 第一层回归确认
- ⬜ T059+ DST Bridge / Adapter

## 命令

```bash
cd hackathon-services/game-adapter
pnpm typecheck
pnpm test
```
