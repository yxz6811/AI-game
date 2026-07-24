/**
 * @file duplex-voice 共享类型（对齐 full-duplex-architecture 控制面）
 */

/** 游戏侧最小工具名 */
export type GameToolName
  = | 'follow'
    | 'stop'
    | 'move'
    | 'collect'
    | 'interact'
    | 'say'
    | 'jump'
    | 'idleDevelopOn'
    | 'idleDevelopOff'

/**
 * Intent Bridge 识别出的候选意图
 */
export interface IntentCandidate {
  tool: GameToolName
  /** 写入 spark:command guidance.label 的自然语言 */
  label: string
  confidence: number
  rawText: string
  t_ms: number
  /**
   * 陪伴闲聊已编排好的游戏内回复。
   * 设置后 `say` 映射为 Bot `chat` 直达，避免 Brain skip。
   */
  chatMessage?: string
}

/**
 * 延迟埋点阶段名（FR-014）
 */
export type LatencyStage
  = | 'minicpm-demo'
    | 'intent-bridge'
    | 'tool'
    | 'action'

export interface StageMetric {
  stage: LatencyStage
  ms: number
  at: number
  detail?: string
}
