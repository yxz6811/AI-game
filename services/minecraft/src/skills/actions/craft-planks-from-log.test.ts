import { describe, expect, it } from 'vitest'

import { planksNameFromLog } from './craft-planks-from-log'

describe('planksNameFromLog', () => {
  it('maps stripped and normal logs to planks', () => {
    expect(planksNameFromLog('stripped_jungle_log')).toBe('jungle_planks')
    expect(planksNameFromLog('oak_log')).toBe('oak_planks')
    expect(planksNameFromLog('warped_stem')).toBe('warped_planks')
  })
})
