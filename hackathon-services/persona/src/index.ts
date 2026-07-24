/**
 * @file @hackathon/persona 公共导出
 *
 * 归档版 Phase 5「情感陪伴与人设化闲聊」的 TypeScript 实现：
 * 配置 / 游戏闲聊提示 / 话题边界 / 身份披露 / 语气调制 / 编排入口。
 */

export {
  adviseCompanionTurn,
  buildCompanionSystemPrompt,
  companionGreeting,
  composeCompanionReply,
  type ComposeOptions,
} from './compose.js'

export {
  listPersonaStyles,
  loadPersonaConfig,
  loadPersonaFromPresets,
  parsePersonalityStyle,
} from './config.js'

export {
  classifyInquiryTone,
  evaluateDisclosure,
  isIdentityInquiry,
} from './disclosure-policy.js'

export { buildGameChatPrompt } from './game-chat.js'

export {
  inferSceneTone,
  modulateTone,
  type ToneContextInput,
} from './tone-modulator.js'

export {
  classifyTopicBoundary,
  intentLabel,
  suggestRedirectLine,
} from './topic-boundary.js'

export type {
  CompanionTurnAdvice,
  DisclosureDecision,
  DisclosureResult,
  IntentCategory,
  PersonaConfig,
  PersonalityStyle,
  SceneTone,
  ToneModulation,
  TopicBoundaryResult,
} from './types.js'
