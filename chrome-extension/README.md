# PrismAAC Reading Assistant — Chrome extension

A free Read & Write alternative for AAC users with reading / memory / cognitive disabilities. The PrismAAC web app already does this inside its own surface — this extension brings the same behavior to **any text field, on any site**: Gmail, Google Docs, Word Online, school portals, banking forms, anywhere.

## Features

- **Speak the sentence on `.?!`** — finishing a sentence with a period, question mark, or exclamation point reads the whole sentence back. Toggleable in settings.
- **Speak each word on space** — opt-in per-word echo (off by default; can be noisy).
- **Word-by-word highlight** — every spoken word lights up with a yellow background as TTS reads it. Powered by the browser's native `SpeechSynthesisUtterance.boundary` event — no estimation, true per-word sync.
- **Translate while speaking** — pick a target language in settings (50+ supported via Google's free public endpoint). The overlay shows BOTH the source line (small italic) and the translated line (full size, with word highlight as it's spoken); a Web Speech voice matching the target language is auto-selected.
- **Floating overlay** — anchored above the focused field. ▶ Speak button (re-reads the field), 📌 Pin (stay open), × Close.
- **Cmd / Ctrl + Shift + S** — speak the focused field on demand.
- **Esc** — cancel speech + hide the overlay.
- **Per-site disable** — list domains in settings to silence the extension on banking / sensitive forms.
- **No account, no internet (no-translate mode)** — Web Speech API is OS-native and runs offline. Translation makes one HTTPS call per unique sentence to `translate.googleapis.com` (cached after the first hit).

## Install (developer mode)

```sh
cd chrome-extension
npm install
npm run build
```

Open `chrome://extensions`, enable **Developer mode** (top-right), click **Load unpacked**, and pick `chrome-extension/dist`.

The first install opens the settings page so you can pick a voice and confirm the toggles before going to a real text field.

## Architecture

```
src/
  extractLastSentence.ts  — same heuristic as the main app
  storage.ts              — typed wrapper over chrome.storage.sync
  speak.ts                — Web Speech TTS with per-word boundary events
  overlay.ts              — Shadow-DOM floating UI
  content.ts              — focusin / input / keydown listeners
  background.ts           — minimal service worker (opens options page)
  options.html / .ts      — settings page
```

The overlay lives inside an open Shadow DOM root so the host page's CSS can't clobber its layout. Settings sync across the user's Chrome profile via `chrome.storage.sync`.

## Privacy

- **No-translate mode (default).** Typed text never leaves the device — Web Speech runs natively in your browser. The extension makes no network calls.
- **Translate mode (opt-in).** When `targetLanguage` is set, the source text is sent over HTTPS to `translate.googleapis.com/translate_a/single` (Google's free public endpoint, no API key) so it can return the translation. Each unique sentence is cached after the first hit so subsequent reads of the same text don't re-fetch. To stay fully offline, leave `targetLanguage` blank.
- The host-page-permission `<all_urls>` is required for the content script to run on arbitrary text fields. The script only reads the focused field's value when you trigger speech (button click, sentence-end, or shortcut).
- `chrome.storage.sync` syncs your settings across devices via your Chrome profile — same mechanism Chrome uses for bookmarks. Disable it via `chrome://settings/syncSetup` if you'd rather keep settings local.

## Differences from the PrismAAC web app

| | Web app (synalux.ai/prism-aac) | This extension |
|---|---|---|
| TTS backend | Inworld TTS-2 / Azure Neural / Kokoro / Web Speech | **Web Speech only** (free, native, offline) |
| Voice quality | Neural (Inworld v1.5-mini) | OS voices (varies by platform) |
| Word-highlight sync | Estimated (~60 ms/char heuristic) | **Exact (browser `boundary` events)** |
| Translation | Offline dict + AI refine (16 langs) | **Google gtx (free, no key, 50+ langs)** |
| Word prediction | Yes (n-gram + AI) | Not yet — host pages have their own autocomplete |
| Cross-app coverage | No (in-page only) | **Yes — works on any text field anywhere** |
| Account required | Optional (free + paid tiers) | **None** |
| Source | github.com/dcostenco/prism-aac | github.com/dcostenco/prism-aac/tree/main/chrome-extension |

## License

AGPL-3.0 — same as the main PrismAAC repo.
