/**
 * @file Minecraft Adapter 依赖边界
 *
 * 故意不直接 import `services/minecraft`：包装层只依赖「可调用的动作入口」与
 * 「可订阅的感知事件」，由集成方把 `ActionRegistry` / `TaskExecutor` / Perception
 * 事件总线注入进来（G2-03：不修改既有内部逻辑）。
 */

import type { GameState } from '../contract/game-state.js'
import type { HealthStatus } from '../contract/types.js'

/**
 * 对齐 `ActionRegistry.performAction` / `TaskExecutor.executeActionWithResult` 的最小入口
 */
export interface MinecraftActionRunner {
  /**
   * 执行既有 LLM 动作（如 `followPlayer` / `stop` / `collectBlocks`）
   * @param step 工具名 + 参数（Zod schema 由 registry 侧校验）
   */
  performAction: (step: {
    tool: string
    params?: Record<string, unknown>
    description?: string
  }) => Promise<unknown>
}

/**
 * 原始感知事件（与 Perception `RawPerceptionEventBase` 对齐的最小超集）
 */
export interface MinecraftPerceptionEvent {
  kind: string
  modality?: string
  timestamp?: number
  source?: string
  [key: string]: unknown
}

/**
 * 感知事件订阅源
 */
export interface MinecraftEventSource {
  /**
   * 订阅原始感知事件
   * @param listener 回调
   * @returns 取消订阅
   */
  subscribe: (listener: (event: MinecraftPerceptionEvent) => void) => () => void
}

/**
 * 世界快照读取（可由 mineflayer bot 投影而来）
 */
export interface MinecraftWorldSnapshot {
  /** 是否已连上游戏服 */
  connected: boolean
  /** 往返延迟估计（ms）；未知时为 0 */
  latency_ms?: number
  /** 最近一次连接/协议错误；无则为 null */
  last_error?: string | null
  /** 错误是否可恢复 */
  recoverable?: boolean
  /** 已映射好的 GameState；缺省时 Adapter 返回空安全态 */
  game_state?: GameState
}

/**
 * `createMinecraftAdapter` 选项
 */
export interface MinecraftAdapterOptions {
  /** 动作执行入口（包装 ActionRegistry / TaskExecutor） */
  runner: MinecraftActionRunner
  /** 状态观测；缺省返回空安全 GameState */
  readSnapshot?: () => MinecraftWorldSnapshot | Promise<MinecraftWorldSnapshot>
  /** 感知事件源；缺省为空流 */
  eventSource?: MinecraftEventSource
  /**
   * 跟随默认距离（方块）
   * @default 2
   */
  followDistance?: number
  /**
   * 单次 `act()` 超时（ms）；`0` 表示不限制
   * @default 0
   */
  actTimeoutMs?: number
  /**
   * 覆盖初始 `health()` 字段
   */
  initialHealth?: Partial<HealthStatus>
}
