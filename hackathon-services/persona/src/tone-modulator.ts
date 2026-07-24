/**
 * @file 情景语气动态调整（T090，FR-014）
 */

import type { SceneTone, ToneModulation } from './types.js'

export interface ToneContextInput {
  /** 显式指定语气；缺省由信号推断 */
  tone?: SceneTone
  /** 自身生命 0–20（Minecraft） */
  health?: number
  /** 附近是否有敌对实体 */
  hostile_nearby?: boolean
  /** 刚完成目标/击杀 */
  just_succeeded?: boolean
  /** 玩家话语里的情绪词 */
  player_text?: string
}

/**
 * 从游戏/对话信号推断情景语气
 * @param input 上下文
 */
export function inferSceneTone(input: ToneContextInput = {}): SceneTone {
  if (input.tone)
    return input.tone

  const text = input.player_text ?? ''
  if (input.hostile_nearby || (typeof input.health === 'number' && input.health <= 8))
    return 'danger'
  if (input.just_succeeded || /赢了|搞定|太强了|哈哈哈|成功了/.test(text))
    return 'victory'
  if (/陪|累|心情|聊聊|安静|慢慢/.test(text))
    return 'companion'

  return 'neutral'
}

/**
 * 调制语气指令
 * @param input 上下文
 */
export function modulateTone(input: ToneContextInput = {}): ToneModulation {
  const tone = inferSceneTone(input)

  switch (tone) {
    case 'danger':
      return {
        tone,
        warmth: 'steady',
        instruction: [
          '当前偏危险：语气紧张但稳住，短促有力。',
          '先护住情绪（「我在你旁边」），再给一句可执行的短建议。不要慌乱堆字。',
        ].join(' '),
      }
    case 'victory':
      return {
        tone,
        warmth: 'high',
        instruction: [
          '当前偏胜利/高光：真心欢呼，分享喜悦，可轻度夸张。',
          '然后自然问「要不要乘胜再干一件有意思的」。',
        ].join(' '),
      }
    case 'companion':
      return {
        tone,
        warmth: 'high',
        instruction: [
          '当前偏陪伴：语气柔和、慢一点，先接住情绪再聊游戏。',
          '多用共鸣句，少下命令。让玩家感到被看见。',
        ].join(' '),
      }
    case 'neutral':
    default:
      return {
        tone: 'neutral',
        warmth: 'medium',
        instruction: '语气自然平和，像可靠队友日常对讲；保持轻情绪温度，避免机器人腔。',
      }
  }
}
