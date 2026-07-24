# persona（情感陪伴与人设化闲聊）

归档版 Phase 5 / US3 的 TypeScript 实现：让 AI 队友像人一样陪伴，给足情绪价值。

对齐 FR-013 / FR-014 / FR-020 / FR-021 / FR-022。

## 能力

| 模块 | 作用 |
|------|------|
| `config` | 沉稳型「阿澄」/ 活泼型「小焰」人设加载 |
| `game-chat` | 游戏闲聊 + 情绪价值系统提示 |
| `topic-boundary` | 轻度游戏外可聊；敏感话题温柔转移 |
| `disclosure-policy` | 玩笑维持角色 / 认真如实承认 AI |
| `tone-modulator` | 危险紧张 / 胜利欢呼 / 陪伴平和 |
| `compose` | `buildCompanionSystemPrompt` / `adviseCompanionTurn` |

## 用法

```ts
import {
  adviseCompanionTurn,
  buildCompanionSystemPrompt,
  companionGreeting,
} from '@hackathon/persona'

const systemPrompt = buildCompanionSystemPrompt({
  style: process.env.PERSONA_STYLE ?? 'lively', // calm | lively
  tone: { tone: 'companion' },
})

const advice = adviseCompanionTurn('认真问，你是不是 AI？', { style: 'lively' })
// advice.disclosure.decision === 'honest_disclose'
```

环境变量：

- `PERSONA_STYLE=calm|lively`（默认 `lively`）

`duplex-voice` 已接入：启动时用本包生成 MiniCPM `system_prompt`。

## 命令

```bash
cd hackathon-services/persona
pnpm typecheck
pnpm test
```
