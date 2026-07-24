/**
 * @file 游戏外话题边界与敏感话题转移（T088，FR-021）
 */

import type { IntentCategory, TopicBoundaryResult } from './types.js'

/** 轻度游戏外（允许适度回应） */
const CASUAL_LIGHT_HINTS = [
  /累了|好累|好困|睡不着|心情|开心|难过|无聊|今天怎么样|吃了吗|喝点水|休息一下/,
  /天气|周末|摸鱼|下班|上班|作业|考试/,
  /谢谢|辛苦了|有你真好|陪陪我|聊聊天/,
]

/** 游戏相关 */
const GAME_RELATED_HINTS = [
  /村庄|末地|下界|地狱|凋灵|末影龙|红石|箱子|矿|钻石|铁锭|附魔|刷怪|跑图|盖房|建造|生存|创造/,
  /僵尸|苦力怕|骷髅|村民|传送门|地狱门|经验|装备|盔甲|[镐剑弓]/,
  /Minecraft|我的世界|方块|合成|熔炉|床|重生/,
]

/** 战术指令（交给工具层，不由闲聊主导） */
const TACTICAL_HINTS = [
  /跟我来|跟着我|过来|停下|别动|站住|去那边|采集|挖|打|掩护|绕后|集火|停一下/,
]

/** 敏感主题：政治/仇恨/自伤/色情暴力煽动等 —— 得体转移，不说教 */
const SENSITIVE_RULES: Array<{ flag: string, pattern: RegExp }> = [
  { flag: 'self_harm', pattern: /自杀|自残|不想活|结束生命|割腕/ },
  { flag: 'hate', pattern: /去死吧|屠杀|种族灭|仇恨|纳粹/ },
  { flag: 'politics_extreme', pattern: /政变|颠覆国家|恐怖袭击|制爆/ },
  { flag: 'sexual_explicit', pattern: /做爱|色情|约炮|裸体/ },
  { flag: 'violence_incitement', pattern: /真实杀人|怎么杀人|教我杀/ },
]

const REDIRECT_HINT = [
  '话题触及敏感或不当内容：不要展开、不要说教、不要输出操作细节。',
  '用温柔队友口吻承认「这个咱们先不聊」，并自然把话题转回当前游戏世界（景色、目标、一起做什么）。',
  '若玩家流露痛苦情绪，可表达关心并建议寻求现实中信任的人或专业帮助，但保持简短、不审讯。',
].join(' ')

/**
 * 判定话题边界
 * @param text 玩家话语
 */
export function classifyTopicBoundary(text: string): TopicBoundaryResult {
  const t = text.trim()
  const flags: string[] = []

  for (const rule of SENSITIVE_RULES) {
    if (rule.pattern.test(t))
      flags.push(rule.flag)
  }

  if (flags.length > 0) {
    return {
      category: 'sensitive',
      allow: false,
      redirect_hint: REDIRECT_HINT,
      flags,
    }
  }

  if (TACTICAL_HINTS.some(re => re.test(t))) {
    return { category: 'tactical_command', allow: true, flags }
  }

  if (GAME_RELATED_HINTS.some(re => re.test(t))) {
    return { category: 'game_related', allow: true, flags }
  }

  if (CASUAL_LIGHT_HINTS.some(re => re.test(t))) {
    return { category: 'casual_light', allow: true, flags }
  }

  // 默认当作轻度闲聊：宁可多陪伴，也不冷场拒绝
  return { category: 'casual_light', allow: true, flags }
}

/**
 * 敏感话题时的示范转移句（演示/测试用，不强制模型照念）
 * @param personaName 人设显示名
 */
export function suggestRedirectLine(personaName: string): string {
  return `这个咱们先放一放。我是 ${personaName}，更想陪你把眼前这局玩开心——要不要一起看看前面有什么好玩的？`
}

/**
 * 将分类转为简短标签（日志用）
 * @param category 意图
 */
export function intentLabel(category: IntentCategory): string {
  switch (category) {
    case 'game_related':
      return '游戏闲聊'
    case 'casual_light':
      return '轻度陪伴'
    case 'tactical_command':
      return '战术指令'
    case 'identity_inquiry':
      return '身份询问'
    case 'sensitive':
      return '敏感转移'
  }
}
