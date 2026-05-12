# PrismAAC iOS Native Implementation

## Architecture

The iOS app wraps the PrismAAC web app in a native WKWebView shell, adding:
- On-device 1.5B LLM inference via llama.cpp Metal (when device has sufficient memory)
- Native TTS override (AVSpeechSynthesizer)
- WCSession bridge for Apple Watch emergency dispatch
- Keychain-backed auth token storage
- Memory-aware feature gating (4 tiers)

## Project Structure

```
ios-native/
├── PrismAAC.xcodeproj
├── PrismAAC/
│   ├── Info.plist
│   ├── Sources/
│   │   ├── App/
│   │   │   ├── PrismAACApp.swift        — @main entry, WCSession activation
│   │   │   └── AppState.swift           — Memory monitoring, feature tier gating
│   │   ├── Engine/
│   │   │   ├── AACPipeline.swift        — 3-layer AI pipeline (safety → on-device → cloud)
│   │   │   └── LLMEngine.swift          — llama.cpp wrapper (load/generate/unload)
│   │   ├── Safety/
│   │   │   └── SafetyFilter.swift       — Multilingual crisis detection (23 langs)
│   │   ├── Shared/
│   │   │   └── KeychainHelper.swift     — Keychain read/write/delete
│   │   └── Views/
│   │       └── ContentView.swift        — WKWebView host, JS bridge, offline fallback
│   └── Resources/
├── PrismAACWatch/
│   └── Sources/
│       ├── App/
│       │   ├── WatchApp.swift           — @main, environment objects
│       │   ├── WCSessionRouter.swift    — Centralized WCSession delegate
│       │   └── WatchTTS.swift           — AVSpeechSynthesizer with delegate
│       ├── AI/
│       │   ├── WatchAISession.swift     — Cloud + companion AI paths
│       │   ├── WatchInbox.swift         — Keychain-backed message inbox
│       │   ├── WatchTranslation.swift   — 23-language translation
│       │   └── WatchVocabSync.swift     — Vocabulary sync from iPhone
│       ├── Emergency/
│       │   └── WatchEmergencyManager.swift — Full emergency state machine
│       ├── Shared/
│       │   └── KeychainHelper.swift     — Shared Keychain helper
│       └── Views/
│           └── WatchPictogramCards.swift — All Watch UI views
├── PrismAACTests/
├── PrismAACUITests/
│   ├── PrismAACUITests.swift
│   └── ButtonCoverageTests.swift
└── Package.swift                        — llama.cpp SPM dependency
```

## Memory Tiers

| Tier | Free Memory | Features |
|------|------------|----------|
| 3 — Full AI | ≥1400 MB | On-device 1.5B inference |
| 2 — Cloud AI | 800–1399 MB | Core AAC + cloud API fallback |
| 1 — Core Only | 300–799 MB | Offline phrase board + TTS |
| 0 — Emergency | <300 MB | Emergency button only, model unloaded |

## Security

- Input sanitization: 23 injection tokens + NFKC normalization + bracket filter
- Language parameter validated against allowlist (23 codes)
- Cloud requests require Keychain auth token (hard guard)
- Dedicated URLSession with 15s/30s timeouts
- Response size capped at 64KB

## Watch Emergency System

1. Countdown (5s) with haptic + TTS
2. WCSession dispatch to iPhone (preferred)
3. Cellular HTTPS fallback with SPKI certificate pinning
4. On-device TTS fallback ("Emergency. Please call 911.")
5. LAContext authentication for force-reset
6. 30s cooldown after cleanup

## Build

```bash
# iOS app
xcodebuild build -project PrismAAC.xcodeproj -scheme PrismAAC \
  -destination "platform=iOS Simulator,name=iPhone 17 Pro" \
  CODE_SIGNING_ALLOWED=NO

# Watch app (requires paired iPhone scheme)
xcodebuild build -project PrismAAC.xcodeproj -scheme PrismAACWatch \
  CODE_SIGNING_ALLOWED=NO
```

## Debug Mode

In DEBUG builds, the WKWebView loads from `http://localhost:3001/prism-aac` (local dev server) instead of `https://synalux.ai/prism-aac`. ATS exception for localhost is configured in Info.plist.
