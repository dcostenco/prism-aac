import AVFoundation
import UIKit

final class PhraseSpeaker {
    static let shared = PhraseSpeaker()
    private let synthesizer = AVSpeechSynthesizer()
    private init() {}

    func speak(fromDeepLink url: URL) {
        guard url.scheme == "prism-aac", url.host == "speak",
              let text = URLComponents(url: url, resolvingAgainstBaseURL: false)?
                  .queryItems?.first(where: { $0.name == "text" })?.value,
              !text.isEmpty else { return }
        speak(String(text.prefix(200)))
    }

    func speak(fromShortcutType type: String) {
        let phrases: [String: String] = [
            "com.prismaac.help":  "Help",
            "com.prismaac.yes":   "Yes",
            "com.prismaac.no":    "No",
            "com.prismaac.water": "Water please",
        ]
        guard let phrase = phrases[type] else { return }
        speak(phrase)
    }

    func speak(_ text: String) {
        let utterance = AVSpeechUtterance(string: text)
        utterance.voice = AVSpeechSynthesisVoice(
            language: Locale.current.language.languageCode?.identifier ?? "en")
        synthesizer.stopSpeaking(at: .immediate)
        synthesizer.speak(utterance)
    }
}
