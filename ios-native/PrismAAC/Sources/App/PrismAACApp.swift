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
                    // Select model tier by device RAM:
                    //   16 GB+ (iPad Pro M1/M2/M4): 14B Q4_K_M (98% accuracy)
                    //   4-15 GB (iPhone, iPad Air):  1.7B Q4_K_M (88% accuracy)
                    let use14B = LLMEngine.canLoad14B
                    let modelFile = use14B ? "prism-aac-14b-q4km" : "prism-aac-1b7-q8"
                    let cdnPath = use14B
                        ? "dcostenco/prism-coder-14b/resolve/main/prism-aac-14b-q4km.gguf"
                        : "dcostenco/prism-coder-1.7b/resolve/main/prism-aac-1b7-q4km.gguf"
                    let minFreeMB = use14B ? 10_000 : 1_200

                    NSLog("[PrismAAC] Device RAM: \(LLMEngine.totalDeviceMemoryGB) GB → loading \(use14B ? "14B" : "1.7B")")

                    // Try bundle first
                    if let bundleURL = Bundle.main.url(forResource: modelFile, withExtension: "gguf") {
                        await appState.loadModel(from: bundleURL)
                        return
                    }
                    // Check cached download
                    let url = FileManager.default
                        .urls(for: .documentDirectory, in: .userDomainMask)[0]
                        .appendingPathComponent("models/\(modelFile).gguf")
                    if FileManager.default.fileExists(atPath: url.path) {
                        await appState.loadModel(from: url)
                        return
                    }
                    // Background download — never blocks UI
                    guard AppState.measureFreeMemoryMB() >= minFreeMB else {
                        // Not enough free memory for target model — try 1.7B fallback
                        if use14B {
                            NSLog("[PrismAAC] Not enough memory for 14B, falling back to 1.7B")
                            let fallbackURL = FileManager.default
                                .urls(for: .documentDirectory, in: .userDomainMask)[0]
                                .appendingPathComponent("models/prism-aac-1b7-q4km.gguf")
                            if FileManager.default.fileExists(atPath: fallbackURL.path) {
                                await appState.loadModel(from: fallbackURL)
                            }
                        }
                        return
                    }
                    do {
                        let cdnURL = URL(string: "https://huggingface.co/\(cdnPath)")!
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
