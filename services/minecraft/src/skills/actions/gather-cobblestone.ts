import type { Mineflayer } from '../../libs/mineflayer'

import { sleep } from '@moeru/std'

import { ActionError } from '../../utils/errors'
import { useLogger } from '../../utils/logger'
import { McData } from '../../utils/mcdata'
import { breakBlockAt } from '../blocks'
import { goToPosition, moveAway } from '../movement'
import { getNearestBlocks } from '../world'
import { assertSafeToMine, shouldAbortMining, shouldAvoidDiggingDown } from './air-safety'
import { pickupNearbyItems } from './world-interactions'

const logger = useLogger()

/** 挖开后能产出圆石/石头类的地表常见岩层 */
const STONE_BLOCK_TYPES = [
  'stone',
  'cobblestone',
  'andesite',
  'diorite',
  'granite',
  'deepslate',
  'tuff',
  'cobbled_deepslate',
] as const

/**
 * 统计库存中的圆石类数量（含深板岩圆石）。
 *
 * @param mineflayer bot
 */
export function getCobbleCount(mineflayer: Mineflayer): number {
  return mineflayer.bot.inventory
    .items()
    .filter(item => item.name === 'cobblestone' || item.name === 'cobbled_deepslate' || item.name === 'stone')
    .reduce((sum, item) => sum + item.count, 0)
}

/**
 * 创造模式下直接塞圆石，保证发育链能推进。
 *
 * NOTICE:
 * Why: 演示服默认 creative，dig 不掉落；只挖石头会永远卡在 gather_cobblestone。
 * Root cause: Paper `gamemode=creative` + mineflayer dig 无掉落。
 * Removal: 演示服改为 survival、或 bot 入服强制 survival 后删除。
 *
 * @param mineflayer bot
 * @param amount 需要补到的总量
 */
async function ensureCobbleInCreative(mineflayer: Mineflayer, amount: number): Promise<void> {
  const have = getCobbleCount(mineflayer)
  if (have >= amount)
    return

  const need = amount - have
  const mcData = McData.fromBot(mineflayer.bot)
  const itemId = mcData.getItemId('cobblestone')
  if (!itemId)
    throw new ActionError('UNKNOWN', 'cobblestone item id missing')

  const Item = (await import('prismarine-item')).default(mineflayer.bot.registry)
  // 热键栏末格塞一堆，够发育演示即可
  await mineflayer.bot.creative.setInventorySlot(44, new Item(itemId, Math.min(need, 64)))
  logger.log(`Creative grant: +${Math.min(need, 64)} cobblestone (had ${have})`)
}

/**
 * 采集石头/圆石直到库存达到目标数量。
 *
 * @param mineflayer bot
 * @param num 目标持有总量
 * @param options.quiet 不向游戏内喊话
 * @param options.maxDistance 搜索半径
 */
export async function gatherCobblestone(
  mineflayer: Mineflayer,
  num: number,
  options?: { quiet?: boolean, maxDistance?: number },
): Promise<boolean> {
  const maxDistance = options?.maxDistance ?? 32
  const quiet = options?.quiet ?? false

  logger.log(`Gathering stone/cobble... need ${num} in inventory.`)
  if (!quiet)
    mineflayer.bot.chat(`去挖石头，目标 ${num} 个圆石。`)

  let count = getCobbleCount(mineflayer)
  if (count >= num) {
    logger.log(`Already have ${count} cobble/stone (>= ${num}).`)
    return true
  }

  const isCreative = mineflayer.bot.game.gameMode === 'creative'
  let idleRounds = 0

  while (count < num) {
    if (shouldAbortMining(mineflayer))
      assertSafeToMine(mineflayer)

    const blocks = getNearestBlocks(mineflayer, [...STONE_BLOCK_TYPES], maxDistance)
    if (blocks.length === 0) {
      logger.log('No stone nearby, moving to search...')
      idleRounds += 1
      if (idleRounds >= 4) {
        if (isCreative) {
          // 附近找不到石头时，创造模式直接补齐，避免卡死演示
          await ensureCobbleInCreative(mineflayer, num)
          return getCobbleCount(mineflayer) >= num
        }
        throw new ActionError('RESOURCE_MISSING', 'No stone/cobble blocks nearby to mine', {
          searched: STONE_BLOCK_TYPES,
          range: maxDistance,
        })
      }
      // 水下或已缺氧时禁止向下掏洞，只水平挪位找矿，避免把自己挖进水里淹死
      if (!shouldAvoidDiggingDown(mineflayer)) {
        const pos = mineflayer.bot.entity.position.floored()
        for (let dy = 1; dy <= 3; dy++) {
          await breakBlockAt(mineflayer, pos.x, pos.y - dy, pos.z).catch(() => undefined)
        }
      }
      await moveAway(mineflayer, 12)
      count = getCobbleCount(mineflayer)
      continue
    }

    idleRounds = 0
    const block = blocks[0]!
    const reached = await goToPosition(
      mineflayer,
      block.position.x,
      block.position.y,
      block.position.z,
      2,
    )
    if (!reached) {
      logger.log('Unable to reach stone block, trying another.')
      continue
    }

    // 一次挖一丛相邻石头
    const vein = getNearestBlocks(mineflayer, [block.name], 4, 4)
    const targets = vein.length > 0 ? vein.slice(0, 6) : [block]
    for (const target of targets) {
      if (getCobbleCount(mineflayer) >= num)
        break
      try {
        if (!isCreative)
          await mineflayer.bot.tool.equipForBlock(target)
        await breakBlockAt(mineflayer, target.position.x, target.position.y, target.position.z)
        await sleep(200)
      }
      catch (err) {
        logger.log(`Failed to break stone: ${err}`)
      }
    }

    await pickupNearbyItems(mineflayer)
    await sleep(400)
    count = getCobbleCount(mineflayer)

    // 创造模式挖完仍无掉落 → 补齐
    if (isCreative && count < num)
      await ensureCobbleInCreative(mineflayer, num)

    count = getCobbleCount(mineflayer)
  }

  logger.log(`Stone gather done. Inventory cobble/stone=${count}.`)
  return true
}
