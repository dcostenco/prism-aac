import Foundation
import Security
import WatchConnectivity

/// Manages AI requests from the Watch.
/// Tries WatchConnectivity first (iPhone 1.5B), falls back to cloud URLSession.
@MainActor
final class WatchAISession: NSObject, ObservableObject {

    @Published private(set) var reply = ""
    @Published private(set) var isThinking = false
    @Published private(set) var mode: Mode = .unknown
    @Published private(set) var offlineBanner: String? = nil
    @Published private(set) var isPhoneReachable = false

    enum Mode {
        case unknown
        case companion   // BT → iPhone → 1.5B on-device
        case cloudDirect // Watch WiFi/LTE → synalux.ai
        case offline     // no network, no BT — phrases + Layer 1 only
    }

    enum WatchAIError: Error {
        case notAuthenticated
        case responseTooLarge
    }

    private let cloudURL = URL(string: "https://synalux.ai/api/v1/prism-aac/chat")!
    private let timeoutSec: Double = 15

    // MARK: - Init / WatchConnectivity

    override init() {
        super.init()
        // FIX 3: Register with router instead of setting WCSession.default.delegate = self
        WCSessionRouter.shared.registerMessageHandler(for: "phrase_reply") { [weak self] _, msg in
            Task { @MainActor [weak self] in self?.handlePhoneReply(msg) }
        }
        WCSessionRouter.shared.registerReachabilityHandler { [weak self] reachable in
            Task { @MainActor [weak self] in
                self?.isPhoneReachable = reachable
                self?.updateMode()  // #5: keep mode in sync on reachability change
            }
        }
        updateMode()
    }

    private func updateMode() {
        // #6: use router's isReachable — no direct WCSession.default reads
        let reachable = WCSessionRouter.shared.isReachable
        if reachable {
            mode = .companion
            offlineBanner = nil  // safe to clear — BT is back
        } else {
            // URLSession will succeed if Watch has WiFi or LTE
            mode = .cloudDirect
            // Do NOT clear offlineBanner here — it may have been set by a failed cloud call (#21)
        }
    }

    private func handlePhoneReply(_ message: [String: Any]) {
        if let text = message["tts_text"] as? String {
            reply = String(text.prefix(500))
        }
    }

    // MARK: - Ask AI

    func ask(_ question: String, language: String = "en") async {

        // Layer 1 safety — always synchronous, no network needed
        switch WatchSafetyFilter.check(question) {
        case .crisis(let r):
            reply = r
            return
        case .medical(let r):
            reply = r
            return
        case .safe:
            break
        }

        isThinking = true
        reply = ""
        defer { isThinking = false }

        do {
            // #6: use router's isReachable — no direct WCSession.default reads
            if mode == .companion && WCSessionRouter.shared.isReachable {
                reply = try await askViaPhone(question: question, language: language)
            } else {
                reply = try await askViaCloud(question: question, language: language)
                // #25: do not overwrite mode here — updateMode() is sole authority
            }
        } catch WatchAIError.notAuthenticated {
            reply = "Please sign in on your iPhone to enable AI features."
        } catch {
            // Full offline fallback
            mode = .offline  // #13: set offline mode when cloud call fails
            offlineBanner = "Offline — phrase buttons only"
            reply = "I'm offline right now. Use the phrase buttons below."
        }
    }

    // MARK: - Companion path (BT → iPhone)

