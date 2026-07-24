/**
 * @file duplex-voice 编排入口：Brain A（真全双工）旁路 → Intent Bridge → GameTools
 *
 * Brain A：本机 Comni / MiniCPM-o Audio Full-Duplex（听+说双流在浏览器页）
 * Brain B：本包规则意图 → AIRI → minecraft-bot
 *
 * 本机 Comni（localhost:8006）不走公网 `/v1/realtime`（会 403），
 * 改用浏览器注入桥：listen / Web Speech 文本 → HTTP → Intent Bridge。
 */

import process from 'node:process'

import * as readline from 'node:readline'

import {
  adviseCompanionTurn,
  buildCompanionSystemPrompt,
  companionGreeting,
  composeCompanionReply,
} from '../../persona/src/index.js'
import { logEchoPolicy } from './aec-policy.js'
import { shouldUseComniBridge, startBridgeHttp } from './bridge/http-server.js'
import { GameTools, resolveAirWsUrl } from './game-tools/airi-client.js'
import { IntentBridge, matchIntent } from './intent-bridge/trigger.js'
import { LatencyDashboard } from './latency.js'
import { MiniCpmRealtimeClient, resolveMiniCpmRealtimeUrl } from './minicpm/realtime-client.js'

/**
 * 启动编排（默认 Brain A = 本机 Comni 真全双工）
 */
