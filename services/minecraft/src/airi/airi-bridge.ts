import type { Client, ContextUpdate, ModuleAnnouncedEvent } from '@proj-airi/server-sdk'

import type { EventBus } from '../cognitive/event-bus'

import { useLogg } from '@guiiai/logg'
import { ContextUpdateStrategy } from '@proj-airi/server-sdk'
import { nanoid } from 'nanoid'

import { matchIdleDevelopCommand } from '../cognitive/idle-develop'
import { errorMessageFromValue } from '../utils/error-message'

/**
 * 黑客松双工旁路：Intent Bridge 已判定的结构化动作，绕过 Conscious LLM。
 *
 * NOTICE:
 * Why: spark:command 默认进 Brain 再调 GLM，实测 import→answer 约 5–6s，陪伴体验不可用。
 * Root cause: AiriBridge 只发 signal:airi_command，必须等一轮 LLM 才落到 follow/stop。
 * Source: duplex-voice GameTools + 终端实测（received → clearFollowTarget ≈ 6s）。
 * Removal: 产品级 Brain B 原生 tool 闭环就绪后，可删此旁路，改回纯 guidance。
 */
export interface DirectAction {
  tool: string
  params?: Record<string, unknown>
}

interface SparkCommandData {
  commandId: string
  intent: 'plan' | 'proposal' | 'action' | 'pause' | 'resume' | 'reroute' | 'context'
  interrupt: 'force' | 'soft' | false
  priority: 'critical' | 'high' | 'normal' | 'low'
  guidance?: {
    options?: Array<{ label: string, steps: string[] }>
  }
  /** 可选：结构化直达动作（协议扩展字段，总线透传） */
  directAction?: DirectAction
}

export type DirectActionHandler = (action: DirectAction, cmd: SparkCommandData) => Promise<void> | void

export class AiriBridge {
  private readonly logger = useLogg('airi-bridge').useGlobalConfig()
  private commandHandler: ((event: { data: SparkCommandData }) => void) | null = null
  private contextUpdateHandler: ((event: { data: ContextUpdate }) => void) | null = null
  private moduleAnnouncedHandler: ((event: { data: ModuleAnnouncedEvent }) => void) | null = null
  private readonly moduleAnnouncedListeners = new Set<(event: ModuleAnnouncedEvent) => void>()
  private directActionHandler: DirectActionHandler | null = null

  constructor(
    private readonly client: Client,
    private readonly eventBus: EventBus,
  ) {}

  /**
   * 注册直达动作执行器（由 CognitiveEngine 在 TaskExecutor 就绪后注入）。
   */
  setDirectActionHandler(handler: DirectActionHandler | null): void {
    this.directActionHandler = handler
  }

  init(): void {
    this.commandHandler = (event) => {
      const cmd = event.data
      this.logger.log('Received spark:command', { intent: cmd.intent, commandId: cmd.commandId })

      // Acknowledge receipt
      this.client.send({
        type: 'spark:emit',
        data: {
          id: nanoid(),
          eventId: cmd.commandId,
          state: 'queued',
          note: 'Command received',
        },
      } as Parameters<typeof this.client.send>[0])

      // A spark:command is high-level guidance from the AIRI server. It must carry enough weight to
      // trigger a fresh decision (Conscious) cycle, never be silently filed into history — so we
      // always route it through handleActionIntent (→ signal:airi_command → enqueueEvent → decision cycle).
      //
      // We intentionally do not special-case `intent === 'context'`: that branch used to emit
      // signal:airi_context which Brain pushes to conversationHistory WITHOUT waking the loop, so a
      // command that mislabels its intent as "context" would be silently dropped from action. True
      // passive context still has its own dedicated channel — `context:update` (see
      // contextUpdateHandler) — which remains history-only and is unaffected by this routing.
      this.handleActionIntent(cmd)
    }

    this.contextUpdateHandler = (event) => {
      const ctx = event.data
      this.logger.log('Received context:update', { lane: ctx.lane, preview: ctx.text.slice(0, 80) })

      this.eventBus.emit({
        type: 'signal:airi_context',
        payload: Object.freeze({
          type: 'airi_context' as const,
          description: ctx.text,
          sourceId: 'airi',
          confidence: 1.0,
          timestamp: Date.now(),
          metadata: {
            source: 'airi',
            contextId: ctx.contextId,
            lane: ctx.lane ?? 'general',
            hints: ctx.hints ?? [],
          },
        }),
        source: { component: 'airi', id: 'bridge' },
      })
    }

    this.moduleAnnouncedHandler = (event) => {
      const moduleAnnouncement = event.data
      this.logger.log('Received module:announced', { name: moduleAnnouncement.name, pluginId: moduleAnnouncement.identity?.plugin?.id })
      for (const listener of this.moduleAnnouncedListeners) {
        listener(moduleAnnouncement)
      }
    }

    this.client.onEvent('spark:command', this.commandHandler as Parameters<typeof this.client.onEvent<'spark:command'>>[1])
    this.client.onEvent('context:update', this.contextUpdateHandler as Parameters<typeof this.client.onEvent<'context:update'>>[1])
    this.client.onEvent('module:announced', this.moduleAnnouncedHandler as Parameters<typeof this.client.onEvent<'module:announced'>>[1])
    this.logger.log('AiriBridge initialized, listening for spark:command, context:update, and module:announced')
  }

