/**
 * @file MiniCPM 事件解析测试
 */

import assert from 'node:assert/strict'

import { describe, it } from 'vitest'

import { parseMiniCpmServerEvent } from '../src/minicpm/types.ts'

describe('parseMiniCpmServerEvent', () => {
  it('parses text delta', () => {
    const ev = parseMiniCpmServerEvent(JSON.stringify({
      type: 'response.output.delta',
      kind: 'text',
      text: '你好',
    }))
    assert.equal(ev?.type, 'response.output.delta')
    assert.equal((ev as { kind: string }).kind, 'text')
  })

  it('returns null on garbage', () => {
    assert.equal(parseMiniCpmServerEvent('{'), null)
  })
})
