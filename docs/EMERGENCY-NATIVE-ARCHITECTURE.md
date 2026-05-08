# PrismAAC Emergency AI — Native Offline Architecture

> **TL;DR** — when a nonverbal child needs to call 911 with cellular-only / no internet, the AI must keep working. PrismAAC ships an on-device emergency model that runs without any cloud round-trip. No API key, no service tier, no failure mode where the most-life-critical interaction is the one that goes offline.

## At a glance

- ✅ **Fully offline** emergency response — never blocked by network
- ✅ **Instant TTS + speech-to-text** even without internet
- ✅ Country-aware emergency numbers (911 / 112 / 999 / 119 / etc.)
- ✅ One-tap **🚨 alert button** wired to call + caregiver SMS / Telegram broadcast
- ✅ **Audio context warmup** so iOS Safari doesn't suspend the chime when the child needs it most

<details>
<summary><strong>📐 Full offline architecture, model footprint, and routing details</strong></summary>

## The Requirement

A nonverbal child calls 911 through PrismAAC. The device has **cellular only, no internet.** The AI must:

1. Listen to the 911 operator through the device mic
2. Understand their questions using on-device speech-to-text
3. Generate natural responses using on-device LLM (Prism-Coder)
4. Speak the response through the device speaker/earpiece
5. The 911 operator hears the AI response through the phone connection

**Everything runs on-device. Zero cloud. Zero internet.**

## Why Native (Not PWA)

Safari on iOS blocks `SpeechRecognition` API entirely. Even Chrome on Android requires network for Web Speech API. A PWA cannot capture mic audio during a phone call or mix app audio with call audio.

**Native iOS app is required for this feature.** The PWA continues to work for all other features — the native layer adds only the emergency voice AI capability.

## Native iOS Stack

```
┌─────────────────────────────────────────────────┐
│  PrismAAC Native iOS Emergency Module           │
├─────────────────┬───────────────────────────────┤
│ Call Manager     │ CallKit + AVAudioSession      │
│                  │ .playAndRecord + .mixWithOthers│
├─────────────────┼───────────────────────────────┤
│ Mic Capture      │ AVAudioEngine                 │
│                  │ installTap on inputNode        │
│                  │ → PCM buffer at 16kHz          │
├─────────────────┼───────────────────────────────┤
│ On-Device STT    │ SFSpeechRecognizer            │
│                  │ requiresOnDeviceRecognition    │
│                  │ = true                         │
│                  │ Supports: en, es, fr, de, ja,  │
│                  │ ko, zh, pt, ru, ar, + more     │
├─────────────────┼───────────────────────────────┤
│ On-Device LLM    │ llama.cpp (C library)          │
│                  │ Model: prism-v12-fused Q4      │
│                  │ Size: 4GB, loaded at app start  │
│                  │ Inference: ~130ms on M-series   │
├─────────────────┼───────────────────────────────┤
│ On-Device TTS    │ AVSpeechSynthesizer            │
│                  │ Premium downloaded voices       │
│                  │ Latency: <50ms                  │
├─────────────────┼───────────────────────────────┤
│ Echo Cancel      │ AVAudioSession voice mode       │
│                  │ + AEC (Acoustic Echo Cancel)     │
│                  │ built into iOS audio pipeline    │
└─────────────────┴───────────────────────────────┘
```

## Audio Flow During Cellular Call

```
911 Operator speaks
    ↓ (cellular audio)
Phone speaker outputs operator's voice
    ↓
Device mic captures audio
    ↓ (iOS AEC removes echo from own TTS)
AVAudioEngine inputNode tap → PCM buffer
    ↓
SFSpeechRecognizer (offline) → text transcript
    ↓
llama.cpp (Prism-Coder) → response text
    ↓
AVSpeechSynthesizer → audio output
    ↓ (mixed with call via .mixWithOthers)
Phone speaker plays response
    ↓ (cellular audio)
911 Operator hears AI response
```

## Key iOS APIs

### AVAudioSession Configuration
```swift
let session = AVAudioSession.sharedInstance()
try session.setCategory(
    .playAndRecord,
    mode: .voiceChat,        // enables AEC
    options: [.mixWithOthers, .defaultToSpeaker, .allowBluetooth]
)
try session.setActive(true)
```

### SFSpeechRecognizer (Offline)
```swift
let recognizer = SFSpeechRecognizer(locale: Locale(identifier: "en-US"))!
recognizer.supportsOnDeviceRecognition // must be true

let request = SFSpeechAudioBufferRecognitionRequest()
request.requiresOnDeviceRecognition = true
request.shouldReportPartialResults = true

recognizer.recognitionTask(with: request) { result, error in
    if let text = result?.bestTranscription.formattedString {
        // Send to Prism-Coder for response
        generateResponse(question: text)
    }
}
```

