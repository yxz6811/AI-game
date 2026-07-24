# Version Matrix（Gate 1 + 第二层 A）

**Updated**: 2026-07-23

## Gate 1 / 第一层锁定

| 项 | 值 |
|----|-----|
| 本仓库锁定 commit | `1c65d4b83`（完整：`1c65d4b839cac1d9749fb3df43982a6416489bc1`） |
| 演示机器 | macOS 26.5.2 / arm64（Apple Silicon） |
| Node / pnpm | Node `v22.22.2` / pnpm `10.33.0` |
| JDK（MC 服） | Temurin OpenJDK `25.0.3` LTS |
| Minecraft 服务端 | Paper `1.21.1` build `133`（Stable） |
| 服务端路径 | `demo/mc-server/`（本地，jar/世界不入库） |
| 服务端地址 | `127.0.0.1:25565` |
| 认证模式 | `online-mode=false`（离线；仅受控本机演示） |
| 测试世界 | `demo_world`（creative / peaceful） |
| Bot 协议版本 | `BOT_VERSION=1.21.1`（须与 Paper 一致） |
| Bot 用户名 | `airi_bot` |
| LLM 提供商（默认模板） | DeepSeek（`OPENAI_*` 兼容入口） |
| LLM base URL | `https://api.deepseek.com/v1`（可按密钥提供商改） |
| LLM model | `deepseek-chat` / reasoning：`deepseek-reasoner` |
| AIRI 事件总线 | `@proj-airi/server-runtime` → `ws://127.0.0.1:6121/ws` |
| Minecraft 服务 | `@proj-airi/minecraft-bot`（`services/minecraft`） |

## Brain A（第二层 A / 真全双工，Gate 2A）

| 项 | 值 |
|----|-----|
| 模型 | `openbmb/MiniCPM-o-4_5` |
| 部署栈 | [MiniCPM-o-Demo](https://github.com/OpenBMB/MiniCPM-o-Demo)（Gateway + Worker + Backend） |
| 全双工模式 | Realtime API `mode=audio`（Audio Full-Duplex） |
| 公有试听 / 文档 | `https://minicpmo45.modelbest.cn` ；Realtime: `wss://host/v1/realtime?mode=audio` |
| 本地 Demo 默认 UI | 常见 `https://localhost:8006/audio_duplex`（以 compose 实际端口为准） |
| 精度后端 | PyTorch + CUDA（推荐演示） |
| 端侧后端 | `llama.cpp-omni` / `docker-compose.cpp.yml`（Mac / 低显存） |
| 采样率 | 上行约 16 kHz float32 PCM；下行约 24 kHz float32 PCM（官方协议） |

## Brain B / 本仓库

| 项 | 值 |
|----|-----|
| 服务 | `hackathon-services/duplex-voice` |
| AIRI SDK | `@proj-airi/server-sdk`（workspace） |
| 默认 AIRI WS | `ws://127.0.0.1:6121/ws` |
| 工具下发 | `spark:command` → `services/minecraft` |

## 备胎（非默认）

| 后端 | 说明 |
|------|------|
| NVIDIA PersonaPlex | 真双流，英主；LiveKit 有插件 |
| Kyutai Moshi | Docker `:8998` |

## 待现场填写（密钥勿提交）

| 项 | 值 |
|----|-----|
| `OPENAI_API_KEY` | 写在 `services/minecraft/.env.local`，勿提交 |
| 演示机器 GPU | （MiniCPM 用；Gate 1 可不填） |
| MiniCPM-o-Demo 实际 base URL | 例：`wss://127.0.0.1:8006/v1/realtime?mode=audio` |
| AIRI token（若启用） | 存 `.env.local`，勿提交 |

## Paper jar 来源

- Fill API：`https://fill.papermc.io/v3/projects/paper/versions/1.21.1/builds`
- Stable build 133：`paper-1.21.1-133.jar`
- SHA256：`39bd8c00b9e18de91dcabd3cc3dcfa5328685a53b7187a2f63280c22e2d287b9`
