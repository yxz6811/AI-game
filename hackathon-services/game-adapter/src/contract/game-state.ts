/**
 * @file 统一 GameState（G2-01）
 * @see docs/ai-game/specs/001-ai-game-teammate/contracts/game-adapter-contract.md
 */

/**
 * 三维坐标（游戏世界单位）
 */
export interface Vec3 {
  x: number
  y: number
  z: number
}

/**
 * 角色快照
 *
 * `sanity` 仅 DST 有意义；Minecraft Adapter 可省略或置 `null`。
 */
export interface CharacterState {
  position: Vec3
  health: number
  hunger?: number | null
  /** DST 精神值；Minecraft 为 null/省略 */
  sanity?: number | null
}

/**
 * 附近实体
 */
export interface NearbyEntity {
  id: string
  type: string
  position: Vec3
  hostile: boolean
}

/**
 * 资源条目
 */
export interface ResourceItem {
  item: string
  quantity: number
}

/**
 * 危险点
 */
export interface Danger {
  type: string
  position: Vec3
  severity: 'low' | 'medium' | 'high'
}

/**
 * 任务进度
 */
export interface MissionProgress {
  mission_id: string
  status: 'not_started' | 'in_progress' | 'completed' | 'blocked'
}

/**
 * 标准化游戏状态（`observe()` 返回值）
 */
export interface GameState {
  character: CharacterState
  nearby_entities: NearbyEntity[]
  resources: ResourceItem[]
  dangers: Danger[]
  mission_progress: MissionProgress
}
