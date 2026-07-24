import type { InventoryCounts } from './inventory'

import {
  countCobble,
  countPlanks,
  countWoodLogs,
  hasAnyAxe,
  hasToolSet,
  pickaxeTier,
  pickBestWoodLog,
} from './inventory'

/**
 * 空闲发育目标种类。
 * - gather_wood：调用 gatherWood
 * - collect：采集资源（圆石/煤/铁/钻石等）
 * - craft：合成
 * - smelt：熔炉冶炼
 */
export type DevelopGoalKind = 'gather_wood' | 'collect' | 'craft' | 'smelt'

/** 发育目标 id（覆盖木→石→煤/火把→铁→钻石）。 */
export type DevelopGoalId
  = | 'gather_wood'
    | 'craft_planks'
    | 'craft_sticks'
    | 'craft_crafting_table'
    | 'craft_wooden_pickaxe'
    | 'craft_wooden_axe'
    | 'gather_cobblestone'
    | 'craft_stone_pickaxe'
    | 'craft_stone_sword'
    | 'craft_stone_axe'
    | 'craft_stone_shovel'
    | 'craft_furnace'
    | 'gather_coal'
    | 'craft_torch'
    | 'gather_iron'
    | 'smelt_raw_iron'
    | 'craft_iron_pickaxe'
    | 'craft_iron_sword'
    | 'craft_iron_axe'
    | 'craft_iron_shovel'
    | 'craft_iron_helmet'
    | 'craft_iron_chestplate'
    | 'craft_iron_leggings'
    | 'craft_iron_boots'
    | 'gather_diamond'
    | 'craft_diamond_pickaxe'
    | 'craft_diamond_sword'
    | 'craft_diamond_axe'
    | 'craft_diamond_shovel'
    | 'craft_diamond_helmet'
    | 'craft_diamond_chestplate'
    | 'craft_diamond_leggings'
    | 'craft_diamond_boots'

/**
 * 一条可执行的发育目标。
 */
export interface DevelopGoal {
  id: DevelopGoalId
  /** 游戏内简短播报文案 */
  label: string
  kind: DevelopGoalKind
  /** collect / craft / smelt 的物品名 */
  item?: string
  /** 采集总量 / 合成次数 / 冶炼次数 */
  count: number
}

/** 石镐：3 圆石；石剑/斧/铲+熔炉：2+3+1+8=14 → 合计 17 */
export const COBBLE_FOR_STONE_PICK = 3
export const COBBLE_FOR_STONE_KIT = 14
export const COBBLE_TOTAL_FOR_STONE_LINE = COBBLE_FOR_STONE_PICK + COBBLE_FOR_STONE_KIT

/**
 * 煤目标：8 做火把（→32 火把）+ 约 5 炼 33 铁 + 余量。
 */
export const COAL_TARGET = 20
/** 火把合成次数（每次 4 个） */
export const TORCH_CRAFTS = 8
/**
 * 铁锭：盔甲 24 + 镐剑斧铲 9 = 33。
 */
export const IRON_INGOT_TARGET = 33
/** 钻石同铁装材料量 */
export const DIAMOND_TARGET = 33
/** 单次冶炼批量，避免一次卡太久 */
export const SMELT_BATCH = 8

interface CraftSpec { id: DevelopGoalId, label: string, item: string, cobble?: number, sticks?: number, iron?: number, diamond?: number }

const STONE_LINE: CraftSpec[] = [
  { id: 'craft_stone_pickaxe', label: '合成石镐', item: 'stone_pickaxe', cobble: 3, sticks: 2 },
  { id: 'craft_stone_sword', label: '合成石剑', item: 'stone_sword', cobble: 2, sticks: 1 },
  { id: 'craft_stone_axe', label: '合成石斧', item: 'stone_axe', cobble: 3, sticks: 2 },
  { id: 'craft_stone_shovel', label: '合成石铲', item: 'stone_shovel', cobble: 1, sticks: 2 },
  { id: 'craft_furnace', label: '合成熔炉', item: 'furnace', cobble: 8 },
]

const IRON_TOOLS: CraftSpec[] = [
  { id: 'craft_iron_pickaxe', label: '合成铁镐', item: 'iron_pickaxe', iron: 3, sticks: 2 },
  { id: 'craft_iron_sword', label: '合成铁剑', item: 'iron_sword', iron: 2, sticks: 1 },
  { id: 'craft_iron_axe', label: '合成铁斧', item: 'iron_axe', iron: 3, sticks: 2 },
  { id: 'craft_iron_shovel', label: '合成铁铲', item: 'iron_shovel', iron: 1, sticks: 2 },
]

