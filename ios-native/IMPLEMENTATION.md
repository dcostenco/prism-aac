# PrismAAC iOS Native — Implementation Guide

> **For agents picking this up:** Read this entire document before touching any file.
> Previous Expo/React Native submissions were rejected by Apple (guideline 4.2 — web view wrapper).
> This is a ground-up native SwiftUI rewrite. Every decision here has a reason tied to either
> App Store compliance, memory budget, or AAC user safety.

---

## 1. Why Native SwiftUI (not Expo/React Native)

Apple guideline **4.2 (Minimum Functionality)** rejects apps that are "primarily a web view."
The previous `ios/` directory was an Expo wrapper around the Next.js web app. Apple rejected it.

This rewrite is:
- **Pure SwiftUI** — no WebView, no Expo, no React Native
- **On-device AI** via llama.cpp Metal backend — no cloud required for core AAC
- **Offline-capable** — critical for AAC users who may not have reliable internet
- **Watch companion retained** — the watchOS emergency app is already native, keep it

---

## 1b. Device × Feature Matrix (real-time, driven by AppState.swift)

Features are enabled/disabled **on the fly** based on `AppState.measureFreeMemoryMB()`
sampled every 2 seconds via `phys_footprint` (the value iOS uses for jetsam limits — more
accurate than `resident_size`). When memory drops between tiers, the UI updates immediately
without a restart.

### Tiers

| Tier | Free Memory | Trigger |
|------|-------------|---------|
| **TIER 3 — Full AI** | ≥ 1,400 MB | Model loaded, plenty of headroom |
| **TIER 2 — Cloud AI** | 800–1,399 MB | Model not loaded OR 3 GB device under pressure |
| **TIER 1 — Core Only** | 300–799 MB | Memory pressure — AI disabled proactively |
| **TIER 0 — Emergency** | < 300 MB | Imminent OOM — model unloaded automatically |

### Feature × Device × Tier matrix

| Feature | iPad 9th (3 GB) | iPhone 11+ (4 GB) | iPhone 13+ (6 GB) | iPad Air M1 (8 GB) |
|---------|:-:|:-:|:-:|:-:|
| Phrase board (core vocab) | ✅ always | ✅ always | ✅ always | ✅ always |
| QWERTY keyboard | ✅ always | ✅ always | ✅ always | ✅ always |
| AVSpeechSynthesizer TTS | ✅ always | ✅ always | ✅ always | ✅ always |
| Utterance history (SQLite) | ✅ always | ✅ always | ✅ always | ✅ always |
| Watch emergency alerts | ✅ always | ✅ always | ✅ always | ✅ always |
| Layer 1 safety filter | ✅ always | ✅ always | ✅ always | ✅ always |
| Cloud AI (network req.) | ⚠️ tier≥2 | ✅ tier≥2 | ✅ tier≥2 | ✅ tier≥2 |
| On-device 1.5B inference | ⚠️ marginal¹ | ✅ tier 3 | ✅ tier 3 | ✅ tier 3 |
| Smart word prediction (AI) | ⚠️ marginal¹ | ✅ tier 3 | ✅ tier 3 | ✅ tier 3 |
| Layer 3 validator loop | ⚠️ marginal¹ | ✅ tier 3 | ✅ tier 3 | ✅ tier 3 |

¹ iPad 9th gen (3 GB): model load attempted if 1,200 MB free at launch.
  If headroom < 200 MB after load → falls to TIER 2 automatically (model unloaded).
  User is shown a banner and offered Cloud AI or Core-only mode.
  **Core AAC (phrase board + TTS) always works.**

### What happens when memory drops mid-session

```
TIER 3 → TIER 2:  "AI" button greys out. Banner: "Low memory — AI switched to cloud"
                   In-flight generation completes, then switches to cloud.

TIER 2 → TIER 1:  Cloud AI button disappears. Banner: "Low memory — core AAC only"

TIER 1 → TIER 0:  Model unloaded proactively. Banner: "⚠️ Very low memory — AI disabled"
                   Core AAC (phrase board + TTS) continues unaffected.
                   OS jetsam does NOT kill the app because we freed the model first.
```

### OOM prevention strategy

`AppState.tick()` polls every 2 seconds. At TIER 0 (< 300 MB free):
1. `llm.unload()` called → frees ~964 MB instantly
2. UI degrades to core-only
3. User sees a red banner
4. No crash. No data loss.

