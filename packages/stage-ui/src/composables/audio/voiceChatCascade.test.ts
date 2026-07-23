import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { createVoiceChatCascade } from './voiceChatCascade'

describe('createVoiceChatCascade', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('merges streaming STT sentences into one chat turn', async () => {
    const sendTextToChat = vi.fn()
    const postSpeakerCaption = vi.fn()
    const cascade = createVoiceChatCascade({
      isSuppressed: () => false,
      postSpeakerCaption,
      sendTextToChat,
    })

    cascade.handleStreamingSentenceEnd('帮我找一下')
    vi.advanceTimersByTime(600)
    cascade.handleStreamingSentenceEnd('附近的铁矿')
    await vi.advanceTimersByTimeAsync(1200)

    expect(postSpeakerCaption).toHaveBeenNthCalledWith(1, '帮我找一下')
    expect(postSpeakerCaption).toHaveBeenNthCalledWith(2, '附近的铁矿')
    expect(sendTextToChat).toHaveBeenCalledOnce()
    expect(sendTextToChat).toHaveBeenCalledWith('帮我找一下附近的铁矿')
  })

  it('uses the same spoken-turn buffer for recorder-backed STT', async () => {
    const sendTextToChat = vi.fn()
    const cascade = createVoiceChatCascade({
      isSuppressed: () => false,
      postSpeakerCaption: vi.fn(),
      sendTextToChat,
    })

    cascade.handleRecordingTranscript('keep')
    cascade.handleRecordingTranscript('mining')
    await cascade.flushNow()

    expect(sendTextToChat).toHaveBeenCalledOnce()
    expect(sendTextToChat).toHaveBeenCalledWith('keep mining')
  })

  it('drops final STT text while voice input is suppressed', async () => {
    const sendTextToChat = vi.fn()
    const postSpeakerCaption = vi.fn()
    const cascade = createVoiceChatCascade({
      isSuppressed: () => true,
      postSpeakerCaption,
      sendTextToChat,
    })

    cascade.handleStreamingSentenceEnd('assistant echo')
    cascade.handleRecordingTranscript('assistant echo')
    await cascade.flushNow()

    expect(postSpeakerCaption).not.toHaveBeenCalled()
    expect(sendTextToChat).not.toHaveBeenCalled()
  })

  it('keeps provider speech-end text caption-only to avoid duplicate ingestion', async () => {
    const sendTextToChat = vi.fn()
    const postSpeakerCaption = vi.fn()
    const cascade = createVoiceChatCascade({
      isSuppressed: () => false,
      postSpeakerCaption,
      sendTextToChat,
    })

    cascade.handleStreamingSentenceEnd('go home')
    cascade.handleStreamingSpeechEnd('go home')
    await cascade.flushNow()

    expect(postSpeakerCaption).toHaveBeenCalledTimes(2)
    expect(sendTextToChat).toHaveBeenCalledOnce()
    expect(sendTextToChat).toHaveBeenCalledWith('go home')
  })
})
