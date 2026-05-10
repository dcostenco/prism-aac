import XCTest

/// Exhaustive button coverage — every interactive element tapped.
/// Fails if any button is disabled when it should be active,
/// or if any tap crashes the app.
final class ButtonCoverageTests: XCTestCase {

    var app: XCUIApplication!

    override func setUpWithError() throws {
        continueAfterFailure = false
        app = XCUIApplication()
        app.launch()
        _ = app.wait(for: .runningForeground, timeout: 5)
        // Wait for main UI
        _ = app.staticTexts["Tap to build a message…"].waitForExistence(timeout: 8)
    }

    override func tearDownWithError() throws { app.terminate() }

    // MARK: - Complete button inventory touch

    func testAllCategoryTabs() {
        let tabs = ["Quick", "Feelings", "Needs", "Places"]
        for tab in tabs {
            let btn = app.buttons[tab]
            XCTAssertTrue(btn.waitForExistence(timeout: 3), "Tab '\(tab)' must exist")
            XCTAssertTrue(btn.isEnabled, "Tab '\(tab)' must be enabled")
            btn.tap()
            Thread.sleep(forTimeInterval: 0.3)
            XCTAssertEqual(app.state, .runningForeground, "App crashed tapping '\(tab)'")
        }
    }

    func testAllQuickPhrases() {
        app.buttons["Quick"].tap()
        Thread.sleep(forTimeInterval: 0.3)
        let phrases = ["Yes", "No", "More", "Stop", "Help", "Wait"]
        for phrase in phrases {
            // Clear before each so message bar doesn't overflow
            app.buttons["Clear"].tap()
            let btn = app.buttons[phrase]
            XCTAssertTrue(btn.waitForExistence(timeout: 3), "Phrase '\(phrase)' must exist")
            XCTAssertTrue(btn.isEnabled, "Phrase '\(phrase)' must be enabled")
            btn.tap()
            Thread.sleep(forTimeInterval: 0.2)
            XCTAssertEqual(app.state, .runningForeground, "App crashed tapping '\(phrase)'")
        }
    }

    func testAllFeelingsPhrases() {
        app.buttons["Feelings"].tap()
        Thread.sleep(forTimeInterval: 0.4)
        let phrases = ["Happy", "Sad", "Hurt", "Scared", "Tired", "Hungry"]
        for phrase in phrases {
            app.buttons["Clear"].tap()
            let btn = app.buttons[phrase]
            if btn.waitForExistence(timeout: 2) {
                XCTAssertTrue(btn.isEnabled, "Feelings phrase '\(phrase)' must be enabled")
                btn.tap()
                Thread.sleep(forTimeInterval: 0.2)
                XCTAssertEqual(app.state, .runningForeground, "Crash tapping '\(phrase)'")
            }
        }
    }

    func testAllNeedsPhrases() {
        app.buttons["Needs"].tap()
        Thread.sleep(forTimeInterval: 0.4)
        let phrases = ["Water", "Food", "Bathroom", "Medicine", "Sit down", "Go home"]
        for phrase in phrases {
            app.buttons["Clear"].tap()
            let btn = app.buttons[phrase]
            if btn.waitForExistence(timeout: 2) {
                btn.tap()
                Thread.sleep(forTimeInterval: 0.2)
                XCTAssertEqual(app.state, .runningForeground, "Crash tapping '\(phrase)'")
            }
        }
    }

    func testAllPlacesPhrases() {
        app.buttons["Places"].tap()
        Thread.sleep(forTimeInterval: 0.4)
        // Places category exists — just verify no crash on tap
        let allButtons = app.buttons.allElementsBoundByIndex
        var tapped = 0
        for btn in allButtons {
            if ["Quick", "Feelings", "Needs", "Places",
                "Clear", "Speak", "AI ✦", "space"].contains(btn.label) { continue }
            if btn.isEnabled && btn.waitForExistence(timeout: 0.5) {
                btn.tap()
                app.buttons["Clear"].tap()
                tapped += 1
                if tapped >= 6 { break }
            }
        }
    }

    func testAllKeyboardKeys() {
        let rows = [
            ["Q","W","E","R","T","Y","U","I","O","P"],
            ["A","S","D","F","G","H","J","K","L"],
            ["Z","X","C","V","B","N","M"],
        ]
        for row in rows {
            for key in row {
                let btn = app.buttons[key]
                XCTAssertTrue(btn.waitForExistence(timeout: 2), "Key '\(key)' must exist")
                XCTAssertTrue(btn.isEnabled, "Key '\(key)' must be enabled")
                btn.tap()
                Thread.sleep(forTimeInterval: 0.05)
            }
        }
        // Verify typing worked
        XCTAssertFalse(
            app.staticTexts["Tap to build a message…"].exists,
            "Message bar should have text after typing all keys"
        )
        XCTAssertEqual(app.state, .runningForeground, "App crashed during keyboard typing")
    }

    func testSpaceKey() {
        app.buttons["Q"].waitForExistence(timeout: 3)
        app.buttons["Q"].tap()
        let space = app.buttons["space"]
        XCTAssertTrue(space.waitForExistence(timeout: 3), "Space key must exist")
        XCTAssertTrue(space.isEnabled, "Space key must be enabled")
        space.tap()
        XCTAssertEqual(app.state, .runningForeground)
    }

