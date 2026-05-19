import SwiftUI
import CryptoKit

@main
struct PrismAACApp: App {
    @StateObject private var appState = AppState()

    init() {
        WatchEmergencyBridge.shared.activateSession()
    }

    /// Model candidates in priority order for each device tier.
    /// The loader tries each in order — if a model OOMs or isn't cached,
    /// it falls through to the next. This lets 8GB devices ATTEMPT the
    /// 8B (100.0% BFCL v36) and gracefully fall back to 1.7B (100.0% BFCL v42) if it
    /// doesn't fit. Accuracy from HuggingFace model cards (dcostenco/prism-coder-*).
    private static let modelCandidates: [(file: String, cdn: String, minFreeMB: Int, sha256: String)] = {
        switch LLMEngine.preferredTier {
        case .large14B:
            return [
                ("qwen3-14b-v42-q4km",        "dcostenco/prism-coder-14b/resolve/main/qwen3-14b-v42-q4km.gguf",        10_000, "fec7551b2932b155b2f79e1c18238cff0e074e9bab2ce5ad3dc9f895389f48b3"),
                ("prism-coder-1b7-v42-q4km",  "dcostenco/prism-coder-1.7b/resolve/main/prism-coder-1b7-v42-q4km.gguf", 1_200,  "1d09e386b0538f93b43d98dfef6e62d205bfec54e76f528e412451aabc7e33c7"),
            ]
        case .medium8B:
            return [
                ("qwen3-8b-v36-q4km",         "dcostenco/prism-coder-8b/resolve/main/qwen3-8b-v36-q4km.gguf",          4_500,  "7aa542dd4a9c9c772835b10ac66645038d76ad02a11bf137739937ec8e41dab2"),
                ("prism-coder-1b7-v42-q4km",  "dcostenco/prism-coder-1.7b/resolve/main/prism-coder-1b7-v42-q4km.gguf", 1_200,  "1d09e386b0538f93b43d98dfef6e62d205bfec54e76f528e412451aabc7e33c7"),
            ]
        case .small1B7:
            return [
                // Bundled Q8 (already on device — zero download, loads first)
                ("prism-aac-1b7-q8",          "",                                                                         1_800,  "fb01043af7d3484d778732ceadb97dd31b14b3232145eb8f8b6a0648487c1e87"),
                ("prism-coder-1b7-v42-q4km",  "dcostenco/prism-coder-1.7b/resolve/main/prism-coder-1b7-v42-q4km.gguf", 1_200,  "1d09e386b0538f93b43d98dfef6e62d205bfec54e76f528e412451aabc7e33c7"),
            ]
        }
    }()

    /// URLSession for GGUF downloads — 1 h resource timeout guards against
    /// stalled transfers on slow connections.
    private static let downloadSession: URLSession = {
        let config = URLSessionConfiguration.default
        config.timeoutIntervalForResource = 3_600
        return URLSession(configuration: config)
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

    private func tryLoadModel(_ candidate: (file: String, cdn: String, minFreeMB: Int, sha256: String)) async -> Bool {
        let (file, cdn, minFreeMB, expectedSHA) = candidate
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
                return false
            }
        }

        // 3. Download if enough memory
        guard AppState.measureFreeMemoryMB() >= minFreeMB else {
            NSLog("[PrismAAC] Not enough free memory for \(file) (need \(minFreeMB) MB)")
            return false
        }
        guard let cdnURL = URL(string: "https://huggingface.co/\(cdn)") else {
            NSLog("[PrismAAC] Invalid CDN URL for \(file)")
            return false
        }
        do {
            try FileManager.default.createDirectory(at: url.deletingLastPathComponent(), withIntermediateDirectories: true)
            let (tempURL, response) = try await Self.downloadSession.download(from: cdnURL)
            guard let http = response as? HTTPURLResponse, (200...299).contains(http.statusCode) else {
                try? FileManager.default.removeItem(at: tempURL)
                NSLog("[PrismAAC] \(file) download returned non-2xx")
                return false
            }
            let digest = try sha256Hex(of: tempURL)
            guard digest == expectedSHA else {
                try? FileManager.default.removeItem(at: tempURL)
                NSLog("[PrismAAC] \(file) SHA-256 mismatch — expected \(expectedSHA), got \(digest)")
                return false
            }
            try FileManager.default.moveItem(at: tempURL, to: url)
            try await appState.loadModelSafe(from: url)
            NSLog("[PrismAAC] Downloaded and loaded \(file)")
            return true
        } catch {
            NSLog("[PrismAAC] \(file) download/load failed: \(error.localizedDescription)")
        }
        return false
    }

    /// Streams the file in 1 MB chunks to avoid loading the full GGUF into RAM.
    private func sha256Hex(of fileURL: URL) throws -> String {
        guard let handle = FileHandle(forReadingAtPath: fileURL.path) else {
            throw CocoaError(.fileReadNoSuchFile)
        }
        defer { handle.closeFile() }
        var hasher = SHA256()
        let chunkSize = 1024 * 1024
        while true {
            let chunk = handle.readData(ofLength: chunkSize)
            if chunk.isEmpty { break }
            hasher.update(data: chunk)
        }
        let digest = hasher.finalize()
        return digest.map { String(format: "%02x", $0) }.joined()
    }
}
