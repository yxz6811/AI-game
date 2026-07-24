/**
 * @file 契约形状冒烟：确保 ActionName 与 GameAdapter 可被引用
 */

import type { ActionRequest, GameAdapter, GameState } from '../../src/contract/types.js'

import assert from 'node:assert/strict'

import { describe, it } from 'vitest'

describe('game-adapter contract', () => {
  it('actionRequest accepts minimal follow', () => {
    const req: ActionRequest = { action: 'follow', params: { target: 'player1' } }
    assert.equal(req.action, 'follow')
  })

  it('gameState shape compiles', () => {
    const state: GameState = {
      character: { position: { x: 0, y: 64, z: 0 }, health: 20, hunger: 20, sanity: null },
      nearby_entities: [],
      resources: [],
      dangers: [],
      mission_progress: { mission_id: 'demo', status: 'not_started' },
    }
    assert.equal(state.character.health, 20)
  })

  it('gameAdapter is an interface consumers can implement', () => {
    const stub: GameAdapter = {
      observe: () => ({
        character: { position: { x: 0, y: 0, z: 0 }, health: 20 },
        nearby_entities: [],
        resources: [],
        dangers: [],
        mission_progress: { mission_id: 'x', status: 'not_started' },
      }),
      act: async () => ({ status: 'rejected', reason: 'stub' }),
      events: () => ({ subscribe: () => () => {} }),
      capabilities: () => [
        { action: 'follow', supported: true },
        { action: 'stop', supported: true },
      ],
      health: () => ({
        connection: 'disconnected',
        latency_ms: 0,
        last_error: null,
        recoverable: true,
      }),
    }
    const caps = stub.capabilities()
    assert.ok(Array.isArray(caps))
    assert.equal(caps[0]?.action, 'follow')
  })
})
