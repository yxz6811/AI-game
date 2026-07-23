import { createTranscriptBuffer } from '@proj-airi/pipelines-audio'

/** Dependencies and spoken-turn policy for forwarding final STT text into chat. */
export interface VoiceChatCascadeOptions {
  /** Returns whether assistant speech or lifecycle state currently blocks user input. */
  isSuppressed: () => boolean
  /** Publishes final user speech to the visible caption surface. */
  postSpeakerCaption: (text: string) => void
  /** Sends one aggregated spoken turn into the chat/LLM pipeline. */
  sendTextToChat: (text: string) => Promise<void> | void
  /**
   * Silence window used to merge adjacent final STT fragments.
   *
   * @default 1200
   */
  flushDelayMs?: number
  /**
   * Safety limit that flushes long turns without waiting for silence.
   *
   * @default 90
   */
  maxBufferedTextLength?: number
}

/**
 * Unifies streaming and recorder-backed STT results before chat ingestion.
 *
 * Streaming sentence callbacks and recorder results share one spoken-turn
 * buffer. Provider-level speech-end text remains caption-only because stream
 * providers already emit the same final text through sentence callbacks.
 */
export function createVoiceChatCascade(options: VoiceChatCascadeOptions) {
  const transcriptBuffer = createTranscriptBuffer({
    flushDelayMs: options.flushDelayMs ?? 1200,
    maxBufferedTextLength: options.maxBufferedTextLength ?? 90,
    flush: options.sendTextToChat,
  })

  function handleFinalTranscript(text: string) {
    if (options.isSuppressed())
      return

    const finalText = text.trim()
    if (!finalText)
      return

    options.postSpeakerCaption(finalText)
    transcriptBuffer.push(finalText)
  }

  function handleStreamingSpeechEnd(text: string) {
    if (options.isSuppressed())
      return

    const finalText = text.trim()
    if (finalText)
      options.postSpeakerCaption(finalText)
  }

  return {
    handleRecordingTranscript: handleFinalTranscript,
    handleStreamingSentenceEnd: handleFinalTranscript,
    handleStreamingSpeechEnd,
    flushNow: transcriptBuffer.flushNow,
    clear: transcriptBuffer.clear,
    dispose: transcriptBuffer.dispose,
  }
}
