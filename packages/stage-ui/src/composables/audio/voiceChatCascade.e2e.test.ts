import type { ChatHistoryItem, StreamingAssistantMessage, StreamOptions } from '@proj-airi/core-agent'
import type { IntentOptions, PlaybackItem } from '@proj-airi/pipelines-audio'
import type { ChatProvider } from '@xsai-ext/providers/utils'

import type { StageTtsSession } from '../../libs/speech/tts-session'

import { createChatOrchestratorRuntime } from '@proj-airi/core-agent'
import { createChatProvider } from '@xsai-ext/providers/utils'
import { describe, expect, it, vi } from 'vitest'

import { createStageTtsSession } from '../../libs/speech/tts-session'
import { resolveLlmTools, toolNameFrom } from '../../stores/llm-tool-resolver'
import { createVoiceChatCascade } from './voiceChatCascade'

const {
  sendServerChannelEventMock,
  useModsServerChannelStoreMock,
} = vi.hoisted(() => ({
  sendServerChannelEventMock: vi.fn(),
  useModsServerChannelStoreMock: vi.fn(),
}))

vi.mock('../../stores/mods/api/channel-server', () => ({
  useModsServerChannelStore: useModsServerChannelStoreMock,
}))

function createIntentStub(onLiteral: (text: string) => void) {
  return {
    intentId: 'voice-e2e-intent',
    writeLiteral: vi.fn(onLiteral),
    writeSpecial: vi.fn<(special: string) => void>(),
    writeFlush: vi.fn<() => void>(),
    end: vi.fn<() => void>(),
    cancel: vi.fn<(reason?: string) => void>(),
  }
}

function createPlaybackManagerStub() {
  return {
    schedule: vi.fn<(item: PlaybackItem<string>) => void>(),
    stopByIntent: vi.fn<(intentId: string, reason: string) => void>(),
  }
}

