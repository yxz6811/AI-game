import type { Logg } from '@guiiai/logg'

import type { TaskExecutor } from '../action/task-executor'
import type { MineflayerWithAgents } from '../types'
import type { PlayerVendetta, VendettaReason } from './player-aggression'
import type { DevelopGoal } from './policy'

import { env } from 'node:process'

import { craftPlanksFromLog } from '../../skills/actions/craft-planks-from-log'
import { grantItemInCreative, isCreativeMode } from '../../skills/actions/creative-grant'
import { gatherCobblestone, getCobbleCount } from '../../skills/actions/gather-cobblestone'
import { gatherResource, getItemCountByNames } from '../../skills/actions/gather-resource'
import { gatherWood, getLogsCount } from '../../skills/actions/gather-wood'
import { attackEntity } from '../../skills/combat'
import { getInventoryCounts } from '../../skills/world'
import { countWoodLogs, isWoodLogItem } from './inventory'
import {
  deathVendettaLine,
  isRepeatedPlayerAggression,
  recordPlayerHit,
  resolveKillVendetta,
  respawnVendettaLine,
  RETALIATION_MAX_MS,
} from './player-aggression'
import { selectNextDevelopGoal } from './policy'

/**
 * 是否从环境变量默认开启空闲发育。
 * 默认关闭，避免打断既有「跟随」演示；聊天「自己去发育」或 env=true 开启。
 */
export function resolveIdleDevelopEnabledByEnv(): boolean {
  const raw = env.IDLE_DEVELOP_ENABLED
  if (raw == null || raw === '')
    return false
  return /^(?:1|true|yes|on)$/i.test(raw.trim())
}

export interface IdleDevelopLoopDeps {
  taskExecutor: TaskExecutor
  logger: Logg
  /** 空闲多久后才开始下一目标（ms） */
  idleMs?: number
  /** 轮询间隔（ms） */
  tickMs?: number
  /** 玩家打断后冷却（ms） */
  interruptCooldownMs?: number
  /** 是否在游戏内 chat 播报当前目标 */
  announce?: boolean
}

export type IdleDevelopState = 'disabled' | 'idle' | 'running' | 'cooldown'

/**
 * 空闲发育循环：无玩家指令、无跟随、无在飞行动作时，按早期生存链推进。
 *
 * 挂载点：CognitiveEngine；不进 Conscious LLM，直接走 TaskExecutor / gatherWood。
 * 抢占：follow / stop / 玩家聊天活动会 pause + cooldown。
 * 玩家连击伤害：10s 内 ≥3 次则打断发育并对玩家限时反击，避免拒战死循环。\n * 被玩家打死：仇恨跨死亡保留，重生后台词复仇。
 */
export class IdleDevelopLoop {
  private bot: MineflayerWithAgents | null = null
  private timer: ReturnType<typeof setInterval> | null = null
  private enabled: boolean
  private busy = false
  private lastPlayerActivityAt = 0
  private cooldownUntil = 0
  private currentGoalId: string | null = null
  /** 上次已播报的目标，避免失败重试刷屏 */
  private lastAnnouncedGoalId: string | null = null
  /** 同一目标连续失败次数 */
  private failureStreak = 0
  private lastFailedGoalId: string | null = null
  /** 发育期间玩家命中时间戳（连击判定；死亡不清空） */
  private playerHitAt: number[] = []
  /** 最近打过 bot 的玩家（死亡归因；死亡不清空） */
  private lastPlayerAttacker: { username: string, at: number } | null = null
  /**
   * 跨死亡保留的仇杀。
   * NOTICE: disable/death 不得清空，否则被打死就「仇恨清零」。
   */
  private pendingVendetta: PlayerVendetta | null = null
  /** 正在反击，跳过发育 tick */
  private retaliating = false
  private readonly idleMs: number
  private readonly tickMs: number
  private readonly interruptCooldownMs: number
  private readonly announce: boolean

