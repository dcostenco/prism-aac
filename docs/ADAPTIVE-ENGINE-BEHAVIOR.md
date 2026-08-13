# Adaptive Engine — Behavior & Cross-System Contract

> **TL;DR** — the same ACT-R cognitive memory model used by Carnegie Mellon for decades runs locally inside PrismAAC. Phrases the child uses today rise; phrases unused for a year fade. Caregiver corrections become training data automatically.

## At a glance

- ✅ **Recency × frequency × per-user history** drives every prediction tile — not a static popularity list
- ✅ **`d = 0.25` lesson-rate decay** — ~1-year half-life for unused phrases
- ✅ **Tone auto-switch** — declarative / interrogative / exclamatory inferred from punctuation
- ✅ **Caregiver correction → training data** without an explicit labelling step
- ✅ Cross-system contract: same algorithm runs identically in PrismAAC, the Synalux portal, and Prism Coder

<details>
<summary><strong>📐 Full behavior contract + cross-system implementation</strong></summary>

> Single source of truth for how PrismAAC, Synalux portal, and prism-mcp
> observe the user, share that observation, and shape prism-coder's
> behavior in response.

This document covers the change shipped in:

- `prism-aac` `ef406a9` — engine rewrite, wiring, auto tone switch
- `synalux-platform` `1e5aa77` — canonical schema mirror, sync API, prompt
  injection
- `prism-mcp` `871b8fe` — MCP tool definitions

The previous commit (`ce7221b`) introduced the adaptive engine but shipped
with **zero consumers** — the file existed and was tested in isolation,
but no production code path called any of its functions. That gap is what
this change closes, alongside fixes for numerical correctness, safety,
and performance issues surfaced during code review.

---

## 1. What changed in observable behavior

### 1.1 Speech now matches the message

**Before** — every TTS call used a hard-coded tone (`'friendly'` by
default; explicit `tone` arg required to deviate).

**After** — `speak()` defaults to `tone='auto'`. The engine inspects the
text and routes voice style + speech rate accordingly:

| Detected tone | When | Azure style | Rate multiplier |
|---|---|---|---|
| `serious` | text contains help/hurt/scared/911/bleeding/choking/etc | `sad` | × 0.85 (clamped ≥ 0.7) |
| `excited` | exclamation + happy word | `cheerful` | × 1.1 (clamped ≤ 1.4) |
| `friendly` | happy word OR question | `friendly` | unchanged |
| `empathetic` | tired/sleep/calm/done | `gentle` | × 0.9 (clamped ≥ 0.7) |
| `neutral` | none of the above | `general` | unchanged |

Caller can pass an explicit `ToneStyle` to override (e.g. a celebration
animation forcing `'cheerful'` regardless of text).

Stem detection: `"hurts"`, `"hurting"`, `"bleeding"` all match through
crude `-ing/-ed/-s` stripping. Punctuation-attached words
(`"help!"`, `"hurt."`) are tokenized correctly — the prior implementation
missed these because it split on whitespace only.

### 1.2 Cursor learns the child's motor rhythm

Each successful dwell trigger feeds the actual dwell-to-trigger latency
into `recordDwell()`. Each cursor velocity sample feeds `recordMoveSpeed()`.
After 10 samples the engine starts returning adapted values:

- `getAdaptedDwellMs()` — running avg × 1.2 buffer, clamped `[400, 3000]ms`
- `getAdaptedCursorSmoothing()` — `0.06` for slow movers, `0.20` for fast,
  `0.12` default

After 1000 samples the running average switches to EMA (α = 0.02,
half-life ≈ 35 samples) so the system continues to track real changes
in motor speed rather than freezing at the cap.

### 1.3 Calibration only learns from the locked person

The adaptive calibration in `bodyPoseService.ts` was previously updated
on every pose sample. With identity locking added in `42d55c0`, the
calibration step is now gated on `lockedAnchor != null` so siblings or
parents passing through frame don't permanently expand the calibration
range.

Expand and decay rates were rebalanced from 0.02 / 0.0005 (40× imbalance)
to 0.01 / 0.001 (10×). Inputs and outputs are clamped to `[0, 1]` to
defend against any garbage MediaPipe returns on first frames.

### 1.4 Vocabulary tracks current routines, not last summer

`timeOfDayPatterns` now stores `{w, t, n}` per word and applies a 30-day
decay on read. Once a word hasn't been heard in 30 days, it disappears
from `getContextSuggestions()`.

Categories are ranked by `count × exp(-age_days / 14)` instead of
recency-only. A category used 100× yesterday now correctly outranks one
used once today.

### 1.5 Dominant mood doesn't whipsaw

`recordTone()` updates `dominantMood` only when ≥6 of the last 10 events
agree. A single 'serious' utterance no longer puts the system in
`'urgent'` mode for the next half hour.

### 1.6 Emergency words are uncorrectable

