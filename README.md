# Prism AAC

**Help nonverbal kids talk.**

Augmentative & Alternative Communication app for children with motor impairments and complex communication needs. Tap pictures, build sentences, hear them spoken aloud — in 23 languages. Works on any tablet, laptop, iPhone, iPad, and Apple Watch.

Part of the [Synalux platform](https://synalux.ai).

<p align="center">
  <a href="https://prism-aac.vercel.app"><img src="https://img.shields.io/badge/Try_It-Free-43e97b?style=for-the-badge" alt="Try Free"></a>
  <a href="https://synalux.ai/pricing"><img src="https://img.shields.io/badge/Plans-Free_+_Paid-764ba2?style=for-the-badge" alt="Pricing"></a>
  <a href="LICENSE"><img src="https://img.shields.io/badge/License-AGPL--3.0-blue?style=for-the-badge" alt="AGPL-3.0"></a>
  <a href="PRIVACY.md"><img src="https://img.shields.io/badge/Privacy-Policy-lightgrey?style=for-the-badge" alt="Privacy"></a>
  <a href="TERMS.md"><img src="https://img.shields.io/badge/Terms-of_Service-lightgrey?style=for-the-badge" alt="Terms"></a>
</p>

![Prism AAC main screen — toolbar, schedule banner, type-here bar, prediction tiles, and qwerty keyboard](docs/screenshots/app-hero.png)

### Native apps

<p align="center">
  <img src="docs/screenshots/ios-iphone.png" alt="PrismAAC on iPhone" width="220" />
  <img src="docs/screenshots/ios-ipad.png" alt="PrismAAC on iPad" width="360" />
  <img src="docs/screenshots/watch-ultra.png" alt="PrismAAC on Apple Watch Ultra" width="120" />
</p>

| Platform | Status | Notes |
|----------|--------|-------|
| **Web** (PWA) | Production | Any browser, installable |
| **iPhone / iPad / iPad Pro** | Production | WKWebView + on-device 1.7B (llama.cpp) + 14B/32B via WiFi to Mac Ollama |
| **Apple Watch** | Production | Standalone — pictograms, AI chat, emergency, translation |
| **Chrome Extension** | Production | Reading assistant in any text field |

---

## At a glance

| Module | What it does | Preview |
|---|---|---|
| 📂 **Categories** | PECS-style picture tiles for non-readers | <img src="docs/screenshots/panel-categories.png" width="120"> |
| ⌨️ **Type & speak** | Keyboard + word prediction + neural voice | <img src="docs/screenshots/app-hero.png" width="120"> |
| ✨ **AI Chat** | On-device + cloud assistant tuned for AAC users | <img src="docs/screenshots/panel-ai-chat.png" width="120"> |
| 💬 **AAC Chat** | Incoming messages from caregivers + contacts | <img src="docs/screenshots/panel-aac-chat.png" width="120"> |
| 🧮 **Math + subjects** | Cell-grid canvas with domain-aware tutor | <img src="docs/screenshots/math-canvas-typed.png" width="120"> |
| 🗓 **Schedule** | Visual first-then routines | <img src="docs/screenshots/panel-schedule.png" width="120"> |
| 🎮 **Games** | 12 therapeutic AAC games | <img src="docs/screenshots/panel-games.png" width="120"> |
| 🏪 **Marketplace** | Voice packs, vocab packs, game packs | <img src="docs/screenshots/panel-marketplace.png" width="120"> |
| 🎧 **Comfort Player** | Bedside media player for hospital patients | <img src="docs/screenshots/panel-comfort-player.png" width="120"> |
| 👋 **Hands-free** | Head + hand gesture recognition | <img src="docs/screenshots/panel-settings-input-modes.png" width="120"> |
| ⚙️ **Settings** | 23 languages, motor accommodations, plan tier | <img src="docs/screenshots/panel-settings.png" width="120"> |

---

## Free Read & Write alternative

PrismAAC ships every reading-assistant feature most AAC users buy Read & Write for — for free, in the browser, with no account required for the web tier. See [Type & speak](#%EF%B8%8F-type--speak) for sentence-end speak + word highlight, [PDF Reader](#-pdf-reader) and [Screenshot Reader (OCR)](#-screenshot-reader-ocr) for documents, and the [Chrome extension](#-chrome-extension--same-reading-assistant-features-in-any-text-field) for cross-app coverage in Gmail / Docs / Word Online / anywhere else.

## How PrismAAC compares

| | PrismAAC | TouchChat | Proloquo2Go | LAMP Words | TD Snap | CoughDrop |
|---|:---:|:---:|:---:|:---:|:---:|:---:|
| **On-device + HIPAA-safe** speech path | ✅ | ❌ | ❌ | ❌ | partial | partial |
| **Per-user phrase ranking** (ACT-R + spreading activation) | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ |
| Caregiver corrections **become training data automatically** | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ |
| **Domain-aware AI tutor** (math + 10 other subjects) | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ |
| **Cell-grid math canvas** (no LaTeX, no whiteboard) | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ |
| **Locale + region-aware history** (280+ regions) | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ |
| **Hands-free** head + hand gesture mode | ✅ | partial | partial | ❌ | ✅ | partial |
| Therapeutic **AAC games** built in | ✅ (12) | ❌ | ❌ | ❌ | ❌ | partial |
| **Open source** (AGPL-3.0) | ✅ | ❌ | ❌ | ❌ | ❌ | ✅ |
| **Free tier** for life-safety access | ✅ | ❌ | ❌ | ❌ | ❌ | ✅ |
| Voice pack **marketplace** | ✅ | ❌ | partial | ❌ | partial | ❌ |
| **Multi-language** (23) | ✅ | ✅ | ✅ | ❌ | ✅ | ✅ |
| **Caregiver notes** that travel home / school / clinic | ✅ | ❌ | ❌ | ❌ | partial | partial |

> Comparison reflects publicly available product information as of 2026-05. PrismAAC is actively developed; competitors may add features over time. PRs welcome to keep this honest — see `CONTRIBUTING.md`.

---

## iOS & Apple Watch

### iPhone / iPad

Native Swift app wrapping the web UI in WKWebView + on-device 1.7B LLM via llama.cpp Metal. Three-layer safety architecture: synchronous crisis filter → on-device AI → cloud fallback. Memory-aware feature gating degrades gracefully from full AI → cloud AI → core-only → emergency mode.

- Safe area inset for Dynamic Island / notch
- WCSession bridge for Apple Watch emergency dispatch
- Keychain-backed auth tokens

**iPad Pro (M1/M2/M4):** Full on-device 1.7B inference via llama.cpp (~1.6 GB RAM). For 14B/32B models, connect to a Mac on the same WiFi running Ollama — Settings → 🤖 Local AI Models → enter Mac IP. No new build required.

**Settings → 🤖 Local AI Models** — download and manage Prism models directly from the app:
- Detects Ollama automatically at `localhost:11434`
- Shows a URL field for WiFi connections (iPad/iPhone → Mac Ollama)
- Per-model download with live progress bar, install/remove controls
- Models: `dcostenco/prism-coder:1b7` (2.2 GB) · `:14b` (9.3 GB) · `:32b` (19 GB)


### Apple Watch (standalone)

Works without iPhone — WiFi/LTE for AI, Bluetooth for faster on-device path.

<p align="center">
  <img src="docs/screenshots/watch-series.png" alt="Watch Series 11" width="140" />
  <img src="docs/screenshots/watch-ultra.png" alt="Watch Ultra 3" width="140" />
</p>

- 2-column pictogram grid with ARASAAC images
- AI Chat with dictation + keyboard input
- Emergency system: countdown → WCSession → cellular fallback → TTS
- Translation between 23 languages with TTS output
- Inbox: receive and reply to messages from caregivers
- Certificate pinning (SPKI SHA-256) on emergency dispatch
- NFKC + 23-token injection sanitization on all AI paths

---

## Modules

### 📂 Categories
PECS-style picture tiles. Tap a category, tap a tile, hear the word, watch it land in the message bar. Works for non-readers, pre-readers, and emerging communicators alike. Tile sets and ordering personalize over time via spreading activation — the tiles your child taps most rise; the ones unused for months fade.

**Surround layout** — categories appear in a scrollable left column alongside the keyboard, so the AAC user can tap picture tiles AND type simultaneously without switching modes. The prediction bar stays visible; both inputs are always accessible.

![Categories in surround mode — scrollable category cards on the left, full keyboard on the right](docs/screenshots/categories-surround-v2.png)

<details>
<summary><strong>Features + technical details</strong></summary>

- 22 default categories: people, food, feelings, body, clothes, animals, places, etc.
- Caregiver can add / remove / reorder tiles per child
- Each tile carries a `textKey` for i18n — switching the app language re-labels every tile in one tap
- Tile pictograms come from ARASAAC + a curated set; voice cloning lets you match the tile's voice to the child's siblings or parents (paid tier)
- Per-user n-gram learning: a child who taps "I want eat" three times sees "eat" rise after "want" the next session

**Render path:** `components/CategoryPanel.tsx` → `useCategoryStore` → tiles drawn from `constants/phrases.ts` (system) + Supabase per-user overrides (paid). Tile taps invoke `messageStore.appendText(phrase)` and route through `aacSpeak()` for TTS.
</details>

---

### ⌨️ Type & speak
On-screen keyboard with **word prediction**, **AI autocomplete**, and a one-tap **Speak** button that reads the message bar aloud in a natural neural voice. Typing teaches the prediction engine: words your child types most surface earlier next session.

![Prism AAC keyboard with "hello" typed, prediction tiles, and Speak button](docs/screenshots/keyboard-typing.png)

**Reading-assistant features (Read & Write parity)** — for users with reading / memory / cognitive needs:

- **Speak per word** — every word echoes through TTS the moment you tap space, so you hear what you typed without waiting for the full sentence.
- **Speak the sentence on `.?!`** — finishing a sentence with a period, question mark, or exclamation point reads the whole sentence back so you don't lose track of what you wrote (the gap that disqualifies NVDA for sighted users with cognitive disabilities). Toggle via Settings → `speakOnSentenceEnd` (default on).
- **Word-by-word highlight while speaking** — every spoken word lights up with a yellow background as TTS reads it. Sighted users with reading disabilities can follow along visually; the highlight tracks the audio without needing a special hardware device.

<details>
<summary><strong>Features + technical details</strong></summary>

- 5 prediction slots above the qwerty, refreshed on each keystroke
- AI completion ("hw" → "how", "togoso" → "to go so") via Synalux `text/correct` (Gemini 2.5 Flash-Lite, ~752ms avg, 4.3× cheaper than 2.5 Flash)
- Cross-language gate: RO `eu` won't leak into EN bar even when both corpora are loaded (cross-corpus frequency comparison)
- "Speak" reads with auto-tone adaptation (declarative / interrogative / exclamatory inferred from punctuation)
- Voice tier 1: Inworld TTS-2 → Azure Neural (both natural/neural, all 23 app languages covered); tier 2: Kokoro-82M offline; tier 3: OS Web Speech; tier 4: WASM espeak-ng
- Word highlight is duration-estimated (~60 ms/char @ rate=0.5, scales with the rate slider) — works across every TTS tier without backend changes; precise sync via Azure `wordBoundary` is a future Pro feature.
- 1.5MB SQLite n-gram corpus per language; unigrams + bigrams + trigrams; lazy-loaded on language switch

**Render path:** `components/Keyboard.tsx` → `messageStore.appendChar` → `predictionStore.updatePredictions(text, lang)` → `engine/predictionEngine.ts` (recency × frequency × n-gram boost) + optional `services/textCorrectService.ts` AI overlay. Highlight: `services/aacSpeak.ts` emits `tts-highlight-start` events on the `ttsHighlightBus`; `components/MessageBar.tsx` subscribes and passes `activeWordIndex` to `ColoredText`.
</details>

---

### ✨ AI Chat
On-device + cloud assistant tuned for the AAC user's voice. Streamed responses, every line tap-to-insert into the message bar so authorship stays with the child. Free tier runs through Gemini 2.5 Flash; paid tiers route to Claude Sonnet 4 with the prism-coder fleet for short queries.

**Clean AI mode** — the word prediction bar hides automatically when AI Chat is open (predictions are irrelevant when composing a question), keeping the focus on the AI response and submit button.

![AI Chat panel — prediction bar hidden in AI mode, full keyboard accessible below](docs/screenshots/panel-ai-chat-v2.png)

<details>
<summary><strong>Features + technical details</strong></summary>

- Inline panel docked above the keyboard — never a modal that hides the message bar
- Voice input via Web Speech API; mic button shows live interim transcript
- Tap any AI line to copy it into the message bar (preserves authorship — Valencia et al., CHI 2023)
- 15s hard timeout client-side + Retry button (so the panel can't get stuck on "Thinking…" if the network drops)
- 401 / network / timeout / other → friendly error mapping; never shows "Session expired" raw
- Local Ollama fallback (`prism-coder:7b`) when offline; mixed-content blocked from `prism-aac.vercel.app` browser origin in practice, so the friendly error fires

**Render path:** `components/AIChatPanel.tsx` → `services/aiService.askAI()` → SSE stream from Synalux `/api/v1/chat` with `credentials: 'include'`. CORS allowlists `prism-aac.vercel.app` + localhost dev origins.
</details>

---

### 📨 Send a message — provider picker
When a contact has multiple configured providers (e.g. both Mail and SMS), a **"Send via"** section appears above the compose area. One tap switches provider before composing — no need to leave the panel.

![Contact provider picker — 'Send via' row with Mail highlighted green, SMS available](docs/screenshots/contact-provider-picker.png)

---

### 💬 AAC Chat
Incoming messages from connected providers (Telegram, WhatsApp, Email, Slack, etc.) land in this panel. The unread badge on the toolbar shows the count, the alarm + cross-tab notification fires when a new message arrives, and tap-a-message-line copies it into the bar so the child can compose a reply with their own voice.

![AAC Chat panel showing inbound caregiver messages with unread badge](docs/screenshots/panel-aac-chat.png)

<details>
<summary><strong>Features + technical details</strong></summary>

- Polled inbox via Synalux portal `/api/v1/prism-aac/inbox/poll` (no-op on 404 if portal not configured)
- Cross-tab `BroadcastChannel` notification on new message
- Provider abstraction: adding Outlook / Slack / Discord = ~30 LOC each (see `synalux-private/scripts/fetch-messages.mjs`)
- Read state syncs back so caregivers see when the child has seen their message
- Free tier: 1 connected provider; paid tier: unlimited
- Per-message TTS so the child can hear the inbound text in their preferred voice

**Render path:** `components/AACChatPanel.tsx` → `services/inboxPolling.ts` (5s poll when sidePanel === 'aac-chat', 60s otherwise) → `useScheduleStore.setIncomingMessages()`. Each message is also appended to the schedule's "Messages from caregivers" track.
</details>

---

### 🧮 School subjects
Cell-grid canvas hosting **19 subject keyboards** that cover the full high-school program: math + sciences + programming + arts + humanities. Each tab routes the AI tutor through a domain-specific prompt template (33 templates total) so the model doesn't apply algebraic reasoning to a Punnett square or mistake a music dynamic for a programming literal. **History is locale + region aware** down to the state / province / Land / autonomous-community level — 280+ regions across 23 countries.

![Cell-grid canvas with 5 + 7 = 12 typed across cells](docs/screenshots/math-canvas-typed.png)

<details>
<summary><strong>Subject tabs (19 total)</strong></summary>

**Math (9 keyboards)** — Main, Adv. Math (π √ exponents + 5 decoration tools: fraction box, long-division house, root bar, summation line, fraction bar), a–z, Misc Math (set theory + logic), Time & Dist, Weight, Volume, Geom, Money.

**Sciences (4)** — Chemistry (24 elements + reaction arrows + charges + subscripts + phase markers), Physics (full Greek + 16 SI units + ∫/∂/∇/∑/∏ + constants), Biology (DNA/RNA + genetics + 8 taxonomy ranks + 12 organelles), Statistics (μ σ x̄ + 12 ops + distributions).

**Programming (2)** — Python (24 ops + 26 keywords) and Java (24 ops + 26 keywords). Code commits one char per cell so it lays out naturally on the monospace grid.

**Arts + Humanities (4)** — Music (3 clefs + 6 notes + 5 rests + 5 accidentals + 8 dynamics), Earth Science (weather + plates + 10 planets + AU/ly/pc/Mya/Gya), History (locale + region aware), Language Arts (12 POS tags + 6 sentence types + punctuation + citation styles).

</details>

<details>
<summary><strong>AI tutor — 11 domains × 3 modes = 33 prompts</strong></summary>

![AI tutor overlay with mocked hint above the canvas](docs/screenshots/math-tutor-hint.png)

Three modes per subject: 💡 **Hint** (gentle next-step nudge, never solves), ✓ **Check** (validates the child's answer, celebrates if correct), 🎓 **Solve** (full step-by-step walkthrough, max 4 steps). The active tab tells the tutor what subject the child is on. 15 s hard timeout + Retry button so the overlay never gets stuck.
</details>

<details>
<summary><strong>History — locale + region aware</strong></summary>

![History keyboard in en locale (no region) — universal + national tiers](docs/screenshots/math-keyboard-history-en.png)
![History keyboard with US-TX region — Alamo, Texas annexation, JFK appear](docs/screenshots/math-keyboard-history-us-tx.png)

Three tiers stacked:
1. **Universal** events taught in every curriculum (476, 1914 WWI, 1939 WWII, 1969 moon)
2. **National** events selected by `language` (en, es, fr, de, ro, ru, uk, ja, ko, zh, ar, it, pl, nl, he, hi, vi, tr, pt) — 19 supported languages
3. **Sub-national** events selected by `historyRegion` (US-TX, CA-QC, UK-SCT, ES-CT, IN-MH, DE-BY, …) — **280+ regions across 23 countries** including all 50 US states + DC, 13 Canadian provinces / territories, all 4 UK nations, Ireland (Republic + 4 historical provinces), all 16 German Länder, all 17 Spanish autonomous communities, all 20 Italian regions, plus AU, FR, MX, BR, IN, CN, RU, BE, CH, NL, AR, ZA, KR, PK, NZ, PL.

The tutor prompt carries the locale + region so an ambiguous date like 1836 in `US-TX` resolves to the Alamo (not Alabama statehood); 1759 in `CA-QC` anchors to the Plains of Abraham; 1714 in `ES-CT` to the fall of Barcelona.

</details>

<details>
<summary><strong>Test workflows — 12 subjects × Grade 8-12 word problems × 72 Playwright tests</strong></summary>

Step-by-step problem sheets exercising every subject keyboard, plus an executable Playwright test per problem that drives the live math panel and verifies each step's glyphs land in the cell grid. Modeled directly on a real Grade-9 algebra reference page.

- **Layer 1 — generic step-by-step:** [`tests/workflows/`](tests/workflows/) — 12 markdowns (advanced-math, biology, chemistry, earth-science, geometry, history, language-arts, misc-math, physics, programming-java, programming-python, statistics).
- **Layer 2 — grade-leveled real classroom:** [`tests/workflows/grade-8-12/`](tests/workflows/grade-8-12/) — 12 markdowns with named-variable word problems (algebra-grade-9, geometry-grade-10, physics-grade-11, chemistry-grade-10, biology-grade-9, statistics-grade-11, programming-python-grade-9, programming-java-grade-11, pre-calc-grade-12, earth-science-grade-9, language-arts-grade-8, world-history-grade-10) + per-subject keyboard-gap [`REPORT.md`](tests/workflows/grade-8-12/REPORT.md).
- **Layer 3 — Playwright e2e:** [`e2e/math-workflows/`](e2e/math-workflows/) — 72 tests (`npx playwright test --project=desktop e2e/math-workflows`).

Full index, ranked under-supported subjects, and the "how to add a new workflow" runbook → **[`docs/WORKFLOWS.md`](docs/WORKFLOWS.md)**.

</details>

<details>
<summary><strong>Other math features (lock tool, two-hit magnify, save / sync)</strong></summary>

- **Lock tool** — after the child finishes a problem, lock the region. Locked cells render slightly dimmed and reject edits.
- **Two-hit magnify** — first tap arms the key (1.4× scale + green halo), second tap commits. 2 s auto-disarm. For users with motor imprecision.
- **Save + sync** — local-first to `localStorage`; best-effort sync to Synalux portal via `↻ Sync` button. Cap 100 docs / 200 KB body; oldest evicted.
- **Hold-time dwell** — configurable per-key dwell (0–1500ms) with green progress ring.

![Saved docs overlay showing one entry and a Sync button](docs/screenshots/math-docs-overlay.png)
![A digit key armed in the green-halo magnified state](docs/screenshots/math-two-hit-armed.png)
![Lock tool armed, prompting the user to tap a corner of the region](docs/screenshots/math-lock-armed.png)

</details>

<details>
<summary><strong>Subject keyboards — additional pictures</strong></summary>

![Chemistry keyboard with H₂O](docs/screenshots/math-keyboard-chemistry.png)
![Biology keyboard with A T G](docs/screenshots/math-keyboard-biology.png)
![Java keyboard with `private String`](docs/screenshots/math-keyboard-java.png)
![Music keyboard](docs/screenshots/math-keyboard-music.png)
![Statistics keyboard](docs/screenshots/math-keyboard-statistics.png)
![Earth Science keyboard](docs/screenshots/math-keyboard-earth-science.png)
![Language Arts keyboard](docs/screenshots/math-keyboard-language-arts.png)
![Romanian-locale history](docs/screenshots/math-keyboard-history-ro.png)

</details>

---

### 🗓 Schedule
Visual first-then schedule for routine + transition support. Each step is a picture tile + label; finishing a tile fires a chime + a visual progress mark. Reward shop (paid tier) unlocks at the end of a routine.

![Schedule panel with first-then board + activity list](docs/screenshots/panel-schedule.png)

<details>
<summary><strong>Features + technical details</strong></summary>

- 24-tile preset grid for one-tap activity adds: wake up, brush teeth, breakfast, school, snack, lunch, play, read, art, walk, dinner, bath, bedtime story, bedtime, medication, floss, tidy up, laundry, pet care, sports, …
- Drag-and-drop reorder; pencil-icon inline edit; preset adds carry `textKey` so language switching re-labels
- First-Then state machine: armed-tile pulse, 3-note rising chime on timer expiry, motion-safe (`prefers-reduced-motion` → static ring), `aria-pressed` semantics
- Audio warmup: near-silent 1Hz oscillator keeps the AudioContext "running" on iOS Safari so the timer chime actually plays after long silence (without warmup, the chime fires into a suspended context = no sound)
- Caregiver messages append to the schedule as a "Messages" track so the child sees what's coming + who messaged

**Render path:** `components/SchedulePanel.tsx` → `useScheduleStore` (24 preset activities + custom) → `services/feedback.ts:playTimerRing()` → shared AudioContext via `services/azureTTS.ts:warmupAzureAudio()`.
</details>

---

### 🎮 Games
12 evidence-based AAC games. Built to teach communication, **not for screen time**. Each game records utterances + accuracy so the adaptive engine can suggest the next-best-fit game.

![Games panel with 9 game tiles](docs/screenshots/panel-games.png)

<details>
<summary><strong>The 9 games + technical details</strong></summary>

| Game | Skill targeted |
|---|---|
| Bubble Pop | Cause + effect, intentional communication |
| Color Hunt | Receptive vocabulary (colour names) |
| My Story | Narrative sequencing |
| Match It | Matching + categorical thinking |
| Yes/No | Binary discrimination, request/refuse |
| Finish It | Sentence completion (cloze) |
| Category Sort | Semantic categorization |
| Emotion Match | Affect labelling, ToM |
| What Comes Next | Sequential reasoning |
| Same / Different | Visual discrimination — match or contrast |
| I Hear It (Sound Match) | Auditory discrimination + vocabulary |
| Turn Taker | Social turn-taking practice |

- Free tier: Bubble Pop, Color Hunt, My Story (3 games)
- Paid tier: all 9
- Per-game data feeds `services/adaptiveEngine.ts` — utterance length / category / time-of-day / outcome → suggests the next game
- All games disable AAC tile categories that aren't relevant to that game's vocabulary, so the child isn't distracted

**Render path:** `components/GamesPanel.tsx` → individual game components in `components/games/`. Each game records via `useScheduleStore.recordMessage(text, category)`.
</details>

---

### 🏪 Marketplace
Voice packs (Inworld voices, custom-cloned voice of a sibling/parent), vocab packs (Spanish core, sign-supported speech), game packs (extra games beyond the 9). Apps install into the toolbar via the same registry the built-in panels use.

![Marketplace panel with installable apps](docs/screenshots/panel-marketplace.png)

<details>
<summary><strong>Features + technical details</strong></summary>

- Apps live as JSON entries (`lib/marketplace/manifests/local.ts`) + a runtime `lib/marketplace/registry.ts` with `getHandler(appId)` returning the panel component
- Voice cloning (paid tier): 90s recording → trained voice usable for any TTS in the app, including category tiles
- Installed apps render as toolbar buttons after the built-ins; `useSettingsStore.installedApps` is the source of truth
- Per-tier gate: marketplace lists everything but install-buttons disable for items above the user's plan

**Render path:** `components/MarketplacePanel.tsx` → `useMarketplaceStore` → backend `synalux/api/v1/marketplace/...` for purchase, then asset download (voice files, vocab JSON) into IndexedDB.
</details>

---

### 📄 PDF Reader
Open a PDF, see one tile per page, tap to hear it spoken in your voice. School worksheets, take-home letters, articles — feed any PDF in and listen instead of trying to read it. No Adobe Reader required; the entire library runs in your browser.

![PDF Reader panel — empty state with "+ Open PDF" prompt](docs/screenshots/panel-pdf-reader.png)

<details>
<summary><strong>Features + technical details</strong></summary>

- One tile per page; each shows the first 3 lines + a `▶ Page N` button that pipes through `aacSpeak()` (same voice + tone + word-highlight as everything else)
- `▶ Read all` concatenates every page into one continuous utterance
- Empty-page detection (scanned-image PDFs) suggests the OCR tool
- `pdfjs-dist` dynamic-imported on first open — separate ~3 MB chunk from the CDN, version-pinned to the npm package
- Toolbar button (📄) is opt-in via Settings → Toolbar so the minimal-default toolbar stays clean

**Render path:** `components/PdfReaderPanel.tsx` → `services/pdfReader.ts` (pdfjs `getDocument` → per-page `getTextContent`) → `services/aacSpeak.ts`.
</details>

---

### 👁 Screenshot Reader (OCR)
Paste or upload a photo of a worksheet, screenshot of a webpage, picture of a textbook page — the recognized text shows up next to the image and you can tap **▶ Speak** to hear it, or **↧ Send to message bar** to edit before speaking.

![Screenshot Reader (OCR) panel — empty state with "+ Open image" prompt](docs/screenshots/panel-ocr-capture.png)

<details>
<summary><strong>Features + technical details</strong></summary>

- 20-language OCR matrix mapped from PrismAAC locales to Tesseract codes (eng / spa / fra / por / deu / ron / ukr / rus / jpn / kor / chi_sim / ara / ita / pol / nld / heb / hin / vie / tur / ind)
- Per-language traineddata files cached after first use (~10 MB for English, more for CJK) — first run shows "Reading the image… (first run downloads the OCR model — may take 10-30 s)"
- Confidence percentage shown so the AAC user can tell whether to trust the result or re-shoot
- `disposeOcr()` cleanup hook terminates every spawned worker on page unload to free WASM memory
- Toolbar button (👁) is opt-in via Settings → Toolbar

**Render path:** `components/OcrCapturePanel.tsx` → `services/ocr.ts` (`tesseract.js` `createWorker` → `recognize`) → `services/aacSpeak.ts` or `messageStore.setText`.
</details>

---

### 🎧 Comfort Player

Bedside media player for hospital patients — coma, ICU, non-verbal, or anyone who needs continuous comfort content at the bedside.

<details>
<summary>Feature details</summary>

Family and friends record voice messages, upload photos and videos. The playlist loops continuously so the patient always has familiar voices and faces nearby.

- **Record** voice messages directly in the app (MediaRecorder API)
- **Upload** audio files, photos, and video clips (100 MB per file, 500 MB total)
- **Auto-loop** through all items continuously — set it and walk away
- **Fullscreen** mode for photos and video (bedside display)
- **Native TTS** integration — tapped phrases speak via AVSpeechSynthesizer on iOS
- **Offline** — all media stored in IndexedDB, works without internet
- **Keyboard accessible** — every control has ARIA labels and keyboard navigation
- **Military-grade reviewed** — 27 security findings fixed (blob URL leaks, quota handling, input validation, MIME allowlists, unmount cleanup)
- Toolbar button (🎧) is opt-in via Settings → Toolbar

**Storage limits:** 50 items max, 100 MB per file, 500 MB total. MIME types restricted to audio (webm/mp4/mpeg/ogg/wav), images (jpeg/png/gif/webp/heic), and video (mp4/webm/quicktime).

**Render path:** `components/ComfortPlayerPanel.tsx` → `store/comfortPlayerStore.ts` (Zustand + persist) → `services/comfortMediaStorage.ts` (IndexedDB blobs).
</details>

---

### 🧩 Chrome extension — same reading-assistant features in any text field
The PrismAAC web app covers the reading-assistant flow inside its own surface. The Chrome extension (`chrome-extension/`) brings the **same behavior to ANY text field on ANY site** — Gmail, Google Docs, Word Online, school portals, banking forms — closing the only Read & Write gap that wasn't reachable from a web page alone.

![PrismAAC Reading Assistant — speak as you type, with word-by-word highlight, in any text field](docs/screenshots/extension-marquee.png)

The floating overlay attaches above any focused text field. Tap **▶ Speak** to re-read, or just keep typing — finishing a sentence with `.?!` reads it back automatically with each word lighting up in yellow as it's spoken:

![PrismAAC overlay above a compose page, mid-sentence with "school" highlighted yellow as TTS speaks it](docs/screenshots/extension-overlay.png)

Translate-while-speaking shows BOTH the source line (small italic) and the translated line (full size, with active-word highlight as it's spoken). 50+ languages via Google's free public endpoint (no API key):

![PrismAAC overlay translating English to Romanian — source line "I had a really good day at school today" with translated "Am avut o zi foarte bună la școală astăzi" below, "foarte" highlighted](docs/screenshots/extension-translate.png)

Options page — settings sync across the user's Chrome profile via `chrome.storage.sync`. Per-site disable list, voice picker, rate / volume / pitch sliders, language pickers, all opt-in:

![PrismAAC extension options page — speak triggers, target language Romanian, voice picker, rate/volume/pitch sliders](docs/screenshots/extension-options.png)

**Install (developer mode for now — Chrome Web Store listing pending review):**

```sh
cd chrome-extension
npm install
npm run build
```

Open `chrome://extensions`, enable **Developer mode**, click **Load unpacked**, and pick `chrome-extension/dist`.

**Features:**

- Speak the sentence on `.?!`, speak each word on space, all toggleable
- **Word-by-word highlight** powered by the browser's native `SpeechSynthesisUtterance.boundary` event (TRUE per-word sync, vs the web app's ~60 ms/char heuristic — the portal route returns MP3 with no streaming events, but Web Speech exposes them natively)
- **Translate while speaking** — pick a target language (50+ supported via Google's free public endpoint, no API key). The overlay shows BOTH the source line (small italic) AND the translated line (with active-word highlight); a Web Speech voice matching the target language is auto-selected
- Floating Shadow-DOM overlay anchored above the focused field (▶ Speak, 📌 Pin, × Close)
- `Cmd / Ctrl + Shift + S` to speak the focused field on demand; `Esc` cancels
- Per-site disable list for banking / sensitive forms
- Settings sync across the user's Chrome profile via `chrome.storage.sync` — no PrismAAC account required

**Privacy:** no-translate mode is fully offline (Web Speech runs natively). Translate mode makes one HTTPS call per unique sentence to `translate.googleapis.com` (cached after first hit). Source available at [`chrome-extension/`](chrome-extension/) — TypeScript + esbuild bundle (content 18 KB, options 7 KB, background 339 B).

---

### 👋 Hands-free gestures
Optional camera-based input for users who can't reliably tap. Head-pose dwell-click + hand-pose gesture profiles. Runs locally — no video leaves the device.

<details>
<summary><strong>Features + technical details</strong></summary>

- **Basic mode**: head-pose tracking (FaceLandmarker, Mediapipe). User looks at a key, holds gaze for `headTrackingDwellMs` (default 1200 ms) → click. Visual progress ring fills during the dwell.
- **Advanced mode**: hand-pose tracking. Custom per-user gesture profiles (open palm = enter, fist = backspace, pinch = space, etc.) configured via `components/HandCalibration.tsx`.
- Drift safety stack: if the user's head drifts more than `headTrackingDriftThresholdPx` over `headTrackingDriftWindowMs` consecutive frames, tracking auto-disables and shows a recalibration prompt (user-reported May 2026: tracking would silently follow drift over an hour and miss the actual key targets).
- **Esc escape hatch** — pressing Esc on any keyboard immediately disables tracking and re-shows the qwerty without losing the message bar.
- Camera-stream singleton (`services/cameraStream.ts`) so head + hand tracker share one stream; switching modes is free.
- Per-user calibration persists; the body tracker auto-recovers on session resume.

**Detailed docs:** [`docs/TRACKING_MATH.md`](docs/TRACKING_MATH.md) (calibration math, percentile learner, ego-motion, One Euro filter, ~30 tunables), [`docs/GESTURE_RECOGNITION.md`](docs/GESTURE_RECOGNITION.md), [`docs/TRACKING_RELIABILITY.md`](docs/TRACKING_RELIABILITY.md).
</details>

---

### ⚙️ Settings
23 languages, theme (light / dark / high-contrast), grid size (4–20 tiles), motor accommodations (math hold-time dwell, two-hit magnify, head-tracking dwell, gesture sensitivity, drift auto-disable), voice picker (paid), AI autocorrect on/off, notifications, toolbar customization, history region picker.

![Settings — language picker + theme toggle](docs/screenshots/panel-settings.png)

<details>
<summary><strong>Math + accessibility settings</strong></summary>

![Settings — math hold-time + two-hit magnify](docs/screenshots/panel-settings-math.png)

- **Math hold-time dwell** — 0–1500 ms slider; 0 = instant click, 200–1500 ms helps users with motor imprecision (a green progress ring fills during the dwell so they can see it).
- **Two-hit magnify** — first tap on any math key arms it (1.4× scale + green halo, no commit), second tap commits. 2 s auto-disarms. Composes with hold-time dwell.
- **Head-tracking dwell** — 200–5000 ms.
- **Sensitivity** — 1–10.
- **Drift auto-disable** — toggle + threshold (px) + window (ms).
- **Show hand calibration** — opens the hand-pose profile editor.

</details>

<details>
<summary><strong>Input modes — voice, gestures, AI autocorrect</strong></summary>

![Settings — input modes panel](docs/screenshots/panel-settings-input-modes.png)

- **Voice input** — Web Speech API, language-aware (UK English vs US English etc.); free tier
- **AI Autocorrect & Completion** — every keystroke pause routes through the cloud autocorrect (Gemini 2.5 Flash-Lite). Off by default in low-bandwidth scenarios.
- **Notifications** — alarm + cross-tab notification on incoming AAC chat messages.
- **Camera input** — head + hand tracking master switch.
- **Camera tracking target** — head, hand, or auto-detect.

</details>

<details>
<summary><strong>Toolbar customization</strong></summary>

The toolbar is fully reorderable. Default 0.9.0 ships with a minimal set (mic, AAC chat, alert, categories, settings) so the screen stays uncluttered for new users — every other built-in (math, AI chat, schedule, games, marketplace, comfort player, notes, history, sound) can be re-enabled with one tap in Settings → Toolbar. Marketplace-installed apps slot in after the built-ins automatically.

</details>

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
| 19-subject school keyboard + AI tutor | ✅ basic | ✅ + premium models |
| Schedule | ✅ | ✅ + reward shop |
| Games | 3 (Bubble Pop, Color Hunt, My Story) | All 12 |
| Voice picker | — | ✅ all Inworld voices |
| Voice cloning (your own voice) | — | ✅ |
| Caregiver notes sync | — | ✅ |
| Word prediction (per-user learning) | — | ✅ |
| Locale + region history | ✅ | ✅ |
| Hands-free gesture input | ✅ | ✅ |

[See Synalux pricing →](https://synalux.ai/pricing)

---

## Clinical safety

- **AAC access is never restricted as a consequence.** A child must always have their voice.
- **No PHI in the cloud without consent.** Caregiver notes encrypt before upload.
- **Audio stays local.** Voice input transcribes in the browser via Web Speech API.
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

### Local AI models (zero cloud cost)

**Option A — In-app (recommended):** Settings → 🤖 Local AI Models → click Download next to any model. Progress bar included. Works from iPad/iPhone on same WiFi as a Mac running Ollama.

**Option B — Command line:**

Install [Ollama](https://ollama.com), then:

```bash
ollama pull dcostenco/prism-coder:1b7   # 2.2 GB — fast (~0.5s), iPhone 12+ / any Mac
ollama pull dcostenco/prism-coder:14b   # 9.3 GB — standard (~3s), Mac M2 Pro+
ollama pull dcostenco/prism-coder:32b   # 19 GB  — enterprise (~8s), Mac M2 Ultra+
```

Add to `.env.local`: `LOCAL_LLM_URL=http://localhost:11434`

**iPad Pro / iPhone on WiFi:**
```bash
OLLAMA_HOST=0.0.0.0 ollama serve   # on Mac
# Then in app Settings → Local AI → enter: http://<mac-ip>:11434
```

Auto-routing: 1.7B → AAC phrase suggestions · 14B → complex queries · 32B → clinical/enterprise. Cloud fallback when Ollama is unreachable.

---

<details>
<summary><strong>📚 Tech architecture (model routing, voice, gesture recognition, build details)</strong></summary>

**Stack**: Next.js, Zustand, Web Speech API (transcription), Inworld TTS-2 + Azure Neural fallback (speech), Kokoro-82M offline TTS, FaceLandmarker (gestures).

**Model routing** (server-side via Synalux portal):
- **On-device** (button tap → phrase): `prism-coder:1b7-v19-q8` (Qwen3-1.7B Q8, Ollama) — zero network, zero cost, ~0.5s
- **Cloud simple** (chat, free tier): `prism-coder:14b` (Qwen3-14B fine-tuned, RunPod) → Gemini 2.5 Flash fallback
- **Cloud complex** (reasoning, pro tier): `prism-coder:32b` (QwQ-32B fine-tuned, RunPod) → Claude Sonnet 4 fallback
- **Autocorrect + word prediction**: Gemini 2.5 Flash-Lite — 752ms avg, multilingual (ro/ru/es)
- Speed-critical paths (button tap → speech) bypass routing — never blocks on network
- Routing accuracy ([100-case Prism eval](https://github.com/dcostenco/prism-coder/tree/main/tests/benchmarks/prism-routing-100), 3 rounds, May 2026):

  | Model | Accuracy | Avg latency | Invented tools |
  |---|---|---|---|
  | Sonnet 4 (cloud) | **99%** | 3.2s | 0 |
  | prism-coder:14b (local) | **99%** | 9.0s | 0 |
  | Opus 4.7 (cloud) | **98%** | 3.0s | 0 |
  | prism-coder:32b (local) | **99%** | 3.6s | 0 |
  | prism-coder:1b7 (local) | **86%** | 6.0s | 0 |

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

</details>

<details>
<summary><strong>🆕 Why PrismAAC is different (the underlying algorithm stack)</strong></summary>

**Three things no other AAC app on the market does together:**

### 1. On-device AI + HIPAA-safe by default

**Why local AI matters for AAC — speed, security, and reliability:**

| | Cloud AI only | PrismAAC (local-first) |
|--|---|---|
| Button tap → speech | 2–30s (network round-trip) | **~0.5s** (on-device) |
| Works offline | ❌ No | ✅ Yes |
| PHI leaves device | ✅ Always | ❌ Never (speech path) |
| HIPAA compliance | Requires BAA with every vendor | **On-device = no BAA needed** |
| Rural / poor WiFi | Broken | **Fully functional** |
| Monthly cost per user | $2–15 API fees | **$0 (local)** |

**The 1.7B model runs entirely on your device** — iPad M1+, Mac, or laptop. A child pressing a button gets a response in ~500ms with zero network calls. No PHI, no utterances, no communication patterns ever leave the device during normal use.

Caregiver notes encrypt locally before any optional cloud sync. Comparable cloud-only AAC platforms (TouchChat, Proloquo2Go cloud sync) require account uploads to function — PrismAAC does not.

**For enterprise / clinical deployments (14B + 32B):** the 14B and 32B models run on a dedicated Mac via Ollama on the clinical network. iPads connect over the local WiFi — data never leaves the building. No cloud vendor agreements needed for HIPAA compliance.

**How to set it up:**

```
iPad / iPhone (on same WiFi as Mac)
    ↓  connects to
Mac running Ollama (OLLAMA_HOST=0.0.0.0)
    ↓  serves
prism-coder:1b7 · :14b · :32b
    ↓  all inference stays on
Local network — nothing reaches the internet
```

Settings → 🤖 Local AI Models → enter Mac IP → all models available instantly. No cloud cost. No PHI exposure. No network dependency for AAC communication.

### 2. Phrase ranking that adapts to YOUR child
Static frequency lists are obsolete. PrismAAC ranks suggested phrases via [**Prism v14.0.0 spreading activation**](https://github.com/dcostenco/prism-coder/blob/main/docs/WOW_FEATURES.md) — the same ACT-R cognitive memory model behind decades of Carnegie Mellon research. Recency × frequency × per-user history, not a static popularity list. Phrases the child says today rise; phrases unused for a year fade (lesson-rate decay `d=0.25`, ~1-year half-life).

### 3. Caregiver corrections become training data — automatically
When a caregiver fixes a suggestion the model got wrong (e.g. "no, the word is *eat*, not *want*"), the [audit-hooks postflight harvester](https://github.com/dcostenco/prism-coder/blob/main/docs/WOW_FEATURES.md#7-the-recipe-combining-all-of-the-above) extracts the gotcha and persists it. After ~50 sessions, the system warns *before* the model makes a similar mistake. No labelling work for caregivers, no expensive retraining runs — the corrections are the curriculum.

**Honest scope:** Routing accuracy on the [100-case Prism eval](https://github.com/dcostenco/prism-coder/tree/main/tests/benchmarks/prism-routing-100) (7 Prism tools, 13 categories, seed=2026): **14B = 99% · 32B = 99% · 1.7B = 86%**. Zero invented tool names across all model sizes. The 1.7B is used on-device for fast phrase routing (load/save/compact); the 14B/32B cloud tiers handle complex sessions and clinical workflows. On the full Berkeley BFCL V4 leaderboard (2,000+ cases, general function-calling), the 1.7B scores ~59% — comparable to other sub-2B models. What makes PrismAAC defensible isn't the model score alone — it's the model plus the surrounding Prism spreading-activation algorithm stack.

</details>

---

## License

[AGPL-3.0](LICENSE) — open source, OSI-approved, grant-eligible.

You're free to fork and self-host. The license requires you to share modifications under AGPL-3.0 too — that's the deal that keeps AAC innovation in the open and accessible to families.
