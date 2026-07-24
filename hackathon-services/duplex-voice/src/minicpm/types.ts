/**
 * @file MiniCPM-o Realtime API 事件类型（Audio Full-Duplex）
 * @see https://minicpmo45.modelbest.cn/docs/en/realtime-api/overview/
 */

export type MiniCpmClientEvent
  = | { type: 'session.init', payload: Record<string, unknown> }
    | { type: 'input.append', input: Record<string, unknown> }
    | { type: 'session.close', reason?: string }

export type MiniCpmServerEvent
  = | { type: 'session.queued', position?: number, estimated_wait_s?: number }
    | { type: 'session.queue_update', position?: number }
    | { type: 'session.queue_done' }
    | { type: 'session.created', session_id: string, mode?: string }
    | {
      type: 'response.output.delta'
      kind: 'listen' | 'text' | 'audio'
      session_id?: string
      text?: string
      audio?: string
      metrics?: Record<string, unknown>
    }
    | { type: 'response.done', text?: string, reason?: string }
    | { type: 'session.closed', session_id?: string, reason?: string }
    | { type: 'error', error?: { code?: string, message?: string } }
    | { type: string, [key: string]: unknown }

/**
 * 安全解析服务端 JSON 帧
 * @param raw WebSocket 文本
 */
export function parseMiniCpmServerEvent(raw: string): MiniCpmServerEvent | null {
  try {
    const data = JSON.parse(raw) as MiniCpmServerEvent
    if (!data || typeof data !== 'object' || typeof data.type !== 'string')
      return null
    return data
  }
  catch {
    return null
  }
}