  /** entityHurt 监听（箭头函数便于 on/off 同一引用） */
  private readonly onEntityHurt = (victim: { id?: number }, source: { type?: string, username?: string } | null): void => {
    const bot = this.bot
    if (!bot || this.retaliating)
      return
    const self = bot.bot.entity
    if (!victim || !self || victim.id !== self.id)
      return
    if (source?.type !== 'player')
      return
    const name = source.username?.trim()
    if (!name)
      return
    // 无论是否在发育，都记最近攻击者，供死亡归因
    this.lastPlayerAttacker = { username: name, at: Date.now() }
    if (this.enabled)
      this.notePlayerDamage(name)
  }

  private readonly onDeath = (): void => {
    this.notePlayerKillDeath(Date.now())
  }

  private readonly onSpawn = (): void => {
    this.noteRespawnAfterVendetta()
  }

  constructor(
    private readonly deps: IdleDevelopLoopDeps,
    enabledByDefault = resolveIdleDevelopEnabledByEnv(),
  ) {
    this.enabled = enabledByDefault
    this.idleMs = deps.idleMs ?? 8_000
    this.tickMs = deps.tickMs ?? 2_000
    this.interruptCooldownMs = deps.interruptCooldownMs ?? 15_000
    this.announce = deps.announce ?? true
  }

  /** 当前是否开启。 */
  public isEnabled(): boolean {
    return this.enabled
  }

  /** 当前目标 id（调试用）。 */
  public getCurrentGoalId(): string | null {
    return this.currentGoalId
  }

  /**
   * 粗粒度状态，便于 debug / 测试。
   */
  public getState(): IdleDevelopState {
    if (!this.enabled)
      return 'disabled'
    if (Date.now() < this.cooldownUntil)
      return 'cooldown'
    if (this.busy || this.retaliating)
      return 'running'
    return 'idle'
  }

  /**
   * 绑定 bot 并开始轮询。可重复调用（幂等）。
   *
   * @param bot MineflayerWithAgents
   */
  public start(bot: MineflayerWithAgents): void {
    if (this.bot && this.bot !== bot)
      this.detachLifecycleListeners(this.bot)

    this.bot = bot
    this.lastPlayerActivityAt = Date.now()
    this.attachLifecycleListeners(bot)

    if (this.timer)
      return

    this.timer = setInterval(() => {
      void this.tick()
    }, this.tickMs)

    this.deps.logger.withFields({ enabled: this.enabled }).log('IdleDevelopLoop started')
  }

  /** 停止轮询并解绑 bot。 */
  public stop(): void {
    if (this.timer) {
      clearInterval(this.timer)
      this.timer = null
    }
    if (this.bot)
      this.detachLifecycleListeners(this.bot)
    this.bot = null
    this.busy = false
    this.retaliating = false
    this.currentGoalId = null
    this.playerHitAt = []
    this.lastPlayerAttacker = null
    this.pendingVendetta = null
  }

  /**
   * 开启空闲发育。
   *
   * @param announce 是否在游戏内提示
   */
  public enable(announce = true): void {
    this.enabled = true
    this.cooldownUntil = 0
    this.failureStreak = 0
    this.lastFailedGoalId = null
    this.lastAnnouncedGoalId = null
    this.retaliating = false
    // 仇恨/仇杀跨会话保留；仅重置发育调度
    // 立即允许下一 tick 开工（不等 idleMs）
    this.lastPlayerActivityAt = Date.now() - this.idleMs
    if (announce)
      this.chat('好，我先不跟着了，自己去发育。')
    this.deps.logger.log('IdleDevelopLoop enabled')
  }

  /**
   * 关闭空闲发育（不打断当前动作；调用方应先 interrupt）。
   *
   * @param announce 是否在游戏内提示
   */
  public disable(announce = true): void {
    this.enabled = false
    this.currentGoalId = null
    // NOTICE: 不清理 playerHitAt / pendingVendetta，避免死亡或停发育后仇恨清零
    if (announce)
      this.chat('好，我不自己乱动了，等你指令。')
    this.deps.logger.log('IdleDevelopLoop disabled')
  }

