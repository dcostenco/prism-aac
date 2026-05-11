import Foundation
import Security
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
        let langCode = String(language.prefix(2))
        let system = "You are a friendly helper for a child who uses AAC. Reply in \(language) language. Keep answers short (2-3 sentences max)."
        var req = URLRequest(url: cloudURL, timeoutInterval: timeoutSec)
        req.httpMethod = "POST"
        req.setValue("application/json", forHTTPHeaderField: "Content-Type")
        // H20: Attach stored auth token from Keychain
        if let authToken = KeychainHelper.shared.read(service: "prism-aac", account: "auth-token") {
            req.setValue("Bearer \(authToken)", forHTTPHeaderField: "Authorization")
        } else {
            NSLog("[WatchAI] No auth token found — cloud request may fail")
        }
        req.httpBody = try JSONSerialization.data(withJSONObject: [
            "messages": [
                ["role": "system", "content": system],
                ["role": "user",   "content": question],
            ],
            "language": langCode,
        ])
        let (data, _) = try await URLSession.shared.data(for: req)
        guard data.count <= 65_536 else {
            NSLog("[WatchAI] Response too large (\(data.count) bytes) — ignoring")
            throw URLError(.dataLengthExceededMaximum)
        }
        // Endpoint returns SSE — assemble all content chunks
        return assembleSSE(data) ?? ""
    }

    private func assembleSSE(_ data: Data) -> String? {
        guard let raw = String(data: data, encoding: .utf8) else { return nil }
        var result = ""
        for line in raw.components(separatedBy: "\n") {
            guard line.hasPrefix("data: ") else { continue }
            let payload = String(line.dropFirst(6))
            if payload == "[DONE]" { break }
            guard let d = payload.data(using: .utf8),
                  let obj = try? JSONSerialization.jsonObject(with: d) as? [String: Any],
                  let choices = obj["choices"] as? [[String: Any]],
                  let delta = choices.first?["delta"] as? [String: Any],
                  let chunk = delta["content"] as? String else { continue }
            result += chunk
        }
        let trimmed = result.trimmingCharacters(in: .whitespacesAndNewlines)
        return trimmed.isEmpty ? nil : trimmed
    }

    /// Ask AI and return the reply string (for inline use by WatchAIChatView).
    func askAI(_ question: String, lang: String = "en-US") async -> String? {
        await ask(question, language: lang)
        return reply.isEmpty ? nil : reply
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

// MARK: - Keychain helper (H20)

private class KeychainHelper {
    static let shared = KeychainHelper()
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

// MARK: - Watch-local Layer 1 safety

struct WatchSafetyFilter {
    enum Result { case safe, crisis(response: String), medical(response: String) }

    private static let crisisKeywords: [String] = [
        "help me", "can't breathe", "cant breathe", "call 911", "emergency",
        "heart attack", "i'm dying", "im dying", "not breathing", "choking",
        "kill myself", "hurt myself",
    ]
    private static let medicalKeywords: [String] = [
        "how many mg", "how many pills", "medication dose", "overdose amount",
    ]

    // Word-boundary regex patterns — prevents false positives from substrings
    // (e.g. "emergencies" should match "emergency"; partial word inside larger
    // word should not suppress a false match). Mirrors SafetyFilter.swift.
    private static let crisisPatterns: [NSRegularExpression] = crisisKeywords.compactMap { keyword in
        let pattern = "(?:^|[^\\p{L}\\p{N}])\(NSRegularExpression.escapedPattern(for: keyword))(?:$|[^\\p{L}\\p{N}])"
        return try? NSRegularExpression(pattern: pattern, options: [.caseInsensitive])
    }
    private static let medicalPatterns: [NSRegularExpression] = medicalKeywords.compactMap { keyword in
        let pattern = "(?:^|[^\\p{L}\\p{N}])\(NSRegularExpression.escapedPattern(for: keyword))(?:$|[^\\p{L}\\p{N}])"
        return try? NSRegularExpression(pattern: pattern, options: [.caseInsensitive])
    }

    static func check(_ input: String) -> Result {
        let lower = input.lowercased()
        let range = NSRange(lower.startIndex..., in: lower)
        for regex in Self.crisisPatterns {
            if regex.firstMatch(in: lower, range: range) != nil {
                return .crisis(response: "🆘 Call 911 · Text 988 (US crisis line)\nI'm with you.")
            }
        }
        for regex in Self.medicalPatterns {
            if regex.firstMatch(in: lower, range: range) != nil {
                return .medical(response: "Ask your doctor or pharmacist for dosing questions.")
            }
        }
        return .safe
    }
}
