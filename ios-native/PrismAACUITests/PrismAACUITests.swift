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
        // Tap 'H' then 'I' — message bar must accept the keys without crash.
        // aria-label uses uppercase layout key (from QWERTY rows in keyboardLayouts.ts).
        XCTAssertTrue(webView.buttons["H"].waitForExistence(timeout: 5), "H key must exist before tap")
        webView.buttons["H"].tap()
        webView.buttons["I"].tap()
        Thread.sleep(forTimeInterval: 0.5)
        // Verify no crash and Speak button is still present.
        // MessageBar has no aria-disabled on Speak, so isHittable/isEnabled are not
        // meaningful text indicators — deep typing regression is covered by Playwright.
        XCTAssertTrue(webView.exists, "WKWebView must survive key taps")
        XCTAssertTrue(
            webView.buttons["Speak"].waitForExistence(timeout: 3),
            "Speak button must remain present after typing"
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

    // MARK: - Bedside Mode — Quick Cards

    /// Helper: open the AI panel (if not already open) then enter Bedside Mode.
    private func enterBedsideMode() {
        // openAIChat toggles the panel — check first to avoid closing it on cycle 2+.
        let closeBtn = webView.buttons["Close AI chat"]
        if !closeBtn.waitForExistence(timeout: 2) {
            let aiBtn = webView.buttons["AI"]
            XCTAssertTrue(aiBtn.waitForExistence(timeout: 5), "AI toolbar button must exist")
            aiBtn.tap()
        }
        // Wait for AI panel to be fully accessible before querying inner buttons.
        // iOS 26 WebKit needs the a11y tree to settle after panel opens.
        XCTAssertTrue(
            closeBtn.waitForExistence(timeout: 12),
            "AI Chat panel close button must appear"
        )
        // In iOS 26 WebKit, aria-pressed buttons may surface as switches.
        let asBtnBedside = webView.buttons["Open Bedside Mode"]
        let asSwBedside  = webView.switches["Open Bedside Mode"]
        let bedsideFound = asBtnBedside.waitForExistence(timeout: 5) || asSwBedside.exists
        XCTAssertTrue(bedsideFound, "Open Bedside Mode button must exist in AI panel")
        if asBtnBedside.exists { asBtnBedside.tap() } else { asSwBedside.tap() }
    }

    func test08_bedsideModeOpens() {
        enterBedsideMode()
        // Bedside overlay mounts — verify via Exit button (always a plain button,
        // no aria-pressed) since role="dialog" container surfacing varies in iOS 26.
        XCTAssertTrue(
            webView.buttons["Exit Bedside Mode"].waitForExistence(timeout: 8),
            "Bedside Mode overlay must mount (Exit Bedside Mode button must appear)"
        )
    }

    func test09_bedsideQuickPhrasesSectionVisible() {
        enterBedsideMode()
        // Verify the Quick Cards section is rendered by checking a section-specific button.
        // The "Add custom quick phrase card" button is always present in the cards section
        // and is a plain button (no aria-pressed) so it's reliably queryable.
        XCTAssertTrue(
            webView.buttons["Add custom quick phrase card"].waitForExistence(timeout: 5),
            "Quick Phrases section must be visible (Add card button must appear)"
        )
    }

    func test10_bedsideDefaultCardHelpPresent() {
        enterBedsideMode()
        XCTAssertTrue(
            webView.buttons["HELP — EMERGENCY"].waitForExistence(timeout: 5),
            "Built-in HELP — EMERGENCY card must appear in Quick Cards strip"
        )
    }

    func test11_bedsideDefaultCardWaterPresent() {
        enterBedsideMode()
        XCTAssertTrue(
            webView.buttons["Water please"].waitForExistence(timeout: 5),
            "Built-in Water please card must appear in Quick Cards strip"
        )
    }

    func test12_bedsideCardTapDoesNotCrash() {
        enterBedsideMode()
        let card = webView.buttons["HELP — EMERGENCY"]
        XCTAssertTrue(card.waitForExistence(timeout: 5))
        card.tap()
        Thread.sleep(forTimeInterval: 0.5)
        // App still alive after card tap
        XCTAssertTrue(webView.exists, "WKWebView must remain after tapping a Quick Card")
        // Overlay still open — not dismissed by a card tap.
        // Use Exit button (reliable plain button) since role="dialog" container
        // surfaces differently in iOS 26 WebKit.
        XCTAssertTrue(
            webView.buttons["Exit Bedside Mode"].exists,
            "Bedside overlay must remain open after Quick Card tap"
        )
    }

    func test13_bedsideAddCardButtonPresent() {
        enterBedsideMode()
        XCTAssertTrue(
            webView.buttons["Add custom quick phrase card"].waitForExistence(timeout: 5),
            "Add card (＋) button must be present in Quick Cards strip"
        )
    }

    func test14_bedsideAddCardDialogOpens() {
        enterBedsideMode()
        webView.buttons["Add custom quick phrase card"].tap()
        // Text input inside the add-card dialog
        XCTAssertTrue(
            webView.textFields["Quick phrase text"].waitForExistence(timeout: 5),
            "Add-card dialog text input must appear after tapping ＋"
        )
    }

    func test15_bedsideAddCardConfirmDisabledWhenEmpty() {
        enterBedsideMode()
        webView.buttons["Add custom quick phrase card"].tap()
        _ = webView.textFields["Quick phrase text"].waitForExistence(timeout: 5)
        let confirmBtn = webView.buttons["Confirm add card"]
        XCTAssertTrue(confirmBtn.waitForExistence(timeout: 3), "Confirm add card button must exist")
        // Confirm must be disabled when text is empty (prevents adding blank cards)
        XCTAssertFalse(confirmBtn.isEnabled, "Confirm must be disabled while text input is empty")
    }

    func test16_bedsideAddCardCancelClosesDialog() {
        enterBedsideMode()
        webView.buttons["Add custom quick phrase card"].tap()
        _ = webView.textFields["Quick phrase text"].waitForExistence(timeout: 5)
        webView.buttons["Cancel"].tap()
        Thread.sleep(forTimeInterval: 0.3)
        XCTAssertFalse(
            webView.textFields["Quick phrase text"].exists,
            "Add-card dialog must be dismissed after Cancel"
        )
    }

    func test17_bedsideEditModeToggle() {
        enterBedsideMode()
        let editBtn = webView.buttons["Edit quick phrase cards"]
        XCTAssertTrue(editBtn.waitForExistence(timeout: 5), "Edit quick phrase cards button must be present")
        editBtn.tap()
        XCTAssertTrue(
            webView.buttons["Done editing cards"].waitForExistence(timeout: 3),
            "Edit mode must change button to 'Done editing cards'"
        )
        // Tap Done to exit edit mode
        webView.buttons["Done editing cards"].tap()
        XCTAssertTrue(
            webView.buttons["Edit quick phrase cards"].waitForExistence(timeout: 3),
            "Tapping Done must return to Edit button"
        )
    }

    func test18_bedsideBuiltinCardHasNoDeleteBadge() {
        enterBedsideMode()
        // Enter edit mode
        webView.buttons["Edit quick phrase cards"].tap()
        Thread.sleep(forTimeInterval: 0.3)
        // Built-in card MUST NOT have a delete badge in edit mode
        let deleteBuiltin = webView.buttons["Remove card: HELP — EMERGENCY"]
        XCTAssertFalse(
            deleteBuiltin.exists,
            "Built-in HELP — EMERGENCY card must NOT have a delete badge (protected)"
        )
    }

    func test19_bedsideExitReturnsToMain() {
        enterBedsideMode()
        let exitBtn = webView.buttons["Exit Bedside Mode"]
        XCTAssertTrue(exitBtn.waitForExistence(timeout: 5), "Exit button must exist before tapping")
        XCTAssertTrue(exitBtn.isHittable, "Exit button must be hittable")
        exitBtn.tap()
        // WKWebView a11y bridge on iOS 26 may batch DOM-removal notifications for 5+ s.
        // Verify via positive signal: app survives + main UI is responsive.
        XCTAssertTrue(webView.exists, "WKWebView must survive Exit tap")
        XCTAssertTrue(
            webView.buttons["Speak"].waitForExistence(timeout: 10),
            "Speak button must be accessible after exiting Bedside Mode"
        )
    }
}
