import Foundation
import Security
import WatchConnectivity
import UserNotifications

/// Incoming message inbox for the Watch.
///
/// Messages arrive from two paths:
///   1. WatchConnectivity — iPhone forwards inbox_message when phone receives SMS/email/chat
///   2. Local test injection (dev only) via injectTestMessage()
///
/// Persists unread messages in Keychain (migrates legacy UserDefaults entries on first load).
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

    // Legacy UserDefaults key — used only for migration path in loadFromDefaults()
    private let storageKey = "watchInboxMessages"

    // F4b: Keychain coordinates for message storage
    private let keychainService = "prism-aac-inbox"
    private let keychainAccount = "messages"

    override init() {
        super.init()
        messages = loadFromDefaults()
        recalcUnread()
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
    /// F4a: routes through WCSessionRouter (no direct WCSession bypass, no nil errorHandler)
    func reply(to msg: WatchMessage, text: String) {
        WCSessionRouter.shared.send(
            ["type": "inbox_reply",
             "sender": String(msg.sender.prefix(100)),
             "provider": String(msg.provider.prefix(20)),
             "text": String(text.prefix(500))],
            errorHandler: { err in NSLog("[WatchInbox] Reply failed: \(err)") }
        )
    }

    // MARK: - Incoming message delivery

    private func deliverFromMessage(_ message: [String: Any]) {
        // F4c: length caps on all string fields immediately after extraction
        guard let rawSender = message["sender"] as? String,
              let rawText   = message["text"]   as? String else { return }
        let sender   = String(rawSender.prefix(100))
        let text     = String(rawText.prefix(500))
        let id       = String((message["id"]       as? String ?? UUID().uuidString).prefix(36))
        let provider = String((message["provider"] as? String ?? "sms").prefix(20))
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

    // MARK: - Persistence (F4b: Keychain-backed; F4d: do/catch with logging)

    private func saveToDefaults() {
        do {
            let data = try JSONEncoder().encode(messages)
            // Store in Keychain
            let addQuery: [String: Any] = [
                kSecClass as String:              kSecClassGenericPassword,
                kSecAttrService as String:        keychainService,
                kSecAttrAccount as String:        keychainAccount,
                kSecAttrAccessible as String:     kSecAttrAccessibleAfterFirstUnlockThisDeviceOnly,
                kSecAttrSynchronizable as String: false,
                kSecValueData as String:          data,
            ]
            SecItemDelete(addQuery as CFDictionary)
            SecItemAdd(addQuery as CFDictionary, nil)
            // Remove any legacy UserDefaults entry
            UserDefaults.standard.removeObject(forKey: storageKey)
        } catch {
            NSLog("[WatchInbox] saveToDefaults failed: \(error)")
        }
    }

    private func loadFromDefaults() -> [WatchMessage] {
        let query: [String: Any] = [
            kSecClass as String:              kSecClassGenericPassword,
            kSecAttrService as String:        keychainService,
            kSecAttrAccount as String:        keychainAccount,
            kSecAttrAccessible as String:     kSecAttrAccessibleAfterFirstUnlockThisDeviceOnly,
            kSecAttrSynchronizable as String: false,
            kSecReturnData as String:         true,
            kSecMatchLimit as String:         kSecMatchLimitOne,
        ]
        var result: AnyObject?
        if SecItemCopyMatching(query as CFDictionary, &result) == errSecSuccess,
           let data = result as? Data,
           let msgs = try? JSONDecoder().decode([WatchMessage].self, from: data) {
            return msgs
        }
        // Migration from UserDefaults
        if let data = UserDefaults.standard.data(forKey: storageKey),
           let msgs = try? JSONDecoder().decode([WatchMessage].self, from: data) {
            // Migrate to Keychain
            messages = msgs
            saveToDefaults()
            return msgs
        }
        return []
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
