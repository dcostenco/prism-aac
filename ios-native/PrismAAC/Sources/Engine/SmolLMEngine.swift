import Foundation
#if canImport(llama)
import llama
#endif

/// SmolLM2-360M on-device fallback for iPhone.
///
/// Activates when free RAM is 450–1,599 MB (1.7B threshold), filling the gap
/// between Core-Only mode and the full on-device tier.
///
/// Memory contract (Q3_K_S, n_ctx=1024, Metal):
///   ~155 MB weights + ~15 MB KV + ~15 MB overhead = ~185 MB total.
///   MIN_FREE_MB = 450 gives 265 MB headroom — safe on A14+ devices.
///
/// Chat template: SmolLM2 ChatML (same as WatchLLMEngine).
@MainActor
final class SmolLMEngine {

    static let MIN_FREE_MB    = 450
    static let MAX_NEW_TOKENS = 128
    static let CONTEXT_SIZE: UInt32 = 1024

    static let systemPrompt =
        "You are an AAC helper. Complete the user's phrase in 1–2 short sentences. Plain language only."

    private(set) var isLoaded     = false
    private(set) var isGenerating = false
    private var pendingUnload     = false
    private var model: OpaquePointer?
    private var context: OpaquePointer?

    // MARK: - Lifecycle

    func load(from url: URL) async throws {
        #if canImport(llama)
        guard !isLoaded else { return }
        guard FileManager.default.fileExists(atPath: url.path) else {
            throw SmolLMError.modelNotFound(path: url.path)
        }
        let freeMB = AppState.measureFreeMemoryMB()
        guard freeMB >= Self.MIN_FREE_MB else {
            throw SmolLMError.insufficientMemory(freeMB: freeMB)
        }

        let loadedModel: OpaquePointer? = await Task.detached(priority: .userInitiated) {
            var p = llama_model_default_params()
            p.n_gpu_layers = -1   // full Metal offload — iPhone has GPU unlike Watch
            return llama_load_model_from_file(url.path, p)
        }.value
        guard let loadedModel else { throw SmolLMError.loadFailed }

        var cp = llama_context_default_params()
        cp.n_ctx           = Self.CONTEXT_SIZE
        cp.n_batch         = 256
        cp.n_threads       = Int32(max(2, ProcessInfo.processInfo.processorCount / 2))
        cp.n_threads_batch = cp.n_threads

        guard let ctx = llama_new_context_with_model(loadedModel, cp) else {
            llama_free_model(loadedModel)
            throw SmolLMError.loadFailed
        }
        model   = loadedModel
        context = ctx
        isLoaded = true
        NSLog("[SmolLM360] Loaded %@ (free RAM before: %d MB)", url.lastPathComponent, freeMB)
        #else
        throw SmolLMError.unavailable
        #endif
    }

    func unload() {
        guard !isGenerating else {
            pendingUnload = true
            NSLog("[SmolLM360] Deferred unload — inference in progress")
            return
        }
        _doUnload()
    }

    private func _doUnload() {
        pendingUnload = false
        #if canImport(llama)
        if let ctx = context { llama_free(ctx) }
        if let mdl = model   { llama_free_model(mdl) }
        #endif
        context = nil; model = nil; isLoaded = false
        NSLog("[SmolLM360] Unloaded")
    }

    // MARK: - Inference

    /// Complete an in-progress AAC phrase.
    func complete(_ text: String) async throws -> String {
        let prompt = buildPrompt(user: "Complete: \(text)")
        return try await infer(prompt: prompt)
    }

    /// Answer a short question in the AAC context.
    func answer(_ question: String) async throws -> String {
        let prompt = buildPrompt(user: question)
        return try await infer(prompt: prompt)
    }

    private func buildPrompt(user: String) -> String {
        "<|im_start|>system\n\(Self.systemPrompt)<|im_end|>\n" +
        "<|im_start|>user\n\(user)<|im_end|>\n" +
        "<|im_start|>assistant\n"
    }

