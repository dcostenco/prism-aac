# Prism Coach AI & Vision Fixes Walkthrough

## 1. Native On-Device AI for Apple Watch
Previously, Prism Coach Watch relied entirely on the iPhone (via WatchConnectivity) or a direct cloud connection for its AI coaching features. If both failed, the AI was completely unavailable.

We ported the `WatchLLMEngine` architecture from Prism AAC to Prism Coach, bringing fully native, offline, CPU-based inference to the Apple Watch:
* **Package Dependencies**: Updated the `llama.cpp` SPM condition to allow compilation for `watchOS`.
* **WatchLLMEngine**: Created a Watch-specific engine to load the tiny 360M model into the Watch's ~250MB memory footprint. The engine is tuned with a concise fitness coach system prompt.
* **WatchAISession Integration**: The Watch app will now silently load `smollm2-360m-forge` in the background. If you attempt to ask the Coach a question while disconnected from your phone and Wi-Fi/LTE, the app automatically falls back to the native offline model.

> [!WARNING]
> You must manually ensure the `smollm2-360m-forge-q3ks.gguf` file is added to the "Copy Bundle Resources" build phase of the `ForgeCoach Watch App` target in Xcode for the fallback to function.

## 2. Multi-Modal Vision Fix
The equipment recognition feature in Prism Coach utilizes the Claude Vision API to dynamically identify gym equipment and suggest a workout tier.

**The Bug**: The `EquipmentRecognizer` (and `ForgeAIEngine` fallback) was sending `claude-sonnet-4-6` as the model identifier. This is not a valid Anthropic model ID, resulting in consistent API HTTP errors and broken recognition.

**The Fix**: We replaced the invalid string with `claude-3-5-sonnet-20241022` across the codebase, restoring full multi-modal vision capabilities to Prism Coach.

### 3. iOS Unified Native Bridge
- Ported the Inworld WebSocket client over to native Swift as `InworldSTTClient.swift`.
- Integrated `InworldSTTClient.swift` into `VoiceCommandEngine.swift` and `WalkieTalkieEngine.swift` for **PrismCoach**.
- Integrated `InworldSTTClient.swift` into `ContentView.swift` for **Prism AAC**.
- Integrated `InworldSTTClient.swift` into `SynaluxWebView.swift` for **Synalux iOS**. 
- SFSpeechRecognizer is retained across all platforms as the offline fallback mechanism.
- Ran tests on Synalux iOS, achieving 100% pass rate (142 tests).

### 4. Whisper WASM Offline Fallback (Tier 4)
- Added `@xenova/transformers` to the `@synalux/shared-ui` package.
- Implemented `startWhisperOffline` using `Xenova/whisper-tiny.en` within `useVoiceInput.ts`.
- Integrated Whisper offline fallback directly into the 4-tier chain, triggering smoothly when the server batch endpoint is unavailable.

## 5. Web UI Unification
To eliminate duplicate code and create a consistent experience across all Synalux browser interfaces, we built the `UnifiedAiChat` component inside `@synalux/shared-ui`.
- **Refactored POS Ai Chat**: `PosAiChat.tsx` now consumes `UnifiedAiChat` as a popup, injecting POS-specific theme variables (`tokens.colors.pos-accent`) and custom tool rendering (`renderMessageContent`).
- **Refactored POS Order Chat**: `AiOrderChat.tsx` uses the same unified component, ensuring the walkie-talkie mode works properly.
- **Refactored Portal Chat Page**: The full-page `/app/chat/page.tsx` was deeply refactored to use `UnifiedAiChat`. Since it is not a popup, it renders full-screen and leverages the flexible slot pattern (`renderCustomHeader`, `renderCustomStatus`, `renderExtraActions`) to retain its unique Model Selector, Conversation Mode toggles, and File Attachment features while sharing the same underlying messaging and voice components.
- **Deep Adversarial Audit**: Identified and fixed a critical memory leak in `useVoiceInput.ts` where the Whisper WASM inference session, Web Audio pipeline, and server transcription callbacks could cause state updates on unmounted components or leak memory. Added an `isMountedRef` and proper `whisperPipelineRef.current.dispose()` cleanup on unmount.
- **Unit and E2E Tests**: Ensured existing POS E2E tests (`ai-order-chat.test.tsx`) pass with the new layout, and authored a new comprehensive unit test suite specifically for `UnifiedAiChat.tsx` using Vitest and React Testing Library.

## 6. Apple Watch Streaming Fix
We implemented live token streaming for the AI responses on both the **Prism AAC** and **Prism Coach** Watch Apps. This brings the watch apps to parity with the phone AI chat's latency and responsiveness:
- **Prism AAC**: Added the `streamingTokenSink` to `WatchTTS` to chunk and synthesize text sentence-by-sentence as tokens arrive. 
- **Offline Engines**: Both apps' `WatchLLMEngine.swift` components were updated to accept and yield tokens via the `onToken` callback while decoding `llama.cpp` inference output incrementally.
- **Cloud Direct Routing**: We refactored `WatchAISession.swift` in both apps to switch from standard `data(for:)` REST queries to Server-Sent Events (SSE) via `URLSession.shared.bytes(for:)`. It now incrementally builds the response and pipes tokens to the UI and TTS.
- **UI Updates**: Modified `WatchAIChatView` (Prism AAC) and `WatchAICoachView` (Prism Coach) to automatically handle incremental text updates and pipe the incoming stream to the text-to-speech component.

## 7. Pushing Prism-AAC to the Apple Store
You mentioned that your last Apple Store build was 4 days ago. To push your new updates to TestFlight and the App Store, you can run your Fastlane pipeline or use Xcode:
1. Open the `.xcworkspace` (or `.xcodeproj` if no workspace) for `prism-aac`.
2. Select the **Any iOS Device (arm64)** run destination.
3. Increment the **Build Number** in the General settings of your main app target and watch target.
4. Go to **Product > Archive**.
5. Once the archive completes, the Organizer will open. Click **Distribute App** > **App Store Connect** > **Upload** and follow the prompts.

Alternatively, if you use fastlane, you can run your release lane (e.g., `fastlane ios beta` or `fastlane ios release`) from your `ios-native` directory.

## Next Steps
The streaming fix for the Apple Watch is fully implemented across both Prism AAC and Prism Coach! You can deploy to your devices or push to the Apple Store whenever you're ready.