const IRON_ARMOR: CraftSpec[] = [
  { id: 'craft_iron_helmet', label: '合成铁头盔', item: 'iron_helmet', iron: 5 },
  { id: 'craft_iron_chestplate', label: '合成铁胸甲', item: 'iron_chestplate', iron: 8 },
  { id: 'craft_iron_leggings', label: '合成铁护腿', item: 'iron_leggings', iron: 7 },
  { id: 'craft_iron_boots', label: '合成铁靴子', item: 'iron_boots', iron: 4 },
]

const DIAMOND_TOOLS: CraftSpec[] = [
  { id: 'craft_diamond_pickaxe', label: '合成钻石镐', item: 'diamond_pickaxe', diamond: 3, sticks: 2 },
  { id: 'craft_diamond_sword', label: '合成钻石剑', item: 'diamond_sword', diamond: 2, sticks: 1 },
  { id: 'craft_diamond_axe', label: '合成钻石斧', item: 'diamond_axe', diamond: 3, sticks: 2 },
  { id: 'craft_diamond_shovel', label: '合成钻石铲', item: 'diamond_shovel', diamond: 1, sticks: 2 },
]

const DIAMOND_ARMOR: CraftSpec[] = [
  { id: 'craft_diamond_helmet', label: '合成钻石头盔', item: 'diamond_helmet', diamond: 5 },
  { id: 'craft_diamond_chestplate', label: '合成钻石胸甲', item: 'diamond_chestplate', diamond: 8 },
  { id: 'craft_diamond_leggings', label: '合成钻石护腿', item: 'diamond_leggings', diamond: 7 },
  { id: 'craft_diamond_boots', label: '合成钻石靴子', item: 'diamond_boots', diamond: 4 },
]

/**
 * 若缺棍且有木板，先补棍；否则返回 null 让上层去砍树/做板。
 *
 * @param counts 物品栏
 * @param need 需要棍数
 */
function ensureSticksGoal(counts: InventoryCounts, need: number): DevelopGoal | null {
  const sticks = counts.stick ?? 0
  if (sticks >= need)
    return null
  const planks = countPlanks(counts)
  if (planks >= 2) {
    return {
      id: 'craft_sticks',
      label: '补点木棍',
      kind: 'craft',
      item: 'stick',
      count: 1,
    }
  }
  const bestWood = pickBestWoodLog(counts)
  if (bestWood) {
    return {
      id: 'craft_planks',
      label: '补点木板做木棍',
      kind: 'craft',
      item: bestWood.planksRecipe,
      count: Math.min(1, bestWood.logCount),
    }
  }
  return {
    id: 'gather_wood',
    label: '缺木棍，先砍点木头',
    kind: 'gather_wood',
    count: Math.max(4, countWoodLogs(counts) + 2),
  }
}

/**
 * 推进一条合成队列：缺材料则采集/补棍，够了就合成下一项。
 *
 * @param counts 物品栏
 * @param line 合成规格列表
 * @param materialKey cobble | iron | diamond
 * @param materialCount 当前材料数
 * @param gather 材料不足时的采集目标
 */
function nextFromCraftLine(
  counts: InventoryCounts,
  line: CraftSpec[],
  materialKey: 'cobble' | 'iron' | 'diamond',
  materialCount: number,
  gather: DevelopGoal,
): DevelopGoal | null {
  for (const spec of line) {
    if ((counts[spec.item] ?? 0) > 0)
      continue

    const needMat = materialKey === 'cobble'
      ? (spec.cobble ?? 0)
      : materialKey === 'iron'
        ? (spec.iron ?? 0)
        : (spec.diamond ?? 0)

    if (materialCount < needMat)
      return { ...gather, count: Math.max(gather.count, materialCount + needMat) }

    if (spec.sticks) {
      const stickGoal = ensureSticksGoal(counts, spec.sticks)
      if (stickGoal)
        return stickGoal
    }

    return {
      id: spec.id,
      label: spec.label,
      kind: 'craft',
      item: spec.item,
      count: 1,
    }
  }
  return null
}

/**
 * 为剩余石线物品合计还缺多少圆石（石镐 3 + 其余最多 14）。
 *
 * @param counts 物品栏
 */
