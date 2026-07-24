/**
 * @file 经 AIRI 下发 spark:command（可选依赖 @proj-airi/server-sdk）
 *
 * 独立安装时可不装整个 monorepo：默认 DRY_RUN 即可验证 Intent Bridge。
 * 完整联调需仓库根 `pnpm i` 成功后，本包能 resolve 到 workspace 的 server-sdk。
 */

import type { LatencyDashboard } from '../latency.js'
import type { IntentCandidate } from '../types.js'

import process from 'node:process'

import { nanoid } from 'nanoid'

export interface GameToolsOptions {
  url: string
  token?: string
  dryRun?: boolean
  followPlayerName?: string
  latency?: LatencyDashboard
}

interface AiriClientLike {
  connect: () => Promise<void>
  close: () => void
  send: (event: unknown) => boolean
}

/**
 * Minecraft 工具执行面
 */
export class GameTools {
  private client: AiriClientLike | null = null
  private dryRun: boolean
  private readonly followPlayerName: string

  constructor(private readonly options: GameToolsOptions) {
    this.dryRun = options.dryRun ?? process.env.DRY_RUN === '1'
    this.followPlayerName = options.followPlayerName ?? process.env.FOLLOW_PLAYER_NAME ?? 'Steve'
  }

  /**
   * 连接 AIRI（DRY_RUN 时跳过；无 server-sdk 时自动降级 dry-run）
   */
  async connect(): Promise<void> {
    if (this.dryRun) {
      console.info('[game-tools] DRY_RUN=1，跳过 AIRI 连接（只打印工具调用）')
      return
    }

    try {
      const sdk = await loadServerSdk()
      this.client = new sdk.Client({
        name: 'hackathon-duplex-voice',
        url: this.options.url,
        token: this.options.token,
        autoConnect: false,
      })
      await this.client.connect()
      console.info('[game-tools] connected to AIRI', this.options.url)
    }
    catch (err) {
      console.warn('[game-tools] 无法加载 @proj-airi/server-sdk，自动降级为 DRY_RUN。', err)
      console.warn('[game-tools] 请先在仓库根关掉 VPN/代理后执行 pnpm i，再设 DRY_RUN=0 重试。')
      this.dryRun = true
    }
  }

  /**
   * 断开
   */
  async disconnect(): Promise<void> {
    if (!this.client)
      return
    this.client.close()
    this.client = null
  }

  /**
   * 执行意图 → spark:command（附带 directAction 快路径，绕过 Bot LLM）
   * @param intent 意图
   */
  async execute(intent: IntentCandidate): Promise<void> {
    const run = async () => {
      const commandId = nanoid()
      const interrupt = intent.tool === 'stop' ? 'force' as const : false
      const intentKind = intent.tool === 'stop' ? 'pause' as const : 'action' as const
      const label = this.buildLabel(intent)
      const steps = this.buildSteps(intent)
      const directAction = this.buildDirectAction(intent)

      const payload = {
        type: 'spark:command' as const,
        data: {
          id: nanoid(),
          commandId,
          interrupt,
          priority: intent.tool === 'stop' ? 'critical' as const : 'high' as const,
          intent: intentKind,
          destinations: [process.env.AIRI_MINECRAFT_DEST ?? '*'],
          // NOTICE: Bot AiriBridge 识别此字段后直达 TaskExecutor，跳过 Conscious LLM。
          ...(directAction ? { directAction } : {}),
          guidance: {
            type: 'instruction' as const,
            options: [
              {
                label,
                steps,
                risk: 'low' as const,
              },
            ],
          },
        },
      }

      console.info('[game-tools] invoke', {
        tool: intent.tool,
        label,
        dryRun: this.dryRun,
        commandId,
        directAction: directAction?.tool ?? null,
      })

      if (this.dryRun)
        return

      if (!this.client)
        throw new Error('GameTools not connected')

      const ok = this.client.send(payload)
      if (!ok)
        throw new Error('AIRI send() returned false (not ready)')
    }

    if (this.options.latency)
      await this.options.latency.time('tool', run, intent.tool)
    else
      await run()
  }

