import { describe, expect, it } from 'vitest'

import {
  deathVendettaLine,
  isRepeatedPlayerAggression,
  KILL_ATTRIBUTION_MS,
  PLAYER_HIT_THRESHOLD,
  PLAYER_HIT_WINDOW_MS,
  recordPlayerHit,
  resolveKillVendetta,
  respawnVendettaLine,
} from './player-aggression'

describe('player-aggression', () => {
  // ROOT CAUSE:
  //
  // 发育开启时玩家连打 bot → 大脑 prompt 禁止还手主人 → Gave up → 发育继续 → 再挨打，形成死循环。
  // 窗内连击达到阈值后应判定为反复攻击，供 IdleDevelopLoop 打断发育并反击。
  it('trips after enough hits inside the window', () => {
    let hits: number[] = []
    const t0 = 1_000_000
    hits = recordPlayerHit(hits, t0)
    expect(isRepeatedPlayerAggression(hits)).toBe(false)
    hits = recordPlayerHit(hits, t0 + 1_000)
    expect(isRepeatedPlayerAggression(hits)).toBe(false)
    hits = recordPlayerHit(hits, t0 + 2_000)
    expect(hits).toHaveLength(PLAYER_HIT_THRESHOLD)
    expect(isRepeatedPlayerAggression(hits)).toBe(true)
  })

  it('forgets hits that fall outside the window', () => {
    let hits: number[] = []
    const t0 = 1_000_000
    hits = recordPlayerHit(hits, t0)
    hits = recordPlayerHit(hits, t0 + 500)
    hits = recordPlayerHit(hits, t0 + PLAYER_HIT_WINDOW_MS + 2_000)
    expect(hits).toHaveLength(1)
    expect(hits[0]).toBe(t0 + PLAYER_HIT_WINDOW_MS + 2_000)
    expect(isRepeatedPlayerAggression(hits)).toBe(false)
  })

  // ROOT CAUSE:
  //
  // 被玩家打死后若清空仇恨，重生只会继续发育/聊天拒战，形成「打死 → 清零 → 再打」循环。
  // 死亡归因窗口内必须能解析出仇杀目标。
  it('attributes kill vendetta to a recent player attacker', () => {
    const now = 2_000_000
    expect(resolveKillVendetta({ username: 'Steve', at: now - 1000 }, now)).toEqual({
      username: 'Steve',
      reason: 'killed',
      at: now,
    })
    expect(resolveKillVendetta({ username: 'Steve', at: now - KILL_ATTRIBUTION_MS - 1 }, now)).toBeNull()
    expect(resolveKillVendetta(null, now)).toBeNull()
  })

  it('builds death and respawn lines naming the killer', () => {
    expect(deathVendettaLine('Steve')).toContain('Steve')
    expect(deathVendettaLine('Steve')).toContain('弄死')
    expect(respawnVendettaLine('Steve', 'killed')).toContain('回来')
    expect(respawnVendettaLine('Steve', 'aggression')).toContain('看招')
  })
})
