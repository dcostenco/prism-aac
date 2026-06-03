import Foundation
import Security
import WatchConnectivity

// NOTE: NSLog is used for operational logging. Auth tokens are never logged.
// Operational data (message counts, status codes) is considered acceptable in production logs.
// For future: migrate to os_log with appropriate log levels.

/// Manages AI requests from the Watch.
/// Tries WatchConnectivity first (iPhone 1.5B), falls back to cloud URLSession.
@MainActor
final class WatchAISession: NSObject, ObservableObject {

    @Published private(set) var reply = ""
    @Published private(set) var isThinking = false
    @Published private(set) var mode: Mode = .unknown
    @Published private(set) var offlineBanner: String? = nil
    @Published private(set) var isPhoneReachable = false
    @Published private(set) var offlineModelReady = false

    enum Mode {
        case unknown
        case companion   // BT → iPhone → 1.7B on-device
        case cloudDirect // Watch WiFi/LTE → synalux.ai
        case offline     // no network — SmolLM2-360M on-device or phrase buttons
    }

    private let offlineEngine = WatchLLMEngine()

    enum WatchAIError: Error {
        case notAuthenticated
        case responseTooLarge
    }

    // FIX #6: Support Info.plist override for AI cloud endpoint URL
    // FIX M1: guard against invalid Info.plist URL — fall back to known-good default instead of crashing
    private let cloudURL: URL = {
        let fallback = URL(string: "https://synalux.ai/api/v1/prism-aac/chat")!
        guard let override = Bundle.main.infoDictionary?["PRISM_AI_URL"] as? String else { return fallback }
        guard let url = URL(string: override) else {
            NSLog("[WatchAI] PRISM_AI_URL is not a valid URL ('\(override)') — using default")
            return fallback
        }
        return url
    }()
    private let timeoutSec: Double = 15

    private static let aiSession: URLSession = {
        let cfg = URLSessionConfiguration.ephemeral
        cfg.timeoutIntervalForRequest = 15
        cfg.timeoutIntervalForResource = 30
        cfg.httpMaximumConnectionsPerHost = 2
        return URLSession(configuration: cfg)
    }()

    // MARK: - Init / WatchConnectivity

    override init() {
        super.init()
        // Force safety pattern validation at startup (not lazily on first user input)
        _ = WatchSafetyFilter._crisisPatternCheck
        _ = WatchSafetyFilter._medicalPatternCheck
        Task { await loadOfflineEngine() }
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

    /// Load SmolLM2-360M-AAC from the Watch app bundle.
    /// Model file must be added to the WatchKit Extension target as a resource.
    func loadOfflineEngine() async {
        guard let modelURL = Bundle.main.url(forResource: "smollm2-360m-aac-q3ks", withExtension: "gguf") else {
            NSLog("[WatchAI] Offline model not bundled — offline mode uses phrase buttons only")
            return
        }
        do {
            try await offlineEngine.load(from: modelURL)
            offlineModelReady = true
            NSLog("[WatchAI] SmolLM2-360M offline model ready")
        } catch {
            NSLog("[WatchAI] Offline model load failed: %@", error.localizedDescription)
        }
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
            // FIX M2: sanitize companion-pushed replies (same path as AI responses)
            reply = sanitizeResponse(String(text.prefix(500)))
        }
    }

    // MARK: - Ask AI

