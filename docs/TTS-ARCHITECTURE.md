# TTS Architecture — All-Neural Across 14 Locales (12 Languages + Chinese variants)

## Locale set (BCP-47)

prism-aac ships **14 locales** distributed across **12 written/spoken languages**:

| BCP-47 | Display | Notes |
|---|---|---|
| en | English | en-US default; en-GB voice variant |
| es | Spanish (Español) | — |
| fr | French (Français) | — |
| pt | Portuguese (Português) | pt-BR default |
| ro | Romanian (Română) | — |
| uk | Ukrainian (Українська) | — |
| ru | Russian (Русский) | — |
| de | German (Deutsch) | — |
| ja | Japanese (日本語) | — |
| ko | Korean (한국어) | — |
| **zh-Hans** | Chinese Simplified (简体中文) | Mainland China + Singapore — Mandarin |
| **zh-Hant** | Chinese Traditional (繁體中文) | Taiwan — Taiwanese Mandarin |
| **zh-HK** | Cantonese (廣東話) | Hong Kong + Macao — Traditional script, Cantonese |
| ar | Arabic (العربية) | RTL |

The legacy code `zh` is retained as a back-compat alias for `zh-Hans`. The
`canonicalizeLang()` helper in `engine/i18n.ts` normalizes every input
(`zh-CN`, `zh_TW`, `yue-HK`, etc.) into the canonical form before any
synalux portal call. **All four synalux services (azureTTS, textCorrect,
aiService, emergencyService) now use canonical BCP-47 codes.**

## Goal

Every prism-aac user gets **neural-quality TTS in their native locale**, fully
offline, with zero recurring cost — no exceptions.

A disabled child losing internet must not lose access to natural-sounding
speech. Web Speech API and espeak are kept only as last-resort safety nets.

## The 4-tier resilient chain

```
┌──────────────────────────────────────────────────────────────────────┐
│ Tier 1   Azure Neural TTS (online, emotional styles, all 12 langs)  │
│           - Paid tiers: all 12 langs                                 │
│           - Free tier:  ro/uk/ru/de/ko/ar (the 6 Kokoro doesn't speak) │
│             — Synalux absorbs the cost; low volume                   │
├──────────────────────────────────────────────────────────────────────┤
│ Tier 2   Offline NEURAL — per-language engine                        │
│                                                                       │
│           en/es/fr/pt/ja/zh   →  Kokoro-82M  (MOS ~4.5, top tier)    │
│           ro/uk/ru/de/ar      →  Piper       (MOS ~4.0, MIT)         │
│           ko                  →  MeloTTS     (MOS ~4.0, MIT)         │
│                                                                       │
│           All run in-browser via ONNX. Lazy-loaded per language.      │
├──────────────────────────────────────────────────────────────────────┤
│ Tier 3   Web Speech API (OS native voices, all 12 langs)             │
│           — fallback when neural offline engine fails                 │
├──────────────────────────────────────────────────────────────────────┤
│ Tier 4   WASM espeak-ng (robotic, last resort, always works)         │
└──────────────────────────────────────────────────────────────────────┘
```

## Per-language assignment

| Language | Tier 2 engine | Voice (default) | License | Disk |
|---|---|---|---|---|
| English (en) | **Kokoro** | `af_heart` (US), `bf_emma` (GB) | Apache-2.0 | 350 MB shared |
| Spanish (es) | **Kokoro** | `ef_dora` | Apache-2.0 | shared |
| French (fr) | **Kokoro** | `ff_siwis` | Apache-2.0 | shared |
| Portuguese (pt) | **Kokoro** | `pf_dora` (Brazilian) | Apache-2.0 | shared |
| Japanese (ja) | **Kokoro** | `jf_alpha` | Apache-2.0 | shared |
| Chinese Simplified (zh-Hans) | **Kokoro** | `zf_xiaobei` (Mandarin) | Apache-2.0 | shared |
| Chinese Traditional (zh-Hant) | **Kokoro** | `zf_xiaobei` (Mandarin pronunciation; Traditional UI) | Apache-2.0 | shared |
| Cantonese (zh-HK) | **Azure** (online) → **Web Speech** (offline) | `zh-HK-HiuMaanNeural` (Azure) | — | — |
| Romanian (ro) | **Piper** | `ro_RO/mihai-medium` | MIT | ~60 MB |
| Ukrainian (uk) | **Piper** | `uk_UA/ukrainian_tts-medium` | MIT | ~60 MB |
| Russian (ru) | **Piper** | `ru_RU/dmitri-medium` | MIT | ~60 MB |
| German (de) | **Piper** | `de_DE/thorsten-high` | MIT | ~75 MB |
| Arabic (ar) | **Piper** | `ar_JO/kareem-medium` | MIT | ~60 MB |
| Korean (ko) | **MeloTTS** | `KR-default` | MIT | ~80 MB |

