#!/usr/bin/env bash
set -euo pipefail
PY="/Applications/Comni.app/Contents/Resources/python/bin/python3"
export HF_ENDPOINT="${HF_ENDPOINT:-https://hf-mirror.com}"
exec "$PY" "$(dirname "$0")/download-comni-model.py"
