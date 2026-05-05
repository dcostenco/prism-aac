# PrismAAC Changelog

## [0.7.0] - 2026-05-05 — Schedule audio fix, preset activities, drag-drop reorder, inline edit

> Note: `0.6.0` was claimed in parallel by the Panther Math redesign release;
> this Schedule pass bumps to `0.7.0`.

### Critical fix: timer chime now actually plays
The v0.5.0 chime fired in unit tests but was silent on real devices: iOS Safari and Chrome auto-suspend `AudioContext` after ~30s of silence, so by the time the timer expired (1+ min after Start), `osc.start()` ran against a suspended context and produced no sound. Two-layer fix:
- **`startAudioWarmup()` / `stopAudioWarmup()`** in `services/feedback.ts`. A near-silent (`gain ≈ 0.0001`) sub-audible (1 Hz) oscillator is attached to the destination on the user's Start gesture, keeping the context in `running` state through the timer wait. Stopped on Reset, on user Stop, or after the THEN-cycle settles.
- **`playTimerRing` is now async + awaits `ctx.resume()`** before scheduling notes. Bails cleanly (rather than scheduling into the void) if the context can't be resumed without a fresh gesture.

### Preset activity grid — Learner self-setup
`+Add Task` now opens a 24-tile preset grid (wake up, brush teeth, breakfast, school, snack, lunch, play, read, art, walk, dinner, bath, bedtime story, bedtime, medication, floss, tidy up, laundry, pet care, sports, …). One tap adds a fully-iconed task with the right `textKey` for i18n. The "type your own" input is preserved below the grid for custom items.

### Drag-and-drop reorder
Each task row is now a draggable HTML5 drop target. Drag handle (⋮⋮) sits at the left edge; drop targets show a blue ring on `dragOver`. Wires through to the existing `reorderTask(id, newOrder)` store method. Done-state tasks are not draggable (avoids the user accidentally moving completed history).

### Inline edit
Pencil icon (✏️) on every row → opens text input → blur or Enter saves, Escape cancels. Editing custom text drops the `textKey` (i18n binding) so the user's literal label sticks.

### scheduleStore: new `editTask(id, patch)`
Patches text / icon / textKey in place. `patch.textKey === null` clears the i18n binding. 3 new tests cover each branch.

### Tests
- **8 new tests** in `tests/schedule-panel-audio-warmup.test.tsx`:
  - `startAudioWarmup` fires on Start
  - `stopAudioWarmup` fires on Stop / Reset / THEN-cycle settle
  - Preset grid renders + clicking a preset adds task with `textKey`
  - Custom text input drops `textKey`
  - Inline edit saves on blur
  - Escape during edit cancels without modifying
  - 3 `editTask` store-level tests
- Combined regression: schedule-store (21) + feedback (6) + first-then (8) + audio-warmup (11) = **46/46 green**.

---

## [0.5.0] - 2026-05-05 — Schedule First-Then state machine + audio ring

### What's new
- **Schedule First-Then flow now actually works.** The board on `/schedule` was previously decorative; both tiles were static `<div>`s. Now:
  1. User picks duration + clicks Start (unchanged)
  2. Timer expires → 3-note rising chime + FIRST tile pulses with a ring border
  3. User clicks FIRST → ✅ rendered on tile (no schedule change yet — interim confirmation)
  4. Timer auto-restarts; on second expiry, second chime + THEN tile pulses
  5. User clicks THEN → ✅ on THEN tile, then 600ms later the current schedule task flips to done
  6. Next first-then pair (B, C) renders automatically
- **`playTimerRing()`** — new audio helper in `services/feedback.ts`. 3-note rising chime (660 → 880 → 1320 Hz) instead of an alarm-style sustained tone (which can dysregulate AAC users).
- **Motion-safe pulse** — armed-tile animation respects `prefers-reduced-motion`; users who set that get a static ring border instead of throbbing pulse.
- **Aria-pressed semantics** — both tiles are now real `<button>` elements with `aria-pressed`, `aria-label` including the task name, and `disabled` when not armed.

### Tests
- 8 new tests in `tests/schedule-panel-first-then.test.tsx` — one per documented spec step + 2 regression guards (clicks while not-armed are no-ops). All passing in 727ms.
- Combined regression: schedule-store (21) + feedback (6) + new (8) — 35/35 green.

---

## [0.2.2] - 2026-05-04 — Prism Coder 7B promotion + 14B sibling (via Synalux portal)

> Coordinated with **synalux-private v0.14.4** — the Synalux portal now serves PrismAAC traffic from a fresh 7B (massive BFCL gain) and a new 14B sibling for paid-tier medium queries. **No PrismAAC code changes required.** All routing happens server-side.

