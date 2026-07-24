/**
 * @file 统一 Action Schema（G2-02）
 * @see docs/ai-game/specs/001-ai-game-teammate/contracts/game-adapter-contract.md
 */

/**
 * 最小动作集（FR-016）
 */
export type ActionName = 'follow' | 'move' | 'collect' | 'interact' | 'stop' | 'say'

/**
 * `act()` 请求
 */
export interface ActionRequest {
  action: ActionName
  params?: {
    /** 实体 ID 或坐标字符串 */
    target?: string
    /** 仅 `say` */
    text?: string
  }
}

/**
 * `act()` 结果
 *
 * `rejected`/`failed` 时 `reason` 必填且可解释（FR-023）。
 */
export interface ActionResult {
  status: 'accepted' | 'rejected' | 'completed' | 'failed'
  reason?: string
}
