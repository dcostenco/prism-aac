import Foundation
import AVFoundation
import Security

/// Translation + live voice input for the Watch.
///
/// Phrase tap:  translate label via synalux API → speak in output lang
/// Mic button:  triggers Watch dictation UI → translate → TTS output
@MainActor
final class WatchTranslation: ObservableObject {

    @Published private(set) var isTranslating = false
    @Published var isListening   = false
    @Published var pendingText   = ""
    @Published var errorMessage: String?

    private var translateTask: Task<Void, Never>?

    deinit {
        translateTask?.cancel()
    }

    // Uses the same working chat endpoint as WatchAISession — no dedicated
    // /translate route exists on the portal. A minimal system prompt tells
    // the AI to return only the translation with no explanation.
    // #18: force-unwrap instead of fatalError — both crash on bad literal, but ! is idiomatic for known-good literals
    private let chatURL = URL(string: "https://synalux.ai/api/v1/prism-aac/chat")!

    // MARK: - Phrase translation (tap-to-speak)

    func translateAndSpeak(
        text: String,
        from fromLang: String,
        to toLang: String,
        tts: WatchTTS
    ) {
        // Skip translation when source and output language are the same
        if fromLang.prefix(2) == toLang.prefix(2) {
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
            tts.speak(translated ?? text, language: toLang)
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
        // Safety gate — don't translate crisis or medical dosing phrases
        let safety = WatchSafetyFilter.check(text)
        if case .crisis = safety { return nil }
        if case .medical = safety { return nil }

        // Sanitize language code — allowlist BCP-47 format only (alphanumerics + hyphen, max 20 chars)
        let safeLang = String(toLang.prefix(20))
            .components(separatedBy: CharacterSet.alphanumerics.union(CharacterSet(charactersIn: "-")).inverted)
            .joined()

        // Validate lang against known-good allowlist before injecting into prompt
        let allowedLangs: Set<String> = ["en", "en-US", "es", "ro", "ru", "fr", "de", "it", "pt", "ar", "zh-Hans", "zh-Hant", "ja", "ko", "he", "hi", "nl", "pl", "uk", "tr", "vi", "tl", "id"]
        let validLang = allowedLangs.contains(safeLang) ? safeLang : "en-US"

        // Sanitize user text — cap length, strip ChatML control tokens
        let safeText = String(text.prefix(300))
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
            .replacingOccurrences(of: "&#", with: "")
            .replacingOccurrences(of: "&lt;", with: "")
            .replacingOccurrences(of: "&gt;", with: "")
            .replacingOccurrences(of: "\\u003c", with: "")  // JSON-escaped <
            .replacingOccurrences(of: "\\u003e", with: "")  // JSON-escaped >

        // Chat endpoint returns SSE (text/event-stream). Collect all
        // data: {"choices":[{"delta":{"content":"..."}}]} chunks until [DONE].
        // User text is a separate message — NOT inlined in the system prompt.
        var req = URLRequest(url: chatURL)
        req.httpMethod = "POST"
        req.setValue("application/json", forHTTPHeaderField: "Content-Type")
        req.timeoutInterval = 10
        do {
            req.httpBody = try JSONSerialization.data(withJSONObject: [
                "messages": [
                    ["role": "system", "content": "Translate to \(validLang). Return ONLY the translated word or phrase, nothing else."],
                    ["role": "user", "content": safeText],
                ],
                "max_tokens": 50,
                "stream": true,   // #7: matches assembleSSE() SSE parser — stream:false sent non-SSE, silently failing
            ])
        } catch {
            NSLog("[WatchTranslation] JSON serialization failed: \(error) — returning nil")
            return nil
        }
        guard let token = KeychainHelper.shared.read(service: "prism-aac", account: "auth-token") else {
            NSLog("[WatchTranslation] No auth token — skipping translation request")
            return nil
        }
        req.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
        do {
            let (data, response) = try await URLSession.shared.data(for: req)
            if let http = response as? HTTPURLResponse, !(200...299).contains(http.statusCode) {
                NSLog("[WatchTranslation] HTTP error \(http.statusCode)")
                return nil
            }
            guard data.count <= 65_536 else { return nil }
            return assembleSSE(data)
        } catch is CancellationError {
            // #30: Task was cancelled (user navigated away) — not an error worth logging
            return nil
        } catch {
            NSLog("[WatchTranslation] Translation failed: \(error)")
            return nil
        }
    }

    /// Parse SSE chunks: "data: {...}\n\ndata: [DONE]\n\n" → assembled string.
    private func assembleSSE(_ data: Data) -> String? {
        guard let raw = String(data: data, encoding: .utf8) else { return nil }
        var result = ""
        for line in raw.components(separatedBy: "\n") {
            guard line.count <= 4096 else { continue }  // skip malformed mega-lines
            guard line.hasPrefix("data: ") else { continue }
            let payload = String(line.dropFirst(6))
            if payload == "[DONE]" { break }
            guard let d = payload.data(using: .utf8),
                  let obj = try? JSONSerialization.jsonObject(with: d) as? [String: Any],
                  let choices = obj["choices"] as? [[String: Any]],
                  let delta = choices.first?["delta"] as? [String: Any],
                  let chunk = delta["content"] as? String else {
                if !payload.isEmpty && payload != "[DONE]" {
                    NSLog("[WatchTranslation] Unexpected SSE payload (first 100 chars): \(payload.prefix(100))")
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

    // MARK: - Voice / dictation input

    /// Show Watch dictation UI (caller presents a TextField sheet).
    func startListening(inputLang: String, outputLang: String, tts: WatchTTS) {
        isListening = true
        // #28: safety reset — if handleDictation is never called (e.g. user cancels without submitting),
        // isListening would remain true indefinitely. Reset after 60s max.
        Task { @MainActor [weak self] in
            try? await Task.sleep(nanoseconds: 60_000_000_000)
            self?.isListening = false
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
        isListening = false
        pendingText = text
        guard !text.isEmpty else { return }
        translateAndSpeak(text: text, from: inputLang, to: outputLang, tts: tts)
    }
}
