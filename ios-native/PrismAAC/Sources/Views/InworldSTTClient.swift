/**
 * InworldSTTClient — iOS WebSocket client for Inworld STT-1
 * ==========================================================
 * Streaming speech-to-text via bidirectional WebSocket (URLSessionWebSocketTask).
 * Mirrors the TypeScript InworldSTTClient in @synalux/shared-ui and the
 * Twilio ConversationRelay pattern from POS phone AI chat.
 *
 * Protocol:
 *   1. Connect to wss://api.inworld.ai/stt/v1/transcribe:streamBidirectional
 *   2. Send transcribeConfig first frame (model, encoding, hints)
 *   3. Stream audioChunk frames (base64 LINEAR16 PCM, 16kHz mono)
 *   4. Receive: interim/final transcripts, speechStarted/Stopped, voiceProfile
 *   5. Send endTurn / closeStream
 *
 * Usage:
 *   let client = InworldSTTClient()
 *   client.onFinal = { text in self.processTranscript(text) }
 *   client.onSpeechStarted = { ForgeTTSEngine.shared.stop() }  // interruptible TTS
 *   client.connect(apiKey: key, hints: ["push-up", "jumping jack"])
 *   // In AVAudioEngine tap:
 *   client.sendAudioChunk(buffer)
 */

import Foundation
import AVFoundation

// MARK: - Voice Profile

public struct InworldVoiceProfile: Sendable {
    public let emotion: String?
    public let accent: String?
    public let age: String?
    public let pitch: String?
    public let confidence: Double?
}

// MARK: - Error

public enum InworldSTTError: Error, Sendable {
    case invalidConfiguration
    case connectionFailed(String)
    case maxReconnectsExceeded
}

// MARK: - Client

public final class InworldSTTClient: NSObject {

    // MARK: Callbacks (set before calling connect)

    /// Streaming partial transcription
    public var onInterim: ((String) -> Void)?
    /// Final transcription result — trigger AI
    public var onFinal: ((String) -> Void)?
    /// User started speaking — interrupt TTS
    public var onSpeechStarted: (() -> Void)?
    /// Silence detected by Inworld VAD
    public var onSpeechStopped: (() -> Void)?
    /// Voice profiling data (emotion, accent, confidence)
    public var onVoiceProfile: ((InworldVoiceProfile) -> Void)?
    /// Error — caller should fall back to SFSpeechRecognizer
    public var onError: ((Error) -> Void)?
    /// Connection state changed
    public var onConnected: (() -> Void)?
    public var onDisconnected: (() -> Void)?

    // MARK: State

    public private(set) var isConnected = false

    // MARK: Private

    private static let wsURL = URL(string: "wss://api.inworld.ai/stt/v1/transcribe:streamBidirectional")!
    private static let defaultModel = "inworld/inworld-stt-1"
    private static let maxReconnectAttempts = 3
    private static let reconnectBaseMs: UInt64 = 500

    private var webSocket: URLSessionWebSocketTask?
    private var urlSession: URLSession?
    private var apiKey: String?
    private var hints: [String] = []
    private var locale: String = "en-US"
    private var reconnectAttempts = 0
    private var configSent = false
    private var shouldReconnect = false
    private let queue = DispatchQueue(label: "com.synalux.inworldSTT", qos: .userInteractive)

    // Audio format converter (AVAudioEngine output → LINEAR16 16kHz mono)
    private var audioConverter: AVAudioConverter?
    private lazy var targetFormat: AVAudioFormat = {
        AVAudioFormat(commonFormat: .pcmFormatFloat32, sampleRate: 16000, channels: 1, interleaved: false)!
    }()

    deinit {
        disconnect()
    }

    // MARK: - Public API

    /// Connect to Inworld STT WebSocket
    /// - Parameters:
    ///   - apiKey: Inworld API key (fetched from Keychain or CLI)
    ///   - locale: BCP-47 locale (default: "en-US")
    ///   - hints: STT keyword hints for boosting (exercise names, menu items, etc.)
    public func connect(apiKey: String, locale: String = "en-US", hints: [String] = []) {
        self.apiKey = apiKey
        self.locale = locale
        self.hints = hints
        self.reconnectAttempts = 0
        self.shouldReconnect = true
        doConnect()
    }

