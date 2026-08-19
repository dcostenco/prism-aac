import XCTest
@testable import PrismAAC

/// Pins the /api/v1/prism-aac/chat client contract.
///
/// The cloud fallback shipped broken THREE ways and no test could notice,
/// because nothing asserted the request or response shape against the real
/// server. Found 2026-08-19 by probing the live endpoint:
///   1. a keychain-token guard threw before sending — and no code path ever
///      WRITES that token, so no request was ever sent on any install
///   2. the body was {"message": …} — the server 400s with "Missing messages"
///   3. the parser expected {"reply": …} plain JSON — the server streams SSE,
///      a shape no portal endpoint has ever served
/// The SSE fixture below is the server's actual recorded response, not an
/// invented one — if the server contract drifts, update it from a live probe.
final class CloudContractTests: XCTestCase {

    // MARK: - Request shape (defect 2)

    func testRequestBodyUsesMessagesArrayNotLegacyMessage() {
        let body = AACPipeline.cloudRequestBody(question: "hello", language: "en")
        XCTAssertNil(body["message"], "legacy single-message key must be gone — server 400s on it")
        let messages = body["messages"] as? [[String: Any]]
        XCTAssertNotNil(messages, "server requires an OpenAI-style messages array")
        XCTAssertEqual(messages?.last?["role"] as? String, "user")
        XCTAssertEqual(messages?.last?["content"] as? String, "hello")
        XCTAssertEqual(body["source"] as? String, "prism-aac")
        XCTAssertEqual(body["intent"] as? String, "chat")
    }

    func testRequestBodyCarriesLanguageInSystemMessage() {
        let body = AACPipeline.cloudRequestBody(question: "hola", language: "es")
        let system = (body["messages"] as? [[String: Any]])?.first
        XCTAssertEqual(system?["role"] as? String, "system")
        XCTAssertTrue((system?["content"] as? String ?? "").contains("es"))
    }

    func testRequestBodySerializesToJSON() throws {
        let body = AACPipeline.cloudRequestBody(question: "hi", language: "en")
        XCTAssertNoThrow(try JSONSerialization.data(withJSONObject: body))
    }

    // MARK: - Response shape (defect 3)

    func testParsesRecordedLiveSSEResponse() {
        // Verbatim shape from the live endpoint, 2026-08-19.
        let sse = """
        data: {"choices":[{"delta":{"content":"Hello!"},"index":0}]}

        data: {"choices":[{"delta":{"content":" I am happy to help you talk."},"index":0}]}

        data: [DONE]
        """
        XCTAssertEqual(AACPipeline.parseCloudReply(sse),
                       "Hello! I am happy to help you talk.")
    }

    func testParserSkipsMalformedChunksAndStopsAtDone() {
        let sse = """
        data: {"choices":[{"delta":{"content":"A"},"index":0}]}

        data: not json

        data: {"unexpected":true}

        data: {"choices":[{"delta":{"content":"B"},"index":0}]}

        data: [DONE]

        data: {"choices":[{"delta":{"content":"after done — must not appear"},"index":0}]}
        """
        XCTAssertEqual(AACPipeline.parseCloudReply(sse), "AB")
    }

    func testParserToleratesCRLFLineEndings() {
        // The live server sends bare LF, but SSE permits CRLF and proxies can
        // introduce it — a trailing \r must not defeat the parse or [DONE].
        let sse = "data: {\"choices\":[{\"delta\":{\"content\":\"Hi\"},\"index\":0}]}\r\n\r\ndata: [DONE]\r\n"
        XCTAssertEqual(AACPipeline.parseCloudReply(sse), "Hi")
    }

    func testParserFallsBackToPlainJSONShapes() {
        XCTAssertEqual(
            AACPipeline.parseCloudReply(#"{"choices":[{"message":{"content":"plain"}}]}"#),
            "plain")
        XCTAssertEqual(AACPipeline.parseCloudReply(#"{"reply":"legacy"}"#), "legacy")
    }

    func testParserReturnsEmptyOnGarbage() {
        // runCloud treats "" as a contract failure and throws — pinned here
        // so garbage can never render as a silent empty bubble.
        XCTAssertEqual(AACPipeline.parseCloudReply("<html>502 Bad Gateway</html>"), "")
    }

    // MARK: - The old {"reply"} contract must stay dead (defect 3 regression)

    func testOldReplyOnlyParserWouldFailOnRealServerOutput() {
        // What the pre-fix code did with the real response: JSON-parse the
        // whole body, read "reply". Documented here as the failure it was.
        let real = "data: {\"choices\":[{\"delta\":{\"content\":\"Hi\"},\"index\":0}]}\n\ndata: [DONE]"
        let oldStyle = (try? JSONSerialization.jsonObject(with: Data(real.utf8))) as? [String: Any]
        XCTAssertNil(oldStyle, "SSE is not a JSON object — the old parser got nil and yielded \"\"")
        XCTAssertEqual(AACPipeline.parseCloudReply(real), "Hi", "the new parser handles the same bytes")
    }
}
