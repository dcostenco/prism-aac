import Foundation
import WatchConnectivity

/// Manages AI requests from the Watch.
/// Tries WatchConnectivity first (iPhone 1.5B), falls back to cloud URLSession.
@MainActor
final class WatchAISession: NSObject, ObservableObject, WCSessionDelegate {

    @Published private(set) var reply = ""
    @Published private(set) var isThinking = false
    @Published private(set) var mode: Mode = .unknown
    @Published private(set) var offlineBanner: String? = nil

    enum Mode {
        case unknown
        case companion   // BT → iPhone → 1.5B on-device
        case cloudDirect // Watch WiFi/LTE → synalux.ai
        case offline     // no network, no BT — phrases + Layer 1 only
    }

    private let cloudURL = URL(string: "https://synalux.ai/api/v1/prism-aac/chat")!
    private let timeoutSec: Double = 10

    // MARK: - Init / WatchConnectivity

    override init() {
        super.init()
        if WCSession.isSupported() {
            WCSession.default.delegate = self
            WCSession.default.activate()
        }
        updateMode()
    }

    private func updateMode() {
        let reachable = WCSession.isSupported() && WCSession.default.isReachable
        if reachable {
            mode = .companion
            offlineBanner = nil
        } else {
            // URLSession will succeed if Watch has WiFi or LTE
            mode = .cloudDirect
            offlineBanner = nil
        }
    }

    // MARK: - Ask AI

    func ask(_ question: String, language: String = "en") async {
        // Layer 1 safety — always synchronous, no network needed
        switch WatchSafetyFilter.check(question) {
        case .crisis(let r):
            reply = r
            return
        case .medical(let r):
            reply = r
            return
        case .safe:
            break
        }

        isThinking = true
        reply = ""
        defer { isThinking = false }

        do {
            if mode == .companion && WCSession.default.isReachable {
                reply = try await askViaPhone(question: question, language: language)
            } else {
                reply = try await askViaCloud(question: question, language: language)
                mode = .cloudDirect
            }
        } catch {
            // Full offline fallback
            mode = .offline
            offlineBanner = "No connection — using offline phrases only"
            reply = "I'm offline right now. Use the phrase buttons below."
        }
    }

    // MARK: - Companion path (BT → iPhone)

    private func askViaPhone(question: String, language: String) async throws -> String {
        try await withCheckedThrowingContinuation { cont in
            let msg: [String: Any] = [
                "type": "ai_ask",
                "question": question,
                "language": language,
            ]
            WCSession.default.sendMessage(msg, replyHandler: { reply in
                Task { @MainActor in
                    cont.resume(returning: reply["text"] as? String ?? "")
                }
            }, errorHandler: { err in
                cont.resume(throwing: err)
            })
        }
    }

    // MARK: - Direct cloud path (Watch WiFi/LTE)

    private func askViaCloud(question: String, language: String) async throws -> String {
        var req = URLRequest(url: cloudURL, timeoutInterval: timeoutSec)
        req.httpMethod = "POST"
        req.setValue("application/json", forHTTPHeaderField: "Content-Type")
        req.httpBody = try JSONSerialization.data(withJSONObject: [
            "message": question,
            "language": language,
            "mode": "aac",
            "source": "watch",
        ])
        let (data, _) = try await URLSession.shared.data(for: req)
        let obj = try JSONSerialization.jsonObject(with: data) as? [String: Any]
        return obj?["reply"] as? String ?? ""
    }

    /// Send a phrase to iPhone for richer TTS / logging (non-blocking).
    func sendPhrase(_ phrase: String) {
        guard WCSession.isSupported() && WCSession.default.isReachable else { return }
        WCSession.default.sendMessage(["type": "phrase", "text": phrase], replyHandler: nil, errorHandler: nil)
    }

    // MARK: - WCSessionDelegate

    nonisolated func session(_ session: WCSession, activationDidCompleteWith state: WCSessionActivationState, error: Error?) {
        Task { @MainActor in self.updateMode() }
    }

    nonisolated func sessionReachabilityDidChange(_ session: WCSession) {
        Task { @MainActor in self.updateMode() }
    }

    // Handle messages pushed from iPhone (e.g. phrase spoken on iPhone appears on Watch)
    nonisolated func session(_ session: WCSession, didReceiveMessage message: [String: Any]) {
        if let text = message["tts_text"] as? String {
            Task { @MainActor in
                self.reply = text
            }
        }
    }
}

// MARK: - Watch-local Layer 1 safety

struct WatchSafetyFilter {
    enum Result { case safe, crisis(response: String), medical(response: String) }

    private static let crisis: Set<String> = [
        "help me", "can't breathe", "cant breathe", "call 911", "emergency",
        "heart attack", "i'm dying", "im dying", "not breathing", "choking",
        "kill myself", "hurt myself",
    ]
    private static let medical: Set<String> = [
        "how many mg", "how many pills", "medication dose", "overdose amount",
    ]

    static func check(_ input: String) -> Result {
        let lower = input.lowercased()
        if crisis.first(where: { lower.contains($0) }) != nil {
            return .crisis(response: "🆘 Call 911 · Text 988 (US crisis line)\nI'm with you.")
        }
        if medical.first(where: { lower.contains($0) }) != nil {
            return .medical(response: "Ask your doctor or pharmacist for dosing questions.")
        }
        return .safe
    }
}
