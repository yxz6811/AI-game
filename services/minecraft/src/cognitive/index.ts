import type { MineflayerPlugin } from '../libs/mineflayer'
import type { CognitiveEngineOptions, MineflayerWithAgents } from './types'

import { config } from '../composables/config'
import { DebugService } from '../debug'
import { McpReplServer } from '../debug/mcp-repl-server'
import { ChatMessageHandler } from '../libs/mineflayer'
import { createAgentContainer } from './container'
import { IdleDevelopLoop, matchIdleDevelopCommand } from './idle-develop'

/**
 * 游戏内短指令快路径（黑客松陪伴）：匹配则直达反射层，不唤醒 LLM。
 * @param message 玩家聊天原文
 */
function matchInGameCompanionCommand(message: string): 'follow' | 'stop' | 'jump' | null {
  const t = message.trim()
  if (!t)
    return null
  if (/停下|停止|停一下|别动|别跟|不跟了|站住|取消|等等|\bstop\b|\bhalt\b/i.test(t))
    return 'stop'
  if (/跳一跳|跳一下|跳跃|\bjump\b/i.test(t))
    return 'jump'
  // 「过来」必须跟说话者，不能让 LLM 去找名为 AIRI 的坐标/实体
  if (/跟我来|跟着我|过来跟|过来|到这里|来这边|come\s*here|follow\s*me/i.test(t))
    return 'follow'
  return null
}

