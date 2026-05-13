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
                    // Try bundle first, then background download
                    if let bundleURL = Bundle.main.url(forResource: "prism-aac-1b7-q8", withExtension: "gguf") {
                        await appState.loadModel(from: bundleURL)
                        return
                    }
                    // Background download — never blocks UI
                    let url = FileManager.default
                        .urls(for: .documentDirectory, in: .userDomainMask)[0]
                        .appendingPathComponent("models/prism-aac-1b7-q8.gguf")
                    if FileManager.default.fileExists(atPath: url.path) {
                        await appState.loadModel(from: url)
                        return
                    }
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
                        NSLog("[PrismAAC] Background model download failed: \(error.localizedDescription)")
                    }
                }
        }
    }
}
