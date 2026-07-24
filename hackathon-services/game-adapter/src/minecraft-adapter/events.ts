/**
 * @file Perception 事件 → 统一 GameEvent 形状归一化
 */

import type { GameEvent } from '../contract/types.js'
import type { MinecraftPerceptionEvent } from './types.js'

/**
 * 将 Perception `kind` 映射到契约事件 type
 * @param kind 原始 kind
 */
export function mapPerceptionKind(kind: string): GameEvent['type'] {
  const k = kind.toLowerCase()

  if (k === 'damage_taken' || k === 'hit' || k === 'entity_hurt' || k === 'hurt')
    return 'hit'
  if (k === 'death' || k === 'died' || k === 'player_died' || k === 'entity_dead')
    return 'death'
  if (k.includes('resource') || k === 'item_collected' || k === 'pickup')
    return 'resource_gained'
  if (k.includes('objective') || k.includes('mission') || k === 'goal_completed')
    return 'objective_completed'
  if (k.includes('command') || k === 'chat' || k === 'player_chat' || k === 'system_message')
    return 'player_command'

  return kind
}

/**
 * 归一化单条感知事件
 * @param raw Perception 原始事件
 */
export function normalizePerceptionEvent(raw: MinecraftPerceptionEvent): GameEvent {
  const occurredAt = typeof raw.timestamp === 'number'
    ? new Date(raw.timestamp).toISOString()
    : new Date().toISOString()

  const { kind, modality, timestamp: _timestamp, source, ...rest } = raw

  return {
    type: mapPerceptionKind(kind),
    detail: {
      kind,
      modality,
      source,
      ...rest,
    },
    occurred_at: occurredAt,
  }
}