**Lazy loading:** each engine and each Piper voice is only downloaded when
the user first speaks in that language. A monolingual English user pulls
350 MB (Kokoro). A polyglot user pulls up to ~700 MB across all 12 langs.

## Why this stack

| Engine | Wins | Loses |
|---|---|---|
| **Kokoro** | #1 open-source on TTS-Arena ELO; sounds genuinely human; emotional prosody | Only 9 langs (6 of ours) |
| **Piper** | Largest language coverage (35+); MIT; tiny per voice; runs everywhere | Quality below Kokoro — flat prosody on shorter utterances |
| **MeloTTS** | Real-time CPU; only practical permissive open-source Korean option | Below Kokoro on quality |

**Rejected**:
- **Coqui XTTS-v2** — Coqui Public Model License is non-commercial; incompatible with paid tiers.
- **Meta MMS-TTS** — CC-BY-NC; non-commercial only.
- **Bark (Suno)** — slow, ~10 s for short utterances; not real-time on AAC budgets.
- **F5-TTS / StyleTTS 2** — English-only or weak multilingual; no Korean/Arabic.

## Reliability rules

1. **Demote-on-failure for the entire session.** If Kokoro's WASM init fails
   on this device, we don't retry — we mark it demoted and use Tier 3.
2. **First-sample latency budget = 800 ms.** If neural offline is slower
   than that on first call, demote — AAC users can't wait.
3. **Tier 1 (Azure) is tried first when online**, regardless of which
   neural offline engine the language uses. Azure has emotional styles
   (friendly, calm, empathetic, etc.) that pure neural offline lacks.
4. **The chain NEVER fails silently.** If all four tiers fail, we surface
   a clear error to the user — communication is too important to silently
   drop.

## Cost model

| Component | Cost to Synalux |
|---|---|
| Kokoro / Piper / MeloTTS | $0 (all run on user device) |
| Azure Neural for paid tiers | included in subscription |
| Azure Neural for ro/uk/ru/de/ko/ar free tier | absorbed; expected low volume |
| Bandwidth for one-time model downloads | served from CDN, IndexedDB-cached, sub-cent per user lifetime |

## Service files

```
services/
├── speechService.ts        — orchestrator (the chain logic)
├── kokoroTTS.ts            — Kokoro-82M ONNX (in-browser)
├── piperTTS.ts             — Piper voices (in-browser onnxruntime-web)
├── meloTTS.ts              — MeloTTS-Korean (in-browser ONNX)
├── azureTTS.ts             — Tier 1 cloud
└── wasmTTS.ts              — Tier 4 espeak fallback
```

## Settings

`Settings → Voice Quality`:
- ☑ **Use neural offline voice** (default ON)
  Enables Tier 2. Off → skips straight to Web Speech.
- (paid tier) ☐ **Always use Azure when online**
  Forces Tier 1 even for Kokoro-supported langs (default off — Kokoro
  is offline + free, no reason to burn Azure quota by default).

## License compliance

All Tier 2 engines are Apache-2.0 or MIT. Compatible with:
- AGPL-3.0 (prism-aac's license)
- The Synalux paid hosted offering (commercial use OK)
- Self-hosted forks under AGPL-3.0
