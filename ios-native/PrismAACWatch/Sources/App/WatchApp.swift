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
    // Router MUST be first — it sets WCSession.default.delegate before any other init
    @StateObject private var wcRouter  = WCSessionRouter.shared
    @StateObject private var session   = WatchAISession()
    @StateObject private var emergency = WatchEmergencyManager()
    @StateObject private var tts       = WatchTTS()
    @StateObject private var vocab     = WatchVocabSync()
    @StateObject private var inbox     = WatchInbox()
    @Environment(\.scenePhase) private var scenePhase

    var body: some Scene {
        WindowGroup {
            WatchRootView()
                .environmentObject(session)
                .environmentObject(emergency)
                .environmentObject(tts)
                .environmentObject(vocab)
                .environmentObject(inbox)
                .onChange(of: scenePhase) { _, newPhase in
                    if newPhase == .active && emergency.isActive {
                        NSLog("[WatchApp] Resumed active — emergency still in progress (isActive=\(emergency.isActive))")
                        // Emergency fullScreenCover is driven by emergency.isActive binding — re-evaluation forces it
                    }
                }
        }
    }
}