  destroy(): void {
    if (this.commandHandler) {
      this.client.offEvent('spark:command', this.commandHandler as Parameters<typeof this.client.offEvent<'spark:command'>>[1])
      this.commandHandler = null
    }
    if (this.contextUpdateHandler) {
      this.client.offEvent('context:update', this.contextUpdateHandler as Parameters<typeof this.client.offEvent<'context:update'>>[1])
      this.contextUpdateHandler = null
    }
    if (this.moduleAnnouncedHandler) {
      this.client.offEvent('module:announced', this.moduleAnnouncedHandler as Parameters<typeof this.client.offEvent<'module:announced'>>[1])
      this.moduleAnnouncedHandler = null
    }
    this.moduleAnnouncedListeners.clear()
    this.logger.log('AiriBridge destroyed')
  }

  sendNotify(headline: string, note?: string, urgency: 'immediate' | 'soon' | 'later' = 'soon'): void {
    this.client.send({
      type: 'spark:notify',
      data: {
        id: nanoid(),
        eventId: nanoid(),
        kind: 'ping',
        urgency,
        headline,
        note,
        destinations: ['proj-airi:stage-*'],
      },
    } as Parameters<typeof this.client.send>[0])
    this.logger.log('Sent spark:notify', { headline, urgency })
  }

  sendContextUpdate(text: string, hints?: string[], lane?: string): void
  sendContextUpdate(update: ContextUpdate): void
  sendContextUpdate(textOrUpdate: string | Omit<ContextUpdate, 'strategy' | 'id' | 'contextId'> & { contextId?: string }, hints?: string[], lane = 'game'): void {
    const update = typeof textOrUpdate === 'string'
      ? {
        text: textOrUpdate,
        hints,
        lane,
        strategy: ContextUpdateStrategy.AppendSelf,
      } satisfies Omit<ContextUpdate, 'id' | 'contextId'> & { contextId?: string }
      : {
          strategy: ContextUpdateStrategy.AppendSelf,
          ...textOrUpdate,
        }

    const contextId = update.contextId ?? nanoid()
    this.client.send({
      type: 'context:update',
      data: {
        id: nanoid(),
        contextId,
        lane: update.lane,
        text: update.text,
        hints: update.hints,
        strategy: update.strategy,
        destinations: update.destinations,
      },
    } as Parameters<typeof this.client.send>[0])
    this.logger.log('Sent context:update', { lane: update.lane, preview: update.text.slice(0, 80), contextId })
  }

  sendEmit(eventId: string, state: 'queued' | 'working' | 'done' | 'dropped', note?: string): void {
    this.client.send({
      type: 'spark:emit',
      data: {
        id: nanoid(),
        eventId,
        state,
        note,
      },
    } as Parameters<typeof this.client.send>[0])
    this.logger.log('Sent spark:emit', { eventId, state })
  }

