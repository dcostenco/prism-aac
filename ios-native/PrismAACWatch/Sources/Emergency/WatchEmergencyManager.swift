import Foundation
import WatchConnectivity
import AVFoundation

enum EmergencySeverity { case critical, urgent, medical }

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
            "severity": severity == .critical ? "critical" : severity == .urgent ? "urgent" : "medical",
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
    nonisolated func sessionReachabilityDidChange(_ session: WCSession) {}
}
