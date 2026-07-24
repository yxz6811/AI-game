/**
 * @file 陪伴编排：拼装系统提示 + 本轮策略（情绪价值入口）
 *
 * Call stack:
 *
 * adviseCompanionTurn / buildCompanionSystemPrompt
 * -> {@link loadPersonaConfig}
 * -> {@link buildGameChatPrompt}
 * -> {@link classifyTopicBoundary}
 * -> {@link evaluateDisclosure}
 * -> {@link modulateTone}
 */

import type { ToneContextInput } from './tone-modulator.js'
import type {
  CompanionTurnAdvice,
  IntentCategory,
  PersonaConfig,
  PersonalityStyle,
  SceneTone,
} from './types.js'

import { loadPersonaConfig, loadPersonaFromPresets, parsePersonalityStyle } from './config.js'
import { evaluateDisclosure } from './disclosure-policy.js'
import { buildGameChatPrompt } from './game-chat.js'
import { modulateTone } from './tone-modulator.js'
import { classifyTopicBoundary } from './topic-boundary.js'

export interface ComposeOptions {
  /** 人设；缺省 lively */
  persona?: PersonaConfig
  /** 或只传风格 id */
  style?: PersonalityStyle | string
  /** 是否从 presets/*.json 读 */
  fromPresets?: boolean
  /** 语气上下文 */
  tone?: ToneContextInput
}

/**
 * 解析人设
 * @param options 编排选项
 */
function resolvePersona(options: ComposeOptions = {}): PersonaConfig {
  if (options.persona)
    return options.persona
  const style = parsePersonalityStyle(options.style)
  return options.fromPresets ? loadPersonaFromPresets(style) : loadPersonaConfig(style)
}

/**
 * 构建可直接用于 MiniCPM / LLM 的完整系统提示（会话级）
 * @param options 人设与语气
 */
export function buildCompanionSystemPrompt(options: ComposeOptions = {}): string {
  const persona = resolvePersona(options)
  const tone = modulateTone(options.tone ?? { tone: 'companion' })

  return [
    buildGameChatPrompt(persona),
    ``,
    `# 身份披露（FR-022）`,
    `若玩家玩笑问你是不是 AI：可维持队友人设诙谐带过。`,
    `若玩家认真直问：必须如实承认自己是 AI，并温柔把话题带回一起玩游戏。`,
    ``,
    `# 话题边界（FR-021）`,
    `轻度生活/情绪话题可以陪聊；敏感政治、仇恨、自伤、色情暴力等必须温柔转移回游戏，不说教、不给危险细节。`,
    ``,
    `# 当前情景语气`,
    tone.instruction,
    ``,
    `# 输出约束`,
    `- 默认中文口语，一两句话到三句话为宜（适合语音）`,
    `- 先给情绪，再给内容`,
    `- 不要输出工具调用 JSON；动作执行由外部 Intent Bridge 处理`,
  ].join('\n')
}

/**
 * 针对单句用户话语给出陪伴策略（可拼到本轮 prompt）
 * @param userText 玩家话语
 * @param options 人设与语气
 */
export function adviseCompanionTurn(userText: string, options: ComposeOptions = {}): CompanionTurnAdvice {
  const persona = resolvePersona(options)
  const disclosure = evaluateDisclosure(userText)
  const topic = classifyTopicBoundary(userText)

  let intent: IntentCategory = topic.category
  if (disclosure.is_identity_inquiry)
    intent = 'identity_inquiry'

  const tone = modulateTone({
    ...options.tone,
    player_text: userText,
    tone: options.tone?.tone as SceneTone | undefined,
  })

  const systemPrompt = buildCompanionSystemPrompt({
    persona,
    tone: { ...options.tone, player_text: userText, tone: tone.tone },
  })

  const parts: string[] = []
  parts.push(`本轮意图：${intent}`)

  if (disclosure.is_identity_inquiry && disclosure.reply_guidance)
    parts.push(disclosure.reply_guidance)

  if (!topic.allow && topic.redirect_hint)
    parts.push(topic.redirect_hint)
  else if (intent === 'casual_light')
    parts.push('轻度游戏外话题：适度回应情绪，必要时轻轻带回「我们接下来在游戏里做什么」。')
  else if (intent === 'game_related')
    parts.push('游戏闲聊：自然接话，可分享观察或一起做决定，不冷场。')
  else if (intent === 'tactical_command')
    parts.push('听起来像指令：口头简短确认即可（具体动作由工具层执行），仍保持人设温度。')

  parts.push(tone.instruction)

  return {
    intent,
    topic,
    disclosure,
    tone,
    system_prompt: systemPrompt,
    turn_guidance: parts.join('\n'),
  }
}

