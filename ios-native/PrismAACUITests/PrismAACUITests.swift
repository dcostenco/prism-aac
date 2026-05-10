import XCTest

/// UI Tests for PrismAAC — runs across all iPhone/iPad/Watch simulator types.
///
/// Test coverage:
///   1. App launch — main AAC UI renders (not stuck on download screen)
///   2. Message bar — visible, placeholder text correct
///   3. Category tabs — all 4 tabs present and tappable
///   4. Phrase grid — phrases render, tap builds message
///   5. Speak button — enabled after text added, disabled when empty
///   6. Clear button — clears composed message
///   7. Keyboard — QWERTY renders, letter keys type into message bar
///   8. AI button — present (cloud path active in DEBUG)
///   9. Category switching — switching tabs changes phrase grid
///  10. Accessibility — all interactive elements have accessibility labels

final class PrismAACUITests: XCTestCase {

    var app: XCUIApplication!

    override func setUpWithError() throws {
        continueAfterFailure = false
        app = XCUIApplication()
        app.launch()
        // Give the app 3s to settle after launch
        _ = app.wait(for: .runningForeground, timeout: 5)
    }

    override func tearDownWithError() throws {
        app.terminate()
    }

    // MARK: - 1. Launch

    func test01_AppLaunchShowsMainUI() {
        // Should show phrase board, not download/loading screen
        XCTAssertFalse(
            app.staticTexts["Download failed"].exists,
            "Should not show download failed in DEBUG mode"
        )
        XCTAssertFalse(
            app.staticTexts["Checking device memory…"].exists,
            "Should skip model loading in DEBUG"
        )
        // Main UI marker: the message bar placeholder
        let placeholder = app.staticTexts["Tap to build a message…"]
        XCTAssertTrue(
            placeholder.waitForExistence(timeout: 5),
            "Message bar placeholder must be visible after launch"
        )
    }

    // MARK: - 2. Message bar

    func test02_MessageBarSpeakDisabledWhenEmpty() {
        let speak = app.buttons["Speak"]
        XCTAssertTrue(speak.waitForExistence(timeout: 5), "Speak button must exist")
        XCTAssertFalse(speak.isEnabled, "Speak must be disabled when no text")
    }

    func test02b_MessageBarClearExists() {
        XCTAssertTrue(
            app.buttons["Clear"].waitForExistence(timeout: 5),
            "Clear button must exist in message bar"
        )
    }

    // MARK: - 3. Category tabs

    func test03_AllCategoryTabsVisible() {
        let tabs = ["Quick", "Feelings", "Needs", "Places"]
        for tab in tabs {
            XCTAssertTrue(
                app.buttons[tab].waitForExistence(timeout: 5),
                "Category tab '\(tab)' must be visible"
            )
        }
    }

    func test03b_CategoryTabsAreTappable() {
        let tabs = ["Feelings", "Needs", "Places", "Quick"]
        for tab in tabs {
            let btn = app.buttons[tab]
            XCTAssertTrue(btn.waitForExistence(timeout: 3))
            btn.tap()
            // Brief settle
            Thread.sleep(forTimeInterval: 0.3)
        }
    }

    // MARK: - 4. Phrase grid

    func test04_QuickPhrasesVisible() {
        let phrases = ["Yes", "No", "More", "Stop", "Help", "Wait"]
        for phrase in phrases {
            XCTAssertTrue(
                app.buttons[phrase].waitForExistence(timeout: 5),
                "Quick phrase '\(phrase)' must be visible"
            )
        }
    }

    func test04b_TappingPhraseBuildsMessage() {
        let yes = app.buttons["Yes"]
        XCTAssertTrue(yes.waitForExistence(timeout: 5))
        yes.tap()
        // Message bar should now show "Yes" (not the placeholder)
        XCTAssertFalse(
            app.staticTexts["Tap to build a message…"].exists,
            "Placeholder should disappear after tapping a phrase"
        )
        XCTAssertTrue(
            app.staticTexts["Yes"].waitForExistence(timeout: 3),
            "Tapped phrase text should appear in message bar"
        )
    }

    // MARK: - 5. Speak button enabled after phrase tap

    func test05_SpeakEnabledAfterPhraseTap() {
        app.buttons["Yes"].waitForExistence(timeout: 5)
        app.buttons["Yes"].tap()
        let speak = app.buttons["Speak"]
        XCTAssertTrue(speak.waitForExistence(timeout: 3))
        XCTAssertTrue(speak.isEnabled, "Speak must be enabled after composing text")
    }

    // MARK: - 6. Clear button

    func test06_ClearButtonRemovesText() {
        app.buttons["Yes"].waitForExistence(timeout: 5)
        app.buttons["Yes"].tap()
        app.buttons["Clear"].tap()
        XCTAssertTrue(
            app.staticTexts["Tap to build a message…"].waitForExistence(timeout: 3),
            "Placeholder should return after clearing"
        )
        XCTAssertFalse(app.buttons["Speak"].isEnabled, "Speak must be disabled after clear")
    }

