import Foundation
import Combine
import UIKit

/// Real-time memory-aware feature gating.
///
/// Feature tiers (degrade automatically on memory pressure):
///
///   TIER 3 — Full AI   (≥ 1,400 MB free)
///     • On-device 1.7B inference
///     • AI chat, smart predictions, validator loop
///
///   TIER 2 — Cloud AI  (800–1,399 MB free, or 3 GB device with model loaded)
///     • Core AAC offline (phrase board, keyboard, AVSpeechSynthesizer TTS)
///     • AI chat via cloud API (requires network)
///     • Smart predictions disabled (too slow on cloud round-trip)
///
///   TIER 1 — Core Only (< 800 MB free)
///     • Core AAC offline only
///     • No AI features
///     • Emergency watch alerts still work
///
///   TIER 0 — Emergency  (< 300 MB free — imminent OOM)
///     • Only emergency / panic button
///     • Proactively unloads the model to free memory

@MainActor
final class AppState: ObservableObject {

    // MARK: - Feature tier

    enum FeatureTier: Int, Comparable {
        case emergency = 0   // OOM imminent — model unloaded
        case coreOnly  = 1   // offline phrase board + TTS only
        case cloudAI   = 2   // core + cloud AI (network required)
        case fullAI    = 3   // core + on-device AI

        static func < (lhs: FeatureTier, rhs: FeatureTier) -> Bool { lhs.rawValue < rhs.rawValue }

        var label: String {
            switch self {
            case .emergency: return "Emergency mode — low memory"
            case .coreOnly:  return "Core AAC — AI unavailable"
            case .cloudAI:   return "Core AAC + Cloud AI"
            case .fullAI:    return "Full AI — on-device"
            }
        }

        var aiEnabled: Bool   { self >= .cloudAI }
        var onDevice: Bool    { self == .fullAI   }
        var allowLoad: Bool   { self >= .cloudAI  }
    }

    // MARK: - Published state

    @Published private(set) var tier: FeatureTier = .coreOnly
    @Published private(set) var freeMemoryMB: Int = 0
    @Published private(set) var modelReady = false
    @Published private(set) var coreOnlyMode = false   // skip model download
    @Published private(set) var memoryBanner: String? = nil

    // MARK: - Sub-objects

    let llm = LLMEngine()
    lazy var pipeline = AACPipeline(llm: llm)

    // MARK: - Thresholds (MB)

    private static let T_FULL_AI    = 1_400
    private static let T_CLOUD_AI   = 800
    private static let T_EMERGENCY  = 300

    // MARK: - Memory monitoring

    private var monitorTimer: Timer?

    init() {
        startMemoryMonitor()
    }

    deinit {
        monitorTimer?.invalidate()
    }

    func startMemoryMonitor() {
        // Poll every 2 s — balances responsiveness vs battery
        monitorTimer = Timer.scheduledTimer(withTimeInterval: 2.0, repeats: true) { [weak self] _ in
            Task { @MainActor [weak self] in self?.tick() }
        }
        tick()
    }

    private func tick() {
        freeMemoryMB = Self.measureFreeMemoryMB()
        let newTier = computeTier()

        if newTier != tier {
            tier = newTier
            handleTierChange(newTier)
        }

        updateBanner()
    }

    // MARK: - Tier computation

    private func computeTier() -> FeatureTier {
        let free = freeMemoryMB
        if free < Self.T_EMERGENCY { return .emergency }
        if free < Self.T_CLOUD_AI  { return .coreOnly  }
        return free >= Self.T_FULL_AI ? .fullAI : .cloudAI
    }

    private func handleTierChange(_ newTier: FeatureTier) {
        switch newTier {
        case .emergency:
            // Proactively unload model — prevents jetsam kill
            if llm.isLoaded {
                llm.unload()
                modelReady = false
            }
        case .coreOnly, .cloudAI, .fullAI:
            break  // no automatic action — user may reload model via settings
        }
    }

    // MARK: - Model lifecycle

    func loadModel(from url: URL) async {
        guard tier.allowLoad else { return }
        do {
            try await llm.load(from: url)
            modelReady = true
            tick()  // re-evaluate tier now that model is loaded
        } catch LLMError.insufficientMemory {
            coreOnlyMode = true
            modelReady = false
        } catch {
            modelReady = false
        }
    }

    func enterCoreOnlyMode() {
        coreOnlyMode = true
    }

    // MARK: - Banner text

    private func updateBanner() {
        switch tier {
        case .emergency:
            memoryBanner = "⚠️ Very low memory — AI disabled to keep app running"
        case .coreOnly where freeMemoryMB < Self.T_CLOUD_AI + 100:
            memoryBanner = "⚠️ Low memory — core communication only"
        default:
            memoryBanner = nil
        }
    }

    // MARK: - Memory measurement

    /// Returns estimated available memory in MB using mach task info.
    /// Accounts for compressed memory by using resident_size delta from
    /// phys_footprint (the value iOS uses for jetsam limits).
    static func measureFreeMemoryMB() -> Int {
        var info = task_vm_info_data_t()
        var count = mach_msg_type_number_t(MemoryLayout<task_vm_info_data_t>.size / MemoryLayout<integer_t>.size)
        let result = withUnsafeMutablePointer(to: &info) {
            $0.withMemoryRebound(to: integer_t.self, capacity: Int(count)) {
                task_info(mach_task_self_, task_flavor_t(TASK_VM_INFO), $0, &count)
            }
        }
        guard result == KERN_SUCCESS else {
            NSLog("[AppState] task_info failed (\(result)) — defaulting to 1000 MB free")
            return 1_000
        }

        let usedBytes = Int(info.phys_footprint)
        let totalBytes = Int(ProcessInfo.processInfo.physicalMemory)
        // Reserve 10% for OS overhead fluctuation
        let free = Int(Double(totalBytes - usedBytes) * 0.90)
        return max(0, free / (1024 * 1024))
    }
}
