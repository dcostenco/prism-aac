import Foundation
#if canImport(llama)
import llama
private let llamaAvailable = true
#else
private let llamaAvailable = false
#endif

/// On-device inference engine — Qwen3 1.7B via llama.cpp Metal backend.
///
/// Memory contract (Q4_K_M 1.7B):
///   Model weights  : ~1050 MB
///   KV cache @2048 : ~200 MB
///   ggml overhead  : ~100 MB  → Total ~1350 MB (needs 4 GB device)
@MainActor
final class LLMEngine: ObservableObject {

    @Published private(set) var isLoaded = false
    @Published private(set) var isGenerating = false
    @Published private(set) var memoryWarning = false

    static let MAX_NEW_TOKENS = 256
    static let MIN_FREE_MB = 1_600
    static let CONTEXT_SIZE: UInt32 = 2048

    private var model: OpaquePointer?
    private var context: OpaquePointer?

    func load(from url: URL) async throws {
        #if canImport(llama)
        guard !isLoaded else { return }

        let free = AppState.measureFreeMemoryMB()
        guard free >= Self.MIN_FREE_MB else {
            throw LLMError.insufficientMemory(freeMB: free, requiredMB: Self.MIN_FREE_MB)
        }

        let path = url.path
        guard FileManager.default.fileExists(atPath: path) else {
            throw LLMError.notLoaded
        }

        let loadedModel: OpaquePointer? = await Task.detached(priority: .userInitiated) {
            var params = llama_model_default_params()
            params.n_gpu_layers = 99
            return llama_model_load_from_file(path, params)
        }.value

        guard let loadedModel else { throw LLMError.notLoaded }

        var ctxParams = llama_context_default_params()
        ctxParams.n_ctx = Self.CONTEXT_SIZE
        ctxParams.n_batch = 512
        ctxParams.n_threads = UInt32(min(ProcessInfo.processInfo.activeProcessorCount, 4))
        ctxParams.n_threads_batch = ctxParams.n_threads

        let ctx = llama_init_from_model(loadedModel, ctxParams)
        guard ctx != nil else {
            llama_model_free(loadedModel)
            throw LLMError.notLoaded
        }

        self.model = loadedModel
        self.context = ctx
        self.isLoaded = true
        NSLog("[LLMEngine] Model loaded: \(url.lastPathComponent)")
        #else
        throw LLMError.notLoaded
        #endif
    }

    func unload() {
        #if canImport(llama)
        if let ctx = context { llama_free(ctx) }
        if let mdl = model { llama_model_free(mdl) }
        #endif
        context = nil
        model = nil
        isLoaded = false
    }

    func generate(prompt: String, onToken: @escaping (String) -> Void) async throws -> String {
        #if canImport(llama)
        guard let ctx = context, let mdl = model else { throw LLMError.notLoaded }
        guard !isGenerating else { throw LLMError.alreadyGenerating }

        isGenerating = true
        defer { isGenerating = false }

        let vocab = llama_model_get_vocab(mdl)

        return try await Task.detached(priority: .userInitiated) { [weak self] in
            guard self != nil else { throw LLMError.notLoaded }

            let promptTokens = Self.tokenize(vocab: vocab, text: prompt, addBos: true)
            guard !promptTokens.isEmpty else { throw LLMError.notLoaded }

            llama_kv_cache_clear(ctx)

            var batch = llama_batch_init(Int32(promptTokens.count), 0, 1)
            defer { llama_batch_free(batch) }

            for (i, token) in promptTokens.enumerated() {
                Self.batchAdd(&batch, token: token, pos: Int32(i), seqIds: [0],
                              logits: i == promptTokens.count - 1)
            }

            guard llama_decode(ctx, batch) == 0 else { throw LLMError.notLoaded }

            var generated = ""
            var nCur = Int32(promptTokens.count)
            let nMax = nCur + Int32(LLMEngine.MAX_NEW_TOKENS)
            let eosId = llama_vocab_eos(vocab)
            let imEndId = Self.findToken(vocab: vocab, text: "<|im_end|>")

            let sampler = Self.createSampler(vocab: vocab)
            defer { llama_sampler_free(sampler) }

            while nCur < nMax {
                let newToken = llama_sampler_sample(sampler, ctx, -1)
                if newToken == eosId || newToken == imEndId { break }

                var buf = [CChar](repeating: 0, count: 256)
                let n = llama_token_to_piece(vocab, newToken, &buf, Int32(buf.count), 0, true)
                if n > 0 {
                    let piece = String(cString: buf.prefix(Int(n)) + [0])
                    generated += piece
                    Task { @MainActor in onToken(piece) }
                }

                batch.n_tokens = 0
                Self.batchAdd(&batch, token: newToken, pos: nCur, seqIds: [0], logits: true)
                guard llama_decode(ctx, batch) == 0 else { break }
                nCur += 1
            }

            return generated
        }.value
        #else
        throw LLMError.notLoaded
        #endif
    }

    // MARK: - Helpers

    #if canImport(llama)
    private static func tokenize(vocab: OpaquePointer, text: String, addBos: Bool) -> [llama_token] {
        let utf8 = Array(text.utf8)
        let maxTokens = utf8.count + (addBos ? 1 : 0) + 1
        var tokens = [llama_token](repeating: 0, count: maxTokens)
        let n = llama_tokenize(vocab, text, Int32(utf8.count), &tokens, Int32(maxTokens), addBos, true)
        guard n >= 0 else { return [] }
        return Array(tokens.prefix(Int(n)))
    }

    private static func findToken(vocab: OpaquePointer, text: String) -> llama_token {
        var tokens = [llama_token](repeating: 0, count: 16)
        let n = llama_tokenize(vocab, text, Int32(text.utf8.count), &tokens, 16, false, true)
        return n == 1 ? tokens[0] : -1
    }

    private static func createSampler(vocab: OpaquePointer) -> OpaquePointer {
        let params = llama_sampler_chain_default_params()
        let chain = llama_sampler_chain_init(params)!
        llama_sampler_chain_add(chain, llama_sampler_init_temp(0.7))
        llama_sampler_chain_add(chain, llama_sampler_init_top_p(0.9, 1))
        llama_sampler_chain_add(chain, llama_sampler_init_top_k(20))
        llama_sampler_chain_add(chain, llama_sampler_init_min_p(0.05, 1))
        llama_sampler_chain_add(chain, llama_sampler_init_dist(UInt32.random(in: 0...UInt32.max)))
        return chain
    }

    private static func batchAdd(_ batch: inout llama_batch, token: llama_token, pos: Int32, seqIds: [Int32], logits: Bool) {
        let i = Int(batch.n_tokens)
        batch.token[i] = token
        batch.pos[i] = pos
        batch.n_seq_id[i] = Int32(seqIds.count)
        for (j, sid) in seqIds.enumerated() {
            batch.seq_id[i]![j] = sid
        }
        batch.logits[i] = logits ? 1 : 0
        batch.n_tokens += 1
    }
    #endif
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
