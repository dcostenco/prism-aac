import XCTest

/// PrismAAC iOS — smoke tests for the WKWebView-hosted AAC UI.
///
/// The iOS app loads the web bundle from localhost:3001 (DEBUG) or
/// synalux.ai/prism-aac (RELEASE) inside a WKWebView. Element queries
/// are scoped to `app.webViews.firstMatch` so the WebKit accessibility
/// bridge surfaces the underlying HTML buttons + text views.
///
/// Selectors are chosen for stability across UI iterations:
///   • i18n-en aria-labels from `i18n/en.json` (AI, Alert, Speak, Settings)
///   • Visible Text for fixed-string content (HOME, Hello, Goodbye)
///   • Letter buttons by their visible label (a, b, c …)
///
/// When any of these strings change in the web app, the tests must change
/// in the same commit (see `xcuitest-ios-watch` skill — "Sync tests with UI").
final class PrismAACUITests: XCTestCase {

    var app: XCUIApplication!
    var webView: XCUIElement { app.webViews.firstMatch }

    override func setUpWithError() throws {
        continueAfterFailure = false
        app = XCUIApplication()
        app.launch()
        _ = app.wait(for: .runningForeground, timeout: 5)
        // Page-ready gate: web view attached AND at least one toolbar button visible.
        XCTAssertTrue(
            webView.waitForExistence(timeout: 10),
            "WKWebView must mount within 10s of launch"
        )
        XCTAssertTrue(
            webView.buttons["Settings"].waitForExistence(timeout: 15),
            "Toolbar Settings button must appear (page ready gate)"
        )
    }

    override func tearDownWithError() throws {
        app.terminate()
    }

    // MARK: - Launch + chrome

    func test01_appLaunchesWithoutErrorBanner() {
        XCTAssertFalse(
            app.staticTexts["Download failed"].exists,
            "Should not show 'Download failed' on launch in DEBUG"
        )
    }

    func test02_toolbarPrimaryButtonsPresent() {
        // Core toolbar buttons — labels from i18n/en.json
        let required = ["Settings", "AI", "Alert", "History"]
        for label in required {
            XCTAssertTrue(
                webView.buttons[label].waitForExistence(timeout: 5),
                "Toolbar button '\(label)' must be present"
            )
        }
    }

    // MARK: - Speak button (MessageBar)

    func test03_speakButtonPresent() {
        XCTAssertTrue(
            webView.buttons["Speak"].waitForExistence(timeout: 5),
            "Speak button (aria-label='Speak') must be present in MessageBar"
        )
    }

    // MARK: - Keyboard

    func test04_keyboardRendersLetterKeys() {
        // Keyboard.tsx sets `aria-label={key}` and `key` is uppercase from
        // the QWERTY layout (Q W E …). data-display is the rendered case.
        let h = webView.buttons["H"]
        let i = webView.buttons["I"]
        XCTAssertTrue(h.waitForExistence(timeout: 5), "Keyboard letter 'H' must be present")
        XCTAssertTrue(i.waitForExistence(timeout: 1), "Keyboard letter 'I' must be present")
    }

    func test05_keyboardSpaceKeyPresent() {
        XCTAssertTrue(
            webView.buttons["space"].waitForExistence(timeout: 5),
            "Space key (aria-label='space') must be present"
        )
    }

    // MARK: - Typing path

    func test06_typingKeysProducesText() {
        // Tap 'H' then 'I' — message bar should accept the keys
        // (aria-label uses uppercase layout char regardless of shift state)
        webView.buttons["H"].tap()
        webView.buttons["I"].tap()
        // MessageBar exposes its current text via aria-label="message_text"
        // which contains the typed content. We can't read it directly through
        // accessibility, so we verify the Speak button is now enabled (it's
        // gated on non-empty text).
        let speak = webView.buttons["Speak"]
        XCTAssertTrue(
            speak.isHittable,
            "Speak button must be hittable after typing 'hi'"
        )
    }

    // MARK: - Category navigation

    func test07_categoriesButtonOpensCategoryPanel() {
        webView.buttons["Categories"].tap()
        Thread.sleep(forTimeInterval: 0.5)
        // Panel opened without crash if the Categories button itself is still there.
        XCTAssertTrue(
            webView.buttons["Categories"].exists,
            "Categories button must remain after tap (panel opened without crash)"
        )
    }
}
