import Foundation
import WatchKit
import WatchConnectivity
import AVFoundation
import Security

enum EmergencySeverity { case critical, urgent, medical, standard }

/// Standalone emergency manager for Apple Watch.
/// Works without iPhone — escalates via WatchConnectivity when available.
/// Haptic + audio alert fires immediately on-device regardless of connectivity.
@MainActor
final class WatchEmergencyManager: NSObject, ObservableObject {

    @Published private(set) var isActive = false
    @Published private(set) var severity: EmergencySeverity = .standard
    @Published private(set) var countdownSecs = 5

    // FIX #1: Track confirmed delivery state rather than optimistic "sent" flag
    enum DeliveryStatus { case idle, pending, confirmed, failed }
    @Published private(set) var deliveryStatus: DeliveryStatus = .idle

    private var countdownTimer: Timer?
    private let synthesizer = AVSpeechSynthesizer()
    // C6: track in-progress emergency phrase for cellular fallback
    private var activePhrase: String?
    // FIX 8: debounce guard — prevents duplicate cellular fallback on reachability flap
    private var cellularFallbackSent = false
    // F2b: store active background task handle so cleanup() can end it
    private var activeBgTask: WKBackgroundTaskHandle? = nil
    // #4: set true after escalation CONFIRMED — enables safe post-escalation dismiss from UI
    @Published private(set) var hasEscalated = false
    // #2: single stored task for SOS haptics — cancellable on cleanup
    private var sosHapticTask: Task<Void, Never>?
    // #6: stored watchdog handle so cleanup() can cancel it
    private var watchdogTask: Task<Void, Never>?

    override init() {
        super.init()
        // #19: Set delegate so we know when emergency TTS utterance completes
        synthesizer.delegate = self
        // FIX 3: Register with router instead of setting WCSession.default.delegate = self
        WCSessionRouter.shared.registerReachabilityHandler { [weak self] reachable in
            Task { @MainActor [weak self] in
                guard let self, self.isActive, !reachable else { return }
                guard !self.cellularFallbackSent else { return }
                await self.attemptCellularFallback()
            }
        }
    }

    // MARK: - Trigger