    /// Disconnect and clean up
    public func disconnect() {
        shouldReconnect = false
        reconnectAttempts = Self.maxReconnectAttempts // Prevent reconnect
        sendCloseStream()
        cleanup()
        DispatchQueue.main.async { [weak self] in
            self?.onDisconnected?()
        }
    }

    /// Send an audio buffer from AVAudioEngine tap
    /// Converts to LINEAR16 PCM, base64 encodes, sends as audioChunk
    public func sendAudioChunk(_ buffer: AVAudioPCMBuffer) {
        guard isConnected, configSent else { return }

        queue.async { [weak self] in
            guard let self = self else { return }

            // Convert to target format (16kHz mono Float32)
            let converted: AVAudioPCMBuffer
            if buffer.format.sampleRate == self.targetFormat.sampleRate &&
               buffer.format.channelCount == self.targetFormat.channelCount {
                converted = buffer
            } else {
                guard let conv = self.getConverter(from: buffer.format),
                      let output = AVAudioPCMBuffer(
                        pcmFormat: self.targetFormat,
                        frameCapacity: AVAudioFrameCount(
                            Double(buffer.frameLength) * 16000.0 / buffer.format.sampleRate
                        )
                      ) else { return }

                var error: NSError?
                let status = conv.convert(to: output, error: &error) { _, outStatus in
                    outStatus.pointee = .haveData
                    return buffer
                }
                guard status != .error, error == nil else { return }
                converted = output
            }

            // Convert Float32 → Int16 (LINEAR16)
            guard let floatData = converted.floatChannelData?[0] else { return }
            let frameCount = Int(converted.frameLength)
            var int16Data = [Int16](repeating: 0, count: frameCount)
            for i in 0..<frameCount {
                let clamped = max(-1.0, min(1.0, floatData[i]))
                int16Data[i] = Int16(clamped < 0 ? clamped * 32768 : clamped * 32767)
            }

            // Base64 encode
            let data = int16Data.withUnsafeBufferPointer { ptr in
                Data(buffer: ptr)
            }
            let base64 = data.base64EncodedString()

            // Send audioChunk
            let message: [String: Any] = ["audioChunk": base64]
            self.sendJSON(message)
        }
    }

    /// Signal end of speaker's turn
    public func endTurn() {
        sendJSON(["endTurn": [:] as [String: String]])
    }

    // MARK: - Connection Lifecycle

    private func doConnect() {
        cleanup()

        let session = URLSession(configuration: .default, delegate: self, delegateQueue: nil)
        self.urlSession = session

        let task = session.webSocketTask(with: Self.wsURL)
        self.webSocket = task
        task.resume()

        // Start receiving messages
        receiveMessage()

        // Send config after a brief delay to ensure connection is established
        queue.asyncAfter(deadline: .now() + 0.1) { [weak self] in
            self?.sendConfig()
        }
    }

    private func sendConfig() {
        guard let apiKey = self.apiKey else {
            DispatchQueue.main.async { [weak self] in
                self?.onError?(InworldSTTError.invalidConfiguration)
            }
            return
        }

        var config: [String: Any] = [
            "transcribeConfig": [
                "modelId": Self.defaultModel,
                "audioEncoding": "LINEAR16",
                "sampleRateHertz": 16000,
                "languageCode": locale,
                "voiceProfile": ["enabled": true],
            ] as [String: Any]
        ]

        // Add keyword hints if provided
        if !hints.isEmpty {
            var transcribeConfig = config["transcribeConfig"] as! [String: Any]
            transcribeConfig["speechContext"] = ["phrases": Array(hints.prefix(500))]
            config["transcribeConfig"] = transcribeConfig
        }

        // Auth header in config (Inworld uses API key in config, not HTTP headers for WS)
        config["auth"] = ["apiKey": apiKey]

        sendJSON(config)
        configSent = true
        isConnected = true
        reconnectAttempts = 0

        DispatchQueue.main.async { [weak self] in
            self?.onConnected?()
        }
    }

    private func sendCloseStream() {
        guard webSocket?.state == .running else { return }
        sendJSON(["closeStream": [:] as [String: String]])
    }

    private func cleanup() {
        isConnected = false
        configSent = false
        audioConverter = nil

        webSocket?.cancel(with: .goingAway, reason: nil)
        webSocket = nil
        urlSession?.invalidateAndCancel()
        urlSession = nil
    }