describe('voice -> LLM -> TTS + Minecraft cascade', () => {
  it('speaks the streamed reply while dispatching the Minecraft action', async () => {
    const executionOrder: string[] = []
    sendServerChannelEventMock.mockReset()
    sendServerChannelEventMock.mockImplementation(() => {
      executionOrder.push('minecraft')
    })
    useModsServerChannelStoreMock.mockReset()
    useModsServerChannelStoreMock.mockReturnValue({
      send: sendServerChannelEventMock,
    })

    const tools = await resolveLlmTools({
      builtInTools: [],
      debugTools: [],
      webSearchTools: [],
      activeTools: [],
    })
    const sparkTool = tools.find(tool => toolNameFrom(tool) === 'builtIn_emitSparkCommand')
    if (!sparkTool)
      throw new Error('Spark command tool was not resolved')

    const provider: ChatProvider = createChatProvider({
      apiKey: 'test-key',
      baseURL: 'http://127.0.0.1:1/v1/',
    })
    const intent = createIntentStub((text) => {
      executionOrder.push(`tts:${text}`)
    })
    const playbackManager = createPlaybackManagerStub()
    const sessionMessages: Record<string, ChatHistoryItem[]> = {
      'session-1': [{
        role: 'system',
        content: 'You are playing Minecraft with the user.',
        createdAt: 1,
        id: 'system-1',
      }],
    }
    const foregroundPatches: StreamingAssistantMessage[] = []
    const voiceSources: string[] = []

    let currentTtsSession: StageTtsSession | undefined
    const runtime = createChatOrchestratorRuntime({
      session: {
        ensureSession(sessionId) {
          sessionMessages[sessionId] ??= []
        },
        getSessionMessages: sessionId => sessionMessages[sessionId] ?? [],
        appendSessionMessage(sessionId, message) {
          sessionMessages[sessionId] ??= []
          sessionMessages[sessionId].push(message)
        },
        getSessionGeneration: () => 1,
      },
      context: {
        ingest: vi.fn(),
        snapshot: () => ({}),
      },
      foregroundStream: {
        patch: message => foregroundPatches.push(message),
        reset: vi.fn(),
      },
      llm: {
        async stream(_model, _chatProvider, messages, options?: StreamOptions) {
          await options?.onStreamEvent?.({
            type: 'text-delta',
            text: 'I will mine the nearby iron now. ',
          })

          await sparkTool.execute({
            destinations: ['hallucinated-minecraft-peer'],
            interrupt: 'soft',
            priority: 'normal',
            intent: 'action',
            ack: null,
            parentEventId: null,
            guidance: {
              type: 'instruction',
              persona: null,
              options: [{
                label: 'Mine nearby iron',
                steps: ['Find iron ore', 'Mine three blocks'],
                rationale: null,
                possibleOutcome: null,
                risk: null,
                fallback: null,
                triggers: null,
              }],
            },
            contexts: null,
          }, { messages, toolCallId: 'voice-e2e-tool-call' })

          await options?.onStreamEvent?.({
            type: 'text-delta',
            text: 'Stay close while I work.',
          })
          await options?.onStreamEvent?.({
            type: 'finish',
            finishReason: 'stop',
          })
        },
      },
      getActiveSessionId: () => 'session-1',
      getActiveProvider: () => 'test-provider',
      createId: vi.fn()
        .mockReturnValueOnce('assistant-1')
        .mockReturnValueOnce('voice-user-1')
        .mockReturnValue('generated-id'),
      onMessageSendStarted: event => voiceSources.push(event.source),
    })

    runtime.hooks.onBeforeMessageComposed(async () => {
      currentTtsSession = createStageTtsSession<string>({
        transport: 'rest',
        streaming: () => null,
        audioContext: undefined,
        playbackManager,
        openIntent: () => intent,
        intentOptions: () => ({
          ownerId: 'character-1',
          priority: 'normal',
          behavior: 'queue',
        } satisfies IntentOptions),
      })
    })
    runtime.hooks.onTokenLiteral(async (literal) => {
      currentTtsSession?.appendText(literal)
    })
    runtime.hooks.onStreamEnd(async () => {
      currentTtsSession?.finishInput()
    })
    runtime.hooks.onAssistantResponseEnd(async () => {
      currentTtsSession?.end()
    })

    const cascade = createVoiceChatCascade({
      isSuppressed: () => false,
      postSpeakerCaption: vi.fn(),
      async sendTextToChat(text) {
        await runtime.ingest(text, {
          model: 'test-model',
          chatProvider: provider,
          tools,
          input: {
            type: 'input:text:voice',
            data: {
              'transcription': text,
              'stage-tamagotchi': true,
            },
          },
        })
      },
    })

    cascade.handleStreamingSentenceEnd('帮我挖三块')
    cascade.handleStreamingSentenceEnd('附近的铁矿')
    await cascade.flushNow()

    const spokenText = intent.writeLiteral.mock.calls.flat().join('')
    expect(sessionMessages['session-1']).toEqual(expect.arrayContaining([
      expect.objectContaining({
        role: 'user',
        content: '帮我挖三块附近的铁矿',
      }),
      expect.objectContaining({
        role: 'assistant',
        content: 'I will mine the nearby iron now. Stay close while I work.',
      }),
    ]))
    expect(voiceSources).toEqual(['voice'])
    expect(spokenText).toBe('I will mine the nearby iron now. Stay close while I work.')
    expect(intent.writeFlush).toHaveBeenCalledOnce()
    expect(intent.end).toHaveBeenCalledOnce()
    expect(sendServerChannelEventMock).toHaveBeenCalledWith({
      type: 'spark:command',
      data: expect.objectContaining({
        intent: 'action',
        destinations: ['minecraft-bot'],
      }),
    })
    expect(executionOrder[0]).toMatch(/^tts:/)
    expect(executionOrder).toContain('minecraft')
    expect(executionOrder.at(-1)).toMatch(/^tts:/)
    expect(foregroundPatches.at(-1)?.content).toBe('I will mine the nearby iron now. Stay close while I work.')
  })
})
