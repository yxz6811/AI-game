# Quickstart: AI 游戏陪玩 Agent 验证指南（基于 Project AIRI）

**Feature**: [spec.md](./spec.md) | **Plan**: [plan.md](./plan.md) | **Data Model**: [data-model.md](./data-model.md) | **Contracts**: [contracts/](./contracts/)

本指南描述如何端到端验证六个用户故事，覆盖 spec.md 的 Acceptance Scenarios。第一层的具体命令已根据 `airi/services/minecraft` 的**真实** `package.json`/README 核实（见 research.md §1），不是猜测。

## 前置条件（第一层，MUST）

- Node.js（AIRI 要求）、`pnpm`
- 一个受控 Minecraft Java 版服务器与测试世界（本地或局域网，非公网）
- 已确定的 LLM 提供商与 API 凭证（经 `.env` 中 `OPENAI_API_BASEURL`/`OPENAI_API_KEY`/`OPENAI_MODEL` 配置，AIRI 通过 `xsAI` 支持 25+ 提供商，含 Claude）
- 已锁定 Project AIRI 的版本/commit（Phase 0 范围冻结阶段确定）

## 环境搭建（第一层，真实命令）

```bash
# 1. 克隆/引入锁定版本的 AIRI（建议作为 git submodule 引入本仓库的 airi/ 目录）
git clone https://github.com/moeru-ai/airi.git airi
cd airi && git checkout <锁定的 commit>

# 2. 安装 workspace 依赖
pnpm i

# 3. 配置 Minecraft 服务
cp services/minecraft/.env services/minecraft/.env.local
# 编辑 services/minecraft/.env.local：
#   OPENAI_API_BASEURL / OPENAI_API_KEY / OPENAI_MODEL
#   BOT_USERNAME / BOT_HOSTNAME / BOT_PORT / BOT_VERSION
#   （若使用正版账号在线验证，取消注释 BOT_AUTH='microsoft'）
#   ENABLE_MCP_SERVER / ENABLE_DEBUG_SERVER / ENABLE_MINECRAFT_VIEWER 保持 false（安全默认值，不对外暴露）

# 4. 启动 Minecraft 服务
pnpm -F @proj-airi/minecraft-bot dev
# 或：cd services/minecraft && pnpm dev

# 5. 确认 Bot 自动连接到 AIRI 与 Minecraft 服务器（README 原文承诺的行为）
```

## 验证场景

### 场景 A — User Story 1（第一层保底）

对应 spec.md User Story 1 的 7 条 Acceptance Scenarios：

1. **冷启动**：从全新环境执行上述启动命令，确认目标机器可稳定进入 AIRI 服务（L1-01）。
2. **同世界验证**：真人玩家与 AIRI Bot 分别登录测试服务器，确认二者出现在同一世界（L1-02）。
3. **状态识别**：观察 AIRI 侧（Stage 设置面板或日志）确认 Bot 在线状态与基本游戏状态已被接收（L1-03，对应 `services/minecraft` 通过 `@proj-airi/server-sdk` 向 AIRI 核心报告状态）。
4. **基础指令**：玩家用 AIRI 现有输入方式发出"跟我来""到这里""停止"，确认 Bot 在跟随/停止/移动/交互中至少执行三类（L1-04）。
5. **事件回流**：制造一次成功事件（如任务完成）与一次失败/不可执行事件，确认 AIRI 产生合理回应（L1-05）。
6. **演示脚本**：固化一段 3-5 分钟脚本，连续执行三次，确认无阻断级崩溃（L1-06）。
7. **故障恢复**：人为制造一次常见故障（如服务器重启），按 Runbook 操作，确认 2 分钟内恢复（L1-07）。

**验收标准**：以上 7 项均通过，即可判定第一层（MVP）交付，Gate 1 通过，可投入第二层开发。

### 场景 B — User Story 2（全双工语音）

1. 玩家与 AI 连续语音对话，AI 回复期间玩家直接插话，重复 20 次，统计正确停止旧语音的次数（目标 ≥18/20，V2-03）。
2. AI 执行游戏任务期间，玩家说"等等/停下/回来"，重复 10 次，统计正确取消旧任务并执行新指令的次数（目标 ≥8/10，V2-04）。
3. 连续 10 分钟对话，观察是否出现 AI 自己触发自己识别的自激现象（V2-05）。
4. 人为制造一次响应变慢，查看延迟看板/日志，确认可定位到 VAD/STT/LLM/TTS/行动中的具体阶段（V2-06）。

