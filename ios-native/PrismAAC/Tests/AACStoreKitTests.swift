import XCTest
import StoreKit
import StoreKitTest
@testable import PrismAAC

@MainActor
final class AACSubscriptionManagementTests: XCTestCase {
    func testMacOpensAppleAccountInsteadOfTheUnsupportedSheet() async throws {
        var opened: URL?
        try await AACSubscriptionStore.manage(onMac: true, environment: .production,
            openExternal: { opened = $0; return true },
            showSheet: { XCTFail("The subscription sheet is unsupported on Mac") })
        XCTAssertEqual(opened?.absoluteString, "https://account.apple.com/account/manage/section/subscriptions")
    }

    func testIPhoneAndIPadKeepTheNativeSheetIncludingSandbox() async throws {
        var shown = false
        try await AACSubscriptionStore.manage(onMac: false, environment: .sandbox,
            openExternal: { _ in XCTFail("iPhone and iPad must keep native subscription management"); return false },
            showSheet: { shown = true })
        XCTAssertTrue(shown)
    }

    func testMacTestPurchasesDoNotOpenTheRegularAppleAccount() async throws {
        for environment in [AppStore.Environment.sandbox, .xcode] {
            do {
                try await AACSubscriptionStore.manage(onMac: true, environment: environment,
                    openExternal: { _ in XCTFail("Test purchases do not belong to the regular Apple account"); return true },
                    showSheet: { XCTFail("The subscription sheet is unsupported on Mac") })
                XCTFail("Test subscriptions need actionable Sandbox management instructions")
            } catch AACSubscriptionStore.PurchaseError.sandboxManagementOnMac {
                XCTAssertTrue(AACSubscriptionStore.PurchaseError.sandboxManagementOnMac.localizedDescription.contains("Settings > Developer > Sandbox Apple Account"))
            }
        }
    }

    func testRejectedMacHandoffDoesNotReportManagementOpened() async throws {
        do {
            try await AACSubscriptionStore.manage(onMac: true, environment: .production,
                openExternal: { _ in false }, showSheet: { XCTFail("Do not fall back to an unsupported sheet") })
            XCTFail("A rejected URL handoff must remain an error")
        } catch AACSubscriptionStore.PurchaseError.unavailable { }
    }