  /**
   * 标记玩家活动（聊天 / 语音指令），推迟下一次自主目标。
   */
  public notePlayerActivity(): void {
    this.lastPlayerActivityAt = Date.now()
  }

  /**
   * 玩家抢占：进入冷却，清除当前目标标记。
   * 实际 stopDigging / pathfinder 由外层 `bot.interrupt` 负责。
   *
   * @param reason 日志原因
   */
  public onInterrupted(reason: string): void {
    this.cooldownUntil = Date.now() + this.interruptCooldownMs
    this.currentGoalId = null
    this.busy = false
    this.lastPlayerActivityAt = Date.now()
    this.deps.logger.withFields({ reason }).log('IdleDevelopLoop interrupted')
  }

  /**
   * 发育开启时记录玩家伤害；连击达阈值则打断发育并反击。
   * 供单测直接调用；运行时由 entityHurt 触发。
   *
   * @param attackerUsername 攻击者游戏名
   * @param now 当前时间（可注入）
   * @returns 是否已触发反击
   */
  public notePlayerDamage(attackerUsername: string, now: number = Date.now()): boolean {
    if (!attackerUsername)
      return false

    this.lastPlayerAttacker = { username: attackerUsername, at: now }

    if (!this.enabled || this.retaliating)
      return false

    this.playerHitAt = recordPlayerHit(this.playerHitAt, now)
    this.deps.logger.withFields({
      attackerUsername,
      hits: this.playerHitAt.length,
    }).log('IdleDevelopLoop player hit while developing')

    if (!isRepeatedPlayerAggression(this.playerHitAt))
      return false

    this.pendingVendetta = {
      username: attackerUsername,
      reason: 'aggression',
      at: now,
    }
    // 同步置位，防止连击包同时触发多次反击
    this.retaliating = true
    void this.retaliateAgainstPlayer(attackerUsername, 'aggression')
    return true
  }

  /**
   * 死亡时：若近期被玩家打过，记仇并喊话（仇恨不清零）。
   *
   * @param now 当前时间
   * @returns 是否记上了被杀之仇
   */
  public notePlayerKillDeath(now: number = Date.now()): boolean {
    const fromRecent = resolveKillVendetta(this.lastPlayerAttacker, now)
    if (!fromRecent && !this.pendingVendetta)
      return false

    if (fromRecent) {
      this.pendingVendetta = fromRecent
      this.chat(deathVendettaLine(fromRecent.username))
      this.deps.logger.withFields({ username: fromRecent.username }).log('IdleDevelopLoop vendetta on death')
    }
    else if (this.pendingVendetta) {
      // 已有连击仇杀，死亡时补一句
      this.chat(deathVendettaLine(this.pendingVendetta.username))
      this.pendingVendetta = {
        ...this.pendingVendetta,
        reason: 'killed',
        at: now,
      }
    }

    // 停发育但不清仇恨
    if (this.enabled)
      this.disable(false)
    this.onInterrupted('killed by player')
    this.retaliating = false
    this.busy = false
    return true
  }

  /**
   * 重生后：若有未了之仇，台词 + 限时复仇。
   *
   * @returns 是否开始复仇
   */
  public noteRespawnAfterVendetta(): boolean {
    const vendetta = this.pendingVendetta
    if (!vendetta || this.retaliating)
      return false

    this.retaliating = true
    void this.retaliateAgainstPlayer(vendetta.username, vendetta.reason)
    return true
  }

  /** 测试/调试：当前仇杀目标 */
  public getPendingVendetta(): PlayerVendetta | null {
    return this.pendingVendetta
  }