export function CognitiveEngine(options: CognitiveEngineOptions): MineflayerPlugin {
  let container: ReturnType<typeof createAgentContainer>
  let spawnHandler: (() => void) | null = null
  let mcpReplServer: McpReplServer | null = null
  let idleDevelopLoop: IdleDevelopLoop | null = null
  let started = false

  return {
    async created(bot) {
      // Create container and get required services
      container = createAgentContainer(options.airiClient)

      const perceptionPipeline = container.resolve('perceptionPipeline')
      const brain = container.resolve('brain')
      const reflexManager = container.resolve('reflexManager')
      const taskExecutor = container.resolve('taskExecutor')
      const airiBridge = container.resolve('airiBridge')
      const minecraftContextService = container.resolve('minecraftContextService')
      const logger = container.resolve('logger')
      const debugService = DebugService.getInstance()

      idleDevelopLoop = new IdleDevelopLoop({ taskExecutor, logger })

      airiBridge.init()
      minecraftContextService.init()

      if (config.debug.mcp) {
        mcpReplServer = new McpReplServer(brain)
        mcpReplServer.start()
      }

      debugService.onCommand('request_repl_state', () => {
        debugService.emit('debug:repl_state', brain.getReplState())
      })

      debugService.onCommand('request_conversation', () => {
        brain.broadcastConversationState()
      })

      debugService.onCommand('execute_repl', async (command) => {
        if (command.type !== 'execute_repl')
          return

        const code = command.payload?.code
        if (typeof code !== 'string') {
          debugService.emit('debug:repl_result', {
            source: 'manual',
            code: '',
            logs: [],
            actions: [],
            error: 'Invalid REPL request: code must be a string',
            durationMs: 0,
            timestamp: Date.now(),
          })
          return
        }

        const result = await brain.executeDebugRepl(code)
        debugService.emit('debug:repl_result', result)
      })

      // Initialize task executor with mineflayer instance
      taskExecutor.setMineflayer(bot)
      await taskExecutor.initialize()

      // NOTICE:
      // Why: duplex Intent Bridge 已判定 follow/stop/move/jump，再走 LLM 会多 5s+。
      // Root cause: spark:command → signal:airi_command → Conscious → GLM。
      // Source: hackathon duplex-voice directAction 字段。
      // Removal: Brain B 原生 tool 闭环后删除 handler 注入。
      airiBridge.setDirectActionHandler(async (action) => {
        const startedAt = Date.now()

        // 玩家经 Intent Bridge 下发的动作一律视为抢占空闲发育（开启除外）
        if (action.tool !== 'idleDevelopEnable')
          idleDevelopLoop?.notePlayerActivity()

        if (action.tool === 'idleDevelopEnable') {
          // 「自己去发育」必须先脱离跟随，否则 tick 会被 followActive 永久挡住
          reflexManager.clearFollowTarget()
          idleDevelopLoop?.enable()
        }
        else if (action.tool === 'idleDevelopDisable') {
          bot.interrupt('idle-develop disabled via AIRI')
          idleDevelopLoop?.disable()
          idleDevelopLoop?.onInterrupted('directAction idleDevelopDisable')
        }
        else if (action.tool === 'jump') {
          const mfBot = bot.bot
          mfBot.setControlState('jump', true)
          await new Promise(resolve => setTimeout(resolve, 350))
          mfBot.setControlState('jump', false)
          // 再跳一次，观感更接近「跳一跳」
          await new Promise(resolve => setTimeout(resolve, 120))
          mfBot.setControlState('jump', true)
          await new Promise(resolve => setTimeout(resolve, 350))
          mfBot.setControlState('jump', false)
        }
        else if (action.tool === 'stopBundle') {
          idleDevelopLoop?.onInterrupted('directAction stopBundle')
          await taskExecutor.executeActionWithResult({ tool: 'clearFollowTarget', params: {} })
          await taskExecutor.executeActionWithResult({ tool: 'stop', params: {} })
        }
        else {
          if (action.tool === 'followPlayer' || action.tool === 'stop' || action.tool === 'clearFollowTarget')
            idleDevelopLoop?.onInterrupted(`directAction ${action.tool}`)

          await taskExecutor.executeActionWithResult({
            tool: action.tool,
            params: action.params ?? {},
          })
        }

        logger.withFields({
          tool: action.tool,
          elapsedMs: Date.now() - startedAt,
        }).log('directAction executed')
      })

      // Type conversion
      const botWithAgents = bot as unknown as MineflayerWithAgents
      botWithAgents.reflexManager = reflexManager

      const startCognitive = () => {
        if (started)
          return
        started = true

        // Initialize layers
        reflexManager.init(botWithAgents)
        brain.init(botWithAgents)

        // Ensure perception rules engine is instantiated (Awilix is lazy).
        void container.resolve('ruleEngine')

        // Initialize perception pipeline (raw events + detectors)
        perceptionPipeline.init(botWithAgents)

        idleDevelopLoop?.start(botWithAgents)

        bot.onTick('tick', () => {
          // Empty listener
        })

        // Resolve EventBus for message handling
        const eventBus = container.resolve('eventBus')

        // NOTICE: EventBus trace forwarding disabled - trace logs removed to reduce noise
        // All events from EventBus were being forwarded to DebugService as trace events,
        // causing thousands of 'raw:sighted:entity_moved' entries in the logs.
        // Conscious layer (LLM) events are still logged separately.

        // Set message handling via EventBus
        const chatHandler = new ChatMessageHandler(bot.username)
        bot.bot.on('chat', (username, message) => {
          if (chatHandler.isBotMessage(username)) {
            // The bot's own chat line — it must not react to its own messages.
            return
          }

          if (message.trim().toLowerCase() === '!pause') {
            const paused = brain.togglePaused()
            bot.bot.chat(`[debug] Cognitive engine ${paused ? 'paused' : 'resumed'} (by ${username}).`)
            return
          }

          // NOTICE:
          // Why: 游戏内「过来」若走 Conscious LLM，常把目标误判成 AIRI（上下文里充满 AIRI 指令），
          // 出现「无法到达 AIRI 的位置」且原地不动。
          // Root cause: chat → signal:chat_message → GLM；prompt 把 AIRI 当监督角色，易被当成目的地。
          // Removal: 产品级意图分类稳定后可删，改由统一 Intent Bridge 覆盖游戏内聊天。
          const developCmd = matchIdleDevelopCommand(message)
          if (developCmd === 'enable') {
            reflexManager.clearFollowTarget()
            idleDevelopLoop?.enable()
            logger.withFields({ username, message }).log('In-game chat fast-path: idle-develop enable')
            return
          }
          if (developCmd === 'disable') {
            idleDevelopLoop?.disable()
            bot.interrupt('idle-develop disabled')
            idleDevelopLoop?.onInterrupted('player disabled idle-develop')
            logger.withFields({ username, message }).log('In-game chat fast-path: idle-develop disable')
            return
          }

          const companionCmd = matchInGameCompanionCommand(message)
          if (companionCmd === 'follow') {
            idleDevelopLoop?.onInterrupted('in-game follow')
            reflexManager.setFollowTarget(username, 2)
            logger.withFields({ username, message }).log('In-game chat fast-path: follow')
            return
          }
          if (companionCmd === 'stop') {
            reflexManager.clearFollowTarget()
            bot.interrupt('in-game stop')
            idleDevelopLoop?.onInterrupted('in-game stop')
            logger.withFields({ username, message }).log('In-game chat fast-path: stop')
            return
          }
          if (companionCmd === 'jump') {
            idleDevelopLoop?.notePlayerActivity()
            const mfBot = bot.bot
            void (async () => {
              mfBot.setControlState('jump', true)
              await new Promise(resolve => setTimeout(resolve, 350))
              mfBot.setControlState('jump', false)
            })()
            logger.withFields({ username, message }).log('In-game chat fast-path: jump')
            return
          }

          // 普通聊天也算玩家活动，推迟自主发育
          idleDevelopLoop?.notePlayerActivity()

          // Bridge chat directly into EventBus as a signal so Reflex can react to it.
          eventBus.emit({
            type: 'signal:chat_message',
            payload: Object.freeze({
              type: 'chat_message',
              description: `Chat from ${username}: "${message}"`,
              sourceId: username,
              confidence: 1.0,
              timestamp: Date.now(),
              metadata: {
                username,
                message,
              },
            }),
            source: {
              component: 'perception',
              id: 'chat',
            },
          })

          // Chat is handled via signal:chat_message only; no extra perception emission needed.
        })
      }

      if (bot.bot.entity) {
        startCognitive()
      }
      else {
        spawnHandler = () => startCognitive()
        bot.bot.once('spawn', spawnHandler)
      }
    },

    async beforeCleanup(bot) {
      if (mcpReplServer) {
        mcpReplServer.stop()
        mcpReplServer = null
      }

      if (container) {
        idleDevelopLoop?.stop()
        idleDevelopLoop = null

        const minecraftContextService = container.resolve('minecraftContextService')
        minecraftContextService.destroy()

        const airiBridge = container.resolve('airiBridge')
        airiBridge.setDirectActionHandler(null)
        airiBridge.destroy()

        const brain = container.resolve('brain')
        brain.destroy()

        const taskExecutor = container.resolve('taskExecutor')
        await taskExecutor.destroy()

        const perceptionPipeline = container.resolve('perceptionPipeline')
        perceptionPipeline.destroy()

        const ruleEngine = container.resolve('ruleEngine')
        ruleEngine.destroy()

        const reflexManager = container.resolve('reflexManager')
        reflexManager.destroy()
      }

      if (spawnHandler) {
        bot.bot.off('spawn', spawnHandler)
        spawnHandler = null
      }
      started = false

      bot.bot.removeAllListeners('chat')
    },
  }
}
