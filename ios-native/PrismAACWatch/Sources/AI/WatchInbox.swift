import Foundation
import WatchConnectivity
import UserNotifications

/// Incoming message inbox for the Watch.
///
/// Messages arrive from two paths:
///   1. WatchConnectivity — iPhone forwards inbox_message when phone receives SMS/email/chat
///   2. Local test injection (dev only) via injectTestMessage()
///
/// Persists unread messages in UserDefaults so they survive app restarts.
@MainActor
final class WatchInbox: NSObject, ObservableObject {

    struct WatchMessage: Identifiable, Codable {
        let id: String
        let sender: String
        let text: String
        let provider: String      // "sms", "email", "telegram", etc.
        let receivedAt: Date
        var isRead: Bool = false
    }

    @Published private(set) var messages: [WatchMessage] = []
    @Published private(set) var unreadCount: Int = 0

    private let storageKey = "watchInboxMessages"

    override init() {
        super.init()
        loadFromDefaults()
        // FIX 3: Register with router instead of setting WCSession.default.delegate = self
        WCSessionRouter.shared.registerMessageHandler(for: "inbox_message") { [weak self] _, msg in
            Task { @MainActor in self?.deliverFromMessage(msg) }
        }
        // Permission requested lazily in requestPermissionIfNeeded()
        // — called the first time the user opens the inbox, not on startup.
    }

    /// Call when the user explicitly opens the inbox view.
    func requestPermissionIfNeeded() {
        requestNotificationPermission()
    }

    // MARK: - Public API

    func markRead(_ id: String) {
        guard let i = messages.firstIndex(where: { $0.id == id }) else { return }
        messages[i].isRead = true
        recalcUnread()
        saveToDefaults()
    }

    func markAllRead() {
        for i in messages.indices { messages[i].isRead = true }
        recalcUnread()
        saveToDefaults()
    }

    func deleteMessage(_ id: String) {
        messages.removeAll { $0.id == id }
        recalcUnread()
        saveToDefaults()
    }

    func clearAll() {
        messages.removeAll()
        unreadCount = 0
        saveToDefaults()
    }

    /// Reply to a message by sending text back via iPhone.
    func reply(to msg: WatchMessage, text: String) {
        guard WCSession.isSupported() && WCSession.default.isReachable else { return }
        WCSession.default.sendMessage(
            ["type": "inbox_reply", "sender": msg.sender, "provider": msg.provider, "text": text],
            replyHandler: nil,
            errorHandler: nil
        )
    }

    // MARK: - Incoming message delivery

    private func deliverFromMessage(_ message: [String: Any]) {
        guard let sender   = message["sender"]   as? String,
              let text     = message["text"]     as? String else { return }
        let id       = message["id"]       as? String ?? UUID().uuidString
        let provider = message["provider"] as? String ?? "sms"
        let ts       = message["receivedAt"] as? TimeInterval ?? Date().timeIntervalSince1970
        let msg = WatchMessage(id: id, sender: sender, text: text,
                               provider: provider, receivedAt: Date(timeIntervalSince1970: ts))
        deliver(msg)
    }

    private func deliver(_ msg: WatchMessage) {
        // Deduplicate by id
        guard !messages.contains(where: { $0.id == msg.id }) else { return }
        messages.insert(msg, at: 0)
        // Cap at 50 messages
        if messages.count > 50 { messages = Array(messages.prefix(50)) }
        recalcUnread()
        saveToDefaults()
        scheduleLocalNotification(msg)
    }

    // MARK: - Local notification

    private func requestNotificationPermission() {
        UNUserNotificationCenter.current()
            .requestAuthorization(options: [.alert, .sound, .badge]) { _, _ in }
    }

    private func scheduleLocalNotification(_ msg: WatchMessage) {
        let content = UNMutableNotificationContent()
        content.title = msg.sender
        content.body  = msg.text
        content.sound = .default
        let req = UNNotificationRequest(
            identifier: msg.id,
            content: content,
            trigger: nil       // deliver immediately
        )
        UNUserNotificationCenter.current().add(req, withCompletionHandler: nil)
    }

    // MARK: - Persistence

    private func saveToDefaults() {
        if let data = try? JSONEncoder().encode(messages) {
            UserDefaults.standard.set(data, forKey: storageKey)
        }
    }

    private func loadFromDefaults() {
        guard let data = UserDefaults.standard.data(forKey: storageKey),
              let saved = try? JSONDecoder().decode([WatchMessage].self, from: data) else { return }
        messages = saved
        recalcUnread()
    }

    private func recalcUnread() {
        unreadCount = messages.filter { !$0.isRead }.count
    }

    // MARK: - Dev helpers

    #if DEBUG
    func injectTestMessage(sender: String = "Mom", text: String = "Are you okay?", provider: String = "sms") {
        deliver(WatchMessage(id: UUID().uuidString, sender: sender, text: text,
                             provider: provider, receivedAt: Date()))
    }
    #endif
}
