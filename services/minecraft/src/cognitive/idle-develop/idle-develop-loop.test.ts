import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { IdleDevelopLoop, matchIdleDevelopCommand } from './idle-develop-loop'

const mocks = vi.hoisted(() => ({
  getInventoryCounts: vi.fn(() => ({})),
  gatherWood: vi.fn(async () => true),
  getLogsCount: vi.fn(() => 0),
  craftPlanksFromLog: vi.fn(async () => undefined),
  selectNextDevelopGoal: vi.fn(),
}))

vi.mock('../../skills/world', () => ({
  getInventoryCounts: mocks.getInventoryCounts,
}))

vi.mock('../../skills/actions/gather-wood', () => ({
  gatherWood: mocks.gatherWood,
  getLogsCount: mocks.getLogsCount,
}))

vi.mock('../../skills/actions/craft-planks-from-log', () => ({
  craftPlanksFromLog: mocks.craftPlanksFromLog,
  planksNameFromLog: (name: string) => `${name.replace(/^stripped_/, '').replace(/_log$/, '').replace(/_stem$/, '')}_planks`,
}))

vi.mock('../../skills/combat', () => ({
  attackEntity: vi.fn(async () => true),
}))

vi.mock('./policy', async () => {
  const actual = await vi.importActual<typeof import('./policy')>('./policy')
  return {
    ...actual,
    selectNextDevelopGoal: mocks.selectNextDevelopGoal,
  }
})

function createLogger() {
  const log = vi.fn()
  return {
    log,
    warn: log,
    error: log,
    withFields: () => ({ log, warn: log, error: log }),
    withError: () => ({ log, warn: log, error: log }),
  }
}

describe('matchIdleDevelopCommand', () => {
  it('matches enable and disable phrases', () => {
    expect(matchIdleDevelopCommand('自己去发育')).toBe('enable')
    expect(matchIdleDevelopCommand('自主发育')).toBe('enable')
    expect(matchIdleDevelopCommand('别自己动了')).toBe('disable')
    expect(matchIdleDevelopCommand('停止发育')).toBe('disable')
    expect(matchIdleDevelopCommand('跟我来')).toBeNull()
  })
})

describe('idleDevelopLoop', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.getInventoryCounts.mockReturnValue({})
    mocks.getLogsCount.mockReturnValue(0)
    mocks.selectNextDevelopGoal.mockReturnValue({
      id: 'gather_wood',
      label: '去砍点木头',
      kind: 'gather_wood',
      count: 4,
    })
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('does nothing while disabled', async () => {
    const loop = new IdleDevelopLoop({
      taskExecutor: { executeActionWithResult: vi.fn() } as any,
      logger: createLogger() as any,
      idleMs: 0,
      announce: false,
    }, false)

    const chat = vi.fn()
    loop.start({
      bot: { chat },
      reflexManager: {
        getContextSnapshot: () => ({ autonomy: { followActive: false, reflexEngaged: false } }),
        clearFollowTarget: vi.fn(),
      },
    } as any)

    await loop.tick()
    expect(mocks.gatherWood).not.toHaveBeenCalled()
    loop.stop()
  })

  it('runs gather_wood when enabled and idle', async () => {
    const loop = new IdleDevelopLoop({
      taskExecutor: { executeActionWithResult: vi.fn() } as any,
      logger: createLogger() as any,
      idleMs: 0,
      announce: false,
    }, true)

    const clearFollowTarget = vi.fn()
    loop.start({
      bot: { chat: vi.fn() },
      reflexManager: {
        getContextSnapshot: () => ({ autonomy: { followActive: false, reflexEngaged: false } }),
        clearFollowTarget,
      },
    } as any)

    await loop.tick()
    expect(clearFollowTarget).toHaveBeenCalled()
    expect(mocks.gatherWood).toHaveBeenCalledWith(
      expect.anything(),
      4,
      64,
      { quiet: true },
    )
    loop.stop()
  })

  it('clears follow and still runs when follow was active', async () => {
    const loop = new IdleDevelopLoop({
      taskExecutor: { executeActionWithResult: vi.fn() } as any,
      logger: createLogger() as any,
      idleMs: 0,
      announce: false,
    }, true)

    const clearFollowTarget = vi.fn()
    loop.start({
      bot: { chat: vi.fn() },
      reflexManager: {
        getContextSnapshot: () => ({ autonomy: { followActive: true, reflexEngaged: false } }),
        clearFollowTarget,
      },
    } as any)

    await loop.tick()
    expect(clearFollowTarget).toHaveBeenCalled()
    expect(mocks.gatherWood).toHaveBeenCalledTimes(1)
    loop.stop()
  })

  it('respects interrupt cooldown', async () => {
    const loop = new IdleDevelopLoop({
      taskExecutor: { executeActionWithResult: vi.fn() } as any,
      logger: createLogger() as any,
      idleMs: 0,
      interruptCooldownMs: 60_000,
      announce: false,
    }, true)

    loop.start({
      bot: { chat: vi.fn() },
      reflexManager: {
        getContextSnapshot: () => ({ autonomy: { followActive: false, reflexEngaged: false } }),
        clearFollowTarget: vi.fn(),
      },
    } as any)

    loop.onInterrupted('stop')
    expect(loop.getState()).toBe('cooldown')
    await loop.tick()
    expect(mocks.gatherWood).not.toHaveBeenCalled()
    loop.stop()
  })

  it('crafts planks from available logs', async () => {
    mocks.selectNextDevelopGoal.mockReturnValue({
      id: 'craft_planks',
      label: '合成木板',
      kind: 'craft',
      item: 'oak_planks',
      count: 1,
    })
    mocks.getInventoryCounts.mockReturnValue({ stripped_jungle_log: 7 })

    const loop = new IdleDevelopLoop({
      taskExecutor: { executeActionWithResult: vi.fn() } as any,
      logger: createLogger() as any,
      idleMs: 0,
      announce: false,
    }, true)

    loop.start({
      bot: { chat: vi.fn() },
      reflexManager: {
        getContextSnapshot: () => ({ autonomy: { followActive: false, reflexEngaged: false } }),
        clearFollowTarget: vi.fn(),
      },
    } as any)

    await loop.tick()
    expect(mocks.craftPlanksFromLog).toHaveBeenCalledWith(
      expect.anything(),
      'stripped_jungle_log',
      1,
    )
    loop.stop()
  })
})

