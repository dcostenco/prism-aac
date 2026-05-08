# Privacy Policy — PrismAAC Reading Assistant (Chrome extension)

**Last updated:** 2026-05-08
**Contact:** dcostenco@gmail.com

## Plain-English summary

The PrismAAC Reading Assistant browser extension does **not** collect, store, transmit, sell, or share any personal information. It runs entirely on your device using your browser's built-in speech engine.

The single exception is **opt-in translation**: if you set a target language in the extension's options, your typed sentences are sent over HTTPS to Google's free public translation endpoint (`translate.googleapis.com`) so it can return the translation. This is the only network call the extension makes. To stay fully offline, leave the target language blank — that's the default.

## What data the extension reads

The extension reads the **value of the focused text field** (an `<input>`, `<textarea>`, or contenteditable element) **only when you trigger speech**:

- You tap the **▶ Speak** button on the floating overlay
- You press **Cmd / Ctrl + Shift + S**
- You type a sentence-end punctuation (`.?!`) and you've enabled "Speak the sentence on .?!" in settings
- You tap space and you've enabled "Speak each word on space" in settings

The extension does NOT read fields automatically, scrape page content, or watch what you type when speech is not triggered.

## What data the extension stores

The extension stores **your settings** via `chrome.storage.sync`:

- Whether the extension is enabled
- Which speak triggers you've enabled (sentence-end, on-space)
- Your preferred voice, rate, volume, pitch
- Your translation source + target language (default: empty / no translation)
- A list of domains where you've disabled the extension

`chrome.storage.sync` is provided by Chrome and syncs settings across the devices signed into the same Chrome profile (the same mechanism Chrome uses for bookmarks). The extension does NOT have its own server, account system, or remote storage. To keep settings local only, disable Chrome Sync via `chrome://settings/syncSetup`.

## What data the extension sends over the network

**No-translate mode (default):** Zero network calls.

**Translate mode (opt-in):** When you set a target language, the extension sends your sentence over HTTPS to:

```
https://translate.googleapis.com/translate_a/single?client=gtx&sl=<source>&tl=<target>&dt=t&q=<your sentence>
```

This is Google's free public translation endpoint (`translate_a/single`), the same one used by Mate Translate, ImTranslator, and many other browser extensions. Each unique sentence is cached locally in memory after the first request, so re-reading the same text doesn't re-fetch.

To stop the extension from making network calls, open the options page and set the target language to "Off — speak the source text".

## What data third parties receive

- **OS speech engine (Web Speech API):** receives the text to be spoken so it can synthesize audio. The Web Speech API is provided by your browser / operating system; per the W3C spec, browsers may route this to a cloud TTS provider (Microsoft Edge sometimes does this; Chrome typically uses local OS voices). Consult your browser's privacy policy for specifics.
- **Google Translate (only in translate mode):** receives the source sentence and returns the translation. Subject to Google's privacy policy at https://policies.google.com/privacy.

The extension does NOT send data to any other service. There is no analytics, no telemetry, no error reporting, no advertising network.

## Personal information

The extension is incompatible with the collection of personal information by design — there is no server backend, no account, no logs. If you set translation on and type personal information into a translated field, that text reaches Google Translate's endpoint. The extension does not process or store that data; it only displays + speaks the response.

## Children's privacy

The extension is intended for users of all ages, including students. It does not collect personally identifiable information. Caregivers concerned about translation traffic can leave the target language blank to keep the extension fully offline.

## Open source

The extension is open source under the AGPL-3.0 license. You can audit the network behavior at:

- `chrome-extension/src/translate.ts` — the only file that makes network calls
- `chrome-extension/src/storage.ts` — the only file that touches `chrome.storage.sync`

Source: https://github.com/dcostenco/prism-aac/tree/main/chrome-extension

## Changes to this policy

If the extension ever begins collecting any data, this policy will be updated and a notice posted in the Chrome Web Store listing release notes. Material changes will be flagged in the extension's options page on first launch after the update.

## Contact

Questions or concerns: open an issue at https://github.com/dcostenco/prism-aac/issues or email dcostenco@gmail.com.
