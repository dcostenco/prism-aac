import Foundation
import Security

/// Shared Keychain helper for all Watch targets.
/// Uses kSecAttrAccessibleAfterFirstUnlockThisDeviceOnly so tokens are
/// readable in background tasks (emergency dispatch) without requiring
/// the Watch to be actively worn/unlocked.
/// kSecAttrSynchronizable: false prevents iCloud collision with same-name items.
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
              let data = result as? Data else { return nil }
        return String(data: data, encoding: .utf8)
    }

    func write(value: String, service: String, account: String) {
        guard let data = value.data(using: .utf8) else { return }
        let query: [String: Any] = [
            kSecClass as String:              kSecClassGenericPassword,
            kSecAttrService as String:        service,
            kSecAttrAccount as String:        account,
            kSecAttrAccessible as String:     kSecAttrAccessibleAfterFirstUnlockThisDeviceOnly,
            kSecAttrSynchronizable as String: false,
        ]
        let attributes: [String: Any] = [kSecValueData as String: data]
        if SecItemUpdate(query as CFDictionary, attributes as CFDictionary) == errSecItemNotFound {
            var addQuery = query
            addQuery[kSecValueData as String] = data
            let status = SecItemAdd(addQuery as CFDictionary, nil)
            if status != errSecSuccess && status != errSecDuplicateItem {
                NSLog("[KeychainHelper] SecItemAdd failed: \(status) for service=\(service) account=\(account)")
            }
        }
    }

    func delete(service: String, account: String) {
        let query: [String: Any] = [
            kSecClass as String:              kSecClassGenericPassword,
            kSecAttrService as String:        service,
            kSecAttrAccount as String:        account,
            kSecAttrSynchronizable as String: false,
        ]
        // #23: log unexpected SecItemDelete failures (errSecItemNotFound is expected and ignored)
        let status = SecItemDelete(query as CFDictionary)
        if status != errSecSuccess && status != errSecItemNotFound {
            NSLog("[KeychainHelper] SecItemDelete failed: \(status) for \(service)/\(account)")
        }
    }
}
