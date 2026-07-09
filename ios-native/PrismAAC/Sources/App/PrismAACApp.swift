import SwiftUI
import CryptoKit
import AVFoundation

@main
struct PrismAACApp: App {
    @StateObject private var appState = AppState()

    init() {
        // Initialize Datadog SDK early
        if !ProcessInfo.processInfo.arguments.contains("-UITEST_MODE") {
            DatadogLogger.shared.initialize()
        }
        WatchEmergencyBridge.shared.activateSession()
        
        // Ensure TTS plays even if the hardware silent switch is ON
        try? AVAudioSession.sharedInstance().setCategory(.playback, options: [.mixWithOthers])
        try? AVAudioSession.sharedInstance().setActive(true)
    }

    /// Model candidates in priority order for each device tier.
    /// The loader tries each in order — if a model OOMs or isn't cached,
    /// it falls through to the next. This lets 8 GB devices attempt the
    /// 4B Q4_K_M (100% routing) and fall back to 4B Q3_K_M (99.1% routing).
    /// Accuracy: BFCL 115 cases × 3 seeds, June 2026.
    private static let modelCandidates: [(file: String, cdn: String, minFreeMB: Int, sha256: String)] = {
        switch LLMEngine.preferredTier {
        case .large14B:
            return [
                ("qwen3-14b-v42-q4km",       "dcostenco/prism-coder-14b/resolve/main/qwen3-14b-v42-q4km.gguf",          10_000, "fec7551b2932b155b2f79e1c18238cff0e074e9bab2ce5ad3dc9f895389f48b3"),
                ("Qwen3.5-4B-Q3_K_M",        "dcostenco/prism-coder-4b/resolve/main/Qwen3.5-4B-Q3_K_M.gguf",            2_400,  "d6981ab4d77ba712b48ef69d69042d75b5e39b9dce5fb5a5b054fd08e06afb95"),
            ]
        case .medium4B:
            return [
                // 4B Q4_K_M — 100% BFCL, fits in 8 GB RAM
                ("Qwen3.5-4B-Q4_K_M",        "dcostenco/prism-coder-4b/resolve/main/Qwen3.5-4B-Q4_K_M.gguf",            2_800,  "81fb60c7daa80fc1123380b98970b320ae233409f0f71a72ed7b9b0d62f40490"),
                // 4B Q3_K_M — 99.1% BFCL, fits in 6 GB RAM (iPhone first gate)
                ("Qwen3.5-4B-Q3_K_M",        "dcostenco/prism-coder-4b/resolve/main/Qwen3.5-4B-Q3_K_M.gguf",            2_400,  "d6981ab4d77ba712b48ef69d69042d75b5e39b9dce5fb5a5b054fd08e06afb95"),
            ]
        case .small1B7:
            return [
                // 4B Q3_K_M — 99.1% BFCL at 2.3 GB, replaces old 1.7B SFT (90.4%)
                ("Qwen3.5-4B-Q3_K_M",        "dcostenco/prism-coder-4b/resolve/main/Qwen3.5-4B-Q3_K_M.gguf",            2_400,  "d6981ab4d77ba712b48ef69d69042d75b5e39b9dce5fb5a5b054fd08e06afb95"),
            ]
        }
    }()

    /// URLSession for GGUF downloads — 1 h resource timeout guards against
    /// stalled transfers on slow connections.
    private static let downloadSession: URLSession = {
        let config = URLSessionConfiguration.default
        config.timeoutIntervalForResource = 3_600
        config.allowsExpensiveNetworkAccess = false
        config.allowsConstrainedNetworkAccess = false
        return URLSession(configuration: config)
    }()

    @UIApplicationDelegateAdaptor(AppDelegate.self) private var appDelegate
    @AppStorage("onboarding_complete") private var onboardingComplete = false
    @AppStorage("ai_consent_accepted") private var aiConsentAccepted = false

    var body: some Scene {
        WindowGroup {
            Group {
                if !onboardingComplete {
                    OnboardingView(isComplete: $onboardingComplete)
                } else if !aiConsentAccepted {
                    AIConsentView(isAccepted: $aiConsentAccepted)
                } else {
                    mainAppView
                }
            }
            .onOpenURL { url in
                PhraseSpeaker.shared.speak(fromDeepLink: url)
            }
        }
    }

    private var mainAppView: some View {
        ContentView()
            .environmentObject(appState)
            .task {
                guard !UserDefaults.standard.bool(forKey: "ai_declined") else {
                    NSLog("[PrismAAC] AI declined — skipping model load/download")
                    return
                }
                #if targetEnvironment(simulator)
                NSLog("[PrismAAC] Simulator — skipping on-device model load (cloud AI only)")
                return
                #endif
                let tier = LLMEngine.preferredTier
                NSLog("[PrismAAC] Device RAM: \(LLMEngine.totalDeviceMemoryGB) GB → tier: \(tier.rawValue)")

                for candidate in Self.modelCandidates {
                    if await tryLoadModel(candidate) { return }
                }
                NSLog("[PrismAAC] No model could be loaded — using cloud AI only")
            }
            .task {
                await SafetyFilter.loadRemoteKeywords()
            }
    }

    private func tryLoadModel(_ candidate: (file: String, cdn: String, minFreeMB: Int, sha256: String)) async -> Bool {
        let (file, cdn, minFreeMB, expectedSHA) = candidate
        NSLog("[PrismAAC] Trying \(file)...")

        // 1. Check bundle
        if let bundleURL = Bundle.main.url(forResource: file, withExtension: "gguf") {
            guard AppState.measureFreeMemoryMB() >= minFreeMB else {
                NSLog("[PrismAAC] Not enough free memory for bundled \(file) (need \(minFreeMB) MB)")
                return false
            }
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
        guard !cdn.isEmpty else {
            NSLog("[PrismAAC] \(file) not in bundle and has no CDN URL — skipping")
            return false
        }
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
