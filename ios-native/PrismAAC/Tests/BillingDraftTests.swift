import XCTest
import Security
@testable import PrismAAC

final class BillingDraftTests: XCTestCase {
    private var clock = Date(timeIntervalSince1970: 1_800_000_000)
    private var service: String!
    private var store: BillingDraftStore!
    private let account = UUID()
    override func setUp() {
        service = "ai.synalux.prism-aac.tests.billing-draft.\(UUID().uuidString)"
        store = BillingDraftStore(service: service, now: { self.clock })
    }
    override func tearDownWithError() throws { try store.clear() }

    func test_new_store_instance_recovers_full_unicode_message_with_device_only_protection() throws {
        let text = String(repeating: "界", count: BillingDraftStore.maxTextLength)
        try store.save(text: text, account: account)
        let restarted = BillingDraftStore(service: service, now: { self.clock })
        XCTAssertEqual(try restarted.load(account: account)?.text, text)
        let query: [String: Any] = [kSecClass as String: kSecClassGenericPassword,
            kSecAttrService as String: service!, kSecAttrAccount as String: "current",
            kSecReturnAttributes as String: true]
        var attributes: AnyObject?
        XCTAssertEqual(SecItemCopyMatching(query as CFDictionary, &attributes), errSecSuccess)
        let values = try XCTUnwrap(attributes as? [String: Any])
        XCTAssertEqual(values[kSecAttrAccessible as String] as? String, kSecAttrAccessibleWhenUnlockedThisDeviceOnly as String)
        XCTAssertNotEqual(values[kSecAttrSynchronizable as String] as? Bool, true)
    }
    func test_same_account_can_recover_at_74_minutes_but_not_at_75() throws {
        try store.save(text: "I need help", account: account)
        clock.addTimeInterval(74 * 60)
        XCTAssertEqual(try store.load(account: account)?.text, "I need help")
        clock.addTimeInterval(60)
        XCTAssertNil(try store.load(account: account))
        clock.addTimeInterval(-60)
        XCTAssertNil(try store.load(account: account), "Expired data was deleted, not hidden")
    }
    func test_another_account_gets_no_text_and_discards_the_single_old_slot() throws {
        try store.save(text: "private message", account: account)
        XCTAssertNil(try store.load(account: UUID()))
        XCTAssertNil(try store.load(account: account))
    }
    func test_acknowledged_recovery_and_signout_remove_the_record() throws {
        try store.save(text: "keep my message", account: account)
        let draft = try XCTUnwrap(store.load(account: account))
        try store.clear(expectedID: draft.id)
        XCTAssertNil(try store.load(account: account))
        try store.save(text: "new message", account: account)
        try store.clear()
        XCTAssertNil(try store.load(account: account))
    }
    func test_delayed_old_ack_does_not_delete_a_new_handoff() throws {
        try store.save(text: "first", account: account)
        let first = try XCTUnwrap(store.load(account: account))
        try store.save(text: "second", account: account)
        try store.clear(expectedID: first.id)
        XCTAssertEqual(try store.load(account: account)?.text, "second")
    }
    func test_invalid_oversize_replacement_does_not_corrupt_an_existing_draft() throws {
        try store.save(text: "first", account: account)
        XCTAssertThrowsError(try store.save(text: String(repeating: "x", count: BillingDraftStore.maxTextLength + 1), account: account))
        XCTAssertEqual(try store.load(account: account)?.text, "first")
        try store.save(text: "", account: account)
        XCTAssertNil(try store.load(account: account))
    }
    func test_clock_before_creation_discards_the_draft() throws {
        try store.save(text: "first", account: account)
        clock.addTimeInterval(-1)
        XCTAssertNil(try store.load(account: account))
    }
    func test_in_window_wall_clock_rollback_is_a_disclosed_recovery_limit() throws {
        try store.save(text: "first", account: account)
        clock.addTimeInterval(74 * 60)
        clock.addTimeInterval(-30 * 60)
        clock.addTimeInterval(2 * 60)
        XCTAssertEqual(try store.load(account: account)?.text, "first",
            "Wall-clock TTL is not tamper-resistant: 76 elapsed minutes can still appear within the recovery window")
    }
}
