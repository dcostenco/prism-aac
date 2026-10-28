import Foundation
import StoreKit
import UIKit

/// StoreKit is the native purchase channel; the portal owns shared account access.
/// Leave successful transactions unfinished until the portal confirms delivery.
@MainActor
final class AACSubscriptionStore {
    static let shared = AACSubscriptionStore()
    static let subscriptionManagementURL = "https://account.apple.com/account/manage/section/subscriptions"
    private var listener: Task<Void, Never>?
    var onTransactionsChanged: (() -> Void)?

    private var productID: String {
        Bundle.main.object(forInfoDictionaryKey: "AACMonthlyProductID") as? String ?? ""
    }

    enum PurchaseError: LocalizedError {
        case unavailable, unverified, accountMismatch, alreadySubscribed, sandboxManagementOnMac
        var errorDescription: String? {
            switch self {
            case .unavailable: return "The subscription is unavailable. Please try again."
            case .unverified: return "Apple could not verify this purchase. Please try Restore Purchases."
            case .accountMismatch: return "This Apple subscription belongs to a different AAC account. Sign in to that account to restore it."
            case .alreadySubscribed: return "You already have this Apple subscription. Use Restore Purchases."
            case .sandboxManagementOnMac: return "Apple does not support the subscription sheet on this Mac. Manage Sandbox subscriptions on an iPhone or iPad in Settings > Developer > Sandbox Apple Account > Manage. For local StoreKit tests, use Xcode's transaction manager."
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

    func product(accountToken: UUID? = nil) async throws -> [String: Any] {
        let product = try await loadProduct()
        guard let subscription = product.subscription,
              subscription.subscriptionPeriod.unit == .month,
              subscription.subscriptionPeriod.value == 1 else { throw PurchaseError.unavailable }
        let offer = subscription.introductoryOffer
        let eligible = await subscription.isEligibleForIntroOffer
        var days = 0
        if let offer, offer.paymentMode == .freeTrial {
            switch offer.period.unit {
            case .day: days = offer.period.value * offer.periodCount
            case .week: days = offer.period.value * offer.periodCount * 7
            default: break // Never approximate calendar months as days.
            }
        }
        var result: [String: Any] = ["id": product.id, "displayName": product.displayName,
            "displayPrice": product.displayPrice, "introductoryOfferEligible": eligible,
            "introductoryTrialDays": days]
        // Transaction dates are display-only. The private service still verifies
        // and owns access. Never display another AAC account's trial on a shared device.
        for await verification in Transaction.currentEntitlements {
            guard case .verified(let transaction) = verification,
                  transaction.productID == product.id,
                  transaction.revocationDate == nil, let expires = transaction.expirationDate,
                  expires > .now else { continue }
            // Eligibility can lag a completed purchase. An active Apple subscription
            // cannot start another introductory offer, even on a different AAC account.
            result["introductoryOfferEligible"] = false
            guard let accountToken, transaction.appAccountToken == accountToken else { continue }
            if #available(iOS 17.2, *), transaction.offer?.type == .introductory,
               transaction.offer?.paymentMode == .freeTrial {
                result["trialEndsAt"] = ISO8601DateFormatter().string(from: expires)
            }
        }
        return result
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
        #if targetEnvironment(macCatalyst)
        let onMac = true
        #else
        let onMac = ProcessInfo.processInfo.isiOSAppOnMac
        #endif
        var environment: AppStore.Environment?
        if onMac, case .verified(let transaction)? = await Transaction.latest(for: productID) {
            environment = transaction.environment
        }
        try await Self.manage(onMac: onMac, environment: environment,
            openExternal: { await UIApplication.shared.open($0) },
            showSheet: { try await AppStore.showManageSubscriptions(in: scene) })
    }

    static func manage(onMac: Bool, environment: AppStore.Environment?,
                       openExternal: (URL) async -> Bool, showSheet: () async throws -> Void) async throws {
        // Apple's in-app subscription sheet is unsupported in iOS-on-Mac and Catalyst.
        guard onMac else { try await showSheet(); return }
        // The regular App Store account page cannot manage a Sandbox test purchase.
        guard environment != .sandbox, environment != .xcode else { throw PurchaseError.sandboxManagementOnMac }
        guard let url = URL(string: subscriptionManagementURL), await openExternal(url) else {
            throw PurchaseError.unavailable
        }
    }

    private func envelope(_ result: VerificationResult<Transaction>, _ transaction: Transaction) -> [String: String] {
        ["transactionId": String(transaction.id), "jws": result.jwsRepresentation]
    }
}

/// What the bundled offline page may show, as the web app last learned it.
///
/// The web lock reports after each answer from the server: whether the
/// paid-only policy has been seen in force, and until when this device's
/// offline lease is valid. The offline page then mirrors the web lock offline:
/// the full offline board when the policy was never seen or the lease is still
/// valid; otherwise only the Help / Needs safety phrases, which stay usable in
/// every state. With nothing recorded the page stays full.
struct OfflineAccess: Codable, Equatable {
    var policySeen: Bool
    /// Lease expiry in milliseconds since 1970, or nil when there is no lease.
    var leaseUntilMs: Double?

    static let defaultsKey = "prism-aac-offline-access"

    func fullBoard(nowMs: Double) -> Bool {
        if !policySeen { return true }
        guard let until = leaseUntilMs else { return false }
        return until > nowMs
    }

    /// Reads the bridge message body; nil when malformed.
    init?(message state: [String: Any]) {
        guard let seen = state["policySeen"] as? Bool else { return nil }
        policySeen = seen
        if let until = state["leaseUntil"] as? Double, until.isFinite, until > 0 { leaseUntilMs = until }
        else if state["leaseUntil"] == nil || state["leaseUntil"] is NSNull { leaseUntilMs = nil }
        else { return nil }
    }

    init(policySeen: Bool, leaseUntilMs: Double?) {
        self.policySeen = policySeen
        self.leaseUntilMs = leaseUntilMs
    }

    static func load(_ defaults: UserDefaults = .standard) -> OfflineAccess? {
        guard let data = defaults.data(forKey: defaultsKey) else { return nil }
        return try? JSONDecoder().decode(OfflineAccess.self, from: data)
    }

    func save(_ defaults: UserDefaults = .standard) {
        if let data = try? JSONEncoder().encode(self) { defaults.set(data, forKey: Self.defaultsKey) }
    }

    /// Whether the offline page shows the full board right now.
    static func offlineFullBoard(_ defaults: UserDefaults = .standard, nowMs: Double = Date().timeIntervalSince1970 * 1000) -> Bool {
        load(defaults)?.fullBoard(nowMs: nowMs) ?? true
    }

    /// The offline document with the decision injected before its own script.
    static func offlineDocument(_ html: String, fullBoard: Bool) -> String {
        let script = "<script>window.prismOfflineAccess={fullBoard:\(fullBoard ? "true" : "false")};</script>"
        guard let range = html.range(of: "</head>") else { return script + html }
        return html.replacingCharacters(in: range, with: script + "</head>")
    }
}
