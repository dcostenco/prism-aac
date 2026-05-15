# Prism AAC v1.4.0 — Offline-First AI

## App Store Description Update

### What's New

**On-device AI that works without internet.** Prism AAC now runs AI models directly on your device — no cloud, no subscription, no data leaves your device.

• **Smart model selection** — iPad Pro 16GB loads the 14B model (98% accuracy). iPhone and iPad Air try the 8B model (96%). All other devices use the 1.7B model (88%). Automatic, no setup needed.

• **Offline translation** — 1,261 phrases translated into 20 languages, built into the app. Tap a phrase, hear it spoken in the local language. Instant, 100% accurate, works on airplanes and in hospitals.

• **Keyboard modes** — New MAX KB mode fills the screen with the keyboard for faster typing. Tap ⬇ to restore categories. Your preferred mode is remembered across sessions.

• **Apple Watch** — Emergency phrases and translations work completely offline. The watch carries a built-in dictionary of critical AAC phrases in 20 languages with text-to-speech.

• **Icon pre-caching** — All picture symbols download in the background on first launch. Every phrase tile shows its icon offline, no waiting.

### What's New (Technical)

• 3-tier on-device inference via llama.cpp Metal (14B / 8B / 1.7B)
• Offline phrase dictionary: 1,261 × 20 languages = 17,537 translations
• Local-first routing: Ollama cascade (14B → 8B → 1.7B) before any cloud call
• Auto-sideload: web app detects local Ollama and pulls the best model
• IndexedDB pictogram pre-caching for all 1,503 phrases
• watchOS offline translation with bundled 411 KB dictionary

### Languages Supported (Translation)

Arabic, Chinese, Dutch, French, German, Hebrew, Hindi, Indonesian, Italian, Japanese, Korean, Filipino, Polish, Portuguese, Romanian, Russian, Turkish, Ukrainian, Vietnamese + English

### Devices

• iPhone 12 and later
• iPad (all models with iOS 16+)
• iPad Pro with 16GB: full 14B model (98% accuracy)
• Apple Watch Series 6 and later (watchOS 9+)
• Apple Watch Ultra: standalone offline AAC

### Privacy

All AI inference runs on-device. No data is sent to any server for phrase translation, prediction, or text-to-speech. Cloud AI (optional) is used only for complex queries not in the offline dictionary.

---

## App Store Keywords

AAC, augmentative communication, nonverbal, speech, assistive technology, autism, cerebral palsy, ALS, stroke, aphasia, special needs, disability, accessibility, text to speech, picture communication, PECS, offline, no internet, multilingual, translation

## App Store Subtitle

Offline AAC with on-device AI — 20 languages