Without this, iOS would silently kill the process at ~150 MB free (jetsam).
The user would see a blank screen and lose their composed message.

---

## 1c. Apple Watch — Standalone + Companion Architecture

### Why standalone is required
AAC users (especially children) leave the house without their iPhone, or the iPhone battery dies.
The Watch MUST work as a complete communication device on its own.

### Watch memory budget (why no on-device LLM)

| Component | Memory |
|-----------|--------|
| watchOS overhead | ~700 MB |
| App + Swift runtime | ~100 MB |
| Layer 1 safety (Swift, no model) | ~5 MB |
| Core phrase store (SQLite) | ~10 MB |
| AVSpeechSynthesizer TTS | ~50 MB |
| Available for model | **~135 MB** |
| prism-ios-1.5B Q4_K_M | **864 MB** ❌ — DOES NOT FIT |
| Qwen2.5-0.5B Q4_K_M (future) | ~100 MB ✅ — stretch goal for v2 |

**Decision: no on-device LLM on Watch. AI uses companion or cloud path.**

### Connectivity priority (WatchAISession.swift)

```
Request arrives
    │
    ├── WatchConnectivity reachable? ──YES──→ sendMessage to iPhone
    │                                          iPhone runs 1.5B on-device
    │                                          reply via replyHandler (~500ms)
    │
    └── NO ──────────────────────────────────→ URLSession to synalux.ai
                                               Watch WiFi/LTE required
                                               (~1-3s cloud round-trip)

Always offline (no dependency on connectivity):
    • Layer 1 safety filter (WatchSafetyFilter.swift)
    • Core phrase pictograms (tapped from card) + AVSpeechSynthesizer TTS
    • Emergency alerts (sent via transferUserInfo — queued until iPhone reachable)
```

### UI design — large pictogram cards for children

**Key constraint**: primary users are children with limited motor skills.
Keyboard input is NOT the primary input method.

```
Full-screen swipeable card (WatchPictogramCards.swift):
  ┌─────────────────────────┐
  │  [    BIG PICTURE    ]  │  ← ARASAAC pictogram, 100px tall
  │                         │
  │       WATER             │  ← 16pt bold label
  └─────────────────────────┘
       ← swipe → next word

  • Single tap → speaks word + sends to iPhone
  • Digital Crown scroll → browse words
  • SOS button always in top-right corner
  • Categories: Quick / Needs / Feelings / Emergency / Places
```

Vocabulary is ordered by frequency of use for young AAC users (childFriendlyOrder in AACVocab).
First 8 words (≤ 3 swipes) cover ~70% of common needs: Yes/No/More/Done/Help/Want/Stop/Go.

### Watch keyboard (Series 10 / Ultra 2, watchOS 11+)

Series 10 (46mm) and Ultra 2 (49mm) have a tiny QWERTY keyboard in watchOS 11.
Enabled automatically via standard SwiftUI `TextField`. No special code needed.
This is the AI text input path for adults / caregivers — NOT for children.
The pictogram card swipe UI is the default for all users.

### ARASAAC pictograms on Watch

- Downloaded via `AsyncImage` from `static.arasaac.org/pictograms/{id}/{id}_300.png`
- Cached by watchOS URL cache (survives across sessions, no extra code)
- Falls back to SF Symbol if network unavailable or ARASAAC returns error
- ALL SF Symbol fallbacks selected to be visually similar to ARASAAC equivalents
- License: ARASAAC CC BY-NC-SA — free for AAC use, requires attribution in About screen

### Emergency (always offline)

WatchEmergencyManager.swift:
1. Tap SOS → immediate haptic (`.notification`) + AVSpeechSynthesizer "Help! Emergency!"
2. 5-second countdown with cancel option (prevents accidental triggers)
3. Countdown expires → escalate:
   - WatchConnectivity sendMessage (if iPhone reachable) → Twilio/SMS chain
   - WatchConnectivity transferUserInfo (if iPhone not reachable) → delivered when iPhone wakes
   - SOS pattern haptic (3-short, 3-long, 3-short) on Watch
4. Apple Watch Emergency SOS (hold side button) remains available as system fallback

### Watch feature × connectivity matrix

