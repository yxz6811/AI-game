#!/usr/bin/env python3
"""下载 Comni 所需 MiniCPM-o-4.5 GGUF（Q4_K_M + audio/tts/vision/token2wav）。"""

from __future__ import annotations

import os
from pathlib import Path

from huggingface_hub import snapshot_download

MODEL_DIR = Path.home() / '.comni' / 'models' / 'MiniCPM-o-4_5-gguf'
ENDPOINT = os.environ.get('HF_ENDPOINT', 'https://hf-mirror.com')
PYTHON = '/Applications/Comni.app/Contents/Resources/python/bin/python3'

ALLOW = [
    'MiniCPM-o-4_5-Q4_K_M.gguf',
    'audio/*',
    'tts/*',
    'token2wav-gguf/*',
    'vision/MiniCPM-o-4_5-vision-F16.gguf',
]


def main() -> None:
    MODEL_DIR.mkdir(parents=True, exist_ok=True)
    print(f'[download] endpoint={ENDPOINT}')
    print(f'[download] local_dir={MODEL_DIR}')
    print('[download] ~8–10 GB，后台可挂着跑…')
    path = snapshot_download(
        repo_id='openbmb/MiniCPM-o-4_5-gguf',
        local_dir=str(MODEL_DIR),
        allow_patterns=ALLOW,
        endpoint=ENDPOINT,
        max_workers=4,
    )
    print(f'[download] done: {path}')


if __name__ == '__main__':
    main()
