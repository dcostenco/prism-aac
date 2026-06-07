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

    /// ```swift
    /// let (onToken, flush) = tts.streamingTokenSink()
    /// let response = try await engine.ask(query: q, onToken: onToken)
    /// flush()   // speak any remaining partial sentence
    /// ```
    ///
    /// This cuts perceived latency from "wait for entire response" (~5s) to
    /// "wait for first sentence" (~0.3–0.8s on local models).
    func streamingTokenSink(
        language: String? = nil
    ) -> (onToken: @Sendable (String) -> Void, flush: @MainActor () -> Void) {
        // Shared mutable state protected by a serial queue.
        let lock = DispatchQueue(label: "prism.tts.stream", qos: .userInitiated)
        var buffer = ""
        var sentenceQueue: [String] = []
        var isProcessing = false
        let sentenceBoundaries: [Character] = [".", "!", "?", "\n"]

        // Processes the sentence queue one-by-one, waiting for each to finish.
        let drainQueue: @MainActor () -> Void = { [weak self] in
            guard let self, !isProcessing else { return }
            isProcessing = true
            Task { @MainActor [weak self] in
                while true {
                    let next: String? = lock.sync {
                        sentenceQueue.isEmpty ? nil : sentenceQueue.removeFirst()
                    }
                    guard let sentence = next, let self else { break }
                    if let lang = language {
                        self.speak(sentence, language: lang)
                    } else {
                        self.speak(sentence)
                    }
                    // Wait for this utterance to finish before starting the next.
                    // Poll at 50ms — fast enough to be imperceptible, avoids
                    // spinning. The alternative (KVO on isSpeaking) is heavier.
                    while self.isSpeaking {
                        try? await Task.sleep(nanoseconds: 50_000_000)
                    }
                }
                isProcessing = false
            }
        }

        let onToken: @Sendable (String) -> Void = { [weak self] piece in
            var shouldDrain = false
            lock.sync {
                buffer += piece
                // Check for sentence boundary: punctuation followed by space/newline/end
                if let lastPunct = buffer.lastIndex(where: { sentenceBoundaries.contains($0) }) {
                    let afterPunct = buffer.index(after: lastPunct)
                    // Boundary confirmed if we're at end or next char is whitespace
                    let atEnd = afterPunct == buffer.endIndex
                    let nextIsSpace = !atEnd && buffer[afterPunct].isWhitespace
                    if atEnd || nextIsSpace {
                        let sentence = String(buffer[buffer.startIndex...lastPunct])
                            .trimmingCharacters(in: .whitespacesAndNewlines)
                        if !sentence.isEmpty {
                            sentenceQueue.append(sentence)
                            shouldDrain = true
                        }
                        buffer = atEnd ? "" : String(buffer[afterPunct...])
                    }
                }
            }
            if shouldDrain {
                Task { @MainActor in
                    guard self != nil else { return }
                    drainQueue()
                }
            }
        }

        let flush: @MainActor () -> Void = { [weak self] in
            lock.sync {
                let text = buffer.trimmingCharacters(in: .whitespacesAndNewlines)
                buffer = ""
                if !text.isEmpty {
                    sentenceQueue.append(text)
                }
            }
            if self != nil {
                drainQueue()
            }
        }

        return (onToken, flush)
    }

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