| Feature | No network + No iPhone | Watch WiFi/LTE only | + iPhone BT |
|---------|:---:|:---:|:---:|
| Phrase pictograms (tap to speak) | ✅ | ✅ | ✅ |
| AVSpeechSynthesizer TTS | ✅ | ✅ | ✅ |
| Layer 1 safety filter | ✅ | ✅ | ✅ |
| Emergency SOS (queue to iPhone) | ✅ | ✅ | ✅ |
| AI chat (cloud) | ❌ | ✅ | ✅ |
| AI chat (on-device 1.5B via iPhone) | ❌ | ❌ | ✅ |
| Phrase sent to iPhone for richer TTS | ❌ | ❌ | ✅ |

### Watch files

```
PrismAACWatch/Sources/
├── App/
│   ├── WatchApp.swift              ← @main, scene setup
│   └── WatchTTS.swift              ← AVSpeechSynthesizer wrapper
├── AI/
│   └── WatchAISession.swift        ← companion + cloud AI, Layer 1 safety
├── Emergency/
│   └── WatchEmergencyManager.swift ← standalone emergency, WatchConnectivity
└── Views/
    ├── WatchPictogramCards.swift   ← full-screen swipeable picture cards (primary UI)
    ├── WatchRootView.swift         ← root: pictogram cards + overlays
    └── WatchPhrasePictogramView.swift ← (archived — replaced by PictogramCards)
```

---

## 2. Model Specs (prism-ios-1.5B)

| Property | Value |
|----------|-------|
| Base | Qwen/Qwen3.5-2B (trained at 2B, distilled to 1.5B for iOS) |
| Format | GGUF Q4_K_M |
| Disk size | ~864 MB |
| Runtime (model weights) | ~864 MB |
| KV cache @ 512 tokens | ~50 MB |
| App overhead | ~250 MB |
| **Total peak** | **~1,164 MB** |
| Inference speed | ~50 tok/s on A15 (Metal), ~30 tok/s on A13 |
| Context window | **512 tokens max** (hard cap — see §3) |

### Why 512-token cap is non-negotiable

Beyond 512 tokens, KV cache doubles every doubling of context:
- @ 1024 tokens → +100 MB KV cache
- @ 2048 tokens → +400 MB KV cache
- On a 4 GB device with 2.6 GB available, this causes jetsam (process killed, silent to user)

AAC users never need > 512 tokens of context. Most exchanges are 1-3 sentences.

### Device requirements

| Device | RAM | Status |
|--------|-----|--------|
| iPhone 11 / A13 | 4 GB | ✅ Min supported |
| iPhone 12-14 / A14-A15 | 4-6 GB | ✅ OK |
| iPhone 15 Pro / A17 | 8 GB | ✅ Plenty |
| iPad 9th gen / A13 | **3 GB** | ⚠️ Marginal — warn user |
| iPad mini 6 / A15 | 4 GB | ✅ OK |
| iPad Air M1+ | 8 GB | ✅ Plenty |

**Hard minimum: 4 GB RAM.** On 3 GB devices, show `InsufficientMemoryView` and offer cloud fallback.

---

## 3. Three-Layer Safety Architecture

```
USER INPUT
    │
    ▼
┌────────────────────────────────────────┐
│  LAYER 1 — SafetyFilter.swift          │
│  Deterministic. Zero latency.          │
│  Regex + keyword sets.                 │
│  Self-harm → 988 response (hardcoded)  │
│  Medical dosing → refusal template     │
│  Cannot hallucinate. 100% reliable.   │
└──────────────┬─────────────────────────┘
               │ (if safe)
               ▼
┌────────────────────────────────────────┐
│  LAYER 2 — LLMEngine.swift             │
│  prism-ios-1.5B via llama.cpp Metal    │
│  Generates primary AAC response        │
│  Cloud fallback if model not loaded    │
└──────────────┬─────────────────────────┘
               │
               ▼
┌────────────────────────────────────────┐
│  LAYER 3 — AACValidator.swift          │
│  Re-runs prism-ios-1.5B as validator   │
│  Loop (max 3 iter):                    │
│    1. Too long? → compress             │
│    2. Wrong language? → translate      │
│    3. Unsafe? → route to safety tmpl   │
│    4. Clinical jargon? → simplify      │
│  Output: final clean AAC response      │
└────────────────────────────────────────┘
```

### Layer 1 keyword sets (SafetyFilter.swift)
- **Immediate crisis**: "kill myself", "can't breathe", "call 911", "help me", "emergency"
  → Returns hardcoded 911/988 guidance, bypasses model entirely
- **Medical dosing**: "how many mg", "overdose", "medication dose"
  → Returns "Please ask your doctor or pharmacist" template