    func ask(_ question: String, language: String = "en") async {

        // Layer 1 safety — always synchronous, no network needed
        // H-3: NFKC-normalize before safety check — askViaCloud() does this too;
        // without it, fullwidth/confusable Unicode bypasses the safety gate.
        let nfkcQuestion = question.applyingTransform(.init("NFKC; [:Mn:] Remove; NFKC"), reverse: false) ?? question
        switch WatchSafetyFilter.check(nfkcQuestion) {
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
            // Safety: send nfkcQuestion (same form the safety filter checked) so
            // downstream consumers don't receive denormalized Unicode that could
            // bypass keyword matching on the phone or cloud side.
            if mode == .companion && WCSessionRouter.shared.isReachable {
                reply = sanitizeResponse(try await askViaPhone(question: nfkcQuestion, language: language))
            } else if mode == .offline && offlineEngine.isLoaded {
                // Already offline — go straight to on-device model, no network attempt
                reply = sanitizeResponse(try await offlineEngine.complete(nfkcQuestion))
            } else {
                reply = sanitizeResponse(try await askViaCloud(question: nfkcQuestion, language: language))
                // #25: do not overwrite mode here — updateMode() is sole authority
            }
        } catch is CancellationError {
            // FIX #4: User navigated away — not a network or auth failure; do not set offline mode
            NSLog("[WatchAI] AI request cancelled")
            return
        } catch WatchAIError.notAuthenticated {
            reply = "Please sign in on your iPhone to enable AI features."
        } catch {
            // Full offline fallback — try on-device model before showing banner
            mode = .offline  // #13: set offline mode when cloud call fails
            if offlineEngine.isLoaded {
                do {
                    reply = sanitizeResponse(try await offlineEngine.complete(nfkcQuestion))
                    offlineBanner = "Offline — on-device AI active"
                    return
                } catch {
                    NSLog("[WatchAI] Offline engine error: %@", error.localizedDescription)
                }
            }
            offlineBanner = "Offline — phrase buttons only"
            reply = "I'm offline right now. Use the phrase buttons below."
        }
    }

    // MARK: - Response sanitization

    // FIX #2 (CRITICAL): Expanded to match the full input sanitizer token set.
    // Previously only stripped 8 ChatML/Llama tokens — leaving Gemma, Mistral, Falcon,
    // Alpaca, HTML-encoded, and JSON-escaped variants intact in model responses.
    private func sanitizeResponse(_ raw: String) -> String {
        // Step 1: NFKC normalize BEFORE literal token stripping to collapse fullwidth/confusable variants
        let nfkcRaw = raw.applyingTransform(.init("NFKC; [:Mn:] Remove; NFKC"), reverse: false) ?? raw
        // Step 2: Strip literal injection tokens from normalized input
        let stripped = nfkcRaw
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
            .replacingOccurrences(of: "&#x", with: "")
            .replacingOccurrences(of: "&#X", with: "")
            .replacingOccurrences(of: "&#", with: "")
            .replacingOccurrences(of: "&lt;", with: "")
            .replacingOccurrences(of: "&gt;", with: "")
            .replacingOccurrences(of: "\\u003c", with: "")
            .replacingOccurrences(of: "\\u003e", with: "")
        // Step 3: Final character-class filter
        return stripped.components(separatedBy: CharacterSet(charactersIn: "<>[]|")).joined()
    }

    // MARK: - Companion path (BT → iPhone)

