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
                    // Background model download — never blocks UI.
                    // Cloud AI is always available as fallback.
                    let url = FileManager.default
                        .urls(for: .documentDirectory, in: .userDomainMask)[0]
                        .appendingPathComponent("models/prism-aac-1b7-q4km.gguf")
                    if !FileManager.default.fileExists(atPath: url.path) {
                        // Only attempt if enough memory and model not yet downloaded
                        guard AppState.measureFreeMemoryMB() >= 1_200 else { return }
                        do {
                            let cdnURL = URL(string: "https://huggingface.co/dcostenco/prism-coder-1.7b/resolve/main/prism-aac-1b7-q4km.gguf")!
                            try FileManager.default.createDirectory(at: url.deletingLastPathComponent(), withIntermediateDirectories: true)
                            let (tempURL, response) = try await URLSession.shared.download(from: cdnURL)
                            if let http = response as? HTTPURLResponse, (200...299).contains(http.statusCode) {
                                try FileManager.default.moveItem(at: tempURL, to: url)
                                await appState.loadModel(from: url)
                            }
                        } catch {
                            // Silent failure — cloud AI handles everything
                            NSLog("[PrismAAC] Background model download failed: \(error.localizedDescription)")
                        }
                    } else {
                        await appState.loadModel(from: url)
                    }
                }
        }
    }
}
