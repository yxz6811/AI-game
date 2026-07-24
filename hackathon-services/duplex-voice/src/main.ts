/**
 * @file CLI 入口
 */

import process from 'node:process'

import { startDuplexVoice } from './index.js'

startDuplexVoice().catch((err) => {
  console.error('[duplex-voice] fatal', err)
  process.exit(1)
})
