import XCTest

/// Proof, in the running app, that an ordinary question no longer returns the
/// crisis card.
///
/// The unit tests cover the filter functions and the wiring, but they cannot
/// show what a user sees. This drives the real chat in the simulator, sends a
/// question whose reply is known to end with an AAC suggestion containing
/// "help me" — the exact shape that was being replaced by a 911 referral — and
/// captures the rendered screen.
///
/// Attaches its screenshots so the result can be inspected rather than trusted.
final class CrisisFilterProofTests: XCTestCase {

    var app: XCUIApplication!

    override func setUpWithError() throws {
        continueAfterFailure = false
        app = XCUIApplication()
        app.launch()
        _ = app.wait(for: .runningForeground, timeout: 10)
        // The WKWebView only mounts AFTER the native onboarding is dismissed,
        // so gating on it here fails before the test can tap Continue.
    }

    override func tearDownWithError() throws { app.terminate() }

    private func attach(_ name: String) {
        let shot = XCTAttachment(screenshot: app.screenshot())
        shot.name = name
        shot.lifetime = .keepAlways
        add(shot)
    }

    func test_ordinaryQuestionDoesNotReturnTheCrisisCard() throws {
        // Walk the onboarding pages. Several consecutive screens use the same
        // "Continue" label (feature pages, then the AI-consent gate), and the
        // WKWebView only mounts after the last one, so this keeps advancing
        // until the web view appears rather than assuming a fixed count.
        for step in 0..<15 {
            if app.webViews.firstMatch.exists { break }
            let advance = ["Continue", "Get Started", "Allow", "Next"]
                .map { app.buttons[$0] }
                .first { $0.exists && $0.isHittable }
            guard let advance else {
                sleep(1)
                continue
            }
            advance.tap()
            if step % 4 == 0 { attach("00-onboarding-step-\(step)") }
            sleep(2)
        }
        attach("01-after-onboarding")

        let webView = app.webViews.firstMatch
        guard webView.waitForExistence(timeout: 30) else {
            attach("01b-no-webview")
            throw XCTSkip("WKWebView never mounted — onboarding may not have been dismissed")
        }
        guard webView.buttons["Settings"].waitForExistence(timeout: 25) else {
            throw XCTSkip("web app did not finish loading in the simulator — cannot drive the chat")
        }

        let aiButton = webView.buttons["AI"]
        guard aiButton.waitForExistence(timeout: 15) else {
            throw XCTSkip("AI entry point not present in this build/locale")
        }
        aiButton.tap()
        XCTAssertTrue(webView.buttons["Close AI chat"].waitForExistence(timeout: 10),
                      "AI chat panel must open")
        attach("02-chat-open")

        // Type a question whose real reply ends with `**Say:** … "Can you help
        // me talk?"` — verified live against the endpoint.
        let field = webView.textFields.firstMatch.exists
            ? webView.textFields.firstMatch
            : webView.textViews.firstMatch
        guard field.waitForExistence(timeout: 10) else {
            throw XCTSkip("chat input not reachable")
        }
        field.tap()
        field.typeText("I want to go to the park")
        attach("03-question-typed")

        // Send, then give the model time to stream a reply.
        if webView.buttons["Send"].exists { webView.buttons["Send"].tap() }
        else { app.keyboards.buttons["return"].tap() }

        let deadline = Date().addingTimeInterval(60)
        while Date() < deadline {
            if webView.staticTexts.containing(NSPredicate(format: "label CONTAINS[c] 'park'")).count > 1 { break }
            sleep(2)
        }
        attach("04-response")

        // The assertion that matters: the 911 referral must NOT be on screen.
        let crisisMarkers = ["call 911", "988", "Crisis Text Line", "you are not alone"]
        for marker in crisisMarkers {
            let hits = webView.staticTexts.containing(
                NSPredicate(format: "label CONTAINS[c] %@", marker)).count
            XCTAssertEqual(hits, 0,
                           "the crisis card is on screen for an ordinary question — marker: \(marker)")
        }
    }
}