### What changed for PrismAAC users
- **Faster, smarter caregiver parsing.** Model behind `/api/v1/prism-aac/chat` jumped from BFCL 47.2% to **88.1%** (3-run StdDev 0). Caregiver targeted re-test went from 19/20 to **20/20**. Translate went from 7/8 to **8/8**.
- **Paid tiers (Standard / Advanced / Enterprise) now hit a local 14B model** for medium-length AAC queries (5–40 words). This is purely a quality / latency win — no API cost, faster than Claude round-trip.
- **Free tier behaviour unchanged.** Still uses 7B local for simple queries → Gemini for complex.
- **Rollback plan:** if regressions surface, Synalux ops can `ollama cp prism-coder:7b-prev-20260504-1325 prism-coder:7b` to restore prior production model in < 1 minute.

### Eval evidence
- 7B: BFCL 88.1%, AAC realigned 47/48 (97.9%), targeted caregiver 20/20
- 14B: BFCL 85.9%, AAC realigned 46/48 (95.8%), targeted caregiver 18/20

### Why no PrismAAC code change
PrismAAC consumes `/api/v1/prism-aac/chat`. Routing logic lives entirely in the Synalux portal, so model fleet upgrades land via portal redeploy without bumping the AAC client.

## [0.2.0] - 2026-05-02 — 🧬 Adaptive AAC

> Coordinated with **prism-mcp v13.0.0** + **synalux v12.0.0**. The release that makes PrismAAC *feel* the user.

### ✨ Wow factor

- **Auto Tone Switch.** When a child types `"I need help!"`, the TTS voice automatically softens to a calm, slower, emergency register. When they type `"I want to play!"` the voice picks up a cheerful tempo. Same on the prism-coder side: the LLM receives a context block describing the user's current emotional register and shapes its response without anyone writing a "be empathetic" instruction.
- **Cursor that learns the child's motor rhythm.** Head/body/finger trackers now feed dwell-to-trigger latency back into the adaptive engine. After ~10 selections the dwell, smoothing alpha, and sensitivity all match the child's real-world speed — clamped to safe ranges.
- **Identity-locked tracking.** Camera tracker now rejects other faces in the frame via IoU continuity. No more cursor jumping to a sibling who walks behind the user.

<details>
<summary>🧬 Adaptive Engine wiring (4 new call-sites)</summary>

| Source | Triggers |
|---|---|
| `services/speechService.ts` | `speak()` defaults to `tone='auto'` — calls `autoSwitchTone()` to detect + record + return the tone, routes Azure style + rate accordingly. |
| `services/bodyPoseService.ts` dwell branch | `recordDwell(elapsed)` on every successful trigger |
| `services/bodyPoseService.ts` calibration | Adaptive expand/decay gated on identity-lock anchor; 0.01 / 0.001 rates with `[0,1]` clamps |
| `store/messageStore.ts` `addToHistory` | `recordMessage(text)` for every authored message |

Schema mirrored from `synalux-private/portal/src/shared/adaptiveEngine.ts`. Drift checked by `training/sync_adaptive_engine.sh` in the prism-mcp repo.
</details>

<details>
<summary>🛡️ Camera tracking robustness</summary>

- **Identity locking** in `headTracker.ts`: pick the highest-IoU candidate vs the previously-tracked face (≥0.30 overlap, 2s timeout). MediaPipe `minDetectionConfidence` 0.5 → 0.7. Skin-blob fallback removed (catastrophic false positives on skin-toned walls / wood / sunlit backgrounds).
- **Body pose** identity locking: nose-anchor continuity across frames, `numPoses=2` with 0.7 detection/tracking confidence so the lock has candidates. Visibility threshold 0.3 → 0.5.
- **Finger detection bugs fixed** (`fingerProximityService.ts`): `dy=canvasWidth` bug that distorted finger size on non-square frames; mixed-units distance formula (96dpi vs focal-pixels) replaced with correct pinhole-camera formula. Touch hysteresis enter at 0.85, release at 0.65.
</details>

<details>
<summary>🌍 Offline coverage across 14 locales (Phase 6)</summary>

- 54,514-phrase corpus (~3,890 per locale × 35 categories) generated by Qwen2.5-72B-Instruct on Modal H100×4.
- Per-locale prediction-seeds `constants/predictionSeeds/<lang>.ts` (315 KB each, lazy-loaded). Bigram + trigram support added to `predictionEngine`.
- `OFFLINE_DICT_1` extended from 6 → 14 locales (4000 new index-aligned word pairs).
- Languages: en, es, fr, pt, ro, uk, ru, de, ja, ko, zh-Hans, zh-Hant, zh-HK, ar.
</details>

<details>
<summary>🧪 Tests</summary>

121 tests pass across 3 suites:

- `tests/adaptive-engine.test.ts` — 48 tests: punctuation, stems, EMA-after-cap, hysteresis, emergency passthrough, frequency-weighted categories, vocab decay, v1→v2 migration.
- `tests/camera-tracking.test.ts` — 53 tests: IoU, identity locking, hysteresis, calibration clamps.
- `tests/head-tracker.test.ts` — 20 tests: edge cases.

Run: `npx vitest run tests/`
</details>

### Migration

No client-breaking changes. `adaptiveEngine` localStorage auto-migrates v1 → v2 on first read.

---

## [0.1.0] - prior

Initial release.
