import Foundation
import WatchConnectivity

/// Single WCSession delegate that dispatches to all registered handlers.
/// REQUIRED: Four classes (WatchAISession, WatchEmergencyManager, WatchVocabSync, WatchInbox)
/// were all setting WCSession.default.delegate = self, which means only the LAST one
/// received any callbacks. This router fixes that by being the sole delegate and
/// fan-out dispatching to all registered listeners.
@MainActor
final class WCSessionRouter: NSObject, ObservableObject {
    static let shared = WCSessionRouter()

    private var messageHandlers: [String: [(String, [String: Any]) -> Void]] = [:]
    private var reachabilityHandlers: [(Bool) -> Void] = []

    private override init() {
        super.init()
        if WCSession.isSupported() {
            WCSession.default.delegate = self
            WCSession.default.activate()
        }
    }

    /// Register a handler for a specific message type key.
    func registerMessageHandler(for type: String, handler: @escaping (String, [String: Any]) -> Void) {
        messageHandlers[type, default: []].append(handler)
    }

    /// Register a handler for reachability changes.
    func registerReachabilityHandler(_ handler: @escaping (Bool) -> Void) {
        reachabilityHandlers.append(handler)
    }

    /// Send a message via WCSession (convenience wrapper).
    func send(_ message: [String: Any], replyHandler: (([String: Any]) -> Void)? = nil, errorHandler: ((Error) -> Void)? = nil) {
        guard WCSession.default.isReachable else {
            WCSession.default.transferUserInfo(message)
            return
        }
        WCSession.default.sendMessage(message, replyHandler: replyHandler) { error in
            NSLog("[WCRouter] sendMessage failed, queuing via transferUserInfo: \(error)")
            WCSession.default.transferUserInfo(message)
            errorHandler?(error)
        }
    }
}

extension WCSessionRouter: WCSessionDelegate {
    nonisolated func session(_ session: WCSession, activationDidCompleteWith activationState: WCSessionActivationState, error: Error?) {
        if let error = error { NSLog("[WCRouter] Activation error: \(error)") }
    }

    nonisolated func session(_ session: WCSession, didReceiveMessage message: [String: Any]) {
        guard let type = message["type"] as? String else { return }
        Task { @MainActor [weak self] in
            self?.messageHandlers[type]?.forEach { $0(type, message) }
        }
    }

    nonisolated func session(_ session: WCSession, didReceiveMessage message: [String: Any], replyHandler: @escaping ([String: Any]) -> Void) {
        guard let type = message["type"] as? String else { replyHandler(["error": "no type"]); return }
        Task { @MainActor [weak self] in
            self?.messageHandlers[type]?.forEach { $0(type, message) }
            replyHandler(["ok": true])  // ← inside Task, after handlers run
        }
    }

    nonisolated func session(_ session: WCSession, didReceiveUserInfo userInfo: [String: Any] = [:]) {
        guard let type = userInfo["type"] as? String else { return }
        Task { @MainActor [weak self] in
            self?.messageHandlers[type]?.forEach { $0(type, userInfo) }
        }
    }

    nonisolated func sessionReachabilityDidChange(_ session: WCSession) {
        let reachable = session.isReachable
        Task { @MainActor [weak self] in
            self?.reachabilityHandlers.forEach { $0(reachable) }
        }
    }
}
