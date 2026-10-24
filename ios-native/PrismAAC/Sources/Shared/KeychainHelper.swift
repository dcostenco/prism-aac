import Foundation
import Security

internal final class KeychainHelper {
    static let shared = KeychainHelper()
    private init() {}

    func read(service: String, account: String) -> String? {
        let query: [String: Any] = [
            kSecClass as String:              kSecClassGenericPassword,
            kSecAttrService as String:        service,
            kSecAttrAccount as String:        account,
            kSecAttrSynchronizable as String: false,
            kSecReturnData as String:         true,
            kSecMatchLimit as String:         kSecMatchLimitOne,
        ]
        var result: AnyObject?
        guard SecItemCopyMatching(query as CFDictionary, &result) == errSecSuccess,
              let data = result as? Data,
              data.count <= 4096 else { return nil }
        return String(data: data, encoding: .utf8)
    }

    func write(value: String, service: String, account: String) {
        guard let data = value.data(using: .utf8) else { return }
        let query: [String: Any] = [
            kSecClass as String:              kSecClassGenericPassword,
            kSecAttrService as String:        service,
            kSecAttrAccount as String:        account,
            kSecAttrSynchronizable as String: false,
        ]
        let attributes: [String: Any] = [
            kSecValueData as String: data,
            kSecAttrAccessible as String: kSecAttrAccessibleAfterFirstUnlockThisDeviceOnly,
        ]
        let status = SecItemUpdate(query as CFDictionary, attributes as CFDictionary)
        if status == errSecItemNotFound {
            var addQuery = query
            addQuery[kSecValueData as String] = data
            addQuery[kSecAttrAccessible as String] = kSecAttrAccessibleAfterFirstUnlockThisDeviceOnly
            // FIX L2: log SecItemAdd failures
            let addStatus = SecItemAdd(addQuery as CFDictionary, nil)
            if addStatus != errSecSuccess && addStatus != errSecDuplicateItem {
                NSLog("[KeychainHelper] SecItemAdd failed: \(addStatus) for \(service)/\(account)")
            }
        } else if status != errSecSuccess {
            NSLog("[KeychainHelper] SecItemUpdate failed: \(status) for \(service)/\(account)")
        }
    }

    // FIX L3: delete method for logout / token clearing
    func delete(service: String, account: String) {
        let query: [String: Any] = [
            kSecClass as String:              kSecClassGenericPassword,
            kSecAttrService as String:        service,
            kSecAttrAccount as String:        account,
            kSecAttrSynchronizable as String: false,
        ]
        let status = SecItemDelete(query as CFDictionary)
        if status != errSecSuccess && status != errSecItemNotFound {
            NSLog("[KeychainHelper] SecItemDelete failed: \(status) for \(service)/\(account)")
        }
    }
}

/// One explicit billing handoff, encrypted by Keychain without sync or migration
/// to another device. A backup can restore it only to the same device.
/// Kept separate from the legacy 4-KiB token helper so
/// a full Unicode AAC message is neither truncated nor logged.
final class BillingDraftStore {
    static let shared = BillingDraftStore()
    static let recoveryWindow: TimeInterval = 75 * 60
    static let maxTextLength = 4000
    private static let maxRecordBytes = 32 * 1024
    private let service: String
    private let now: () -> Date
    struct Draft: Codable {
        let id: UUID
        let account: UUID
        let text: String
        let createdAt: Date
        let expiresAt: Date
    }
    enum StorageError: Error { case invalid, unavailable }

    init(service: String = "ai.synalux.prism-aac.billing-draft", now: @escaping () -> Date = Date.init) {
        self.service = service
        self.now = now
    }
    private var query: [String: Any] {
        [kSecClass as String: kSecClassGenericPassword,
         kSecAttrService as String: service, kSecAttrAccount as String: "current",
         kSecAttrSynchronizable as String: false]
    }
    func save(text: String, account: UUID) throws {
        guard text.utf16.count <= Self.maxTextLength else { throw StorageError.invalid }
        if text.isEmpty { try clear(); return }
        let start = now()
        let draft = Draft(id: UUID(), account: account, text: text, createdAt: start,
                          expiresAt: start.addingTimeInterval(Self.recoveryWindow))
        let data = try JSONEncoder().encode(draft)
        guard data.count <= Self.maxRecordBytes else { throw StorageError.invalid }
        let attributes: [String: Any] = [kSecValueData as String: data,
            kSecAttrAccessible as String: kSecAttrAccessibleWhenUnlockedThisDeviceOnly]
        var status = SecItemUpdate(query as CFDictionary, attributes as CFDictionary)
        if status == errSecItemNotFound {
            status = SecItemAdd(query.merging(attributes) { _, new in new } as CFDictionary, nil)
        }
        guard status == errSecSuccess else { throw StorageError.unavailable }
    }
    private func read() throws -> Draft? {
        var lookup = query
        lookup[kSecReturnData as String] = true
        lookup[kSecMatchLimit as String] = kSecMatchLimitOne
        var result: AnyObject?
        let status = SecItemCopyMatching(lookup as CFDictionary, &result)
        if status == errSecItemNotFound { return nil }
        guard status == errSecSuccess else { throw StorageError.unavailable }
        guard let data = result as? Data, data.count <= Self.maxRecordBytes,
              let draft = try? JSONDecoder().decode(Draft.self, from: data),
              !draft.text.isEmpty, draft.text.utf16.count <= Self.maxTextLength,
              draft.createdAt <= now(), draft.expiresAt > now(),
              draft.expiresAt.timeIntervalSince(draft.createdAt) == Self.recoveryWindow else {
            try clear(); return nil
        }
        return draft
    }
    func load(account: UUID) throws -> Draft? {
        guard let draft = try read() else { return nil }
        guard draft.account == account else { try clear(); return nil }
        return draft
    }
    // A delayed recovery acknowledgement must not delete a newer handoff.
    func clear(expectedID: UUID? = nil) throws {
        if let expectedID, try read()?.id != expectedID { return }
        let status = SecItemDelete(query as CFDictionary)
        guard status == errSecSuccess || status == errSecItemNotFound else { throw StorageError.unavailable }
    }
}
