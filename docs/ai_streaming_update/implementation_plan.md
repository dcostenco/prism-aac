# Fix Apple Watch Voice Streaming

The Apple Watch app currently waits for the AI to generate the **entire** response before it speaks. Because the Watch doesn't stream the response, the text-to-speech engine just sits in silence for 2-5 seconds. 

This plan will update the Apple Watch app's native Swift codebase to stream AI responses token-by-token, and speak each sentence the moment it is finished generating.

## Proposed Changes

### 1. WatchTTS.swift & ForgeTTSEngine.swift
In **Prism AAC**, add a `streamingTokenSink(language:)` function that returns `(onToken, flush)`. As tokens stream in, it checks for sentence boundaries (periods, exclamation marks) and sends each complete sentence to the `AVSpeechSynthesizer` instantly. 
In **Prism Coach**, `ForgeTTSEngine` already has `streamingTokenSink`, so we just need to wire it up.

#### [MODIFY] [WatchTTS.swift](file:///Users/admin/prism-aac/ios-native/PrismAACWatch/Sources/App/WatchTTS.swift)
- Add `streamingTokenSink()`

### 2. WatchLLMEngine.swift (Offline Model for both apps)
The local SmolLM2 model on the Apple Watch generates tokens in a loop, but currently concatenates them into a single string. We will add an `onToken: ((String) -> Void)?` callback to `infer()`, and call it the moment each new token is decoded by `llama_token_to_piece`.

#### [MODIFY] [WatchLLMEngine.swift](file:///Users/admin/prism-aac/ios-native/PrismAACWatch/Sources/AI/WatchLLMEngine.swift) (Prism AAC)
#### [MODIFY] [WatchLLMEngine.swift](file:///Users/admin/prismcoach/ForgeCoach Watch App/WatchLLMEngine.swift) (Prism Coach)
- Update inference functions to support the `onToken` closure.

### 3. WatchAISession.swift (Cloud routing for both apps)
Currently, `askViaCloud` buffers the full HTTP response using `URLSession.data(for:)`. We will switch it to `URLSession.bytes(for:)` to stream Server-Sent Events (SSE). 

We will update the main `ask()` function to:
1. Initialize the `streamingTokenSink()`.
2. Pass the `onToken` callback to the cloud and offline pathways.
3. Update the UI string incrementally (`self.reply += chunk`) so the Watch screen streams the text.
4. Call `flush()` when the generation ends so the final incomplete sentence is spoken.

#### [MODIFY] [WatchAISession.swift](file:///Users/admin/prism-aac/ios-native/PrismAACWatch/Sources/AI/WatchAISession.swift) (Prism AAC)
#### [MODIFY] [WatchAISession.swift](file:///Users/admin/prismcoach/ForgeCoach Watch App/WatchAISession.swift) (Prism Coach)
- Refactor `askViaCloud` to use `bytes(for:)` for SSE streaming.
- Update `ask()` to pipe tokens into `streamingTokenSink()`.

## Prism Coach Video Engine Review

You asked: *"why another agent replace prism coach video engine to claude video ? Any explanation why its better than precision video engine of prism-aac ?"*

To clarify, the previous agent did **not** replace the Prism Coach real-time video engine! 

Here is the breakdown:
1. **Real-time Pose Tracking (The "Precision Video Engine")**: Prism Coach still uses `BodyPoseTracker.swift` for real-time video tracking. This actually uses the exact same `oneEuroFilter` stabilization math ported directly from Prism AAC's precision tracking pipeline. It uses Apple's native, on-device `VNDetectHumanBodyPoseRequest` to track 18 body joints with zero latency.
2. **Claude Vision (Equipment Recognition)**: The Claude Vision API is only used in a completely different file (`EquipmentRecognizer.swift`). It takes a single, static photograph of your gym and figures out what equipment you have (e.g., "power rack", "dumbbells", "cable machine").

**Why Claude is used here instead of the Precision Video Engine**: 
Prism AAC's precision video engine is built for *spatial tracking* (finding where a hand, head, or joint is on a screen in real-time). It is completely incapable of *semantic scene understanding* (knowing the difference between a barbell and a broomstick). Claude Vision is used as a one-off tool during onboarding to understand the user's gym environment, while the precision video engine is used during the actual workout to track body movement. Both exist in Prism Coach and serve different purposes!

## App Store Submission

Once I make these Swift code changes, I will use your Fastlane / Ruby scripts to compile a new build and upload it to App Store Connect / TestFlight.

## User Review Required

> [!IMPORTANT]
> The `askViaPhone` pathway (which routes Watch AI requests to the iPhone over Bluetooth) uses a custom `WCSessionRouter` which expects a single dictionary payload. Modifying WatchConnectivity to stream tokens over Bluetooth is complex and prone to dropped messages. **I propose we leave the iPhone Bluetooth fallback as non-streaming**, and only enable sentence-by-sentence streaming for the Direct Cloud (WiFi/LTE) and Offline (On-Device) pathways. 

Does this sound good? If you approve, I will implement the code and submit the update to the App Store!
