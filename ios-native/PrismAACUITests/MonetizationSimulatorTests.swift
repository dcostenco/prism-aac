import XCTest
import StoreKit
import StoreKitTest

/// Runs the real candidate WKWebView and native bridge. The local fixture
/// server supplies a test identity and delivery acknowledgement; StoreKit
/// transactions are Apple's local simulator transactions, not live purchases.
@MainActor
final class MonetizationSimulatorTests: XCTestCase {
    private var app: XCUIApplication!
    private var storeKit: SKTestSession!
    private var web: XCUIElement { app.webViews.firstMatch }
    private let fixture = URL(string: "http://localhost:6947/__simulator__/")!

    override func setUp() async throws {
        continueAfterFailure = false
        storeKit = try SKTestSession(configurationFileNamed: "AACSubscriptions")
        storeKit.resetToDefaultState()
        storeKit.disableDialogs = true
        guard storeKit.disableDialogs else {
            throw NSError(domain: "AACStoreKitTestSetup", code: 1, userInfo: [NSLocalizedDescriptionKey: "Local StoreKit configuration is not writable; stop before purchase UI"])
        }
        storeKit.clearTransactions()
        var reset = URLRequest(url: fixture.appendingPathComponent("reset"))
        reset.httpMethod = "POST"
        _ = try await URLSession.shared.data(for: reset)
        app = XCUIApplication()
        app.launchEnvironment["PRISM_AAC_DEV_PORT"] = "6947"
        // Existing preference keys skip unrelated first-run consent screens.
        app.launchArguments = ["-onboarding_complete", "YES", "-ai_consent_accepted", "YES", "-ai_declined", "YES"]
        app.launch()
        XCTAssertTrue(web.buttons["Settings"].waitForExistence(timeout: 25))
    }

    override func tearDown() async throws {
        app?.terminate()
        storeKit?.resetToDefaultState()
        storeKit?.clearTransactions()
    }

    private func capture(_ name: String) {
        let screenshot = XCUIScreen.main.screenshot()
        let attachment = XCTAttachment(screenshot: screenshot)
        attachment.name = name
        attachment.lifetime = .keepAlways
        add(attachment)
        let hierarchy = XCTAttachment(string: app.debugDescription)
        hierarchy.name = name + "-accessibility"
        hierarchy.lifetime = .keepAlways
        add(hierarchy)
        let geometry = XCTAttachment(string: "appFrame=\(app.frame); imageSize=\(screenshot.image.size); imageScale=\(screenshot.image.scale)")
        geometry.name = name + "-geometry"
        geometry.lifetime = .keepAlways
        add(geometry)
    }

    private func fixtureState() async throws -> [String: Any] {
        let (data, _) = try await URLSession.shared.data(from: fixture.appendingPathComponent("state"))
        return try XCTUnwrap(JSONSerialization.jsonObject(with: data) as? [String: Any])
    }

    private func openAccount() {
        web.buttons["Settings"].tap()
        let account = web.buttons.matching(NSPredicate(format: "label CONTAINS %@", "Synalux Account")).firstMatch
        for _ in 0..<12 {
            if account.exists && account.isHittable { break }
            web.swipeUp()
        }
        XCTAssertTrue(account.isHittable, "Account section must be reachable")
        account.tap()
    }

    func testNativeCommunicationRemainsAvailableBeyondWebPreview() async throws {
        let h = web.buttons["H"]
        XCTAssertTrue(h.waitForExistence(timeout: 5))
        h.tap()
        web.buttons["I"].tap()
        // Both MessageBar and Keyboard expose Speak. Select the keyboard's
        // final Speak element explicitly instead of an ambiguous label query.
        let speak = try XCTUnwrap(web.buttons.matching(identifier: "Speak").allElementsBoundByIndex.last)
        XCTAssertTrue(speak.isHittable)
        speak.tap()
        capture("simulator-native-communication")
        try await Task.sleep(for: .seconds(62))
        XCTAssertTrue(web.buttons["Settings"].exists)
        XCTAssertTrue(web.buttons["H"].isHittable)
        XCTAssertFalse(web.staticTexts["Sign in to continue using Prism AAC"].exists)
        capture("simulator-after-one-minute")
    }