- **Post-check**: runs on Layer 2 output before returning to user

### Layer 3 validator prompt template
```
[VALIDATOR] Review this AAC response:
"{response}"

Check:
1. Is it ≤ 3 sentences? (AAC users need short text)
2. Is it in {language}?
3. Does it contain any of: {unsafe_keywords}?
4. Is it free of clinical jargon?

If ALL checks pass, output: VALID
If any check fails, output: REWRITE: {corrected_response}
```

---

## 4. Project Structure

```
ios-native/
├── Package.swift                    ← SPM manifest, llama.cpp dependency
├── IMPLEMENTATION.md                ← this file
└── PrismAAC/
    ├── Sources/
    │   ├── App/
    │   │   ├── PrismAACApp.swift    ← @main, model download on first launch
    │   │   └── AppState.swift       ← global app state, model ready flag
    │   ├── Engine/
    │   │   ├── LLMEngine.swift      ← llama.cpp Metal wrapper
    │   │   ├── ModelDownloader.swift← first-launch model fetch + progress
    │   │   └── AACPipeline.swift    ← orchestrates Layer 1→2→3
    │   ├── Safety/
    │   │   ├── SafetyFilter.swift   ← Layer 1 deterministic filter
    │   │   └── AACValidator.swift   ← Layer 3 validator loop
    │   ├── Views/
    │   │   ├── ContentView.swift    ← root: board or keyboard mode
    │   │   ├── PhraseBoardView.swift← AAC symbol grid (core vocab)
    │   │   ├── KeyboardView.swift   ← QWERTY + prediction bar
    │   │   ├── MessageBarView.swift ← composed message + Speak button
    │   │   ├── AIResponseView.swift ← streaming AI response panel
    │   │   └── ModelLoadingView.swift← download progress + memory check
    │   └── Stores/
    │       ├── PhraseStore.swift    ← local SQLite phrase database
    │       ├── SettingsStore.swift  ← language, voice, rate preferences
    │       └── HistoryStore.swift   ← utterance history (on-device only)
    ├── Tests/
    │   ├── SafetyFilterTests.swift  ← pins all Layer 1 keyword triggers
    │   └── AACPipelineTests.swift   ← integration tests for 3-layer flow
    └── Resources/
        └── CoreVocab.json          ← 200-word AAC core vocabulary seed
```

---

## 5. App Store Compliance Fixes

### Info.plist — required additions

```xml
<!-- Camera: used for head-tracking and pictogram capture -->
<key>NSCameraUsageDescription</key>
<string>Prism AAC uses the camera for hands-free head tracking and to capture images for custom pictograms.</string>

<!-- Photo library: custom pictogram import -->
<key>NSPhotoLibraryUsageDescription</key>
<string>Prism AAC can import photos from your library to create custom communication symbols.</string>

<!-- Location: optional, for emergency services -->
<key>NSLocationWhenInUseUsageDescription</key>
<string>Prism AAC can share your location with emergency contacts when you trigger an SOS alert.</string>
```

Already present (verify strings are meaningful, not generic):
- `NSMicrophoneUsageDescription` ✅
- `NSContactsUsageDescription` ✅
- `NSSpeechRecognitionUsageDescription` ✅

### PrivacyInfo.xcprivacy — required additions

```xml
<key>NSPrivacyCollectedDataTypes</key>
<array>
  <dict>
    <key>NSPrivacyCollectedDataType</key>
    <string>NSPrivacyCollectedDataTypeMicrophoneRecording</string>
    <key>NSPrivacyCollectedDataTypeLinked</key>
    <false/>
    <key>NSPrivacyCollectedDataTypeTracking</key>
    <false/>
    <key>NSPrivacyCollectedDataTypePurposes</key>
    <array>
      <string>NSPrivacyCollectedDataTypePurposeAppFunctionality</string>
    </array>
  </dict>
  <dict>
    <key>NSPrivacyCollectedDataType</key>
    <string>NSPrivacyCollectedDataTypeContactInfo</string>
    <key>NSPrivacyCollectedDataTypeLinked</key>
    <false/>
    <key>NSPrivacyCollectedDataTypeTracking</key>
    <false/>
    <key>NSPrivacyCollectedDataTypePurposes</key>
    <array>
      <string>NSPrivacyCollectedDataTypePurposeAppFunctionality</string>
    </array>
  </dict>
</array>
```

### App Store Review Notes (include in submission)

