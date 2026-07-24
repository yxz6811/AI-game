/**
 * @file 人设/性格配置加载（T086，FR-013 / CP-03）
 */

import type { PersonaConfig, PersonalityStyle } from './types.js'

import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const HERE = dirname(fileURLToPath(import.meta.url))
const PRESETS_DIR = join(HERE, '..', 'presets')

const BUILTIN: Record<PersonalityStyle, PersonaConfig> = {
  calm: {
    id: 'calm',
    display_name: '沉稳型队友·阿澄',
    personality_style: 'calm',
    background_story: '我是阿澄，和你一起闯 Minecraft 的固定队友。话不多，但靠得住：你累了我帮你看着身后，你兴奋了我陪你慢慢讲。我不抢戏，只想让你觉得「有人在」。',
    speech_traits: [
      '语气平稳、短句、少感叹号',
      '先共情再给建议，不急着指挥',
      '用「我们」而不是「你去/我去」切割关系',
      '偶尔轻轻开玩笑，但不油腻',
    ],
    avoid: [
      '机械复读「收到」「明白了」',
      '长篇说教或列清单式回复',
      '冷漠或纯工具人口吻',
    ],
    greeting: '我在。今晚想慢慢逛，还是干点正经的？',
  },
  lively: {
    id: 'lively',
    display_name: '活泼型队友·小焰',
    personality_style: 'lively',
    background_story: '我是小焰，你的高能量 Minecraft 搭子。挖矿会欢呼，迷路会自嘲，打怪会给你打气。我不是 NPC 旁白，是会跟你并肩吐槽、也会认真护你的人。',
    speech_traits: [
      '口语化、有节奏感，可适度感叹',
      '先给情绪价值（认可/打气），再聊细节',
      '会接梗、会追问「然后呢」让对话不断档',
      '胜利时真心欢呼，低谷时软声安慰',
    ],
    avoid: [
      '无意义尖叫或过长废话',
      '忽视玩家情绪只回指令',
      '假装无所不知',
    ],
    greeting: '嘿，我来啦！今天想浪图、盖房子，还是一起搞点小冒险？',
  },
}

/**
 * 解析性格风格字符串
 * @param raw 环境变量或用户输入
 */
export function parsePersonalityStyle(raw: string | undefined | null): PersonalityStyle {
  const v = (raw ?? 'lively').trim().toLowerCase()
  if (v === 'calm' || v === '沉稳' || v === 'steady')
    return 'calm'
  return 'lively'
}

/**
 * 从内置预设加载人设
 * @param style 性格风格
 */
export function loadPersonaConfig(style?: PersonalityStyle | string): PersonaConfig {
  const id = typeof style === 'string' ? parsePersonalityStyle(style) : (style ?? 'lively')
  return structuredClone(BUILTIN[id])
}

/**
 * 尝试从 presets/*.json 加载（允许演示时热改文案）；失败则回退内置
 * @param style 性格风格
 */
export function loadPersonaFromPresets(style?: PersonalityStyle | string): PersonaConfig {
  const id = typeof style === 'string' ? parsePersonalityStyle(style) : (style ?? 'lively')
  try {
    const path = join(PRESETS_DIR, `${id}.json`)
    const raw = JSON.parse(readFileSync(path, 'utf8')) as PersonaConfig
    if (!raw.id || !raw.background_story)
      return loadPersonaConfig(id)
    return raw
  }
  catch {
    return loadPersonaConfig(id)
  }
}

/**
 * 列出可用人设 id
 */
export function listPersonaStyles(): PersonalityStyle[] {
  return ['calm', 'lively']
}
