import { describe, expect, it, vi } from 'vitest'

import { AiriBridge } from './airi-bridge'

function createBridgeHarness() {
  const handlers = new Map<string, (event: any) => void>()
  const client = {
    send: vi.fn(),
    onEvent: vi.fn((type: string, handler: (event: any) => void) => {
      handlers.set(type, handler)
    }),
    offEvent: vi.fn(),
  }
  const eventBus = {
    emit: vi.fn(),
  }
  const bridge = new AiriBridge(client as any, eventBus as any)
  bridge.init()

  return { bridge, eventBus, handlers, client }
}

describe('airiBridge spark command routing', () => {
  it('routes spark commands as AIRI commands instead of chat messages', () => {
    const { bridge, eventBus, handlers } = createBridgeHarness()
    const commandHandler = handlers.get('spark:command')

    expect(commandHandler).toBeDefined()

    commandHandler?.({
      data: {
        commandId: 'spark-1',
        intent: 'action',
        interrupt: false,
        priority: 'normal',
        guidance: {
          options: [
            {
              label: 'collect wood',
              steps: ['find a tree', 'chop it'],
            },
          ],
        },
      },
    })

    expect(eventBus.emit).toHaveBeenCalledWith(expect.objectContaining({
      type: 'signal:airi_command',
      payload: expect.objectContaining({
        type: 'airi_command',
        description: 'Directive from AIRI: "collect wood"',
        sourceId: 'airi',
        metadata: expect.objectContaining({
          message: 'collect wood',
          sparkCommandId: 'spark-1',
          sparkIntent: 'action',
        }),
      }),
    }))
    expect(eventBus.emit).not.toHaveBeenCalledWith(expect.objectContaining({
      type: 'signal:chat_message',
    }))

    bridge.destroy()
  })

  it('executes directAction fast path without waking airi_command', async () => {
    const { bridge, eventBus, handlers, client } = createBridgeHarness()
    const commandHandler = handlers.get('spark:command')
    const direct = vi.fn(async () => {})

    bridge.setDirectActionHandler(direct)

    commandHandler?.({
      data: {
        commandId: 'spark-fast-1',
        intent: 'action',
        interrupt: false,
        priority: 'high',
        directAction: {
          tool: 'followPlayer',
          params: { player_name: 'Steve', follow_dist: 2 },
        },
        guidance: {
          options: [{ label: '跟我来', steps: ['跟随 Steve'] }],
        },
      },
    })

    expect(direct).toHaveBeenCalledWith(
      expect.objectContaining({ tool: 'followPlayer' }),
      expect.objectContaining({ commandId: 'spark-fast-1' }),
    )
    expect(eventBus.emit).toHaveBeenCalledWith(expect.objectContaining({
      type: 'signal:airi_context',
    }))
    expect(eventBus.emit).not.toHaveBeenCalledWith(expect.objectContaining({
      type: 'signal:airi_command',
    }))

    await vi.waitFor(() => {
      expect(client.send).toHaveBeenCalledWith(expect.objectContaining({
        type: 'spark:emit',
        data: expect.objectContaining({
          eventId: 'spark-fast-1',
          state: 'done',
        }),
      }))
    })

    bridge.destroy()
  })

  it('infers idleDevelopEnable from guidance label without directAction', async () => {
    const { bridge, eventBus, handlers } = createBridgeHarness()
    const commandHandler = handlers.get('spark:command')
    const direct = vi.fn(async () => {})

    bridge.setDirectActionHandler(direct)

    commandHandler?.({
      data: {
        commandId: 'spark-develop-1',
        intent: 'action',
        interrupt: false,
        priority: 'normal',
        guidance: {
          options: [{ label: '自己去发育', steps: [] }],
        },
      },
    })

    expect(direct).toHaveBeenCalledWith(
      expect.objectContaining({ tool: 'idleDevelopEnable' }),
      expect.objectContaining({ commandId: 'spark-develop-1' }),
    )
    expect(eventBus.emit).not.toHaveBeenCalledWith(expect.objectContaining({
      type: 'signal:airi_command',
    }))

    bridge.destroy()
  })
})
