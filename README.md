# Prism AAC — Web Application

An evidence-based Augmentative and Alternative Communication (AAC) web app designed for children with motor impairments and complex communication needs.

**Part of the Synalux platform** — [synalux.ai](https://synalux.ai)

**Supported languages (12):** English, Spanish, Français, Português, Română, Українська, Русский, Deutsch, 日本語, 한국어, 中文, العربية. Switch from Settings → Language. Arabic switches the layout to RTL.

---

## Screenshots

### Home — Keyboard with predictions
![Home screen](docs/screenshots/home.png)

### Categories — modal overlay above the keyboard
![Categories open](docs/screenshots/categories-open.png)
> Categories, Notes, and AI Chat now open as **modal overlays** above the keyboard rather than side panels. The shared message bar persists; close the modal to keep typing. *(Screenshot pending — captures the prior side-panel layout.)*

### Food ordering with restaurant flows
![Food ordering](docs/screenshots/food-ordering.png)

### Math keyboard
![Math panel](docs/screenshots/math-panel.png)

### Settings — voice, custom categories, Synalux account
![Settings](docs/screenshots/settings.png)

---

## For BCBA / RBT / SLP Staff

This app was built following ABA principles and AAC research. Before configuring it for a client, please review [RESEARCH.md](RESEARCH.md) for the evidence base behind each feature.

### Clinical Safety Commitments

1. **Communication access is never restricted.** The keyboard is always visible. No feature gates communication.
2. **All configuration changes are documented** in the Caregiver Notes log with timestamps and author names.
3. **Changes require explicit confirmation.** The action engine previews proposed modifications before applying them.
4. **Default vocabulary cannot be deleted.** Only custom additions can be removed.
5. **Undo is always available.** Accidentally cleared text can be recovered with one tap.
6. **Offline-first.** The app works fully without internet. No child is left without communication due to network issues.
7. **This tool supplements, never replaces, clinical assessment.** All configurations should be reviewed by a credentialed BCBA or SLP.

### How to Use Caregiver Notes

Open the **Notes** panel from the toolbar. You can type instructions in natural language:

| What you type | What happens |
|---------------|-------------|
| "Add 'I feel sick' to Help" | Creates a new phrase in Help / Needs |
| "Move Bathroom to top of Help" | Reorders phrases on the Help page |
| "Add McDonald's ordering flow" | Creates a new restaurant ordering sequence |
| "Remove Chipotle" | Removes the ordering sequence |
| "He's using 'because' a lot now" | Boosts word prediction frequency |
| "Good session, 15 phrases independently" | Saved as clinical documentation only |

Every note is timestamped and attributed. Notes with actionable instructions show an **[Apply]** button — changes are previewed before execution.

### Verbal Operant Support

The app supports multiple verbal operant types per BACB Task List 5th Edition (B-14):

| Operant | Where in the app |
|---------|-----------------|
| **Mand** (request) | Help/Needs phrases, Food ordering flows |
| **Tact** (label) | Category phrase cards, Math symbols |
| **Intraverbal** (conversation) | Quick Talk phrases, AI Chat |
| **Echoic** (imitation) | Auto-speak mode — child hears each word spoken |

### Default Vocabulary

Based on Banajee, DiCarlo, & Stricklin (2003) core vocabulary research — **58 default phrases** across 6 categories:

- **Help / Needs** (8 phrases): All done, Take a break, I need help, I am hungry, I am thirsty, Bathroom, Yes, No
- **Quick Talk** (12 phrases): Hello, Goodbye, Thank you, Please, Excuse me, and more
- **Places / Plans** (11 phrases): Mall, Park, Home, School, Restaurant, and more
- **Food / Ordering** (11 phrases): Water, Juice, Pizza, Sandwich, and more
- **People / Social** (8 phrases): Mom, Dad, Teacher, Friend, Family, and more
- **School / Work** (8 phrases): Class, Homework, Computer, Book, and more

Restaurant ordering flows (Chipotle, General Restaurant) are provided as starter templates and can be edited, deleted, or supplemented with new restaurants via Caregiver Notes.

---

## Subscription & AI Routing

All AI features require a **Synalux subscription**. Core AAC (keyboard, categories, predictions) works without any account. AI routes through `synalux.ai/api/v1/chat` — same backend as the Synalux portal.

### AI Model Routing (server-side)

| Tier | Default Model | Fallback | Offline |
|------|--------------|----------|---------|
| Free | Gemini 2.5 Flash | — | prism-coder:7b |
| Standard | Claude Sonnet 4 | Gemini 2.5 Flash | prism-coder:7b |
| Advanced | Claude Sonnet 4 | Gemini 2.5 Flash | prism-coder:7b |
| Enterprise | Claude Opus 4 | Gemini 2.5 Flash | prism-coder:7b |

### Feature Tiers

| Feature | Free | Standard | Advanced | Enterprise |
|---------|------|----------|----------|------------|
| Core AAC keyboard + categories | Yes | Yes | Yes | Yes |
| 58 default phrases | Yes | Yes | Yes | Yes |
| Word prediction (5 slots) | Yes | Yes | Yes | Yes |
| Custom phrases | 50 max | 500 | Unlimited | Unlimited |
| Custom categories | — | 20 | Unlimited | Unlimited |
| Ordering sequences (restaurants) | 2 | 10 | Unlimited | Unlimited |
| Math keyboard | Basic | Full | Full | Full |
| Caregiver notes | 20 notes | Unlimited | Unlimited | Unlimited |
| Cross-device sync (Hivemind) | — | Yes | Yes | Yes |
| Message history | 10 entries | 100 | Unlimited | Unlimited |
| AI Chat + web search | — | Yes | Yes | Yes |
| Synalux modules | — | Yes | Yes | All |
| Voice input (Phase 3) | — | — | Yes | Yes |
| Azure Neural TTS | — | Standard | Advanced | All voices |
| Multi-language (12 languages) | 1 | 3 | 12 | 12 |
| Cloud backup | — | Yes | Yes | Yes |

**Enterprise** tier is included with Synalux Enterprise subscriptions. All other tiers require a separate PrismAAC subscription.

---

## Layout & Theme

### Modal-only navigation
The keyboard is the only persistent surface. **Categories**, **Math**, **Notes**, **AI Chat**, **Settings**, and **History** all open as full-viewport modal overlays (`role="dialog"` + `aria-modal="true"`) anchored above the keyboard with a translucent backdrop. This guarantees the keyboard layout never shifts under the user — motor plans stay LAMP-stable (Light & Drager 2007). On mobile, modals slide up from the bottom (`items-end`); on tablet/desktop they center.

To return to the keyboard: tap the ✕ close button or tap the backdrop. The shared message bar carries any in-progress text into and out of every modal.

### Theme
Three themes selectable from **Settings → Theme**:
- **Light** (default): off-white surfaces (#f6f7fb), dark text — meets WCAG AA contrast
- **Dark**: deep indigo (#12121e), light text
- **High Contrast**: pure black + gold (#FFD700) accents; focus rings expand to 3 px

Themes apply via CSS custom properties on the root container — no per-component logic needed.

---

## Technical Architecture

### Stack
- **Framework:** Next.js 16 + React 19 + TypeScript
- **Styling:** Tailwind CSS 4
- **State:** zustand 5 with localStorage persistence
- **Speech:** Web Speech API (TTS)
- **Sync:** Supabase (same project as Synalux portal) with realtime subscriptions
- **Layout:** Modal-overlay UX — Categories, Notes, and AI Chat render as full-screen modals above the keyboard so the keyboard layout never shifts
- **Theme:** Light (default) / Dark, plus High Contrast — driven by CSS variables; persisted in `settingsStore`
- **Tests:** Vitest — 162 tests across 10 files

### Key Design Decisions (with evidence)

| Decision | Evidence |
|----------|---------|
| 5 prediction slots | Trnka & McCoy (2008): 3–5 is optimal for motor-impaired |
| LAMP-stable prediction positions | Light & Drager (2007): consistent motor plans |
| 25mm+ button sizes | Koester & Simpson (2012): motor-impaired need ≥25mm |
| 10px key gaps | Koester & Simpson (2012): gap size secondary to button size |
| Triple feedback (haptic + audio + visual) | Hoggan et al. (2008): multi-modal improves accuracy |
| Scale-down on press (not darken) | Visible under finger; standard in Proloquo2Go, TouchChat |
| Caregiver note documentation | BACB Ethics Code 2.01, 2.09 |
| AI suggestions require confirmation | Valencia et al. (CHI 2023): preserve authorship |
| Keyboard always visible | ASHA: never restrict communication access |

### Project Structure

```
prism-aac/
  app/               Next.js App Router (single page) + globals.css theme tokens
  components/        React components (13 files)
  constants/         Default data — categories, phrases, math, keyboard layouts, ordering sequences
  engine/            Prediction engine, caregiver actions, color coding, i18n loader
  i18n/              12 locale JSONs (en, es, fr, pt, ro, uk, ru, de, ja, ko, zh, ar)
  services/          AI routing, speech (Web Speech + Azure Neural TTS), haptic feedback, Supabase sync
  store/             zustand stores (6 files) with persistence
  tests/             Vitest test suite (10 files, 162 tests)
  supabase/          Database migrations
  types/             TypeScript interfaces
  RESEARCH.md        Full evidence base with 20 citations
  README.md          This file — clinical + technical documentation
```

### Running Locally

```bash
npm install
npm run dev       # http://localhost:3000
npm run test      # 162 tests across 10 files
npm run build     # production build
```

### Environment Variables

Set via Vercel (same project as Synalux portal) or `.env.local`:

```
NEXT_PUBLIC_SUPABASE_URL=https://pjddaprqhwqxtcpdmprk.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=<from Vercel environment>
```

---

## Evidence Base

See [RESEARCH.md](RESEARCH.md) for the complete scientific foundation including:
- 20 peer-reviewed citations (2003–2025)
- BACB Ethics Code alignment
- ASHA Practice Portal references
- WCAG 2.2 accessibility standards
- Clinical safety guardrails with rationale

---

## License

Business Source License 1.1 (BUSL-1.1). Copyright 2026 Synalux AI.
