import type { Mineflayer } from '../../libs/mineflayer'

import { ActionError } from '../../utils/errors'
import { useLogger } from '../../utils/logger'
import { McData } from '../../utils/mcdata'

const logger = useLogger()

/**
 * 从原木/去皮原木/菌柄名得到对应木板名。
 *
 * @param logName 如 stripped_jungle_log / oak_log / warped_stem
 */
export function planksNameFromLog(logName: string): string {
  const wood = logName
    .replace(/^stripped_/, '')
    .replace(/_log$/, '')
    .replace(/_stem$/, '')
  return `${wood}_planks`
}

/**
 * 用库存中的指定原木合成木板。
 *
 * NOTICE:
 * Why: minecraft-data 里 planks 配方只列普通 `*_log` id，不含 `stripped_*_log`；
 * 服务端实际用 item tag，去皮原木也能合成。recipesFor 对去皮原木会返回空，
 * 再走 planRecipe 就会报「missing jungle_log」并卡死空闲发育。
 * Source: minecraft-data 1.21.1 recipes[jungle_planks] ingredients=[jungle_log] only.
 * Removal: 当 prismarine/mineflayer 正确展开 log tags 后可删 fallback 分支。
 *
 * @param mineflayer bot 封装
 * @param logName 库存中的原木物品名
 * @param times 合成次数（每次消耗 1 原木，产出 4 木板）
 */
export async function craftPlanksFromLog(
  mineflayer: Mineflayer,
  logName: string,
  times = 1,
): Promise<void> {
  const bot = mineflayer.bot
  const planksName = planksNameFromLog(logName)
  const mcData = McData.fromBot(bot)
  const planksId = mcData.getItemId(planksName)
  const logId = mcData.getItemId(logName)

  if (!planksId || !logId) {
    throw new ActionError('UNKNOWN', `Cannot resolve craft ${logName} → ${planksName}`, {
      logName,
      planksName,
    })
  }

  const have = bot.inventory.items()
    .filter(item => item.name === logName)
    .reduce((sum, item) => sum + item.count, 0)

  if (have < times) {
    throw new ActionError('RESOURCE_MISSING', `Need ${times}x ${logName}, have ${have}`, {
      logName,
      need: times,
      have,
    })
  }

  const ready = bot.recipesFor(planksId, null, 1, null)
  if (ready.length > 0) {
    logger.log(`Crafting ${times}x ${planksName} via recipesFor (${logName})`)
    await bot.craft(ready[0], times)
    return
  }

  // Fallback: 手写 shapeless 配方，让 bot.craft 吃去皮原木
  const recipeFactory = await import('prismarine-recipe')
  const factory = (recipeFactory as { default?: (registry: unknown) => { Recipe: new (spec: object) => unknown } }).default
    ?? recipeFactory as unknown as (registry: unknown) => { Recipe: new (spec: object) => unknown }
  const { Recipe } = factory(bot.registry)
  const recipe = new Recipe({
    result: { id: planksId, count: 4 },
    ingredients: [{ id: logId, count: 1 }],
  })

  logger.log(`Crafting ${times}x ${planksName} via stripped-log fallback (${logName})`)
  await bot.craft(recipe as Parameters<typeof bot.craft>[0], times)
}
