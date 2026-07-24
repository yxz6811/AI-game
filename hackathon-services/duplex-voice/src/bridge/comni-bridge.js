/**
 * Comni Audio Full-Duplex → duplex-voice Intent Bridge
 *
 * 用法（Audio Duplex 页 Console，每次开页/刷新后必跑）：
 *   window.__COMNI_BRIDGE_FORCE__=true
 *   fetch('http://127.0.0.1:8787/comni-bridge.js').then(r=>r.text()).then(eval)
 */
(() => {
  const BRIDGE = (typeof window !== 'undefined' && window.__DUPLEX_BRIDGE_URL__)
    || 'http://127.0.0.1:8787/v1/utterance'

  const FORCE = !!window.__COMNI_BRIDGE_FORCE__
  if (window.__COMNI_DUPLEX_BRIDGE_INSTALLED__ && !FORCE) {
    console.info('[comni-bridge] already installed — 设 FORCE=true 后重新 eval')
    return
  }

  try {
    window.__COMNI_BRIDGE_MO__?.disconnect?.()
  }
  catch {}
  try {
    window.__COMNI_BRIDGE_RECOG__?.stop?.()
  }
  catch {}

  window.__COMNI_DUPLEX_BRIDGE_INSTALLED__ = true
  window.__COMNI_BRIDGE_FORCE__ = false
  const reinstall = FORCE
  let fetchFailAlerted = false
  const seen = new Set()

  // NOTICE: 不用「停止发育」——`i` 下已被「停止」覆盖，会触发 regexp/no-dupe-disjunctions
  const CMD_HINT = /停下|停止|停一下|别动|别跟|取消|等等|跟我来|跟着我|过来|到这里|来这边|跳一跳|跳一下|跳跃|自己去发育|自己发育|自主发育|去发育|别自己动|\bstop\b|\bfollow\b|\bjump\b|come\s*here|\bidle\s*on\b|\bidle\s*off\b/i

  /**
   * @param {string} text
   * @param {string} via
   * @param {Record<string, unknown>} [meta]
   */
  function forward(text, via, meta) {
    const t = String(text || '').trim()
    if (!t)
      return

    const key = `${t}|${Math.floor(Date.now() / 1500)}`
    if (seen.has(key))
      return
    seen.add(key)
    if (seen.size > 120) {
      const first = seen.values().next().value
      seen.delete(first)
    }

    setBadge(`→ ${via}: ${t.slice(0, 24)}`, '#1a7f37')
    console.info(`[comni-bridge] → intent (${via})`, t, meta || '')

    fetch(BRIDGE, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        text: t,
        source: `comni-${via}`,
        is_listen: true,
        t_ms: Date.now(),
        meta: { ...meta, end_of_turn: meta?.end_of_turn ?? true },
      }),
      mode: 'cors',
    }).then((res) => {
      if (!res.ok)
        throw new Error(`HTTP ${res.status}`)
      setBadge(`ok ${via}: ${t.slice(0, 20)}`, '#1a7f37')
    }).catch((err) => {
      console.warn('[comni-bridge] forward failed', err)
      setBadge(`POST 失败: ${err}`, '#b42318')
      if (!fetchFailAlerted) {
        fetchFailAlerted = true
        console.error(
          '[comni-bridge] 无法 POST 到',
          BRIDGE,
          '— 常见原因：HTTPS→HTTP 被拦 / duplex 未启动。请确认 8787 存活。',
        )
      }
    })
  }

  /**
   * Comni 短指令常无 You:，但会口播确认（如「好的呀」「没问题，停一下」）。
   * @param {string} speak 口播文本
   * @returns {string|null} 映射后的玩家指令；无法映射时为 null
   */
  function mapSpeakAck(speak) {
    const t = String(speak || '').trim()
    if (!t)
      return null
    if (/停一下|停下|停止|别跟|不跟了|站住|halt|\bstop\b/i.test(t))
      return '停下'
    if (/跳一?下|跳跃|\bjump\b/i.test(t))
      return '跳一跳'
    // 「过来」后常见极短确认
    if (/跟着你|我跟着|跟紧|跟过来|这就来|马上到|过来了|来啦|来了|走起|跟上|我在这儿|我在这里|在这儿呢|在这里呢|这就过来|follow\s*you/i.test(t))
      return '过来'
    if (/^(?:好的呀|好的|好呀|[好嗯嘿]|没问题|收到|明白|嗯嗯|ok|okay)[。.!！？\s]*$/i.test(t))
      return '过来'
    return null
  }

  /** @param {unknown} data */
  function inspectMessage(data) {
    try {
      const msg = typeof data === 'string' ? JSON.parse(data) : data
      if (!msg || typeof msg !== 'object' || msg.type !== 'result')
        return

      if (msg.is_listen && msg.text) {
        forward(msg.text, 'ws', { end_of_turn: !!msg.end_of_turn })
        return
      }
      if (!msg.is_listen && msg.text) {
        // 先整段试指令原文，再试口播映射
        if (CMD_HINT.test(msg.text))
          forward(msg.text, 'speak-raw', { raw: msg.text })
        const mapped = mapSpeakAck(msg.text)
        if (mapped)
          forward(mapped, 'speak-ack', { raw: msg.text })
      }
    }
    catch {
      // ignore
    }
  }

  function setBadge(text, color) {
    let el = document.getElementById('comni-airi-bridge-badge')
    if (!el) {
      el = document.createElement('div')
      el.id = 'comni-airi-bridge-badge'
      el.style.cssText = [
        'position:fixed',
        'right:12px',
        'bottom:12px',
        'z-index:999999',
        'padding:8px 12px',
        'border-radius:8px',
        'font:12px/1.4 ui-monospace,monospace',
        'color:#fff',
        'background:#1a7f37',
        'box-shadow:0 2px 8px rgba(0,0,0,.25)',
        'max-width:360px',
        'pointer-events:none',
      ].join(';')
      document.documentElement.appendChild(el)
    }
    el.style.background = color || '#1a7f37'
    el.textContent = `[AIRI bridge] ${text}`
  }

  // ── DuplexSession 补丁 ───────────────────────
  void import(`${location.origin}/static/duplex/lib/duplex-session.js`)
    .then((mod) => {
      const DuplexSession = mod.DuplexSession
      if (!DuplexSession?.prototype?._handleResult) {
        console.warn('[comni-bridge] DuplexSession._handleResult 未找到')
        setBadge('session 挂钩失败', '#b42318')
        return
      }
      if (DuplexSession.prototype.__comniBridgePatched && !reinstall) {
        console.info('[comni-bridge] DuplexSession 已补丁')
        return
      }

      const orig = DuplexSession.prototype.__comniBridgeOrigHandle
        || DuplexSession.prototype._handleResult
      DuplexSession.prototype.__comniBridgeOrigHandle = orig

      DuplexSession.prototype._handleResult = function patchedHandleResult(result) {
        try {
          if (result?.is_listen && result?.text)
            forward(result.text, 'session-listen', { end_of_turn: !!result.end_of_turn })

          if (!result?.is_listen && result?.text) {
            this.__comniBridgeSpeak = (this.__comniBridgeSpeak || '') + result.text
            if (CMD_HINT.test(this.__comniBridgeSpeak))
              forward(this.__comniBridgeSpeak, 'session-speak-raw', { raw: this.__comniBridgeSpeak })
            const mapped = mapSpeakAck(this.__comniBridgeSpeak)
            if (mapped)
              forward(mapped, 'session-speak-ack', { raw: this.__comniBridgeSpeak })
          }

          if (result?.is_listen)
            this.__comniBridgeSpeak = ''
        }
        catch (err) {
          console.warn('[comni-bridge] session hook error', err)
        }
        return orig.call(this, result)
      }

      DuplexSession.prototype.__comniBridgePatched = true
      console.info('[comni-bridge] DuplexSession 已挂钩')
      setBadge('session 已挂钩 — 说「过来」「停下」', '#1a7f37')
    })
    .catch((err) => {
      console.warn('[comni-bridge] import DuplexSession 失败', err)
      setBadge('import session 失败', '#b42318')
    })

  // ── WebSocket ───────────────────────────────
  const NativeWS = window.__COMNI_NATIVE_WS__ || window.WebSocket
  window.__COMNI_NATIVE_WS__ = NativeWS

  class PatchedWebSocket extends NativeWS {
    /**
     * @param {string|URL} url
     * @param {string|string[]} [protocols]
     */
    constructor(url, protocols) {
      super(url, protocols)
      const urlStr = String(url)
      const watch = /\/ws\/duplex\//.test(urlStr) || /\/ws\/half_duplex\//.test(urlStr)
      console.info('[comni-bridge] WebSocket', urlStr, watch ? '(WATCH)' : '')
      if (watch) {
        this.addEventListener('message', ev => inspectMessage(ev.data))
      }
    }
  }

  Object.defineProperty(window, 'WebSocket', {
    configurable: true,
    writable: true,
    value: PatchedWebSocket,
  })

  // ── DOM：You: + AI 气泡 ─────────────────────
  function scanLogs(root) {
    const scope = root && root.querySelectorAll ? root : document
    const nodes = scope.querySelectorAll('.conv-text, .user-tag, .ai-tag, .speaker')
    for (const node of nodes) {
      const wrap = node.classList?.contains('conv-text')
        ? node
        : (node.closest('.conv-text') || node.parentElement)
      if (!wrap || wrap.dataset.comniBridged === '1')
        continue
      const raw = (wrap.textContent || '').trim()
      if (!raw)
        continue

      // NOTICE: 避免 /^\s*You:\s*(.+)$/ 的 \s* 与 .+ 交换导致 super-linear backtracking
      const you = raw.match(/^[\t ]*You:(.*)$/i)
      if (you) {
        wrap.dataset.comniBridged = '1'
        forward(you[1].trim(), 'dom-you', { end_of_turn: true })
        continue
      }

      const ai = raw.match(/^[\t ]*AI:(.*)$/i)
      if (ai) {
        wrap.dataset.comniBridged = '1'
        const body = ai[1].trim()
        const mapped = mapSpeakAck(body)
        if (mapped)
          forward(mapped, 'dom-ai-ack', { raw: body })
        else if (CMD_HINT.test(body))
          forward(body, 'dom-ai-raw', { end_of_turn: true })
      }
    }
  }

  const mo = new MutationObserver((mutations) => {
    for (const m of mutations) {
      for (const node of m.addedNodes) {
        if (node.nodeType === 1)
          scanLogs(node)
      }
    }
  })
  mo.observe(document.documentElement, { childList: true, subtree: true })
  window.__COMNI_BRIDGE_MO__ = mo
  scanLogs(document)

  // ── Web Speech 兜底 ─────────────────────────
  const SpeechRec = window.SpeechRecognition || window.webkitSpeechRecognition
  if (SpeechRec) {
    const recog = new SpeechRec()
    recog.lang = 'zh-CN'
    recog.continuous = true
    recog.interimResults = true
    recog.onresult = (event) => {
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const r = event.results[i]
        const text = (r[0]?.transcript || '').trim()
        if (!text)
          continue
        if (r.isFinal && (CMD_HINT.test(text) || text.length <= 8))
          forward(text, 'speech', { end_of_turn: true })
        else if (!r.isFinal && CMD_HINT.test(text) && text.length <= 12)
          forward(text, 'speech-interim', { end_of_turn: true })
      }
    }
    recog.onerror = (ev) => {
      if (ev.error !== 'aborted' && ev.error !== 'no-speech')
        console.warn('[comni-bridge] speech', ev.error)
    }
    recog.onend = () => {
      try {
        recog.start()
      }
      catch {}
    }
    try {
      recog.start()
      window.__COMNI_BRIDGE_RECOG__ = recog
    }
    catch (err) {
      console.warn('[comni-bridge] speech start fail', err)
    }
  }

  // 连通性自检
  fetch(BRIDGE.replace(/\/v1\/utterance$/, '/health'), { mode: 'cors' })
    .then((r) => {
      if (!r.ok)
        throw new Error(String(r.status))
      setBadge('已连接 8787 — 请说话', '#1a7f37')
    })
    .catch((err) => {
      setBadge(`8787 不可达: ${err}`, '#b42318')
      console.error('[comni-bridge] health 失败', err)
    })

  console.info('[comni-bridge] installed →', BRIDGE)
})()