  onModuleAnnounced(listener: (event: ModuleAnnouncedEvent) => void) {
    this.moduleAnnouncedListeners.add(listener)

    return () => {
      this.moduleAnnouncedListeners.delete(listener)
    }
  }

  private handleActionIntent(cmd: SparkCommandData): void {
    // A spark:command is high-level guidance from the AIRI server. Route it through the explicit
    // `airi_command` signal so the brain runs a fresh decision cycle
    // (resetNoActionFollowupBudget('airi_command'), normal Conscious wake-up) instead of silently
    // filing it into history. The directive is attributed to the AIRI server as a neutral source,
    // not to any specific in-game player. Binding a relayed command to the master's in-game identity
    // is desktop-relay policy and lives in the desktop Minecraft adapter, not in this bot service.
    const firstOption = cmd.guidance?.options?.[0]
    const label = firstOption?.label?.trim()
    const steps = firstOption?.steps ?? []
    // Prefer the short label (closest to the original instruction). Fall back to joined steps so the
    // brain still has detail when label is missing.
    const message = label && label.length > 0
      ? label
      : (steps.length > 0 ? steps.join(' / ') : `${cmd.intent} command received`)

    const sourceId = 'airi'
    // 无 structured directAction 时，从 guidance 文案推断空闲发育开关（AIRI 聊天/桌面也能直达）
    const inferredDevelop = matchIdleDevelopCommand(message)
    const directAction = cmd.directAction ?? (
      inferredDevelop === 'enable'
        ? { tool: 'idleDevelopEnable' as const, params: {} }
        : inferredDevelop === 'disable'
          ? { tool: 'idleDevelopDisable' as const, params: {} }
          : undefined
    )

    // Fast path: Intent Bridge 已给出 tool，直接执行，不再唤醒 Conscious LLM。
    if (directAction?.tool && this.directActionHandler) {
      const startedAt = Date.now()
      this.logger.log('Fast-path directAction (skip LLM)', {
        commandId: cmd.commandId,
        tool: directAction.tool,
        params: directAction.params ?? {},
      })

      // 记入历史供后续闲聊上下文，但不发 airi_command（避免再跑一轮 Brain）。
      this.eventBus.emit({
        type: 'signal:airi_context',
        payload: Object.freeze({
          type: 'airi_context' as const,
          description: `Direct action from AIRI: ${directAction.tool} ("${message}")`,
          sourceId,
          confidence: 1.0,
          timestamp: Date.now(),
          metadata: {
            message,
            sparkCommandId: cmd.commandId,
            sparkIntent: cmd.intent,
            directAction: true,
            tool: directAction.tool,
          },
        }),
        source: { component: 'airi', id: 'bridge' },
      })

      void Promise.resolve(this.directActionHandler(directAction, cmd))
        .then(() => {
          const elapsedMs = Date.now() - startedAt
          this.sendEmit(cmd.commandId, 'done', `directAction ${directAction.tool} (${elapsedMs}ms)`)
          this.logger.log('directAction completed', {
            commandId: cmd.commandId,
            tool: directAction.tool,
            elapsedMs,
          })
        })
        .catch((error: unknown) => {
          const note = errorMessageFromValue(error)
          this.sendEmit(cmd.commandId, 'dropped', `directAction failed: ${note}`)
          this.logger.error(`directAction failed; falling back to LLM directive: ${note}`)
          this.emitAiriCommand(cmd, message, sourceId)
        })
      return
    }

    this.logger.log('Routing spark:command as an AIRI directive', {
      commandId: cmd.commandId,
      message,
    })

    this.emitAiriCommand(cmd, message, sourceId)
  }

  private emitAiriCommand(cmd: SparkCommandData, message: string, sourceId: string): void {
    this.eventBus.emit({
      type: 'signal:airi_command',
      payload: Object.freeze({
        type: 'airi_command' as const,
        description: `Directive from AIRI: "${message}"`,
        sourceId,
        confidence: 1.0,
        timestamp: Date.now(),
        metadata: {
          message,
          // Keep the spark provenance for debugging; the brain sees a typed AIRI directive.
          sparkCommandId: cmd.commandId,
          sparkIntent: cmd.intent,
        },
      }),
      source: { component: 'airi', id: 'bridge' },
    })
  }
}