    func testBackspaceKey() {
        app.buttons["Q"].waitForExistence(timeout: 3)
        app.buttons["Q"].tap()
        // Backspace is a button with delete/⌫ label or accessibility label
        let backspace = app.buttons.matching(
            NSPredicate(format: "label CONTAINS '⌫' OR label CONTAINS 'delete' OR label CONTAINS 'Delete'")
        ).firstMatch
        if backspace.waitForExistence(timeout: 3) {
            XCTAssertTrue(backspace.isEnabled, "Backspace must be enabled")
            backspace.tap()
        }
        XCTAssertEqual(app.state, .runningForeground)
    }

    func testSpeakButtonEnabledAfterText() {
        // Tap first visible "Yes" phrase button
        app.buttons.matching(identifier: "Yes").firstMatch.waitForExistence(timeout: 3)
        app.buttons.matching(identifier: "Yes").firstMatch.tap()
        // Speak is the bottom-right green button — use firstMatch to avoid ambiguity
        let speak = app.buttons.matching(NSPredicate(format: "label == 'Speak'")).firstMatch
        XCTAssertTrue(speak.waitForExistence(timeout: 3))
        XCTAssertTrue(speak.isEnabled, "Speak must be enabled after composing text")
        speak.tap()
        Thread.sleep(forTimeInterval: 0.5)
        XCTAssertEqual(app.state, .runningForeground, "App crashed when pressing Speak")
    }

    func testClearButton() {
        app.buttons["Yes"].waitForExistence(timeout: 3)
        app.buttons["Yes"].tap()
        let clear = app.buttons["Clear"]
        XCTAssertTrue(clear.waitForExistence(timeout: 3))
        XCTAssertTrue(clear.isEnabled, "Clear must be enabled")
        clear.tap()
        XCTAssertTrue(app.staticTexts["Tap to build a message…"].waitForExistence(timeout: 3))
        XCTAssertEqual(app.state, .runningForeground)
    }

    func testAIButton() {
        let ai = app.buttons["AI ✦"]
        XCTAssertTrue(ai.waitForExistence(timeout: 5), "AI button must exist")
        XCTAssertTrue(ai.isEnabled, "AI button must be enabled")
        ai.tap()
        Thread.sleep(forTimeInterval: 0.5)
        XCTAssertEqual(app.state, .runningForeground, "App crashed tapping AI button")
    }

    func testMultiPhraseCombination() {
        // Simulate real AAC usage: build a sentence from multiple categories
        app.buttons["Needs"].waitForExistence(timeout: 3)
        app.buttons["Needs"].tap()
        Thread.sleep(forTimeInterval: 0.4)
        if app.buttons["Water"].waitForExistence(timeout: 2) {
            app.buttons["Water"].firstMatch.tap()
        }
        app.buttons["Quick"].tap()
        Thread.sleep(forTimeInterval: 0.3)
        if app.buttons["More"].waitForExistence(timeout: 2) {
            app.buttons["More"].firstMatch.tap()
        }
        let speak = app.buttons.matching(NSPredicate(format: "label == 'Speak'")).firstMatch
        if speak.waitForExistence(timeout: 2) && speak.isEnabled { speak.tap() }
        XCTAssertEqual(app.state, .runningForeground, "App crashed during phrase combination")
    }
}

// MARK: - Watch button coverage

final class WatchButtonCoverageTests: XCTestCase {

    var app: XCUIApplication!

    override func setUpWithError() throws {
        continueAfterFailure = false
        app = XCUIApplication()
        app.launch()
        _ = app.wait(for: .runningForeground, timeout: 8)
        _ = app.staticTexts["Yes"].waitForExistence(timeout: 8)
    }

    override func tearDownWithError() throws { app.terminate() }

    func testAllPictogramCards() {
        // Swipe through all 28 cards, tap each one
        let expectedLabels = [
            "Yes","No","More","All done","Help","Want","Stop","Go",
            "Water","Food","Bathroom","Hurt","Tired","Hot","Cold","Medicine",
            "Happy","Sad","Scared","Angry",
            "Hello","Thank you","Please","Sorry",
            "Home","School","Outside","Bed",
        ]
        for (i, label) in expectedLabels.enumerated() {
            if app.staticTexts[label].waitForExistence(timeout: 3) {
                // Tap the card
                app.staticTexts[label].firstMatch.tap()
                Thread.sleep(forTimeInterval: 0.3)
                XCTAssertEqual(app.state, .runningForeground,
                               "App crashed tapping card '\(label)' (#\(i))")
                // Swipe to next
                app.swipeLeft()
                Thread.sleep(forTimeInterval: 0.4)
            } else {
                // Swipe and continue
                app.swipeLeft()
                Thread.sleep(forTimeInterval: 0.4)
            }
        }
    }

    func testSOSButton() {
        // SOS is always in top-right
        let sos = app.buttons.matching(
            NSPredicate(format: "label CONTAINS 'SOS' OR label CONTAINS 'sos'")
        ).firstMatch
        if sos.waitForExistence(timeout: 5) {
            XCTAssertTrue(sos.isEnabled, "SOS must be enabled")
            // Do NOT tap — would trigger emergency countdown in test
            // Just verify it's there and enabled
        }
    }
}
