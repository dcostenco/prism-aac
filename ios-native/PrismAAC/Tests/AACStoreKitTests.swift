import XCTest
import StoreKit
import StoreKitTest
@testable import PrismAAC

/// Uses Apple's local StoreKit engine and the real AACSubscriptionStore.
/// No App Store account, provider webhook, or real payment is involved.
@MainActor
final class AACStoreKitTests: XCTestCase {
    private var session: SKTestSession!
    private let store = AACSubscriptionStore.shared
    private let productID = "ai.synalux.prismaac.cloud.monthly"

    override func setUp() async throws {
        session = try SKTestSession(configurationFileNamed: "AACSubscriptions")
        session.resetToDefaultState()
        session.disableDialogs = true
        guard session.disableDialogs else {
            throw NSError(domain: "AACStoreKitTestSetup", code: 1, userInfo: [NSLocalizedDescriptionKey: "Local StoreKit configuration is not writable"])
        }
        session.clearTransactions()
        _ = try await store.product()
    }

    override func tearDown() async throws {
        store.onTransactionsChanged = nil
        session.resetToDefaultState()
        session.clearTransactions()
        session = nil
    }

    private func unfinishedIDs() async -> Set<String> {
        var ids = Set<String>()
        for await result in Transaction.unfinished {
            if case .verified(let transaction) = result { ids.insert(String(transaction.id)) }
        }
        return ids
    }

    private func envelope(_ value: [String: Any]) throws -> [String: String] {
        try XCTUnwrap((value["transactions"] as? [[String: String]])?.first)
    }

    func testPurchaseRemainsRecoverableUntilDeliveryAcknowledgement() async throws {
        let product = try await store.product()
        XCTAssertEqual(product["id"] as? String, productID)
        XCTAssertTrue((product["displayPrice"] as? String)?.contains("4.99") == true)
        let account = UUID()
        let purchased = try await store.purchase(accountToken: account)
        XCTAssertEqual(purchased["status"] as? String, "purchased")
        let transaction = try envelope(purchased)
        let id = try XCTUnwrap(transaction["transactionId"])
        XCTAssertEqual(transaction["jws"]?.split(separator: ".").count, 3)
        let pending = await unfinishedIDs()
        XCTAssertTrue(pending.contains(id), "A charge must remain unfinished before backend delivery")
        let recovered = try await store.transactions(restore: false)
        XCTAssertEqual(try envelope(recovered)["transactionId"], id)
        await store.finish(transactionID: id)
        let afterDelivery = await unfinishedIDs()
        XCTAssertFalse(afterDelivery.contains(id), "Only acknowledged delivery should finish the purchase")
        let restored = try await store.transactions(restore: true)
        XCTAssertEqual(try envelope(restored)["transactionId"], id, "Finish must not erase the active entitlement")
    }

    func testActiveSubscriptionCannotBePurchasedAgainOrAssignedToAnotherAccount() async throws {
        let account = UUID()
        _ = try await store.purchase(accountToken: account)
        do {
            _ = try await store.purchase(accountToken: account)
            XCTFail("Same account must restore instead of buying twice")
        } catch AACSubscriptionStore.PurchaseError.alreadySubscribed { }
        do {
            _ = try await store.purchase(accountToken: UUID())
            XCTFail("Another AAC account must not claim the existing Apple purchase")
        } catch AACSubscriptionStore.PurchaseError.accountMismatch { }
        XCTAssertEqual(session.allTransactions().count, 1)
    }

    func testPendingParentalApprovalDeliversThroughTransactionUpdates() async throws {
        session.askToBuyEnabled = true
        let changed = expectation(description: "Approved purchase reaches the app-lifetime listener")
        changed.assertForOverFulfill = false
        store.onTransactionsChanged = { changed.fulfill() }
        let result = try await store.purchase(accountToken: UUID())
        XCTAssertEqual(result["status"] as? String, "pending")
        let before = try await store.transactions(restore: false)
        XCTAssertTrue((before["transactions"] as? [[String: String]])?.isEmpty == true)
        let transaction = try XCTUnwrap(session.allTransactions().first)
        try session.approveAskToBuyTransaction(identifier: transaction.identifier)
        await fulfillment(of: [changed], timeout: 10)
        let approved = try await store.transactions(restore: false)
        XCTAssertFalse(try envelope(approved).isEmpty)
    }

    @available(iOS 17.0, *)
    func testPurchaseFailureDoesNotCreateAnEntitlement() async throws {
        try await session.setSimulatedError(.generic(.networkError(URLError(.notConnectedToInternet))), forAPI: .purchase)
        do {
            _ = try await store.purchase(accountToken: UUID())
            XCTFail("A simulated network failure must not report a purchase")
        } catch { }
        let state = try await store.transactions(restore: false)
        XCTAssertTrue((state["transactions"] as? [[String: String]])?.isEmpty == true)
    }
}
