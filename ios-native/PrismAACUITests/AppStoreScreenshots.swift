import XCTest

final class AppStoreScreenshots: XCTestCase {
    var app: XCUIApplication!
    var webView: XCUIElement { app.webViews.firstMatch }

    override func setUpWithError() throws {
        continueAfterFailure = true
        app = XCUIApplication()
        app.launch()
        _ = app.wait(for: .runningForeground, timeout: 5)
        XCTAssertTrue(webView.waitForExistence(timeout: 10))
        XCTAssertTrue(
            webView.buttons["Alert"].waitForExistence(timeout: 30),
            "Page ready gate"
        )
        // Wait for the visible ARASAAC pictograms to load on demand.
        Thread.sleep(forTimeInterval: 45)
    }

    override func tearDownWithError() throws {
        app.terminate()
    }

    private func scrollToolbarTo(_ label: String) {
        let target = webView.buttons[label]
        if target.waitForExistence(timeout: 3) {
            // Swipe the toolbar strip left to reveal right-side buttons
            let strip = webView.otherElements["aac-toolbar-strip"]
            if strip.waitForExistence(timeout: 2) {
                for _ in 0..<6 {
                    if target.isHittable { break }
                    strip.swipeLeft()
                    Thread.sleep(forTimeInterval: 0.5)
                }
            }
        }
    }

    func test01_homeBoard() throws {
        let screenshot = app.screenshot()
        let attachment = XCTAttachment(screenshot: screenshot)
        attachment.name = "01-home"
        attachment.lifetime = .keepAlways
        add(attachment)
    }

    func test02_categories() throws {
        let catBtn = webView.buttons["Categories"]
        if catBtn.waitForExistence(timeout: 5) {
            catBtn.tap()
            Thread.sleep(forTimeInterval: 1.5)
        }
        let screenshot = app.screenshot()
        let attachment = XCTAttachment(screenshot: screenshot)
        attachment.name = "02-categories"
        attachment.lifetime = .keepAlways
        add(attachment)
    }

    func test03_emergency() throws {
        let alertBtn = webView.buttons["Alert"]
        if alertBtn.waitForExistence(timeout: 5) {
            alertBtn.tap()
            Thread.sleep(forTimeInterval: 1)
        }
        let screenshot = app.screenshot()
        let attachment = XCTAttachment(screenshot: screenshot)
        attachment.name = "03-emergency"
        attachment.lifetime = .keepAlways
        add(attachment)
        let cancelBtn = webView.buttons["Cancel"]
        if cancelBtn.waitForExistence(timeout: 2) { cancelBtn.tap() }
    }

    func test04_settings() throws {
        scrollToolbarTo("Settings")
        let settingsBtn = webView.buttons["Settings"]
        if settingsBtn.waitForExistence(timeout: 5) {
            settingsBtn.tap()
            Thread.sleep(forTimeInterval: 1.5)
        }
        let screenshot = app.screenshot()
        let attachment = XCTAttachment(screenshot: screenshot)
        attachment.name = "04-settings"
        attachment.lifetime = .keepAlways
        add(attachment)
    }

    func test05_darkHighContrast() throws {
        scrollToolbarTo("Settings")
        let settingsBtn = webView.buttons["Settings"]
        if settingsBtn.waitForExistence(timeout: 5) {
            settingsBtn.tap()
            Thread.sleep(forTimeInterval: 1)
        }
        // Tap the "🌙 Dark" theme button (aria-pressed button, not a toggle)
        let darkBtn = webView.buttons["🌙 Dark"]
        if darkBtn.waitForExistence(timeout: 3) { darkBtn.tap() }
        Thread.sleep(forTimeInterval: 0.3)
        // Toggle high contrast (Toggle component surfaces as switch in iOS 26)
        let hcSwitch = webView.switches["High Contrast"]
        let hcBtn = webView.buttons["High Contrast"]
        if hcSwitch.waitForExistence(timeout: 2) { hcSwitch.tap() }
        else if hcBtn.waitForExistence(timeout: 1) { hcBtn.tap() }
        // Close settings — label is "Close settings", not "Close"
        let closeBtn = webView.buttons["Close settings"]
        if closeBtn.waitForExistence(timeout: 3) { closeBtn.tap() }
        Thread.sleep(forTimeInterval: 1.5)
        let screenshot = app.screenshot()
        let attachment = XCTAttachment(screenshot: screenshot)
        attachment.name = "05-dark"
        attachment.lifetime = .keepAlways
        add(attachment)
    }

    func test06_aiChat() throws {
        scrollToolbarTo("AI")
        let aiBtn = webView.buttons["AI"]
        if aiBtn.waitForExistence(timeout: 5) {
            aiBtn.tap()
            Thread.sleep(forTimeInterval: 1.5)
        }
        let screenshot = app.screenshot()
        let attachment = XCTAttachment(screenshot: screenshot)
        attachment.name = "06-ai-chat"
        attachment.lifetime = .keepAlways
        add(attachment)
    }
}