    private func infer(prompt: String) async throws -> String {
        #if canImport(llama)
        guard let ctx = context, let mdl = model else { throw SmolLMError.notLoaded }
        guard !isGenerating else { throw SmolLMError.busy }

        isGenerating = true
        defer {
            isGenerating = false
            if pendingUnload { _doUnload() }
        }

        return try await Task.detached(priority: .userInitiated) { [weak self] in
            guard self != nil else { throw SmolLMError.notLoaded }

            let tokens = SmolLMEngine.tokenize(model: mdl, text: prompt, addBos: true)
            guard !tokens.isEmpty else { throw SmolLMError.notLoaded }

            llama_kv_cache_clear(ctx)

            var batch = llama_batch_init(Int32(tokens.count), 0, 1)
            defer { llama_batch_free(batch) }

            for (i, tok) in tokens.enumerated() {
                SmolLMEngine.batchAdd(&batch, token: tok, pos: Int32(i),
                                     seqId: 0, logits: i == tokens.count - 1)
            }
            guard llama_decode(ctx, batch) == 0 else { throw SmolLMError.decodeFailed }

            let samplerParams = llama_sampler_chain_default_params()
            guard let sampler = llama_sampler_chain_init(samplerParams) else {
                throw SmolLMError.decodeFailed
            }
            llama_sampler_chain_add(sampler, llama_sampler_init_greedy())
            defer { llama_sampler_free(sampler) }

            let eosId   = llama_token_eos(mdl)
            let imEndId = SmolLMEngine.findToken(model: mdl, text: "<|im_end|>")

            var output = ""
            var nCur   = Int32(tokens.count)
            let nMax   = nCur + Int32(SmolLMEngine.MAX_NEW_TOKENS)

            while nCur < nMax {
                let tok = llama_sampler_sample(sampler, ctx, -1)
                if tok == eosId || tok == imEndId { break }
                var buf = [CChar](repeating: 0, count: 128)
                let n = llama_token_to_piece(mdl, tok, &buf, Int32(buf.count), 0, true)
                if n > 0 { output += String(cString: buf.prefix(Int(n)) + [0]) }
                batch.n_tokens = 0
                SmolLMEngine.batchAdd(&batch, token: tok, pos: nCur, seqId: 0, logits: true)
                guard llama_decode(ctx, batch) == 0 else { break }
                nCur += 1
            }
            return output.trimmingCharacters(in: .whitespacesAndNewlines)
        }.value
        #else
        throw SmolLMError.unavailable
        #endif
    }

    // MARK: - Helpers

    #if canImport(llama)
    nonisolated private static func tokenize(model: OpaquePointer, text: String, addBos: Bool) -> [llama_token] {
        let utf8 = Array(text.utf8)
        let max  = utf8.count + (addBos ? 1 : 0) + 1
        var toks = [llama_token](repeating: 0, count: max)
        let n    = llama_tokenize(model, text, Int32(utf8.count), &toks, Int32(max), addBos, true)
        guard n >= 0 else { return [] }
        return Array(toks.prefix(Int(n)))
    }

    nonisolated private static func findToken(model: OpaquePointer, text: String) -> llama_token {
        var toks = [llama_token](repeating: 0, count: 16)
        let n    = llama_tokenize(model, text, Int32(text.utf8.count), &toks, 16, false, true)
        return n == 1 ? toks[0] : -1
    }

    nonisolated private static func batchAdd(_ batch: inout llama_batch, token: llama_token,
                                              pos: Int32, seqId: Int32, logits: Bool) {
        let i = Int(batch.n_tokens)
        batch.token[i] = token
        batch.pos[i]   = pos
        batch.n_seq_id[i] = 1
        if let ptr = batch.seq_id[i] { ptr[0] = seqId }
        batch.logits[i]  = logits ? 1 : 0
        batch.n_tokens  += 1
    }
    #endif
}

// MARK: - Errors

enum SmolLMError: LocalizedError {
    case unavailable
    case modelNotFound(path: String)
    case loadFailed
    case notLoaded
    case busy
    case insufficientMemory(freeMB: Int)
    case decodeFailed

    var errorDescription: String? {
        switch self {
        case .unavailable:               return "llama.cpp not available on this target."
        case .modelNotFound(let p):      return "SmolLM2-360M not found at \(p)."
        case .loadFailed:                return "SmolLM2-360M failed to load."
        case .notLoaded:                 return "SmolLM2-360M is not loaded."
        case .busy:                      return "SmolLM2-360M inference already running."
        case .insufficientMemory(let m): return "Need 450 MB free, have \(m) MB."
        case .decodeFailed:              return "SmolLM2-360M decode error."
        }
    }
}