Even if a caregiver mistakenly records `'help' → 'helper'`,
`correctPronunciation('help')` returns `'help'` unchanged. The set
guarded:

```ts
['help', 'hurt', 'scared', 'pain', 'emergency', 'call', '911',
 'bleed', 'bleeding', 'choking', 'fire', 'stuck', 'lost']
```

This is a hard guard at the function level — `recordMispronunciation()`
also refuses to write the entry in the first place.

### 1.7 Noise threshold can't silence the child

`getNoiseAdaptedThreshold()` is clamped to `≤ -20 dB`. Without this, a
loud car would push the threshold above what any consumer mic can hit,
and voice recognition would silently die.

---

## 2. Single source of truth — schema across three repos

The same `AdaptiveProfile` interface is defined in three places:

| Repo | File | Role |
|---|---|---|
| `prism-aac` | `services/adaptiveEngine.ts` | Browser/native client, localStorage-backed |
| `synalux-platform` | `portal/src/shared/adaptiveEngine.ts` | Server canonical, Supabase-backed |
| `prism-mcp` | `src/tools/adaptiveDefinitions.ts` | MCP tool surface |

When evolving the schema, the change must land in all three places in
the same PR. Migration logic in `prism-aac/services/adaptiveEngine.ts`
(`migrate()`) handles forward compat for stored profiles.

`PROFILE_VERSION = 2` currently. Bumping requires:

1. Update `DEFAULT_PROFILE` and `AdaptiveProfile` interface in all three
   files.
2. Add a migration branch in `migrate()` for the bump.
3. Add a test in `tests/adaptive-engine.test.ts` proving the migration
   works.

---

## 3. Cross-system flow

```
┌──────────────────────────────────────────────────────────────────┐
│   prism-aac client (web/native)                                   │
│   ─────────────────────────────                                   │
│   speak("I need help!") ──► autoSwitchTone() ──► 'serious'       │
│                                ↓                                  │
│                         recordTone(text, 'serious')              │
│                                ↓                                  │
│                         localStorage profile (v2 schema)         │
│                                ↓                                  │
│                         3s debounced flush                       │
│                                                                   │
│   bodyPoseService dwell trigger ──► recordDwell(elapsed)         │
│   messageStore.addToHistory ──────► recordMessage(text)           │
└──────────────────────────────────────────────────────────────────┘
                                 ↓
                     POST /api/v1/adaptive/profile
                     (paid tier only; free tier stays local)
                                 ↓
┌──────────────────────────────────────────────────────────────────┐
│   synalux portal                                                  │
│   ──────────────                                                  │
│   adaptive_profiles (Supabase, RLS'd to auth.uid())              │
│                                                                   │
│   ─ on every /api/v1/chat request ─                              │
│   buildSystemContext({ latestUtterance })                        │
│        ↓                                                          │
│   read adaptive_profiles → AdaptiveProfile                       │
│        ↓                                                          │
│   buildSignals(profile)  →  AdaptiveSignals                      │
│        ↓                                                          │
│   applyAdaptiveContext(baseSystemMessage, signals, utterance)    │
│        ↓                                                          │
│   prism-coder receives system prompt with:                       │
│     <adaptive_context>                                           │
│       dominant_mood: urgent                                      │
│       avg_message_length: 2.3 words                              │
│       quiet_environment: false                                   │
│       preferred_categories: feelings, food, help                 │
│       current_utterance_guidance: "calm, clear, brief..."        │
│     </adaptive_context>                                          │
└──────────────────────────────────────────────────────────────────┘
                                 ↓
                            prism-coder LLM
                       (shapes response accordingly)

       ─── Concurrent surface for MCP clients ───
┌──────────────────────────────────────────────────────────────────┐
│   prism-mcp                                                       │
│   ─────────                                                       │
│   adaptive_get_profile     ─┐                                     │
│   adaptive_set_profile      │  Delegates to                       │
│   adaptive_record_event     ├─►  /api/v1/adaptive/profile         │
│   adaptive_detect_tone     ─┘  (Synalux REST surface)             │
│   adaptive_reset                                                  │
└──────────────────────────────────────────────────────────────────┘
```

---

## 4. The `<adaptive_context>` block

Every prism-coder request now carries this block at the end of the
system prompt:

```xml
<adaptive_context>
dominant_mood: <urgent|happy|calm|neutral>
avg_message_length: <float> words
quiet_environment: <boolean>
preferred_categories: <comma-separated category ids, top 5>
current_utterance_guidance: <empty | one-sentence guidance>
</adaptive_context>
```

The model is **trained to receive these signals** as context — they are
hints, not commands. `current_utterance_guidance` is the highest-priority
signal because it reflects the *current* message's tone. `dominant_mood`
gives session-level register.

The block is omitted (zero added tokens) when:

- The user has no adaptive profile yet (`DEFAULT_PROFILE` → mostly empty).
- The current utterance is `neutral` AND `dominantMood === 'neutral'`.