export function cobbleStillNeededForStoneLine(counts: InventoryCounts): number {
  let need = 0
  for (const spec of STONE_LINE) {
    if ((counts[spec.item] ?? 0) > 0)
      continue
    need += spec.cobble ?? 0
  }
  return need
}

/**
 * 生存发育优先级：木 → 石镐(3石) → 石套+熔炉(+14石) → 煤/火把 → 铁全套 → 钻石全套。
 * 纯函数，便于单测；不依赖 bot 实例。
 *
 * @param counts 当前物品栏计数
 * @returns 下一个应执行的目标；全链路完成则 null
 */
export function selectNextDevelopGoal(counts: InventoryCounts): DevelopGoal | null {
  const logs = countWoodLogs(counts)
  const planks = countPlanks(counts)
  const sticks = counts.stick ?? 0
  const craftingTable = counts.crafting_table ?? 0
  const cobble = countCobble(counts)
  const tier = pickaxeTier(counts)
  const bestWood = pickBestWoodLog(counts)
  const coal = (counts.coal ?? 0) + (counts.charcoal ?? 0)
  const torches = counts.torch ?? 0
  const rawIron = counts.raw_iron ?? 0
  const iron = counts.iron_ingot ?? 0
  const diamonds = counts.diamond ?? 0

  // ── 木器线 ──
  if (logs < 3 && planks < 8 && tier < 1)
    return { id: 'gather_wood', label: '去砍点木头', kind: 'gather_wood', count: 4 }

  if (bestWood && planks < 8 && tier < 1) {
    return {
      id: 'craft_planks',
      label: '合成木板',
      kind: 'craft',
      item: bestWood.planksRecipe,
      count: Math.min(1, bestWood.logCount),
    }
  }

  if (planks >= 2 && sticks < 4 && tier < 1) {
    return { id: 'craft_sticks', label: '合成木棍', kind: 'craft', item: 'stick', count: 1 }
  }

  if (planks >= 4 && craftingTable < 1 && tier < 1) {
    return {
      id: 'craft_crafting_table',
      label: '合成工作台',
      kind: 'craft',
      item: 'crafting_table',
      count: 1,
    }
  }

  if (tier < 1 && planks >= 3 && sticks >= 2) {
    return {
      id: 'craft_wooden_pickaxe',
      label: '合成木镐',
      kind: 'craft',
      item: 'wooden_pickaxe',
      count: 1,
    }
  }

  // 木镐后、石镐前：补木斧；进入石线后不再回头
  if (tier === 1 && !hasAnyAxe(counts) && planks >= 3 && sticks >= 2) {
    return {
      id: 'craft_wooden_axe',
      label: '合成木斧',
      kind: 'craft',
      item: 'wooden_axe',
      count: 1,
    }
  }

  // ── 石线：先 3 石做石镐，再 +14 做剑斧铲熔炉 ──
  if (tier < 2) {
    const needForPick = COBBLE_FOR_STONE_PICK
    if (cobble < needForPick) {
      return {
        id: 'gather_cobblestone',
        label: '挖 3 个石头做石镐',
        kind: 'collect',
        item: 'stone',
        count: needForPick,
      }
    }
    const stickGoal = ensureSticksGoal(counts, 2)
    if (stickGoal && !(counts.stone_pickaxe ?? 0))
      return stickGoal
    if (!(counts.stone_pickaxe ?? 0)) {
      return {
        id: 'craft_stone_pickaxe',
        label: '合成石镐',
        kind: 'craft',
        item: 'stone_pickaxe',
        count: 1,
      }
    }
  }

  // 石镐已有：推进剑/斧/铲/熔炉
  if (tier >= 2 && ((counts.furnace ?? 0) < 1 || !hasToolSet(counts, 'stone'))) {
    const stillNeed = cobbleStillNeededForStoneLine(counts)
    if (stillNeed > 0 && cobble < stillNeed) {
      return {
        id: 'gather_cobblestone',
        label: '再挖点石头做石套和熔炉',
        kind: 'collect',
        item: 'stone',
        count: stillNeed,
      }
    }
    const stoneGoal = nextFromCraftLine(
      counts,
      STONE_LINE,
      'cobble',
      cobble,
      {
        id: 'gather_cobblestone',
        label: '再挖点石头',
        kind: 'collect',
        item: 'stone',
        count: stillNeed || COBBLE_FOR_STONE_KIT,
      },
    )
    if (stoneGoal)
      return stoneGoal
  }

  // ── 煤 + 火把 ──
  if (coal < COAL_TARGET) {
    return {
      id: 'gather_coal',
      label: `去挖煤（目标 ${COAL_TARGET}）`,
      kind: 'collect',
      item: 'coal',
      count: COAL_TARGET,
    }
  }

  if (torches < TORCH_CRAFTS * 4) {
    const stickGoal = ensureSticksGoal(counts, 1)
    if (stickGoal)
      return stickGoal
    return {
      id: 'craft_torch',
      label: '做点火把',
      kind: 'craft',
      item: 'torch',
      count: 1,
    }
  }

  // ── 铁：挖矿 → 冶炼 → 工具 → 盔甲 ──
  const ironNeededForRemaining = (() => {
    let need = 0
    for (const spec of [...IRON_TOOLS, ...IRON_ARMOR]) {
      if ((counts[spec.item] ?? 0) > 0)
        continue
      need += spec.iron ?? 0
    }
    return need
  })()

  if (ironNeededForRemaining > 0) {
    const ironHave = iron
    const rawHave = rawIron
    if (ironHave < ironNeededForRemaining) {
      const stillNeedIngots = ironNeededForRemaining - ironHave
      // 有原铁就先炼一批，边挖边炼；没有才去挖
      if (rawHave > 0) {
        return {
          id: 'smelt_raw_iron',
          label: '用熔炉炼铁',
          kind: 'smelt',
          item: 'raw_iron',
          count: Math.min(SMELT_BATCH, rawHave, stillNeedIngots),
        }
      }
      return {
        id: 'gather_iron',
        label: '下矿挖铁',
        kind: 'collect',
        item: 'iron',
        count: stillNeedIngots,
      }
    }

    const ironToolGoal = nextFromCraftLine(
      counts,
      IRON_TOOLS,
      'iron',
      iron,
      { id: 'gather_iron', label: '铁不够，再挖点', kind: 'collect', item: 'iron', count: IRON_INGOT_TARGET },
    )
    if (ironToolGoal)
      return ironToolGoal

    const ironArmorGoal = nextFromCraftLine(
      counts,
      IRON_ARMOR,
      'iron',
      iron,
      { id: 'gather_iron', label: '铁不够，再挖点', kind: 'collect', item: 'iron', count: IRON_INGOT_TARGET },
    )
    if (ironArmorGoal)
      return ironArmorGoal
  }

  // ── 钻石：需铁镐；挖钻 → 全套 ──
  if (tier < 3) {
    // 铁镐应已在上面做出；若材料异常卡住，回退挖/炼铁
    if (iron < 3 && rawIron > 0) {
      return {
        id: 'smelt_raw_iron',
        label: '炼铁做铁镐',
        kind: 'smelt',
        item: 'raw_iron',
        count: Math.min(SMELT_BATCH, rawIron, 3),
      }
    }
    if (iron >= 3) {
      const stickGoal = ensureSticksGoal(counts, 2)
      if (stickGoal)
        return stickGoal
      return {
        id: 'craft_iron_pickaxe',
        label: '合成铁镐（挖钻用）',
        kind: 'craft',
        item: 'iron_pickaxe',
        count: 1,
      }
    }
  }

  const diamondNeededForRemaining = (() => {
    let need = 0
    for (const spec of [...DIAMOND_TOOLS, ...DIAMOND_ARMOR]) {
      if ((counts[spec.item] ?? 0) > 0)
        continue
      need += spec.diamond ?? 0
    }
    return need
  })()

  if (diamondNeededForRemaining > 0) {
    if (diamonds < diamondNeededForRemaining) {
      return {
        id: 'gather_diamond',
        label: '去挖钻石',
        kind: 'collect',
        item: 'diamond',
        count: diamondNeededForRemaining,
      }
    }

    const diamondToolGoal = nextFromCraftLine(
      counts,
      DIAMOND_TOOLS,
      'diamond',
      diamonds,
      { id: 'gather_diamond', label: '钻石不够，再挖点', kind: 'collect', item: 'diamond', count: DIAMOND_TARGET },
    )
    if (diamondToolGoal)
      return diamondToolGoal

    const diamondArmorGoal = nextFromCraftLine(
      counts,
      DIAMOND_ARMOR,
      'diamond',
      diamonds,
      { id: 'gather_diamond', label: '钻石不够，再挖点', kind: 'collect', item: 'diamond', count: DIAMOND_TARGET },
    )
    if (diamondArmorGoal)
      return diamondArmorGoal
  }

  return null
}
