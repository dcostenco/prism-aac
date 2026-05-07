# Prism AAC

**Help nonverbal kids talk.**

Augmentative & Alternative Communication app for children with motor impairments and complex communication needs. Tap pictures, build sentences, hear them spoken aloud — in 16+ languages. Works on any tablet or laptop.

Part of the [Synalux platform](https://synalux.ai).

<p align="center">
  <a href="https://prism-aac.vercel.app"><img src="https://img.shields.io/badge/Try_It-Free-43e97b?style=for-the-badge" alt="Try Free"></a>
  <a href="https://synalux.ai/pricing"><img src="https://img.shields.io/badge/Plans-Free_+_Paid-764ba2?style=for-the-badge" alt="Pricing"></a>
  <a href="LICENSE"><img src="https://img.shields.io/badge/License-AGPL--3.0-blue?style=for-the-badge" alt="AGPL-3.0"></a>
</p>

---

## What Prism AAC does

### 🖼 Pictures → words → speech
Tap PECS-style picture tiles to build sentences. The app reads them aloud in your child's language with a natural neural voice (Inworld 2.0).

### ⌨️ Type, predict, speak
Built-in keyboard with word prediction. Smart suggestions learn from how the child communicates over time.

### 🧮 Math panel for school
Panther Math Paper-style graph-paper canvas with KaTeX rendering. Draw geometric figures, write equations, get an AI tutor that speaks back.

### 🗓 Visual schedule
Picture-based routines with rewards. Reduces transition anxiety for children with autism.

### 🎮 Therapeutic games
9 evidence-based AAC games (Bubble Pop, Color Hunt, My Story, Match It, Yes/No, Finish It, Category Sort, Emotion Match, What Comes Next). Built to teach communication, not for screen-time.

### 👋 Hands-free with gestures
Optional gesture recognition for users who can't reliably tap. Camera-based, runs locally — no video leaves the device.

### 🩺 Clinical-grade
Designed with BCBAs and SLPs. Verbal operant tracking. Caregiver notes that travel between home, school, and clinic. AGPL-3.0 — free to self-host.

---

## Try it

| | |
|---|---|
| 🌐 **Web app** | [prism-aac.vercel.app](https://prism-aac.vercel.app) — try in any browser |
| 📱 **iOS** | TestFlight (request invite via [synalux.ai/contact](https://synalux.ai/contact)) |
| 💻 **Source** | This repo. AGPL-3.0 — fork freely, share modifications |

---

## Plans

| | Free | Paid |
|---|---|---|
| Picture tiles + 22 categories | ✅ | ✅ |
| Type-to-speak | ✅ | ✅ |
| Default voice (Inworld) | ✅ | ✅ |
| Math panel | ✅ basic | ✅ + AI tutor |
| Schedule | ✅ | ✅ + reward shop |
| Games | 3 (Bubble Pop, Color Hunt, My Story) | All 9 |
| Voice picker | — | ✅ all Inworld voices |
| Voice cloning (your own voice) | — | ✅ |
| Caregiver notes sync | — | ✅ |
| Word prediction (per-user learning) | — | ✅ |

[See Synalux pricing →](https://synalux.ai/pricing)

---

## Clinical safety

Prism AAC is built on these commitments:

- **AAC access is never restricted as a consequence.** A child must always have their voice.
- **No PHI in the cloud without consent.** Caregiver notes encrypt before upload.
- **Audio stays local.** Voice input transcribes in the browser via Whisper WASM.
- **Designed by BCBAs.** Verbal operant tracking matches BACB Task List 5th Edition.
- **Trauma-informed defaults.** No punishment mechanics. Reward shop is opt-in.

Read more: [`ACCESSIBILITY.md`](ACCESSIBILITY.md), [`SECURITY.md`](SECURITY.md).

---

## Self-host

```bash
git clone https://github.com/dcostenco/prism-aac.git
cd prism-aac
npm install
npm run dev    # http://localhost:3000
```

Synalux operates the canonical hosted version (free + paid). Self-hosters and forks must release modifications under AGPL-3.0.

---

<details>
<summary>📚 Tech architecture (model routing, voice, gesture recognition, build details)</summary>

**Stack**: Next.js, Zustand, Whisper WASM (transcription), Inworld TTS-2 + Azure Neural fallback (speech), Kokoro-82M offline TTS, FaceLandmarker (gestures).

**Model routing** (server-side via Synalux portal):
- Free tier (chat): prism-coder:7b local for simple AAC → Gemini 2.5 Flash for medium/complex
- Paid tiers (chat): prism-coder:7b for short → prism-coder:14b (32K ctx) for medium → **Claude Sonnet 4** for complex
- Anthropic outage fallback: Standard → Gemini 3 Flash Preview, Advanced/Enterprise → Gemini 3 Pro Preview (preserves tier quality on cloud failover)
- Autocorrect + word prediction (every keystroke pause): **Gemini 2.5 Flash-Lite** — bench-validated multilingual (ro/ru/es), 752ms avg, 4.3× cheaper than 2.5 Flash
- Speed-critical paths (button tap → speech) bypass routing — never blocks on network

**Voice (TTS)** fallback chain:
- Tier 1: Inworld TTS-2 (paid all langs; free for ro/uk/ru/de/ko/ar where Synalux absorbs cost)
- Tier 1.5: Kokoro-82M neural offline (en/es/fr/pt/ja/zh)
- Tier 2: OS Web Speech API premium voices (offline)
- Tier 3: WASM espeak-ng (last resort)

**Gesture recognition**:
- Basic: head pose + dwell-click via FaceLandmarker
- Advanced: hand pose via MediaPipe; per-user gesture profiles

**Architecture**: modal-only navigation (no router), theme via tokens.bg/text/border/accent.

**Detailed docs in this repo:**
- [`docs/TTS-ARCHITECTURE.md`](docs/TTS-ARCHITECTURE.md) — full speech routing
- [`docs/GESTURE_RECOGNITION.md`](docs/GESTURE_RECOGNITION.md) — gesture mode internals
- [`docs/ADAPTIVE-ENGINE-BEHAVIOR.md`](docs/ADAPTIVE-ENGINE-BEHAVIOR.md) — auto-tone switching
- [`docs/EMERGENCY-NATIVE-ARCHITECTURE.md`](docs/EMERGENCY-NATIVE-ARCHITECTURE.md) — life-critical alert path
- [`docs/SELF-LEARNING-SAFETY.md`](docs/SELF-LEARNING-SAFETY.md) — per-user learning guardrails
- [`docs/TRACKING_RELIABILITY.md`](docs/TRACKING_RELIABILITY.md) — head/hand tracking reliability harness
- [`PRECISION_TOUCH.md`](PRECISION_TOUCH.md) — touch-target accessibility
- [`ACCESSIBILITY.md`](ACCESSIBILITY.md) · [`SECURITY.md`](SECURITY.md) · [`GOVERNANCE.md`](GOVERNANCE.md) · [`AGENTS.md`](AGENTS.md)
- [`RESEARCH.md`](RESEARCH.md) — evidence base
- [`CHANGELOG.md`](CHANGELOG.md) — version history

**The original 900-line README is preserved in git history.** To recover any specific section (math panel deep-dive, prism-coder:14b release notes, full feature tier table, competitive analysis): `git show HEAD~1:README.md`.

</details>

---

## License

[AGPL-3.0](LICENSE) — open source, OSI-approved, grant-eligible.

You're free to fork and self-host. The license requires you to share modifications under AGPL-3.0 too — that's the deal that keeps AAC innovation in the open and accessible to families.
