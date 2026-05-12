import Foundation
import AVFoundation
import Security

// NOTE: NSLog is used for operational logging. Auth tokens are never logged.
// Operational data (message counts, status codes) is considered acceptable in production logs.
// For future: migrate to os_log with appropriate log levels.

/// Translation + live voice input for the Watch.
///
/// Phrase tap:  translate label via synalux API → speak in output lang
/// Mic button:  triggers Watch dictation UI → translate → TTS output
@MainActor
final class WatchTranslation: ObservableObject {

    @Published private(set) var isTranslating = false
    @Published var isListening   = false
    @Published private(set) var pendingText = ""  // FIX #32: restrict external mutation

    private var translateTask: Task<Void, Never>?
    private var listeningWatchdog: Task<Void, Never>?

    deinit {
        // NOTE: deinit accesses @MainActor-isolated properties. Task.cancel() is safe
        // from any thread — it only sets an atomic flag. No actor state mutation occurs.
        translateTask?.cancel()
        listeningWatchdog?.cancel()
    }

    // Uses the same working chat endpoint as WatchAISession — no dedicated
    // /translate route exists on the portal. A minimal system prompt tells
    // the AI to return only the translation with no explanation.
    // #18: force-unwrap instead of fatalError — both crash on bad literal, but ! is idiomatic for known-good literals
    private let chatURL = URL(string: "https://synalux.ai/api/v1/prism-aac/chat")!

    // #8: dedicated session with both request and resource timeouts — URLSession.shared has no resource timeout
    private static let translationSession: URLSession = {
        let cfg = URLSessionConfiguration.ephemeral
        cfg.timeoutIntervalForRequest  = 10
        cfg.timeoutIntervalForResource = 15
        return URLSession(configuration: cfg)
    }()

    // MARK: - Phrase translation (tap-to-speak)

    func translateAndSpeak(
        text: String,
        from fromLang: String,
        to toLang: String,
        tts: WatchTTS
    ) {
        // Skip translation when source and output language are the same
        // FIX L1: Chinese exception — zh-Hans ≠ zh-Hant (Simplified ≠ Traditional)
        if fromLang.prefix(2) == toLang.prefix(2) && !(fromLang.prefix(2) == "zh" && fromLang != toLang) {
            tts.speak(text, language: toLang)
            return
        }
        translateTask?.cancel()  // cancel any in-flight translate
        isTranslating = true
        translateTask = Task { @MainActor [weak self] in
            guard let self else { return }
            defer { self.isTranslating = false }  // always resets regardless of path
            let translated = await self.translate(text: text, to: toLang)
            guard !Task.isCancelled else { return }
            if let translated = translated {
                tts.speak(translated, language: toLang)
            } else {
                // Translation was nil (safety filter or network error) — speak original in input language
                tts.speak(text, language: fromLang.isEmpty ? toLang : fromLang)
            }
        }
    }

    /// Public version of translate() — used by AI Chat translator mode to
    /// get the translated string without immediately speaking it.
    func translateDirect(text: String, to toLang: String) async -> String? {
        return await translate(text: text, to: toLang)
    }