### 场景 C — User Story 3（Game Adapter + DST）

1. 分别调用 `observe()` 读取 Minecraft 与 DST 的角色状态，确认映射到同一顶层结构（G2-01）。
2. 运行第一层回归脚本（场景 A 的演示脚本），确认 Minecraft Adapter 包装后原有演示仍可通过（G2-03）。
3. AI 角色进入受控 DST 世界，验证可执行 follow/move/collect/interact/stop/say 中的基础动作（G2-04/05）。
4. 检查两款游戏的实现代码，确认核心编排逻辑未被复制，仅 Adapter/Bridge 层不同（G2-06）。

### 场景 D — User Story 4（SLM/SSM 反射模型，可选）

1. 检查模型可输出动作范围，确认至少覆盖 5 类（follow/stop/collect/interact/avoid/return）且不承担聊天（M3-01）。
2. 在冻结测试集上运行离线评测，确认动作正确率 ≥90% 目标且报告可复现（M3-04）。
3. 在固定 Demo 场景现场断开模型服务，确认自动回退 AIRI 基线且主链路继续运行（M3-05）。
4. 对比模型与 AIRI 基线的决策延迟，确认降低目标 ≥50%（M3-06）。

### 场景 E — User Story 5（实体硬件桌宠，可选）

1. 硬件上电，确认独立进入待机状态（H3-01）。
2. 触发至少 5 类体验事件，确认肉眼可清晰区分（H3-04）。
3. 现场拔电/断网，确认主 Demo（第一、二层）不受影响继续运行（H3-06）。

### 场景 F — User Story 6（研究型增强，任选其一，可选）

- **Agent Arena**：3 个标准任务各自动运行 10 轮，确认生成可比较的成功率/延迟/失败归因报告（A4-03/04）。
- **Replay-to-Skill**：生成的技能在不同初始位置连续运行 3 次，确认至少成功 2 次且支持"停止"中断（S4-06）。
- **Shadow Observer**：固定场景测试三类视觉事件，确认识别准确率 ≥80%、延迟 ≤1 秒，且关闭视觉服务后任务执行不受影响（W4-06、W4-05）。

## 指标验证汇总

| 指标 | 目标 | 层级/必要性 | 数据来源 |
|---|---|---|---|
| 五段链路可观察证据 | 有 | 第一层，必须 | 场景 A |
| 演示脚本连续成功 | 3 次 | 第一层，必须 | 场景 A-6 |
| 故障恢复时间 | ≤2 分钟 | 第一层，必须 | 场景 A-7 |
| 语音打断成功率 | ≥90%（18/20） | 第二层，目标 | 场景 B-1 |
| 动作取消成功率 | ≥80%（8/10） | 第二层，目标 | 场景 B-2 |
| 跨游戏复用 | 是 | 第二层，必须 | 场景 C |
| SLM/SSM 正确率 | ≥90% | 第三层，可选 | 场景 D-2 |
| SLM/SSM 延迟降低 | ≥50% | 第三层，可选 | 场景 D-4 |
| 桌宠可见事件 | ≥5 类 | 第三层，可选 | 场景 E-2 |
| 故障隔离 | 前序层不受影响 | 第三层，必须 | 场景 E-3 |
| Arena 可重复性 | 3 任务×10 轮 | 第四层，可选 | 场景 F |
| Replay 技能复现 | 3 次≥2 次成功 | 第四层，可选 | 场景 F |
| 视觉事件准确率 | ≥80%，≤1s | 第四层，可选 | 场景 F |
| 研究模块隔离 | 前三层不受影响 | 第四层，必须 | 场景 F |

## 已知限制与风险提醒

- `airi/services/minecraft` 官方标注为"废弃路径"，未来可能被 Fabric mod 运行时取代——第一至三层的工作在此服务上进行是当前阶段的合理选择，但不代表长期稳定的实现基础（见 research.md §1、plan.md Constraints）。
- 不得将 `ENABLE_MCP_SERVER`/`ENABLE_DEBUG_SERVER`/`ENABLE_MINECRAFT_VIEWER` 开启并暴露到公网或不受信网络。
- 不得连接不受信任的公共 Minecraft/DST 服务器（LLM 生成的动作计划虽运行在沙箱中，仍驱动可访问本机资源的真实进程）。
