import SwiftUI

@main
struct PrismAACApp: App {
    @StateObject private var appState = AppState()

    init() {
        // FIX H1: Activate WCSession at app launch so emergency dispatch works
        WatchEmergencyBridge.shared.activateSession()
    }

    var body: some Scene {
        WindowGroup {
            ContentView()
                .environmentObject(appState)
                .task {
                    // Load embedded model from app bundle (v24-l3, Q8, 1.7GB).
                    // No download needed — works offline from first launch.
                    guard let url = Bundle.main.url(forResource: "prism-aac-1b7-q8", withExtension: "gguf") else {
                        NSLog("[PrismAAC] Model not found in bundle — cloud AI only")
                        return
                    }
                    await appState.loadModel(from: url)
                }
        }
    }
}
