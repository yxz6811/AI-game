/**
 * @file 高层 ActionName → Minecraft LLM 工具映射
 *
 * 只做参数形状转换，真正执行仍走既有 ActionRegistry。
 */

import type { ActionName, ActionRequest } from '../contract/actions.js'

/**
 * 映射后的既有工具调用
 */
export interface MappedMinecraftStep {
  tool: string
  params: Record<string, unknown>
}

/**
 * `stop` 需先清跟随再 interrupt，故返回有序步骤列表
 */
export type MappedMinecraftPlan
  = | { ok: true, steps: MappedMinecraftStep[] }
    | { ok: false, reason: string }

/**
 * 解析 `move` 的坐标 target："x,y,z" / "x y z"
 * @param target 原始 target 字符串
 */
export function parseCoordinateTarget(target: string): { x: number, y: number, z: number } | null {
  const parts = target.trim().split(/[\s,]+/).filter(Boolean)
  if (parts.length !== 3)
    return null

  const [xs, ys, zs] = parts
  const x = Number(xs)
  const y = Number(ys)
  const z = Number(zs)
  if (![x, y, z].every(n => Number.isFinite(n)))
    return null

  return { x, y, z }
}

/**
 * 将统一 ActionRequest 映射为 Minecraft 工具步骤
 *
 * @param request 高层动作
 * @param followDistance 跟随默认距离
 */
export function mapActionToMinecraftSteps(
  request: ActionRequest,
  followDistance: number,
): MappedMinecraftPlan {
  const action = request.action
  const target = request.params?.target?.trim()
  const text = request.params?.text?.trim()

  switch (action as ActionName) {
    case 'follow': {
      if (!target) {
        return { ok: false, reason: 'follow 需要 params.target（玩家名）' }
      }
      return {
        ok: true,
        steps: [{
          tool: 'followPlayer',
          params: { player_name: target, follow_dist: followDistance },
        }],
      }
    }

    case 'move': {
      if (!target) {
        return { ok: false, reason: 'move 需要 params.target（玩家名或 "x,y,z"）' }
      }
      const coord = parseCoordinateTarget(target)
      if (coord) {
        return {
          ok: true,
          steps: [{
            tool: 'goToCoordinate',
            params: { ...coord, closeness: 1 },
          }],
        }
      }
      return {
        ok: true,
        steps: [{
          tool: 'goToPlayer',
          params: { player_name: target, closeness: 2 },
        }],
      }
    }

    case 'collect': {
      if (!target) {
        return { ok: false, reason: 'collect 需要 params.target（方块类型，如 oak_log）' }
      }
      return {
        ok: true,
        steps: [{
          tool: 'collectBlocks',
          params: { type: target, num: 1 },
        }],
      }
    }

    case 'interact': {
      if (!target) {
        return { ok: false, reason: 'interact 需要 params.target（可激活方块类型）' }
      }
      return {
        ok: true,
        steps: [{
          tool: 'activate',
          params: { type: target },
        }],
      }
    }

    case 'stop': {
      // NOTICE: clearFollowTarget 清 idle 跟随；stop 中断 pathfinder/dig。两者都需要才能完全停下。
      return {
        ok: true,
        steps: [
          { tool: 'clearFollowTarget', params: {} },
          { tool: 'stop', params: {} },
        ],
      }
    }

    case 'say': {
      if (!text) {
        return { ok: false, reason: 'say 需要 params.text' }
      }
      return {
        ok: true,
        steps: [{
          tool: 'chat',
          params: { message: text, feedback: false },
        }],
      }
    }

    default: {
      return {
        ok: false,
        reason: `不支持的动作: ${String(action)}（未在 capabilities 声明）`,
      }
    }
  }
}

/**
 * Minecraft Adapter 声明的能力表（FR-016 最小集）
 */
export function minecraftCapabilities() {
  return [
    { action: 'follow', supported: true, constraints: 'params.target = 玩家名' },
    { action: 'move', supported: true, constraints: 'params.target = 玩家名或 "x,y,z"' },
    { action: 'collect', supported: true, constraints: 'params.target = 方块类型；默认数量 1' },
    { action: 'interact', supported: true, constraints: 'params.target = 可激活方块类型' },
    { action: 'stop', supported: true },
    { action: 'say', supported: true, constraints: 'params.text 必填' },
  ] as const
}
