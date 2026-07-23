import type { Tool } from '@xsai/shared-chat'

import { beforeEach, describe, expect, it, vi } from 'vitest'

import { resolveLlmTools, toolNameFrom } from './llm-tool-resolver'

// The default (non-injected) web-search branch reads the module store and the
// tools barrel; mock both so the configured-gate + key-trim logic can be
// exercised without real Pinia state or a live Tavily factory.
const {
  createWebSearchToolsMock,
  sendServerChannelEventMock,
  useModsServerChannelStoreMock,
  useWebSearchStoreMock,
} = vi.hoisted(() => ({
  createWebSearchToolsMock: vi.fn(),
  sendServerChannelEventMock: vi.fn(),
  useModsServerChannelStoreMock: vi.fn(),
  useWebSearchStoreMock: vi.fn(),
}))

vi.mock('../tools', async (importOriginal) => {
  const actual = await importOriginal() as Record<string, unknown>
  return { ...actual, createWebSearchTools: createWebSearchToolsMock }
})

vi.mock('./modules/web-search', () => ({
  useWebSearchStore: useWebSearchStoreMock,
}))

vi.mock('./mods/api/channel-server', () => ({
  useModsServerChannelStore: useModsServerChannelStoreMock,
}))

function createTool(name: string, description = `${name} description`): Tool {
  return {
    type: 'function',
    function: {
      name,
      description,
      parameters: {
        type: 'object',
        properties: {},
        required: [],
        additionalProperties: false,
      },
    },
    execute: vi.fn(),
  } as Tool
}

describe('toolNameFrom', () => {
  it('reads function.name', () => {
    expect(toolNameFrom(createTool('runtime_read_context'))).toBe('runtime_read_context')
  })
})

describe('resolveLlmTools', () => {
  beforeEach(() => {
    sendServerChannelEventMock.mockReset()
    useModsServerChannelStoreMock.mockReset()
    useModsServerChannelStoreMock.mockReturnValue({
      send: sendServerChannelEventMock,
    })
  })

  it('routes the default spark command tool to the Minecraft service', async () => {
    const tools = await resolveLlmTools({
      builtInTools: [],
      debugTools: [],
      webSearchTools: [],
      activeTools: [],
    })

    expect(tools).toHaveLength(1)

    await tools[0].execute({
      destinations: ['hallucinated-destination'],
      interrupt: 'soft',
      priority: 'normal',
      intent: 'action',
      ack: null,
      parentEventId: null,
      guidance: null,
      contexts: null,
    }, { messages: [], toolCallId: 'tool-call-id' })

    expect(sendServerChannelEventMock).toHaveBeenCalledWith({
      type: 'spark:command',
      data: expect.objectContaining({
        destinations: ['minecraft-bot'],
      }),
    })
  })

  it('prefers a later runtime tool with the same name over an earlier built-in tool', async () => {
    const builtInTool = createTool('duplicate_tool', 'Built-in version.')
    const runtimeTool = createTool('duplicate_tool', 'Runtime version.')

    const tools = await resolveLlmTools({
      builtInTools: [builtInTool],
      debugTools: [],
      sparkCommandTools: [],
      webSearchTools: [],
      activeTools: [runtimeTool],
    })

    expect(tools).toHaveLength(1)
    expect(tools[0]).toBe(runtimeTool)
  })

  it('places custom tools before active runtime tools so runtime tools can win by name', async () => {
    const builtInTool = createTool('built_in_tool')
    const customTool = createTool('duplicate_tool', 'Custom version.')
    const runtimeTool = createTool('duplicate_tool', 'Runtime version.')

    const tools = await resolveLlmTools({
      builtInTools: [builtInTool],
      debugTools: [],
      sparkCommandTools: [],
      webSearchTools: [],
      customTools: [customTool],
      activeTools: [runtimeTool],
    })

    expect(tools).toEqual([builtInTool, runtimeTool])
  })

  it('includes injected web-search tools in the resolved list', async () => {
    const builtInTool = createTool('built_in_tool')
    const webSearchTool = createTool('web_search')

    const tools = await resolveLlmTools({
      builtInTools: [builtInTool],
      debugTools: [],
      sparkCommandTools: [],
      webSearchTools: [webSearchTool],
      activeTools: [],
    })

    expect(tools).toEqual([builtInTool, webSearchTool])
  })

  describe('default web-search branch (module store gate)', () => {
    beforeEach(() => {
      createWebSearchToolsMock.mockReset()
      useWebSearchStoreMock.mockReset()
    })

    it('omits web_search when the web-search module is not configured', async () => {
      useWebSearchStoreMock.mockReturnValue({ configured: false, apiKey: '' })
      const builtInTool = createTool('built_in_tool')

      // webSearchTools is intentionally omitted so resolveWebSearchTools falls
      // through to the module store instead of the injected source.
      const tools = await resolveLlmTools({
        builtInTools: [builtInTool],
        debugTools: [],
        sparkCommandTools: [],
        activeTools: [],
      })

      expect(tools).toEqual([builtInTool])
      expect(createWebSearchToolsMock).not.toHaveBeenCalled()
    })

    it('mounts web_search with a trimmed key when the module is configured', async () => {
      const webSearchTool = createTool('web_search')
      createWebSearchToolsMock.mockResolvedValue([webSearchTool])
      // A key pasted with surrounding whitespace still reads as configured, so
      // the resolver must trim it before handing it to the factory.
      useWebSearchStoreMock.mockReturnValue({ configured: true, apiKey: '  tvly-key\n' })
      const builtInTool = createTool('built_in_tool')

      const tools = await resolveLlmTools({
        builtInTools: [builtInTool],
        debugTools: [],
        sparkCommandTools: [],
        activeTools: [],
      })

      expect(createWebSearchToolsMock).toHaveBeenCalledWith({ apiKey: 'tvly-key' })
      expect(tools).toEqual([builtInTool, webSearchTool])
    })
  })
})