    func testNativeSheetFailureIsStillReported() async throws {
        do {
            try await AACSubscriptionStore.manage(onMac: false, environment: .production,
                openExternal: { _ in XCTFail("Do not redirect a failed iOS sheet"); return true },
                showSheet: { throw URLError(.notConnectedToInternet) })
            XCTFail("A failed sheet must remain an error")
        } catch let error as URLError {
            XCTAssertEqual(error.code, .notConnectedToInternet)
        }
    }
}

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

    func testTrialEligibilityAndOriginalEndDateAreBoundToTheAACAccount() async throws {
        let before = try await store.product()
        XCTAssertEqual(before["introductoryTrialDays"] as? Int, 14)
        XCTAssertEqual(before["introductoryOfferEligible"] as? Bool, true)
        XCTAssertNil(before["trialEndsAt"], "An offer must not invent a trial date before confirmation")
        let account = UUID()
        _ = try await store.purchase(accountToken: account)
        let purchased = try await store.product(accountToken: account)
        XCTAssertEqual(purchased["introductoryOfferEligible"] as? Bool, false)
        let date = try XCTUnwrap(purchased["trialEndsAt"] as? String)
        let end = try XCTUnwrap(ISO8601DateFormatter().date(from: date))
        XCTAssertGreaterThan(end, Date())
        let again = try await store.product(accountToken: account)
        XCTAssertEqual(again["trialEndsAt"] as? String, date, "Refreshing must not move the trial clock")
        let otherAccount = try await store.product(accountToken: UUID())
        XCTAssertNil(otherAccount["trialEndsAt"], "A shared Apple account must not expose another AAC account's date")
        XCTAssertEqual(otherAccount["introductoryOfferEligible"] as? Bool, false,
            "Switching AAC accounts must not reoffer a trial on an active Apple subscription")
        let unbound = try await store.product()
        XCTAssertEqual(unbound["introductoryOfferEligible"] as? Bool, false)
        XCTAssertNil(unbound["trialEndsAt"], "An unbound offer query must not reveal the owner's trial date")
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

    private func currentTransaction(id: String) async -> Transaction? {
        for await result in Transaction.currentEntitlements {
            if case .verified(let transaction) = result, String(transaction.id) == id { return transaction }
        }
        return nil
    }

    private func waitForEntitlementRemoval(id: String) async throws {
        for _ in 0..<40 {
            if await currentTransaction(id: id) == nil { return }
            try await Task.sleep(for: .milliseconds(100))
        }
        XCTFail("StoreKit must remove the terminal transaction from current entitlements")
    }

    private func record(_ phase: String, transaction: Transaction, details: [String: Any] = [:]) throws {
        let formatter = ISO8601DateFormatter()
        var state: [String: Any] = ["test": name, "phase": phase, "transactionId": String(transaction.id),
            "originalTransactionId": String(transaction.originalID), "productId": transaction.productID,
            "accountToken": transaction.appAccountToken?.uuidString ?? "", "environment": String(describing: transaction.environment),
            "purchaseDate": formatter.string(from: transaction.purchaseDate), "timeZone": TimeZone.current.identifier,
            "expirationDate": transaction.expirationDate.map(formatter.string(from:)) ?? "",
            "revocationDate": transaction.revocationDate.map(formatter.string(from:)) ?? ""]
        state.merge(details) { _, new in new }
        let attachment = XCTAttachment(data: try JSONSerialization.data(withJSONObject: state, options: [.sortedKeys]),
            uniformTypeIdentifier: "public.json")
        attachment.name = phase
        attachment.lifetime = .keepAlways
        add(attachment)
    }

    func testCancellationRetainsTheOriginalTrialAndRestoresOnlyItsOwningAccount() async throws {
        let account = UUID()
        let purchased = try await store.purchase(accountToken: account)
        let id = try XCTUnwrap(try envelope(purchased)["transactionId"])
        let before = try await store.product(accountToken: account)
        let originalEnd = try XCTUnwrap(before["trialEndsAt"] as? String)
        let observed = await currentTransaction(id: id)
        let original = try XCTUnwrap(observed)
        XCTAssertEqual(original.appAccountToken, account)
        // StoreKit's P2W period is fourteen calendar days, including a possible
        // daylight-saving transition; it is not always 14 * 86400 seconds.
        let expectedEnd = try XCTUnwrap(Calendar.current.date(byAdding: .day, value: 14, to: original.purchaseDate))
        XCTAssertEqual(try XCTUnwrap(original.expirationDate).timeIntervalSince(expectedEnd), 0, accuracy: 1)
        await store.finish(transactionID: id)
        let local = try XCTUnwrap(session.allTransactions().first { String($0.identifier) == id })
        try session.disableAutoRenewForTransaction(identifier: local.identifier)
        XCTAssertFalse(try XCTUnwrap(session.allTransactions().first { $0.identifier == local.identifier }).autoRenewingEnabled)
        let cancelled = try await store.product(accountToken: account)
        XCTAssertEqual(cancelled["trialEndsAt"] as? String, originalEnd, "Cancelling renewal must not shorten or restart the confirmed trial")
        let restored = try await store.transactions(restore: true)
        XCTAssertEqual(try envelope(restored)["transactionId"], id)
        let retained = await currentTransaction(id: id)
        XCTAssertEqual(retained?.appAccountToken, account)
        let other = try await store.product(accountToken: UUID())
        XCTAssertNil(other["trialEndsAt"], "Restore must not expose the owner's trial date on a different AAC account")
        XCTAssertEqual(session.allTransactions().count, 1, "Cancellation and restore must not create a second purchase")
        try record("cancelled-trial-retained", transaction: original, details: ["displayedOriginalEnd": originalEnd,
            "restoredTransactionId": try envelope(restored)["transactionId"] ?? "", "autoRenewingEnabled": false])
    }

    func testExpiredFinishedTrialCannotBeRestoredOrRestartedAsAnotherFreeTrial() async throws {
        let account = UUID()
        let purchased = try await store.purchase(accountToken: account)
        let id = try XCTUnwrap(try envelope(purchased)["transactionId"])
        let observedBeforeExpiry = await currentTransaction(id: id)
        let original = try XCTUnwrap(observedBeforeExpiry)
        await store.finish(transactionID: id)
        try session.expireSubscription(productIdentifier: productID)
        try await waitForEntitlementRemoval(id: id)
        let expired = try await store.product(accountToken: account)
        XCTAssertNil(expired["trialEndsAt"])
        XCTAssertEqual(expired["introductoryOfferEligible"] as? Bool, false, "An expired trial remains consumed")
        let restored = try await store.transactions(restore: true)
        XCTAssertTrue((restored["transactions"] as? [[String: String]])?.isEmpty == true, "Restoring an acknowledged expired purchase must not resurrect it")
        XCTAssertEqual(session.allTransactions().count, 1)
        try record("expired-trial-not-restored", transaction: original,
            details: ["currentEntitlement": false, "restoredCount": 0, "introductoryOfferEligible": false])
        let repurchased = try await store.purchase(accountToken: account)
        let nextID = try XCTUnwrap(try envelope(repurchased)["transactionId"])
        XCTAssertNotEqual(nextID, id)
        let observed = await currentTransaction(id: nextID)
        let next = try XCTUnwrap(observed)
        XCTAssertEqual(next.appAccountToken, account)
        if #available(iOS 17.2, *) { XCTAssertNotEqual(next.offer?.type, .introductory, "Resubscription must use the ordinary paid offer") }
        let after = try await store.product(accountToken: account)
        XCTAssertNil(after["trialEndsAt"], "Paid resubscription must not be displayed as a new free trial")
        try record("resubscription-without-new-trial", transaction: next)
    }

    func testRefundRemovesTheFinishedTrialFromRestoreAndTrialDateDisplay() async throws {
        let account = UUID()
        let purchased = try await store.purchase(accountToken: account)
        let id = try XCTUnwrap(try envelope(purchased)["transactionId"])
        await store.finish(transactionID: id)
        let local = try XCTUnwrap(session.allTransactions().first { String($0.identifier) == id })
        try session.refundTransaction(identifier: local.identifier)
        try await waitForEntitlementRemoval(id: id)
        let after = try await store.product(accountToken: account)
        XCTAssertNil(after["trialEndsAt"], "A revoked purchase must not retain a displayed active trial date")
        let restored = try await store.transactions(restore: true)
        XCTAssertTrue((restored["transactions"] as? [[String: String]])?.isEmpty == true)
        var revoked: Transaction?
        for await result in Transaction.all {
            if case .verified(let transaction) = result, String(transaction.id) == id { revoked = transaction; break }
        }
        XCTAssertNotNil(revoked?.revocationDate, "This is an actual StoreKit revocation, not merely a cleared test record")
        XCTAssertEqual(revoked?.appAccountToken, account)
        XCTAssertEqual(session.allTransactions().count, 1, "Refund history must remain available for repeat-trial safeguards")
        try record("refunded-trial-revoked", transaction: try XCTUnwrap(revoked),
            details: ["currentEntitlement": false, "restoredCount": 0])
    }
}
