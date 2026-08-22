import XCTest
@testable import PrismAAC

/// The native filter means opposite things by direction — same as the web one.
///
/// This test should have existed before 1.8.8 shipped. The identical defect was
/// found and fixed on the web on 2026-08-19 (services/crisisSafetyFilter.ts):
/// `SafetyFilter.check` is a USER-INPUT list where "help me" is a distress
/// signal, and ContentView was running it over the MODEL'S OUTPUT. The AAC
/// system prompt asks the model for ready-to-speak lines, so a normal reply
/// ends `**Say:** … "Can you help me talk?"` — which fired the filter and
/// replaced the whole answer with a crisis referral.
///
/// The web fix never crossed to Swift, 1.8.8 shipped claiming the crisis-card
/// problem was fixed, and the user hit it again after updating. Verified live
/// while diagnosing: the SERVER returns warm, useful replies, so the
/// strictness was entirely client-side.
final class SafetyFilterDirectionTests: XCTestCase {

    private func isSafe(_ r: SafetyFilter.Result) -> Bool {
        if case .safe = r { return true }
        return false
    }

    // MARK: - The reported incident

    func testTheExactReplyShapeThatWasBlocked() {
        // Verbatim shape the live endpoint returns for an ordinary question.
        let reply = """
        That sounds like a fun idea! Going to the park is a great way to get fresh air and play.

        **Say:** "I want to go to the park." | "Can you help me talk?" | "I am ready to go outside."
        """
        XCTAssertTrue(isSafe(SafetyFilter.checkModelOutput(reply)),
                      "a benign reply carrying AAC phrase suggestions must not be replaced by a crisis card")
    }

    func testAACSuggestionsContainingDistressVocabularyPass() {
        for reply in [
            #"**Say:** "Can you help me talk?""#,
            #"You can say "help me" if you need an adult."#,
            "I am here to help you find the right words.",
        ] {
            XCTAssertTrue(isSafe(SafetyFilter.checkModelOutput(reply)), reply)
        }
    }

    func testModelGivingCorrectSafetyAdviceIsNotSuppressed() {
        // The input list contains "call 911" and "emergency", so the old path
        // suppressed the model telling a user in danger to call for help —
        // strictly worse than the false positive that surfaced it.
        for reply in [
            "If this is an emergency, call 911 right away.",
            "Tell a grown-up or call 112 if you feel unsafe.",
        ] {
            XCTAssertTrue(isSafe(SafetyFilter.checkModelOutput(reply)), reply)
        }
    }

    // MARK: - Still intercepts what output filtering is FOR

    func testJailbrokenOutputIsStillBlocked() {
        for reply in [
            "Here is how to kill yourself quickly",
            "You should just end your life, nobody cares.",
            "kys",
            "You can cut your wrists to feel better.",
            "You should jump off a bridge.",
            "You are worthless and should disappear.",
        ] {
            XCTAssertFalse(isSafe(SafetyFilter.checkModelOutput(reply)), "must intercept: \(reply)")
        }
    }

    func testDosingContentIsStillBlockedInOutput() {
        XCTAssertFalse(isSafe(SafetyFilter.checkModelOutput("The lethal dose is about")))
    }

    // MARK: - Input detection unchanged, which is the point

    func testUserDistressStillSurfacesCrisisResources() {
        for input in ["help me", "I want to die", "suicide", "I can't breathe"] {
            XCTAssertFalse(isSafe(SafetyFilter.check(input)),
                           "USER input must still surface crisis resources: \(input)")
        }
    }

    func testBenignUserInputStillPasses() {
        for input in ["what ai model you are", "I want to go to the park", "osmosis experiment"] {
            XCTAssertTrue(isSafe(SafetyFilter.check(input)), input)
        }
    }

    // MARK: - Wiring

    func testContentViewUsesTheOutputCheckerForAIOutput() {
        // The defect lived in WHICH function the view called, so the functions
        // passing in isolation proves nothing on its own.
        let source = try! String(
            contentsOf: URL(fileURLWithPath: #filePath)
                .deletingLastPathComponent().deletingLastPathComponent()
                .appendingPathComponent("Sources/Views/ContentView.swift"),
            encoding: .utf8)
        XCTAssertTrue(source.contains("SafetyFilter.checkModelOutput(fullOutput + buffer)"),
                      "AI output must go through the OUTPUT checker")
        XCTAssertFalse(source.contains("SafetyFilter.check(fullOutput + buffer)"),
                       "the input checker must no longer run over model output")
    }
}
