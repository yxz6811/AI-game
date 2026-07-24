import type { Mineflayer } from '../../libs/mineflayer'

import { ActionError } from '../../utils/errors'

/**
 * 氧气条 ≤ 此值时触发逃生反射（满分 20）。
 * 取 12：大约还剩一半多一点，留出上浮时间。
 */
export const LOW_OXYGEN_ESCAPE = 12

/**
 * 氧气条 ≤ 此值时禁止开新的 dig（略高于逃生阈值，避免挖到一半卡死上浮）。
 */
export const LOW_OXYGEN_ABORT_MINE = 14

/**
 * 是否处于熔岩或溺水风险（供反射 / 挖矿共用）。
 *
 * @param bot mineflayer bot
 * @param oxygenThreshold 溺水判定阈值，默认 {@link LOW_OXYGEN_ESCAPE}
 */
export function isHazardous(bot: {
  entity?: { isInLava?: boolean, isInWater?: boolean } | null
  oxygenLevel?: number
}, oxygenThreshold: number = LOW_OXYGEN_ESCAPE): boolean {
  if (bot.entity?.isInLava)
    return true
  if (!bot.entity?.isInWater)
    return false
  return typeof bot.oxygenLevel === 'number' && bot.oxygenLevel <= oxygenThreshold
}

/**
 * 当前是否应立刻中止挖矿并让路给逃生。
 *
 * @param mineflayer bot 包装
 */
export function shouldAbortMining(mineflayer: Mineflayer): boolean {
  return isHazardous(mineflayer.bot, LOW_OXYGEN_ABORT_MINE)
}

/**
 * 开挖前检查：熔岩 / 水下缺氧则抛 {@link ActionError} `INTERRUPTED`。
 *
 * @param mineflayer bot 包装
 */
export function assertSafeToMine(mineflayer: Mineflayer): void {
  const bot = mineflayer.bot
  if (bot.entity?.isInLava) {
    throw new ActionError('INTERRUPTED', 'In lava — abort mining to escape', {
      hazard: 'lava',
    })
  }
  if (bot.entity?.isInWater && typeof bot.oxygenLevel === 'number' && bot.oxygenLevel <= LOW_OXYGEN_ABORT_MINE) {
    throw new ActionError('INTERRUPTED', 'Low oxygen underwater — abort mining to surface', {
      hazard: 'drown',
      oxygenLevel: bot.oxygenLevel,
      threshold: LOW_OXYGEN_ABORT_MINE,
    })
  }
}

/**
 * 水下且已开始掉氧气时，禁止继续「向下掏洞」搜矿。
 *
 * @param mineflayer bot 包装
 */
export function shouldAvoidDiggingDown(mineflayer: Mineflayer): boolean {
  const bot = mineflayer.bot
  if (bot.entity?.isInWater)
    return true
  if (typeof bot.oxygenLevel === 'number' && bot.oxygenLevel < 20)
    return true
  return false
}
