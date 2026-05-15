import Foundation
#if canImport(llama)
import llama
private let llamaAvailable = true
#else
private let llamaAvailable = false
#endif

/// On-device inference engine — Qwen3 via llama.cpp Metal backend.
///
/// Model selection by device RAM:
///   16 GB+ (iPad Pro M1/M2/M4): prism-coder 14B Q4_K_M — 98% routing accuracy
///   4–15 GB (iPhone, iPad Air):  prism-coder 1.7B Q4_K_M — 88% routing accuracy
///
/// Memory contract (Q4_K_M):
///   1.7B:  ~1050 MB weights + ~200 MB KV + ~100 MB overhead = ~1350 MB
///   14B:   ~8400 MB weights + ~600 MB KV + ~200 MB overhead = ~9200 MB
@MainActor
final class LLMEngine: ObservableObject {

    @Published private(set) var isLoaded = false
    @Published private(set) var isGenerating = false
    @Published private(set) var memoryWarning = false
    @Published private(set) var loadedModelTier: String = ""

    static let MAX_NEW_TOKENS = 256
    static let CONTEXT_SIZE: UInt32 = 2048

    static let totalDeviceMemoryGB: Int = {
        if let override = ProcessInfo.processInfo.environment["PRISM_DEVICE_RAM_GB"],
           let gb = Int(override) {
            NSLog("[LLMEngine] RAM override: \(gb) GB (real: \(ProcessInfo.processInfo.physicalMemory / (1024*1024*1024)) GB)")
            return gb
        }
        return Int(ProcessInfo.processInfo.physicalMemory / (1024 * 1024 * 1024))
    }()

    static var canLoad14B: Bool { totalDeviceMemoryGB >= 16 }

    static var MIN_FREE_MB: Int {
        canLoad14B ? 10_000 : 1_600
    }

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
            return llama_load_model_from_file(path, params)
        }.value

        guard let loadedModel else { throw LLMError.notLoaded }

        var ctxParams = llama_context_default_params()
        ctxParams.n_ctx = Self.CONTEXT_SIZE
        ctxParams.n_batch = 512
        ctxParams.n_threads = Int32(min(ProcessInfo.processInfo.activeProcessorCount, 4))
        ctxParams.n_threads_batch = ctxParams.n_threads

        let ctx = llama_new_context_with_model(loadedModel, ctxParams)
        guard ctx != nil else {
            llama_free_model(loadedModel)
            throw LLMError.notLoaded
        }

        self.model = loadedModel
        self.context = ctx
        self.isLoaded = true
        self.loadedModelTier = url.lastPathComponent.contains("14b") ? "14B" : "1.7B"
        NSLog("[LLMEngine] Model loaded: \(url.lastPathComponent) (tier: \(loadedModelTier), device RAM: \(Self.totalDeviceMemoryGB) GB)")
        #else
        throw LLMError.notLoaded
        #endif
    }

    func unload() {
        #if canImport(llama)
        if let ctx = context { llama_free(ctx) }
        if let mdl = model { llama_free_model(mdl) }
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

        return try await Task.detached(priority: .userInitiated) { [weak self] in
            guard self != nil else { throw LLMError.notLoaded }

            let promptTokens = Self.tokenize(model: mdl, text: prompt, addBos: true)
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
            let eosId = llama_token_eos(mdl)
            let imEndId = Self.findToken(model: mdl, text: "<|im_end|>")

            let sampler = Self.createSampler()
            defer { llama_sampler_free(sampler) }

            while nCur < nMax {
                let newToken = llama_sampler_sample(sampler, ctx, -1)
                if newToken == eosId || newToken == imEndId { break }

                var buf = [CChar](repeating: 0, count: 256)
                let n = llama_token_to_piece(mdl, newToken, &buf, Int32(buf.count), 0, true)
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

    nonisolated private static func createSampler() -> UnsafeMutablePointer<llama_sampler> {
        let params = llama_sampler_chain_default_params()
        let chain = llama_sampler_chain_init(params)!
        llama_sampler_chain_add(chain, llama_sampler_init_temp(0.7))
        llama_sampler_chain_add(chain, llama_sampler_init_top_p(0.9, 1))
        llama_sampler_chain_add(chain, llama_sampler_init_top_k(20))
        llama_sampler_chain_add(chain, llama_sampler_init_min_p(0.05, 1))
        llama_sampler_chain_add(chain, llama_sampler_init_dist(UInt32.random(in: 0...UInt32.max)))
        return chain
    }

    nonisolated private static func batchAdd(_ batch: inout llama_batch, token: llama_token, pos: Int32, seqIds: [Int32], logits: Bool) {
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