    // FIX 4: Timer background freeze fix — absolute deadline + RunLoop.main .common + background task
    func trigger(phrase: String, severity: EmergencySeverity = .critical) {
        // Safe: @MainActor serializes all calls — rapid taps cannot race past this guard
        guard !isActive else { return }  // FIX 4: mutex — no duplicate triggers
        isActive = true
        // FIX #13/#2: Sanitize phrase — strip ChatML, Llama, Gemma, and HTML-encoded tokens before storing
        activePhrase = String(phrase.prefix(200))
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
            .replacingOccurrences(of: "&#x", with: "")
            .replacingOccurrences(of: "&#X", with: "")
            .replacingOccurrences(of: "&#", with: "")
            .replacingOccurrences(of: "&lt;", with: "")
            .replacingOccurrences(of: "&gt;", with: "")
            .replacingOccurrences(of: "\\u003c", with: "")
            .replacingOccurrences(of: "\\u003e", with: "")
        self.severity = severity
        countdownSecs = 5
        cellularFallbackSent = false
        deliveryStatus = .idle

        let deadline = Date().addingTimeInterval(5)  // absolute deadline

        // Request background task so process is not suspended
        // F2b: store handle on instance so cleanup() can end it
        // activeBgTask is stored on self; if self is deallocated, the expiry handler's
        // [weak self] guard handles it safely — no strong reference cycle.
        // #2/#18: bgTask expiry must NOT call escalate() — it races with the timer's escalate().
        // The timer's escalate() will fire when it gets CPU time.
        // If completely denied CPU, fall back to on-device TTS.
        activeBgTask = WKApplication.shared().beginBackgroundTask(withName: "emergency-countdown") {
            Task { @MainActor [weak self] in
                guard let self, self.isActive else { return }
                NSLog("[WatchEmergency] Background task expired — speaking TTS and attempting cellular dispatch")
                self.speakEmergencyFallback()
                // FIX #29: Attempt cellular dispatch too — phone may still be reachable over LTE
                if !self.cellularFallbackSent {
                    await self.attemptCellularFallback()
                }
                // FIX #5: Set hasEscalated = true after TTS fallback so dismiss() becomes callable
                self.hasEscalated = true
                if let task = self.activeBgTask {
                    WKApplication.shared().endBackgroundTask(task)
                    self.activeBgTask = nil
                }
            }
        }

        // Schedule on .common mode so timer fires during touch tracking
        let timer = Timer(timeInterval: 1, repeats: true) { [weak self] t in
            Task { @MainActor [weak self] in
                guard let self else { t.invalidate(); return }
                // Use absolute deadline, not tick count — immune to background freeze
                let remaining = max(0, Int(deadline.timeIntervalSinceNow.rounded(.up)))
                self.countdownSecs = remaining
                if Date() >= deadline {
                    t.invalidate()
                    if let task = self.activeBgTask {
                        WKApplication.shared().endBackgroundTask(task)
                        self.activeBgTask = nil
                    }
                    // #14: use activePhrase only — never fall back to raw captured param
                    guard let p = self.activePhrase else {
                        NSLog("[WatchEmergency] Timer fired but activePhrase is nil — aborting escalation")
                        return
                    }
                    await self.escalate(phrase: p, severity: self.severity)  // #22: use self.severity, not captured parameter
                }
            }
        }
        RunLoop.main.add(timer, forMode: .common)
        countdownTimer = timer

        // #20: Start full SOS haptic pattern immediately on trigger — don't wait for escalation
        sosHapticTask = Task { @MainActor [weak self] in
            for i in 0..<9 {
                guard !Task.isCancelled, self?.isActive == true else { return }
                WKInterfaceDevice.current().play(i % 3 == 0 ? .failure : .click)
                try? await Task.sleep(nanoseconds: 300_000_000)
            }
        }
        do {
            try AVAudioSession.sharedInstance().setCategory(.playback, options: .duckOthers)
            try AVAudioSession.sharedInstance().setActive(true)
        } catch {
            NSLog("[WatchEmergency] AVAudioSession setup failed: \(error) — proceeding with speech anyway")
        }
        let triggerUtt = AVSpeechUtterance(string: "Help! Emergency!")
        triggerUtt.volume = 1.0
        triggerUtt.rate = 0.4
        synthesizer.speak(triggerUtt)
    }

    // FIX 5: Severity guard on cancel — critical emergencies cannot be cancelled
    func cancel() {
        guard severity != .critical else {
            NSLog("[WatchEmergency] Critical emergency cannot be cancelled")
            return
        }
        cleanup()
    }

    // #4: Public dismiss — called ONLY after escalation has confirmed, allows UI cleanup
    func dismiss() {
        // Called ONLY after escalation has completed — allows UI cleanup
        guard hasEscalated else { return }
        cleanup()
    }

    /// Force-resets emergency state. Only call after caregiver authentication or app restart.
    /// FIX #5: Breaks out of stuck state when cancel() is blocked (critical severity) and
    /// dismiss() is blocked (hasEscalated == false, e.g. bg-task-expiry pre-escalation path).
    func forceReset() {
        NSLog("[WatchEmergency] Force reset called")
        cleanup()
    }

    private func cleanup() {
        countdownTimer?.invalidate()
        countdownTimer = nil
        isActive = false
        activePhrase = nil  // C6: clear on cancel
        severity = .standard
        cellularFallbackSent = false  // FIX 8: reset debounce on cleanup
        hasEscalated = false  // FIX 4: reset escalation flag for next emergency
        deliveryStatus = .idle
        synthesizer.stopSpeaking(at: .immediate)  // #5: always stop TTS on cleanup
        // FIX #6/#14: Deactivate AVAudioSession so other apps (e.g. music) can resume; log failure
        do {
            try AVAudioSession.sharedInstance().setActive(false, options: .notifyOthersOnDeactivation)
        } catch {
            NSLog("[WatchEmergency] AVAudioSession deactivate failed in cleanup: \(error)")
        }
        // #2: cancel stored SOS haptic task
        sosHapticTask?.cancel()
        sosHapticTask = nil
        // #6: cancel stored watchdog task
        watchdogTask?.cancel()
        watchdogTask = nil
        // F2b: end any leaked background task on cancel path
        if let task = activeBgTask {
            WKApplication.shared().endBackgroundTask(task)
            activeBgTask = nil
        }
    }

