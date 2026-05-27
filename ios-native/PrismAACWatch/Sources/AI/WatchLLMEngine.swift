import Foundation
#if canImport(llama)
import llama
#endif

/// On-device AAC inference for Apple Watch S9+.
///
/// Model: SmolLM2-360M-AAC Q3_K_S (~170 MB) — CPU inference only (watchOS has no Metal access).
/// Target: Watch Series 9, S9 chip, dual-core, ~1 GB RAM, ~250 MB app budget.
///
/// Memory contract (Q3_K_S 360M):
///   ~155 MB weights + ~12 MB KV (n_ctx=512) + ~10 MB overhead = ~177 MB total
///   Available budget: ~250 MB. Margin: ~73 MB. Safe.
///
/// Chat template: SmolLM2 ChatML
///   <|im_start|>system\n{system}<|im_end|>\n
///   <|im_start|>user\n{user}<|im_end|>\n
///   <|im_start|>assistant\n
@MainActor
final class WatchLLMEngine: ObservableObject {

    @Published private(set) var isLoaded = false
    @Published private(set) var isGenerating = false

    static let MAX_NEW_TOKENS: Int = 60
    static let CONTEXT_SIZE: UInt32 = 512
    static let MIN_FREE_MB: Int = 200

    static let AAC_SYSTEM = "You are an AAC helper. Complete short sentences for a child who uses AAC to communicate."
    static let EMERG_SYSTEM = "You are an emergency AAC responder. Interpret the user's symbols as a first-person distress statement."

    private var model: OpaquePointer?
    private var context: OpaquePointer?

    func load(from url: URL) async throws {
        #if canImport(llama)
        guard !isLoaded else { return }

        let path = url.path
        guard FileManager.default.fileExists(atPath: path) else {
            throw WatchLLMError.modelNotFound(path: path)
        }

        let freeMB = WatchMemoryMonitor.freeMB()
        guard freeMB >= Self.MIN_FREE_MB else {
            throw WatchLLMError.insufficientMemory(freeMB: freeMB)
        }

        let loadedModel: OpaquePointer? = await Task.detached(priority: .userInitiated) {
            var params = llama_model_default_params()
            params.n_gpu_layers = 0  // CPU only — watchOS Metal is unavailable for inference
            return llama_load_model_from_file(path, params)
        }.value

        guard let loadedModel else { throw WatchLLMError.loadFailed }

        var ctxParams = llama_context_default_params()
        ctxParams.n_ctx = Self.CONTEXT_SIZE
        ctxParams.n_batch = 64
        ctxParams.n_threads = 2         // Watch S9: dual-core ARM64
        ctxParams.n_threads_batch = 2

        let ctx = llama_new_context_with_model(loadedModel, ctxParams)
        guard ctx != nil else {
            llama_free_model(loadedModel)
            throw WatchLLMError.loadFailed
        }

        self.model = loadedModel
        self.context = ctx
        self.isLoaded = true
        NSLog("[WatchLLM] Loaded %@ (free RAM before: %d MB)", url.lastPathComponent, freeMB)
        #else
        throw WatchLLMError.llamaUnavailable
        #endif
    }

    func unload() {
        guard !isGenerating else { return }
        #if canImport(llama)
        if let ctx = context { llama_free(ctx) }
        if let mdl = model { llama_free_model(mdl) }
        #endif
        context = nil
        model = nil
        isLoaded = false
    }

    /// Complete an AAC phrase (standard vocabulary prediction).
    func complete(_ starter: String) async throws -> String {
        let prompt = buildPrompt(system: Self.AAC_SYSTEM, user: "Complete: \(starter)")
        return try await infer(prompt: prompt)
    }

    /// Expand AAC symbols to a first-person sentence.
    /// symbols: e.g. ["hungry", "want", "food"]
    func expandSymbols(_ symbols: [String]) async throws -> String {
        let symbolStr = symbols.map { "[\($0)]" }.joined(separator: " ")
        let prompt = buildPrompt(
            system: Self.EMERG_SYSTEM,
            user: "Symbols: \(symbolStr). Generate a complete sentence."
        )
        return try await infer(prompt: prompt)
    }

    /// Interpret emergency symbol selection as a distress statement.
    func interpretEmergency(_ symbols: [String]) async throws -> String {
        let symbolStr = symbols.map { "[\($0)]" }.joined(separator: " ")
        let prompt = buildPrompt(
            system: Self.EMERG_SYSTEM,
            user: "User selects \(symbolStr) in distress. What are they saying?"
        )
        return try await infer(prompt: prompt, maxTokens: 40)
    }

    // MARK: - Private

    private func buildPrompt(system: String, user: String) -> String {
        "<|im_start|>system\n\(system)<|im_end|>\n<|im_start|>user\n\(user)<|im_end|>\n<|im_start|>assistant\n"
    }

