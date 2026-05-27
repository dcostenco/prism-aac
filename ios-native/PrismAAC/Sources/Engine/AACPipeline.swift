import Foundation
import AVFoundation
import Security

/// Orchestrates the 3-layer AAC pipeline and falls back gracefully
/// when on-device inference is unavailable (3 GB devices or no download yet).
///
/// Offline guarantee:
///   Core AAC (phrase board + keyboard + native TTS) ALWAYS works — zero model required.
///   AI layer degrades gracefully: on-device → cloud API → unavailable banner.
@MainActor
final class AACPipeline: ObservableObject {

    @Published private(set) var aiAvailable: AIAvailability = .unknown
    @Published private(set) var lastResponse: String = ""
    @Published private(set) var isThinking = false

    enum AIAvailability {
        case unknown
        case onDevice           // 1.7B or 4B loaded in memory
        case cloudFallback      // 3 GB device or model not downloaded
        case unavailable        // no network + no model
    }

    private let llm: LLMEngine
    private let miniLLM: SmolLMEngine?
    private let synthesizer = AVSpeechSynthesizer()
    private let cloudBaseURL: URL
    private var currentTask: Task<Void, Never>?
    private var currentGeneration = 0

    // FIX H1: Dedicated session with timeouts — URLSession.shared has no resource timeout
    private static let cloudSession: URLSession = {
        let cfg = URLSessionConfiguration.ephemeral
        cfg.timeoutIntervalForRequest = 15
        cfg.timeoutIntervalForResource = 30
        cfg.httpMaximumConnectionsPerHost = 2
        return URLSession(configuration: cfg)
    }()

    init(llm: LLMEngine, miniLLM: SmolLMEngine? = nil,
         cloudBaseURL: URL = URL(string: "https://synalux.ai/api/v1")!) {
        self.llm = llm
        self.miniLLM = miniLLM
        self.cloudBaseURL = cloudBaseURL
    }

    // MARK: - Core AAC — always offline

    /// Speak a phrase using AVSpeechSynthesizer (no model, no network).
    /// This is the primary communication path and MUST always work.
    func speak(text: String, language: String = "en-US", rate: Float = 0.5) {
        synthesizer.stopSpeaking(at: .immediate)
        let utterance = AVSpeechUtterance(string: String(text.prefix(2000)))
        utterance.voice = AVSpeechSynthesisVoice(language: language)
        utterance.rate = max(AVSpeechUtteranceMinimumSpeechRate,
                             min(AVSpeechUtteranceMaximumSpeechRate, rate))
        synthesizer.speak(utterance)
    }

    func stopSpeaking() {
        synthesizer.stopSpeaking(at: .immediate)
    }

    // MARK: - AI layer — on-device or cloud, never blocks core AAC

    /// Ask the AI a question. Streams tokens via the returned AsyncStream.
    /// Safe to call even when model is not loaded — falls through to cloud or returns nil.
    func ask(question: String, language: String = "en") -> AsyncStream<String> {
        AsyncStream { continuation in
            self.currentTask?.cancel()
            let gen = self.currentGeneration &+ 1
            self.currentGeneration = gen
            self.currentTask = Task { [weak self] in
                guard let self else { continuation.finish(); return }

                // Layer 1 — synchronous safety check (always runs, even on cloud path)
                switch SafetyFilter.check(question) {
                case .crisis(let r):
                    continuation.yield(r)
                    continuation.finish()
                    return
                case .medical(let r):
                    continuation.yield(r)
                    continuation.finish()
                    return
                case .safe:
                    break
                }

                self.isThinking = true
                defer { if self.currentGeneration == gen { self.isThinking = false } }

                do {
                    let response: String
                    if self.llm.isLoaded {
                        // Layer 2a — 1.7B+ on-device (fullAI tier)
                        response = try await self.runOnDevice(question: question,
                                                              language: language,
                                                              stream: continuation)
                    } else if let mini = self.miniLLM, mini.isLoaded {
                        // Layer 2b — SmolLM2-360M on-device (miniAI tier, no network needed)
                        self.aiAvailable = .onDevice
                        let raw = try await mini.answer(question)
                        let text = Self.sanitizeText(raw, maxLength: 500)
                        continuation.yield(text)
                        self.lastResponse = text
                        continuation.finish()
                        return
                    } else {
                        // Layer 2c — cloud fallback
                        response = try await self.runCloud(question: question,
                                                           language: language,
                                                           stream: continuation)
                    }

                    // Layer 3 — validate (14B only: 4B/1.7B skip to avoid latency on AAC path)
                    if !response.isEmpty {
                        if self.llm.loadedModelTier == "14B" {
                            let validated = try await self.validateResponse(response,
                                                                            language: language)
                            let comparable = Self.sanitizeText(response, maxLength: 500)
                            if validated != comparable {
                                continuation.yield("\n[corrected]\n" + validated)
                                self.lastResponse = validated
                            } else {
                                self.lastResponse = response
                            }
                        } else {
                            self.lastResponse = response
                        }
                    }
                } catch {
                    continuation.yield("I'm having trouble responding right now.")
                }
                continuation.finish()
            }
        }
    }

    // MARK: - Private

    private func runOnDevice(
        question: String,
        language: String,
        stream: AsyncStream<String>.Continuation
    ) async throws -> String {
        let prompt = buildPrompt(question: question, language: language)
        var full = ""
        full = try await llm.generate(prompt: prompt) { token in
            let safe = AACPipeline.sanitizeText(token, maxLength: 200)
            Task { @MainActor in stream.yield(safe) }
        }
        // FIX M1: return sanitized text so ask() comparison with validated is consistent
        return Self.sanitizeText(full, maxLength: 4000)
    }

