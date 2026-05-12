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
    // Router MUST be first — it sets WCSession.default.delegate before any other init.
    // FIX #28: @ObservedObject (not @StateObject) because WCSessionRouter.shared is a pre-constructed
    // singleton. @StateObject with a pre-built value would wrap it in a redundant Box and break
    // SwiftUI's ownership semantics. The singleton manages its own lifetime.
    @ObservedObject private var wcRouter  = WCSessionRouter.shared
    @StateObject private var session      = WatchAISession()
    @StateObject private var emergency    = WatchEmergencyManager()
    @StateObject private var tts          = WatchTTS()
    @StateObject private var vocab        = WatchVocabSync()
    @StateObject private var inbox        = WatchInbox()
    // WatchTranslation lifted to app level (#37) so view re-creation doesn't orphan in-flight tasks
    @StateObject private var translation  = WatchTranslation()
    @Environment(\.scenePhase) private var scenePhase

    var body: some Scene {
        WindowGroup {
            WatchRootView()
                .environmentObject(session)
                .environmentObject(emergency)
                .environmentObject(tts)
                .environmentObject(vocab)
                .environmentObject(inbox)
                .environmentObject(translation)
                .onChange(of: scenePhase) { _, newPhase in
                    if newPhase == .active && emergency.isActive {
                        NSLog("[WatchApp] Resumed active — emergency still in progress (deliveryStatus=\(emergency.deliveryStatus))")
                        // Emergency manager handles TTS — do NOT call tts.speak() here as it ducks the emergency synthesizer
                    }
                }
        }
    }
}
