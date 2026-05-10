import AVFoundation

/// Text-to-speech on Watch.
/// Plays through Watch speaker or paired Bluetooth headset.
/// No model required — always available offline.
@MainActor
final class WatchTTS: ObservableObject {
    private let synthesizer = AVSpeechSynthesizer()
    @Published private(set) var isSpeaking = false

    func speak(_ text: String, language: String = "en-US", rate: Float = 0.52) {
        synthesizer.stopSpeaking(at: .immediate)
        let utt = AVSpeechUtterance(string: text)
        utt.voice = AVSpeechSynthesisVoice(language: language)
        utt.rate = max(AVSpeechUtteranceMinimumSpeechRate,
                       min(AVSpeechUtteranceMaximumSpeechRate, rate))
        isSpeaking = true
        synthesizer.speak(utt)
        // watchOS doesn't have a completion callback on AVSpeechSynthesizer
        // Estimate duration from character count and reset isSpeaking
        let estimatedMs = max(1_500, Int(Double(text.count) * 60))
        Task {
            try? await Task.sleep(nanoseconds: UInt64(estimatedMs) * 1_000_000)
            self.isSpeaking = false
        }
    }

    func stop() {
        synthesizer.stopSpeaking(at: .immediate)
        isSpeaking = false
    }
}
