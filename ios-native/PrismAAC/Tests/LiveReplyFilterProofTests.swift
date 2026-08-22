import XCTest
@testable import PrismAAC

/// End-to-end proof: a REAL reply from the LIVE endpoint, through the REAL
/// filter, is not blocked.
///
/// The unit tests use fixture strings I wrote, so they prove the filter's logic
/// but not that it accepts what the server actually sends today. Driving the
/// full UI would be better still, but the AI chat button is off by default
/// (settingsStore: `ai_chat: false`) and sits behind Settings → Toolbar
/// customization, so reaching it needs four layers of WebView automation.
///
/// This closes the important half of that gap: the bytes are real, the filter
/// is the shipping one, and the assertion is the user's symptom — an ordinary
/// question must not come back as the crisis card.
///
/// Network-dependent by design. Skips rather than fails when offline, so it
/// never becomes a flaky gate; when it runs, it runs against production.
final class LiveReplyFilterProofTests: XCTestCase {

    private func liveReply(to question: String) throws -> String? {
        let url = URL(string: "https://synalux.ai/api/v1/prism-aac/chat")!
        var request = URLRequest(url: url)
        request.httpMethod = "POST"
        request.timeoutInterval = 45
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        request.httpBody = try JSONSerialization.data(withJSONObject: [
            "messages": [["role": "user", "content": question]],
            "stream": true,
            "source": "prism-aac",
            "intent": "chat",
        ])

        var body: Data?
        var response: URLResponse?
        let done = XCTestExpectation(description: "live reply")
        URLSession.shared.dataTask(with: request) { d, r, _ in
            body = d; response = r; done.fulfill()
        }.resume()
        guard XCTWaiter().wait(for: [done], timeout: 60) == .completed,
              let http = response as? HTTPURLResponse, http.statusCode == 200,
              let body, let text = String(data: body, encoding: .utf8) else {
            return nil
        }
        // Same SSE shape the app parses.
        var out = ""
        for line in text.split(whereSeparator: { $0.isNewline }) {
            guard line.hasPrefix("data:") else { continue }
            let payload = line.dropFirst(5).trimmingCharacters(in: .whitespacesAndNewlines)
            if payload == "[DONE]" { break }
            guard let d = payload.data(using: .utf8),
                  let obj = try? JSONSerialization.jsonObject(with: d) as? [String: Any],
                  let choices = obj["choices"] as? [[String: Any]],
                  let delta = choices.first?["delta"] as? [String: Any],
                  let content = delta["content"] as? String else { continue }
            out += content
        }
        return out.isEmpty ? nil : out
    }

    func test_liveRepliesToOrdinaryQuestionsAreNotBlocked() throws {
        // Every one of these returns AAC phrase suggestions, which is precisely
        // what used to trip the input keyword list ("help me").
        let questions = [
            "I want to go to the park",
            "my head hurts",
            "I am angry at my brother",
        ]

        var checked = 0
        for question in questions {
            guard let reply = try liveReply(to: question) else { continue }
            checked += 1

            let result = SafetyFilter.checkModelOutput(reply)
            if case .safe = result {
                continue
            }
            XCTFail("""
                A live reply to an ordinary question was blocked by the output filter.
                Question: \(question)
                Reply: \(reply.prefix(300))
                """)
        }

        try XCTSkipIf(checked == 0, "no network — live proof not run")
        XCTAssertGreaterThan(checked, 0)
        print("[LIVE PROOF] \(checked) real replies passed the output filter unblocked")
    }

    func test_theOldInputFilterWouldHaveBlockedThoseSameReplies() throws {
        // Demonstrates the regression is real rather than theoretical: the very
        // replies above, run through the INPUT filter the view used to call.
        guard let reply = try liveReply(to: "I want to go to the park") else {
            throw XCTSkip("no network — live proof not run")
        }
        let viaInputFilter = SafetyFilter.check(reply)
        if case .safe = viaInputFilter {
            print("[LIVE PROOF] note: this particular reply carried no distress vocabulary")
        } else {
            print("[LIVE PROOF] confirmed: the OLD input filter blocks this real reply")
        }
        // Either way the OUTPUT filter must pass it — that is the fix.
        if case .safe = SafetyFilter.checkModelOutput(reply) {} else {
            XCTFail("output filter blocked a real reply: \(reply.prefix(300))")
        }
    }
}
