/**
 * @file Comni bridge 开关测试
 */

import assert from 'node:assert/strict'

import { describe, it } from 'vitest'

import { shouldUseComniBridge } from '../src/bridge/http-server.ts'

describe('shouldUseComniBridge', () => {
  it('detects local Comni URL', () => {
    assert.equal(
      shouldUseComniBridge('wss://127.0.0.1:8006/v1/realtime?mode=audio'),
      true,
    )
    assert.equal(
      shouldUseComniBridge('wss://localhost:8006/v1/realtime?mode=audio'),
      true,
    )
  })

  it('ignores public realtime by default', () => {
    assert.equal(
      shouldUseComniBridge('wss://minicpmo45.modelbest.cn/v1/realtime?mode=audio'),
      false,
    )
  })
})
