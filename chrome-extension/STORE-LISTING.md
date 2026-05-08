# Chrome Web Store — listing copy

Paste these fields into the Chrome Web Store Developer Dashboard at
`https://chrome.google.com/webstore/devconsole` → **+ New item** →
upload `prism-aac-ext-vX.Y.Z.zip` → fill the listing.

---

## Name (max 75 chars)

```
PrismAAC Reading Assistant
```

## Short description (max 132 chars)

```
Speak as you type, sentence-by-sentence, with word-by-word highlight. Free Read & Write alternative for AAC users.
```

## Detailed description (max 16,000 chars)

```
PrismAAC Reading Assistant brings the reading-help features many AAC users buy expensive subscriptions for — into your browser, free, on every site you already use.

WHAT IT DOES

• Speak the sentence on . ? ! — finishing a sentence with a period, question mark, or exclamation point reads the whole sentence back. So you don't lose track of what you wrote by the time you reach the period.

• Speak each word as you tap space (opt-in) — every completed word echoes through your chosen voice the moment you finish it.

• Word-by-word highlight while speaking — every spoken word lights up with a yellow background as the voice reads it. Powered by your browser's native per-word boundary events — true sync, not an estimate. Sighted users with reading or memory disabilities can follow along visually.

• Translate while speaking (50+ languages) — pick a target language. The overlay shows BOTH the source line (small italic) AND the translated line (full size, with active-word highlight as it's spoken). A voice matching the target language is auto-selected. Powered by Google's free public translation endpoint — no API key, no account.

• Floating overlay above the focused field — anchored above any text input, textarea, or contenteditable region. Buttons: ▶ Speak (re-read), 📌 Pin (stay open), × Close.

• Cmd / Ctrl + Shift + S to speak the focused field on demand. Esc to cancel speech and hide the overlay.

• Per-site disable list — silence the extension on banking, sensitive forms, or any domain you don't want it active.

WHO IT'S FOR

• Students with learning disabilities (dyslexia, ADHD, autism) who need to hear their writing read back to catch errors and stay on track.

• Adults transitioning off Read & Write or other paid assistive tech tools — same core features, different price.

• Multilingual users who want to type in their native language and have the translation read aloud in another voice.

• AAC users with motor impairments who use the parent PrismAAC web app at synalux.ai/prism-aac and want the same reading flow inside Gmail, Google Docs, Word Online, school portals, and any other web text field.

PRIVACY

• No-translate mode (default) is fully offline — Web Speech runs natively in your browser, the extension makes no network calls, and your typed text never leaves your device.

• Translate mode (opt-in) sends your sentence over HTTPS to translate.googleapis.com (Google's free public endpoint, no API key) so it can return the translation. Each unique sentence is cached after the first hit. Leave the target language blank to stay fully offline.

• No account, no subscription, no telemetry. Settings sync across your Chrome profile via chrome.storage.sync (the same mechanism Chrome uses for bookmarks).

OPEN SOURCE

AGPL-3.0 licensed. Source code, issues, and feature requests at
https://github.com/dcostenco/prism-aac/tree/main/chrome-extension

Built as part of the broader PrismAAC project (synalux.ai/prism-aac) — a free, open-source AAC web app for users with motor impairments and complex communication needs.
```

## Category

```
Accessibility
```

## Language

```
English
```

## Screenshots (1280×800 PNG, 1-5 required)

Generate via the e2e suite — they live under `chrome-extension/store-screenshots/` after running:

```sh
cd chrome-extension && npm run screenshots
```

(Script TBD — for the first listing, take 3 screenshots manually from a real site like Gmail with the overlay visible.)

## Promotional tile (optional, 440×280)

Skip for the first submission. Add later if the listing benefits from a hero image.

## Single purpose (Manifest V3 requirement)

```
Read text from focused input fields, translate it (optional), and speak it back via Web Speech API — with word-by-word visual highlight — to help users with reading, memory, or cognitive disabilities follow what they typed.
```

## Permission justifications

Each permission gets a short "why" the reviewer reads:

- **`storage`** — persists the user's settings (rate, voice, target language, per-site block list) across browser sessions.
- **`activeTab`** — the extension reads the focused field's value only when the user triggers speech (button click, sentence-end, or shortcut). It does not read fields without user action.
- **`<all_urls>` (host_permissions)** — the content script must run on arbitrary text fields across the web (Gmail, Docs, Word Online, school portals, etc.) for the extension to be useful. The script does not exfiltrate data.

## Privacy practices form

- **Personal information collected:** None.
- **Sold or transferred to third parties:** No.
- **Used for purposes unrelated to the extension's core functionality:** No.
- **Determines creditworthiness or for lending purposes:** No.
- **Network usage:** Only when the user has set a target language for translation; one HTTPS request per unique sentence to `translate.googleapis.com`. Cached locally after first hit. The user can opt out by leaving target language blank.

## Distribution

- **Visibility:** Public
- **Regions:** All (the OS voices used for TTS vary by locale; the extension itself works everywhere).
