---
title: Full-Duplex Voice for Existing Minecraft Agent
date: 2026-07-23
category: architecture
module: Minecraft service and realtime voice
problem_type: architecture
component: services/minecraft
severity: medium
applies_when:
  - "Adding concurrent speech input and output to the Minecraft agent"
  - "Evaluating MiniCPM-o-4.5 with the existing Mineflayer runtime"
  - "Deciding whether Voice Hub should sit on the critical runtime path"
tags:
  - minecraft
  - mineflayer
  - full-duplex
  - voice
  - minicpm-o
  - interruption
---

# Existing Minecraft Agent + Full-Duplex Voice

## Decision

Keep `services/minecraft` as the game-control and game-state authority. Add full-duplex voice around it; do not replace its perception, planning, action, or cancellation path with a multimodal model.

MiniCPM-o-4.5 is suitable for concurrent speech input/output and optional player-screen understanding. It is not responsible for raw Minecraft control. The existing Mineflayer integration already owns that boundary.

Voice Hub is not a critical runtime dependency. It can inform audio-session design, but its current provider surface and Discord implementation do not provide a ready MiniCPM or Minecraft integration.

## Verified Current Minecraft Capability

The repository already runs a real Mineflayer bot, not an unbounded desktop-input agent.

```text
AIRI spark:command
  -> AiriBridge
  -> signal:airi_command
  -> Minecraft Brain decision cycle
  -> TaskExecutor
  -> ActionRegistry (Zod-validated tool parameters)
  -> Mineflayer action
  -> Minecraft server
```

Relevant ownership:

- `services/minecraft/src/airi/airi-bridge.ts` turns `spark:command` into `signal:airi_command`, which triggers a fresh Brain decision cycle.
- `services/minecraft/src/cognitive/action/action-registry.ts` resolves registered actions, validates their parameters, then executes them against the live Mineflayer instance.
- `services/minecraft/src/libs/mineflayer/core.ts` owns connection lifecycle, server events, and game interruption.
- `services/minecraft/src/airi/minecraft-context-service.ts` publishes bot position, health, game mode, other players, and configured owner identity to AIRI every five seconds when changed.

The bot interruption path already stops Pathfinder, PVP, digging, held-item use, and movement controls. This is the correct game stop boundary.

## Revised Responsibility Split

```text
Human microphone ─┐
                  ├─> full-duplex media gateway ─> MiniCPM-o-4.5
Agent speaker  <──┘                                  │
                                                     │ intent / transcript / response state
                                                     v
                                                AIRI command path
                                                     v
Minecraft state/events <── Mineflayer <── Brain / TaskExecutor / ActionRegistry
```

| Concern | Owner |
|---|---|
| Minecraft connection, actions, safety of game execution | `services/minecraft` / Mineflayer |
| Planning and game-task cancellation | Minecraft Brain and `TaskExecutor` |
| Structured game context | `MinecraftContextService` and Mineflayer events |
| Concurrent listening, speech generation, voice persona | MiniCPM-o-4.5 media gateway |
| Optional understanding of human player's screen | MiniCPM-o-4.5 vision input |
| Routing voice-derived intent into game tasks | AIRI bridge / existing command model |

## Interruption Policy

Speech barge-in and game cancellation are different operations.

- Normal human speech while AIRI speaks: immediately stop or flush pending assistant audio. Keep the current Minecraft task running.
- Explicit stop intent, such as “停下”, “不要打了”, or a safety condition: cancel the active Brain task and call Mineflayer interruption.
- New game instruction: route through the normal AIRI command path. It must create a new decision cycle, rather than directly invoking low-level movement from the voice transport.

Coupling every detected human utterance to `Mineflayer.interrupt()` would make natural conversation repeatedly stop the bot. Do not do this.

## Why MiniCPM-o-4.5 Fits

MiniCPM-o-4.5 documents concurrent streaming audio/video input with concurrent text/speech output, so it can remove the current half-duplex turn boundary. It may receive microphone audio continuously and, when useful, a reduced-rate stream of the human player's game screen.

The Minecraft bot should continue to prefer its structured server-side state over visual inference for its own actions. Screen frames add context unavailable to the bot, such as HUD state, what the human is focusing on, or local visual cues; they are not the primary control signal.

Reference: <https://huggingface.co/openbmb/MiniCPM-o-4_5>

## Voice Hub Assessment

Voice Hub advertises full-duplex speech and interruption, but its current source has these integration gaps:

- provider selection supports `doubao` and `qwen-dashscope`, not MiniCPM;
- provider input is audio-frame-only, so it cannot carry synchronized screen frames;
- Discord receive wiring is absent from the bot implementation;
- its generic audio egress pump has an empty packet-send implementation;
- runtime output is emitted internally and is not wired to Discord playback.

Therefore, do not place it between the media gateway and AIRI until these gaps are resolved and tested. The existing AIRI-to-Minecraft bridge is already the correct command boundary.

Reference: <https://github.com/412984588/voice-hub-oss>

## Required Integration Contract

The media gateway needs only a small, explicit contract with AIRI:

1. Ingest time-stamped microphone PCM and optionally time-stamped screen frames.
2. Stream Agent speech frames to the selected output device.
3. Emit a transcript or normalized high-level intent with conversation/session identity.
4. Accept current Minecraft status and task lifecycle events as context for spoken responses.
5. Flush output audio on barge-in without cancelling game work by default.
6. Request explicit game cancellation only after intent classification or an existing safety policy says to do so.

Do not expose direct Mineflayer movement, combat, or inventory methods to the media transport.

## Validation Criteria

Before treating the upgrade as complete, verify:

1. Human can speak while Agent is speaking; input remains accepted and stale Agent audio stops promptly.
2. Ordinary conversation does not cancel movement or long-running Minecraft tasks.
3. Explicit stop commands cancel the current game task and leave Mineflayer controls neutral.
4. Voice-derived game commands enter the existing AIRI command path and retain trace/session identity.
5. Minecraft status can be reflected in spoken responses without relying on screen OCR.
6. Optional screen frames do not block the audio loop or replace structured Mineflayer state.
7. End-to-end tests cover at least one overlapping-speech case and one explicit game-stop case.

## Scope of This Finding

This document records static repository inspection on 2026-07-23. It confirms existing code ownership and integration paths. It does not claim that a live MiniCPM media gateway, real Discord audio transport, or end-to-end full-duplex latency has been tested.
