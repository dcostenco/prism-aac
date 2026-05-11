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

    // #11: NOTE: WatchEmergencyManager has its own AVSpeechSynthesizer for emergency TTS.
    // Both share the Watch speaker. Emergency manager configures AVAudioSession before speaking,
    // which ducks this synthesizer's output if active. This is acceptable — emergency speech has priority.
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
        // #9: isSpeaking watchdog — resets stuck state if delegate never fires
        Task { @MainActor [weak self] in
            try? await Task.sleep(nanoseconds: 60_000_000_000)
            guard self?.isSpeaking == true else { return }
            NSLog("[WatchTTS] isSpeaking watchdog fired — resetting stuck state")
            self?.isSpeaking = false
        }
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
            // #10: Log deactivation errors instead of silently swallowing them
            do {
                try AVAudioSession.sharedInstance().setActive(false, options: .notifyOthersOnDeactivation)
            } catch {
                NSLog("[WatchTTS] AVAudioSession deactivate failed: \(error)")
            }
        }
    }

    nonisolated func speechSynthesizer(_ synthesizer: AVSpeechSynthesizer,
                                       didCancel utterance: AVSpeechUtterance) {
        Task { @MainActor [weak self] in
            self?.isSpeaking = false
            // #10: Log deactivation errors instead of silently swallowing them
            do {
                try AVAudioSession.sharedInstance().setActive(false, options: .notifyOthersOnDeactivation)
            } catch {
                NSLog("[WatchTTS] AVAudioSession deactivate failed: \(error)")
            }
        }
    }
}