/** 问候/打招呼 */
const GREETING_RE = /^(?:你好|您好|嗨|哈喽|hello|hi|hey|早啊|早上好|晚安|在吗|在不在)[!！.。~～？?\s]*$/i

/**
 * 生成本地陪伴短回复（不经 LLM），供 Bot `chat` 直达。
 *
 * NOTICE:
 * Why: 闲聊若仍走 spark:command → Brain，GLM 常选 skip()「观察」，玩家感觉「不理人」。
 * Root cause: 终端实测「你好」→ Routing as AIRI directive → 多次 Skipping turn (observing)。
 * Removal: Brain B / 专用闲聊模型稳定出声后可改为模型生成，保留本函数作降级。
 *
 * @param userText 玩家话语
 * @param options 人设
 */
export function composeCompanionReply(userText: string, options: ComposeOptions = {}): string {
  const persona = resolvePersona(options)
  const text = userText.trim()
  const advice = adviseCompanionTurn(text, options)
  const name = persona.display_name.includes('·')
    ? persona.display_name.split('·').pop()!.trim()
    : persona.display_name

  if (advice.disclosure.decision === 'honest_disclose') {
    return persona.personality_style === 'lively'
      ? `认真说哈——我是 AI 队友${name}，不是真人。不过我还在这儿陪你浪方块世界，下一步想干嘛？`
      : `坦白讲，我是 AI 队友${name}。人设归人设，陪你一起玩是真的。想先挖矿还是随便逛逛？`
  }

  if (advice.disclosure.decision === 'stay_in_character') {
    return persona.personality_style === 'lively'
      ? `哈哈被你抓包了？那我更得表现得像个靠谱搭子。走，接着浪！`
      : `嗯，队友人设先挂着——重要的是我还在你身边。我们继续？`
  }

  if (!advice.topic.allow) {
    return persona.personality_style === 'lively'
      ? `这个咱们先不展开聊啦。眼前的世界还等着我们，要不要一起看看附近有什么好玩的？`
      : `这个话题我们先轻轻放下。不如回到游戏里，看看下一步想做什么？`
  }

  if (GREETING_RE.test(text) || (text.length <= 8 && /你好|嗨|hello|hi\b/i.test(text))) {
    return persona.greeting
  }

  if (/累|困|难过|心情不好|无聊/.test(text)) {
    return persona.personality_style === 'lively'
      ? `听到了，先歇口气也没关系。我就在旁边，想聊就聊，想挖就挖，你说了算。`
      : `嗯，我听见了。不着急，我陪着你。想慢慢走，还是找个安静的地方站一会儿？`
  }

  if (/谢谢|辛苦|有你真好/.test(text)) {
    return persona.personality_style === 'lively'
      ? `嘿嘿，被夸了会更有劲！有我在，一起冲。`
      : `不客气。能帮上忙我就安心了。`
  }

  if (advice.intent === 'game_related') {
    return persona.personality_style === 'lively'
      ? `嗯嗯我懂你说的！那咱们现在就动手？你定方向，我跟上。`
      : `好，这个我记下了。你想先怎么推进，我听你的。`
  }

  // 默认轻度陪伴：短、暖、带回一起玩
  return persona.personality_style === 'lively'
    ? `我在呢～听到你了。想一起浪图，还是先随便聊聊？`
    : `我在。听到你了。想继续逛，还是先歇一下再说？`
}

/**
 * 加入会话时的问候语
 * @param options 人设
 */
export function companionGreeting(options: ComposeOptions = {}): string {
  return resolvePersona(options).greeting
}
