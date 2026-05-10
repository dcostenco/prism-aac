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

    private let apiBase = "https://synalux.ai/api/v1"

    // MARK: - Phrase translation (tap-to-speak)

    func translateAndSpeak(
        text: String,
        from fromLang: String,
        to toLang: String,
        tts: WatchTTS
    ) {
        if fromLang == toLang {
            tts.speak(text, language: toLang)
            return
        }
        isTranslating = true
        Task {
            let translated = await translate(text: text, from: fromLang, to: toLang)
            tts.speak(translated ?? text, language: toLang)
            isTranslating = false
        }
    }

    private func translate(text: String, from: String, to: String) async -> String? {
        guard let url = URL(string: "\(apiBase)/translate") else { return nil }
        var req = URLRequest(url: url)
        req.httpMethod = "POST"
        req.setValue("application/json", forHTTPHeaderField: "Content-Type")
        req.timeoutInterval = 6
        req.httpBody = try? JSONSerialization.data(withJSONObject: [
            "text": text, "from": from, "to": to,
        ])
        do {
            let (data, _) = try await URLSession.shared.data(for: req)
            if let json = try? JSONSerialization.jsonObject(with: data) as? [String: Any],
               let result = json["translated"] as? String { return result }
        } catch {}
        return nil
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
