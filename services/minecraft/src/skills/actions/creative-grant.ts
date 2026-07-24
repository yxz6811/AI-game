import type { Mineflayer } from '../../libs/mineflayer'

import { ActionError } from '../../utils/errors'
import { useLogger } from '../../utils/logger'
import { McData } from '../../utils/mcdata'

const logger = useLogger()

/**
 * 创造模式下向热键栏末格补货，直到该物品数量达到目标。
 *
 * NOTICE:
 * Why: 演示服默认 creative，dig 不掉落，发育链会卡在采集目标。
 * Root cause: Paper `gamemode=creative` + mineflayer dig 无掉落。
 * Removal: 演示服改为 survival、或 bot 入服强制 survival 后删除。
 *
 * @param mineflayer bot
 * @param itemName 物品 id（如 cobblestone / raw_iron）
 * @param amount 目标持有总量
 */
export async function grantItemInCreative(
  mineflayer: Mineflayer,
  itemName: string,
  amount: number,
): Promise<void> {
  if (mineflayer.bot.game.gameMode !== 'creative')
    return

  const have = mineflayer.bot.inventory
    .items()
    .filter(item => item.name === itemName)
    .reduce((sum, item) => sum + item.count, 0)
  if (have >= amount)
    return

  const need = amount - have
  const mcData = McData.fromBot(mineflayer.bot)
  const itemId = mcData.getItemId(itemName)
  if (!itemId)
    throw new ActionError('UNKNOWN', `${itemName} item id missing`)

  const Item = (await import('prismarine-item')).default(mineflayer.bot.registry)
  const grant = Math.min(need, 64)
  await mineflayer.bot.creative.setInventorySlot(44, new Item(itemId, grant))
  logger.log(`Creative grant: +${grant} ${itemName} (had ${have}, target ${amount})`)
}

/**
 * 当前是否为创造模式。
 *
 * @param mineflayer bot
 */
export function isCreativeMode(mineflayer: Mineflayer): boolean {
  return mineflayer.bot.game.gameMode === 'creative'
}