  /**
   * 单次 tick：供测试直接调用；生产由 setInterval 驱动。
   */
  public async tick(): Promise<void> {
    if (!this.enabled || this.busy || this.retaliating || !this.bot)
      return

    const now = Date.now()
    if (now < this.cooldownUntil)
      return

    if (now - this.lastPlayerActivityAt < this.idleMs)
      return

    const snapshot = this.bot.reflexManager?.getContextSnapshot?.()
    // 发育优先于跟随：若仍挂着 follow，先摘掉再干活（避免 enable 后站着不动）
    if (snapshot?.autonomy?.followActive)
      this.bot.reflexManager?.clearFollowTarget?.()

    if (snapshot?.autonomy?.reflexEngaged)
      return

    const counts = getInventoryCounts(this.bot)
    let goal = selectNextDevelopGoal(counts)
    if (!goal)
      return

    // craft_planks 连败：只有真的缺木头才回去砍；已有木头则拉长冷却，避免空转刷屏
    if (
      goal.id === 'craft_planks'
      && this.lastFailedGoalId === 'craft_planks'
      && this.failureStreak >= 1
    ) {
      const logs = countWoodLogs(counts)
      if (logs < 3) {
        goal = {
          id: 'gather_wood',
          label: '木头不够，再砍一点',
          kind: 'gather_wood',
          // 绝对持有目标 = 当前 + 增量，避免已有 7 根时 gatherWood(4) 瞬间返回
          count: logs + 4,
        }
      }
      else {
        this.cooldownUntil = Date.now() + 25_000
        if (this.announce)
          this.chat('（自己发育）手里有木头但合成失败，先歇一会')
        this.deps.logger.withFields({ logs, failureStreak: this.failureStreak }).warn('IdleDevelopLoop: craft_planks stuck, cooling down')
        return
      }
    }

    this.busy = true
    this.currentGoalId = goal.id
    try {
      if (this.announce && this.lastAnnouncedGoalId !== goal.id) {
        this.chat(`（自己发育）${goal.label}`)
        this.lastAnnouncedGoalId = goal.id
      }

      this.deps.logger.withFields({ goalId: goal.id, label: goal.label }).log('IdleDevelopLoop running goal')
      await this.executeGoal(goal)
      this.failureStreak = 0
      this.lastFailedGoalId = null
    }
    catch (error) {
      this.deps.logger.withError(error as Error).warn('IdleDevelopLoop goal failed')
      if (this.lastFailedGoalId === goal.id) {
        this.failureStreak += 1
      }
      else {
        this.lastFailedGoalId = goal.id
        this.failureStreak = 1
      }
      // 失败冷却；连败加长，减轻刷屏
      const cooldown = this.failureStreak >= 2 ? 20_000 : 8_000
      this.cooldownUntil = Date.now() + Math.min(this.interruptCooldownMs, cooldown)
    }
    finally {
      this.busy = false
      this.currentGoalId = null
      this.lastPlayerActivityAt = Date.now()
    }
  }

  private async executeGoal(goal: DevelopGoal): Promise<void> {
    const bot = this.bot
    if (!bot)
      return

    // 采集类会与 auto-follow 抢 pathfinder；先摘掉跟随
    if (goal.kind === 'gather_wood' || goal.kind === 'collect')
      bot.reflexManager?.clearFollowTarget?.()

    if (goal.kind === 'gather_wood') {
      const current = getLogsCount(bot)
      // goal.count：策略层给的是期望持有总量；若误传成很小的数，至少再砍 2 根
      const target = Math.max(goal.count, current + 2)
      await gatherWood(bot, target, 64, { quiet: true })
      return
    }

    if (goal.id === 'gather_cobblestone') {
      const current = getCobbleCount(bot)
      const target = Math.max(goal.count, current + 4)
      await gatherCobblestone(bot, target, { quiet: true, maxDistance: 48 })
      return
    }

    if (goal.id === 'gather_coal') {
      await gatherResource(bot, {
        blockType: 'coal',
        inventoryItems: ['coal', 'charcoal'],
        amount: goal.count,
        creativeItem: 'coal',
        maxDistance: 48,
      })
      return
    }

    if (goal.id === 'gather_iron') {
      // 现代版本挖铁矿掉 raw_iron；创造模式无掉落则补 raw_iron
      await gatherResource(bot, {
        blockType: 'iron',
        inventoryItems: ['raw_iron', 'iron_ore'],
        amount: goal.count,
        creativeItem: 'raw_iron',
        maxDistance: 48,
        searchRounds: 6,
      })
      return
    }

    if (goal.id === 'gather_diamond') {
      await gatherResource(bot, {
        blockType: 'diamond',
        inventoryItems: ['diamond'],
        amount: goal.count,
        creativeItem: 'diamond',
        maxDistance: 64,
        searchRounds: 6,
      })
      return
    }

    if (goal.kind === 'collect' && goal.item) {
      await this.deps.taskExecutor.executeActionWithResult({
        tool: 'collectBlocks',
        params: { type: goal.item, num: goal.count },
      })
      return
    }

    if (goal.kind === 'smelt' && goal.item) {
      await this.smeltWithCreativeFastPath(goal.item, goal.count)
      return
    }

    if (goal.kind === 'craft' && goal.item) {
      if (goal.id === 'craft_planks') {
        await this.craftAnyAvailablePlanks()
        return
      }
      await this.deps.taskExecutor.executeActionWithResult({
        tool: 'craftRecipe',
        params: { recipe_name: goal.item, num: goal.count },
      })
    }
  }

