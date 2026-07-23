# Contract: 外围服务接入 AIRI 事件总线（`@proj-airi/server-sdk`）

**Feature**: [../spec.md](../spec.md) | **Research**: [../research.md](../research.md) §8

`hackathon-services/` 下的所有新增外围服务（DST Bridge、Voice Orchestration、SLM Inference Bridge、Hardware Companion Bridge、Agent Arena、Replay-to-Skill、Shadow Observer）接入 AIRI 核心时，均使用 AIRI **既有、已发布**的 `@proj-airi/server-sdk` 客户端 SDK，而不是自建协议。这是 AIRI 自身多个官方服务（Discord Bot、Telegram Bot、Minecraft Bot 等）已经在用的同一套接入方式（见 `research.md` §1 的仓库检索结果）。

## 客户端用法（据 `packages/server-sdk` 官方 README 核实）

```typescript
import { Client } from '@proj-airi/server-sdk'

const client = new Client({
  name: 'your-service-name',  // 每个外围服务使用可辨识的名称，便于 AIRI 侧观测哪些模块在线
  autoConnect: false,
})

await client.connect()
// connect() 在以下条件全部满足后才 resolve：
//   1. WebSocket 已建立
//   2. 若配置了 token，鉴权已通过
//   3. 模块已完成自我声明（announce）

client.onEvent('input:text', async (event) => {
  // 处理来自 AIRI 核心或其他模块的事件
})

client.send({ type: '...', data: {} })       // 返回 false 而非静默丢弃（连接不可用时）
client.sendOrThrow({ type: '...', data: {} }) // 需要严格投递语义时使用
```

## 各外围服务的事件订阅/发布约定

| 服务 | 订阅（`onEvent`） | 发布（`send`） |
|---|---|---|
| DST Bridge | 桥接进程内部事件（来自 Lua Mod） | 标准化 `events()` 事件（对应 Game Adapter 契约） |
| Voice Orchestration | `input:text`（若需与既有文本输入通道协同）、打断触发信号 | 语音打断/取消事件 |
| SLM Inference Bridge | 反射层决策请求（若以事件形式暴露，否则直接进程内调用 `reflex-manager.ts`，见 `data-model.md` §6 注） | 模型动作输出（含置信度、回退标记） |
| Hardware Companion Bridge | 体验事件源（speaking/thinking/action/success/danger/hurt/death） | 无（纯消费方） |
| Agent Arena | Game Adapter 的 `events()` | 场景初始化/复位指令（经 `act()`） |
| Replay-to-Skill | 轨迹数据源 | 技能执行请求（经 `act()`，仅 `approved` 技能） |
| Shadow Observer | 无 | 新的原始视觉事件（接入 Perception 事件总线的事件定义管线） |

## 鉴权与网络边界

- 若 AIRI 实例配置了 token 鉴权，所有外围服务 MUST 在 `connect()` 时提供有效 token；未配置 token 的部署仅限受信任的本地/局域网环境（对应 `plan.md` Constraints 中的安全约束——MCP Server/Debug Server/Prismarine Viewer 等调试端口默认无鉴权，不得对公网暴露，同样的纪律适用于所有新增外围服务的调试接口）。
- 每个外围服务的 `name` 字段应保持稳定、可辨识，便于故障排查 Runbook（L1-07）中快速定位"哪个模块掉线了"。
