import { describe, expect, it } from 'vitest'

import { pickBestWoodLog } from './inventory'
import {
  COAL_TARGET,
  COBBLE_FOR_STONE_PICK,
  DIAMOND_TARGET,
  IRON_INGOT_TARGET,
  selectNextDevelopGoal,
  TORCH_CRAFTS,
} from './policy'

describe('selectNextDevelopGoal', () => {
  it('gathers wood when inventory is empty', () => {
    const goal = selectNextDevelopGoal({})
    expect(goal).toMatchObject({ id: 'gather_wood', kind: 'gather_wood', count: 4 })
  })

  it('crafts planks from the wood type that actually has stock', () => {
    const goal = selectNextDevelopGoal({ birch_log: 1, jungle_log: 3 })
    expect(goal).toMatchObject({
      id: 'craft_planks',
      kind: 'craft',
      item: 'jungle_planks',
      count: 1,
    })
  })

  it('does not over-request crafts beyond available logs of chosen type', () => {
    const goal = selectNextDevelopGoal({ jungle_log: 1, oak_log: 5 })
    expect(goal).toMatchObject({
      id: 'craft_planks',
      item: 'oak_planks',
      count: 1,
    })
  })

  it('ignores non-log items that merely contain substring log', () => {
    const goal = selectNextDevelopGoal({ catalog: 9 } as Record<string, number>)
    expect(goal).toMatchObject({ id: 'gather_wood' })
  })

  it('crafts sticks when planks exist but no tools', () => {
    const goal = selectNextDevelopGoal({ oak_planks: 8 })
    expect(goal).toMatchObject({ id: 'craft_sticks', item: 'stick' })
  })

  it('crafts crafting table before wooden pickaxe', () => {
    const goal = selectNextDevelopGoal({ oak_planks: 8, stick: 4 })
    expect(goal).toMatchObject({ id: 'craft_crafting_table', item: 'crafting_table' })
  })

  it('crafts wooden pickaxe when table and materials ready', () => {
    const goal = selectNextDevelopGoal({
      oak_planks: 8,
      stick: 4,
      crafting_table: 1,
    })
    expect(goal).toMatchObject({ id: 'craft_wooden_pickaxe', item: 'wooden_pickaxe' })
  })

  it('crafts wooden axe after pickaxe exists', () => {
    const goal = selectNextDevelopGoal({
      oak_planks: 8,
      stick: 4,
      crafting_table: 1,
      wooden_pickaxe: 1,
    })
    expect(goal).toMatchObject({ id: 'craft_wooden_axe', item: 'wooden_axe' })
  })

  it('gathers 3 cobble for stone pickaxe after wooden tools', () => {
    const goal = selectNextDevelopGoal({
      oak_planks: 2,
      stick: 2,
      crafting_table: 1,
      wooden_pickaxe: 1,
      wooden_axe: 1,
    })
    expect(goal).toMatchObject({
      id: 'gather_cobblestone',
      kind: 'collect',
      item: 'stone',
      count: COBBLE_FOR_STONE_PICK,
    })
  })

  it('crafts stone pickaxe when 3 cobble ready', () => {
    const goal = selectNextDevelopGoal({
      wooden_pickaxe: 1,
      wooden_axe: 1,
      cobblestone: 3,
      stick: 2,
      crafting_table: 1,
    })
    expect(goal).toMatchObject({ id: 'craft_stone_pickaxe', item: 'stone_pickaxe' })
  })

  it('gathers more cobble for stone kit after stone pickaxe', () => {
    const goal = selectNextDevelopGoal({
      stone_pickaxe: 1,
      stick: 4,
      crafting_table: 1,
      cobblestone: 2,
    })
    expect(goal).toMatchObject({
      id: 'gather_cobblestone',
      label: expect.stringContaining('石头'),
    })
    expect(goal!.count).toBeGreaterThanOrEqual(14)
  })

  it('crafts stone sword then axe shovel furnace when cobble enough', () => {
    expect(selectNextDevelopGoal({
      stone_pickaxe: 1,
      cobblestone: 20,
      stick: 8,
      crafting_table: 1,
    })).toMatchObject({ id: 'craft_stone_sword', item: 'stone_sword' })

    expect(selectNextDevelopGoal({
      stone_pickaxe: 1,
      stone_sword: 1,
      cobblestone: 20,
      stick: 8,
      crafting_table: 1,
    })).toMatchObject({ id: 'craft_stone_axe', item: 'stone_axe' })

    expect(selectNextDevelopGoal({
      stone_pickaxe: 1,
      stone_sword: 1,
      stone_axe: 1,
      cobblestone: 20,
      stick: 8,
      crafting_table: 1,
    })).toMatchObject({ id: 'craft_stone_shovel', item: 'stone_shovel' })

    expect(selectNextDevelopGoal({
      stone_pickaxe: 1,
      stone_sword: 1,
      stone_axe: 1,
      stone_shovel: 1,
      cobblestone: 20,
      stick: 8,
      crafting_table: 1,
    })).toMatchObject({ id: 'craft_furnace', item: 'furnace' })
  })

  it('gathers coal after stone kit and furnace', () => {
    const goal = selectNextDevelopGoal({
      stone_pickaxe: 1,
      stone_sword: 1,
      stone_axe: 1,
      stone_shovel: 1,
      furnace: 1,
    })
    expect(goal).toMatchObject({
      id: 'gather_coal',
      item: 'coal',
      count: COAL_TARGET,
    })
  })

  it('crafts torches after coal', () => {
    const goal = selectNextDevelopGoal({
      stone_pickaxe: 1,
      stone_sword: 1,
      stone_axe: 1,
      stone_shovel: 1,
      furnace: 1,
      coal: COAL_TARGET,
      stick: 8,
    })
    expect(goal).toMatchObject({ id: 'craft_torch', item: 'torch' })
  })

  it('gathers iron after torches', () => {
    const goal = selectNextDevelopGoal({
      stone_pickaxe: 1,
      stone_sword: 1,
      stone_axe: 1,
      stone_shovel: 1,
      furnace: 1,
      coal: COAL_TARGET,
      torch: TORCH_CRAFTS * 4,
    })
    expect(goal).toMatchObject({
      id: 'gather_iron',
      item: 'iron',
      count: IRON_INGOT_TARGET,
    })
  })

  it('smelts raw iron when ore is in inventory', () => {
    const goal = selectNextDevelopGoal({
      stone_pickaxe: 1,
      stone_sword: 1,
      stone_axe: 1,
      stone_shovel: 1,
      furnace: 1,
      coal: COAL_TARGET,
      torch: TORCH_CRAFTS * 4,
      raw_iron: 16,
    })
    expect(goal).toMatchObject({ id: 'smelt_raw_iron', kind: 'smelt', item: 'raw_iron' })
  })

  it('crafts iron gear after enough ingots', () => {
    const base = {
      stone_pickaxe: 1,
      stone_sword: 1,
      stone_axe: 1,
      stone_shovel: 1,
      furnace: 1,
      coal: COAL_TARGET,
      torch: TORCH_CRAFTS * 4,
      iron_ingot: IRON_INGOT_TARGET,
      stick: 16,
      crafting_table: 1,
    }
    expect(selectNextDevelopGoal(base)).toMatchObject({ id: 'craft_iron_pickaxe' })
    expect(selectNextDevelopGoal({ ...base, iron_pickaxe: 1 })).toMatchObject({ id: 'craft_iron_sword' })
    expect(selectNextDevelopGoal({
      ...base,
      iron_pickaxe: 1,
      iron_sword: 1,
      iron_axe: 1,
      iron_shovel: 1,
    })).toMatchObject({ id: 'craft_iron_helmet' })
  })

  it('gathers diamonds after full iron set', () => {
    const goal = selectNextDevelopGoal({
      iron_pickaxe: 1,
      iron_sword: 1,
      iron_axe: 1,
      iron_shovel: 1,
      iron_helmet: 1,
      iron_chestplate: 1,
      iron_leggings: 1,
      iron_boots: 1,
      furnace: 1,
      coal: COAL_TARGET,
      torch: TORCH_CRAFTS * 4,
      stone_pickaxe: 1,
      stone_sword: 1,
      stone_axe: 1,
      stone_shovel: 1,
    })
    expect(goal).toMatchObject({
      id: 'gather_diamond',
      item: 'diamond',
      count: DIAMOND_TARGET,
    })
  })

  it('crafts diamond gear when diamonds ready', () => {
    const base = {
      iron_pickaxe: 1,
      iron_sword: 1,
      iron_axe: 1,
      iron_shovel: 1,
      iron_helmet: 1,
      iron_chestplate: 1,
      iron_leggings: 1,
      iron_boots: 1,
      furnace: 1,
      coal: COAL_TARGET,
      torch: TORCH_CRAFTS * 4,
      stone_pickaxe: 1,
      stone_sword: 1,
      stone_axe: 1,
      stone_shovel: 1,
      diamond: DIAMOND_TARGET,
      stick: 16,
      crafting_table: 1,
    }
    expect(selectNextDevelopGoal(base)).toMatchObject({ id: 'craft_diamond_pickaxe' })
    expect(selectNextDevelopGoal({
      ...base,
      diamond_pickaxe: 1,
      diamond_sword: 1,
      diamond_axe: 1,
      diamond_shovel: 1,
      diamond_helmet: 1,
      diamond_chestplate: 1,
      diamond_leggings: 1,
    })).toMatchObject({ id: 'craft_diamond_boots' })
  })

  it('returns null when full diamond set is complete', () => {
    const goal = selectNextDevelopGoal({
      iron_pickaxe: 1,
      iron_sword: 1,
      iron_axe: 1,
      iron_shovel: 1,
      iron_helmet: 1,
      iron_chestplate: 1,
      iron_leggings: 1,
      iron_boots: 1,
      diamond_pickaxe: 1,
      diamond_sword: 1,
      diamond_axe: 1,
      diamond_shovel: 1,
      diamond_helmet: 1,
      diamond_chestplate: 1,
      diamond_leggings: 1,
      diamond_boots: 1,
      furnace: 1,
      coal: COAL_TARGET,
      torch: TORCH_CRAFTS * 4,
      stone_pickaxe: 1,
      stone_sword: 1,
      stone_axe: 1,
      stone_shovel: 1,
    })
    expect(goal).toBeNull()
  })
})

describe('pickBestWoodLog', () => {
  it('maps log type to matching planks and prefers higher count', () => {
    expect(pickBestWoodLog({ spruce_log: 2 })).toEqual({
      logName: 'spruce_log',
      logCount: 2,
      planksRecipe: 'spruce_planks',
    })
    expect(pickBestWoodLog({ stripped_oak_log: 1 })).toEqual({
      logName: 'stripped_oak_log',
      logCount: 1,
      planksRecipe: 'oak_planks',
    })
    expect(pickBestWoodLog({})).toBeNull()
  })
})
