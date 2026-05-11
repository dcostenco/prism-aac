import Foundation
import AVFoundation

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
        var req = URLRequest(url: cloudBaseURL.appendingPathComponent("prism-aac/chat"),
                             cachePolicy: .useProtocolCachePolicy,
                             timeoutInterval: 15)
        req.httpMethod = "POST"
        req.setValue("application/json", forHTTPHeaderField: "Content-Type")
        req.httpBody = try JSONSerialization.data(withJSONObject: [
            "message": question,
            "language": language,
            "mode": "aac",
        ])
        let (data, _) = try await URLSession.shared.data(for: req)
        // M25: Reject oversized cloud responses to prevent memory bombs
        guard data.count <= 65_536 else {
            throw URLError(.dataLengthExceededMaximum)
        }
        let obj = try JSONSerialization.jsonObject(with: data) as? [String: Any]
        let text = obj?["reply"] as? String ?? ""
        stream.yield(text)
        return text
    }

    private func validateResponse(_ response: String, language: String) async throws -> String {
        guard llm.isLoaded else { return response }

        // Layer 3 — run validator prompt (max 3 iterations)
        let prompt = """
[VALIDATOR] Review this AAC response:
"\(response)"

Check (respond with exactly one line):
1. ≤ 3 sentences? 2. In \(language)? 3. No unsafe content? 4. No jargon?
If ALL pass: VALID
If any fail: REWRITE: {corrected version in 1-2 short sentences}
"""
        let validatorOut = try await llm.generate(prompt: prompt) { _ in }
        if validatorOut.hasPrefix("REWRITE:") {
            return String(validatorOut.dropFirst("REWRITE:".count)).trimmingCharacters(in: .whitespaces)
        }
        return response
    }

    private func buildPrompt(question: String, language: String) -> String {
        // M24: Sanitize chatml control tokens to prevent prompt injection
        let sanitized = question
            .replacingOccurrences(of: "<|im_start|>", with: "")
            .replacingOccurrences(of: "<|im_end|>", with: "")
            .replacingOccurrences(of: "<|system|>", with: "")
        let safeQuestion = String(sanitized.prefix(1000)) // cap input length
        return """
<|im_start|>system
You are Prism, an AAC communication assistant. The user cannot speak and uses this app to communicate.
Rules: respond in \(language), 1-2 short sentences only, plain language, no jargon, dignified and supportive.
<|im_end|>
<|im_start|>user
\(safeQuestion)<|im_end|>
<|im_start|>assistant
"""
    }
}
