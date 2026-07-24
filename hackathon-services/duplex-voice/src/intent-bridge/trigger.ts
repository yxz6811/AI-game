/**
 * @file Intent Bridge 规则闸门：从旁路文本匹配游戏意图
 */

import type { GameToolName, IntentCandidate } from '../types.js'

interface Rule {
  tool: GameToolName
  /** 匹配用户或模型转写文本 */
  patterns: RegExp[]
  /** spark guidance label */
  label: string | ((match: RegExpMatchArray, raw: string) => string)
  confidence: number
}

const RULES: Rule[] = [
  // NOTICE: 必须排在 stop 之前——否则「别自己动」会被 /别动/ 误判成 stop。
  {
    tool: 'idleDevelopOff',
    patterns: [/别自己(动|玩|发育)/, /不要自己/, /停止发育/, /别发育了/, /听话点/, /听我的/, /\bidle\s*off\b/i],
    label: '别自己动',
    confidence: 0.96,
  },
  {
    tool: 'idleDevelopOn',
    patterns: [/自己去发育/, /自己发育/, /自主发育/, /去发育吧/, /去发育/, /\bidle\s*on\b/i, /\bauto\s*develop\b/i],
    label: '自己去发育',
    confidence: 0.96,
  },
  {
    tool: 'stop',
    patterns: [/停下/, /停止/, /停一下/, /别动/, /别跟/, /不跟了/, /站住/, /取消/, /回来/, /等等/, /\bstop\b/i, /\bhalt\b/i, /\bcancel\b/i],
    label: '停下',
    confidence: 0.95,
  },
  {
    tool: 'jump',
    patterns: [/跳一跳/, /跳一下/, /跳跃/, /\bjump\b/i],
    label: '跳一跳',
    confidence: 0.95,
  },
  {
    tool: 'follow',
    patterns: [/跟我来/, /跟着我/, /过来跟/, /过来/, /到这里/, /来这边/, /come\s*here/i, /follow\s*me/i],
    label: '跟我来',
    confidence: 0.95,
  },
  {
    tool: 'move',
    patterns: [/走到这/, /去那边/, /go\s*there/i],
    label: '到这里',
    confidence: 0.85,
  },
  {
    tool: 'collect',
    patterns: [/捡起来/, /采集/, /收集/, /挖一点/, /collect/i, /mine\b/i],
    label: '采集附近资源',
    confidence: 0.8,
  },
  {
    tool: 'interact',
    patterns: [/开门/, /交互/, /用一下/, /interact/i, /open\s*the\s*door/i],
    label: '交互',
    confidence: 0.8,
  },
]

/**
 * 对一段文本做规则意图检测（取第一条命中，stop 优先已由 RULES 顺序保证）
 * @param rawText 旁路文本（用户 ASR 或模型复述均可）
 * @param t_ms 时间戳
 */
export function matchIntent(rawText: string, t_ms = Date.now()): IntentCandidate | null {
  const text = rawText.trim()
  if (!text)
    return null

  for (const rule of RULES) {
    for (const pattern of rule.patterns) {
      const m = text.match(pattern)
      if (!m)
        continue
      const label = typeof rule.label === 'function' ? rule.label(m, text) : rule.label
      return {
        tool: rule.tool,
        label,
        confidence: rule.confidence,
        rawText: text,
        t_ms,
      }
    }
  }
  return null
}

/**
 * 从增量文本流中做防抖匹配：仅在「静默间隔」或显式 flush 时结算
 */
export class IntentBridge {
  private buffer = ''
  private lastEmitAt = 0
  private readonly cooldownMs: number
  private readonly onIntent: (intent: IntentCandidate) => void | Promise<void>

  constructor(
    onIntent: (intent: IntentCandidate) => void | Promise<void>,
    options?: { cooldownMs?: number },
  ) {
    this.onIntent = onIntent
    this.cooldownMs = options?.cooldownMs ?? 2500
  }

  /**
   * 喂入文本（partial 或 final）
   * @param text 增量或整句
   * @param isFinal 是否一句结束
   */
  pushText(text: string, isFinal = false): void {
    this.buffer += text
    if (isFinal)
      this.flush()
  }

  /**
   * 强制用完整句子结算
   * @param sentence 完整句
   */
  ingestUtterance(sentence: string): void {
    this.buffer = sentence
    this.flush()
  }

  /**
   * 结算缓冲区
   */
  flush(): void {
    const raw = this.buffer.trim()
    this.buffer = ''
    if (!raw)
      return

    const intent = matchIntent(raw, Date.now())
    if (!intent)
      return

    const now = Date.now()
    // stop 必须能打断刚发出的 follow/move；其它工具仍走冷却，防语音连发
    if (intent.tool !== 'stop' && now - this.lastEmitAt < this.cooldownMs)
      return

    this.lastEmitAt = now
    void Promise.resolve(this.onIntent(intent)).catch((err) => {
      console.error('[intent-bridge] handler failed', err)
    })
  }
}
