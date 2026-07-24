#!/usr/bin/env bash
# Gate 1 regression skeleton — assert critical processes/ports without crashing.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

fail=0

echo "[regression] check demo docs"
test -f demo/version-matrix.md || { echo "missing version-matrix"; fail=1; }
test -f demo/runbook.md || { echo "missing runbook"; fail=1; }
test -f demo/tier1-script.md || { echo "missing tier1-script"; fail=1; }
test -f demo/stage-gate-checklist.md || { echo "missing stage-gate-checklist"; fail=1; }

echo "[regression] check minecraft package"
test -f services/minecraft/package.json || { echo "missing minecraft service"; fail=1; }
test -f services/minecraft/.env.local || echo "WARN: .env.local missing (fill before live demo)"

echo "[regression] check mc-server artifacts present locally"
test -f demo/mc-server/paper-1.21.1-133.jar || echo "WARN: Paper jar not downloaded (see demo/mc-server/README.md)"
test -f demo/mc-server/server.properties || echo "WARN: server.properties missing"

echo "[regression] optional live ports (non-fatal if down)"
if nc -z 127.0.0.1 25565 2>/dev/null; then echo "OK MC :25565"; else echo "INFO MC :25565 down"; fi
if nc -z 127.0.0.1 6121 2>/dev/null; then echo "OK AIRI :6121"; else echo "INFO AIRI :6121 down"; fi

if [[ "$fail" -ne 0 ]]; then
  echo "[regression] FAILED"
  exit 1
fi
echo "[regression] PASSED (skeleton)"
