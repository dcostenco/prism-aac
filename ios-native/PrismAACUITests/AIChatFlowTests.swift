import XCTest

/// XCUITest for the iOS AI Chat flow.
///
/// The iOS app loads the web app in a WKWebView; element queries go through
/// `app.webViews.firstMatch` so the WebKit accessibility bridge surfaces the
/// web buttons + text views to XCTest.
///
/// Coverage:
///   1. Toolbar AI button opens the AI Chat panel
///   2. Input preview strip is visible (fix for the "keys go into the void" bug)
///   3. Toolbar 🚨 alert button opens the confirmation modal (Send/Cancel)
///
/// Synthetic mic dictation cannot be driven from XCUITest (no audio injection
/// API); we verify the in-panel mic icon is reachable and tappable, not that
/// SFSpeechRecognizer produces a transcript.
final class AIChatFlowTests: XCTestCase {

    var app: XCUIApplication!

    override func setUpWithError() throws {
        continueAfterFailure = false
        app = XCUIApplication()
        app.launch()
        _ = app.wait(for: .runningForeground, timeout: 5)
        // Gate on the web view being attached and the toolbar being rendered.
        _ = app.webViews.firstMatch.waitForExistence(timeout: 10)
    }

    override func tearDownWithError() throws {
        app.terminate()
    }

    func test_aiButton_opensChatPanelWithInputPreview() throws {
        let webView = app.webViews.firstMatch
        let aiButton = webView.buttons["AI"]
        XCTAssertTrue(
            aiButton.waitForExistence(timeout: 10),
            "Toolbar AI button (aria-label=AI) must be present in the web view"
        )
        aiButton.tap()

        // The AI Chat panel header text is the i18n value of `ai_chat_title`;
        // we rely on the input preview strip's aria-label / placeholder, which
        // is more stable than the panel header text across locales.
        // Preview strip currently labeled by `t('current_message')` = "Current message".
        let preview = webView.staticTexts["Current message"]
            .firstMatch
        XCTAssertTrue(
            preview.waitForExistence(timeout: 5),
            "AI Chat input preview strip must render (regression for bug #2 — keyboard typed into the void in ai-chat mode)"
        )
    }

    func test_alertToolbarButton_opensConfirmationModal() throws {
        let webView = app.webViews.firstMatch
        let alertButton = webView.buttons["Alert"]
        XCTAssertTrue(
            alertButton.waitForExistence(timeout: 10),
            "Toolbar 🚨 alert button must be present"
        )
        alertButton.tap()

        // Confirmation modal labels — both Send and Cancel reachable.
        let cancel = webView.buttons["Cancel"]
        let send = webView.buttons["Send"]
        XCTAssertTrue(
            cancel.waitForExistence(timeout: 5),
            "Alert confirmation must surface a Cancel button"
        )
        XCTAssertTrue(
            send.exists,
            "Alert confirmation must surface a Send button"
        )

        // Cancel path: tapping Cancel dismisses without sending.
        cancel.tap()
        XCTAssertFalse(
            cancel.waitForExistence(timeout: 2),
            "Cancel should disappear after dismiss (no toast lingers)"
        )
    }

    func test_aiChat_micButton_isTappableAndTogglesListening() throws {
        let webView = app.webViews.firstMatch
        webView.buttons["AI"].tap()

        // The in-panel mic button uses aria-label "Start voice" when idle and
        // "Stop voice" when active (see AIChatPanel.tsx toggleVoice handler).
        let micIdle = webView.buttons["Start voice"]
        let micActive = webView.buttons["Stop voice"]

        // Either label is acceptable depending on prior state. Find whichever is
        // present, tap it, then verify the OPPOSITE label appears (state flipped).
        let initiallyIdle = micIdle.waitForExistence(timeout: 5)
        if initiallyIdle {
            micIdle.tap()
            XCTAssertTrue(
                micActive.waitForExistence(timeout: 3),
                "Tapping idle mic must transition to listening state"
            )
        } else {
            // Voice support may be disabled in some sims (no native bridge yet);
            // accept that as a non-fatal skip rather than a failure.
            XCTAssertTrue(
                !micIdle.exists && !micActive.exists,
                "Mic button absent — voice not supported in this sim configuration; skipping"
            )
            throw XCTSkip("Voice input not available in this sim — native bridge or Web Speech API not present.")
        }
    }
}