    private func runCloud(
        question: String,
        language: String,
        stream: AsyncStream<String>.Continuation
    ) async throws -> String {
        aiAvailable = .cloudFallback
        // FIX C2: Sanitize question before sending to cloud
        let safeQuestion = Self.sanitizeText(question, maxLength: 500)
        let validLang = Self.allowedLangs.contains(language) ? language : "en"

        var req = URLRequest(url: cloudBaseURL.appendingPathComponent("prism-aac/chat"),
                             cachePolicy: .useProtocolCachePolicy,
                             timeoutInterval: 15)
        req.httpMethod = "POST"
        req.setValue("application/json", forHTTPHeaderField: "Content-Type")
        guard let token = Self.readKeychainToken() else {
            NSLog("[AACPipeline] No auth token — cloud AI unavailable")
            aiAvailable = .unavailable
            throw URLError(.userAuthenticationRequired)
        }
        req.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
        req.httpBody = try JSONSerialization.data(withJSONObject: [
            "message": safeQuestion,
            "language": validLang,
            "mode": "aac",
        ])
        // FIX H1: Use dedicated session instead of URLSession.shared
        let (data, response) = try await Self.cloudSession.data(for: req)
        if let http = response as? HTTPURLResponse, !(200...299).contains(http.statusCode) {
            throw URLError(.badServerResponse)
        }
        guard data.count <= 65_536 else {
            throw URLError(.resourceUnavailable)
        }
        let obj = try JSONSerialization.jsonObject(with: data) as? [String: Any]
        let rawText = obj?["reply"] as? String ?? ""
        // FIX C2: Sanitize AI response before yielding
        let text = Self.sanitizeText(rawText, maxLength: 4000)
        stream.yield(text)
        return text
    }

    private func validateResponse(_ response: String, language: String) async throws -> String {
        guard llm.isLoaded else { return response }

        // FIX H3: Sanitize response before interpolating into validator prompt
        let safeResponse = Self.sanitizeText(response, maxLength: 500)
        let validLang = Self.allowedLangs.contains(language) ? language : "en"
        let prompt = """
[VALIDATOR] Review this AAC response:
"\(safeResponse)"

Check (respond with exactly one line):
1. ≤ 3 sentences? 2. In \(validLang)? 3. No unsafe content? 4. No jargon?
If ALL pass: VALID
If any fail: REWRITE: {corrected version in 1-2 short sentences}
"""
        let validatorOut = try await llm.generate(prompt: prompt) { _ in }
        if validatorOut.hasPrefix("REWRITE:") {
            return Self.sanitizeText(
                String(validatorOut.dropFirst("REWRITE:".count)).trimmingCharacters(in: .whitespaces),
                maxLength: 500)
        }
        // FIX M1: return sanitized version, not raw — ensures lastResponse is always clean
        return safeResponse
    }

    // FIX C1: Full injection token list — matches Watch sanitizer (23 tokens + NFKC + bracket filter)
    private static let injectionTokens = [
        "<|im_start|>","<|im_end|>","<|system|>","[INST]","[/INST]",
        "<<SYS>>","<</SYS>>","<|eot_id|>","<|start_header_id|>",
        "<|end_header_id|>","<|user|>","<|assistant|>","<|endoftext|>",
        "<s>","</s>","<|end_of_turn|>","<|start_of_turn|>",
        "&#x","&#X","&#","&lt;","&gt;","\\u003c","\\u003e"]

    // FIX M1: Language allowlist — prevents prompt injection via language parameter
    private static let allowedLangs: Set<String> = [
        "en", "en-US", "es", "es-ES", "ro", "ro-RO", "ru", "ru-RU",
        "fr", "fr-FR", "de", "de-DE", "it", "pt", "pt-BR", "ar", "ar-SA",
        "zh-Hans", "zh-Hant", "zh-CN", "ja", "ja-JP", "ko", "he", "hi",
        "nl", "pl", "uk", "uk-UA", "tr", "vi", "tl", "id"]

    static func sanitizeText(_ raw: String, maxLength: Int = 1000) -> String {
        let capped = String(raw.prefix(maxLength))
        let nfkc = capped.applyingTransform(.init("NFKC; [:Mn:] Remove; NFKC"), reverse: false) ?? capped
        let stripped = Self.injectionTokens.reduce(nfkc) { $0.replacingOccurrences(of: $1, with: "") }
        return stripped.components(separatedBy: CharacterSet(charactersIn: "<>[]|")).joined()
    }

    private static func readKeychainToken() -> String? {
        let query: [String: Any] = [
            kSecClass as String:              kSecClassGenericPassword,
            kSecAttrService as String:        "prism-aac",
            kSecAttrAccount as String:        "auth-token",
            kSecAttrSynchronizable as String: false,
            kSecReturnData as String:         true,
            kSecMatchLimit as String:         kSecMatchLimitOne,
        ]
        var result: AnyObject?
        guard SecItemCopyMatching(query as CFDictionary, &result) == errSecSuccess,
              let data = result as? Data, data.count <= 4096 else { return nil }
        return String(data: data, encoding: .utf8)
    }

    private func buildPrompt(question: String, language: String) -> String {
        let safeQuestion = Self.sanitizeText(question)
        let validLang = Self.allowedLangs.contains(language) ? language : "en"
        return """
<|im_start|>system
You are Prism, an AAC communication assistant. The user cannot speak and uses this app to communicate.
Rules: respond in \(validLang), 1-2 short sentences only, plain language, no jargon, dignified and supportive.
<|im_end|>
<|im_start|>user
\(safeQuestion)<|im_end|>
<|im_start|>assistant
<think>

</think>

"""
    }
}
