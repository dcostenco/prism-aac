import Foundation
import StoreKit
import UIKit

/// StoreKit is the native purchase channel; the portal owns shared account access.
/// Leave successful transactions unfinished until the portal confirms delivery.
@MainActor
final class AACSubscriptionStore {
    static let shared = AACSubscriptionStore()
    private var listener: Task<Void, Never>?
    var onTransactionsChanged: (() -> Void)?

    private var productID: String {
        Bundle.main.object(forInfoDictionaryKey: "AACMonthlyProductID") as? String ?? ""
    }

    enum PurchaseError: LocalizedError {
        case unavailable, unverified, accountMismatch, alreadySubscribed
        var errorDescription: String? {
            switch self {
            case .unavailable: return "The subscription is unavailable. Please try again."
            case .unverified: return "Apple could not verify this purchase. Please try Restore Purchases."
            case .accountMismatch: return "This Apple subscription belongs to a different AAC account. Sign in to that account to restore it."
            case .alreadySubscribed: return "You already have this Apple subscription. Use Restore Purchases."
            }
        }
    }

    private init() {
        listener = Task { [weak self] in
            for await result in Transaction.updates {
                guard let self, case .verified(let transaction) = result,
                      transaction.productID == self.productID else { continue }
                self.onTransactionsChanged?()
            }
        }
    }

    func product() async throws -> [String: Any] {
        let product = try await loadProduct()
        return ["id": product.id, "displayName": product.displayName,
                "displayPrice": product.displayPrice]
    }

    private func loadProduct() async throws -> Product {
        guard !productID.isEmpty,
              let product = try await Product.products(for: [productID]).first,
              product.type == .autoRenewable else { throw PurchaseError.unavailable }
        return product
    }

    func purchase(accountToken: UUID) async throws -> [String: Any] {
        // Also checks Apple's account before presenting a second purchase sheet.
        for await result in Transaction.currentEntitlements {
            guard case .verified(let transaction) = result, transaction.productID == productID,
                  transaction.revocationDate == nil,
                  (transaction.expirationDate ?? .distantPast) > .now else { continue }
            if transaction.appAccountToken != accountToken { throw PurchaseError.accountMismatch }
            throw PurchaseError.alreadySubscribed
        }
        let product = try await loadProduct()
        switch try await product.purchase(options: [.appAccountToken(accountToken)]) {
        case .success(let verification):
            guard case .verified(let transaction) = verification,
                  transaction.productID == productID,
                  transaction.appAccountToken == accountToken else { throw PurchaseError.unverified }
            return ["status": "purchased", "transactions": [envelope(verification, transaction)]]
        case .pending: return ["status": "pending"]
        case .userCancelled: return ["status": "cancelled"]
        @unknown default: throw PurchaseError.unavailable
        }
    }

    func transactions(restore: Bool) async throws -> [String: Any] {
        if restore { try await AppStore.sync() }
        var envelopes: [[String: String]] = []
        var seen = Set<UInt64>()
        for await result in Transaction.currentEntitlements {
            guard case .verified(let transaction) = result, transaction.productID == productID else { continue }
            seen.insert(transaction.id)
            envelopes.append(envelope(result, transaction))
        }
        // A delivery interrupted by an app close must be retried on the next launch.
        for await result in Transaction.unfinished {
            guard case .verified(let transaction) = result, transaction.productID == productID,
                  seen.insert(transaction.id).inserted else { continue }
            envelopes.append(envelope(result, transaction))
        }
        return ["status": "restored", "transactions": envelopes]
    }

    func finish(transactionID: String) async {
        for await result in Transaction.unfinished {
            guard case .verified(let transaction) = result, transaction.productID == productID,
                  String(transaction.id) == transactionID else { continue }
            await transaction.finish()
        }
    }

    func manage(in scene: UIWindowScene) async throws {
        try await AppStore.showManageSubscriptions(in: scene)
    }

    private func envelope(_ result: VerificationResult<Transaction>, _ transaction: Transaction) -> [String: String] {
        ["transactionId": String(transaction.id), "jws": result.jwsRepresentation]
    }
}