export async function startDuplexVoice(): Promise<void> {
  logEchoPolicy()

  const personaStyle = process.env.PERSONA_STYLE ?? 'lively'
  const companionPrompt = process.env.MINICPM_SYSTEM_PROMPT
    ?? buildCompanionSystemPrompt({
      style: personaStyle,
      fromPresets: true,
      tone: { tone: 'companion' },
    })

  console.info('[brain-a] True Full-Duplex · MiniCPM-o / Comni')
  console.info('[persona]', companionGreeting({ style: personaStyle }))
  console.info('[persona] style=', personaStyle, 'system_prompt_chars=', companionPrompt.length)

  const latency = new LatencyDashboard()
  const dryRun = process.env.DRY_RUN === '1'
  const tools = new GameTools({
    url: resolveAirWsUrl(),
    token: process.env.AIRI_TOKEN,
    dryRun,
    followPlayerName: process.env.FOLLOW_PLAYER_NAME,
    latency,
  })

  await tools.connect()

  const cooldownMs = Number(process.env.INTENT_COOLDOWN_MS ?? 1000)
  const companionCooldownMs = Number(process.env.COMPANION_COOLDOWN_MS ?? 4000)
  let lastCompanionAt = 0

  const bridge = new IntentBridge(async (intent) => {
    await latency.time('intent-bridge', async () => {
      console.info('[intent-bridge] matched', intent)
    }, intent.tool)
    await tools.execute(intent)
    latency.record('action', 0, `dispatched:${intent.tool}`)
  }, { cooldownMs })

  /**
   * 统一处理一句用户话（Comni 语音旁路 / 公网 Realtime / stdin 降级）
   *
   * @param text 用户文本
   * @param source 来源标签
   * @param allowCompanion 是否允许闲聊直达（Comni 碎片听写默认关，stdin 开）
   */
  async function handleUtterance(
    text: string,
    source: string,
    allowCompanion = true,
  ): Promise<void> {
    const trimmed = text.trim()
    if (!trimmed)
      return

    const before = Date.now()
    console.info(`[utterance] ${source}:`, trimmed)

    if (matchIntent(trimmed)) {
      bridge.ingestUtterance(trimmed)
      latency.record('intent-bridge', Date.now() - before, source)
      return
    }

    if (!allowCompanion)
      return

    const now = Date.now()
    if (now - lastCompanionAt < companionCooldownMs) {
      console.info('[persona] companion cooldown, skip')
      return
    }
    lastCompanionAt = now

    const advice = adviseCompanionTurn(trimmed, {
      style: personaStyle,
      tone: { tone: 'companion', player_text: trimmed },
    })
    const reply = composeCompanionReply(trimmed, {
      style: personaStyle,
      tone: { tone: 'companion', player_text: trimmed },
    })
    console.info('[persona] turn', {
      intent: advice.intent,
      disclosure: advice.disclosure.decision,
      topic_allow: advice.topic.allow,
      reply: reply.slice(0, 80),
      guidance: advice.turn_guidance.slice(0, 120),
    })
    await tools.executeCompanionChat(reply, trimmed)
    latency.record('intent-bridge', Date.now() - before, source)
  }

  const realtimeUrl = resolveMiniCpmRealtimeUrl()
  const comniBridge = shouldUseComniBridge(realtimeUrl)
  let mini: MiniCpmRealtimeClient | null = null
  let bridgeServer: ReturnType<typeof startBridgeHttp> | null = null

  if (comniBridge) {
    console.info('[brain-a] 模式=本机 Comni Audio Full-Duplex（浏览器听+说）')
    console.info('[brain-a] 打开 https://localhost:8006/audio_duplex ，戴耳机')
    bridgeServer = startBridgeHttp({
      onUtterance: async (payload) => {
        latency.record('minicpm-demo', 0, 'comni-listen')
        // Comni listen：优先工具；闲聊仅在 end_of_turn 时走，减少碎片刷屏
        const allowCompanion = payload.meta?.end_of_turn === true || /[。！？.!?]$/.test(payload.text)
        await handleUtterance(payload.text, payload.source ?? 'comni', allowCompanion)
      },
    })
  }
  else if (process.env.SKIP_MINICPM !== '1') {
    console.info('[brain-a] 模式=公网/远端 Realtime WS（旁路 text delta）', realtimeUrl)
    mini = new MiniCpmRealtimeClient({
      url: realtimeUrl,
      systemPrompt: companionPrompt,
      autoInit: true,
    })

    mini.on('text', (text, partial) => {
      latency.record('minicpm-demo', 0, partial ? 'text:partial' : 'text:final')
      if (partial)
        bridge.pushText(text, false)
      else
        void handleUtterance(text, 'minicpm-text')
    })

    mini.on('listen', () => {
      bridge.flush()
      latency.record('minicpm-demo', 0, 'listen')
    })

    mini.on('error', (err) => {
      console.error('[minicpm] error', err.message)
    })

    try {
      await latency.time('minicpm-demo', () => mini!.connect(), 'connect')
      console.info('[minicpm] connected', realtimeUrl)
    }
    catch (err) {
      console.error('[minicpm] 连接失败，降级为 HTTP 旁路 + stdin:', err)
      mini = null
      if (!bridgeServer) {
        bridgeServer = startBridgeHttp({
          onUtterance: async (payload) => {
            await handleUtterance(payload.text, payload.source ?? 'http')
          },
        })
      }
    }
  }
  else {
    console.info('[brain-a] SKIP_MINICPM=1 — 仅 stdin / HTTP（非真全双工听感）')
    bridgeServer = startBridgeHttp({
      onUtterance: async (payload) => {
        await handleUtterance(payload.text, payload.source ?? 'http')
      },
    })
  }

  if (comniBridge) {
    console.info('[duplex-voice] Brain A 主路径已就绪；stdin 仅作降级（打字指令）')
  }
  else {
    console.info('[duplex-voice] 就绪。stdin 可用；要本机真双流请改 MINICPM_REALTIME_URL 指向 :8006')
  }

  const rl = readline.createInterface({ input: process.stdin, output: process.stdout })
  rl.on('line', (line) => {
    void handleUtterance(line, 'stdin', true)
  })

  const shutdown = async () => {
    console.info('[duplex-voice] shutting down…')
    rl.close()
    bridgeServer?.close()
    await mini?.close()
    await tools.disconnect()
    process.exit(0)
  }

  process.on('SIGINT', () => {
    void shutdown()
  })
  process.on('SIGTERM', () => {
    void shutdown()
  })
}
