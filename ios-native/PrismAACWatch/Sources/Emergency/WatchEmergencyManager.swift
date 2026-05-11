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
    @Published private(set) var countdownText = "5"
    @Published private(set) var severity: EmergencySeverity = .standard
    @Published private(set) var countdownSecs = 5

    private var countdownTimer: Timer?
    private let synthesizer = AVSpeechSynthesizer()
    // C6: track in-progress emergency phrase for cellular fallback
    private var activePhrase: String?
    // FIX 8: debounce guard — prevents duplicate cellular fallback on reachability flap
    private var cellularFallbackSent = false

    override init() {
        super.init()
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
        guard !isActive else { return }  // FIX 4: mutex — no duplicate triggers
        isActive = true
        activePhrase = String(phrase.prefix(200))
        self.severity = severity
        countdownSecs = 5
        countdownText = "5"
        cellularFallbackSent = false

        let deadline = Date().addingTimeInterval(5)  // absolute deadline

        // Request background task so process is not suspended
        let bgTask = WKApplication.shared().beginBackgroundTask(withName: "emergency-countdown") {
            // Expiry: fire immediately
            Task { @MainActor [weak self] in await self?.escalate(phrase: phrase, severity: severity) }
        }

        // Schedule on .common mode so timer fires during touch tracking
        let timer = Timer(timeInterval: 1, repeats: true) { [weak self] t in
            Task { @MainActor [weak self] in
                guard let self else { t.invalidate(); return }
                // Use absolute deadline, not tick count — immune to background freeze
                let remaining = max(0, Int(deadline.timeIntervalSinceNow.rounded(.up)))
                self.countdownSecs = remaining
                self.countdownText = "\(remaining)"
                if Date() >= deadline {
                    t.invalidate()
                    WKApplication.shared().endBackgroundTask(bgTask)
                    await self.escalate(phrase: phrase, severity: severity)
                }
            }
        }
        RunLoop.main.add(timer, forMode: .common)
        countdownTimer = timer

        // Immediate haptic + audio — no network needed
        playSosHaptics()
        synthesizer.speak(AVSpeechUtterance(string: "Help! Emergency!"))
    }

    // FIX 5: Severity guard on cancel — critical emergencies cannot be cancelled
    func cancel() {
        guard severity != .critical else {
            NSLog("[WatchEmergency] Critical emergency cannot be cancelled")
            return
        }
        cleanup()
    }

    private func cleanup() {
        countdownTimer?.invalidate()
        countdownTimer = nil
        isActive = false
        activePhrase = nil  // C6: clear on cancel
        severity = .standard
        cellularFallbackSent = false  // FIX 8: reset debounce on cleanup
        synthesizer.stopSpeaking(at: .immediate)
    }

    // MARK: - Escalation

    private func escalate(phrase: String, severity: EmergencySeverity) async {
        sendPhrase(phrase, isEmergency: true, severity: severity)
        // Haptic — SOS pattern (3 short, 3 long, 3 short)
        for i in 0..<9 {
            DispatchQueue.main.asyncAfter(deadline: .now() + Double(i) * 0.3) { [weak self] in
                guard self?.isActive == true else { return }
                WKInterfaceDevice.current().play(i % 3 == 0 ? .failure : .click)
            }
        }
    }

    func sendPhrase(_ phrase: String, isEmergency: Bool = false, severity: EmergencySeverity = .urgent) {
        let msg: [String: Any] = [
            "type": isEmergency ? "emergency" : "phrase",
            "phrase": phrase,
            "severity": severity == .critical ? "critical" : severity == .urgent ? "urgent" : severity == .medical ? "medical" : "standard",
            "timestamp": ISO8601DateFormatter().string(from: Date()),
        ]

        if WCSession.isSupported() && WCSession.default.isReachable {
            WCSession.default.sendMessage(msg, replyHandler: nil, errorHandler: { _ in
                WCSession.default.transferUserInfo(msg)
            })
        } else {
            // Queue for delivery when iPhone wakes
            WCSession.default.transferUserInfo(msg)
        }
    }

    // MARK: - SOS haptics

    private func playSosHaptics() {
        WKInterfaceDevice.current().play(.notification)
    }

    // MARK: - Cellular fallback (FIX 7: HTTP status check; FIX 8: debounce)

    @MainActor
    private func attemptCellularFallback() async {
        // FIX 8: debounce — only one fallback attempt per emergency session
        guard !cellularFallbackSent else { return }
        cellularFallbackSent = true

        guard let url = URL(string: "https://synalux.ai/api/v1/emergency/dispatch") else { return }
        var req = URLRequest(url: url)
        req.httpMethod = "POST"
        req.timeoutInterval = 10
        req.setValue("application/json", forHTTPHeaderField: "Content-Type")
        // Attach auth token from Keychain using the same pattern as WatchAISession.swift
        if let token = WatchEmergencyKeychainHelper.shared.read(service: "prism-aac", account: "auth-token") {
            req.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
        } else {
            NSLog("[WatchEmergency] No auth token — cellular fallback will be unauthenticated")
        }
        let payload: [String: Any] = [
            "phrase": activePhrase ?? "Emergency",
            "severity": "watch_cellular_fallback",
            "source": "watchos",
        ]
        guard let body = try? JSONSerialization.data(withJSONObject: payload) else {
            NSLog("[WatchEmergency] JSON serialization failed — using TTS fallback")
            speakEmergencyFallback()
            return
        }
        req.httpBody = body
        do {
            // FIX 7: Check HTTP status — a 4xx/5xx is not a success
            let (_, response) = try await URLSession.shared.data(for: req)
            if let http = response as? HTTPURLResponse, (200...299).contains(http.statusCode) {
                NSLog("[WatchEmergency] Cellular fallback dispatch succeeded (\(http.statusCode))")
            } else {
                NSLog("[WatchEmergency] Cellular fallback returned error status — using TTS fallback")
                speakEmergencyFallback()
            }
        } catch {
            NSLog("[WatchEmergency] Cellular fallback failed: \(error)")
            speakEmergencyFallback()
        }
    }

    private func speakEmergencyFallback() {
        let utterance = AVSpeechUtterance(string: "Emergency. Please call 911.")
        utterance.volume = 1.0
        utterance.rate = 0.4
        synthesizer.speak(utterance)
    }
}

// MARK: - Keychain helper (mirrors WatchAISession.KeychainHelper, private to this file)
// FIX 6: kSecAttrAccessibleAfterFirstUnlockThisDeviceOnly — readable in background after first unlock

private class WatchEmergencyKeychainHelper {
    static let shared = WatchEmergencyKeychainHelper()
    func read(service: String, account: String) -> String? {
        let query: [String: Any] = [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrService as String: service,
            kSecAttrAccount as String: account,
            kSecAttrAccessible as String: kSecAttrAccessibleAfterFirstUnlockThisDeviceOnly,
            kSecReturnData as String: true,
            kSecMatchLimit as String: kSecMatchLimitOne,
        ]
        var result: AnyObject?
        guard SecItemCopyMatching(query as CFDictionary, &result) == errSecSuccess,
              let data = result as? Data else { return nil }
        return String(data: data, encoding: .utf8)
    }
}