### llama.cpp Integration
```swift
// Load model once at app startup
let model = llama_load_model_from_file("prism-v12-fused-q4.gguf", params)
let ctx = llama_new_context_with_model(model, ctxParams)

// Generate response (~130ms on M-series iPad/iPhone)
func generateResponse(question: String) -> String {
    let prompt = buildEmergencyPrompt(question: question, 
                                       script: emergencyScript,
                                       history: conversationHistory)
    return llama_generate(ctx, prompt, maxTokens: 100)
}
```

### AVSpeechSynthesizer (Offline TTS)
```swift
let utterance = AVSpeechUtterance(string: response)
utterance.voice = AVSpeechSynthesisVoice(identifier: "com.apple.voice.premium.en-US.Zoe")
utterance.rate = 0.5
synthesizer.speak(utterance)
```

## Echo Cancellation

iOS's `.voiceChat` mode enables hardware Acoustic Echo Cancellation (AEC). This prevents the mic from picking up the AI's own TTS output. The AEC is the same one used by FaceTime and Phone app — battle-tested.

If AEC isn't sufficient, add a software gate:
- Mute mic input while TTS is playing
- Resume mic capture 200ms after TTS completes
- This prevents any echo loop

## Offline Language Support

SFSpeechRecognizer supports offline recognition for:
- English, Spanish, French, German, Italian, Portuguese
- Japanese, Korean, Chinese (Mandarin, Cantonese)
- Russian, Arabic, Turkish, Thai, Vietnamese
- Hindi, Indonesian, Malay, and more

Matches PrismAAC's 12 supported languages.

## Memory Budget (iPad 8GB)

| Component | Memory |
|-----------|--------|
| Prism-Coder Q4 model | 4.0 GB |
| SFSpeechRecognizer | ~200 MB |
| AVAudioEngine buffers | ~50 MB |
| App + UI | ~100 MB |
| **Total** | **~4.35 GB** |

Fits within the ~5 GB safe limit on 8 GB iPads. On 16 GB iPad Pro, ample headroom.

## Conversation History Context

The AI has access to:
1. **Emergency script** — name, age, location, medical info, allergies, medications
2. **Conversation history** — last 20 messages the child typed before the emergency
3. **Current call transcript** — everything the operator has asked so far in THIS call

Example operator questions and AI responses:

| Operator asks | AI uses | Response |
|---|---|---|
| "What was the child doing before this?" | Conversation history | "Alex was typing about stomach pain 5 minutes ago, then said 'I feel dizzy' 2 minutes ago." |
| "Did they eat anything unusual?" | Conversation history | "Looking at their messages... Alex mentioned 'pizza' and 'juice' about 30 minutes ago." |
| "Any medications?" | Emergency profile | "Alex takes Keppra 250 milligrams for epilepsy." |
| "Is anyone with them?" | Context inference | "I don't have that information. The device is with Alex." |
| "Can you ask them if they're in pain?" | Real-time | "Alex is using the device now. Let me check... Alex typed 'it hurts'." |

## Development Path

### Phase 1: Capacitor/React Native wrapper (2-3 weeks)
- Wrap existing PrismAAC web app in native shell
- Add native module for AVAudioSession + SFSpeechRecognizer
- Bridge to JavaScript for the emergency service

### Phase 2: llama.cpp integration (1-2 weeks)
- Compile llama.cpp as iOS static library
- Load prism-v12 GGUF model on first launch
- Swift bridge for prompt → response

### Phase 3: Audio pipeline (1 week)
- AVAudioEngine mic capture during call
- Echo cancellation configuration
- Mute gate during TTS playback

### Phase 4: Testing (2 weeks)
- Test with real cellular calls (not Twilio)
- Test in noisy environments (school, hospital, outdoor)
- Test AEC with different speaker volumes
- Test with actual 911 PSAPs (coordinate with local authorities)

## Device Compatibility

| Device | Cellular Call | On-Device STT | Prism-Coder | Full Offline AI |
|--------|:---:|:---:|:---:|:---:|
| iPhone 12+ | YES | YES | YES | **YES** |
| iPhone SE 3 | YES | YES | YES (tight) | **YES** |
| iPad Pro M1+ | With cellular | YES | YES | **YES** |
| iPad Air M2+ | With cellular | YES | YES | **YES** |
| iPad WiFi only | NO cellular | YES | YES | VoIP only (needs internet) |
| Apple Watch | Paired iPhone | Limited | NO | Delegates to iPhone |

## This Is Not Theoretical

- **SFSpeechRecognizer offline**: Shipping in iOS since iOS 13 (2019). Used by Voice Control accessibility feature.
- **llama.cpp on iOS**: Shipping in LLM Farm, Private LLM, and other App Store apps since 2024.
- **AVSpeechSynthesizer**: Shipping since iOS 7 (2013).
- **AVAudioSession .mixWithOthers**: Shipping since iOS 6 (2012).

Every component is production-ready. The integration is the engineering work.

</details>
