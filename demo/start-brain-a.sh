#!/usr/bin/env bash
# Brain A 真全双工一键启动（本机 Comni + duplex-voice Intent Bridge）
#
# 前提：
#   1. 已装 /Applications/Comni.app，并在 GUI 里 Start 服务（:8006）
#   2. 模型已下载（见 demo/voice-runtime/download-comni-model.sh）
#   3. 若要驱动 Bot：AIRI :6121 + minecraft-bot + Paper 已起
#
# 用法（仓库根）：
#   bash demo/start-brain-a.sh
#   bash demo/start-brain-a.sh --patch   # 永久注入 Comni HTML 桥
#   bash demo/start-brain-a.sh --dry-run # 不连 AIRI，只验语音旁路
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
DUPLEX="$ROOT/hackathon-services/duplex-voice"
PATCH="$ROOT/demo/voice-runtime/patch-comni-bridge.sh"
DO_PATCH=0
DRY_RUN_FLAG=0

for arg in "$@"; do
  case "$arg" in
    --patch) DO_PATCH=1 ;;
    --dry-run) DRY_RUN_FLAG=1 ;;
    -h|--help)
      sed -n '2,16p' "$0"
      exit 0
      ;;
  esac
done

echo "==== Brain A · True Full-Duplex ===="
echo "Comni Audio Duplex = 听+说双流；duplex-voice = Intent → Bot"
echo

if ! lsof -nP -iTCP:8006 -sTCP:LISTEN >/dev/null 2>&1; then
  echo "❌ 未检测到 Comni Gateway :8006"
  echo "   打开 Comni.app → 下载模型 → Start → 再跑本脚本"
  exit 1
fi
echo "✅ Comni :8006 在听"

# 旧 duplex 常占着 8787，启动前清掉本机旁路端口
BRIDGE_PORT="${BRIDGE_PORT:-8787}"
if lsof -nP -iTCP:"$BRIDGE_PORT" -sTCP:LISTEN >/dev/null 2>&1; then
  echo "→ :$BRIDGE_PORT 已被占用，结束旧 duplex-voice…"
  # 只动监听该端口的进程，避免误杀无关 node
  pids="$(lsof -nP -iTCP:"$BRIDGE_PORT" -sTCP:LISTEN -t 2>/dev/null || true)"
  if [[ -n "$pids" ]]; then
    # shellcheck disable=SC2086
    kill $pids 2>/dev/null || true
    sleep 1
  fi
  if lsof -nP -iTCP:"$BRIDGE_PORT" -sTCP:LISTEN >/dev/null 2>&1; then
    echo "❌ 无法释放 :$BRIDGE_PORT，请手动：lsof -iTCP:$BRIDGE_PORT -sTCP:LISTEN"
    exit 1
  fi
  echo "✅ :$BRIDGE_PORT 已空闲"
fi

if [[ "$DO_PATCH" -eq 1 ]]; then
  if [[ -x "$PATCH" ]] || [[ -f "$PATCH" ]]; then
    echo "→ 注入 Comni HTML 旁路桥…"
    bash "$PATCH"
  else
    echo "⚠️ 找不到 $PATCH，跳过注入"
  fi
fi

# 确保有一份本地 env（不覆盖已有 .env.local）
if [[ ! -f "$DUPLEX/.env.local" ]]; then
  cp "$DUPLEX/.env.example" "$DUPLEX/.env.local"
  echo "→ 已从 .env.example 生成 $DUPLEX/.env.local（请按需改 FOLLOW_PLAYER_NAME）"
fi

export MINICPM_REALTIME_URL="${MINICPM_REALTIME_URL:-ws://127.0.0.1:8006/v1/realtime?mode=audio}"
export COMNI_BRIDGE="${COMNI_BRIDGE:-1}"
if [[ "$DRY_RUN_FLAG" -eq 1 ]]; then
  export DRY_RUN=1
fi

echo
echo "接下来请："
echo "  1. 浏览器打开 https://localhost:8006/audio_duplex （戴耳机）"
echo "  2. 若未 --patch：Console 执行健康页里的 inject 一行"
echo "  3. 页内 Stop → Start 一次会话"
echo "  4. 说「过来」「停下」「自己去发育」"
echo
echo "启动 duplex-voice…"
cd "$DUPLEX"
exec pnpm start
