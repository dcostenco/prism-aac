import AVFoundation

/// Text-to-speech on Watch.
/// Plays through Watch speaker or paired Bluetooth headset.
/// No model required — always available offline.
@MainActor
final class WatchTTS: NSObject, ObservableObject, AVSpeechSynthesizerDelegate {
    private let synthesizer = AVSpeechSynthesizer()
    @Published private(set) var isSpeaking = false

    override init() {
        super.init()
        synthesizer.delegate = self  // delegate-based isSpeaking reset, no Task.sleep
    }

    func speak(_ text: String, language: String = "en-US", rate: Float = 0.52) {
        let safe = String(text.prefix(1000))
        if synthesizer.isSpeaking { synthesizer.stopSpeaking(at: .immediate) }
        let utt = AVSpeechUtterance(string: safe)
        utt.voice = AVSpeechSynthesisVoice(language: language)
        utt.rate = max(AVSpeechUtteranceMinimumSpeechRate,
                       min(AVSpeechUtteranceMaximumSpeechRate, rate))
        do {
            try AVAudioSession.sharedInstance().setCategory(.playback, options: .duckOthers)
            try AVAudioSession.sharedInstance().setActive(true)
        } catch {
            NSLog("[WatchTTS] AVAudioSession setup failed: \(error)")
        }
        isSpeaking = true
        synthesizer.speak(utt)
    }

    func stop() {
        synthesizer.stopSpeaking(at: .immediate)
        isSpeaking = false
    }

    // MARK: - AVSpeechSynthesizerDelegate

    nonisolated func speechSynthesizer(_ synthesizer: AVSpeechSynthesizer,
                                       didFinish utterance: AVSpeechUtterance) {
        Task { @MainActor [weak self] in
            self?.isSpeaking = false
            // Deactivate session so other audio (calls, music) can resume
            try? AVAudioSession.sharedInstance().setActive(false, options: .notifyOthersOnDeactivation)
        }
    }

    nonisolated func speechSynthesizer(_ synthesizer: AVSpeechSynthesizer,
                                       didCancel utterance: AVSpeechUtterance) {
        Task { @MainActor [weak self] in
            self?.isSpeaking = false
            try? AVAudioSession.sharedInstance().setActive(false, options: .notifyOthersOnDeactivation)
        }
    }
}
