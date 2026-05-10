import Foundation
import AVFoundation

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

    // Uses the same working chat endpoint as WatchAISession — no dedicated
    // /translate route exists on the portal. A minimal system prompt tells
    // the AI to return only the translation with no explanation.
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
        isTranslating = true
        Task {
            let translated = await translate(text: text, to: toLang)
            tts.speak(translated ?? text, language: toLang)
            isTranslating = false
        }
    }

    private func translate(text: String, to toLang: String) async -> String? {
        // Chat endpoint returns SSE (text/event-stream). Collect all
        // data: {"choices":[{"delta":{"content":"..."}}]} chunks until [DONE].
        let prompt = "Translate to \(toLang). Return ONLY the translated word or phrase, nothing else: \(text)"
        var req = URLRequest(url: chatURL)
        req.httpMethod = "POST"
        req.setValue("application/json", forHTTPHeaderField: "Content-Type")
        req.timeoutInterval = 10
        req.httpBody = try? JSONSerialization.data(withJSONObject: [
            "messages": [["role": "user", "content": prompt]],
        ])
        do {
            let (data, _) = try await URLSession.shared.data(for: req)
            return assembleSSE(data)
        } catch { return nil }
    }

    /// Parse SSE chunks: "data: {...}\n\ndata: [DONE]\n\n" → assembled string.
    private func assembleSSE(_ data: Data) -> String? {
        guard let raw = String(data: data, encoding: .utf8) else { return nil }
        var result = ""
        for line in raw.components(separatedBy: "\n") {
            guard line.hasPrefix("data: ") else { continue }
            let payload = String(line.dropFirst(6))
            if payload == "[DONE]" { break }
            guard let d = payload.data(using: .utf8),
                  let obj = try? JSONSerialization.jsonObject(with: d) as? [String: Any],
                  let choices = obj["choices"] as? [[String: Any]],
                  let delta = choices.first?["delta"] as? [String: Any],
                  let chunk = delta["content"] as? String else { continue }
            result += chunk
        }
        let trimmed = result.trimmingCharacters(in: .whitespacesAndNewlines)
                            .trimmingCharacters(in: .init(charactersIn: "\"'"))
        return trimmed.isEmpty ? nil : trimmed
    }

    // MARK: - Voice / dictation input

    /// Show Watch dictation UI (caller presents a TextField sheet).
    func startListening(inputLang: String, outputLang: String, tts: WatchTTS) {
        isListening = true
    }

    func stopListening() { isListening = false }

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
