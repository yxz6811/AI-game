/**
 * 空闲发育用的物品栏聚合：只认真正的原木 / 菌柄，避免子串误匹配。
 */

/** 物品名称 → 数量（来自 mineflayer inventory 聚合）。 */
export type InventoryCounts = Record<string, number>

/**
 * 是否为可合成木板的原木/菌柄。
 *
 * @param name 物品 id
 */
export function isWoodLogItem(name: string): boolean {
  return name.endsWith('_log') || name.endsWith('_stem')
}

/**
 * 统计可合成木板的原木/菌柄总数。
 *
 * @param counts 物品栏计数
 */
export function countWoodLogs(counts: InventoryCounts): number {
  let total = 0
  for (const [name, count] of Object.entries(counts)) {
    if (isWoodLogItem(name))
      total += count
  }
  return total
}

/**
 * 统计木板数量。
 *
 * @param counts 物品栏计数
 */
export function countPlanks(counts: InventoryCounts): number {
  let total = 0
  for (const [name, count] of Object.entries(counts)) {
    if (name.endsWith('_planks') || name === 'planks')
      total += count
  }
  return total
}

/**
 * 圆石类数量（含深板岩圆石、石头）。
 *
 * @param counts 物品栏计数
 */
export function countCobble(counts: InventoryCounts): number {
  return (counts.cobblestone ?? 0) + (counts.cobbled_deepslate ?? 0) + (counts.stone ?? 0)
}

/**
 * 镐材料等级：diamond=4 iron=3 stone=2 wooden/gold=1 无=0。
 *
 * @param counts 物品栏计数
 */
export function pickaxeTier(counts: InventoryCounts): number {
  if ((counts.diamond_pickaxe ?? 0) > 0)
    return 4
  if ((counts.iron_pickaxe ?? 0) > 0)
    return 3
  if ((counts.stone_pickaxe ?? 0) > 0)
    return 2
  if ((counts.wooden_pickaxe ?? 0) > 0 || (counts.golden_pickaxe ?? 0) > 0)
    return 1
  if (Object.keys(counts).some(name => name.endsWith('_pickaxe') || name === 'pickaxe'))
    return 1
  return 0
}

/**
 * 是否持有任意镐。
 *
 * @param counts 物品栏计数
 */
export function hasAnyPickaxe(counts: InventoryCounts): boolean {
  return pickaxeTier(counts) > 0
}

/**
 * 是否持有任意斧。
 *
 * @param counts 物品栏计数
 */
export function hasAnyAxe(counts: InventoryCounts): boolean {
  return Object.keys(counts).some(name => name.endsWith('_axe') || name === 'axe')
}

/**
 * 是否已有指定材料的一套工具（镐/剑/斧/铲）。
 *
 * @param counts 物品栏计数
 * @param material wooden | stone | iron | diamond
 */
export function hasToolSet(counts: InventoryCounts, material: 'wooden' | 'stone' | 'iron' | 'diamond'): boolean {
  return (counts[`${material}_pickaxe`] ?? 0) > 0
    && (counts[`${material}_sword`] ?? 0) > 0
    && (counts[`${material}_axe`] ?? 0) > 0
    && (counts[`${material}_shovel`] ?? 0) > 0
}

/**
 * 是否已有指定材料的全套盔甲。
 *
 * @param counts 物品栏计数
 * @param material iron | diamond
 */
export function hasArmorSet(counts: InventoryCounts, material: 'iron' | 'diamond'): boolean {
  return (counts[`${material}_helmet`] ?? 0) > 0
    && (counts[`${material}_chestplate`] ?? 0) > 0
    && (counts[`${material}_leggings`] ?? 0) > 0
    && (counts[`${material}_boots`] ?? 0) > 0
}

/**
 * 选出数量最多的原木，并给出对应木板配方。
 *
 * Before:
 * - { birch_log: 1, jungle_log: 3 }
 *
 * After:
 * - { logName: "jungle_log", logCount: 3, planksRecipe: "jungle_planks" }
 *
 * @param counts 物品栏计数
 */
export function pickBestWoodLog(counts: InventoryCounts): {
  logName: string
  logCount: number
  planksRecipe: string
} | null {
  let best: { logName: string, logCount: number } | null = null
  for (const [name, count] of Object.entries(counts)) {
    if (!isWoodLogItem(name) || count <= 0)
      continue
    if (!best || count > best.logCount)
      best = { logName: name, logCount: count }
  }
  if (!best)
    return null

  // stripped_oak_log → oak_planks；warped_stem → warped_planks
  const wood = best.logName
    .replace(/^stripped_/, '')
    .replace(/_log$/, '')
    .replace(/_stem$/, '')
  return {
    logName: best.logName,
    logCount: best.logCount,
    planksRecipe: `${wood}_planks`,
  }
}

/**
 * @deprecated 使用 {@link pickBestWoodLog}
 * @param counts 物品栏计数
 */
export function preferPlanksRecipe(counts: InventoryCounts): string {
  return pickBestWoodLog(counts)?.planksRecipe ?? 'oak_planks'
}
