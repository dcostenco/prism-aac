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
    private var offlinePort: String?
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
        let (resetData, _) = try await URLSession.shared.data(for: reset)
        let resetState = try XCTUnwrap(JSONSerialization.jsonObject(with: resetData) as? [String: Any])
        offlinePort = (resetState["offlinePort"] as? Int).map(String.init)
        if name.contains("testStripeManagement") {
            var stripe = URLRequest(url: fixture.appendingPathComponent("stripe"))
            stripe.httpMethod = "POST"
            _ = try await URLSession.shared.data(for: stripe)
        }
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
        let attachment = XCTAttachment(data: screenshot.pngRepresentation, uniformTypeIdentifier: "public.png")
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

    private func requestBundleFault(_ phase: String) async throws {
        var url = URLComponents(url: fixture.appendingPathComponent("bundle-fault"), resolvingAgainstBaseURL: false)!
        url.queryItems = [URLQueryItem(name: "phase", value: phase)]
        var request = URLRequest(url: try XCTUnwrap(url.url))
        request.httpMethod = "POST"
        let (_, response) = try await URLSession.shared.data(for: request)
        XCTAssertEqual((response as? HTTPURLResponse)?.statusCode, 200)
    }

    private func waitForBundleFault(_ phase: String) async throws {
        let deadline = Date().addingTimeInterval(15)
        while Date() < deadline {
            if try await fixtureState()["bundleFault"] as? String == phase { return }
            try await Task.sleep(for: .milliseconds(100))
        }
        XCTFail("The isolated runner did not acknowledge bundle fault phase: \(phase)")
    }

    private func waitForFreshBillingAndEmptyComposer(after count: Int) async throws {
        XCTAssertTrue(web.buttons["Settings"].waitForExistence(timeout: 25))
        let deadline = Date().addingTimeInterval(15)
        var fresh = false
        while Date() < deadline {
            if (try await fixtureState()["billingGets"] as? Int ?? 0) > count { fresh = true; break }
            try await Task.sleep(for: .milliseconds(100))
        }
        XCTAssertTrue(fresh, "An empty composer alone cannot prove fresh account recovery ran")
        openAccount()
        XCTAssertTrue(web.staticTexts["Cloud access is active on your account."].waitForExistence(timeout: 15))
        web.buttons["Close settings"].tap()
        let composer = web.otherElements.matching(NSPredicate(format: "label BEGINSWITH %@", "Message text")).firstMatch
        XCTAssertTrue(composer.waitForExistence(timeout: 15))
        XCTAssertEqual(composer.staticTexts.count, 0, "The accessible message status must have no composed text after recovery is consumed")
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

    func testStripeManagementOpensSafariAndRetainsTheCommunicationDocument() async throws {
        // A fresh install starts on the picture board, not the keyboard.
        if !web.buttons["H"].exists {
            web.buttons.matching(NSPredicate(format: "label CONTAINS %@", "KB")).firstMatch.tap()
        }
        guard web.buttons["H"].waitForExistence(timeout: 10) else {
            XCTFail("The visible Keyboard action must expose typing"); return
        }
        // This simulator can retain a prior test's tab-local draft. Use the
        // ordinary long-press Delete action before composing this run's text.
        web.buttons["Delete"].press(forDuration: 1.6)
        web.buttons["H"].tap()
        web.buttons["I"].tap()
        XCTAssertTrue(web.staticTexts["hi"].waitForExistence(timeout: 5))
        capture("stripe-board-before")
        openAccount()
        let manage = web.buttons["Manage subscription"]
        XCTAssertTrue(manage.waitForExistence(timeout: 20))
        for _ in 0..<6 {
            if manage.isHittable { break }
            web.swipeUp()
        }
        XCTAssertTrue(manage.isHittable)
        manage.tap()
        let safari = XCUIApplication(bundleIdentifier: "com.apple.mobilesafari")
        XCTAssertTrue(safari.wait(for: .runningForeground, timeout: 15), "Stripe must leave the app-bound WebView")
        app.activate()
        let close = web.buttons["Close settings"]
        XCTAssertTrue(close.waitForExistence(timeout: 10), "Billing must not replace the live AAC document")
        close.tap()
        XCTAssertTrue(web.staticTexts["hi"].waitForExistence(timeout: 5), "The composed message must survive Safari handoff")
        XCTAssertTrue(web.buttons["H"].isHittable)
        let speak = try XCTUnwrap(web.buttons.matching(identifier: "Speak").allElementsBoundByIndex.last)
        XCTAssertTrue(speak.isHittable)
        speak.tap()
        capture("stripe-board-after")
        let state = try await fixtureState()
        XCTAssertEqual(state["manages"] as? Int, 1)
        XCTAssertEqual(state["prepares"] as? Int, 0)
        XCTAssertEqual(state["reconciliations"] as? Int, 0)
    }

    private func handOffDraftToSafari() throws {
        if !web.buttons["H"].exists {
            web.buttons.matching(NSPredicate(format: "label CONTAINS %@", "KB")).firstMatch.tap()
        }
        XCTAssertTrue(web.buttons["H"].waitForExistence(timeout: 10))
        web.buttons["Delete"].press(forDuration: 1.6)
        for letter in ["H", "E", "L", "P"] { web.buttons[letter].tap() }
        XCTAssertTrue(web.staticTexts["help"].waitForExistence(timeout: 5))
        openAccount()
        let manage = web.buttons["Manage subscription"]
        XCTAssertTrue(manage.waitForExistence(timeout: 20))
        for _ in 0..<6 {
            if manage.isHittable { break }
            web.swipeUp()
        }
        XCTAssertTrue(manage.isHittable)
        manage.tap()
        let safari = XCUIApplication(bundleIdentifier: "com.apple.mobilesafari")
        XCTAssertTrue(safari.wait(for: .runningForeground, timeout: 15))
        // Kill while Safari is foreground: no focus handler may consume the
        // protected draft before this actual process boundary.
        app.terminate()
    }

    private func bringFullAppOnline() async throws {
        var request = URLRequest(url: fixture.appendingPathComponent("online"))
        request.httpMethod = "POST"
        let (_, response) = try await URLSession.shared.data(for: request)
        XCTAssertEqual((response as? HTTPURLResponse)?.statusCode, 200)
    }

    func testStripeManagementRestoresDraftAfterProcessDeath() async throws {
        try handOffDraftToSafari()
        app.launch()
        guard web.buttons["Settings"].waitForExistence(timeout: 25) else {
            XCTFail("Relaunch did not load the communication document"); return
        }
        XCTAssertTrue(web.staticTexts["help"].waitForExistence(timeout: 15), "The same account must recover its message after process death")
        capture("billing-restart-recovered")
        let beforeConsumptionRestart = try await fixtureState()["billingGets"] as? Int ?? 0
        // No Delete or typing here: only the rendered recovery acknowledgement
        // may consume the protected record before the next process boundary.
        app.terminate()
        app.launch()
        try await waitForFreshBillingAndEmptyComposer(after: beforeConsumptionRestart)
        XCTAssertFalse(web.staticTexts["help"].exists, "A consumed billing draft must not recover twice")
        capture("billing-restart-consumed")
        if !web.buttons["H"].exists {
            web.buttons.matching(NSPredicate(format: "label CONTAINS %@", "KB")).firstMatch.tap()
        }
        web.buttons["H"].tap()
        web.buttons["I"].tap()
        XCTAssertTrue(web.staticTexts["hi"].waitForExistence(timeout: 5))
        web.buttons["Delete"].press(forDuration: 1.6)
        let beforeClearRestart = try await fixtureState()["billingGets"] as? Int ?? 0
        app.terminate()
        app.launch()
        try await waitForFreshBillingAndEmptyComposer(after: beforeClearRestart)
        XCTAssertFalse(web.staticTexts["help"].exists)
        XCTAssertFalse(web.staticTexts["hi"].exists, "Cleared new text must not return on another launch")
        capture("billing-restart-cleared")
        let state = try await fixtureState()
        XCTAssertEqual(state["manages"] as? Int, 1)
    }

    func testBundledCommunicationSurvivesOfflineReconnect() async throws {
        app.terminate()
        // The fixture reserves then closes a fresh loopback port per journey.
        // Its separate origin keeps a prior worker from hiding the bundle.
        app.launchEnvironment["PRISM_AAC_DEV_PORT"] = try XCTUnwrap(offlinePort)
        app.launch()
        let offline = web.staticTexts["Prism AAC — Offline Mode"]
        guard offline.waitForExistence(timeout: 40) else {
            XCTFail("A failed app load must expose the bundled communication board"); return
        }
        let help = try XCTUnwrap(web.buttons.matching(NSPredicate(format: "label CONTAINS %@", "Help")).allElementsBoundByIndex.last)
        XCTAssertTrue(help.isHittable)
        help.tap()
        let emptyComposer = web.staticTexts["Tap a phrase to speak"]
        XCTAssertFalse(emptyComposer.exists)
        let speak = web.buttons.matching(NSPredicate(format: "label BEGINSWITH %@", "Speak")).firstMatch
        XCTAssertTrue(speak.isHittable)
        speak.tap()
        capture("bundled-offline-before-reconnect")
        try await Task.sleep(for: .seconds(2)) // Keep this exact state available for the runner's full-size capture.
        try await bringFullAppOnline()
        web.buttons.matching(NSPredicate(format: "label CONTAINS %@", "Reconnect to full app")).firstMatch.tap()
        XCTAssertTrue(web.buttons["Settings"].waitForExistence(timeout: 40), "Reconnect must reach the online full app, not reload the bundled file")
        XCTAssertFalse(offline.exists)
        capture("bundled-offline-after-reconnect")
        try await Task.sleep(for: .seconds(2)) // Capture stabilization only, not a recovery assertion.
    }

    func testStripeManagementNativeFallbackInvalidatesOldDraft() async throws {
        try handOffDraftToSafari()
        try await requestBundleFault("requested")
        try await waitForBundleFault("blocked")
        app.launchEnvironment["PRISM_AAC_DEV_PORT"] = try XCTUnwrap(offlinePort)
        app.launch()
        let message = app.textFields["native-fallback-message"]
        guard message.waitForExistence(timeout: 40) else {
            XCTFail("Native communication must replace an unavailable web/bundled document"); return
        }
        message.tap()
        message.typeText("water")
        XCTAssertEqual(message.value as? String, "water")
        let speak = app.buttons["native-fallback-speak"]
        let stop = app.buttons["Stop"]
        let retry = app.buttons["native-fallback-retry"]
        for control in [speak, stop, retry] {
            XCTAssertGreaterThanOrEqual(control.frame.height, 44, "Fallback communication controls need accessible touch targets")
        }
        XCTAssertTrue(speak.isHittable)
        speak.tap()
        XCTAssertTrue(stop.isHittable)
        stop.tap()
        XCTAssertTrue(retry.isHittable)
        capture("native-fallback-typed")
        try await Task.sleep(for: .seconds(2)) // Stabilize the host's full-size capture.
        try await requestBundleFault("restore_requested")
        try await waitForBundleFault("restored")
        let beforeReconnect = try await fixtureState()["billingGets"] as? Int ?? 0
        // Recover on the original account origin. The fixture web build pins
        // its API to6947; another origin would fail CSP before checking auth.
        app.terminate()
        app.launchEnvironment["PRISM_AAC_DEV_PORT"] = "6947"
        app.launch()
        try await waitForFreshBillingAndEmptyComposer(after: beforeReconnect)
        XCTAssertFalse(web.staticTexts["help"].exists, "New native communication must supersede the old billing draft")
        XCTAssertFalse(message.exists)
        capture("native-fallback-relaunch-restored")
        try await Task.sleep(for: .seconds(2))
    }

    func testStripeManagementBundledMessageInvalidatesOldDraft() async throws {
        try handOffDraftToSafari()
        app.launchEnvironment["PRISM_AAC_DEV_PORT"] = try XCTUnwrap(offlinePort)
        app.launch()
        guard web.staticTexts["Prism AAC — Offline Mode"].waitForExistence(timeout: 40) else {
            XCTFail("The saved-draft journey must reach the bundled board before new communication"); return
        }
        let water = web.buttons.matching(NSPredicate(format: "label CONTAINS %@", "Water")).firstMatch
        XCTAssertTrue(water.isHittable)
        water.tap()
        web.buttons.matching(NSPredicate(format: "label BEGINSWITH %@", "Speak")).firstMatch.tap()
        capture("bundled-new-message")
        try await Task.sleep(for: .seconds(2))
        let beforeReconnect = try await fixtureState()["billingGets"] as? Int ?? 0
        app.terminate()
        app.launchEnvironment["PRISM_AAC_DEV_PORT"] = "6947"
        app.launch()
        try await waitForFreshBillingAndEmptyComposer(after: beforeReconnect)
        XCTAssertFalse(web.staticTexts["help"].exists, "New bundled communication must supersede the old billing draft")
        capture("bundled-new-message-relaunched")
        try await Task.sleep(for: .seconds(2))
        let state = try await fixtureState()
        XCTAssertEqual(state["manages"] as? Int, 1)
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
