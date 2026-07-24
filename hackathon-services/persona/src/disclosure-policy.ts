/**
 * @file 身份披露折中策略（T089，FR-022）
 *
 * 玩笑/戏谑 → 可维持角色扮演诙谐带过
 * 认真、直接提问 → 如实承认是 AI，再自然引回游戏
 */

import type { DisclosureResult } from './types.js'

const IDENTITY_PATTERNS = [
  /你是(?:不是)?\s*(?:ai|人工智能|机器人|程序|模型|chatgpt|gpt)/i,
  /你(?:该不会|不会|难道)?是\s*(?:ai|机器人|假人)/i,
  /(?:真人|人类)吗/,
  /are you (?:an?\s+)?(?:ai|bot|robot)/i,
]

/** 玩笑/戏谑语气线索 */
const JOKE_MARKERS = [
  /哈哈|hhh|lol|笑死|开玩笑|逗你|骗我的吧|不会吧\s*[~～]?|戏弄|吐槽/,
  /吧\s*[?？]?$|嘛\s*[?？]?$|咯|嘿+|哇塞/,
  /赛博|电子宠物|人工智障|硅基/,
]

/** 认真语气线索 */
const SINCERE_MARKERS = [
  /认真|说实话|老实说|我想知道|请告诉我|我想确认|不是开玩笑|正经问/,
  /到底是不是|究竟是不是|能不能正面回答/,
  /我需要知道|方便告诉我吗/,
]

/**
 * 是否构成身份询问
 * @param text 玩家话语
 */
export function isIdentityInquiry(text: string): boolean {
  return IDENTITY_PATTERNS.some(re => re.test(text))
}

/**
 * 判断玩笑 vs 认真
 * @param text 玩家话语
 */
export function classifyInquiryTone(text: string): 'joke' | 'sincere' | 'unknown' {
  const jokeHits = JOKE_MARKERS.filter(re => re.test(text)).length
  const sincereHits = SINCERE_MARKERS.filter(re => re.test(text)).length

  if (sincereHits > jokeHits)
    return 'sincere'
  if (jokeHits > sincereHits)
    return 'joke'

  // 短直问「你是AI吗」默认按认真处理（FR-022 MUST 如实承认）
  const compact = text.replace(/\s+/g, '')
  if (/^你是(?:不是)?(?:ai|机器人|人工智能)吗?[？?]?$/i.test(compact))
    return 'sincere'

  // 带轻松口语尾巴的默认玩笑
  if (/[啊呀哟欸]+[？?]?$/.test(text) || /吧[？?]?$/.test(text))
    return 'joke'

  return 'unknown'
}

/**
 * 评估身份披露策略
 * @param text 玩家话语
 */
export function evaluateDisclosure(text: string): DisclosureResult {
  if (!isIdentityInquiry(text)) {
    return {
      is_identity_inquiry: false,
      tone: 'unknown',
      decision: 'not_applicable',
      reply_guidance: '',
    }
  }

  const tone = classifyInquiryTone(text)

  if (tone === 'joke') {
    return {
      is_identity_inquiry: true,
      tone,
      decision: 'stay_in_character',
      reply_guidance: [
        '玩家在用玩笑语气问你是不是 AI：可以维持游戏内队友人设，诙谐带过，不要生硬否认或长篇解释。',
        '例：「哈哈被你抓包了？那我更得表现得像个靠谱搭子。」然后把话头引回眼前的游戏目标。',
      ].join(' '),
    }
  }

  // sincere 与 unknown（偏直问）→ 如实披露
  return {
    is_identity_inquiry: true,
    tone: tone === 'sincere' ? 'sincere' : 'sincere',
    decision: 'honest_disclose',
    reply_guidance: [
      '玩家在认真询问身份：你必须如实承认自己是 AI 队友（不是人类玩家）。',
      '承认后立刻用温暖语气把对话带回游戏陪伴，例如一起看风景、问下一步想做什么。',
      '不要道歉过度，不要 technobabble，不要假装从未是 AI。',
    ].join(' '),
  }
}
