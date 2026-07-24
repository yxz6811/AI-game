/**
 * Gate 1 失败事件探针：下发不可执行指令，期望非静默回应。
 */

import { Client } from '@proj-airi/server-sdk'
import { nanoid } from 'nanoid'

const airi = new Client({
  name: 'gate1-fail',
  url: 'ws://127.0.0.1:6121/ws',
  autoConnect: false,
})
await airi.connect()
const commandId = nanoid()
airi.send({
  type: 'spark:command',
  data: {
    id: nanoid(),
    commandId,
    interrupt: false,
    priority: 'high',
    intent: 'action',
    destinations: ['*'],
    guidance: {
      type: 'instruction',
      options: [{
        label: '立刻去击杀末影龙并带回龙蛋（当前世界不可能完成，请明确说明无法执行）',
        steps: ['寻找末影龙', '击杀', '带回龙蛋'],
        risk: 'high',
      }],
    },
  },
})
console.info('[fail-probe] sent impossible command')
await new Promise(r => setTimeout(r, 25000))
airi.close()
console.info('[fail-probe] done')