    private func askViaPhone(question: String, language: String) async throws -> String {
        // FIX #12 (HIGH): Hoist lock/resumed/contRef outside the group so onCancel can reach them.
        // withTaskCancellationHandler fires synchronously when the task is cancelled (e.g. on
        // group.cancelAll() from the timeout task), resuming the continuation with CancellationError
        // rather than abandoning it — which avoids CheckedContinuation abandonment warnings and
        // ensures the task group terminates cleanly.
        //
        // KNOWN: WCSession may call replyHandler/errorHandler after Task cancellation.
        // The 'resumed' flag + NSLock prevent double-resume (CheckedContinuation requirement).
        // The closure executes but returns early — acceptable CPU cost, no behavioral impact.
        let lock = NSLock()
        var resumed = false
        var contRef: CheckedContinuation<String, Error>?

        return try await withThrowingTaskGroup(of: String.self) { group in
            group.addTask {
                try await withTaskCancellationHandler {
                    try await withCheckedThrowingContinuation { (cont: CheckedContinuation<String, Error>) in
                        // Store ref so onCancel can resume it
                        lock.lock(); contRef = cont; lock.unlock()
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
                } onCancel: {
                    lock.lock()
                    let was = resumed
                    if !was { resumed = true }
                    let c = contRef
                    lock.unlock()
                    guard !was, let cont = c else { return }
                    cont.resume(throwing: CancellationError())
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
        // FIX M1: include regional BCP-47 codes that the UI lang picker uses
        let allowedLangs: Set<String> = ["en", "en-US", "es", "es-ES", "ro", "ro-RO", "ru", "ru-RU",
            "fr", "fr-FR", "de", "de-DE", "it", "pt", "pt-BR", "ar", "ar-SA",
            "zh-Hans", "zh-Hant", "zh-CN", "ja", "ja-JP", "ko", "he", "hi",
            "nl", "pl", "uk", "uk-UA", "tr", "vi", "tl", "id"]
        let validatedLanguage = allowedLangs.contains(safeLanguage) ? safeLanguage : "en-US"

        // Step 1: NFKC normalize to collapse fullwidth/confusable variants BEFORE literal stripping
        let nfkcInput = String(question.prefix(500))
            .applyingTransform(.init("NFKC; [:Mn:] Remove; NFKC"), reverse: false)
            ?? String(question.prefix(500))

        // Step 2: Strip literal injection tokens from the normalized input
        let safeQuestion = nfkcInput
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

        // Step 3: Final character-class filter
        let finalQuestion = safeQuestion.components(separatedBy: CharacterSet(charactersIn: "<>[]|")).joined()

        let system = "You are a friendly helper for a child who uses AAC. Reply in \(validatedLanguage) language. Keep answers short (2-3 sentences max)."
        var req = URLRequest(url: cloudURL, cachePolicy: .useProtocolCachePolicy, timeoutInterval: timeoutSec)
        req.httpMethod = "POST"
        req.setValue("application/json", forHTTPHeaderField: "Content-Type")
        // Auth is OPTIONAL — endpoint accepts unauthenticated requests (free tier).
        // If token exists, send it for tier routing to better models.
        if let authToken = KeychainHelper.shared.read(service: "prism-aac", account: "auth-token") {
            req.setValue("Bearer \(authToken)", forHTTPHeaderField: "Authorization")
        }
        req.httpBody = try JSONSerialization.data(withJSONObject: [
            "messages": [
                ["role": "system", "content": system],
                ["role": "user",   "content": finalQuestion],
            ],
            "language": String(validatedLanguage.prefix(2)),
            "stream": false,   // #8: data(for:) buffers full response — use non-streaming JSON; SSE fallback below
        ] as [String: Any])
        let (data, response) = try await WatchAISession.aiSession.data(for: req)
        if let http = response as? HTTPURLResponse, http.statusCode == 401 {
            // Token is stale/invalid — clear it and retry without auth
            NSLog("[WatchAI] 401 — clearing stale auth token and retrying without auth")
            KeychainHelper.shared.delete(service: "prism-aac", account: "auth-token")
            var retryReq = URLRequest(url: cloudURL, cachePolicy: .useProtocolCachePolicy, timeoutInterval: timeoutSec)
            retryReq.httpMethod = "POST"
            retryReq.setValue("application/json", forHTTPHeaderField: "Content-Type")
            retryReq.httpBody = req.httpBody
            let (retryData, retryResponse) = try await WatchAISession.aiSession.data(for: retryReq)
            if let retryHttp = retryResponse as? HTTPURLResponse, !(200...299).contains(retryHttp.statusCode) {
                NSLog("[WatchAI] HTTP error \(retryHttp.statusCode) on unauthenticated retry")
                throw URLError(.badServerResponse)
            }
            guard retryData.count <= 65_536 else {
                NSLog("[WatchAI] Retry response too large (\(retryData.count) bytes) — ignoring")
                throw WatchAIError.responseTooLarge
            }
            return parseNonStreaming(retryData) ?? assembleSSE(retryData) ?? ""
        }
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
        do {
            guard let obj = try JSONSerialization.jsonObject(with: data) as? [String: Any],
                  let choices = obj["choices"] as? [[String: Any]],
                  let msg = choices.first?["message"] as? [String: Any],
                  let content = msg["content"] as? String else {
                NSLog("[WatchAI] parseNonStreaming: response missing expected fields")
                return nil
            }
            return String(content.prefix(4000)).trimmingCharacters(in: .whitespacesAndNewlines)
        } catch {
            NSLog("[WatchAI] parseNonStreaming JSON parse failed: \(error)")
            return nil
        }
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
                } else if parsed != nil || (!payload.isEmpty && payload != "[DONE]") {
                    failedChunks += 1
                    if failedChunks <= 3 {
                        NSLog("[WatchAI] SSE chunk failed to parse (length=\(payload.count))")
                    }
                    if failedChunks == 3 {
                        NSLog("[WatchAI] 3+ SSE chunks failed — suppressing further parse logs")
                    }
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

/// Watch-side safety filter — hardcoded keyword subset only.
///
/// Intentional design divergence from iOS `SafetyFilter`: the Watch filter has no
/// `loadRemoteKeywords()` call. The Watch is frequently offline and cannot reliably
/// fetch from the portal at startup. New multilingual crisis keywords added to
/// `/api/v1/safety/config` reach iOS users automatically but do NOT reach Watch users
/// until a binary update. Mitigation: keywords are also checked on the paired iPhone
/// via `SafetyFilter` before any response is relayed to the Watch.
struct WatchSafetyFilter {
    enum Result { case safe, crisis(response: String), medical(response: String) }

    private static let crisisKeywords: [String] = [
        "help me", "can't breathe", "cant breathe", "call 911", "emergency",
        "heart attack", "i'm dying", "im dying", "not breathing", "choking",
        "kill myself", "hurt myself",
        // FIX #10: Multilingual crisis keyword coverage
        // Spanish
        "ayuda", "ayúdame", "no puedo respirar", "llama al 911", "emergencia",
        // French
        "aidez-moi", "au secours", "je ne peux pas respirer", "appel le 911",
        // Romanian
        "ajutor", "nu pot respira",
        // Russian (transliterated)
        "pomogite", "ne mogu dyshat",
        // FIX #25 (LOW): Add native Cyrillic, Arabic, and Hebrew crisis keywords.
        // Transliterated forms above cover keyboard-latin input; native scripts cover
        // voice-to-text and copied/pasted phrases from native-script IMEs.
        // Russian Cyrillic script
        "помогите", "не могу дышать", "скорую", "помощь",
        // Arabic script
        "النجدة", "لا أستطيع التنفس",
        // Hebrew
        "עזרה",
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
    fileprivate static let _crisisPatternCheck: Void = {
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
    fileprivate static let _medicalPatternCheck: Void = {
        let missing = medicalKeywords.count - medicalPatterns.count
        if missing > 0 {
            NSLog("[WatchSafetyFilter] CRITICAL: \(missing) medical pattern(s) failed to compile — coverage degraded")
            #if DEBUG
            fatalError("[WatchSafetyFilter] \(missing) medical pattern(s) failed to compile")
            #endif
        }
    }()

    private static func crisisResponseString() -> String {
        let lang = Locale.current.language.languageCode?.identifier ?? "en"
        switch lang {
        case "es": return "🆘 Llama al 911 · Estoy aquí contigo."
        case "fr": return "🆘 Appelle le 15/112 · Je suis avec toi."
        case "ro": return "🆘 Sună la 112 · Sunt cu tine."
        case "ru": return "🆘 Звони 112 · Я рядом с тобой."
        case "ar": return "🆘 اتصل بـ 911 · أنا معك."
        case "he": return "🆘 חייג 100/101 · אני איתך."
        default:   return "🆘 Call 911 · Text 988\nI'm with you."
        }
    }

    static func check(_ input: String) -> Result {
        _ = _crisisPatternCheck  // force evaluation of compile-failure assert
        _ = _medicalPatternCheck // force evaluation of medical compile-failure assert
        // #18: Use input directly — regex uses .caseInsensitive (ICU Unicode-aware case folding)
        // Avoids locale-sensitive lowercased() (e.g. Turkish dotless-i folding bugs)
        let range = NSRange(input.startIndex..., in: input)
        for regex in Self.crisisPatterns {
            if regex.firstMatch(in: input, options: [], range: range) != nil {
                return .crisis(response: crisisResponseString())
            }
        }
        for regex in Self.medicalPatterns {
            if regex.firstMatch(in: input, options: [], range: range) != nil {
                return .medical(response: "Ask your doctor or pharmacist for dosing questions.")
            }
        }
        return .safe
    }
}
