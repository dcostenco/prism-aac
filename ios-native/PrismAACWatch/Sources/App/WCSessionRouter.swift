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
        // #6: Cap handler arrays — prevent unbounded growth from repeated registrations
        guard (messageHandlers[type]?.count ?? 0) < 8 else {
            NSLog("[WCRouter] Max handlers reached for type '\(type)'")
            return
        }
        messageHandlers[type, default: []].append(handler)
    }

    /// Register a handler for reachability changes.
    func registerReachabilityHandler(_ handler: @escaping (Bool) -> Void) {
        guard reachabilityHandlers.count < 8 else {
            NSLog("[WCRouter] Max reachability handlers reached")
            return
        }
        reachabilityHandlers.append(handler)
    }

    /// Whether the paired iPhone is immediately reachable via Bluetooth.
    var isReachable: Bool { WCSession.isSupported() && WCSession.default.isReachable }

    /// Send a message via WCSession (convenience wrapper).
    func send(_ message: [String: Any], replyHandler: (([String: Any]) -> Void)? = nil, errorHandler: ((Error) -> Void)? = nil) {
        guard WCSession.default.isReachable else {
            guard WCSession.default.activationState == .activated else {
                NSLog("[WCRouter] Session not activated")
                // #7: Using URLError(.networkConnectionLost) as a proxy for WC session errors
                // Callers should not rely on specific URLError codes from this router
                errorHandler?(URLError(.networkConnectionLost))
                return
            }
            if replyHandler != nil {
                // #4: Reply-dependent messages cannot be queued via transferUserInfo
                // (reply would arrive long after the caller has timed out)
                NSLog("[WCRouter] Phone unreachable — dropping reply-required message: \(message["type"] as? String ?? "?")")
                errorHandler?(URLError(.networkConnectionLost))
            } else {
                // Fire-and-forget messages can be queued via transferUserInfo — NOT an error
                WCSession.default.transferUserInfo(message)
                NSLog("[WCRouter] Message queued via transferUserInfo for later delivery: \(message["type"] as? String ?? "?")")
                // #6: Do NOT call errorHandler here — message is queued, not failed
            }
            return
        }
        WCSession.default.sendMessage(message, replyHandler: replyHandler) { error in
            NSLog("[WCRouter] sendMessage failed: \(error)")
            let msg = message  // already captured by value
            Task { @MainActor in
                WCSession.default.transferUserInfo(msg)
                if replyHandler != nil {
                    errorHandler?(error)
                }
            }
            // No reply expected → message queued, not an error
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

    // #11: replyHandler called explicitly — defer hid the case where self is nil,
    // causing replyHandler to fire with ["ok": true] even when no handlers ran.
    nonisolated func session(_ session: WCSession, didReceiveMessage message: [String: Any], replyHandler: @escaping ([String: Any]) -> Void) {
        guard let type = message["type"] as? String else { replyHandler(["error": "no type"]); return }
        Task { @MainActor [weak self] in
            guard let self else {
                replyHandler(["error": "router deallocated"])
                return
            }
            self.messageHandlers[type]?.forEach { $0(type, message) }
            replyHandler(["ok": true, "handlers": self.messageHandlers[type]?.count ?? 0])
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
