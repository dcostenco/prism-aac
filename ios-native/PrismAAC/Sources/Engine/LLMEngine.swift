import Foundation

/// On-device inference engine — STUB for simulator builds.
///
/// On-device 1.5B model via Metal (SwiftLlama/llama.cpp) is added via
/// Xcode File → Add Package Dependencies → https://github.com/ShenghaiWang/SwiftLlama
/// after the project is opened in Xcode. The cloud path in AACPipeline is
/// the active path until the model package is wired up.
///
/// Memory contract (when model is loaded):
///   Model weights  : ~864 MB  (Q4_K_M 1.5B)
///   KV cache @512  : ~50 MB
///   ggml overhead  : ~80 MB  → Total ~994 MB (needs 4 GB device)
@MainActor
final class LLMEngine: ObservableObject {

    @Published private(set) var isLoaded  = false
    @Published private(set) var isGenerating = false
    @Published private(set) var memoryWarning = false

    static let MAX_NEW_TOKENS = 256
    static let MIN_FREE_MB    = 1_200

    func load(from url: URL) async throws {
        // Stub: model loading requires SwiftLlama package.
        // Add via Xcode → File → Add Package Dependencies.
        throw LLMError.notLoaded
    }

    func unload() {
        isLoaded = false
    }

    func generate(prompt: String, onToken: @escaping (String) -> Void) async throws -> String {
        throw LLMError.notLoaded
    }
}

enum LLMError: LocalizedError {
    case insufficientMemory(freeMB: Int, requiredMB: Int)
    case notLoaded
    case alreadyGenerating

    var errorDescription: String? {
        switch self {
        case .insufficientMemory(let f, let r):
            return "Not enough memory: \(f) MB free, need \(r) MB."
        case .notLoaded:         return "AI model not loaded — using cloud AI."
        case .alreadyGenerating: return "Already generating."
        }
    }
}
