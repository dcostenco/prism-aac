import SwiftUI
import WatchKit

/// PrismAAC standalone watchOS app.
///
/// Works without iPhone — uses Watch WiFi/LTE for AI.
/// Uses WatchConnectivity when iPhone in Bluetooth range (faster, on-device 1.5B).
///
/// Connectivity priority:
///   1. WatchConnectivity → iPhone 1.5B (< 500ms, Bluetooth)
///   2. Watch URLSession → synalux.ai cloud API (WiFi/LTE, any distance)
///   3. Offline: core phrases + Layer 1 safety filter only
@main
struct PrismAACWatchApp: App {
    @StateObject private var session = WatchAISession()
    @StateObject private var emergency = WatchEmergencyManager()
    @StateObject private var tts = WatchTTS()

    var body: some Scene {
        WindowGroup {
            WatchRootView()
                .environmentObject(session)
                .environmentObject(emergency)
                .environmentObject(tts)
        }

        // Complication — launches directly to AI chat or phrase board
        WKNotificationScene(controller: WKUserNotificationHostingController<WatchNotificationView>.self, category: "prism-aac-alert")
    }
}