---

## 5. BCBA / safety guarantees

These guarantees are testable invariants — see
`tests/adaptive-engine.test.ts` for proofs:

| Guarantee | Mechanism | Test |
|---|---|---|
| Adapted dwell ≥ 400 ms (never trigger-faster-than-physiological) | `Math.max(400, ...)` in `getAdaptedDwellMs()` | `BCBA: Adaptation is additive` |
| Adapted dwell ≤ 3000 ms (never lock the user out) | `Math.min(3000, ...)` | same |
| Noise threshold ≤ -20 dB (voice can always trigger) | `Math.min(-20, floor + 15)` | `Noise: clamp at -20dB` |
| Emergency words bypass pronunciation correction | hard guard in `correctPronunciation()` | `Pronunciation: Emergency passthrough` |
| `recordMispronunciation` refuses emergency words | early return in record fn | same |
| Reset clears everything | `freshProfile()` deep clone | `BCBA: Reset capability` |
| Single-event mood change suppressed | `≥6/10` hysteresis | `Tone: Hysteresis` |

---

## 6. Operational notes

### Storage growth

Worst case profile size with everything saturated:

- `toneHistory`: 100 entries × ~80 bytes = 8 KB
- `commonMispronunciations`: 200 entries × ~30 bytes = 6 KB
- `categories`: ~20 entries × ~40 bytes = 0.8 KB
- `timeOfDayPatterns`: 3 periods × 50 words × ~30 bytes = 4.5 KB
- Other scalars: < 0.5 KB

**Total cap ≈ 20 KB** per user. Synalux REST handler trims `toneHistory`
to the last 200 entries on every POST so a misbehaving client can't blow
up the row.

### Debounced writes

- localStorage flush: 3 s debounce + on `pagehide` + on `visibilitychange`
  (mirrors the existing `predictionStore` pattern).
- Synalux sync: caller-driven. The AAC client should POST on
  `pagehide` and on settings save; the engine itself does not autosync.

### Free vs paid tier

| Tier | Behavior |
|---|---|
| Free / `PRISM_FORCE_LOCAL` | Profile lives in localStorage only. Never syncs. `<adaptive_context>` is built from `DEFAULT_PROFILE` for any `/api/v1/chat` calls. |
| Paid (`standard`/`advanced`/`enterprise`) | Profile is mirrored to `adaptive_profiles` table on POST. `<adaptive_context>` is built from the user's stored profile. |

### Reset semantics

`adaptive_reset` (MCP) and `resetProfile()` (client) both:

1. Delete the local cached profile.
2. Remove the localStorage entry.
3. (Server) Delete the row from `adaptive_profiles`.
4. Notify any subscribed listeners.

The fresh default profile is what the next read returns.

---

## 7. Failure modes & how we handle them

| Failure | Behavior |
|---|---|
| `localStorage.setItem` throws (quota / private mode) | Engine continues with in-memory profile; data lost on reload. No app crash. |
| Synalux REST returns 5xx | AAC client logs, keeps using local profile; retries on next flush. |
| Profile version > supported | Server REST returns 422 `malformed profile`. Client falls back to defaults. |
| Adaptive table missing (RLS misconfig) | `system-prompt.ts` `try/catch` returns `DEFAULT_PROFILE` signals. Chat still works. |
| MediaPipe returns garbage `normX` outside [0,1] | `Math.max(0, Math.min(1, ...))` clamps before calibration learns from it. |
| Caregiver records `'help' → 'helper'` | `recordMispronunciation` refuses to write. `correctPronunciation('help')` returns `'help'` regardless. |

---

## 8. What this is NOT

- **Not a personalization engine across users.** Profiles are per-user
  and never aggregate.
- **Not a sentiment analysis library.** `detectTone` is a fast-path word
  matcher with stems. For nuanced analysis, send the text to prism-coder.
- **Not stored on disk on free tier.** localStorage only. No fingerprint,
  no cookie, no telemetry.
- **Not a substitute for caregiver judgment.** All adaptations are
  reversible via reset and additive (never restrict capabilities).

---

## 9. Where to make future changes

| Want to change | File |
|---|---|
| Tone detection algorithm | `prism-aac/services/adaptiveEngine.ts` (`detectTone`) — and mirror in `synalux-platform/portal/src/shared/adaptiveEngine.ts` |
| Add a new behavioral signal | bump `PROFILE_VERSION`, add field, write `migrate()` branch, update `buildSignals()` |
| Change how prism-coder sees signals | `synalux-platform/portal/src/shared/adaptiveEngine.ts` (`applyAdaptiveContext`) — affects every chat |
| Change how AAC routes voice | `prism-aac/services/speechService.ts` (`speak()`) |
| Add new MCP tool | `prism/src/tools/adaptiveDefinitions.ts` + matching handler |

When evolving the schema, **always update all three repos in the same PR**.

</details>
