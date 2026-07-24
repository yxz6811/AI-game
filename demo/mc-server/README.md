# Minecraft Gate 1 测试服

Paper `1.21.1` build `133`，离线模式，世界名 `demo_world`。

## 启动

```bash
cd demo/mc-server
./start.sh
```

默认监听 `127.0.0.1:25565`（`server.properties`）。控制台输入 `stop` 关闭。

## 与 Bot 对齐

| 项 | 值 |
|----|-----|
| `BOT_HOSTNAME` | `127.0.0.1` |
| `BOT_PORT` | `25565` |
| `BOT_VERSION` | `1.21.1` |
| `BOT_AUTH` | `offline`（对应 `online-mode=false`） |

详见 `demo/version-matrix.md`。

## 注意

- 默认已把 `Steve` / `player1` 写入 `ops.json`（权限 4），进服即可用 `/gamemode`、`/give` 等指令
- 命令方块已开（`enable-command-block=true`）；改 `server.properties` 后需重启服才生效
- `*.jar`、世界目录、日志不入库（见仓库根 `.gitignore`）
- 仅本机/局域网演示，勿对公网开放
