import Foundation
import llama

/// On-device inference engine wrapping llama.cpp Metal backend.
///
/// Memory contract (1.5B Q4_K_M):
///   Model weights  : ~864 MB (loaded once, pinned)
///   KV cache @512  : ~50 MB  (per session)
///   Overhead       : ~50 MB
///   ─────────────────────────
///   Total          : ~964 MB  (fits iPhone 11 / 4 GB)
///
/// Hard limits enforced here:
///   MAX_CTX = 512 tokens  — beyond this KV cache grows 4× per doubling
///   MAX_NEW = 256 tokens  — AAC responses are short; cap prevents runaway
///   METAL   = required    — CPU-only fallback is too slow (~3 tok/s vs 50)
@MainActor
final class LLMEngine: ObservableObject {

    // MARK: - Public state
    @Published private(set) var isLoaded = false
    @Published private(set) var isGenerating = false
    @Published private(set) var memoryWarning = false

    // MARK: - Constants
    static let MAX_CTX: Int32 = 512
    static let MAX_NEW: Int32 = 256
    static let MIN_FREE_MB: Int = 1_200  // bail if less than 1.2 GB free

    // MARK: - llama.cpp handles
    private var model: OpaquePointer?
    private var ctx: OpaquePointer?
    private var batch: llama_batch?

    // MARK: - Lifecycle

    /// Load the GGUF model from the app bundle or the model cache directory.
    /// Call once on first user interaction (preserves gesture token for audio).
    func load(from url: URL) async throws {
        guard !isLoaded else { return }

        // Memory pre-check — abort before llama.cpp allocates and OOMs.
        let freeMB = availableMemoryMB()
        guard freeMB >= Self.MIN_FREE_MB else {
            throw LLMError.insufficientMemory(freeMB: freeMB, requiredMB: Self.MIN_FREE_MB)
        }

        let modelParams = llama_model_default_params()
        // Metal GPU layers: -1 = offload all layers to Metal automatically.
        // On A13+ this uses the GPU shader cores for matrix multiply,
        // achieving ~50 tok/s vs ~3 tok/s on CPU threads.
        var mutableParams = modelParams
        mutableParams.n_gpu_layers = -1

        guard let m = llama_load_model_from_file(url.path, mutableParams) else {
            throw LLMError.modelLoadFailed(path: url.path)
        }
        model = m

        var ctxParams = llama_context_default_params()
        ctxParams.n_ctx = UInt32(Self.MAX_CTX)
        ctxParams.n_batch = 512
        ctxParams.flash_attn = true  // reduces KV cache memory ~20%

        guard let c = llama_new_context_with_model(m, ctxParams) else {
            llama_free_model(m)
            throw LLMError.contextInitFailed
        }
        ctx = c
        batch = llama_batch_init(512, 0, 1)
        isLoaded = true
    }

    func unload() {
        if let b = batch { llama_batch_free(b) }
        if let c = ctx   { llama_free(c) }
        if let m = model { llama_free_model(m) }
        batch = nil; ctx = nil; model = nil
        isLoaded = false
    }

    // MARK: - Inference

