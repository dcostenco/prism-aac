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
        // #3: Cap read return value — guard against malformed/oversized Keychain items
        guard data.count <= 4096 else {
            NSLog("[KeychainHelper] Keychain item too large (\(data.count) bytes) for \(service)/\(account)")
            return nil
        }
        return String(data: data, encoding: .utf8)
    }

    func write(value: String, service: String, account: String) {
        guard let data = value.data(using: .utf8) else { return }
        // #1: Search query — NO kSecAttrAccessible (invalid in SecItemUpdate query dict)
        let query: [String: Any] = [
            kSecClass as String:              kSecClassGenericPassword,
            kSecAttrService as String:        service,
            kSecAttrAccount as String:        account,
            kSecAttrSynchronizable as String: false,
        ]
        // Attributes to update/add — kSecAttrAccessible goes here
        let attributes: [String: Any] = [
            kSecValueData as String: data,
            kSecAttrAccessible as String: kSecAttrAccessibleAfterFirstUnlockThisDeviceOnly,
        ]
        let updateStatus = SecItemUpdate(query as CFDictionary, attributes as CFDictionary)
        if updateStatus == errSecItemNotFound {
            var addQuery = query
            addQuery[kSecValueData as String] = data
            addQuery[kSecAttrAccessible as String] = kSecAttrAccessibleAfterFirstUnlockThisDeviceOnly
            let addStatus = SecItemAdd(addQuery as CFDictionary, nil)
            if addStatus == errSecDuplicateItem {
                // #27: TOCTOU race — another concurrent write succeeded between our update and add.
                // Retry the update to converge on the correct final value.
                let retryStatus = SecItemUpdate(query as CFDictionary, attributes as CFDictionary)
                if retryStatus != errSecSuccess {
                    NSLog("[KeychainHelper] Retry update failed: \(retryStatus) for \(service)/\(account)")
                }
            } else if addStatus != errSecSuccess {
                NSLog("[KeychainHelper] SecItemAdd failed: \(addStatus) for \(service)/\(account)")
            }
        } else if updateStatus != errSecSuccess {
            NSLog("[KeychainHelper] SecItemUpdate failed: \(updateStatus) for \(service)/\(account)")
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
