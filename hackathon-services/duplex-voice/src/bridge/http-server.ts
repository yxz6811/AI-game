/**
 * @file Comni → Intent Bridge 的本机 HTTP 旁路
 *
 * 浏览器 Comni 页注入 comni-bridge.js 后，把 listen 文本 POST 到这里。
 */

import type { IncomingMessage, Server, ServerResponse } from 'node:http'

import process from 'node:process'

import { Buffer } from 'node:buffer'
import { readFileSync } from 'node:fs'
import { createServer } from 'node:http'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))

export interface UtterancePayload {
  text: string
  source?: string
  t_ms?: number
  is_listen?: boolean
  meta?: Record<string, unknown>
}

export interface BridgeHttpOptions {
  /** @default 8787 */
  port?: number
  host?: string
  onUtterance: (payload: UtterancePayload) => void | Promise<void>
}

/**
 * 启动旁路 HTTP 服务（CORS 全开，供 https://localhost:8006 调用）
 */
export function startBridgeHttp(options: BridgeHttpOptions): Server {
  const port = options.port ?? Number(process.env.BRIDGE_PORT ?? 8787)
  const host = options.host ?? '127.0.0.1'
  const bridgeJsPath = join(__dirname, 'comni-bridge.js')

  const server = createServer((req, res) => {
    setCors(req, res)
    if (req.method === 'OPTIONS') {
      res.writeHead(204)
      res.end()
      return
    }

    const url = new URL(req.url ?? '/', `http://${host}:${port}`)

    if (req.method === 'GET' && (url.pathname === '/' || url.pathname === '/health')) {
      json(res, 200, {
        ok: true,
        service: 'duplex-comni-bridge',
        brain: 'A',
        mode: 'true-full-duplex-comni',
        audio_page: 'https://localhost:8006/audio_duplex',
        inject: `window.__COMNI_BRIDGE_FORCE__=true;fetch('http://${host}:${port}/comni-bridge.js').then(r=>r.text()).then(eval)`,
        bookmarklet: `javascript:(async()=>{window.__COMNI_BRIDGE_FORCE__=true;const s=await(await fetch('http://${host}:${port}/comni-bridge.js')).text();eval(s);alert('comni-bridge ok — Stop然后Start会话')})()`,
        utterance: `POST http://${host}:${port}/v1/utterance`,
        patch: 'bash demo/voice-runtime/patch-comni-bridge.sh',
      })
      return
    }

    if (req.method === 'GET' && url.pathname === '/comni-bridge.js') {
      // NOTICE: 每次 GET 重读，避免 hackathon 热改脚本后还要整进程重启才生效。
      const bridgeJs = readFileSync(bridgeJsPath, 'utf8')
      res.writeHead(200, {
        'Content-Type': 'application/javascript; charset=utf-8',
        'Cache-Control': 'no-store',
      })
      res.end(bridgeJs)
      return
    }

    if (req.method === 'POST' && url.pathname === '/v1/utterance') {
      void readJson(req).then(async (body) => {
        const text = typeof body?.text === 'string' ? body.text.trim() : ''
        if (!text) {
          json(res, 400, { ok: false, error: 'text required' })
          return
        }
        const payload: UtterancePayload = {
          text,
          source: typeof body.source === 'string' ? body.source : 'http',
          t_ms: typeof body.t_ms === 'number' ? body.t_ms : Date.now(),
          is_listen: body.is_listen !== false,
          meta: typeof body.meta === 'object' && body.meta ? body.meta as Record<string, unknown> : undefined,
        }
        try {
          await options.onUtterance(payload)
          json(res, 200, { ok: true })
        }
        catch (err) {
          json(res, 500, {
            ok: false,
            error: messageFromUnknown(err),
          })
        }
      }).catch((err) => {
        json(res, 400, {
          ok: false,
          error: messageFromUnknown(err),
        })
      })
      return
    }

    json(res, 404, { ok: false, error: 'not found' })
  })

  server.listen(port, host, () => {
    console.info(`[brain-a] Comni 旁路就绪  http://${host}:${port}`)
    console.info(`[brain-a] 真全双工听感在 Comni 页；本端口只收听写→意图`)
    console.info(`[brain-a] 推荐：bash demo/voice-runtime/patch-comni-bridge.sh 后刷新 audio_duplex`)
    console.info(`[brain-a] 或打开 http://${host}:${port}/health 复制 inject / bookmarklet`)
    console.info(`[brain-a] 页内 Stop→Start 后说「过来」「停下」`)
  })

  server.on('error', (err: NodeJS.ErrnoException) => {
    if (err.code === 'EADDRINUSE') {
      console.error(`[brain-a] :${port} 已被占用。先结束旧进程再启：`)
      console.error(`  lsof -nP -iTCP:${port} -sTCP:LISTEN`)
      console.error(`  或重跑：bash demo/start-brain-a.sh`)
      process.exit(1)
    }
    throw err
  })

  return server
}

/**
 * 是否应启用 Comni 浏览器旁路（本地 8006 / 显式开关）
 */
export function shouldUseComniBridge(realtimeUrl: string): boolean {
  if (process.env.COMNI_BRIDGE === '1')
    return true
  if (process.env.COMNI_BRIDGE === '0')
    return false
  return /127\.0\.0\.1:8006|localhost:8006/.test(realtimeUrl)
}

function setCors(req: IncomingMessage, res: ServerResponse): void {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')
  // NOTICE: Comni 页是 https://localhost:8006，Chrome Private Network Access
  // 要求对 loopback HTTP 预检回 Private-Network 头，否则 fetch 会静默失败。
  res.setHeader('Access-Control-Allow-Private-Network', 'true')
  if (req.headers['access-control-request-private-network'] === 'true')
    res.setHeader('Access-Control-Allow-Private-Network', 'true')
}

function json(res: ServerResponse, status: number, body: unknown): void {
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8' })
  res.end(JSON.stringify(body, null, 2))
}

async function readJson(req: IncomingMessage): Promise<Record<string, unknown>> {
  const chunks: Buffer[] = []
  for await (const chunk of req)
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk))
  const raw = Buffer.concat(chunks).toString('utf8')
  if (!raw.trim())
    return {}
  return JSON.parse(raw) as Record<string, unknown>
}

/**
 * 从未知抛出值取可读消息（避免 `instanceof Error ? .message` 受限写法）。
 * @param error 任意抛出值
 */
function messageFromUnknown(error: unknown): string {
  if (typeof error === 'object' && error !== null && 'message' in error) {
    const message = (error as { message: unknown }).message
    if (typeof message === 'string' && message.length > 0)
      return message
  }
  return String(error)
}
