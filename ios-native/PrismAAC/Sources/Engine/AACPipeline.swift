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
        case onDevice           // 1.5B loaded in memory
        case cloudFallback      // 3 GB device or model not downloaded
        case unavailable        // no network + no model
    }

    private let llm: LLMEngine
    private let synthesizer = AVSpeechSynthesizer()
    private let cloudBaseURL: URL
    private var currentTask: Task<Void, Never>?

    // FIX H1: Dedicated session with timeouts — URLSession.shared has no resource timeout
    private static let cloudSession: URLSession = {
        let cfg = URLSessionConfiguration.ephemeral
        cfg.timeoutIntervalForRequest = 15
        cfg.timeoutIntervalForResource = 30
        cfg.httpMaximumConnectionsPerHost = 2
        return URLSession(configuration: cfg)
    }()

    init(llm: LLMEngine, cloudBaseURL: URL = URL(string: "https://synalux.ai/api/v1")!) {
        self.llm = llm
        self.cloudBaseURL = cloudBaseURL
    }

    // MARK: - Core AAC — always offline

    /// Speak a phrase using AVSpeechSynthesizer (no model, no network).
    /// This is the primary communication path and MUST always work.
    func speak(text: String, language: String = "en-US", rate: Float = 0.5) {
        synthesizer.stopSpeaking(at: .immediate)
        let utterance = AVSpeechUtterance(string: text)
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
                defer { Task { @MainActor in self.isThinking = false } }

                do {
                    let response: String
                    if self.llm.isLoaded {
                        // Layer 2 — on-device
                        response = try await self.runOnDevice(question: question,
                                                              language: language,
                                                              stream: continuation)
                    } else {
                        // Cloud fallback
                        response = try await self.runCloud(question: question,
                                                           language: language,
                                                           stream: continuation)
                    }

                    // Layer 3 — validate (only if we got a response)
                    if !response.isEmpty {
                        let validated = try await self.validateResponse(response,
                                                                        language: language)
                        if validated != response {
                            // Validator rewrote — emit the correction
                            continuation.yield("\n[corrected]\n" + validated)
                            self.lastResponse = validated
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
            Task { @MainActor in stream.yield(token) }
        }
        return full
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
        // FIX H2: Require auth token — unauthenticated requests must not proceed
        if let token = KeychainHelper.shared.read(service: "prism-aac", account: "auth-token") {
            req.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
        }
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
            throw URLError(.dataLengthExceededMaximum)
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
            return String(validatorOut.dropFirst("REWRITE:".count)).trimmingCharacters(in: .whitespaces)
        }
        return response
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
"""
    }
}