  /**
   * 冶炼；创造模式下有熔炉+燃料时直接补成品，避免演示卡在烤炉等待。
   *
   * NOTICE:
   * Why: 烤满 33 铁锭约需数分钟，演示服 creative 下炉子虽可用但太慢。
   * Removal: 演示服改 survival 且可接受等待后删除 fast-path。
   *
   * @param itemName 输入物（如 raw_iron）
   * @param num 冶炼次数
   */
  private async smeltWithCreativeFastPath(itemName: string, num: number): Promise<void> {
    const bot = this.bot
    if (!bot)
      return

    if (itemName === 'raw_iron' && isCreativeMode(bot)) {
      const counts = getInventoryCounts(bot)
      const hasFurnace = (counts.furnace ?? 0) > 0
      const hasFuel = (counts.coal ?? 0) + (counts.charcoal ?? 0) > 0
      if (hasFurnace && hasFuel) {
        const have = getItemCountByNames(bot, ['iron_ingot'])
        const raw = getItemCountByNames(bot, ['raw_iron'])
        const grant = Math.min(num, Math.max(raw, num))
        await grantItemInCreative(bot, 'iron_ingot', have + grant)
        this.deps.logger.withFields({ grant, have }).log('IdleDevelopLoop creative smelt fast-path → iron_ingot')
        return
      }
    }

    await this.deps.taskExecutor.executeActionWithResult({
      tool: 'smeltItem',
      params: { item_name: itemName, num },
    })
  }

  /**
   * 按库存里实际有的原木种类逐个尝试合成木板。
   * 去皮原木走 {@link craftPlanksFromLog}，避免 recipesFor/planRecipe 不认 stripped_*。
   */
  private async craftAnyAvailablePlanks(): Promise<void> {
    const bot = this.bot
    if (!bot)
      return

    const counts = getInventoryCounts(bot)
    const candidates = Object.entries(counts)
      .filter(([name, n]) => isWoodLogItem(name) && n > 0)
      .map(([name, n]) => ({ logName: name, logCount: n }))
      .sort((a, b) => b.logCount - a.logCount)

    if (candidates.length === 0)
      throw new Error('No wood logs in inventory to craft planks')

    let lastError: unknown
    for (const candidate of candidates) {
      try {
        this.deps.logger.withFields(candidate).log('IdleDevelopLoop crafting planks from log')
        await craftPlanksFromLog(bot, candidate.logName, 1)
        return
      }
      catch (error) {
        lastError = error
        this.deps.logger.withFields({ logName: candidate.logName }).warn('IdleDevelopLoop planks craft failed, trying next')
      }
    }

    throw lastError instanceof Error ? lastError : new Error(String(lastError))
  }

  private chat(message: string): void {
    try {
      this.bot?.bot.chat(message)
    }
    catch {
      // 播报失败不影响发育主路径
    }
  }

