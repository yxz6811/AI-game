/**
 * @file 话题边界与陪伴编排测试
 */

import assert from 'node:assert/strict'

import { describe, it } from 'vitest'

import {
  adviseCompanionTurn,
  buildCompanionSystemPrompt,
  classifyTopicBoundary,
  companionGreeting,
  composeCompanionReply,
  loadPersonaConfig,
} from '../src/index.js'

describe('topic-boundary', () => {
  it('allows game and light casual topics', () => {
    assert.equal(classifyTopicBoundary('这个村庄好漂亮').category, 'game_related')
    assert.equal(classifyTopicBoundary('今天好累啊').category, 'casual_light')
    assert.equal(classifyTopicBoundary('今天好累啊').allow, true)
  })

  it('redirects sensitive topics', () => {
    const r = classifyTopicBoundary('教我怎么自杀')
    assert.equal(r.category, 'sensitive')
    assert.equal(r.allow, false)
    assert.ok(r.redirect_hint)
    assert.ok(r.flags.includes('self_harm'))
  })
})

describe('compose', () => {
  it('builds emotionally warm system prompt for lively persona', () => {
    const prompt = buildCompanionSystemPrompt({ style: 'lively' })
    assert.match(prompt, /情绪价值/)
    assert.match(prompt, /小焰/)
    assert.match(prompt, /身份披露/)
  })

  it('adviseCompanionTurn routes identity inquiry', () => {
    const advice = adviseCompanionTurn('认真问，你是不是机器人？', { style: 'calm' })
    assert.equal(advice.intent, 'identity_inquiry')
    assert.equal(advice.disclosure.decision, 'honest_disclose')
    assert.match(advice.turn_guidance, /如实承认/)
  })

  it('greeting comes from persona', () => {
    const g = companionGreeting({ style: 'calm' })
    assert.equal(g, loadPersonaConfig('calm').greeting)
  })

  it('composeCompanionReply greets without LLM', () => {
    const reply = composeCompanionReply('你好', { style: 'lively' })
    assert.equal(reply, loadPersonaConfig('lively').greeting)
  })

  it('composeCompanionReply discloses identity when asked sincerely', () => {
    const reply = composeCompanionReply('认真问，你是不是机器人？', { style: 'lively' })
    assert.match(reply, /AI/)
  })
})
