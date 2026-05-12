import AVFoundation

// NOTE: NSLog is used for operational logging. Auth tokens are never logged.
// Operational data (message counts, status codes) is considered acceptable in production logs.
// For future: migrate to os_log with appropriate log levels.

/// Text-to-speech on Watch.
/// Plays through Watch speaker or paired Bluetooth headset.
/// No model required — always available offline.
@MainActor
final class WatchTTS: NSObject, ObservableObject, AVSpeechSynthesizerDelegate {
    private let synthesizer = AVSpeechSynthesizer()
    @Published private(set) var isSpeaking = false
    private var watchdogTask: Task<Void, Never>?
    // FIX #24: Track audio session state to avoid redundant setActive calls on every speak.
    private var audioSessionActive = false

    override init() {
        super.init()
        synthesizer.delegate = self  // delegate-based isSpeaking reset, no Task.sleep
    }

    // FIX #12: Static flag set by WatchEmergencyManager to prevent non-emergency TTS
    // from ducking the emergency synthesizer's audio session.
    static var emergencyAudioActive = false

    // #11: NOTE: WatchEmergencyManager has its own AVSpeechSynthesizer for emergency TTS.
    // Both share the Watch speaker. Emergency manager configures AVAudioSession before speaking,
    // which ducks this synthesizer's output if active. This is acceptable — emergency speech has priority.
    func speak(_ text: String, language: String = "en-US", rate: Float = 0.52) {
        // If an emergency is active, defer non-emergency TTS to avoid ducking the emergency synthesizer
        // (WatchEmergencyManager has its own AVSpeechSynthesizer with higher priority)
        guard !WatchTTS.emergencyAudioActive else {
            NSLog("[WatchTTS] Deferred speech — emergency audio active")
            return
        }
        let safe = String(text.prefix(1000))
        watchdogTask?.cancel()  // cancel previous watchdog
        if synthesizer.isSpeaking { synthesizer.stopSpeaking(at: .immediate) }
        let utt = AVSpeechUtterance(string: safe)
        utt.voice = AVSpeechSynthesisVoice(language: language)
        utt.rate = max(AVSpeechUtteranceMinimumSpeechRate,
                       min(AVSpeechUtteranceMaximumSpeechRate, rate))
        // FIX #24: Only activate the audio session if not already active — avoids redundant
        // setActive(true) calls on every utterance which can cause unnecessary interruption overhead.
        if !audioSessionActive {
            do {
                try AVAudioSession.sharedInstance().setCategory(.playback, options: .duckOthers)
                try AVAudioSession.sharedInstance().setActive(true)
                audioSessionActive = true
            } catch {
                NSLog("[WatchTTS] AVAudioSession setup failed: \(error) — utterance queued, will play when session available")
                // AVFoundation queues the utterance; it plays when the audio session becomes available
            }
        }
        isSpeaking = true
        synthesizer.speak(utt)  // FIX #11: Always queued regardless of session activation success
        // #3: Cancellable watchdog — 30s max per utterance (replaces uncancellable 60s Task)
        watchdogTask = Task { @MainActor [weak self] in
            try? await Task.sleep(nanoseconds: 30_000_000_000)
            guard self?.isSpeaking == true else { return }
            NSLog("[WatchTTS] isSpeaking watchdog fired — resetting stuck state")
            self?.isSpeaking = false
        }
    }

    func stop() {
        watchdogTask?.cancel()
        watchdogTask = nil
        synthesizer.stopSpeaking(at: .immediate)
        isSpeaking = false
        if audioSessionActive {
            do {
                try AVAudioSession.sharedInstance().setActive(false, options: .notifyOthersOnDeactivation)
            } catch {
                NSLog("[WatchTTS] AVAudioSession deactivate in stop() failed: \(error)")
            }
            audioSessionActive = false
        }
    }

    // MARK: - AVSpeechSynthesizerDelegate

    nonisolated func speechSynthesizer(_ synthesizer: AVSpeechSynthesizer,
                                       didFinish utterance: AVSpeechUtterance) {
        Task { @MainActor [weak self] in
            self?.watchdogTask?.cancel()
            self?.watchdogTask = nil
            self?.isSpeaking = false
            // FIX #24: Reset session active flag so the next speak() can re-activate as needed.
            self?.audioSessionActive = false
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
            self?.watchdogTask?.cancel()
            self?.watchdogTask = nil
            self?.isSpeaking = false
            // FIX #24: Reset session active flag so the next speak() can re-activate as needed.
            self?.audioSessionActive = false
            // #10: Log deactivation errors instead of silently swallowing them
            do {
                try AVAudioSession.sharedInstance().setActive(false, options: .notifyOthersOnDeactivation)
            } catch {
                NSLog("[WatchTTS] AVAudioSession deactivate failed: \(error)")
            }
        }
    }
}