    private func translate(text: String, to toLang: String) async -> String? {
        // #31: bail immediately if caller's task was cancelled before network work begins
        guard !Task.isCancelled else { return nil }
        // FIX #7: Auth check FIRST — don't construct request body if we can't send it
        guard let token = KeychainHelper.shared.read(service: "prism-aac", account: "auth-token") else {
            NSLog("[WatchTranslation] No auth token — skipping translation request")
            return nil
        }
        // Safety gate — don't translate crisis or medical dosing phrases
        let safety = WatchSafetyFilter.check(text)
        if case .crisis = safety { return nil }
        if case .medical = safety { return nil }

        // Sanitize language code — allowlist BCP-47 format only (alphanumerics + hyphen, max 20 chars)
        let safeLang = String(toLang.prefix(20))
            .components(separatedBy: CharacterSet.alphanumerics.union(CharacterSet(charactersIn: "-")).inverted)
            .joined()

        // Validate lang against known-good allowlist before injecting into prompt
        // FIX M1: include regional BCP-47 codes that the UI lang picker uses
        let allowedLangs: Set<String> = ["en", "en-US", "es", "es-ES", "ro", "ro-RO", "ru", "ru-RU",
            "fr", "fr-FR", "de", "de-DE", "it", "pt", "pt-BR", "ar", "ar-SA",
            "zh-Hans", "zh-Hant", "zh-CN", "ja", "ja-JP", "ko", "he", "hi",
            "nl", "pl", "uk", "uk-UA", "tr", "vi", "tl", "id"]
        // #22: BCP-47 regex guard in addition to allowlist — prevents prompt injection if allowlist entry is malformed
        let bcp47Regex = #"^[a-zA-Z]{2,8}(-[a-zA-Z0-9]{1,8})*$"#
        let validLang: String
        if allowedLangs.contains(safeLang) && safeLang.range(of: bcp47Regex, options: .regularExpression) != nil {
            validLang = safeLang
        } else {
            validLang = "en-US"
        }

        // Sanitize user text — FIX #8: NFKC normalize FIRST (before literal stripping)
        // so that composed/compatibility forms of token characters are normalized into
        // the canonical ASCII form that the literal strip chain can then match.

        // Step 1: NFKC normalize first (before literal stripping)
        let nfkcText = String(text.prefix(300))
            .applyingTransform(.init("NFKC; [:Mn:] Remove; NFKC"), reverse: false)
            ?? String(text.prefix(300))

        // Step 2: Literal token strip on normalized input
        let safeText = nfkcText
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
            .replacingOccurrences(of: "&#x", with: "")  // #24: hex entities (e.g. &#x3C; = <)
            .replacingOccurrences(of: "&#X", with: "")  // uppercase X variant bypass (#23)
            .replacingOccurrences(of: "&#", with: "")
            .replacingOccurrences(of: "&lt;", with: "")
            .replacingOccurrences(of: "&gt;", with: "")
            .replacingOccurrences(of: "\\u003c", with: "")  // JSON-escaped <
            .replacingOccurrences(of: "\\u003e", with: "")  // JSON-escaped >

        // Step 3: Final bracket strip on normalized+stripped text
        let finalText = safeText.components(separatedBy: CharacterSet(charactersIn: "<>[]|")).joined()

        // Chat endpoint returns SSE (text/event-stream). Collect all
        // data: {"choices":[{"delta":{"content":"..."}}]} chunks until [DONE].
        // User text is a separate message — NOT inlined in the system prompt.
        var req = URLRequest(url: chatURL)
        req.httpMethod = "POST"
        req.setValue("application/json", forHTTPHeaderField: "Content-Type")
        // timeout configured on translationSession (timeoutIntervalForRequest: 10, timeoutIntervalForResource: 15)
        do {
            req.httpBody = try JSONSerialization.data(withJSONObject: [
                "messages": [
                    ["role": "system", "content": "Translate to \(validLang). Return ONLY the translated word or phrase, nothing else."],
                    ["role": "user", "content": finalText],
                ],
                "max_tokens": 50,
                "stream": false,  // FIX #17: non-streaming for translation (short responses); data(for:) buffers entire SSE
            ])
        } catch {
            NSLog("[WatchTranslation] JSON serialization failed: \(error) — returning nil")
            return nil
        }
        req.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
        do {
            let (data, response) = try await WatchTranslation.translationSession.data(for: req)
            if let http = response as? HTTPURLResponse, !(200...299).contains(http.statusCode) {
                NSLog("[WatchTranslation] HTTP error \(http.statusCode)")
                return nil
            }
            guard data.count <= 65_536 else { return nil }
            // FIX #17: try non-streaming parse first (stream:false); fall back to SSE assembler for
            // servers that ignore stream:false and return SSE anyway.
            // FIX M1: sanitize AI response — strip ChatML/injection tokens before returning
            guard let raw = parseNonStreaming(data) ?? assembleSSE(data) else { return nil }
            return sanitizeTranslation(raw)
        } catch is CancellationError {
            // #30: Task was cancelled (user navigated away) — not an error worth logging
            return nil
        } catch {
            NSLog("[WatchTranslation] Translation failed: \(error)")
            return nil
        }
    }

    /// Parse a non-streaming (stream:false) OpenAI-compatible JSON response.
    /// Returns the content string, capped to 300 chars, or nil if the response
    /// does not match the expected schema.
    // FIX #17: added to handle stream:false responses from the translation endpoint.
    // FIX #8: use do/catch instead of try? so JSON parse failures are logged.
    private func parseNonStreaming(_ data: Data) -> String? {
        do {
            guard let obj = try JSONSerialization.jsonObject(with: data) as? [String: Any],
                  let choices = obj["choices"] as? [[String: Any]],
                  let msg = choices.first?["message"] as? [String: Any],
                  let content = msg["content"] as? String else {
                NSLog("[WatchTranslation] parseNonStreaming: unexpected response structure")
                return nil
            }
            let trimmed = String(content.prefix(300))
                .trimmingCharacters(in: .whitespacesAndNewlines)
                .trimmingCharacters(in: .init(charactersIn: "\"'"))
            return trimmed.isEmpty ? nil : trimmed
        } catch {
            NSLog("[WatchTranslation] parseNonStreaming JSON parse failed: \(error)")
            return nil
        }
    }

