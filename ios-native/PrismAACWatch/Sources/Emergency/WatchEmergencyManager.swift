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
final class WatchEmergencyManager: NSObject, ObservableObject, WCSessionDelegate {

    @Published private(set) var isActive = false
    @Published private(set) var countdownText = "5"

    private var countdownTimer: Timer?
    private var countdownSecs = 5
    private let synthesizer = AVSpeechSynthesizer()
    // C6: track in-progress emergency phrase for cellular fallback
    private var activePhrase: String?

    override init() {
        super.init()
        if WCSession.isSupported() {
            WCSession.default.delegate = self
            WCSession.default.activate()
        }
    }

    // MARK: - Trigger

    func trigger(phrase: String, severity: EmergencySeverity = .critical) {
        isActive = true
        activePhrase = phrase  // C6: store for cellular fallback
        countdownSecs = 5
        countdownText = "5"

        // Immediate haptic + audio — no network needed
        WKInterfaceDevice.current().play(.notification)
        synthesizer.speak(AVSpeechUtterance(string: "Help! Emergency!"))

        // Countdown then full escalation
        countdownTimer = Timer.scheduledTimer(withTimeInterval: 1, repeats: true) { [weak self] timer in
            Task { @MainActor [weak self] in
                guard let self else { timer.invalidate(); return }
                self.countdownSecs -= 1
                self.countdownText = "\(max(0, self.countdownSecs))"
                if self.countdownSecs <= 0 {
                    timer.invalidate()
                    self.escalate(phrase: phrase, severity: severity)
                }
            }
        }
    }

    func cancel() {
        countdownTimer?.invalidate()
        countdownTimer = nil
        isActive = false
        activePhrase = nil  // C6: clear on cancel
        synthesizer.stopSpeaking(at: .immediate)
    }

    // MARK: - Escalation

    private func escalate(phrase: String, severity: EmergencySeverity) {
        sendPhrase(phrase, isEmergency: true, severity: severity)
        // Haptic — SOS pattern (3 short, 3 long, 3 short)
        for i in 0..<9 {
            DispatchQueue.main.asyncAfter(deadline: .now() + Double(i) * 0.3) {
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

    // MARK: - WCSessionDelegate

    nonisolated func session(_ session: WCSession, activationDidCompleteWith state: WCSessionActivationState, error: Error?) {}

    // C6: Detect iPhone becoming unreachable during active emergency and attempt cellular fallback
    nonisolated func sessionReachabilityDidChange(_ session: WCSession) {
        guard !session.isReachable else { return }
        Task { @MainActor in
            guard self.isActive else { return }
            NSLog("[WatchEmergency] iPhone unreachable during emergency — attempting cellular dispatch")
            await self.attemptCellularFallback()
        }
    }

    @MainActor
    private func attemptCellularFallback() async {
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
            _ = try await URLSession.shared.data(for: req)
            NSLog("[WatchEmergency] Cellular fallback dispatch succeeded")
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

private class WatchEmergencyKeychainHelper {
    static let shared = WatchEmergencyKeychainHelper()
    func read(service: String, account: String) -> String? {
        let query: [String: Any] = [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrService as String: service,
            kSecAttrAccount as String: account,
            kSecReturnData as String: true,
        ]
        var result: AnyObject?
        guard SecItemCopyMatching(query as CFDictionary, &result) == errSecSuccess,
              let data = result as? Data else { return nil }
        return String(data: data, encoding: .utf8)
    }
}