    @available(iOS 17.2, *)
    func testApplePurchaseAndRelaunchRecoveryThroughNativeBridge() async throws {
        openAccount()
        let purchase = web.buttons.matching(NSPredicate(format: "label BEGINSWITH %@", "Start 14-day trial with Apple")).firstMatch
        XCTAssertTrue(purchase.waitForExistence(timeout: 20), "Real StoreKit product must reach the web purchase UI")
        for _ in 0..<6 {
            if purchase.isHittable { break }
            web.swipeUp()
        }
        XCTAssertTrue(purchase.label.contains("4.99"))
        XCTAssertTrue(web.staticTexts["Free"].exists, "The fixture starts without paid cloud access")
        XCTAssertFalse(web.buttons.matching(NSPredicate(format: "label CONTAINS %@", "Subscribe on the web")).firstMatch.exists)
        capture("simulator-apple-offer")
        purchase.tap()
        let active = web.staticTexts["Cloud access is active on your account."]
        XCTAssertTrue(active.waitForExistence(timeout: 30), "Native transaction must be delivered before UI unlocks")
        XCTAssertFalse(purchase.exists)
        XCTAssertTrue(web.staticTexts["Cloud subscription · Active"].exists)
        XCTAssertFalse(web.staticTexts["Free"].exists, "A verified Apple subscription must replace the legacy Free label")
        let trialDate = web.staticTexts.matching(NSPredicate(format: "label BEGINSWITH %@", "Free trial ends ")).firstMatch
        XCTAssertTrue(trialDate.waitForExistence(timeout: 15))
        let originalTrialDate = trialDate.label
        capture("simulator-apple-purchased")
        app.terminate()
        app.launch()
        XCTAssertTrue(web.buttons["Settings"].waitForExistence(timeout: 20))
        openAccount()
        XCTAssertTrue(active.waitForExistence(timeout: 20))
        XCTAssertTrue(web.staticTexts["Cloud subscription · Active"].exists)
        XCTAssertFalse(web.staticTexts["Free"].exists)
        XCTAssertEqual(trialDate.label, originalTrialDate, "Relaunch must retain Apple's original confirmed trial date")
        let restore = web.buttons["Restore Apple purchases"]
        if restore.exists {
            for _ in 0..<6 {
                if restore.isHittable { break }
                web.swipeUp()
            }
            XCTAssertTrue(restore.isHittable)
            XCTAssertTrue(trialDate.isHittable, "The relaunch capture must visibly show the original trial date")
            XCTAssertTrue(active.isHittable)
            capture("simulator-apple-relaunched")
            // Only explicit restore calls AppStore.sync; automatic recovery uses
            // current entitlements. This discriminator catches a no-op Restore
            // even when the panel was Active before the button was pressed.
            let beforeFailure = try await fixtureState()
            try await storeKit.setSimulatedError(.generic(.networkError(URLError(.notConnectedToInternet))), forAPI: .appStoreSync)
            restore.tap()
            let restoreError = web.staticTexts.matching(NSPredicate(format: "label CONTAINS %@", "NSURLErrorDomain error -1009")).firstMatch
            XCTAssertTrue(restoreError.waitForExistence(timeout: 15), "The explicit Restore must surface its actual AppStore.sync failure")
            let failedState = try await fixtureState()
            XCTAssertEqual(failedState["reconciliations"] as? Int, beforeFailure["reconciliations"] as? Int,
                "A failed AppStore.sync must not acknowledge an entitlement")
            XCTAssertEqual(trialDate.label, originalTrialDate)
            capture("simulator-apple-restore-failed")
            try await storeKit.setSimulatedError(nil, forAPI: .appStoreSync)
            let baseline = try await fixtureState()
            let count = baseline["reconciliations"] as? Int ?? 0
            let tapTime = Date().timeIntervalSince1970 * 1000
            restore.tap()
            var acknowledged = false
            var restoreState: [String: Any]?
            for _ in 0..<40 {
                let current = try await fixtureState()
                let transactions = current["transactions"] as? [[String: Any]] ?? []
                if (current["reconciliations"] as? Int ?? 0) > count,
                   transactions.contains(where: { ($0["acknowledgedAt"] as? Double ?? 0) >= tapTime }) {
                    acknowledged = true; restoreState = current; break
                }
                try await Task.sleep(for: .milliseconds(250))
            }
            XCTAssertTrue(acknowledged, "This Restore tap must produce a new acknowledgement, not reuse purchase or relaunch state")
            let proof: [String: Any] = ["baselineReconciliations": count, "tappedAt": tapTime,
                "acknowledgedState": try XCTUnwrap(restoreState)]
            let attachment = XCTAttachment(data: try JSONSerialization.data(withJSONObject: proof, options: [.sortedKeys]),
                uniformTypeIdentifier: "public.json")
            attachment.name = "explicit-restore-acknowledgement"
            attachment.lifetime = .keepAlways
            add(attachment)
            XCTAssertTrue(active.waitForExistence(timeout: 20))
            XCTAssertFalse(restoreError.exists, "A successful retry clears the prior restore error")
        } else { XCTFail("Native restore control must be available") }
        XCTAssertTrue(web.staticTexts["Cloud subscription · Active"].exists)
        XCTAssertFalse(web.staticTexts["Free"].exists)
        XCTAssertEqual(trialDate.label, originalTrialDate, "Restore must not restart the fourteen-day trial")
        capture("simulator-apple-restored")
        let state = try await fixtureState()
        XCTAssertGreaterThanOrEqual(state["reconciliations"] as? Int ?? 0, 2, "Launch/restore must redeliver the native entitlement")
        XCTAssertEqual(state["prepares"] as? Int, 1)
    }
}
