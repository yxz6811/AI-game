import type { Mineflayer } from '../../libs/mineflayer'

import { sleep } from '@moeru/std'

import { ActionError } from '../../utils/errors'
import { useLogger } from '../../utils/logger'
import { breakBlockAt } from '../blocks'
import { moveAway } from '../movement'
import { assertSafeToMine, shouldAbortMining, shouldAvoidDiggingDown } from './air-safety'
import { collectBlock } from './collect-block'
import { grantItemInCreative, isCreativeMode } from './creative-grant'

const logger = useLogger()

/**
 * 统计库存中某物品数量。
 *
 * @param mineflayer bot
 * @param itemNames 物品名（任一匹配即计入）
 */
export function getItemCountByNames(mineflayer: Mineflayer, itemNames: string[]): number {
  const set = new Set(itemNames)
  return mineflayer.bot.inventory
    .items()
    .filter(item => set.has(item.name))
    .reduce((sum, item) => sum + item.count, 0)
}

export interface GatherResourceOptions {
  /** collectBlock 搜索类型（会走 alias 扩展） */
  blockType: string
  /** 库存判定用的物品名（挖到后进包的名字） */
  inventoryItems: string[]
  /** 目标持有总量 */
  amount: number
  /** 搜索半径 @default 48 */
  maxDistance?: number
  /** 创造模式找不到时补货用的物品名；默认取 inventoryItems[0] */
  creativeItem?: string
  /** 找不到时最多挪位搜索轮数 @default 4 */
  searchRounds?: number
}

/**
 * 采集资源直到库存达标；创造模式无掉落时补货兜底。
 *
 * @param mineflayer bot
 * @param options 采集目标
 */
export async function gatherResource(
  mineflayer: Mineflayer,
  options: GatherResourceOptions,
): Promise<boolean> {
  const {
    blockType,
    inventoryItems,
    amount,
    maxDistance = 48,
    creativeItem = inventoryItems[0],
    searchRounds = 4,
  } = options

  if (!creativeItem)
    throw new ActionError('UNKNOWN', 'gatherResource requires inventoryItems or creativeItem')

  logger.log(`Gathering ${blockType} → inventory [${inventoryItems.join(',')}] need ${amount}`)

  let have = getItemCountByNames(mineflayer, inventoryItems)
  if (have >= amount)
    return true

  let idleRounds = 0
  while (have < amount) {
    if (shouldAbortMining(mineflayer))
      assertSafeToMine(mineflayer)

    const need = amount - have
    const collected = await collectBlock(mineflayer, blockType, need, maxDistance).catch((err) => {
      if (err instanceof ActionError && err.code === 'INTERRUPTED')
        throw err
      logger.log(`collectBlock(${blockType}) failed: ${err}`)
      return 0
    })

    have = getItemCountByNames(mineflayer, inventoryItems)
    if (have >= amount)
      return true

    if (collected <= 0) {
      idleRounds += 1
      if (idleRounds >= searchRounds) {
        if (isCreativeMode(mineflayer)) {
          await grantItemInCreative(mineflayer, creativeItem, amount)
          return getItemCountByNames(mineflayer, inventoryItems) >= amount
            || getItemCountByNames(mineflayer, [creativeItem]) >= amount
        }
        throw new ActionError('RESOURCE_MISSING', `No ${blockType} nearby to gather`, {
          blockType,
          amount,
          have,
        })
      }

      // 水下禁止向下掏洞搜矿，只水平挪位
      if (!shouldAvoidDiggingDown(mineflayer)) {
        const pos = mineflayer.bot.entity.position.floored()
        for (let dy = 1; dy <= 3; dy++)
          await breakBlockAt(mineflayer, pos.x, pos.y - dy, pos.z).catch(() => undefined)
      }
      await moveAway(mineflayer, 14)
      await sleep(300)
      have = getItemCountByNames(mineflayer, inventoryItems)
      continue
    }

    idleRounds = 0
  }

  return true
}