    private func askViaPhone(question: String, language: String) async throws -> String {
        // #1: lock/resumed hoisted to outer scope so both the WCSession callbacks and
        // the timeout task share the same guard. withTaskCancellationHandler is NOT used
        // because cont is scoped inside withCheckedThrowingContinuation and cannot be
        // accessed from onCancel without unsafe pointer tricks. Instead, the timeout task
        // wins the group race and cancels all sibling tasks; the WCSession callbacks see
        // resumed = true and become no-ops. Swift 5.9+ safely GC's abandoned continuations.
        let lock = NSLock()
        var resumed = false

        return try await withThrowingTaskGroup(of: String.self) { group in
            group.addTask {
                try await withCheckedThrowingContinuation { (cont: CheckedContinuation<String, Error>) in
                    WCSessionRouter.shared.send(
                        ["type": "ai_ask", "question": String(question.prefix(500)), "language": language],
                        replyHandler: { reply in
                            lock.lock(); let was = resumed; if !was { resumed = true }; lock.unlock()
                            guard !was else { return }
                            if let text = reply["text"] as? String, !text.isEmpty {
                                cont.resume(returning: text)
                            } else {
                                cont.resume(throwing: URLError(.cannotParseResponse))
                            }
                        },
                        errorHandler: { err in
                            lock.lock(); let was = resumed; if !was { resumed = true }; lock.unlock()
                            guard !was else { return }
                            cont.resume(throwing: err)
                        }
                    )
                }
            }
            group.addTask {
                try await Task.sleep(nanoseconds: 10_000_000_000) // 10 seconds
                throw URLError(.timedOut)
            }
            guard let first = try await group.next() else { throw URLError(.timedOut) }
            group.cancelAll()
            return first
        }
    }

    // MARK: - Direct cloud path (Watch WiFi/LTE)

    private func askViaCloud(question: String, language: String) async throws -> String {
        // Sanitize language code — allowlist BCP-47 format only (alphanumerics + hyphen, max 10 chars)
        let safeLanguage = String(language.prefix(10))
            .components(separatedBy: CharacterSet.alphanumerics.union(CharacterSet(charactersIn: "-")).inverted)
            .joined()

        // #22+#23: Validate sanitized language against explicit allowlist — fall back to en-US
        let allowedLangs: Set<String> = ["en", "en-US", "es", "es-ES", "ro", "ru", "fr", "de", "it", "pt", "ar", "zh-Hans", "zh-Hant", "ja", "ko", "he", "hi", "nl", "pl", "uk", "tr", "vi", "tl", "id"]
        let validatedLanguage = allowedLangs.contains(safeLanguage) ? safeLanguage : "en-US"

        // Sanitize question — cap length, strip ChatML control tokens
        let safeQuestion = String(question.prefix(500))
            .replacingOccurrences(of: "<|im_start|>", with: "")
            .replacingOccurrences(of: "<|im_end|>", with: "")
            .replacingOccurrences(of: "<|system|>", with: "")
            .replacingOccurrences(of: "[INST]", with: "")
            .replacingOccurrences(of: "[/INST]", with: "")
            .replacingOccurrences(of: "<<SYS>>", with: "")
            .replacingOccurrences(of: "<</SYS>>", with: "")
            .replacingOccurrences(of: "<|eot_id|>", with: "")
            .replacingOccurrences(of: "<|start_header_id|>", with: "")
            .replacingOccurrences(of: "<|end_header_id|>", with: "")
            .replacingOccurrences(of: "<|user|>", with: "")
            .replacingOccurrences(of: "<|assistant|>", with: "")
            .replacingOccurrences(of: "<|endoftext|>", with: "")
            .replacingOccurrences(of: "<s>", with: "")
            .replacingOccurrences(of: "</s>", with: "")
            .replacingOccurrences(of: "<|end_of_turn|>", with: "")
            .replacingOccurrences(of: "<|start_of_turn|>", with: "")
            // #23: HTML entity stripping — prevents prompt injection via encoded angle brackets
            .replacingOccurrences(of: "&#x", with: "")  // #24: hex entities (&#xNN;) before decimal strip
            .replacingOccurrences(of: "&#X", with: "")  // uppercase X variant bypass (#23)
            .replacingOccurrences(of: "&#", with: "")
            .replacingOccurrences(of: "&lt;", with: "")
            .replacingOccurrences(of: "&gt;", with: "")
            .replacingOccurrences(of: "\\u003c", with: "")  // JSON-escaped <
            .replacingOccurrences(of: "\\u003e", with: "")  // JSON-escaped >

        let system = "You are a friendly helper for a child who uses AAC. Reply in \(validatedLanguage) language. Keep answers short (2-3 sentences max)."
        var req = URLRequest(url: cloudURL, cachePolicy: .useProtocolCachePolicy, timeoutInterval: timeoutSec)
        req.httpMethod = "POST"
        req.setValue("application/json", forHTTPHeaderField: "Content-Type")
        // Auth is required — throw rather than silently continuing unauthenticated
        guard let authToken = KeychainHelper.shared.read(service: "prism-aac", account: "auth-token") else {
            NSLog("[WatchAI] No auth token — cannot make cloud request")
            throw WatchAIError.notAuthenticated
        }
        req.setValue("Bearer \(authToken)", forHTTPHeaderField: "Authorization")
        req.httpBody = try JSONSerialization.data(withJSONObject: [
            "messages": [
                ["role": "system", "content": system],
                ["role": "user",   "content": safeQuestion],
            ],
            "language": String(validatedLanguage.prefix(2)),
            "stream": false,   // #8: data(for:) buffers full response — use non-streaming JSON; SSE fallback below
        ] as [String: Any])
        let (data, response) = try await URLSession.shared.data(for: req)
        if let http = response as? HTTPURLResponse, !(200...299).contains(http.statusCode) {
            NSLog("[WatchAI] HTTP error \(http.statusCode)")
            throw URLError(.badServerResponse)
        }
        guard data.count <= 65_536 else {
            NSLog("[WatchAI] Response too large (\(data.count) bytes) — ignoring")
            throw WatchAIError.responseTooLarge
        }
        // Prefer non-streaming JSON; fall back to SSE assembly if server sends SSE anyway
        return parseNonStreaming(data) ?? assembleSSE(data) ?? ""
    }

