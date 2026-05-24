import XCTest

/// Toolbar button coverage — verifies every toolbar button declared in
/// `components/Toolbar.tsx` (and its `DEFAULT_TOOLBAR_ORDER` from
/// `lib/toolbarConfig.ts`) is present in the rendered web view and
/// tappable without crashing the app.
///
/// Scope: presence + no-crash on tap. Functional behavior of each panel
/// is covered in panel-specific test files (AIChatFlowTests etc.).
///
/// Sync rule: when a toolbar button is added/removed/renamed in the web
/// app, this file must be updated in the SAME commit (see skill
/// `xcuitest-ios-watch` — Sync tests with UI).
final class ButtonCoverageTests: XCTestCase {

    var app: XCUIApplication!
    var webView: XCUIElement { app.webViews.firstMatch }

    /// Toolbar buttons from `lib/toolbarConfig.ts` DEFAULT_TOOLBAR_ORDER,
    /// keyed by their i18n-en aria-labels. Update both lists together.
    static let toolbarButtons: [String] = [
        "Categories", "AI", "Alert", "Settings", "History",
    ]

    override func setUpWithError() throws {
        continueAfterFailure = false
        app = XCUIApplication()
        app.launch()
        _ = app.wait(for: .runningForeground, timeout: 5)
        XCTAssertTrue(
            webView.waitForExistence(timeout: 10),
            "WKWebView must mount"
        )
        XCTAssertTrue(
            webView.buttons["Settings"].waitForExistence(timeout: 15),
            "Toolbar must be ready"
        )
    }

    override func tearDownWithError() throws { app.terminate() }

    /// Each required toolbar button must EXIST and be ENABLED.
    func testAllToolbarButtonsPresent() {
        for label in Self.toolbarButtons {
            let btn = webView.buttons[label]
            XCTAssertTrue(
                btn.waitForExistence(timeout: 5),
                "Toolbar button '\(label)' must exist"
            )
            XCTAssertTrue(
                btn.isEnabled,
                "Toolbar button '\(label)' must be enabled"
            )
        }
    }

    /// Each toolbar button must be HITTABLE — tappable without throwing.
    /// We tap and then tap again (to close the panel it opened, if any).
    /// A tap that crashes the WKWebView would terminate the app and the
    /// next setUpWithError would fail.
    func testToolbarButtonsAreHittable() {
        for label in Self.toolbarButtons {
            let btn = webView.buttons[label]
            guard btn.exists else { continue }
            XCTAssertTrue(btn.isHittable, "Toolbar button '\(label)' must be hittable")
            btn.tap()
            Thread.sleep(forTimeInterval: 0.4)
            // Close whatever opened by tapping the button again (toggle) when present.
            if webView.buttons[label].exists, label != "Settings" {
                webView.buttons[label].tap()
                Thread.sleep(forTimeInterval: 0.3)
            }
        }
    }

    // MARK: - MessageBar buttons

    /// MessageBar's primary action buttons.
    func testMessageBarActionsPresent() {
        let required = ["Speak"]  // aria-label from i18n
        for label in required {
            XCTAssertTrue(
                webView.buttons[label].waitForExistence(timeout: 5),
                "MessageBar button '\(label)' must be present"
            )
        }
    }

    // MARK: - AI Panel Inner Buttons

    /// After opening AI panel, the header's toggle buttons must be findable.
    /// iOS 26 WebKit may expose aria-pressed buttons as switches — try both.
    func testAIPanelInnerButtonsPresent() {
        webView.buttons["AI"].tap()
        // Wait until the panel is fully accessible (close button is always a plain button)
        XCTAssertTrue(
            webView.buttons["Close AI chat"].waitForExistence(timeout: 10),
            "AI panel close button must appear"
        )
        // Open Bedside Mode button (aria-pressed) — check both buttons and switches
        let asBtnBedside  = webView.buttons["Open Bedside Mode"]
        let asSwBedside   = webView.switches["Open Bedside Mode"]
        let bedsideFound  = asBtnBedside.waitForExistence(timeout: 3) || asSwBedside.exists
        XCTAssertTrue(bedsideFound, "Open Bedside Mode toggle must be findable (as button or switch)")

        // Hands-free toggle (also aria-pressed)
        let handsFreeBtn  = webView.buttons.matching(NSPredicate(format: "label CONTAINS 'hands-free'")).firstMatch
        let handsFreeSw   = webView.switches.matching(NSPredicate(format: "label CONTAINS 'hands-free'")).firstMatch
        let handsFreeFound = handsFreeBtn.waitForExistence(timeout: 3) || handsFreeSw.exists
        XCTAssertTrue(handsFreeFound, "Hands-free toggle must be findable (as button or switch)")
    }

    // MARK: - Keyboard

    /// QWERTY row must be present — verify a representative sample.
    func testKeyboardLetterButtonsPresent() {
        // aria-label uses the uppercase key from keyboardLayouts.ts (QWERTY rows are uppercase).
        // displayChar is lowercased when shift is off, but aria-label is always the layout key.
        let sample = ["Q", "W", "E", "A", "S", "D", "Z", "X", "C"]
        for letter in sample {
            XCTAssertTrue(
                webView.buttons[letter].waitForExistence(timeout: 3),
                "Keyboard letter '\(letter)' must be present (aria-label uses uppercase layout key)"
            )
        }
    }
}
