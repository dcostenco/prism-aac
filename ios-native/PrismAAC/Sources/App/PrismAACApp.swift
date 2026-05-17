import SwiftUI

@main
struct PrismAACApp: App {
    @StateObject private var appState = AppState()

    init() {
        WatchEmergencyBridge.shared.activateSession()
    }

    /// Model candidates in priority order for each device tier.
    /// The loader tries each in order — if a model OOMs or isn't cached,
    /// it falls through to the next. This lets 8GB devices ATTEMPT the
    /// 8B (98.0% BFCL) and gracefully fall back to 1.7B (96.1% BFCL) if it
    /// doesn't fit. Accuracy from HuggingFace model cards (dcostenco/prism-coder-*).
    private static let modelCandidates: [(file: String, cdn: String, minFreeMB: Int)] = {
        switch LLMEngine.preferredTier {
        case .large14B:
            return [
                ("prism-aac-14b-q4km",  "dcostenco/prism-coder-14b/resolve/main/prism-aac-14b-q4km.gguf",  10_000),
                ("prism-aac-1b7-q4km",  "dcostenco/prism-coder-1.7b/resolve/main/prism-aac-1b7-q4km.gguf", 1_200),
            ]
        case .medium8B:
            return [
                ("prism-aac-8b-q4km",   "dcostenco/prism-coder-8b/resolve/main/prism-aac-8b-q4km.gguf",    4_500),
                ("prism-aac-1b7-q4km",  "dcostenco/prism-coder-1.7b/resolve/main/prism-aac-1b7-q4km.gguf", 1_200),
            ]
        case .small1B7:
            return [
                ("prism-aac-1b7-q4km",  "dcostenco/prism-coder-1.7b/resolve/main/prism-aac-1b7-q4km.gguf", 1_200),
            ]
        }
    }()

    var body: some Scene {
        WindowGroup {
            ContentView()
                .environmentObject(appState)
                .task {
                    let tier = LLMEngine.preferredTier
                    NSLog("[PrismAAC] Device RAM: \(LLMEngine.totalDeviceMemoryGB) GB → tier: \(tier.rawValue)")

                    for candidate in Self.modelCandidates {
                        if await tryLoadModel(candidate) { return }
                    }
                    NSLog("[PrismAAC] No model could be loaded — using cloud AI only")
                }
        }
    }

    private func tryLoadModel(_ candidate: (file: String, cdn: String, minFreeMB: Int)) async -> Bool {
        let (file, cdn, minFreeMB) = candidate
        NSLog("[PrismAAC] Trying \(file)...")

        // 1. Check bundle
        if let bundleURL = Bundle.main.url(forResource: file, withExtension: "gguf") {
            do {
                try await appState.loadModelSafe(from: bundleURL)
                NSLog("[PrismAAC] Loaded \(file) from bundle")
                return true
            } catch {
                NSLog("[PrismAAC] \(file) bundle load failed: \(error.localizedDescription)")
                return false
            }
        }

        // 2. Check cached download
        let url = FileManager.default
            .urls(for: .documentDirectory, in: .userDomainMask)[0]
            .appendingPathComponent("models/\(file).gguf")
        if FileManager.default.fileExists(atPath: url.path) {
            do {
                try await appState.loadModelSafe(from: url)
                NSLog("[PrismAAC] Loaded \(file) from cache")
                return true
            } catch {
                NSLog("[PrismAAC] \(file) cache load failed (OOM?): \(error.localizedDescription)")
                // OOM — try next candidate
                return false
            }
        }

        // 3. Download if enough memory
        guard AppState.measureFreeMemoryMB() >= minFreeMB else {
            NSLog("[PrismAAC] Not enough free memory for \(file) (need \(minFreeMB) MB)")
            return false
        }
        do {
            let cdnURL = URL(string: "https://huggingface.co/\(cdn)")!
            try FileManager.default.createDirectory(at: url.deletingLastPathComponent(), withIntermediateDirectories: true)
            let (tempURL, response) = try await URLSession.shared.download(from: cdnURL)
            if let http = response as? HTTPURLResponse, (200...299).contains(http.statusCode) {
                try FileManager.default.moveItem(at: tempURL, to: url)
                try await appState.loadModelSafe(from: url)
                NSLog("[PrismAAC] Downloaded and loaded \(file)")
                return true
            }
        } catch {
            NSLog("[PrismAAC] \(file) download/load failed: \(error.localizedDescription)")
        }
        return false
    }
}
