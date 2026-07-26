# TTS architecture and survival plan

This document separates what Prism ships today from candidates that still need
measurement. It replaces the former document, which described nonexistent
Kokoro, Piper, and MeloTTS browser services and an obsolete 14-locale set.

## Current production behavior

Prism AAC exposes 24 selectable locale entries representing 23 spoken
languages. `engine/i18n.ts` is the source of truth; the hidden legacy `zh`
alias resolves to `zh-Hans`.

| Surface | Current route | Network and concurrency behavior |
|---|---|---|
| Rapid AAC word/tile tap | `speakWord()` uses the device Web Speech API | Local. It must not call the portal TTS route. A new tap cancels the prior local utterance. |
| Explicit AAC sentence / Speak action | `speak()` tries the portal path through `speakAzure()`, then OS Web Speech, then WASM espeak | Portal currently tries Inworld first and its configured server fallbacks. OS and WASM keep communication available when cloud synthesis fails. |
| POS browser/device voice | Keep its local/browser fallback independent from AAC | A POS failure must not consume or block AAC speech capacity. |
| Twilio phone ordering | Provider-native phone TTS in the Synalux POS service | Twilio is primary. Do not send phone audio through a browser TTS engine. |
| Vonage phone ordering | Provider-native NCCO `talk` backup | Backup routing and confirmation events must remain synchronized with the Twilio order state. |

The rapid-tap route is the immediate capacity protection: frequent single-word
AAC use stays on-device and consumes zero Inworld connections.

## Open-source candidates, not current integrations

No local neural engine in this table is wired into Prism AAC today. Quality and
latency must be measured on target devices and production-sized infrastructure
before routing changes.

| Candidate | Officially stated strengths | License and coverage constraint | Proposed benchmark role |
|---|---|---|---|
| [Chatterbox Multilingual](https://github.com/resemble-ai/chatterbox) | Natural multilingual model; official repository lists 23 languages | MIT code/model release, but its 23-language set does not exactly match Prism's locale set | Primary natural-voice challenger to Inworld for sentences, especially English and Spanish |
| [Kokoro](https://github.com/hexgrad/kokoro) | Small 82M model with English, Spanish, French, Hindi, Italian, Japanese, Portuguese, and Mandarin voices | Apache-2.0; does not cover all Prism languages | Low-cost, low-latency challenger for supported languages |
| [Piper](https://github.com/OHF-Voice/piper1-gpl) | Maintained local engine with broad community voice coverage | Engine is GPL-3.0 and every downloaded voice has its own model-card license; naturalness varies | Coverage and degraded-mode fallback after per-voice license and listening review |
| [MeloTTS](https://github.com/myshell-ai/MeloTTS) | CPU real-time synthesis for English, Spanish, French, Chinese, Japanese, and Korean | MIT; narrower language coverage | Secondary supported-language latency comparison |
| [Coqui XTTS-v2](https://github.com/coqui-ai/TTS/blob/dev/docs/source/models/xtts.md) | Multilingual synthesis and voice cloning | Code and model licensing differ; commercial use requires explicit legal review | Research comparison only until licensing is approved |

There is no verified single permissively licensed model that covers every Prism
locale with Inworld-level naturalness. The survivable design is therefore a
routing portfolio, not another single-provider dependency.

## Proposed routing after evidence passes

1. Keep rapid AAC words on the OS voice path. No cloud request and no shared
   connection pool.
2. For explicit AAC sentences, race or route to the selected local neural
   service only after it passes the device and listening gates. Retain OS
   speech and WASM as independent fallbacks.
3. Keep Inworld as a bounded safety net during migration rather than the
   default for every utterance.
4. Keep Twilio provider-native TTS for the main phone workflow and Vonage
   provider-native TTS for backup. Both paths must emit the same order and
   confirmation state transitions.
5. Maintain at least two independently operable speech paths per production
   locale. A route is not independent if it shares the same account,
   connection cap, deployment, or model process.

## Acceptance thresholds

These are cutover gates, not measured results:

| Workload | Gate |
|---|---|
| Rapid AAC word | Local start p95 under 120 ms and zero network synthesis calls |
| Explicit AAC sentence | Warm TTFA p95 under 600 ms; cold TTFA p95 under 800 ms |
| POS phone response | First audio p95 under 500 ms on both Twilio primary and Vonage backup |
| Concurrency | 50 simultaneous sentence requests with error rate below 0.5% |
| Naturalness | Native-speaker MOS at least 4.0/5 and no more than 0.25 below the same-text Inworld baseline |
| Coverage | Every production locale has two passing paths; pronunciation defects block that locale's cutover |

Use `benchmarks/tts/corpus.json` and `npm run benchmark:tts` for reproducible
transport evidence. The corpus contains 72 cases: rapid AAC word, explicit AAC
sentence, and POS phone text for each of the 24 visible locale entries.
Transport latency does not establish naturalness, pronunciation, or clinical
acceptability, so blinded native-speaker listening remains mandatory.

## Inworld subscription decision

Keep the current Inworld subscription for one additional billing cycle while
the baseline and candidates are tested. Do not cancel based on repository
claims or a local smoke test. Downgrade or cancel only when:

- the exact 50-concurrent workload passes on the replacement deployment;
- native-speaker quality gates pass for every routed locale;
- current-staging AAC and both phone providers pass their route-specific E2E;
- alerting demonstrates the fallback path rather than silently dropping speech;
- one full observation window shows that paid Inworld traffic is bounded and
  no longer carrying critical coverage.

This makes the subscription temporary insurance, not the permanent capacity
plan.

## Source locations

- `services/speechService.ts`: device and portal orchestration
- `services/azureTTS.ts`: portal request, audio playback, and provider fallback
- `services/wasmTTS.ts`: final AAC synthesis fallback
- `engine/i18n.ts`: supported language and locale metadata
- `constants/phraseTranslations.ts`: code-derived benchmark phrases
- `scripts/benchmark-tts.mjs`: reproducible HTTP benchmark CLI
- `benchmarks/tts/corpus.json`: multilingual AAC and POS corpus
