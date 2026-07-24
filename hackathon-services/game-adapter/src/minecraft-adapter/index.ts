/**
 * @file Minecraft Adapter（G2-03）
 *
 * 薄包装：把统一契约动作映射到 `ActionRegistry`/`TaskExecutor` 既有工具，
 * 不修改 `services/minecraft` 内部逻辑。
 *
 * Call stack:
 *
 * createMinecraftAdapter
 * -> {@link mapActionToMinecraftSteps}
 * -> MinecraftActionRunner.performAction
 * -> (集成方) ActionRegistry.performAction / TaskExecutor.executeActionWithResult
 */

import type { GameState } from '../contract/game-state.js'
import type {
  ActionRequest,
  ActionResult,
  Capability,
  EventStream,
  GameAdapter,
  HealthStatus,
} from '../contract/types.js'
import type { MinecraftAdapterOptions } from './types.js'

import { mapActionToMinecraftSteps, minecraftCapabilities } from './action-map.js'
import { normalizePerceptionEvent } from './events.js'
import { emptyGameState, projectGameState } from './observe.js'

export {
  mapActionToMinecraftSteps,
  minecraftCapabilities,
  parseCoordinateTarget,
} from './action-map.js'

export { mapPerceptionKind, normalizePerceptionEvent } from './events.js'
export { emptyGameState, projectGameState } from './observe.js'
export type {
  MinecraftActionRunner,
  MinecraftAdapterOptions,
  MinecraftEventSource,
  MinecraftPerceptionEvent,
  MinecraftWorldSnapshot,
} from './types.js'

/**
 * 带超时的 Promise
 * @param promise 原 Promise
 * @param ms 超时毫秒；≤0 不限制
 * @param label 错误文案前缀
 */
async function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  if (ms <= 0)
    return promise

  let timer: ReturnType<typeof setTimeout> | undefined
  try {
    return await Promise.race([
      promise,
      new Promise<T>((_, reject) => {
        timer = setTimeout(() => {
          reject(new Error(`${label} timed out after ${ms}ms`))
        }, ms)
      }),
    ])
  }
  finally {
    if (timer)
      clearTimeout(timer)
  }
}

/**
 * 创建 Minecraft GameAdapter
 *
 * @param options 注入 runner / 快照 / 事件源
 */
export function createMinecraftAdapter(options: MinecraftAdapterOptions): GameAdapter {
  const followDistance = options.followDistance ?? 2
  const actTimeoutMs = options.actTimeoutMs ?? 0

  let lastError: string | null = options.initialHealth?.last_error ?? null
  let recoverable = options.initialHealth?.recoverable ?? true

  const observe = async (): Promise<GameState> => {
    if (!options.readSnapshot)
      return emptyGameState()

    const snapshot = await options.readSnapshot()
    return projectGameState(snapshot)
  }

  const act = async (action: ActionRequest): Promise<ActionResult> => {
    const supported = minecraftCapabilities().some(c => c.action === action.action && c.supported)
    if (!supported) {
      return {
        status: 'rejected',
        reason: `动作未在 capabilities 声明: ${action.action}`,
      }
    }

    const plan = mapActionToMinecraftSteps(action, followDistance)
    if (!plan.ok) {
      return { status: 'rejected', reason: plan.reason }
    }

    try {
      for (const step of plan.steps) {
        await withTimeout(
          options.runner.performAction({
            tool: step.tool,
            params: step.params,
            description: `${action.action}:${step.tool}`,
          }),
          actTimeoutMs,
          `act(${action.action}/${step.tool})`,
        )
      }

      lastError = null
      recoverable = true
      return { status: 'completed' }
    }
    catch (error) {
      const message = messageFromUnknown(error)
      lastError = message
      recoverable = true
      return { status: 'failed', reason: message }
    }
  }

  const events = (): EventStream => {
    const source = options.eventSource
    return {
      subscribe: (listener) => {
        if (!source)
          return () => {}

        return source.subscribe((raw) => {
          listener(normalizePerceptionEvent(raw))
        })
      },
    }
  }

  const capabilities = (): Capability[] => {
    return minecraftCapabilities().map(c => ({ ...c }))
  }

  const health = async (): Promise<HealthStatus> => {
    const snapshot = options.readSnapshot
      ? await options.readSnapshot()
      : { connected: false, latency_ms: 0, last_error: lastError, recoverable }

    const connection: HealthStatus['connection'] = snapshot.connected
      ? 'connected'
      : 'disconnected'

    return {
      connection,
      latency_ms: snapshot.latency_ms ?? options.initialHealth?.latency_ms ?? 0,
      last_error: snapshot.last_error ?? lastError,
      recoverable: snapshot.recoverable ?? recoverable,
    }
  }

  return { observe, act, events, capabilities, health }
}

/**
 * 从未知抛出值取可读消息（避免 `instanceof Error ? .message` 受限写法）。
 * @param error 任意抛出值
 */
function messageFromUnknown(error: unknown): string {
  if (typeof error === 'object' && error !== null && 'message' in error) {
    const message = (error as { message: unknown }).message
    if (typeof message === 'string' && message.length > 0)
      return message
  }
  return String(error)
}