  private attachLifecycleListeners(bot: MineflayerWithAgents): void {
    try {
      bot.bot.on('entityHurt', this.onEntityHurt)
      bot.bot.on('death', this.onDeath)
      bot.bot.on('spawn', this.onSpawn)
    }
    catch {
      // 绑定失败时连击/仇杀不可用，但不影响发育主路径
    }
  }

  private detachLifecycleListeners(bot: MineflayerWithAgents): void {
    try {
      bot.bot.off('entityHurt', this.onEntityHurt)
      bot.bot.off('death', this.onDeath)
      bot.bot.off('spawn', this.onSpawn)
    }
    catch {
      // ignore
    }
  }

  /**
   * 对玩家发起限时反击（创造模式杀不死，必须有超时）。
   * 成功打完后才清 pendingVendetta；中途死亡保留仇恨供重生继续。
   *
   * @param username 攻击者用户名
   * @param reason 台词用原因
   */
  private async retaliateAgainstPlayer(
    username: string,
    reason: VendettaReason = 'aggression',
  ): Promise<void> {
    const bot = this.bot
    if (!bot) {
      this.retaliating = false
      return
    }

    this.retaliating = true
    this.busy = false
    this.currentGoalId = null
    let completed = false

    try {
      if (this.enabled)
        this.disable(false)
      this.onInterrupted(reason === 'killed' ? 'vendetta after death' : 'player aggression')
      bot.reflexManager?.clearFollowTarget?.()
      try {
        bot.interrupt('player vendetta — retaliate')
      }
      catch {
        // interrupt 失败仍尝试还手
      }

      if (reason === 'killed')
        this.chat(respawnVendettaLine(username, reason))
      else
        this.chat(`（自己发育）你一直打我，发育先停了，我要还手了！`)
      this.deps.logger.withFields({ username, reason }).log('IdleDevelopLoop retaliating against player')

      // 重生后实体可能稍晚才可见，短暂重试
      let entity = bot.bot.players[username]?.entity
      for (let i = 0; i < 10 && !entity; i++) {
        await new Promise(resolve => setTimeout(resolve, 300))
        entity = bot.bot.players[username]?.entity
      }
      if (!entity) {
        this.deps.logger.withFields({ username }).warn('IdleDevelopLoop: attacker entity not found (vendetta kept)')
        return
      }

      // NOTICE: 不用 kill=true 的死等循环——创造模式玩家永不消失会卡死。
      const pvp = bot.bot.pvp
      if (!pvp) {
        await attackEntity(bot, entity, false)
        completed = true
        return
      }

      await attackEntity(bot, entity, false).catch(() => undefined)
      pvp.attack(entity)
      const deadline = Date.now() + RETALIATION_MAX_MS
      while (Date.now() < deadline) {
        if (!this.bot)
          break
        const stillThere = bot.bot.players[username]?.entity
        if (!stillThere)
          break
        await new Promise(resolve => setTimeout(resolve, 400))
      }
      try {
        pvp.stop()
      }
      catch {
        // ignore
      }
      completed = true
    }
    catch (error) {
      this.deps.logger.withError(error as Error).warn('IdleDevelopLoop retaliation failed')
    }
    finally {
      this.retaliating = false
      // 打完才清仇；中途死亡/找不到人则保留，重生再打
      if (completed && this.pendingVendetta?.username === username)
        this.pendingVendetta = null
    }
  }
}

/**
 * 匹配游戏内开启/关闭空闲发育的短指令。
 *
 * @param message 玩家聊天原文
 */
export function matchIdleDevelopCommand(message: string): 'enable' | 'disable' | null {
  const t = message.trim()
  if (!t)
    return null
  if (/别自己(?:动|玩|发育)|不要自己|停止发育|别发育了|听话点|听我的|\bidle\s*off\b/i.test(t))
    return 'disable'
  if (/自己去发育|自己发育|自主发育|去发育吧|去发育|\bidle\s*on\b|\bauto\s*develop\b/i.test(t))
    return 'enable'
  return null
}