    private func parseNonStreaming(_ data: Data) -> String? {
        guard let obj = try? JSONSerialization.jsonObject(with: data) as? [String: Any],
              let choices = obj["choices"] as? [[String: Any]],
              let msg = choices.first?["message"] as? [String: Any],
              let content = msg["content"] as? String else { return nil }
        return String(content.prefix(4000)).trimmingCharacters(in: .whitespacesAndNewlines)
    }

    private func assembleSSE(_ data: Data) -> String? {
        guard let raw = String(data: data, encoding: .utf8) else { return nil }
        var result = ""
        var failedChunks = 0
        for line in raw.components(separatedBy: "\n") {
            guard line.count <= 4096 else { continue }  // skip malformed mega-lines
            guard line.hasPrefix("data: ") else { continue }
            let payload = String(line.dropFirst(6))
            if payload == "[DONE]" { break }
            if let d = payload.data(using: .utf8) {
                let parsed = try? JSONSerialization.jsonObject(with: d)
                if let obj = parsed as? [String: Any],
                   let choices = obj["choices"] as? [[String: Any]],
                   let delta = choices.first?["delta"] as? [String: Any],
                   let chunk = delta["content"] as? String {
                    result += chunk
                    if result.count > 4000 { break }  // cap total response
                } else if parsed != nil {
                    failedChunks += 1
                    if failedChunks > 3 { NSLog("[WatchAI] \(failedChunks) SSE chunks failed to parse") }
                    NSLog("[WatchAI] SSE chunk parsed but unexpected structure: \(payload.prefix(100))")
                } else if !payload.isEmpty && payload != "[DONE]" {
                    failedChunks += 1
                    if failedChunks > 3 { NSLog("[WatchAI] \(failedChunks) SSE chunks failed to parse") }
                    NSLog("[WatchAI] Unexpected SSE payload (first 100 chars): \(payload.prefix(100))")
                }
            }
        }
        let trimmed = result.trimmingCharacters(in: .whitespacesAndNewlines)
        return trimmed.isEmpty ? nil : trimmed
    }

    /// Ask AI and return the reply string (for inline use by WatchAIChatView).
    func askAI(_ question: String, lang: String = "en-US") async -> String? {
        await ask(question, language: lang)
        return reply.isEmpty ? nil : reply
    }