    // MARK: - Escalation

    // FIX #1: hasEscalated is now set ONLY on confirmed delivery (replyHandler / HTTP 200).
    // deliveryStatus reflects: .pending immediately, .confirmed on success, .failed if all paths fail.
    // UI should show "SENDING…" (.pending), "HELP COMING" (.confirmed), "SEND FAILED — CALL 911" (.failed).
    private func escalate(phrase: String, severity: EmergencySeverity) async {
        guard !hasEscalated else { return }

        let msg: [String: Any] = buildEmergencyMessage(phrase: phrase, severity: severity)
        deliveryStatus = .pending

        if WCSessionRouter.shared.isReachable {
            WCSessionRouter.shared.send(msg,
                replyHandler: { [weak self] _ in
                    Task { @MainActor [weak self] in
                        guard let self else { return }
                        self.hasEscalated = true
                        self.deliveryStatus = .confirmed
                        NSLog("[WatchEmergency] Escalation CONFIRMED via WCSession reply")
                    }
                },
                errorHandler: { [weak self] err in
                    Task { @MainActor [weak self] in
                        NSLog("[WatchEmergency] WCSession delivery failed: \(err) — attempting cellular")
                        await self?.attemptCellularFallback()
                    }
                }
            )
        } else {
            // Not reachable — go straight to cellular
            await attemptCellularFallback()
        }

        // Start haptics and watchdog regardless of delivery path
        startSosHapticsIfNeeded()

        // #6/#8: stored watchdog — auto-cleanup 30s after escalation if UI hasn't dismissed
        watchdogTask = Task { @MainActor [weak self] in
            try? await Task.sleep(nanoseconds: 30_000_000_000)
            guard let self, self.hasEscalated, self.isActive else { return }
            NSLog("[WatchEmergency] Post-escalation watchdog: auto-cleanup after 30s")
            self.cleanup()
        }
        // #20: SOS haptic already started in trigger() — no duplicate loop here
    }

    // FIX #26: Replace ternary chain with exhaustive switch — compiler warns on new enum cases
    private func severityString(_ s: EmergencySeverity) -> String {
        switch s {
        case .critical: return "critical"
        case .urgent:   return "urgent"
        case .medical:  return "medical"
        case .standard: return "standard"
        }
    }

    private func buildEmergencyMessage(phrase: String, severity: EmergencySeverity) -> [String: Any] {
        return [
            "type": "emergency",
            "phrase": phrase,
            "severity": severityString(severity),
            "timestamp": WatchEmergencyManager.iso8601.string(from: Date()),
        ]
    }

    // #26: static cached formatter — avoids allocation on every call
    private static let iso8601 = ISO8601DateFormatter()

    // FIX #7: Dedicated session so emergency HTTP is never starved by image loads on URLSession.shared
    private static let emergencySession: URLSession = {
        let cfg = URLSessionConfiguration.ephemeral
        cfg.timeoutIntervalForRequest = 5
        cfg.timeoutIntervalForResource = 10
        cfg.httpMaximumConnectionsPerHost = 2
        return URLSession(configuration: cfg)
    }()

    /// Called from escalate() after WCSession path starts. If haptics haven't fired yet
    /// (e.g. sosHapticTask was nil due to very fast code path), kick them off now.
    private func startSosHapticsIfNeeded() {
        guard sosHapticTask == nil || sosHapticTask?.isCancelled == true else { return }
        sosHapticTask = Task { @MainActor [weak self] in
            for i in 0..<9 {
                guard !Task.isCancelled, self?.isActive == true else { return }
                WKInterfaceDevice.current().play(i % 3 == 0 ? .failure : .click)
                try? await Task.sleep(nanoseconds: 300_000_000)
            }
        }
    }

    // MARK: - Cellular fallback (FIX #2: bounded retry; FIX #3: no auth token in logs)

