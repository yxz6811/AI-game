/**
 * @file 各阶段延迟埋点（media/minicpm/intent/tool/action）
 */

import type { LatencyStage, StageMetric } from './types.js'

/**
 * 简单内存延迟看板，便于现场定位慢响应阶段。
 */
export class LatencyDashboard {
  private readonly metrics: StageMetric[] = []

  /**
   * 记录一个阶段耗时
   * @param stage 阶段名
   * @param ms 毫秒
   * @param detail 可选说明
   */
  record(stage: LatencyStage, ms: number, detail?: string): void {
    const entry: StageMetric = { stage, ms, at: Date.now(), detail }
    this.metrics.push(entry)
    if (this.metrics.length > 200)
      this.metrics.shift()
    console.info(`[latency] ${stage}=${ms.toFixed(1)}ms${detail ? ` ${detail}` : ''}`)
  }

  /**
   * 包一层计时
   * @param stage 阶段名
   * @param fn 异步工作
   */
  async time<T>(stage: LatencyStage, fn: () => Promise<T>, detail?: string): Promise<T> {
    const t0 = performance.now()
    try {
      return await fn()
    }
    finally {
      this.record(stage, performance.now() - t0, detail)
    }
  }

  /** 最近 N 条 */
  recent(n = 20): StageMetric[] {
    return this.metrics.slice(-n)
  }
}