  /**
   * 文本降级：把原句作为 directive（无 chatMessage 时仍走 LLM，易被 skip）
   * @param text 用户文本
   */
  async executeRawDirective(text: string): Promise<void> {
    await this.execute({
      tool: 'say',
      label: text.trim(),
      confidence: 0.5,
      rawText: text,
      t_ms: Date.now(),
    })
  }

  /**
   * 陪伴闲聊：Bot 直接 `chat` 说出已编排回复（跳过 Conscious LLM）
   * @param reply 游戏内聊天文本
   * @param rawText 玩家原话
   */
  async executeCompanionChat(reply: string, rawText: string): Promise<void> {
    const message = reply.trim()
    if (!message)
      return

    await this.execute({
      tool: 'say',
      label: message,
      confidence: 0.9,
      rawText: rawText.trim() || message,
      t_ms: Date.now(),
      chatMessage: message,
    })
  }

  private buildLabel(intent: IntentCandidate): string {
    if (intent.tool === 'follow')
      return `跟我来（跟随玩家 ${this.followPlayerName}）`
    return intent.label
  }

  private buildSteps(intent: IntentCandidate): string[] {
    switch (intent.tool) {
      case 'follow':
        return [`跟随玩家 ${this.followPlayerName}`, '保持约 2 格距离']
      case 'stop':
        return ['立即停止当前移动与任务', '等待新指令']
      case 'move':
        return ['移动到玩家附近或指示位置']
      case 'jump':
        return ['原地跳跃两次']
      case 'idleDevelopOn':
        return ['开启空闲自主发育', '无人指令时自行砍树/合成']
      case 'idleDevelopOff':
        return ['关闭空闲自主发育', '仅执行玩家指令']
      case 'collect':
        return ['采集附近可收集资源']
      case 'interact':
        return ['与附近方块或实体交互']
      case 'say':
        return [intent.chatMessage ?? intent.rawText]
      default:
        return [intent.label]
    }
  }

  /**
   * 将 Intent Bridge 工具映射为 Bot 侧可直达的 ActionRegistry 工具。
   * collect / interact / 无 chatMessage 的 say 仍走 LLM。
   */
  private buildDirectAction(intent: IntentCandidate): { tool: string, params?: Record<string, unknown> } | null {
    switch (intent.tool) {
      case 'follow':
        return {
          tool: 'followPlayer',
          params: { player_name: this.followPlayerName, follow_dist: 2 },
        }
      case 'stop':
        return { tool: 'stopBundle', params: {} }
      case 'move':
        return {
          tool: 'goToPlayer',
          params: { player_name: this.followPlayerName, closeness: 2 },
        }
      case 'jump':
        return { tool: 'jump', params: {} }
      case 'idleDevelopOn':
        return { tool: 'idleDevelopEnable', params: {} }
      case 'idleDevelopOff':
        return { tool: 'idleDevelopDisable', params: {} }
      case 'say':
        if (intent.chatMessage) {
          return {
            tool: 'chat',
            params: { message: intent.chatMessage, feedback: false },
          }
        }
        return null
      default:
        return null
    }
  }
}

/**
 * 加载 server-sdk：优先 workspace 包名，失败则回退 monorepo dist 路径
 */
async function loadServerSdk(): Promise<{
  Client: new (opts: Record<string, unknown>) => AiriClientLike
}> {
  try {
    return await import('@proj-airi/server-sdk') as {
      Client: new (opts: Record<string, unknown>) => AiriClientLike
    }
  }
  catch {
    // NOTICE:
    // Why: hackathon 子包有时尚未 link 到 workspace 的 @proj-airi/server-sdk。
    // Root cause: duplex-voice 独立 npm install 或 pnpm 未把 workspace 依赖链上。
    // Source: packages/server-sdk/dist/index.mjs
    // Removal: 当 workspace 依赖稳定可 resolve 后删除此回退。
    return await import('../../../packages/server-sdk/dist/index.mjs') as {
      Client: new (opts: Record<string, unknown>) => AiriClientLike
    }
  }
}

/**
 * 解析 AIRI URL
 */
export function resolveAirWsUrl(): string {
  return process.env.AIRI_WS_URL ?? 'ws://127.0.0.1:6121/ws'
}
