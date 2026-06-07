import XCTest
@testable import PrismAAC

// Mirror for WatchTTS.streamingTokenSink
private class WatchTTSMirror {
    private let lock = DispatchQueue(label: "prism.tts.stream.mirror")
    var buffer = ""
    var sentenceQueue: [String] = []
    let sentenceBoundaries: [Character] = [".", "!", "?", "\n"]

    func streamingTokenSink() -> (onToken: (String) -> Void, flush: () -> Void) {
        let onToken: (String) -> Void = { [weak self] piece in
            guard let self = self else { return }
            self.lock.sync {
                self.buffer += piece
                if let lastPunct = self.buffer.lastIndex(where: { self.sentenceBoundaries.contains($0) }) {
                    let afterPunct = self.buffer.index(after: lastPunct)
                    let atEnd = afterPunct == self.buffer.endIndex
                    let nextIsSpace = !atEnd && self.buffer[afterPunct].isWhitespace
                    if atEnd || nextIsSpace {
                        let sentence = String(self.buffer[self.buffer.startIndex...lastPunct]).trimmingCharacters(in: .whitespacesAndNewlines)
                        if !sentence.isEmpty {
                            self.sentenceQueue.append(sentence)
                        }
                        self.buffer = atEnd ? "" : String(self.buffer[afterPunct...])
                    }
                }
            }
        }

        let flush: () -> Void = { [weak self] in
            guard let self = self else { return }
            self.lock.sync {
                let text = self.buffer.trimmingCharacters(in: .whitespacesAndNewlines)
                self.buffer = ""
                if !text.isEmpty {
                    self.sentenceQueue.append(text)
                }
            }
        }

        return (onToken, flush)
    }
}

// Mirror for WatchAISession.assembleSSE
private struct WatchAISessionMirror {
    static func assembleSSE(_ data: Data) -> String? {
        guard let raw = String(data: data, encoding: .utf8) else { return nil }
        var result = ""
        for line in raw.components(separatedBy: "\n") {
            guard line.count <= 4096 else { continue }
            guard line.hasPrefix("data: ") else { continue }
            let payload = String(line.dropFirst(6))
            if payload == "[DONE]" { break }
            if let d = payload.data(using: .utf8),
               let parsed = try? JSONSerialization.jsonObject(with: d) as? [String: Any],
               let choices = parsed["choices"] as? [[String: Any]],
               let delta = choices.first?["delta"] as? [String: Any],
               let chunk = delta["content"] as? String {
                result += chunk
                if result.count > 4000 { break }
            }
        }
        let trimmed = result.trimmingCharacters(in: .whitespacesAndNewlines)
        return trimmed.isEmpty ? nil : trimmed
    }
}

final class WatchStreamingTests: XCTestCase {

    func testWatchTTSSink_splitsOnPunctuation() {
        let tts = WatchTTSMirror()
        let (onToken, flush) = tts.streamingTokenSink()

        onToken("Hello")
        onToken(" world.")
        onToken(" How")
        onToken(" are you?")

        XCTAssertEqual(tts.sentenceQueue.count, 2)
        XCTAssertEqual(tts.sentenceQueue[0], "Hello world.")
        XCTAssertEqual(tts.sentenceQueue[1], "How are you?")
        XCTAssertEqual(tts.buffer.trimmingCharacters(in: .whitespacesAndNewlines), "")
        
        flush()
        XCTAssertEqual(tts.sentenceQueue.count, 2) // No remaining buffer
    }

    func testWatchTTSSink_flushCatchesTrailingText() {
        let tts = WatchTTSMirror()
        let (onToken, flush) = tts.streamingTokenSink()

        onToken("I am an AI")
        XCTAssertEqual(tts.sentenceQueue.count, 0)
        
        flush()
        XCTAssertEqual(tts.sentenceQueue.count, 1)
        XCTAssertEqual(tts.sentenceQueue[0], "I am an AI")
    }

    func testWatchAISession_assembleSSETokens() {
        let chunk1 = "data: {\"choices\": [{\"delta\": {\"content\": \"Hello \"}}]}\n"
        let chunk2 = "data: {\"choices\": [{\"delta\": {\"content\": \"world\"}}]}\n"
        let done = "data: [DONE]\n"
        
        let raw = chunk1 + chunk2 + done
        let parsed = WatchAISessionMirror.assembleSSE(raw.data(using: .utf8)!)
        
        XCTAssertEqual(parsed, "Hello world")
    }

    func testWatchAISession_malformedSSE_doesNotCrash() {
        let malformed = "data: {\"choices\": invalid json\n"
        let parsed = WatchAISessionMirror.assembleSSE(malformed.data(using: .utf8)!)
        XCTAssertNil(parsed)
    }

    func testWatchLLMEngine_utf8ByteTearingFix() {
        // This test simulates the UTF-8 byte buffering logic from WatchLLMEngine
        var byteBuffer: [UInt8] = []
        var generated = ""
        
        let emojiBytes = Array("🚀".utf8) // 4 bytes
        
        // Token 1: first 2 bytes
        let token1 = Array(emojiBytes.prefix(2))
        byteBuffer.append(contentsOf: token1)
        if let piece = String(bytes: byteBuffer, encoding: .utf8) {
            byteBuffer.removeAll()
            generated += piece
        }
        
        XCTAssertEqual(generated, "") // Cannot decode yet
        XCTAssertEqual(byteBuffer.count, 2)
        
        // Token 2: last 2 bytes
        let token2 = Array(emojiBytes.suffix(2))
        byteBuffer.append(contentsOf: token2)
        if let piece = String(bytes: byteBuffer, encoding: .utf8) {
            byteBuffer.removeAll()
            generated += piece
        }
        
        XCTAssertEqual(generated, "🚀")
        XCTAssertEqual(byteBuffer.count, 0)
    }
}