describe('idleDevelopLoop player aggression', () => {
  it('interrupts develop after repeated player hits', () => {
    const interrupt = vi.fn()
    const clearFollowTarget = vi.fn()
    const chat = vi.fn()
    const pvp = { attack: vi.fn(), stop: vi.fn() }

    const loop = new IdleDevelopLoop({
      taskExecutor: { executeActionWithResult: vi.fn() } as any,
      logger: createLogger() as any,
      idleMs: 0,
      announce: false,
    }, true)

    loop.start({
      interrupt,
      bot: {
        chat,
        entity: { id: 1 },
        on: vi.fn(),
        off: vi.fn(),
        players: {
          Steve: { entity: { id: 2, position: { x: 0, y: 64, z: 0 } } },
        },
        pvp,
      },
      reflexManager: {
        getContextSnapshot: () => ({ autonomy: { followActive: false, reflexEngaged: false } }),
        clearFollowTarget,
      },
    } as any)

    const t0 = 5_000_000
    expect(loop.notePlayerDamage('Steve', t0)).toBe(false)
    expect(loop.notePlayerDamage('Steve', t0 + 500)).toBe(false)
    expect(loop.isEnabled()).toBe(true)
    expect(loop.notePlayerDamage('Steve', t0 + 1_000)).toBe(true)
    expect(loop.isEnabled()).toBe(false)
    expect(interrupt).toHaveBeenCalled()
    loop.stop()
  })

  it('keeps vendetta across death and retaliates on respawn with speech', () => {
    // ROOT CAUSE:
    // 被玩家打死若清空仇恨，重生后只会拒战/继续发育，形成死循环。
    // 死亡记仇 + 重生台词复仇。
    const interrupt = vi.fn()
    const chat = vi.fn()

    const loop = new IdleDevelopLoop({
      taskExecutor: { executeActionWithResult: vi.fn() } as any,
      logger: createLogger() as any,
      idleMs: 0,
      announce: false,
    }, true)

    loop.start({
      interrupt,
      bot: {
        chat,
        entity: { id: 1 },
        on: vi.fn(),
        off: vi.fn(),
        players: {
          Steve: { entity: { id: 2, position: { x: 0, y: 64, z: 0 } } },
        },
        pvp: { attack: vi.fn(), stop: vi.fn() },
      },
      reflexManager: {
        getContextSnapshot: () => ({ autonomy: { followActive: false, reflexEngaged: false } }),
        clearFollowTarget: vi.fn(),
      },
    } as any)

    const t0 = 9_000_000
    // 记攻击者（未满连击也要能死亡归因）
    expect(loop.notePlayerDamage('Steve', t0)).toBe(false)
    expect(loop.notePlayerKillDeath(t0 + 500)).toBe(true)
    expect(loop.getPendingVendetta()).toMatchObject({ username: 'Steve', reason: 'killed' })
    expect(chat).toHaveBeenCalledWith(expect.stringContaining('弄死'))
    expect(loop.isEnabled()).toBe(false)

    expect(loop.noteRespawnAfterVendetta()).toBe(true)
    expect(chat.mock.calls.some((c: unknown[]) => String(c[0]).includes('回来'))).toBe(true)
    loop.stop()
  })
})
