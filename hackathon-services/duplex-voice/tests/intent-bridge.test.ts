/**
 * @file Intent Bridge 规则测试
 */

import assert from 'node:assert/strict'

import { describe, it } from 'vitest'

import { IntentBridge, matchIntent } from '../src/intent-bridge/trigger.ts'

describe('matchIntent', () => {
  it('matches follow', () => {
    const r = matchIntent('你跟我来一下')
    assert.equal(r?.tool, 'follow')
    assert.equal(r?.label, '跟我来')
  })

  it('matches stop with priority over softer phrases', () => {
    const r = matchIntent('停下别动')
    assert.equal(r?.tool, 'stop')
  })

  it('maps 好的呀 speak-ack style to follow via raw patterns optional', () => {
    // Intent Bridge 侧仍认「过来」；口播「好的呀」由 comni-bridge mapSpeakAck 转成过来
    assert.equal(matchIntent('过来')?.tool, 'follow')
  })

  it('matches 停一下 / 别跟 as stop', () => {
    assert.equal(matchIntent('没问题，停一下')?.tool, 'stop')
    assert.equal(matchIntent('别跟着我')?.tool, 'stop')
  })

  it('matches move for go-there phrases', () => {
    const r = matchIntent('去那边看看')
    assert.equal(r?.tool, 'move')
  })

  it('maps 过来 to follow (not move)', () => {
    assert.equal(matchIntent('过来')?.tool, 'follow')
    assert.equal(matchIntent('到这里来')?.tool, 'follow')
  })

  it('returns null for chitchat', () => {
    assert.equal(matchIntent('今天天气不错'), null)
  })

  it('matches jump', () => {
    assert.equal(matchIntent('跳一跳')?.tool, 'jump')
  })

  it('matches idle develop on/off before stop', () => {
    assert.equal(matchIntent('自己去发育')?.tool, 'idleDevelopOn')
    assert.equal(matchIntent('自主发育吧')?.tool, 'idleDevelopOn')
    assert.equal(matchIntent('别自己动了')?.tool, 'idleDevelopOff')
    assert.equal(matchIntent('停止发育')?.tool, 'idleDevelopOff')
  })

  it('matches english follow', () => {
    assert.equal(matchIntent('please follow me now')?.tool, 'follow')
  })
})

describe('intentBridge cooldown', () => {
  it('lets stop bypass cooldown after follow', () => {
    const tools: string[] = []
    const bridge = new IntentBridge((intent) => {
      tools.push(intent.tool)
    }, { cooldownMs: 10_000 })

    bridge.ingestUtterance('过来')
    bridge.ingestUtterance('停下')

    assert.deepEqual(tools, ['follow', 'stop'])
  })

  it('still cools non-stop tools', () => {
    const tools: string[] = []
    const bridge = new IntentBridge((intent) => {
      tools.push(intent.tool)
    }, { cooldownMs: 10_000 })

    bridge.ingestUtterance('过来')
    bridge.ingestUtterance('跳一跳')

    assert.deepEqual(tools, ['follow'])
  })
})