    // MARK: - 7. Keyboard

    func test07_QWERTYRowVisible() {
        // Top row keys
        let topRowKeys = ["Q", "W", "E", "R", "T"]
        for key in topRowKeys {
            XCTAssertTrue(
                app.buttons[key].waitForExistence(timeout: 5),
                "Keyboard key '\(key)' must be visible"
            )
        }
    }

    func test07b_TypingOnKeyboardBuildsMessage() {
        app.buttons["H"].waitForExistence(timeout: 5)
        app.buttons["H"].tap()
        app.buttons["I"].tap()
        XCTAssertFalse(
            app.staticTexts["Tap to build a message…"].exists,
            "Placeholder should disappear after typing"
        )
    }

    func test07c_SpaceKeyExists() {
        XCTAssertTrue(
            app.buttons["space"].waitForExistence(timeout: 5),
            "Space key must be visible"
        )
    }

    func test07d_BackspaceKeyExists() {
        XCTAssertTrue(
            app.buttons["Delete"].waitForExistence(timeout: 5) ||
            app.buttons["⌫"].waitForExistence(timeout: 1),
            "Backspace/delete key must be visible"
        )
    }

    // MARK: - 8. AI button

    func test08_AIButtonVisible() {
        XCTAssertTrue(
            app.buttons["AI ✦"].waitForExistence(timeout: 5),
            "AI button must be visible (cloud path)"
        )
    }

    // MARK: - 9. Category content changes on switch

    func test09_FeelingsCategoryHasCorrectPhrases() {
        app.buttons["Feelings"].waitForExistence(timeout: 5)
        app.buttons["Feelings"].tap()
        Thread.sleep(forTimeInterval: 0.5)
        XCTAssertTrue(
            app.buttons["Happy"].waitForExistence(timeout: 3),
            "Feelings category must show 'Happy'"
        )
        XCTAssertTrue(
            app.buttons["Sad"].waitForExistence(timeout: 3),
            "Feelings category must show 'Sad'"
        )
    }

    func test09b_NeedsCategoryHasCorrectPhrases() {
        app.buttons["Needs"].waitForExistence(timeout: 5)
        app.buttons["Needs"].tap()
        Thread.sleep(forTimeInterval: 0.5)
        XCTAssertTrue(
            app.buttons["Water"].waitForExistence(timeout: 3) ||
            app.buttons["Bathroom"].waitForExistence(timeout: 1),
            "Needs category must show 'Water' or 'Bathroom'"
        )
    }

    // MARK: - 10. Accessibility

    func test10_SpeakButtonHasAccessibilityLabel() {
        let speak = app.buttons["Speak"]
        XCTAssertTrue(speak.waitForExistence(timeout: 5))
        XCTAssertFalse(speak.label.isEmpty, "Speak button must have accessibility label")
    }

    func test10b_ClearButtonHasAccessibilityLabel() {
        let clear = app.buttons["Clear"]
        XCTAssertTrue(clear.waitForExistence(timeout: 5))
        XCTAssertFalse(clear.label.isEmpty, "Clear button must have accessibility label")
    }
}

// MARK: - Watch UI Tests (separate target, runs on watchOS simulator)

final class PrismAACWatchUITests: XCTestCase {

    var app: XCUIApplication!

    override func setUpWithError() throws {
        continueAfterFailure = false
        app = XCUIApplication()
        app.launch()
        _ = app.wait(for: .runningForeground, timeout: 8)
    }

    override func tearDownWithError() throws { app.terminate() }

    func testW01_FirstCardIsYes() {
        XCTAssertTrue(
            app.staticTexts["Yes"].waitForExistence(timeout: 8),
            "First pictogram card must show 'Yes'"
        )
    }

    func testW02_SOSButtonAlwaysVisible() {
        XCTAssertTrue(
            app.buttons["SOS"].waitForExistence(timeout: 5) ||
            app.images["sos"].waitForExistence(timeout: 5),
            "SOS button must always be visible"
        )
    }

    func testW03_SwipeShowsNextCard() {
        app.staticTexts["Yes"].waitForExistence(timeout: 8)
        app.swipeLeft()
        Thread.sleep(forTimeInterval: 0.8)
        // After swipe, a different card should show
        XCTAssertTrue(
            app.staticTexts["No"].waitForExistence(timeout: 3) ||
            app.staticTexts["More"].waitForExistence(timeout: 3),
            "Swiping must show next pictogram card"
        )
    }

    func testW04_TapCardSpeaks() {
        // Tapping a card should trigger speak (AVSpeechSynthesizer)
        // We can only verify the tap doesn't crash
        app.staticTexts["Yes"].waitForExistence(timeout: 8)
        app.staticTexts["Yes"].firstMatch.tap()
        Thread.sleep(forTimeInterval: 1)
        // App still running = no crash
        XCTAssertEqual(app.state, .runningForeground, "App should stay running after tap")
    }
}
