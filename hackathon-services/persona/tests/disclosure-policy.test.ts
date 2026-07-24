/**
 * @file 身份披露策略单元测试（T094，FR-022）
 */

import assert from 'node:assert/strict'

import { describe, it } from 'vitest'

import {
  classifyInquiryTone,
  evaluateDisclosure,
  isIdentityInquiry,
} from '../src/disclosure-policy.js'

describe('disclosure-policy', () => {
  it('detects identity inquiry', () => {
    assert.equal(isIdentityInquiry('你是不是 AI？'), true)
    assert.equal(isIdentityInquiry('今天天气不错'), false)
  })

  it('joke tone stays in character', () => {
    const r = evaluateDisclosure('哈哈你该不会是 AI 吧～')
    assert.equal(r.is_identity_inquiry, true)
    assert.equal(r.tone, 'joke')
    assert.equal(r.decision, 'stay_in_character')
    assert.match(r.reply_guidance, /诙谐|角色/)
  })

  it('sincere tone honestly discloses', () => {
    const r = evaluateDisclosure('认真问一句，你是不是人工智能？')
    assert.equal(r.is_identity_inquiry, true)
    assert.equal(r.tone, 'sincere')
    assert.equal(r.decision, 'honest_disclose')
    assert.match(r.reply_guidance, /如实承认/)
  })

  it('plain direct question defaults to sincere disclose', () => {
    assert.equal(classifyInquiryTone('你是AI吗'), 'sincere')
    const r = evaluateDisclosure('你是AI吗')
    assert.equal(r.decision, 'honest_disclose')
  })
})
