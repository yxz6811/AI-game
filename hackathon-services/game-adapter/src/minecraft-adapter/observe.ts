/**
 * @file observe() 空安全态与快照投影
 */

import type { GameState } from '../contract/game-state.js'
import type { MinecraftWorldSnapshot } from './types.js'

/**
 * 未连服 / 无快照时的空安全 GameState
 */
export function emptyGameState(missionId = 'minecraft'): GameState {
  return {
    character: {
      position: { x: 0, y: 0, z: 0 },
      health: 0,
      hunger: null,
      sanity: null,
    },
    nearby_entities: [],
    resources: [],
    dangers: [],
    mission_progress: {
      mission_id: missionId,
      status: 'not_started',
    },
  }
}

/**
 * 从世界快照投影 GameState（sanity 恒为 null）
 * @param snapshot 集成方提供的快照
 */
export function projectGameState(snapshot: MinecraftWorldSnapshot): GameState {
  if (snapshot.game_state) {
    return {
      ...snapshot.game_state,
      character: {
        ...snapshot.game_state.character,
        sanity: snapshot.game_state.character.sanity ?? null,
      },
    }
  }

  return emptyGameState()
}
