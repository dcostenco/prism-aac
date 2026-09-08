# TTS Architecture — cloud neural voice with offline fallbacks

> **TL;DR** — every phrase is spoken through a quality-first chain that never fails silently: **persistent speech cache** (replays without a request) → **Cloud tier** through the Synalux portal (Inworld TTS-2, Azure Neural for the languages Inworld lacks, Gemini TTS as the last cloud resort) → **OS Web Speech** voices (offline) → **WASM espeak-ng** (always works). Speed-critical taps never wait on the network: a cache hit plays immediately and a cloud failure falls through to device speech.

Current state: 1.9.0 (2026-09-08). Earlier revisions of this document described in-browser neural engines (Kokoro, Piper, MeloTTS); those were never shipped and the files do not exist.

## Locales

25 languages / 28 locales — the list in `constants/languageRules.ts`: en, es, fr, pt, ro, ru, uk, de, ja, ko, zh (Simplified), zh-Hans, zh-Hant (Taiwan), zh-HK (Hong Kong), ar, hi, it, pl, he, nl, vi, tl, tr, id, bg, am, sw, bn. Amharic, Swahili and Bengali UI strings are machine-translated pending native-speaker review (`constants/translationReviewStatus.ts`). `engine/i18n.ts` canonicalizes inputs such as `zh-CN` or `zh_TW` before any portal call.

## The chain (`services/speechService.ts` → `services/azureTTS.ts`)

```
Speak(text, lang, tone, rate, volume)
  │
  ├─ 0. Speech cache  services/azureTTS.ts + services/speechAudioCache.ts
  │     30-clip memory cache, then IndexedDB (20 MiB / 512 clips / 30 days, LRU).
  │     Key = endpoint + exact text + language + tone + rate + volume + voice.
  │     Hit → plays at once, no request, never metered. Offline → cache only.
  │
  ├─ 1. Cloud tier (online)
  │     a. POST /api/v1/tts/public        Inworld TTS-2 for everyone, no auth,
  │        per-IP rate limit. The portal routes languages Inworld does not
  │        speak (e.g. ro, uk) to Azure Neural server-side.
  │     b. POST /api/v1/tts (cookie auth)  only when (a) answers 502:
  │        Azure Neural fallback for accounts the portal allows.
  │     c. POST /api/v1/prism-aac/tts/public   Gemini 2.5 Flash TTS, no auth,
  │        when (a)/(b) fail. Plain text with a read-aloud instruction (the
  │        TTS-only model otherwise treats a lone word as a chat prompt).
  │     Response headers X-TTS-Backend / X-TTS-Voice / X-TTS-Model decide
  │     whether the audio is kept on disk (provider/voice fallbacks are
  │     played but not cached as the requested voice).
  │
  ├─ 2. Web Speech API (OS voices, offline, all locales on most devices)
  │     Premium/enhanced voice preferred; a voice-reports-success-but-no-audio
  │     guard falls through.
  │
  └─ 3. WASM espeak-ng  services/wasmTTS.ts  (robotic, last resort)
```

Tone (declarative / interrogative / exclamatory) is inferred from punctuation and mapped to an Inworld style only for languages whose voices support it (`STYLE_SUPPORTED_LANGS`). Rate is normalized from the stored slider to the portal scale (`computeNormalizedRate`); the portal builds any SSML server-side.

## Cloud plan and metering

The optional Prism AAC Cloud subscription (US$4.99/month) provides 50,000 newly generated speech characters and 100 cloud AI requests per month. Only successful new synthesis on tier 1 counts; cache hits, device voices and failed requests never do. Metering is enforced by the portal (`withAacCloudUsage`), not the client, and is switched on separately from sales; until it is on, tier 1 behaves as before for every account. Anonymous callers on the two public routes are never gated.

## Reliability rules

1. **Never fail silently.** Every tier reports `tts-attempt` / `tts-success` / `tts-give-up` on `ttsHealthBus`; the caregiver Insights tab shows the success rate and fallback counts.
2. **Duplicate suppression.** A repeat of the same text within `DEDUP_MS` keeps the current playback instead of racing it.
3. **Interrupt semantics.** An explicit interrupt aborts in-flight fetches and stops the current source so two buffers never overlap.
4. **Offline.** Cache first; on a miss the chain skips straight to device speech.

## Settings

`Settings → Voice`: voice picker per language (free; the voice catalog endpoint is public), speed, volume, speech-cache usage with Clear and retention on/off. `Settings → Synalux Account → Cloud speech and AI`: plan, allowance, subscribe / restore / manage.

## Service files

```
services/
├── speechService.ts      — orchestrator: cache → cloud → Web Speech → espeak
├── azureTTS.ts           — cloud tier (Inworld / Azure / Gemini), dedup, cache hooks
├── speechAudioCache.ts   — IndexedDB persistence (see docs/SPEECH_CACHE.md)
├── ttsHealthBus.ts       — attempt / success / give-up events
└── wasmTTS.ts            — espeak-ng fallback
```
