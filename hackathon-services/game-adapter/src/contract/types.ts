/**
 * @file Game Adapter 契约类型（observe/act/events/capabilities/health）
 * @see docs/ai-game/specs/001-ai-game-teammate/contracts/game-adapter-contract.md
 */

import type { ActionRequest, ActionResult } from './actions.js'
import type { GameState } from './game-state.js'

export type { ActionName, ActionRequest, ActionResult } from './actions.js'
export type {
  CharacterState,
  Danger,
  GameState,
  MissionProgress,
  NearbyEntity,
  ResourceItem,
  Vec3,
} from './game-state.js'

/**
 * 归一化游戏事件（与 AIRI Perception 形状对齐）
 */
export interface GameEvent {
  type: 'hit' | 'death' | 'resource_gained' | 'objective_completed' | 'player_command' | string
  detail: Record<string, unknown>
  /** ISO8601 */
  occurred_at: string
}

/**
 * 异步事件流（最小可消费接口）
 */
export interface EventStream {
  /**
   * 订阅事件
   * @param listener 回调
   * @returns 取消订阅
   */
  subscribe: (listener: (event: GameEvent) => void) => () => void
}

/**
 * 能力声明
 */
export interface Capability {
  action: string
  supported: boolean
  constraints?: string
}

/**
 * 适配器健康状态
 */
export interface HealthStatus {
  connection: 'connected' | 'disconnected' | 'reconnecting'
  latency_ms: number
  last_error: string | null
  recoverable: boolean
}

/**
 * 统一 Game Adapter 契约（Minecraft / DST 均须实现）
 */
export interface GameAdapter {
  /** 读取标准化状态 */
  observe: () => Promise<GameState> | GameState
  /** 执行高层动作 */
  act: (action: ActionRequest) => Promise<ActionResult>
  /** 事件流 */
  events: () => EventStream
  /** 声明支持的动作 */
  capabilities: () => Capability[] | Promise<Capability[]>
  /** 连接健康 */
  health: () => HealthStatus | Promise<HealthStatus>
}
