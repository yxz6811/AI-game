/**
 * 玩家连击 / 仇杀判定：发育期间被反复打时打断并反击；
 * 被玩家打死后仇恨跨死亡保留，重生后继续复仇。
 */

/** 统计连击的时间窗（ms） */
export const PLAYER_HIT_WINDOW_MS = 10_000

/** 窗内达到该次数则视为「一直在打」 */
export const PLAYER_HIT_THRESHOLD = 3

/** 反击最长持续时间（ms）；创造模式玩家杀不死，必须有上限 */
export const RETALIATION_MAX_MS = 12_000

/** 死亡归因：多久内的玩家伤害仍算「被该玩家打死」 */
export const KILL_ATTRIBUTION_MS = 8_000

/** 仇杀原因 */
export type VendettaReason = 'aggression' | 'killed'

/** 跨死亡保留的仇杀目标 */
export interface PlayerVendetta {
  username: string
  reason: VendettaReason
  /** 记仇时间 */
  at: number
}

/**
 * 记录一次命中并裁剪过期时间戳。
 *
 * @param hits 历史命中时间戳
 * @param now 当前时间
 * @param windowMs 窗口
 */
export function recordPlayerHit(
  hits: number[],
  now: number,
  windowMs: number = PLAYER_HIT_WINDOW_MS,
): number[] {
  return [...hits.filter(t => now - t < windowMs), now]
}

/**
 * 是否已构成反复攻击。
 *
 * @param hits 窗内命中时间戳
 * @param threshold 阈值
 */
export function isRepeatedPlayerAggression(
  hits: number[],
  threshold: number = PLAYER_HIT_THRESHOLD,
): boolean {
  return hits.length >= threshold
}

/**
 * 根据近期攻击者推断是否应记「被玩家打死」的仇。
 *
 * @param lastAttacker 最近一次打过 bot 的玩家
 * @param now 当前时间
 * @param attributionMs 归因窗口
 */
export function resolveKillVendetta(
  lastAttacker: { username: string, at: number } | null,
  now: number,
  attributionMs: number = KILL_ATTRIBUTION_MS,
): PlayerVendetta | null {
  if (!lastAttacker?.username)
    return null
  if (now - lastAttacker.at > attributionMs)
    return null
  return {
    username: lastAttacker.username,
    reason: 'killed',
    at: now,
  }
}

/**
 * 死亡台词。
 *
 * @param username 凶手
 */
export function deathVendettaLine(username: string): string {
  return `${username}，你把我弄死了？等我复活再跟你算账！`
}

/**
 * 重生后复仇台词。
 *
 * @param username 仇人
 * @param reason 仇杀原因
 */
export function respawnVendettaLine(username: string, reason: VendettaReason): string {
  if (reason === 'killed')
    return `${username}，我回来了！弄死我的账，现在就还！`
  return `${username}，还想打我？看招！`
}