```
This app is an Augmentative and Alternative Communication (AAC) tool for 
non-speaking individuals. It runs an AI language model (1.5B parameters, 
~864 MB) entirely on-device using Apple Metal. No user speech or text is 
sent to external servers during normal AAC use.

Emergency features (watchOS companion) use WatchConnectivity to relay SOS 
alerts. Location access is optional and only used when the user explicitly 
triggers an emergency.

The app complies with guideline 4.2 — it is a fully native SwiftUI 
application with on-device AI, not a web view wrapper.
```

---

## 6. Model Download Flow (First Launch)

The 864 MB GGUF cannot be bundled in the App Store (binary size limit is effectively ~4 GB but
large bundles trigger manual review). Download on first launch instead:

```
App Launch
    │
    ├── model file exists in Documents/? ──YES──→ load model → main UI
    │
    └── NO → ModelLoadingView
                │
                ├── Check available storage (need 1.5 GB free)
                ├── Show progress: "Downloading AI model (864 MB)"
                ├── Fetch from CDN: https://synalux.ai/models/prism-ios-1.5b-q4.gguf
                ├── Verify SHA-256 checksum
                └── Save to Documents/models/prism-ios-1.5b-q4.gguf → load → main UI
```

CDN URL must be HTTPS. File must be served with correct MIME type.
Resume-capable download (HTTP Range requests) for large file.

---

## 7. Key Implementation Constraints (DO NOT VIOLATE)

1. **Never increase MAX_CTX above 512** without re-running the memory budget.
   At 1024 tokens, iPad 9th gen OOMs. At 2048, iPhone 11 OOMs.

2. **Never call llama.cpp APIs from the main thread.**
   All inference is `async` in `LLMEngine`. Violating this blocks the UI and causes
   watchdog kills on iOS (the system kills apps that hang the main thread > 20s).

3. **Layer 1 safety filter runs SYNCHRONOUSLY before ANY model call.**
   Self-harm responses must be < 50ms. No `async`, no model needed.

4. **KV cache is cleared after every generation** (`llama_kv_cache_clear`).
   AAC conversations are stateless by design — each Speak press is independent.
   Accumulating KV cache across turns would OOM within 5-10 exchanges.

5. **Model file lives in `Documents/` not `Caches/`.**
   iOS can purge `Caches/` under storage pressure. The user should not need to
   re-download 864 MB every time the device runs low on storage.

6. **Flash attention is ON** (`ctxParams.flash_attn = true`).
   Reduces KV cache memory ~20%. Do not disable.

---

## 8. Testing Checklist (simulator + device)

- [ ] Model downloads correctly on first launch (simulate no model present)
- [ ] Memory warning appears on simulated 3 GB device (set physical memory cap in scheme)
- [ ] Layer 1: type "help me" → 911/988 response appears instantly (< 100ms)
- [ ] Layer 1: type "how many mg of" → refusal template
- [ ] Layer 2: type "I want water" → short AAC response generated on-device
- [ ] Layer 3: long response → validator loop compresses to ≤ 3 sentences
- [ ] Emergency watch tap → alert appears on iPhone within 2s
- [ ] App resumes correctly after background (model already loaded, no re-download)
- [ ] Privacy: microphone permission prompt appears on first voice input
- [ ] Privacy: contacts permission prompt appears on first contact access
- [ ] Orientation: works in both portrait and landscape on iPad

---

## 9. Files NOT to Touch

- `ios/PrismAACWatch/` — Watch app is already native Swift, well-tested, keep as-is
- `ios/PrismAAC.entitlements` — Universal Links config, don't break
- Anything in the `prism-aac/` Next.js web app — this iOS native build is independent

---

## 10. Submission Checklist

- [ ] Version bumped in Info.plist (CFBundleShortVersionString + CFBundleVersion)
- [ ] All usage strings in Info.plist are specific (not generic "this app uses X")
- [ ] PrivacyInfo.xcprivacy has all collected data types declared
- [ ] App Store review notes explain AAC use case + on-device AI
- [ ] No third-party analytics SDKs (no Firebase, no Mixpanel, no Amplitude)
- [ ] No advertising SDKs
- [ ] ITSAppUsesNonExemptEncryption = false (confirmed, no custom encryption)
- [ ] Model file available on CDN before submission
- [ ] SHA-256 checksum hardcoded in ModelDownloader.swift
- [ ] Tested on physical device (iPhone 11 minimum) not just simulator
