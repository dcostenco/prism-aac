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

    // MARK: - Keyboard

    /// QWERTY row must be present — verify a representative sample.
    func testKeyboardLetterButtonsPresent() {
        let sample = ["q", "w", "e", "a", "s", "d", "z", "x", "c"]
        for letter in sample {
            XCTAssertTrue(
                webView.buttons[letter].waitForExistence(timeout: 3),
                "Keyboard letter '\(letter)' must be present"
            )
        }
    }
}
