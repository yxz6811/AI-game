import type { Mineflayer } from '../../libs/mineflayer'

import { sleep } from '@moeru/std'

import { useLogger } from '../../utils/logger'
import { breakBlockAt } from '../blocks'
import { goToPosition, moveAway } from '../movement'
import { getNearestBlocks } from '../world'
import { pickupNearbyItems } from './world-interactions'

const logger = useLogger()

/**
 * Gather wood blocks nearby to collect logs.
 *
 * @param mineflayer The mineflayer instance.
 * @param num The number of wood logs to gather（目标持有总量，不是增量）.
 * @param maxDistance The maximum distance to search for wood blocks.
 * @param options.quiet 为 true 时不向游戏内 chat 播报（空闲发育循环自管播报）.
 * @returns Whether the wood gathering was successful.
 */
export async function gatherWood(
  mineflayer: Mineflayer,
  num: number,
  maxDistance = 64,
  options?: { quiet?: boolean },
): Promise<boolean> {
  logger.log(`Gathering wood... I need to collect ${num} logs.`)
  if (!options?.quiet)
    mineflayer.bot.chat(`Gathering wood... I need to collect ${num} logs.`)

  try {
    let logsCount = getLogsCount(mineflayer)
    logger.log(`I currently have ${logsCount} logs.`)

    // 已达目标则直接返回，避免空喊「去砍树」却原地不动
    if (logsCount >= num) {
      logger.log(`Already have ${logsCount} logs (>= ${num}), skip gathering.`)
      return true
    }

    let idleRounds = 0
    while (logsCount < num) {
      // Gather 1 extra log to account for any failures
      logger.log(`Looking for wood blocks nearby...`, logsCount, num)

      const woodBlock = mineflayer.bot.findBlock({
        matching: block => block.name.includes('log') || block.name.endsWith('_stem'),
        maxDistance,
      })

      if (!woodBlock) {
        logger.log('No wood blocks found nearby.')
        idleRounds += 1
        if (idleRounds >= 3) {
          logger.log('Giving up wood gather: no reachable logs after several searches.')
          return logsCount > 0
        }
        await moveAway(mineflayer, 50)
        continue
      }

      idleRounds = 0

      const destinationReached = await goToPosition(
        mineflayer,
        woodBlock.position.x,
        woodBlock.position.y,
        woodBlock.position.z,
        2,
      )

      if (!destinationReached) {
        logger.log('Unable to reach the wood block.')
        continue // Try finding another wood block
      }

      const aTree = await getNearestBlocks(mineflayer, woodBlock.name, 4, 4)
      if (aTree.length === 0) {
        logger.log('No wood blocks found nearby.')
        await moveAway(mineflayer, 15)
        continue
      }

      try {
        for (const aLog of aTree) {
          await breakBlockAt(mineflayer, aLog.position.x, aLog.position.y, aLog.position.z)
          await sleep(1200) // Simulate gathering delay
        }
        await pickupNearbyItems(mineflayer)
        await sleep(2500)
        logsCount = getLogsCount(mineflayer)
        logger.log(`Collected logs. Total logs now: ${logsCount}.`)
      }
      catch (digError) {
        console.error('Failed to break the wood block:', digError)
        continue // Attempt to find and break another wood block
      }
    }

    logger.log(`Wood gathering complete! Total logs collected: ${logsCount}.`)
    return true
  }
  catch (error) {
    console.error('Failed to gather wood:', error)
    return false
  }
}

/**
 * Helper function to count the number of logs in the inventory.
 * @returns The total number of logs.
 */
export function getLogsCount(mineflayer: Mineflayer): number {
  return mineflayer.bot.inventory
    .items()
    .filter(item => item.name.endsWith('_log') || item.name.endsWith('_stem'))
    .reduce((acc, item) => acc + item.count, 0)
}
