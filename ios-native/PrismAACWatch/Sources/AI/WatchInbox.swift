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

    struct WatchMessage: Codable, Identifiable {
        let id: String
        let sender: String
        let text: String
        let provider: String      // "sms", "email", "telegram", etc.
        let receivedAt: Date
        var isRead: Bool

        // #29: explicit CodingKeys — schema evolution safe; new fields won't silently discard old messages
        enum CodingKeys: String, CodingKey {
            case id, sender, text, provider, receivedAt, isRead
        }

        init(id: String, sender: String, text: String, provider: String, receivedAt: Date, isRead: Bool = false) {
            self.id = id
            self.sender = sender
            self.text = text
            self.provider = provider
            self.receivedAt = receivedAt
            self.isRead = isRead
        }

        init(from decoder: Decoder) throws {
            let c = try decoder.container(keyedBy: CodingKeys.self)
            id         = try c.decode(String.self, forKey: .id)
            sender     = try c.decode(String.self, forKey: .sender)
            text       = try c.decode(String.self, forKey: .text)
            provider   = try c.decodeIfPresent(String.self, forKey: .provider)   ?? "sms"
            receivedAt = try c.decodeIfPresent(Date.self,   forKey: .receivedAt) ?? Date()
            isRead     = try c.decodeIfPresent(Bool.self,   forKey: .isRead)     ?? false
        }
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
        // #3: persist migrated UserDefaults data to Keychain (migration completes here, not inside loadFromDefaults)
        // #17: async — don't block init with synchronous Keychain write
        if !UserDefaults.standard.bool(forKey: "watchInboxMigrated") &&
           UserDefaults.standard.data(forKey: storageKey) != nil {
            Task { @MainActor [weak self] in self?.persistToKeychain() }
        } else {
            // #9: Always purge any residual UserDefaults PII on every launch after migration is complete.
            // Covers the race window where migration succeeded but a prior launch crashed before
            // removeObject() ran inside persistToKeychain().
            UserDefaults.standard.removeObject(forKey: storageKey)
        }
        // FIX 3: Register with router instead of setting WCSession.default.delegate = self
        WCSessionRouter.shared.registerMessageHandler(for: "inbox_message") { [weak self] _, msg in
            Task { @MainActor [weak self] in self?.deliverFromMessage(msg) }
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
        persistToKeychain()
    }

    func markAllRead() {
        for i in messages.indices { messages[i].isRead = true }
        recalcUnread()
        persistToKeychain()
    }

    func deleteMessage(_ id: String) {
        messages.removeAll { $0.id == id }
        recalcUnread()
        persistToKeychain()
    }

    func clearAll() {
        messages.removeAll()
        unreadCount = 0
        persistToKeychain()
    }

    /// Reply to a message by sending text back via iPhone.
    /// F4a: routes through WCSessionRouter (no direct WCSession bypass, no nil errorHandler)
    func reply(to msg: WatchMessage, text: String) {
        // #29: re-validate provider against allowlist before sending — prevents injection via stored message
        let safeProvider = ["sms", "email", "telegram", "whatsapp", "messenger", "instagram", "viber"]
            .contains(msg.provider) ? msg.provider : "sms"
        WCSessionRouter.shared.send(
            ["type": "inbox_reply",
             "sender": String(msg.sender.prefix(100)),
             "provider": safeProvider,
             "text": String(text.prefix(500))],
            errorHandler: { err in NSLog("[WatchInbox] Reply failed: \(err)") }
        )
    }

    // MARK: - Incoming message delivery

    private func deliverFromMessage(_ message: [String: Any]) {
        // F4c: length caps on all string fields immediately after extraction
        guard let rawSender = message["sender"] as? String,
              let rawText   = message["text"]   as? String else { return }
        let sender: String = {
            let capped = String(rawSender.prefix(100))
            return capped
                .replacingOccurrences(of: "\u{202E}", with: "")  // RLO
                .replacingOccurrences(of: "\u{202D}", with: "")  // LRO
                .replacingOccurrences(of: "\u{202B}", with: "")  // RLE
                .replacingOccurrences(of: "\u{202A}", with: "")  // LRE
                .replacingOccurrences(of: "\u{202C}", with: "")  // PDF
                .replacingOccurrences(of: "\u{200F}", with: "")  // RLM
                .replacingOccurrences(of: "\u{200E}", with: "")  // LRM
                .replacingOccurrences(of: "\u{2066}", with: "")  // LRI
                .replacingOccurrences(of: "\u{2067}", with: "")  // RLI
                .replacingOccurrences(of: "\u{2068}", with: "")  // FSI
                .replacingOccurrences(of: "\u{2069}", with: "")  // PDI
                .replacingOccurrences(of: "\u{200B}", with: "")  // ZWSP
                .replacingOccurrences(of: "\u{200C}", with: "")  // ZWNJ
                .replacingOccurrences(of: "\u{200D}", with: "")  // ZWJ
                .replacingOccurrences(of: "\u{FEFF}", with: "")  // BOM
        }()
        // #25: strip ChatML control tokens from message text before storage and TTS
        let safeText = String(rawText.prefix(500))
            .replacingOccurrences(of: "<|im_start|>", with: "")
            .replacingOccurrences(of: "<|im_end|>", with: "")
            .replacingOccurrences(of: "<|system|>", with: "")
            .replacingOccurrences(of: "[INST]", with: "")
            .replacingOccurrences(of: "[/INST]", with: "")
        // #27: validate id as proper UUID — reject arbitrary injection strings
        let rawId    = message["id"] as? String ?? ""
        let id       = UUID(uuidString: rawId)?.uuidString ?? UUID().uuidString
        // #9: allowlist provider — reject arbitrary strings before storage
        let allowedProviders: Set<String> = ["sms", "email", "telegram", "whatsapp", "messenger", "instagram", "viber"]
        let rawProvider = message["provider"] as? String ?? "sms"
        let provider = allowedProviders.contains(rawProvider) ? rawProvider : "sms"
        // #19: clamp receivedAt — reject timestamps more than 1 year old or more than 1 min in the future
        // #16: explicit Double cast makes the 64-bit arithmetic intent clear
        let now        = Date().timeIntervalSince1970
        let rawTs      = message["receivedAt"] as? TimeInterval ?? now
        let oneYearAgo = now - Double(86_400 * 365)
        let ts         = min(max(rawTs, oneYearAgo), now + 60)
        let msg = WatchMessage(id: id, sender: sender, text: safeText,
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
        persistToKeychain()
        scheduleLocalNotification(msg)
    }

    // MARK: - Local notification

    private func requestNotificationPermission() {
        UNUserNotificationCenter.current()
            .requestAuthorization(options: [.alert, .sound, .badge]) { granted, error in
                if let error = error { NSLog("[WatchInbox] Notification auth error: \(error)") }
                if !granted { NSLog("[WatchInbox] Notification permission denied") }
            }
    }

    private func scheduleLocalNotification(_ msg: WatchMessage) {
        let content = UNMutableNotificationContent()
        content.title = msg.sender
        content.body  = String(msg.text.prefix(200))
        content.sound = .default
        let req = UNNotificationRequest(
            identifier: msg.id,
            content: content,
            trigger: nil       // deliver immediately
        )
        // #21: log delivery failures instead of silently dropping with nil handler
        UNUserNotificationCenter.current().add(req) { error in
            if let error = error { NSLog("[WatchInbox] Notification delivery failed: \(error)") }
        }
    }

    // MARK: - Persistence (F4b: Keychain-backed; F4d: do/catch with logging)

    private func persistToKeychain() {
        // #7: update-then-add pattern — never delete first (avoids data loss if add fails)
        // #15: SecItemDelete with kSecValueData in query is gone — we don't delete at all
        do {
            let data = try JSONEncoder().encode(messages)
            let updateQuery: [String: Any] = [
                kSecClass as String:              kSecClassGenericPassword,
                kSecAttrService as String:        keychainService,
                kSecAttrAccount as String:        keychainAccount,
                kSecAttrSynchronizable as String: false,
            ]
            let updateAttrs: [String: Any] = [
                kSecValueData as String: data,
                kSecAttrAccessible as String: kSecAttrAccessibleAfterFirstUnlockThisDeviceOnly,
            ]
            let updateStatus = SecItemUpdate(updateQuery as CFDictionary, updateAttrs as CFDictionary)
            if updateStatus == errSecItemNotFound {
                var addQuery = updateQuery
                addQuery[kSecValueData as String] = data
                addQuery[kSecAttrAccessible as String] = kSecAttrAccessibleAfterFirstUnlockThisDeviceOnly
                let addStatus = SecItemAdd(addQuery as CFDictionary, nil)
                guard addStatus == errSecSuccess || addStatus == errSecDuplicateItem else {
                    NSLog("[WatchInbox] Keychain add failed: \(addStatus) — NOT removing UserDefaults backup")
                    return  // abort; DO NOT erase UserDefaults
                }
                // Only erase UserDefaults if Keychain write confirmed successful
                if !UserDefaults.standard.bool(forKey: "watchInboxMigrated") {
                    UserDefaults.standard.removeObject(forKey: storageKey)
                    UserDefaults.standard.set(true, forKey: "watchInboxMigrated")
                }
            } else if updateStatus == errSecSuccess {
                // After successful update, set migration flag only once
                if !UserDefaults.standard.bool(forKey: "watchInboxMigrated") {
                    UserDefaults.standard.removeObject(forKey: storageKey)
                    UserDefaults.standard.set(true, forKey: "watchInboxMigrated")
                }
            } else {
                NSLog("[WatchInbox] Keychain update failed: \(updateStatus)")
            }
        } catch {
            NSLog("[WatchInbox] Encode failed: \(error)")
        }
    }

    // #24: @MainActor annotation removed — WatchInbox is @MainActor final class,
    // so all instance methods are implicitly @MainActor. Explicit annotation is redundant.
    private func loadFromDefaults() -> [WatchMessage] {
        // Migration path only — UserDefaults is cleared immediately after Keychain write succeeds.
        // Message PII is in UserDefaults only during the first-launch migration window.
        // This is an accepted limitation; new installs write only to Keychain.
        let query: [String: Any] = [
            kSecClass as String:              kSecClassGenericPassword,
            kSecAttrService as String:        keychainService,
            kSecAttrAccount as String:        keychainAccount,
            kSecAttrSynchronizable as String: false,
            kSecReturnData as String:         true,
            kSecMatchLimit as String:         kSecMatchLimitOne,
        ]
        var result: AnyObject?
        if SecItemCopyMatching(query as CFDictionary, &result) == errSecSuccess,
           let data = result as? Data {
            // #8: size cap — reject suspiciously large Keychain payloads before decode
            guard data.count <= 65_536 else {
                NSLog("[WatchInbox] Keychain data too large (\(data.count) bytes) — ignoring")
                return []
            }
            // #14: do/catch — log decode failure, do NOT overwrite raw data on schema change
            do {
                return try JSONDecoder().decode([WatchMessage].self, from: data)
            } catch {
                NSLog("[WatchInbox] Decode failed (schema change?): \(error) — keeping raw data")
                // Do NOT call persistToKeychain() here — that would erase the corrupted data
                return []
            }
        }
        // Migration from UserDefaults — #3: do not assign messages= here; let init() assign the return value
        // #14: do/catch for migration path too
        if let data = UserDefaults.standard.data(forKey: storageKey) {
            do {
                let msgs = try JSONDecoder().decode([WatchMessage].self, from: data)
                // Migrate to Keychain — persistToKeychain() reads self.messages, so set via returned value
                // init() will assign messages = loadFromDefaults(), then persistToKeychain() is called next
                return msgs
            } catch {
                NSLog("[WatchInbox] UserDefaults migration decode failed: \(error)")
            }
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
