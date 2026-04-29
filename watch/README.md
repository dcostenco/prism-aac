# Prism AAC — Watch Companion Apps

Quick phrase buttons for wrist-level communication. Both apps provide instant access to the same phrase categories as the main app, with text-to-speech output directly from the watch speaker.

## Apple Watch (watchOS 10+)

SwiftUI app with:
- Category grid → phrase list navigation
- Tap any phrase to speak it aloud
- Quick emergency buttons (Help / Yes / No) always visible
- Haptic feedback on tap
- Last-spoken phrase badge

**Build:** Add `watch/apple/` as a WatchKit Extension target in Xcode.

## Wear OS (Samsung Galaxy Watch / Pixel Watch)

Jetpack Compose for Wear OS with:
- ScalingLazyColumn category list
- Material Wear chip-based phrase buttons
- Quick emergency row (Help / Yes / No)
- TextToSpeech at 0.6x rate
- Last-spoken phrase display

**Build:** Add `watch/wearos/` as a Wear OS module in Android Studio.

## Limitations

Watch apps are limited to **quick phrase buttons only** — no full keyboard, no AI assistant. The watch speaker handles TTS directly. For full keyboard and AI features, use the phone/tablet app or synalux.ai/prism-aac/app.
