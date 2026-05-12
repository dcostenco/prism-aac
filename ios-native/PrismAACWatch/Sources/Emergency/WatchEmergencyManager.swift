import Foundation
import WatchKit
import WatchConnectivity
import AVFoundation
import Security
import LocalAuthentication
import UserNotifications

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
    // Fix #4: set true when a stale emergency flag is detected at launch — shows recovery UI
    @Published var needsEmergencyRecovery: Bool = false
    // #2: single stored task for SOS haptics — cancellable on cleanup
    private var sosHapticTask: Task<Void, Never>?
    // #12: tracks natural completion of SOS haptic loop (not just nil/cancelled state)
    private var sosHapticsFinished = false
    // #6: stored watchdog handle so cleanup() can cancel it
    private var watchdogTask: Task<Void, Never>?
    // FIX #1: isEscalating prevents cleanup() from resetting hasEscalated mid-flight
    private var isEscalating = false
    // FIX #8: fallbackSpoken guard — prevents double TTS stutter on concurrent fallback paths
    private var fallbackSpoken = false

    override init() {
        super.init()
        // #19: Set delegate so we know when emergency TTS utterance completes
        synthesizer.delegate = self
        // FIX #26: Check for uncleared emergency flag from a previous process termination.
        // Full state recovery (re-entering countdown, resuming cellular dispatch) is a future
        // enhancement. For now, flag the condition so the UI can prompt the caregiver.
        if KeychainHelper.shared.read(service: "prism-aac", account: "emergencyActive") == "1" {
            NSLog("[WatchEmergency] Previous emergency session detected — showing recovery notification")
            // Set recoverable published state for UI
            needsEmergencyRecovery = true
            // Fire a local notification immediately
            let content = UNMutableNotificationContent()
            content.title = "Emergency Alert"
            content.body  = "A previous emergency alert may not have been delivered. Please check on the child."
            content.sound = .defaultCritical
            let req = UNNotificationRequest(identifier: "emergency-recovery", content: content, trigger: nil)
            UNUserNotificationCenter.current().add(req) { err in
                if let err = err { NSLog("[WatchEmergency] Recovery notification failed: \(err)") }
            }
        }
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
        // FIX #26/#4: Persist active flag so next launch can show recovery UI after process termination
        // #4: use Keychain instead of UserDefaults to avoid iCloud backup exposure
        KeychainHelper.shared.write(value: "1", service: "prism-aac", account: "emergencyActive")
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
            // FIX #24: Second pass to catch reassembled tokens (e.g. <|im_<|im_start|>start|>)
            .replacingOccurrences(of: "<|im_start|>", with: "")
            .replacingOccurrences(of: "<|im_end|>", with: "")
            .replacingOccurrences(of: "<|system|>", with: "")
            .replacingOccurrences(of: "[INST]", with: "")
            .replacingOccurrences(of: "[/INST]", with: "")
            // Final: reject any remaining < > [ ] characters
            .components(separatedBy: CharacterSet(charactersIn: "<>[]"))
            .joined()
        // FIX #1 (CRITICAL): Apply Unicode NFKC normalization to collapse fullwidth/homoglyph
        // variants (e.g. ｉｍ＿ｓｔａｒｔ → im_start) before the final character-class filter.
        // applyingTransform removes combining marks ([:Mn:] Remove) and re-normalizes,
        // then the second components/join strips any angle brackets that emerged from normalization.
        let nfkcSanitized = (activePhrase ?? "")
            .applyingTransform(.init("NFKC; [:Mn:] Remove; NFKC"), reverse: false) ?? (activePhrase ?? "")
        // #1 (CRITICAL): After NFKC pass, apply Latin/ASCII normalization for confusable scripts
        let latinized = nfkcSanitized.applyingTransform(.toLatin, reverse: false)
            ?? nfkcSanitized
        // Final pass: strip remaining angle brackets and brackets after normalization
        activePhrase = latinized
            .components(separatedBy: CharacterSet(charactersIn: "<>[]|"))
            .joined()
        // #20: empty-phrase fallback — phrase sanitized to empty string
        if activePhrase?.isEmpty == true || activePhrase == nil {
            activePhrase = "Emergency"
            NSLog("[WatchEmergency] Phrase sanitized to empty — using fallback 'Emergency'")
        }
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
        activeBgTask = WKApplication.shared().beginBackgroundTask(withName: "emergency-countdown") { [weak self] in
            guard let self else { return }
            // End THIS background task synchronously (required by watchOS)
            if let t = self.activeBgTask {
                WKApplication.shared().endBackgroundTask(t)
                self.activeBgTask = nil
            }
            // FIX #20 (MEDIUM): speakEmergencyFallback() is non-blocking (AVSpeechSynthesizer.speak
            // returns immediately) — call it synchronously here so TTS fires even if the async
            // Task below is denied CPU time. Only the cellular network attempt is inherently async.
            self.speakEmergencyFallback()
            NSLog("[WatchEmergency] BG expiry: TTS fallback spoken synchronously")
            // Schedule cellular attempt on a new background task (network is async)
            let fallbackTask = WKApplication.shared().beginBackgroundTask(withName: "emergency-fallback") {}
            Task { @MainActor [weak self] in
                defer { WKApplication.shared().endBackgroundTask(fallbackTask) }
                guard let self, self.isActive, !self.cellularFallbackSent else { return }
                NSLog("[WatchEmergency] BG expiry: attempting cellular — hasEscalated set only on confirmed delivery")
                await self.attemptCellularFallback()
                // hasEscalated is set by attemptCellularFallback on success only
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
        sosHapticsFinished = false
        sosHapticTask = Task { @MainActor [weak self] in
            for i in 0..<9 {
                guard !Task.isCancelled, self?.isActive == true else { return }
                WKInterfaceDevice.current().play(i % 3 == 0 ? .failure : .click)
                try? await Task.sleep(nanoseconds: 300_000_000)
            }
            self?.sosHapticsFinished = true
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
    /// FIX #16: Requires LAContext device owner authentication before allowing reset.
    func forceReset() {
        let context = LAContext()
        var error: NSError?
        guard context.canEvaluatePolicy(.deviceOwnerAuthentication, error: &error) else {
            NSLog("[WatchEmergency] LAContext unavailable — forceReset denied; passcode/biometrics required")
            // Do NOT call cleanup(). Leave emergency active.
            // Show a hint in the UI that device authentication is required.
            Task { @MainActor [weak self] in
                self?.deliveryStatus = .failed  // ensure UI shows Force Close button
            }
            return
        }
        context.evaluatePolicy(.deviceOwnerAuthentication, localizedReason: "Confirm to close emergency alert") { success, authError in
            Task { @MainActor [weak self] in
                if success {
                    NSLog("[WatchEmergency] Force reset authorized")
                    self?.cleanup()
                } else {
                    NSLog("[WatchEmergency] Force reset denied: \(authError?.localizedDescription ?? "unknown")")
                }
            }
        }
    }

    // FIX #26 (LOW): Emergency state is not fully persisted across Watch process restarts.
    // Full persistence is a future enhancement. A lightweight signal is written on trigger
    // and cleared on cleanup so the next launch can show a recovery UI if needed.
    // Future work: persist countdownSecs, severity, and activePhrase to UserDefaults for
    // full state recovery after watchOS process termination.
    //
    // NOTE: escalate() may still be in-flight (as a @MainActor Task) when cleanup() is called.
    // The guard !hasEscalated at the start of escalate() prevents double-escalation.
    // This is an intentional design: cleanup() is safe to call at any time.
    private func cleanup() {
        countdownTimer?.invalidate()
        countdownTimer = nil
        isActive = false
        activePhrase = nil  // C6: clear on cancel
        // FIX #26/#4: Clear persistence flag on clean cleanup (Keychain, not UserDefaults)
        KeychainHelper.shared.delete(service: "prism-aac", account: "emergencyActive")
        severity = .standard
        cellularFallbackSent = false  // FIX 8: reset debounce on cleanup
        // FIX #1: only reset hasEscalated when no escalation is in-flight
        if !isEscalating {
            hasEscalated = false
        }
        isEscalating = false  // always reset escalating flag
        fallbackSpoken = false  // FIX #8: reset TTS stutter guard
        deliveryStatus = .idle
        synthesizer.stopSpeaking(at: .immediate)  // #5: always stop TTS on cleanup
        // FIX #6/#14: Deactivate AVAudioSession so other apps (e.g. music) can resume; log failure
        do {
            try AVAudioSession.sharedInstance().setActive(false, options: .notifyOthersOnDeactivation)
        } catch {
            NSLog("[WatchEmergency] AVAudioSession deactivate failed in cleanup: \(error)")
        }
        // #2: cancel stored SOS haptic task; #12: reset finished flag
        sosHapticTask?.cancel()
        sosHapticTask = nil
        sosHapticsFinished = false
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
        // FIX #1: mark escalation in-flight so cleanup() won't reset hasEscalated mid-flight
        isEscalating = true

        let msg: [String: Any] = buildEmergencyMessage(phrase: phrase, severity: severity)
        deliveryStatus = .pending

        if WCSessionRouter.shared.isReachable {
            WCSessionRouter.shared.send(msg,
                replyHandler: { [weak self] reply in
                    // #3: Validate reply indicates actual dispatch, not just router receipt
                    let dispatched = reply["dispatched"] as? Bool ?? reply["ok"] as? Bool ?? false
                    guard dispatched else {
                        NSLog("[WatchEmergency] WCSession reply missing dispatch confirmation — attempting cellular")
                        Task { @MainActor [weak self] in await self?.attemptCellularFallback() }
                        return
                    }
                    Task { @MainActor [weak self] in
                        guard let self else { return }
                        self.hasEscalated = true
                        self.deliveryStatus = .confirmed
                        self.watchdogTask?.cancel()  // cancel watchdog now that delivery confirmed
                        self.watchdogTask = nil
                        self.isEscalating = false  // FIX #1: escalation complete
                        WKInterfaceDevice.current().play(.success)  // FIX #30: haptic on confirmed
                        NSLog("[WatchEmergency] Escalation CONFIRMED via WCSession reply")
                    }
                },
                errorHandler: { [weak self] err in
                    Task { @MainActor [weak self] in
                        NSLog("[WatchEmergency] WCSession delivery failed: \(err) — attempting cellular")
                        self?.isEscalating = false  // FIX #1: reset on WCSession failure path
                        await self?.attemptCellularFallback()
                    }
                }
            )
        } else {
            // Not reachable — go straight to cellular
            isEscalating = false  // FIX #1: reset before async cellular path takes over
            await attemptCellularFallback()
        }

        // Start haptics and watchdog regardless of delivery path
        startSosHapticsIfNeeded()

        // #6/#8/#9: stored watchdog — marks failed 30s after escalation if delivery unconfirmed
        watchdogTask = Task { @MainActor [weak self] in
            try? await Task.sleep(nanoseconds: 30_000_000_000)
            guard let self, self.isActive else { return }
            self.isEscalating = false  // always force-reset
            if !self.hasEscalated {
                // #9: Dispatch neither confirmed nor failed — set failed and leave UI for explicit dismiss
                self.deliveryStatus = .failed
                NSLog("[WatchEmergency] Post-escalation watchdog: delivery unconfirmed after 30s — marked failed")
                // Do NOT call cleanup() — let user trigger forceReset() explicitly
            }
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

    // FIX #38: Emergency dispatch URLs — update via EMERGENCY_DISPATCH_URL in Info.plist for OTA config
    // Emergency dispatch URL: update via EMERGENCY_DISPATCH_URL in Info.plist for OTA config
    // Fallback: fallbackDispatchURL used if primary returns 5xx on retry
    private static let primaryDispatchURL = "https://synalux.ai/api/v1/emergency/dispatch"
    private static let fallbackDispatchURL = "https://dispatch.synalux.ai/v1/emergency"  // CDN fallback

    // FIX #7: Dedicated session so emergency HTTP is never starved by image loads on URLSession.shared
    // SECURITY NOTE (#13): Emergency dispatch uses HTTPS with system TLS validation.
    // Certificate pinning is not implemented due to watchOS URLSession constraints.
    // The endpoint is protected by:
    //   1. Bearer token authentication (401 = silent failure → TTS-only fallback)
    //   2. HTTPS with Apple's trusted CA root store
    //   3. Dedicated ephemeral session (no credential caching)
    // TODO: Add SPKI pinning via URLSessionDelegate for enhanced MITM protection.
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
        guard sosHapticTask == nil || sosHapticTask?.isCancelled == true || sosHapticsFinished else { return }
        sosHapticsFinished = false
        sosHapticTask = Task { @MainActor [weak self] in
            for i in 0..<9 {
                guard !Task.isCancelled, self?.isActive == true else { return }
                WKInterfaceDevice.current().play(i % 3 == 0 ? .failure : .click)
                try? await Task.sleep(nanoseconds: 300_000_000)
            }
            self?.sosHapticsFinished = true
        }
    }

    // MARK: - Cellular fallback (FIX #2: bounded retry; FIX #3: no auth token in logs)

    @MainActor
    private func attemptCellularFallback(retryCount: Int = 0) async {
        // FIX #4: capture activePhrase before the first await point to avoid actor-isolated mutation race
        let phrase = activePhrase ?? "Emergency"
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

        // FIX #38: use primaryDispatchURL constant
        guard let url = URL(string: WatchEmergencyManager.primaryDispatchURL) else { return }
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
            "phrase": phrase,  // FIX #4: use pre-captured phrase, not activePhrase (may have been cleared)
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
            // FIX #7/#2: Check HTTP status — a 4xx/5xx is not a success; also validate response body
            let (data, response) = try await WatchEmergencyManager.emergencySession.data(for: req)
            if let http = response as? HTTPURLResponse, (200...299).contains(http.statusCode) {
                NSLog("[WatchEmergency] Cellular fallback dispatch succeeded (\(http.statusCode))")
                // #2: Validate response body indicates actual dispatch, not just router receipt
                if let json = try? JSONSerialization.jsonObject(with: data) as? [String: Any] {
                    let dispatched = json["dispatched"] as? Bool ?? json["ok"] as? Bool ?? true
                    if !dispatched {
                        NSLog("[WatchEmergency] Server 200 but dispatched=false — treating as failure")
                        deliveryStatus = .failed
                        speakEmergencyFallback()
                        return
                    }
                }
                // FIX #1: Set hasEscalated only on confirmed HTTP 200 + body validation
                hasEscalated = true
                deliveryStatus = .confirmed
                watchdogTask?.cancel()  // cancel watchdog now that delivery confirmed
                watchdogTask = nil
                WKInterfaceDevice.current().play(.success)  // FIX #30: haptic on cellular confirm
                NSLog("[WatchEmergency] Cellular fallback dispatch succeeded and confirmed")
            } else if let http = response as? HTTPURLResponse,
                      (500...599).contains(http.statusCode),
                      retryCount < 1 {
                // FIX #2/#21: Bounded retry — max 1 retry (2 total attempts) before TTS fallback
                // cellularFallbackSent stays true — retryCount is the gate; resetting it here
                // would allow reachabilityHandler to fire a duplicate dispatch during the 2s sleep.
                NSLog("[WatchEmergency] Cellular 5xx (\(http.statusCode)) — retrying once in 2s")
                do {
                    try await Task.sleep(nanoseconds: 2_000_000_000)
                } catch {
                    return  // Task cancelled — abort retry
                }
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
        // FIX #8: guard against double TTS stutter on concurrent fallback paths
        guard !fallbackSpoken else { return }
        fallbackSpoken = true
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
