/**
 * @file Minecraft Adapter 单元测试（mock runner，不连真实 MC）
 */

import type { MinecraftActionRunner, MinecraftPerceptionEvent } from '../../src/minecraft-adapter/types.js'

import assert from 'node:assert/strict'

import { describe, it } from 'vitest'

import { createMinecraftAdapter, mapActionToMinecraftSteps, parseCoordinateTarget } from '../../src/minecraft-adapter/index.js'

describe('action-map', () => {
  it('parseCoordinateTarget accepts comma and space forms', () => {
    assert.deepEqual(parseCoordinateTarget('10,64,-5'), { x: 10, y: 64, z: -5 })
    assert.deepEqual(parseCoordinateTarget('10 64 -5'), { x: 10, y: 64, z: -5 })
    assert.equal(parseCoordinateTarget('Steve'), null)
  })

  it('maps follow/move/collect/interact/stop/say to minecraft tools', () => {
    const follow = mapActionToMinecraftSteps({ action: 'follow', params: { target: 'Alice' } }, 2)
    assert.equal(follow.ok, true)
    if (follow.ok) {
      assert.equal(follow.steps[0]?.tool, 'followPlayer')
      assert.deepEqual(follow.steps[0]?.params, { player_name: 'Alice', follow_dist: 2 })
    }

    const movePlayer = mapActionToMinecraftSteps({ action: 'move', params: { target: 'Bob' } }, 2)
    assert.equal(movePlayer.ok, true)
    if (movePlayer.ok)
      assert.equal(movePlayer.steps[0]?.tool, 'goToPlayer')

    const moveCoord = mapActionToMinecraftSteps({ action: 'move', params: { target: '1,2,3' } }, 2)
    assert.equal(moveCoord.ok, true)
    if (moveCoord.ok)
      assert.equal(moveCoord.steps[0]?.tool, 'goToCoordinate')

    const collect = mapActionToMinecraftSteps({ action: 'collect', params: { target: 'oak_log' } }, 2)
    assert.equal(collect.ok, true)
    if (collect.ok)
      assert.equal(collect.steps[0]?.tool, 'collectBlocks')

    const interact = mapActionToMinecraftSteps({ action: 'interact', params: { target: 'lever' } }, 2)
    assert.equal(interact.ok, true)
    if (interact.ok)
      assert.equal(interact.steps[0]?.tool, 'activate')

    const stop = mapActionToMinecraftSteps({ action: 'stop' }, 2)
    assert.equal(stop.ok, true)
    if (stop.ok) {
      assert.equal(stop.steps.length, 2)
      assert.equal(stop.steps[0]?.tool, 'clearFollowTarget')
      assert.equal(stop.steps[1]?.tool, 'stop')
    }

    const say = mapActionToMinecraftSteps({ action: 'say', params: { text: 'hi' } }, 2)
    assert.equal(say.ok, true)
    if (say.ok)
      assert.equal(say.steps[0]?.tool, 'chat')
  })

  it('rejects missing required params with explainable reason', () => {
    const follow = mapActionToMinecraftSteps({ action: 'follow' }, 2)
    assert.equal(follow.ok, false)
    if (!follow.ok)
      assert.match(follow.reason, /target/)
  })
})

describe('createMinecraftAdapter', () => {
  it('act() calls runner with mapped tools and returns completed', async () => {
    const calls: Array<{ tool: string, params?: Record<string, unknown> }> = []
    const runner: MinecraftActionRunner = {
      performAction: async (step) => {
        calls.push({ tool: step.tool, params: step.params })
        return 'ok'
      },
    }

    const adapter = createMinecraftAdapter({
      runner,
      readSnapshot: () => ({
        connected: true,
        latency_ms: 12,
        game_state: {
          character: { position: { x: 1, y: 64, z: 2 }, health: 20, hunger: 18, sanity: null },
          nearby_entities: [{ id: 'p1', type: 'player', position: { x: 2, y: 64, z: 2 }, hostile: false }],
          resources: [{ item: 'oak_log', quantity: 3 }],
          dangers: [],
          mission_progress: { mission_id: 'demo', status: 'in_progress' },
        },
      }),
    })

    const result = await adapter.act({ action: 'follow', params: { target: 'Alice' } })
    assert.equal(result.status, 'completed')
    assert.equal(calls[0]?.tool, 'followPlayer')

    const state = await adapter.observe()
    assert.equal(state.character.health, 20)
    assert.equal(state.character.sanity, null)
    assert.equal(state.nearby_entities.length, 1)

    const caps = await adapter.capabilities()
    assert.equal(caps.filter(c => c.supported).length, 6)

    const health = await adapter.health()
    assert.equal(health.connection, 'connected')
    assert.equal(health.latency_ms, 12)
  })

  it('act() rejects unsupported / incomplete actions without calling runner', async () => {
    let called = 0
    const adapter = createMinecraftAdapter({
      runner: {
        performAction: async () => {
          called += 1
          return 'ok'
        },
      },
    })

    const missing = await adapter.act({ action: 'collect' })
    assert.equal(missing.status, 'rejected')
    assert.ok(missing.reason)
    assert.equal(called, 0)
  })

  it('act() returns failed with reason when runner throws', async () => {
    const adapter = createMinecraftAdapter({
      runner: {
        performAction: async () => {
          throw new Error('path blocked')
        },
      },
    })

    const result = await adapter.act({ action: 'move', params: { target: '1,2,3' } })
    assert.equal(result.status, 'failed')
    assert.match(result.reason ?? '', /path blocked/)
  })

  it('events() normalizes damage_taken to hit', async () => {
    const listeners: Array<(e: MinecraftPerceptionEvent) => void> = []
    const adapter = createMinecraftAdapter({
      runner: { performAction: async () => 'ok' },
      eventSource: {
        subscribe: (listener) => {
          listeners.push(listener)
          return () => {}
        },
      },
    })

    const seen: string[] = []
    adapter.events().subscribe((ev) => {
      seen.push(ev.type)
    })

    listeners[0]?.({ kind: 'damage_taken', timestamp: Date.now(), amount: 2 })
    assert.deepEqual(seen, ['hit'])
  })
})