    /// Parse SSE chunks: "data: {...}\n\ndata: [DONE]\n\n" → assembled string.
    private func assembleSSE(_ data: Data) -> String? {
        guard let raw = String(data: data, encoding: .utf8) else { return nil }
        var result = ""
        // #19: track failed chunks to surface persistent parse errors in logs
        var failedChunks = 0
        for line in raw.components(separatedBy: "\n") {
            guard line.count <= 4096 else { continue }  // skip malformed mega-lines
            guard line.hasPrefix("data: ") else { continue }
            let payload = String(line.dropFirst(6))
            if payload == "[DONE]" { break }
            // FIX #8: per-chunk size cap — reject oversized SSE payloads before JSON decode.
            guard payload.count <= 200 else { continue }
            guard let d = payload.data(using: .utf8),
                  let obj = try? JSONSerialization.jsonObject(with: d) as? [String: Any],
                  let choices = obj["choices"] as? [[String: Any]],
                  let delta = choices.first?["delta"] as? [String: Any],
                  let chunk = delta["content"] as? String else {
                if !payload.isEmpty && payload != "[DONE]" {
                    failedChunks += 1
                    // FIX #13: log once at exactly 3 failures, not on every subsequent failure
                    if failedChunks == 3 {
                        NSLog("[WatchTranslation] 3+ SSE chunks failed to parse — possible API format change")
                    }
                }
                continue
            }
            result += chunk
            if result.count > 300 { break }  // translations are short phrases
        }
        let trimmed = result.trimmingCharacters(in: .whitespacesAndNewlines)
                            .trimmingCharacters(in: .init(charactersIn: "\"'"))
        return trimmed.isEmpty ? nil : trimmed
    }

    // FIX M1: sanitize translation AI output — matches WatchAISession.sanitizeResponse()
    private static let outputTokens = ["<|im_start|>","<|im_end|>","<|system|>","[INST]","[/INST]",
                      "<<SYS>>","<</SYS>>","<|eot_id|>","<|start_header_id|>",
                      "<|end_header_id|>","<|user|>","<|assistant|>","<|endoftext|>",
                      "<s>","</s>","<|end_of_turn|>","<|start_of_turn|>",
                      "&#x","&#X","&#","&lt;","&gt;","\\u003c","\\u003e"]

    private func sanitizeTranslation(_ raw: String) -> String {
        let nfkc = raw.applyingTransform(.init("NFKC; [:Mn:] Remove; NFKC"), reverse: false) ?? raw
        let stripped = Self.outputTokens.reduce(nfkc) { $0.replacingOccurrences(of: $1, with: "") }
        return stripped.components(separatedBy: CharacterSet(charactersIn: "<>[]|")).joined()
    }

    // MARK: - Voice / dictation input

    /// Show Watch dictation UI (caller presents a TextField sheet).
    func startListening() {
        isListening = true
        // #10: store watchdog Task so it can be cancelled when dictation completes;
        // #24/#28: safety reset — if handleDictation is never called (e.g. user cancels without submitting),
        // isListening would remain true indefinitely. Reset after 30s max (reduced from 60s).
        listeningWatchdog?.cancel()
        listeningWatchdog = Task { @MainActor [weak self] in
            try? await Task.sleep(nanoseconds: 30_000_000_000)
            guard let self, self.isListening else { return }
            NSLog("[WatchTranslation] Listening watchdog fired — resetting isListening")
            self.isListening = false
            self.listeningWatchdog = nil
        }
    }

    // #45: stopListening() removed — handleDictation() sets isListening = false directly
    // and no external caller uses this function. isListening property is retained for SwiftUI bindings.

    /// Handle text from Watch dictation sheet → translate → speak.
    func handleDictation(
        text: String,
        inputLang: String,
        outputLang: String,
        tts: WatchTTS
    ) {
        // #10: cancel watchdog — dictation completed normally
        listeningWatchdog?.cancel()
        listeningWatchdog = nil
        isListening = false
        pendingText = text
        guard !text.isEmpty else { return }
        translateAndSpeak(text: text, from: inputLang, to: outputLang, tts: tts)
    }
}