    private func attemptReconnect() {
        guard shouldReconnect, reconnectAttempts < Self.maxReconnectAttempts else {
            DispatchQueue.main.async { [weak self] in
                self?.onError?(InworldSTTError.maxReconnectsExceeded)
            }
            return
        }

        reconnectAttempts += 1
        let delay = Self.reconnectBaseMs * UInt64(pow(2.0, Double(reconnectAttempts - 1)))

        queue.asyncAfter(deadline: .now() + .milliseconds(Int(delay))) { [weak self] in
            guard let self = self, self.shouldReconnect, !self.isConnected else { return }
            self.doConnect()
        }
    }

    // MARK: - Message Handling

    private func receiveMessage() {
        webSocket?.receive { [weak self] result in
            guard let self = self else { return }

            switch result {
            case .success(let message):
                switch message {
                case .string(let text):
                    self.handleMessage(text)
                case .data(let data):
                    if let text = String(data: data, encoding: .utf8) {
                        self.handleMessage(text)
                    }
                @unknown default:
                    break
                }
                // Continue receiving
                self.receiveMessage()

            case .failure(let error):
                if self.shouldReconnect {
                    self.isConnected = false
                    self.attemptReconnect()
                }
            }
        }
    }

    private func handleMessage(_ text: String) {
        guard let data = text.data(using: .utf8),
              let json = try? JSONSerialization.jsonObject(with: data) as? [String: Any] else {
            return
        }

        // Transcript (interim or final)
        if let transcript = json["transcript"] as? [String: Any] {
            let text = transcript["text"] as? String ?? ""
            let isFinal = transcript["isFinal"] as? Bool ?? false
            DispatchQueue.main.async { [weak self] in
                if isFinal {
                    self?.onFinal?(text)
                } else {
                    self?.onInterim?(text)
                }
            }
        }

        // Speech activity detection (VAD)
        if json["speechStarted"] != nil {
            DispatchQueue.main.async { [weak self] in
                self?.onSpeechStarted?()
            }
        }
        if json["speechStopped"] != nil {
            DispatchQueue.main.async { [weak self] in
                self?.onSpeechStopped?()
            }
        }

        // Voice profiling
        if let profile = json["voiceProfile"] as? [String: Any] {
            let vp = InworldVoiceProfile(
                emotion: profile["emotion"] as? String,
                accent: profile["accent"] as? String,
                age: profile["age"] as? String,
                pitch: profile["pitch"] as? String,
                confidence: profile["confidence"] as? Double
            )
            DispatchQueue.main.async { [weak self] in
                self?.onVoiceProfile?(vp)
            }
        }

        // Error from server
        if let error = json["error"] as? [String: Any] {
            let message = error["message"] as? String ?? "Inworld STT error"
            DispatchQueue.main.async { [weak self] in
                self?.onError?(InworldSTTError.connectionFailed(message))
            }
        }
    }

    // MARK: - Helpers

    private func sendJSON(_ dict: [String: Any]) {
        guard let data = try? JSONSerialization.data(withJSONObject: dict),
              let text = String(data: data, encoding: .utf8) else { return }

        webSocket?.send(.string(text)) { error in
            if let error = error {
                print("[InworldSTT] Send error: \(error.localizedDescription)")
            }
        }
    }

    private func getConverter(from sourceFormat: AVAudioFormat) -> AVAudioConverter? {
        if let existing = audioConverter { return existing }
        let converter = AVAudioConverter(from: sourceFormat, to: targetFormat)
        audioConverter = converter
        return converter
    }
}

// MARK: - URLSessionWebSocketDelegate

extension InworldSTTClient: URLSessionWebSocketDelegate {
    public func urlSession(
        _ session: URLSession,
        webSocketTask: URLSessionWebSocketTask,
        didOpenWithProtocol protocol: String?
    ) {
        // Connection opened — config is sent in doConnect after brief delay
    }

    public func urlSession(
        _ session: URLSession,
        webSocketTask: URLSessionWebSocketTask,
        didCloseWith closeCode: URLSessionWebSocketTask.CloseCode,
        reason: Data?
    ) {
        let wasConnected = isConnected
        isConnected = false
        configSent = false

        DispatchQueue.main.async { [weak self] in
            self?.onDisconnected?()
        }

        // Auto-reconnect on unexpected close
        if wasConnected && shouldReconnect {
            attemptReconnect()
        }
    }
}