    /// Generate a response token-by-token, streaming via `onToken` callback.
    /// Returns the full text. Cancellable via `Task` cancellation.
    func generate(
        prompt: String,
        onToken: @escaping (String) -> Void
    ) async throws -> String {
        guard let model, let ctx, var batch else { throw LLMError.notLoaded }
        guard !isGenerating else { throw LLMError.alreadyGenerating }
        isGenerating = true
        defer { isGenerating = false }

        // Tokenise
        let tokens = tokenise(text: prompt, model: model, addBos: true)
        guard !tokens.isEmpty else { return "" }
        let inputCount = min(Int(Self.MAX_CTX) - Int(Self.MAX_NEW), tokens.count)

        // Evaluate prompt
        llama_batch_clear(&batch)
        for (i, tok) in tokens.prefix(inputCount).enumerated() {
            llama_batch_add(&batch, tok, Int32(i), [0], false)
        }
        batch.logits[Int(batch.n_tokens) - 1] = 1
        guard llama_decode(ctx, batch) == 0 else { throw LLMError.decodeFailed }

        // Generate
        var result = ""
        var nCur = batch.n_tokens
        let samplerParams = llama_sampler_chain_default_params()
        let sampler = llama_sampler_chain_init(samplerParams)
        llama_sampler_chain_add(sampler, llama_sampler_init_min_p(0.05, 1))
        llama_sampler_chain_add(sampler, llama_sampler_init_temp(0.7))
        llama_sampler_chain_add(sampler, llama_sampler_init_dist(UInt32.random(in: 0..<UInt32.max)))
        defer { llama_sampler_free(sampler) }

        while nCur < Self.MAX_CTX {
            try Task.checkCancellation()

            let newToken = llama_sampler_sample(sampler, ctx, nCur - 1)
            if llama_token_is_eog(model, newToken) { break }

            // Decode token → string
            var buf = [CChar](repeating: 0, count: 32)
            let nChars = llama_token_to_piece(model, newToken, &buf, 32, 0, false)
            if nChars > 0 {
                let piece = String(bytes: buf.prefix(Int(nChars)).map { UInt8(bitPattern: $0) }, encoding: .utf8) ?? ""
                result += piece
                onToken(piece)
            }

            // Continue
            llama_batch_clear(&batch)
            llama_batch_add(&batch, newToken, nCur, [0], true)
            guard llama_decode(ctx, batch) == 0 else { break }
            nCur += 1

            // Memory pressure check mid-generation
            if nCur % 32 == 0, availableMemoryMB() < 400 {
                memoryWarning = true
                break
            }
        }
        llama_kv_cache_clear(ctx)
        return result
    }

    // MARK: - Helpers

    private func tokenise(text: String, model: OpaquePointer, addBos: Bool) -> [llama_token] {
        let utf8 = text.utf8
        let maxTokens = utf8.count + (addBos ? 1 : 0) + 2
        var tokens = [llama_token](repeating: 0, count: maxTokens)
        let n = llama_tokenize(model, text, Int32(utf8.count), &tokens, Int32(maxTokens), addBos, false)
        return n > 0 ? Array(tokens.prefix(Int(n))) : []
    }

    private func availableMemoryMB() -> Int {
        var info = mach_task_basic_info()
        var count = mach_msg_type_number_t(MemoryLayout<mach_task_basic_info>.size) / 4
        let result = withUnsafeMutablePointer(to: &info) {
            $0.withMemoryRebound(to: integer_t.self, capacity: Int(count)) {
                task_info(mach_task_self_, task_flavor_t(MACH_TASK_BASIC_INFO), $0, &count)
            }
        }
        guard result == KERN_SUCCESS else { return 2_000 }
        let usedBytes = Int(info.resident_size)
        let totalBytes = Int(ProcessInfo.processInfo.physicalMemory)
        return (totalBytes - usedBytes) / (1024 * 1024)
    }
}

// MARK: - Errors

enum LLMError: LocalizedError {
    case insufficientMemory(freeMB: Int, requiredMB: Int)
    case modelLoadFailed(path: String)
    case contextInitFailed
    case notLoaded
    case alreadyGenerating
    case decodeFailed

    var errorDescription: String? {
        switch self {
        case .insufficientMemory(let free, let req):
            return "Not enough memory: \(free) MB free, need \(req) MB. Close other apps and try again."
        case .modelLoadFailed(let path):
            return "Could not load model from \(path)."
        case .contextInitFailed:
            return "Could not initialise inference context."
        case .notLoaded:
            return "Model not loaded."
        case .alreadyGenerating:
            return "Already generating."
        case .decodeFailed:
            return "Inference failed."
        }
    }
}
