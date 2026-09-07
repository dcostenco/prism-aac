import XCTest
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
        let attachment = XCTAttachment(screenshot: XCUIScreen.main.screenshot())
        attachment.name = name
        attachment.lifetime = .keepAlways
        add(attachment)
        let hierarchy = XCTAttachment(string: app.debugDescription)
        hierarchy.name = name + "-accessibility"
        hierarchy.lifetime = .keepAlways
        add(hierarchy)
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

    func testApplePurchaseAndRelaunchRecoveryThroughNativeBridge() async throws {
        openAccount()
        let purchase = web.buttons.matching(NSPredicate(format: "label BEGINSWITH %@", "Subscribe with Apple")).firstMatch
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
        capture("simulator-apple-purchased")
        app.terminate()
        app.launch()
        XCTAssertTrue(web.buttons["Settings"].waitForExistence(timeout: 20))
        openAccount()
        XCTAssertTrue(active.waitForExistence(timeout: 20))
        XCTAssertTrue(web.staticTexts["Cloud subscription · Active"].exists)
        XCTAssertFalse(web.staticTexts["Free"].exists)
        let restore = web.buttons["Restore Apple purchases"]
        if restore.exists {
            for _ in 0..<6 {
                if restore.isHittable { break }
                web.swipeUp()
            }
            restore.tap()
            XCTAssertTrue(active.waitForExistence(timeout: 20))
        } else { XCTFail("Native restore control must be available") }
        XCTAssertTrue(web.staticTexts["Cloud subscription · Active"].exists)
        XCTAssertFalse(web.staticTexts["Free"].exists)
        capture("simulator-apple-restored")
        let (data, _) = try await URLSession.shared.data(from: fixture.appendingPathComponent("state"))
        let state = try XCTUnwrap(JSONSerialization.jsonObject(with: data) as? [String: Any])
        XCTAssertGreaterThanOrEqual(state["reconciliations"] as? Int ?? 0, 2, "Launch/restore must redeliver the native entitlement")
        XCTAssertEqual(state["prepares"] as? Int, 1)
    }
}