    private func infer(prompt: String, maxTokens: Int? = nil) async throws -> String {
        #if canImport(llama)
        guard let ctx = context, let mdl = model else { throw WatchLLMError.notLoaded }
        guard !isGenerating else { throw WatchLLMError.busy }

        isGenerating = true
        defer { isGenerating = false }

        let limit = maxTokens ?? Self.MAX_NEW_TOKENS

        return try await Task.detached(priority: .userInitiated) { [weak self] in
            guard self != nil else { throw WatchLLMError.notLoaded }

            let promptTokens = Self.tokenize(model: mdl, text: prompt, addBos: true)
            guard !promptTokens.isEmpty else { throw WatchLLMError.notLoaded }

            llama_kv_cache_clear(ctx)

            var batch = llama_batch_init(Int32(promptTokens.count), 0, 1)
            defer { llama_batch_free(batch) }

            for (i, token) in promptTokens.enumerated() {
                Self.batchAdd(&batch, token: token, pos: Int32(i), seqIds: [0],
                              logits: i == promptTokens.count - 1)
            }

            guard llama_decode(ctx, batch) == 0 else { throw WatchLLMError.decodeFailed }

            let sampler = try Self.createSampler()
            defer { llama_sampler_free(sampler) }

            let eosId = llama_token_eos(mdl)
            let imEndId = Self.findToken(model: mdl, text: "<|im_end|>")

            var generated = ""
            var nCur = Int32(promptTokens.count)
            let nMax = nCur + Int32(limit)

            while nCur < nMax {
                let tok = llama_sampler_sample(sampler, ctx, -1)
                if tok == eosId || tok == imEndId { break }

                var buf = [CChar](repeating: 0, count: 128)
                let n = llama_token_to_piece(mdl, tok, &buf, Int32(buf.count), 0, true)
                if n > 0 {
                    generated += String(cString: buf.prefix(Int(n)) + [0])
                }

                batch.n_tokens = 0
                Self.batchAdd(&batch, token: tok, pos: nCur, seqIds: [0], logits: true)
                guard llama_decode(ctx, batch) == 0 else { break }
                nCur += 1
            }

            return generated.trimmingCharacters(in: .whitespacesAndNewlines)
        }.value
        #else
        throw WatchLLMError.llamaUnavailable
        #endif
    }

    // MARK: - Helpers

    #if canImport(llama)
    nonisolated private static func tokenize(model: OpaquePointer, text: String, addBos: Bool) -> [llama_token] {
        let utf8 = Array(text.utf8)
        let maxTokens = utf8.count + (addBos ? 1 : 0) + 1
        var tokens = [llama_token](repeating: 0, count: maxTokens)
        let n = llama_tokenize(model, text, Int32(utf8.count), &tokens, Int32(maxTokens), addBos, true)
        guard n >= 0 else { return [] }
        return Array(tokens.prefix(Int(n)))
    }

    nonisolated private static func findToken(model: OpaquePointer, text: String) -> llama_token {
        var tokens = [llama_token](repeating: 0, count: 16)
        let n = llama_tokenize(model, text, Int32(text.utf8.count), &tokens, 16, false, true)
        return n == 1 ? tokens[0] : -1
    }

    nonisolated private static func createSampler() throws -> UnsafeMutablePointer<llama_sampler> {
        let params = llama_sampler_chain_default_params()
        guard let chain = llama_sampler_chain_init(params) else {
            throw WatchLLMError.decodeFailed
        }
        llama_sampler_chain_add(chain, llama_sampler_init_greedy())
        return chain
    }

    nonisolated private static func batchAdd(_ batch: inout llama_batch, token: llama_token,
                                              pos: Int32, seqIds: [Int32], logits: Bool) {
        let i = Int(batch.n_tokens)
        batch.token[i] = token
        batch.pos[i] = pos
        batch.n_seq_id[i] = Int32(seqIds.count)
        for (j, sid) in seqIds.enumerated() { batch.seq_id[i]![j] = sid }
        batch.logits[i] = logits ? 1 : 0
        batch.n_tokens += 1
    }
    #endif
}

// MARK: - Memory monitor

private enum WatchMemoryMonitor {
    static func freeMB() -> Int {
        var vmStats = vm_statistics64()
        var count = mach_msg_type_number_t(MemoryLayout<vm_statistics64>.size / MemoryLayout<natural_t>.size)
        let result = withUnsafeMutablePointer(to: &vmStats) {
            $0.withMemoryRebound(to: integer_t.self, capacity: Int(count)) {
                host_statistics64(mach_host_self(), HOST_VM_INFO64, $0, &count)
            }
        }
        guard result == KERN_SUCCESS else { return 512 }
        let pageSize = Int(vm_page_size)
        let freeBytes = Int(vmStats.free_count) * pageSize
        return freeBytes / (1024 * 1024)
    }
}

// MARK: - Errors

enum WatchLLMError: LocalizedError {
    case llamaUnavailable
    case modelNotFound(path: String)
    case loadFailed
    case notLoaded
    case busy
    case insufficientMemory(freeMB: Int)
    case decodeFailed

    var errorDescription: String? {
        switch self {
        case .llamaUnavailable:          return "llama.cpp not available on this platform."
        case .modelNotFound(let p):      return "Model not found at \(p)."
        case .loadFailed:                return "Failed to load model."
        case .notLoaded:                 return "Model not loaded."
        case .busy:                      return "Inference already running."
        case .insufficientMemory(let m): return "Insufficient memory: \(m) MB free (need 200 MB)."
        case .decodeFailed:              return "Decode error."
        }
    }
}
