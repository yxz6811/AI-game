import { describe, expect, it } from 'vitest'

import { ActionError } from '../../utils/errors'
import {
  assertSafeToMine,
  isHazardous,
  LOW_OXYGEN_ABORT_MINE,
  LOW_OXYGEN_ESCAPE,
  shouldAbortMining,
  shouldAvoidDiggingDown,
} from './air-safety'

function fakeMineflayer(bot: Record<string, unknown>) {
  return { bot } as any
}

describe('air-safety', () => {
  it('treats lava as hazardous immediately', () => {
    expect(isHazardous({ entity: { isInLava: true, isInWater: false }, oxygenLevel: 20 })).toBe(true)
  })

  it('only treats underwater as drowning below oxygen threshold', () => {
    expect(isHazardous({
      entity: { isInLava: false, isInWater: true },
      oxygenLevel: LOW_OXYGEN_ESCAPE + 1,
    })).toBe(false)
    expect(isHazardous({
      entity: { isInLava: false, isInWater: true },
      oxygenLevel: LOW_OXYGEN_ESCAPE,
    })).toBe(true)
  })

  // ROOT CAUSE:
  //
  // 挖矿循环（尤其向下搜石头）不检查氧气；逃生反射阈值过低且不 stopDigging，
  // dig 占着身体导致无法上浮，最后淹死。
  //
  // 挖矿在氧气 ≤ ABORT_MINE 时必须主动中断，把身体还给 escape-hazard。
  it('aborts mining underwater before oxygen reaches the escape threshold', () => {
    const mf = fakeMineflayer({
      entity: { isInLava: false, isInWater: true },
      oxygenLevel: LOW_OXYGEN_ABORT_MINE,
    })
    expect(shouldAbortMining(mf)).toBe(true)
    expect(() => assertSafeToMine(mf)).toThrow(ActionError)
    try {
      assertSafeToMine(mf)
    }
    catch (err) {
      expect(err).toMatchObject({ code: 'INTERRUPTED' })
    }
  })

  it('allows mining in air with full oxygen', () => {
    const mf = fakeMineflayer({
      entity: { isInLava: false, isInWater: false },
      oxygenLevel: 20,
    })
    expect(shouldAbortMining(mf)).toBe(false)
    expect(() => assertSafeToMine(mf)).not.toThrow()
  })

  it('avoids dig-down search while in water or already losing air', () => {
    expect(shouldAvoidDiggingDown(fakeMineflayer({
      entity: { isInWater: true },
      oxygenLevel: 20,
    }))).toBe(true)
    expect(shouldAvoidDiggingDown(fakeMineflayer({
      entity: { isInWater: false },
      oxygenLevel: 19,
    }))).toBe(true)
    expect(shouldAvoidDiggingDown(fakeMineflayer({
      entity: { isInWater: false },
      oxygenLevel: 20,
    }))).toBe(false)
  })
})
