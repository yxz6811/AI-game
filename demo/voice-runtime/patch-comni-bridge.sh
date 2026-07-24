#!/usr/bin/env bash
# 把 AIRI comni-bridge 永久注入本机 Comni Audio Duplex 页，并改默认人设提示。
set -euo pipefail
HTML="/Applications/Comni.app/Contents/Resources/apps/frontend/audio-duplex/audio_duplex.html"
[[ -f "$HTML" ]] || { echo "Comni HTML not found: $HTML"; exit 1; }
cp -n "$HTML" "${HTML}.airi.bak" 2>/dev/null || true
python3 - "$HTML" <<'PY'
import sys
from pathlib import Path
p = Path(sys.argv[1])
text = p.read_text(encoding="utf-8")
if "8787/comni-bridge" not in text:
    snippet = """
<!-- AIRI Intent Bridge: auto-load from duplex-voice :8787 -->
<script>
(function () {
  function loadBridge() {
    window.__COMNI_BRIDGE_FORCE__ = true;
    fetch('http://127.0.0.1:8787/comni-bridge.js', { cache: 'no-store' })
      .then(function (r) { if (!r.ok) throw new Error('HTTP ' + r.status); return r.text(); })
      .then(function (code) { eval(code); console.info('[AIRI] comni-bridge auto-loaded'); })
      .catch(function (err) {
        console.warn('[AIRI] bridge load failed', err);
      });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', loadBridge);
  else loadBridge();
})();
</script>
"""
    text = text.replace("</body>", snippet + "\n</body>", 1)
old = "扮演一个具有以上声音特征的助手。请认真、高质量地回复用户的问题。请用高自然度的方式和用户聊天。你处于双工模式，可以一边听、一边说。你是由面壁智能开发的人工智能助手：面壁小钢炮。"
new = "你是 Minecraft 游戏队友 AIRI。用简短口语中文回复。玩家说「过来/跟我来」时只回「好的，这就过来」；说「停下/停止」时只回「好的，停下」；说「跳」时只回「好，跳一下」。不要反问想聊什么。你处于双工模式，可一边听一边说。"
if old in text:
    text = text.replace(old, new)
p.write_text(text, encoding="utf-8")
print("ok:", p)
PY
echo "刷新 https://localhost:8006/audio_duplex （必要时 Reset Settings），右下角应见 [AIRI bridge]"
