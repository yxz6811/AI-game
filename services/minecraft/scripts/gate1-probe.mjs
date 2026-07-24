/**
 * Gate 1 探针：第二个离线玩家进服 + 经 AIRI 下发正确形状的 spark:command。
 *
 * 用法（需 Paper + server-runtime + minecraft-bot 已运行）：
 *   cd services/minecraft && pnpm exec tsx scripts/gate1-probe.mjs
 */

import process from 'node:process'

import mineflayer from 'mineflayer'

import { Client } from '@proj-airi/server-sdk'
import { nanoid } from 'nanoid'

const MC = {
  host: '127.0.0.1',
  port: 25565,
  username: 'player1',
  auth: 'offline',
  version: '1.21.1',
}
const AIRI = 'ws://127.0.0.1:6121/ws'

/**
 * @param {number} ms 毫秒
 */
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms))
}

/**
 * @param {import('@proj-airi/server-sdk').Client} airi
 * @param {'action' | 'pause'} intentKind
 * @param {string} label
 * @param {string[]} steps
 * @param {'force' | false} interrupt
 * @param {'critical' | 'high'} priority
 */
function sendSpark(airi, intentKind, label, steps, interrupt, priority) {
  const commandId = nanoid()
  return airi.send({
    type: 'spark:command',
    data: {
      id: nanoid(),
      commandId,
      interrupt,
      priority,
      intent: intentKind,
      destinations: ['*'],
      guidance: {
        type: 'instruction',
        options: [{ label, steps, risk: 'low' }],
      },
    },
  })
}

const player = mineflayer.createBot(MC)
await new Promise((resolve, reject) => {
  player.once('spawn', resolve)
  player.once('error', reject)
  setTimeout(() => reject(new Error('player1 spawn timeout')), 30_000)
})
console.info('[probe] player1 spawned at', player.entity.position)

const airi = new Client({
  name: 'gate1-probe',
  url: AIRI,
  autoConnect: false,
  possibleEvents: ['spark:command', 'context:update'],
})
await airi.connect()
console.info('[probe] connected AIRI')

// Also send in-game chat (AIRI 第一层自然语言路径)
player.chat('跟我来')
console.info('[probe] in-game chat: 跟我来')
await sleep(12_000)

console.info('[probe] follow spark', sendSpark(
  airi,
  'action',
  '跟我来，使用 follow 工具跟随玩家 player1，保持约 2 格距离，不要只聊天',
  ['调用 follow/跟随 工具', '目标玩家：player1', '保持约 2 格距离'],
  false,
  'high',
))
await sleep(15_000)

player.chat('停下')
console.info('[probe] in-game chat: 停下')
await sleep(8_000)

console.info('[probe] stop spark', sendSpark(
  airi,
  'pause',
  '停下：立即取消跟随与移动，停止当前任务',
  ['立即停止当前移动与任务', '取消 follow', '等待新指令'],
  'force',
  'critical',
))
await sleep(8_000)

// 第三类：移动意图
console.info('[probe] move spark', sendSpark(
  airi,
  'action',
  '到 player1 旁边来（移动到玩家 player1 附近）',
  ['移动到玩家 player1 附近'],
  false,
  'high',
))
await sleep(15_000)

player.quit()
airi.close()
console.info('[probe] done')
process.exit(0)
