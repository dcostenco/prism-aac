import SwiftUI

/// PrismAAC standalone watchOS app.
///
/// Works without iPhone — WiFi/LTE for AI, BT for faster on-device path.
/// Connectivity priority:
///   1. WatchConnectivity → iPhone 1.5B (< 500ms, Bluetooth)
///   2. Watch URLSession → synalux.ai cloud API (WiFi/LTE)
///   3. Offline: core phrase pictograms + Layer 1 safety + TTS
@main
struct PrismAACWatchApp: App {
    @StateObject private var session   = WatchAISession()
    @StateObject private var emergency = WatchEmergencyManager()
    @StateObject private var tts       = WatchTTS()
    @StateObject private var vocab     = WatchVocabSync()  // syncs from web app

    var body: some Scene {
        WindowGroup {
            WatchRootView()
                .environmentObject(session)
                .environmentObject(emergency)
                .environmentObject(tts)
                .environmentObject(vocab)
        }
    }
}
