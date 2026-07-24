/**
 * @file 回声 / 外放策略说明与运行时开关
 *
 * 演示默认耳机。外放时扬声器回路可能导致模型听到自己的声音；
 * MiniCPM-o 双流后端自带听/说分离，但仍建议耳机。
 */

export interface EchoPolicy {
  /** 是否要求耳机演示 */
  preferHeadphones: boolean
  /** 外放时是否在文档/日志中警告 */
  warnOnSpeaker: boolean
}

export const defaultEchoPolicy: EchoPolicy = {
  preferHeadphones: true,
  warnOnSpeaker: true,
}

/**
 * 启动时打印回声策略
 * @param policy 策略
 */
export function logEchoPolicy(policy: EchoPolicy = defaultEchoPolicy): void {
  if (policy.preferHeadphones) {
    console.info('[aec-policy] 演示请戴耳机；外放可能引入回路噪声（MiniCPM Audio Full-Duplex 仍建议耳机）')
  }
  if (policy.warnOnSpeaker) {
    console.info('[aec-policy] 若必须外放：降低音量、远离麦，并观察是否出现自激；失败时切回耳机或文本降级')
  }
}