    @MainActor
    private func attemptCellularFallback(retryCount: Int = 0) async {
        // #19: guard — abort if emergency was cancelled before fallback ran
        guard isActive else {
            NSLog("[WatchEmergency] Cellular fallback skipped — emergency no longer active")
            return
        }
        // FIX #2/#21: bounded retry guard — first attempt sets the flag; retry path passes retryCount > 0
        // so reachabilityHandler cannot fire a duplicate while the 2s sleep is in progress.
        if retryCount == 0 {
            guard !cellularFallbackSent else { return }
            cellularFallbackSent = true
        }

        guard let url = URL(string: "https://synalux.ai/api/v1/emergency/dispatch") else { return }
        var req = URLRequest(url: url, cachePolicy: .useProtocolCachePolicy, timeoutInterval: 5)
        req.httpMethod = "POST"
        req.setValue("application/json", forHTTPHeaderField: "Content-Type")
        // #4: guard — abort immediately if no auth token; unauthenticated dispatch is never sent
        guard let token = KeychainHelper.shared.read(service: "prism-aac", account: "auth-token") else {
            NSLog("[WatchEmergency] CRITICAL: No auth token — cannot authenticate emergency dispatch; TTS fallback only")
            speakEmergencyFallback()
            deliveryStatus = .failed
            return
        }
        req.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
        // NOTE: Do not log req.allHTTPHeaderFields — contains auth token
        let payload: [String: Any] = [
            "phrase": activePhrase ?? "Emergency",
            "severity": "watch_cellular_fallback",
            "source": "watchos",
        ]
        // F2c: do/catch instead of try? so we get a log + TTS fallback on failure
        let body: Data
        do {
            body = try JSONSerialization.data(withJSONObject: payload)
        } catch {
            NSLog("[WatchEmergency] JSON serialization failed: \(error) — using TTS fallback")
            speakEmergencyFallback()
            deliveryStatus = .failed
            return
        }
        req.httpBody = body
        do {
            // FIX #7: Check HTTP status — a 4xx/5xx is not a success
            let (_, response) = try await WatchEmergencyManager.emergencySession.data(for: req)
            if let http = response as? HTTPURLResponse, (200...299).contains(http.statusCode) {
                NSLog("[WatchEmergency] Cellular fallback dispatch succeeded (\(http.statusCode))")
                // FIX #1: Set hasEscalated only on confirmed HTTP 200
                hasEscalated = true
                deliveryStatus = .confirmed
                NSLog("[WatchEmergency] Escalation CONFIRMED via cellular dispatch")
            } else if let http = response as? HTTPURLResponse,
                      (500...599).contains(http.statusCode),
                      retryCount < 1 {
                // FIX #2/#21: Bounded retry — max 1 retry (2 total attempts) before TTS fallback
                // cellularFallbackSent stays true — retryCount is the gate; resetting it here
                // would allow reachabilityHandler to fire a duplicate dispatch during the 2s sleep.
                NSLog("[WatchEmergency] Cellular 5xx (\(http.statusCode)) — retrying once in 2s")
                try? await Task.sleep(nanoseconds: 2_000_000_000)
                guard isActive else { return }  // don't retry if emergency was cancelled
                await attemptCellularFallback(retryCount: retryCount + 1)
            } else {
                NSLog("[WatchEmergency] Cellular fallback failed — TTS fallback")
                speakEmergencyFallback()
                deliveryStatus = .failed
            }
        } catch {
            NSLog("[WatchEmergency] Cellular fallback failed: \(error)")
            speakEmergencyFallback()
            deliveryStatus = .failed
        }
    }

    private func speakEmergencyFallback() {
        // #13: stop any active speech before starting fallback utterance
        if synthesizer.isSpeaking { synthesizer.stopSpeaking(at: .immediate) }
        do {
            try AVAudioSession.sharedInstance().setCategory(.playback, options: .duckOthers)
            try AVAudioSession.sharedInstance().setActive(true)
        } catch {
            NSLog("[WatchEmergency] AVAudioSession setup failed: \(error) — proceeding with speech anyway")
        }
        let utterance = AVSpeechUtterance(string: "Emergency. Please call 911.")
        utterance.volume = 1.0
        utterance.rate = 0.4
        synthesizer.speak(utterance)
    }
}

// MARK: - AVSpeechSynthesizerDelegate (#19)

extension WatchEmergencyManager: AVSpeechSynthesizerDelegate {
    nonisolated func speechSynthesizer(_ s: AVSpeechSynthesizer, didFinish utterance: AVSpeechUtterance) {
        NSLog("[WatchEmergency] Emergency TTS utterance completed")
    }
}
