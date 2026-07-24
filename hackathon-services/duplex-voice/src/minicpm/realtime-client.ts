/**
 * @file MiniCPM-o Realtime WebSocket 客户端（mode=audio 旁路文本订阅）
 *
 * 本客户端可：
 * 1. 作为旁路观察者连接同一 Gateway（若 Demo 允许多连接）并只消费文本 delta
 * 2. 或与本地注入的文本探针配合（stdin / HTTP）做 Intent Bridge 联调
 *
 * 注意：官方全双工会话通常由浏览器 Demo 占用麦；旁路进程默认订阅文本事件。
 * 若 Gateway 不支持双连接同听，请用 `injectUserText` / stdin 文本降级通道做工具联调。
 */

import type { MiniCpmClientEvent, MiniCpmServerEvent } from './types.js'

import process from 'node:process'

import { EventEmitter } from 'node:events'

import WebSocket from 'ws'

import { parseMiniCpmServerEvent } from './types.js'

export interface MiniCpmRealtimeClientOptions {
  /** 例 wss://127.0.0.1:8006/v1/realtime?mode=audio */
  url: string
  systemPrompt?: string
  /** 连接后是否自动 session.init */
  autoInit?: boolean
}

export interface MiniCpmRealtimeEvents {
  ready: []
  text: [text: string, partial: boolean]
  listen: []
  closed: [reason?: string]
  error: [error: Error]
  raw: [event: MiniCpmServerEvent]
}

/**
 * MiniCPM-o Audio Full-Duplex Realtime 客户端
 */
export class MiniCpmRealtimeClient extends EventEmitter {
  private ws: WebSocket | null = null
  private textBuffer = ''
  private queueDone = false
  private sessionReady = false

  constructor(private readonly options: MiniCpmRealtimeClientOptions) {
    super()
  }

  /**
   * 建立连接并等待 queue_done → session.init → session.created
   */
  async connect(): Promise<void> {
    if (this.ws)
      return

    await new Promise<void>((resolve, reject) => {
      // NOTICE:
      // Why: 本机 Comni Gateway 使用自签 TLS（https://localhost:8006），Node 默认拒证。
      // Root cause: openssl 生成的本地 cert 不在系统信任链。
      // Source: demo/voice-runtime Comni 安装；curl -sk 可通。
      // Removal: 换正式证书或只走公网 wss 后可删 rejectUnauthorized:false。
      const ws = new WebSocket(this.options.url, {
        rejectUnauthorized: process.env.MINICPM_TLS_INSECURE === '0',
      })
      this.ws = ws

      function cleanup() {
        ws.off('open', onOpen)
        ws.off('error', onError)
      }

      function onOpen() {
        cleanup()
        resolve()
      }

      function onError(err: Error) {
        cleanup()
        reject(err)
      }

      ws.on('open', onOpen)
      ws.on('error', onError)
      ws.on('message', data => this.onMessage(data.toString()))
      ws.on('close', () => {
        this.ws = null
        this.emit('closed')
      })
    })

    if (this.options.autoInit !== false) {
      // 部分部署立刻 queue_done；若已收到则 init，否则等短超时后仍 init
      await this.waitForQueueDone(5000)
      await this.initSession()
    }
  }

  /**
   * 发送 session.init
   */
  async initSession(): Promise<void> {
    const prompt = this.options.systemPrompt
      ?? '你是 Minecraft 游戏队友 AIRI。用简短口语中文交流。玩家说「跟我来」「停下」「到这里」时确认你会执行。'
    this.send({
      type: 'session.init',
      payload: {
        system_prompt: prompt,
        instructions: prompt,
      },
    })
  }

  /**
   * 文本降级：把用户句子当 chat 输入（仅当 URL mode=chat 或后端接受 messages 时有效）。
   * Audio 模式下主要用于本地探针；默认走 Intent Bridge 的 stdin 路径。
   * @param text 用户文本
   */
  injectChatText(text: string): void {
    this.send({
      type: 'input.append',
      input: {
        messages: [{ role: 'user', content: text }],
        streaming: true,
        tts: { enabled: true },
      },
    })
  }

  /**
   * 关闭会话
   */
  async close(reason = 'user_stop'): Promise<void> {
    try {
      this.send({ type: 'session.close', reason })
    }
    catch {
      // ignore
    }
    this.ws?.close()
    this.ws = null
  }

  /**
   * 当前是否已 session.created
   */
  get isSessionReady(): boolean {
    return this.sessionReady
  }

  private send(event: MiniCpmClientEvent): void {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      throw new Error('MiniCPM Realtime WebSocket is not open')
    }
    this.ws.send(JSON.stringify(event))
  }

  private async waitForQueueDone(timeoutMs: number): Promise<void> {
    if (this.queueDone)
      return
    await new Promise<void>((resolve) => {
      const timer = setTimeout(resolve, timeoutMs)
      const onDone = () => {
        clearTimeout(timer)
        this.off('queue_done_internal' as 'ready', onDone)
        resolve()
      }
      // 复用 once 逻辑
      const check = () => {
        if (this.queueDone) {
          clearTimeout(timer)
          resolve()
        }
      }
      const interval = setInterval(() => {
        check()
        if (this.queueDone)
          clearInterval(interval)
      }, 50)
      setTimeout(clearInterval, timeoutMs + 10, interval)
      void onDone
    })
  }

  private onMessage(raw: string): void {
    const event = parseMiniCpmServerEvent(raw)
    if (!event)
      return
    this.emit('raw', event)

    switch (event.type) {
      case 'session.queue_done':
        this.queueDone = true
        break
      case 'session.queued':
      case 'session.queue_update':
        this.queueDone = false
        break
      case 'session.created':
        this.sessionReady = true
        this.emit('ready')
        console.info('[minicpm] session.created', (event as { session_id?: string }).session_id)
        break
      case 'response.output.delta': {
        const delta = event as Extract<MiniCpmServerEvent, { type: 'response.output.delta' }>
        if (delta.kind === 'listen') {
          this.flushTextBuffer()
          this.emit('listen')
        }
        else if (delta.kind === 'text' && delta.text) {
          this.textBuffer += delta.text
          this.emit('text', delta.text, true)
        }
        break
      }
      case 'response.done': {
        const done = event as { text?: string }
        if (done.text)
          this.textBuffer = done.text
        this.flushTextBuffer()
        break
      }
      case 'session.closed':
        this.sessionReady = false
        this.emit('closed', (event as { reason?: string }).reason)
        break
      case 'error': {
        const err = event as { error?: { message?: string, code?: string } }
        this.emit('error', new Error(err.error?.message ?? err.error?.code ?? 'minicpm error'))
        break
      }
      default:
        break
    }
  }

  private flushTextBuffer(): void {
    const text = this.textBuffer.trim()
    this.textBuffer = ''
    if (text)
      this.emit('text', text, false)
  }
}

/**
 * 从环境变量构建默认 URL
 */
export function resolveMiniCpmRealtimeUrl(): string {
  return process.env.MINICPM_REALTIME_URL
    ?? 'wss://127.0.0.1:8006/v1/realtime?mode=audio'
}
