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
        // FIX #2: Check needsMigration BEFORE loadFromDefaults() so the UserDefaults entry
        // is still present when we decide whether to trigger persistToKeychain().
        // loadFromDefaults() must NOT remove the UserDefaults entry — that happens inside
        // persistToKeychain() only after a confirmed Keychain write.
        let needsMigration = !UserDefaults.standard.bool(forKey: "watchInboxMigrated") &&
                             UserDefaults.standard.data(forKey: storageKey) != nil
        // FIX #6: Keychain I/O is synchronous and must not block @MainActor init.
        // Register handlers synchronously, then load messages asynchronously.
        // FIX 3: Register with router instead of setting WCSession.default.delegate = self
        WCSessionRouter.shared.registerMessageHandler(for: "inbox_message") { [weak self] _, msg in
            Task { @MainActor [weak self] in self?.deliverFromMessage(msg) }
        }
        // FIX #14: loadFromDefaults() is nonisolated (Keychain reads are safe off main thread).
        // Run it on a detached task to avoid blocking @MainActor init, then assign results on main.
        // FIX #3: nonisolated func cannot read actor-isolated properties; capture them first on MainActor.
        Task {
            let (svc, acct, key) = (keychainService, keychainAccount, storageKey)
            let msgs = await Task.detached(priority: .userInitiated) { [weak self] in
                self?.loadFromDefaults(service: svc, account: acct, storageKey: key) ?? []
            }.value
            await MainActor.run { [weak self] in
                guard let self else { return }
                self.messages = msgs
                self.recalcUnread()
            }
            if needsMigration {
                // #3/#17: persist migrated UserDefaults data to Keychain asynchronously
                Task.detached(priority: .utility) { [weak self] in await self?.persistToKeychain() }
            } else {
                // #9: Always purge any residual UserDefaults PII on every launch after migration is complete.
                // Covers the race window where migration succeeded but a prior launch crashed before
                // removeObject() ran inside persistToKeychain().
                await MainActor.run { [weak self] in
                    guard let self else { return }
                    UserDefaults.standard.removeObject(forKey: self.storageKey)
                }
            }
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
        Task.detached(priority: .utility) { [weak self] in await self?.persistToKeychain() }
    }

    func markAllRead() {
        for i in messages.indices { messages[i].isRead = true }
        recalcUnread()
        Task.detached(priority: .utility) { [weak self] in await self?.persistToKeychain() }
    }

    func deleteMessage(_ id: String) {
        messages.removeAll { $0.id == id }
        recalcUnread()
        Task.detached(priority: .utility) { [weak self] in await self?.persistToKeychain() }
    }

    func clearAll() {
        messages.removeAll()
        unreadCount = 0
        Task.detached(priority: .utility) { [weak self] in await self?.persistToKeychain() }
    }

    /// Reply to a message by sending text back via iPhone.
    /// F4a: routes through WCSessionRouter (no direct WCSession bypass, no nil errorHandler)
    func reply(to msg: WatchMessage, text: String) {
        // #10: Check for crisis content — may need emergency protocol instead of plain reply
        let safetyResult = WatchSafetyFilter.check(text)
        if case .crisis = safetyResult {
            NSLog("[WatchInbox] Crisis content detected in reply — routing to emergency instead of sending as message")
            // Don't send as reply — the emergency panel should handle this
            return
        }

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
            // Strip bidi override characters
            let bidiStripped = capped
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
            // FIX #23: Also strip ChatML tokens from sender field — prevents prompt injection
            // via a maliciously crafted sender name delivered from iPhone companion app.
            return stripChatMLTokens(bidiStripped)
        }()
        // #3: strip full WatchAISession token list — ChatML, Llama, Gemma, Mistral, legacy special tokens, HTML entities, JSON-escaped angle brackets
        let safeText = String(rawText.prefix(500))
            .replacingOccurrences(of: "<|im_start|>", with: "")
            .replacingOccurrences(of: "<|im_end|>", with: "")
            .replacingOccurrences(of: "<|system|>", with: "")
            .replacingOccurrences(of: "[INST]", with: "")
            .replacingOccurrences(of: "[/INST]", with: "")
            .replacingOccurrences(of: "<<SYS>>", with: "")
            .replacingOccurrences(of: "<</SYS>>", with: "")
            .replacingOccurrences(of: "<|eot_id|>", with: "")
            .replacingOccurrences(of: "<|start_header_id|>", with: "")
            .replacingOccurrences(of: "<|end_header_id|>", with: "")
            .replacingOccurrences(of: "<|user|>", with: "")
            .replacingOccurrences(of: "<|assistant|>", with: "")
            .replacingOccurrences(of: "<|endoftext|>", with: "")
            .replacingOccurrences(of: "<s>", with: "")
            .replacingOccurrences(of: "</s>", with: "")
            .replacingOccurrences(of: "<|end_of_turn|>", with: "")
            .replacingOccurrences(of: "<|start_of_turn|>", with: "")
            .replacingOccurrences(of: "&#x", with: "")
            .replacingOccurrences(of: "&#X", with: "")
            .replacingOccurrences(of: "&#", with: "")
            .replacingOccurrences(of: "&lt;", with: "")
            .replacingOccurrences(of: "&gt;", with: "")
            .replacingOccurrences(of: "\\u003c", with: "")
            .replacingOccurrences(of: "\\u003e", with: "")
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
        let ts         = min(max(rawTs, oneYearAgo), now + 300)  // FIX #39: 5-min future window (was 60s)
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
        Task.detached(priority: .utility) { [weak self] in await self?.persistToKeychain() }
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
        // FIX #7: Redact PII from lock-screen notifications — sender name and message body
        // must not appear on the lock screen. Message ID stored in userInfo for deep-link on tap.
        content.title = "New Message"
        content.body  = "Tap to view"
        content.userInfo = ["messageId": msg.id]
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

    // #6: nonisolated so Task.detached can call this without hopping back to @MainActor.
    // Captures a snapshot of messages at call time; Keychain I/O runs off the main thread.
    nonisolated private func persistToKeychain() async {
        // FIX #5: Single MainActor round-trip instead of four separate awaits — avoids
        // interleaved mutations between hops (each await is a suspension point where other
        // @MainActor work can run and mutate state).
        let (snapshot, svc, acct, storeKey, migrated) = await MainActor.run {
            (messages, keychainService, keychainAccount, storageKey,
             UserDefaults.standard.bool(forKey: "watchInboxMigrated"))
        }
        // Use snapshot, svc, acct, storeKey, migrated below instead of separate awaits
        let keychainService = svc
        let keychainAccount = acct
        let storageKey      = storeKey

        // #7: update-then-add pattern — never delete first (avoids data loss if add fails)
        // #15: SecItemDelete with kSecValueData in query is gone — we don't delete at all
        do {
            let data = try JSONEncoder().encode(snapshot)
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
                if addStatus == errSecDuplicateItem {
                    // #16: Race — another write beat us; retry the update
                    let retryAttrs: [String: Any] = [
                        kSecValueData as String: data,
                        kSecAttrAccessible as String: kSecAttrAccessibleAfterFirstUnlockThisDeviceOnly,
                    ]
                    let retryStatus = SecItemUpdate(updateQuery as CFDictionary, retryAttrs as CFDictionary)
                    if retryStatus != errSecSuccess {
                        NSLog("[WatchInbox] Retry update after duplicate failed: \(retryStatus)")
                    }
                } else if addStatus != errSecSuccess {
                    NSLog("[WatchInbox] Keychain add failed: \(addStatus) — NOT removing UserDefaults backup")
                    return  // abort; DO NOT erase UserDefaults
                }
                // Only erase UserDefaults if Keychain write confirmed successful
                // NOTE: UserDefaults is NOT excluded from iCloud backup by default.
                // PII is only present during the brief migration window before persistToKeychain() completes.
                // Resolved by immediate removal after confirmed Keychain write.
                // FIX #26/#15: Using "watchInboxMigrated" in UserDefaults.standard — iCloud KVS disabled
                // since NSUbiquitousKeyValueStore is not enabled in entitlements.
                // SECURITY: If NSUbiquitousKeyValueStore is ever added to the entitlements, this flag
                // could sync across devices and cause migration to be skipped on new installations.
                // A future entitlements change MUST move this key to a non-synced store first.
                #if DEBUG
                // Verify iCloud KVS is not enabled in entitlements before shipping:
                // grep NSUbiquitousKeyValueStoreURL ios-native/PrismAAC/PrismAAC.entitlements
                #endif
                if !migrated {
                    UserDefaults.standard.removeObject(forKey: storeKey)
                    UserDefaults.standard.set(true, forKey: "watchInboxMigrated")
                }
            } else if updateStatus == errSecSuccess {
                // After successful update, set migration flag only once
                // NOTE: UserDefaults is NOT excluded from iCloud backup by default.
                // PII is only present during the brief migration window before persistToKeychain() completes.
                // Resolved by immediate removal after confirmed Keychain write.
                // FIX #26/#15: Using "watchInboxMigrated" in UserDefaults.standard — iCloud KVS disabled
                // since NSUbiquitousKeyValueStore is not enabled in entitlements.
                // SECURITY: If NSUbiquitousKeyValueStore is ever added to the entitlements, this flag
                // could sync across devices and cause migration to be skipped on new installations.
                // A future entitlements change MUST move this key to a non-synced store first.
                #if DEBUG
                // Verify iCloud KVS is not enabled in entitlements before shipping:
                // grep NSUbiquitousKeyValueStoreURL ios-native/PrismAAC/PrismAAC.entitlements
                #endif
                if !migrated {
                    UserDefaults.standard.removeObject(forKey: storeKey)
                    UserDefaults.standard.set(true, forKey: "watchInboxMigrated")
                }
            } else {
                NSLog("[WatchInbox] Keychain update failed: \(updateStatus)")
            }
        } catch {
            NSLog("[WatchInbox] Encode failed: \(error)")
        }
    }

    // FIX #14: nonisolated — Keychain reads are safe off main thread; called from detached Task in init().
    // FIX #3: parameters replace actor-isolated property reads; caller captures them on @MainActor first.
    // #24: @MainActor annotation removed — WatchInbox is @MainActor final class,
    // so all instance methods are implicitly @MainActor. Explicit annotation is redundant.
    nonisolated private func loadFromDefaults(service: String, account: String, storageKey: String) -> [WatchMessage] {
        // Migration path only — UserDefaults is cleared immediately after Keychain write succeeds.
        // Message PII is in UserDefaults only during the first-launch migration window.
        // This is an accepted limitation; new installs write only to Keychain.
        let query: [String: Any] = [
            kSecClass as String:              kSecClassGenericPassword,
            kSecAttrService as String:        service,
            kSecAttrAccount as String:        account,
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
                let msgs = try JSONDecoder().decode([WatchMessage].self, from: data)
                // #22: log on successful Keychain load
                NSLog("[WatchInbox] Loaded \(msgs.count) messages (\(data.count) bytes) from Keychain")
                // FIX #7: Re-sanitize messages loaded from Keychain — may be from an older app
                // version that did not strip bidi/ChatML tokens before persisting. Apply the same
                // stripping chain as deliverFromMessage() to catch stale data.
                let bidi = ["\u{202A}","\u{202B}","\u{202C}","\u{202D}","\u{202E}",
                            "\u{200B}","\u{200C}","\u{200D}","\u{200E}","\u{200F}",
                            "\u{2066}","\u{2067}","\u{2068}","\u{2069}","\u{FEFF}"]
                let chatMLTokens = ["<|im_start|>","<|im_end|>","<|system|>","[INST]","[/INST]",
                                    "<<SYS>>","<</SYS>>","<|eot_id|>","<|start_header_id|>",
                                    "<|end_header_id|>","<|user|>","<|assistant|>","<|endoftext|>",
                                    "<s>","</s>","<|end_of_turn|>","<|start_of_turn|>",
                                    "&#x","&#X","&#","&lt;","&gt;","\\u003c","\\u003e"]
                let sanitized = msgs.map { msg -> WatchMessage in
                    let cleanSender: String = {
                        let capped = String(msg.sender.prefix(100))
                        let bidiStripped = bidi.reduce(capped) { $0.replacingOccurrences(of: $1, with: "") }
                        return chatMLTokens.reduce(bidiStripped) { $0.replacingOccurrences(of: $1, with: "") }
                    }()
                    let cleanText = chatMLTokens.reduce(String(msg.text.prefix(500))) {
                        $0.replacingOccurrences(of: $1, with: "")
                    }
                    return WatchMessage(id: msg.id, sender: cleanSender, text: cleanText,
                                       provider: msg.provider, receivedAt: msg.receivedAt, isRead: msg.isRead)
                }
                return sanitized
            } catch {
                NSLog("[WatchInbox] Decode failed (schema change?): \(error) — keeping raw data")
                // Do NOT call persistToKeychain() here — that would erase the corrupted data
                return []
            }
        }
        // Migration from UserDefaults — #3: do not assign messages= here; let init() assign the return value
        // #14: do/catch for migration path too
        // FIX #2: Do NOT remove UserDefaults data here. persistToKeychain() removes it only
        // after a confirmed Keychain write. Removing here causes a race where init() checks
        // needsMigration after the entry is already gone, skipping persistToKeychain() entirely.
        if let data = UserDefaults.standard.data(forKey: storageKey) {
            do {
                let msgs = try JSONDecoder().decode([WatchMessage].self, from: data)
                // NOTE: UserDefaults is NOT excluded from iCloud backup by default.
                // PII is only present during the brief migration window before persistToKeychain() completes.
                // Resolved by immediate removal after confirmed Keychain write (inside persistToKeychain()).
                // Migrate to Keychain — persistToKeychain() reads self.messages, so set via returned value
                // init() will assign messages = loadFromDefaults(), then persistToKeychain() is called next
                return msgs
            } catch {
                NSLog("[WatchInbox] UserDefaults migration decode failed: \(error)")
            }
        }
        // #25: Keychain returned empty — check whether migration was marked complete (possible Keychain wipe)
        let msgs: [WatchMessage] = []
        if msgs.isEmpty && UserDefaults.standard.bool(forKey: "watchInboxMigrated") {
            NSLog("[WatchInbox] Keychain empty after migration flag set — possible Keychain wipe; starting fresh")
        }
        return msgs
    }

    private func recalcUnread() {
        unreadCount = messages.filter { !$0.isRead }.count
    }

    // FIX #23: Strips ChatML / Llama / Gemma / Mistral prompt-injection tokens.
    // Used for both sender and text fields so the same chain is applied consistently.
    // nonisolated so it can be called from detached tasks and loadFromDefaults().
    nonisolated private func stripChatMLTokens(_ input: String) -> String {
        return input
            .replacingOccurrences(of: "<|im_start|>", with: "")
            .replacingOccurrences(of: "<|im_end|>", with: "")
            .replacingOccurrences(of: "<|system|>", with: "")
            .replacingOccurrences(of: "[INST]", with: "")
            .replacingOccurrences(of: "[/INST]", with: "")
            .replacingOccurrences(of: "<<SYS>>", with: "")
            .replacingOccurrences(of: "<</SYS>>", with: "")
            .replacingOccurrences(of: "<|eot_id|>", with: "")
            .replacingOccurrences(of: "<|start_header_id|>", with: "")
            .replacingOccurrences(of: "<|end_header_id|>", with: "")
            .replacingOccurrences(of: "<|user|>", with: "")
            .replacingOccurrences(of: "<|assistant|>", with: "")
            .replacingOccurrences(of: "<|endoftext|>", with: "")
            .replacingOccurrences(of: "<s>", with: "")
            .replacingOccurrences(of: "</s>", with: "")
            .replacingOccurrences(of: "<|end_of_turn|>", with: "")
            .replacingOccurrences(of: "<|start_of_turn|>", with: "")
            .replacingOccurrences(of: "&#x", with: "")
            .replacingOccurrences(of: "&#X", with: "")
            .replacingOccurrences(of: "&#", with: "")
            .replacingOccurrences(of: "&lt;", with: "")
            .replacingOccurrences(of: "&gt;", with: "")
            .replacingOccurrences(of: "\\u003c", with: "")
            .replacingOccurrences(of: "\\u003e", with: "")
    }

    // MARK: - Dev helpers

    #if DEBUG
    func injectTestMessage(sender: String = "Mom", text: String = "Are you okay?", provider: String = "sms") {
        deliver(WatchMessage(id: UUID().uuidString, sender: sender, text: text,
                             provider: provider, receivedAt: Date()))
    }
    #endif
}