    /// Send a phrase to iPhone for richer TTS / logging (non-blocking).
    func sendPhrase(_ phrase: String) {
        // #6: use router's isReachable — no direct WCSession.default reads
        guard WCSessionRouter.shared.isReachable else { return }
        WCSessionRouter.shared.send(
            ["type": "phrase", "text": phrase],
            errorHandler: { err in NSLog("[WatchAI] Phrase relay failed: \(err)") }
        )
    }
}

// MARK: - Watch-local Layer 1 safety

struct WatchSafetyFilter {
    enum Result { case safe, crisis(response: String), medical(response: String) }

    private static let crisisKeywords: [String] = [
        "help me", "can't breathe", "cant breathe", "call 911", "emergency",
        "heart attack", "i'm dying", "im dying", "not breathing", "choking",
        "kill myself", "hurt myself",
    ]
    private static let medicalKeywords: [String] = [
        "how many mg", "how many pills", "medication dose", "overdose amount",
    ]

    // Word-boundary regex patterns — prevents false positives from substrings
    // (e.g. "emergencies" should match "emergency"; partial word inside larger
    // word should not suppress a false match). Mirrors SafetyFilter.swift.
    private static let crisisPatterns: [NSRegularExpression] = crisisKeywords.compactMap { keyword in
        let pattern = "(?:^|[^\\p{L}\\p{N}])\(NSRegularExpression.escapedPattern(for: keyword))(?:$|[^\\p{L}\\p{N}])"
        do {
            return try NSRegularExpression(pattern: pattern, options: [.caseInsensitive])
        } catch {
            NSLog("[WatchSafetyFilter] CRITICAL: Pattern compile failed for '\(keyword)': \(error)")
            return nil
        }
    }
    private static let _crisisPatternCheck: Void = {
        let missing = crisisKeywords.count - crisisPatterns.count
        if missing > 0 {
            NSLog("[WatchSafetyFilter] CRITICAL: \(missing) crisis pattern(s) failed to compile — coverage degraded")
            #if DEBUG
            fatalError("[WatchSafetyFilter] \(missing) crisis pattern(s) failed to compile")
            #endif
        }
    }()
    private static let medicalPatterns: [NSRegularExpression] = medicalKeywords.compactMap { keyword in
        let pattern = "(?:^|[^\\p{L}\\p{N}])\(NSRegularExpression.escapedPattern(for: keyword))(?:$|[^\\p{L}\\p{N}])"
        do {
            return try NSRegularExpression(pattern: pattern, options: [.caseInsensitive])
        } catch {
            NSLog("[WatchSafetyFilter] CRITICAL: Pattern compile failed for '\(keyword)': \(error)")
            return nil
        }
    }
    private static let _medicalPatternCheck: Void = {
        let missing = medicalKeywords.count - medicalPatterns.count
        if missing > 0 {
            NSLog("[WatchSafetyFilter] CRITICAL: \(missing) medical pattern(s) failed to compile — coverage degraded")
            #if DEBUG
            fatalError("[WatchSafetyFilter] \(missing) medical pattern(s) failed to compile")
            #endif
        }
    }()

    static func check(_ input: String) -> Result {
        _ = _crisisPatternCheck  // force evaluation of compile-failure assert
        _ = _medicalPatternCheck // force evaluation of medical compile-failure assert
        let lower = input.lowercased()
        let range = NSRange(lower.startIndex..., in: lower)
        for regex in Self.crisisPatterns {
            if regex.firstMatch(in: lower, range: range) != nil {
                return .crisis(response: "🆘 Call 911 · Text 988 (US crisis line)\nI'm with you.")
            }
        }
        for regex in Self.medicalPatterns {
            if regex.firstMatch(in: lower, range: range) != nil {
                return .medical(response: "Ask your doctor or pharmacist for dosing questions.")
            }
        }
        return .safe
    }
}
