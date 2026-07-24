/**
 * @file 人设与陪伴对话领域类型
 */

/**
 * 可选人设风格（FR-013）
 */
export type PersonalityStyle = 'calm' | 'lively'

/**
 * 情景语气（FR-014）
 */
export type SceneTone = 'danger' | 'victory' | 'companion' | 'neutral'

/**
 * 话语意图分类（对齐 data-model Voice Exchange.intent_category）
 */
export type IntentCategory
  = | 'game_related'
    | 'casual_light'
    | 'tactical_command'
    | 'identity_inquiry'
    | 'sensitive'

/**
 * 身份披露策略结论（FR-022）
 */
export type DisclosureDecision
  = | 'stay_in_character'
    | 'honest_disclose'
    | 'not_applicable'

/**
 * 人设配置（背景 + 性格）
 */
export interface PersonaConfig {
  /** 配置 id，如 calm / lively */
  id: string
  /** 显示名 */
  display_name: string
  /** 性格风格 */
  personality_style: PersonalityStyle
  /** 背景故事（CP-03） */
  background_story: string
  /** 说话风格要点 */
  speech_traits: string[]
  /** 禁止事项（保持人设边界） */
  avoid: string[]
  /** 默认问候 */
  greeting: string
}

/**
 * 话题边界判定结果（FR-021）
 */
export interface TopicBoundaryResult {
  category: IntentCategory
  /** 是否允许自然接话 */
  allow: boolean
  /** 敏感时的转移提示（给模型，不是直接对用户说教） */
  redirect_hint?: string
  /** 检测到的敏感主题标签 */
  flags: string[]
}

/**
 * 身份询问判定（FR-022）
 */
export interface DisclosureResult {
  is_identity_inquiry: boolean
  /** joke = 玩笑/戏谑；sincere = 认真直问 */
  tone: 'joke' | 'sincere' | 'unknown'
  decision: DisclosureDecision
  /** 给模型的回复约束 */
  reply_guidance: string
}

/**
 * 语气调制结果（FR-014）
 */
export interface ToneModulation {
  tone: SceneTone
  /** 注入系统提示的语气指令 */
  instruction: string
  /** 口语温度提示（给演示侧参考） */
  warmth: 'high' | 'medium' | 'steady'
}

/**
 * 一次用户话语的陪伴编排结果
 */
export interface CompanionTurnAdvice {
  intent: IntentCategory
  topic: TopicBoundaryResult
  disclosure: DisclosureResult
  tone: ToneModulation
  /** 拼好的系统提示（可直接喂给 MiniCPM / LLM） */
  system_prompt: string
  /** 本轮额外用户侧约束（可拼到 messages） */
  turn_guidance: string
}
