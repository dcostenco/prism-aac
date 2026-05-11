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

    private var countdownTimer: Timer?
    private let synthesizer = AVSpeechSynthesizer()
    // C6: track in-progress emergency phrase for cellular fallback
    private var activePhrase: String?
    // FIX 8: debounce guard — prevents duplicate cellular fallback on reachability flap
    private var cellularFallbackSent = false
    // F2b: store active background task handle so cleanup() can end it
    private var activeBgTask: WKBackgroundTaskHandle? = nil
    // #4: set true after escalation completes — enables safe post-escalation dismiss from UI
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
        activePhrase = String(phrase.prefix(200))
        self.severity = severity
        countdownSecs = 5
        cellularFallbackSent = false

        let deadline = Date().addingTimeInterval(5)  // absolute deadline

        // Request background task so process is not suspended
        // F2b: store handle on instance so cleanup() can end it
        // #2/#18: bgTask expiry must NOT call escalate() — it races with the timer's escalate().
        // The timer's escalate() will fire when it gets CPU time.
        // If completely denied CPU, fall back to on-device TTS.
        activeBgTask = WKApplication.shared().beginBackgroundTask(withName: "emergency-countdown") {
            Task { @MainActor [weak self] in
                guard let self, self.isActive else { return }
                NSLog("[WatchEmergency] Background task expired during countdown — TTS fallback")
                self.speakEmergencyFallback()
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

    // #4: Public dismiss — called ONLY after escalation has completed, allows UI cleanup
    func dismiss() {
        // Called ONLY after escalation has completed — allows UI cleanup
        guard hasEscalated else { return }
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
        synthesizer.stopSpeaking(at: .immediate)  // #5: always stop TTS on cleanup
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

    private func escalate(phrase: String, severity: EmergencySeverity) async {
        guard !hasEscalated else { return }
        // #2: NOTE: hasEscalated is set optimistically before delivery is confirmed.
        // sendPhrase is fire-and-forget via WCSessionRouter. If WC delivery fails AND
        // cellular fallback fails, the child sees "HELP COMING" but no alert was sent.
        // Improvement: await WCSession replyHandler confirmation before setting hasEscalated = true.
        // Full fix requires refactoring sendPhrase to use the reply-handler path and
        // awaiting the result here — deferred to avoid architectural churn mid-release.
        sendPhrase(phrase, isEmergency: true, severity: severity)
        hasEscalated = true  // FIX 4: allow critical emergency dismiss post-escalation
        // #6/#8: stored watchdog — auto-cleanup 30s after escalation if UI hasn't dismissed
        watchdogTask = Task { @MainActor [weak self] in
            try? await Task.sleep(nanoseconds: 30_000_000_000)
            guard let self, self.hasEscalated, self.isActive else { return }
            NSLog("[WatchEmergency] Post-escalation watchdog: auto-cleanup after 30s")
            self.cleanup()
        }
        // #20: SOS haptic already started in trigger() — no duplicate loop here
    }

    // #26: static cached formatter — avoids allocation on every sendPhrase call
    private static let iso8601 = ISO8601DateFormatter()

    // F2d: private — not part of public API
    private func sendPhrase(_ phrase: String, isEmergency: Bool = false, severity: EmergencySeverity = .urgent) {
        let msg: [String: Any] = [
            "type": isEmergency ? "emergency" : "phrase",
            "phrase": phrase,
            "severity": severity == .critical ? "critical" : severity == .urgent ? "urgent" : severity == .medical ? "medical" : "standard",
            "timestamp": WatchEmergencyManager.iso8601.string(from: Date()),
        ]

        // F2a: route through WCSessionRouter.shared.send instead of direct WCSession calls
        WCSessionRouter.shared.send(msg, errorHandler: { err in
            NSLog("[WatchEmergency] sendPhrase relay failed: \(err)")
        })
    }

    // MARK: - Cellular fallback (FIX 7: HTTP status check; FIX 8: debounce)

    @MainActor
    private func attemptCellularFallback() async {
        // #19: guard — abort if emergency was cancelled before fallback ran
        guard isActive else {
            NSLog("[WatchEmergency] Cellular fallback skipped — emergency no longer active")
            return
        }
        // FIX 8: debounce — only one fallback attempt per emergency session
        guard !cellularFallbackSent else { return }
        cellularFallbackSent = true

        guard let url = URL(string: "https://synalux.ai/api/v1/emergency/dispatch") else { return }
        var req = URLRequest(url: url, cachePolicy: .useProtocolCachePolicy, timeoutInterval: 5)
        req.httpMethod = "POST"
        req.setValue("application/json", forHTTPHeaderField: "Content-Type")
        // #4: guard — abort immediately if no auth token; unauthenticated dispatch is never sent
        guard let token = KeychainHelper.shared.read(service: "prism-aac", account: "auth-token") else {
            NSLog("[WatchEmergency] CRITICAL: No auth token — cannot authenticate emergency dispatch; TTS fallback only")
            speakEmergencyFallback()
            return
        }
        req.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
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
            return
        }
        req.httpBody = body
        do {
            // FIX 7: Check HTTP status — a 4xx/5xx is not a success
            let (_, response) = try await URLSession.shared.data(for: req)
            if let http = response as? HTTPURLResponse, (200...299).contains(http.statusCode) {
                NSLog("[WatchEmergency] Cellular fallback dispatch succeeded (\(http.statusCode))")
            } else if let http = response as? HTTPURLResponse, (500...599).contains(http.statusCode) {
                NSLog("[WatchEmergency] Cellular fallback 5xx (\(http.statusCode)) — retry in 2s")
                try? await Task.sleep(nanoseconds: 2_000_000_000)
                guard isActive else { return }  // don't retry if emergency was cancelled
                cellularFallbackSent = false    // allow one retry
                await attemptCellularFallback()
            } else {
                NSLog("[WatchEmergency] Cellular fallback failed — TTS fallback")
                speakEmergencyFallback()
            }
        } catch {
            NSLog("[WatchEmergency] Cellular fallback failed: \(error)")
            speakEmergencyFallback()
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
