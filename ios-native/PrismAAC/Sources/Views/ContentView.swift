import SwiftUI
import WebKit
import AVFoundation
import Speech
import WatchConnectivity

/// PrismAAC iOS host — WKWebView wrapping synalux.ai/prism-aac.
///
/// Why WKWebView and not a pure SwiftUI rebuild:
///   - The web app has 22+ categories, math module, AI chat, autocorrect,
///     all languages, prediction engine — re-implementing in Swift takes months
///   - Apple guideline 4.2 allows web views that host YOUR OWN first-party
///     content with significant native enhancement. We add: AVSpeechSynthesizer
///     TTS (better than WebSpeech on iOS), on-device 1.7B inference, Watch
///     companion, emergency service, offline cache.
///
/// Native bridge (JS → Swift):
///   prismNative.speak(text, lang, rate)   → AVSpeechSynthesizer
///   prismNative.emergency(phrase)         → WatchConnectivity + Twilio
///   prismNative.memoryPressure()          → returns free MB
///
/// Offline: WKWebView built-in HTTP cache + content-world localStorage.
/// First load: fetches live. Subsequent loads: cache-first (works offline).

struct ContentView: View {
    @EnvironmentObject var app: AppState
    @State private var webLoaded = false

    var body: some View {
        ZStack(alignment: .top) {
            PrismWebView(pipeline: app.pipeline, onLoaded: { webLoaded = true })
                .ignoresSafeArea()

            if !webLoaded {
                VStack(spacing: 16) {
                    Spacer()
                    Image(systemName: "bubble.left.and.text.bubble.right.fill")
                        .font(.system(size: 56))
                        .foregroundColor(.accentColor)
                    Text("Prism AAC").font(.title).fontWeight(.bold)
                    ProgressView("Loading…").tint(.accentColor)
                    Spacer()
                }
                .frame(maxWidth: .infinity, maxHeight: .infinity)
                .background(Color(UIColor.systemBackground))
                .transition(.opacity)
            }

            if let banner = app.memoryBanner {
                VStack {
                    MemoryBannerView(message: banner, tier: app.tier)
                    Spacer()
                }
            }
        }
        .animation(.easeOut(duration: 0.3), value: webLoaded)
    }
}

// MARK: - Web view

struct PrismWebView: UIViewRepresentable {
    let pipeline: AACPipeline
    var onLoaded: (() -> Void)?

    func makeCoordinator() -> Coordinator { Coordinator(pipeline: pipeline, onLoaded: onLoaded) }

    func makeUIView(context: Context) -> WKWebView {
        let config = WKWebViewConfiguration()

        // Allow media playback without user gesture (needed for AAC TTS)
        config.allowsInlineMediaPlayback = true
        config.mediaTypesRequiringUserActionForPlayback = []

        // Register native bridge — JS calls prismNative.* methods
        let contentController = WKUserContentController()
        contentController.add(context.coordinator, name: "prismNative")
        config.userContentController = contentController

        // Inject bridge script so the web app can call native methods
        let bridgeJS = WKUserScript(
            source: nativeBridgeScript(),
            injectionTime: .atDocumentStart,
            forMainFrameOnly: true  // C13: prevent iframes from triggering emergency
        )
        contentController.addUserScript(bridgeJS)

        // Generous cache so offline works
        config.websiteDataStore = .default()

        let webView = WKWebView(frame: .zero, configuration: config)
        webView.allowsBackForwardNavigationGestures = false
        webView.scrollView.bounces = false
        webView.scrollView.contentInsetAdjustmentBehavior = .never
        webView.navigationDelegate = context.coordinator
        webView.uiDelegate = context.coordinator
        webView.backgroundColor = .systemBackground

        // Load the app
        // DEBUG defaults to fresh fetch from the dev server so web-layer
        // iteration shows up immediately. RELEASE uses cache-first so the
        // app survives a network failure once it's been loaded at least
        // once (service worker + WKWebView cache).
        #if DEBUG
        let url = URL(string: "http://localhost:3001/prism-aac")!
        var request = URLRequest(url: url, cachePolicy: .reloadIgnoringLocalCacheData)
        #else
        let url = URL(string: "https://synalux.ai/prism-aac")!
        var request = URLRequest(url: url, cachePolicy: .returnCacheDataElseLoad)
        #endif
        request.timeoutInterval = 15
        webView.load(request)

        return webView
    }

    func updateUIView(_ webView: WKWebView, context: Context) {}

    // MARK: - Native bridge JS

    private func nativeBridgeScript() -> String {
        """
        // Prism Native Bridge — injected before page load.
        // Intercepts AAC speak calls and routes to AVSpeechSynthesizer via WKScriptMessageHandler.
        window.prismNativeBridge = {
            speak: function(text, lang, rate) {
                window.webkit.messageHandlers.prismNative.postMessage({
                    action: 'speak', text: text, lang: lang || 'en-US', rate: rate || 0.5
                });
            },
            stopSpeech: function() {
                window.webkit.messageHandlers.prismNative.postMessage({ action: 'stopSpeech' });
            },
            startVoice: function(lang) {
                window.webkit.messageHandlers.prismNative.postMessage({ action: 'startVoice', lang: lang || 'en-US' });
            },
            stopVoice: function() {
                window.webkit.messageHandlers.prismNative.postMessage({ action: 'stopVoice' });
            },
            emergency: function(phrase) {
                window.webkit.messageHandlers.prismNative.postMessage({
                    action: 'emergency', phrase: phrase
                });
            },
            freeMemoryMB: function() {
                // Async — returns via prismNativeCallback
                window.webkit.messageHandlers.prismNative.postMessage({ action: 'memoryPressure' });
            },
            askAI: function(question, lang) {
                window.webkit.messageHandlers.prismNative.postMessage({
                    action: 'askAI', question: question, lang: lang || 'en'
                });
            }
        };
        // Watch→web bridge: native side calls window.prismOnWatchMessage(payload)
        // when the Watch sends send_alert or send_message. Web installs a handler
        // (services/watchAlertBridge.ts) to route via sendToContact.
        if (!window.prismOnWatchMessage) {
            window.prismOnWatchMessage = function(payload) {
                // Default no-op until the web app installs the real handler.
                console.warn('[PrismNative] prismOnWatchMessage fired before web handler registered', payload);
            };
        }
        // Override Web Speech API with native TTS for better iOS quality
        if (window.speechSynthesis) {
            const _native = window.prismNativeBridge;
            window.speechSynthesis.speak = function(utt) {
                _native.speak(utt.text, utt.lang, utt.rate);
                // Fire onend after estimated duration
                if (utt.onend) setTimeout(() => utt.onend({}), Math.max(500, utt.text.length * 60));
            };
            window.speechSynthesis.cancel = function() { _native.stopSpeech(); };
        }
        console.log('[PrismNative] bridge ready');
        """
    }

    // MARK: - Coordinator

    class Coordinator: NSObject, WKNavigationDelegate, WKUIDelegate, WKScriptMessageHandler {
        let pipeline: AACPipeline
        let tts = WKWebTTS()
        var onLoaded: (() -> Void)?
        private var lastEmergencyTriggerTime: TimeInterval = 0
        private var speechRecognizer: SFSpeechRecognizer?
        private var recognitionRequest: SFSpeechAudioBufferRecognitionRequest?
        private var recognitionTask: SFSpeechRecognitionTask?
        private lazy var audioEngine = AVAudioEngine()
        private weak var activeWebView: WKWebView?

        init(pipeline: AACPipeline, onLoaded: (() -> Void)? = nil) {
            self.pipeline = pipeline
            self.onLoaded = onLoaded
        }

        func webView(_ webView: WKWebView, didFinish navigation: WKNavigation!) {
            activeWebView = webView
            // Install the Watch→web forwarder now that the page is loaded and
            // window.prismOnWatchMessage exists (either from the injected default
            // no-op or from the web app's services/watchAlertBridge.ts handler).
            WatchEmergencyBridge.shared.watchMessageForwarder = { [weak webView] type, body, to in
                let payload: [String: Any] = [
                    "type": type,
                    "body": body,
                    "to": to as Any,
                ]
                guard let data = try? JSONSerialization.data(withJSONObject: payload),
                      let json = String(data: data, encoding: .utf8) else { return }
                webView?.evaluateJavaScript(
                    "window.prismOnWatchMessage && window.prismOnWatchMessage(\(json))",
                    completionHandler: nil
                )
            }
            Task { @MainActor in onLoaded?(); onLoaded = nil }
        }

        // FIX L1: clear #if DEBUG boundary — no mid-expression preprocessor directives
        private static func isAllowedOrigin(_ url: URL) -> Bool {
            if url.host == "synalux.ai" || url.host?.hasSuffix(".synalux.ai") == true {
                return true
            }
            #if DEBUG
            if url.host == "localhost" { return true }
            #endif
            return false
        }

        // Handle JS → Native messages
        func userContentController(_ controller: WKUserContentController,
                                   didReceive message: WKScriptMessage) {
            guard let body = message.body as? [String: Any],
                  let action = body["action"] as? String else { return }
            switch action {
            case "speak":
                // FIX M5: cap text length to prevent memory exhaustion from malicious pages
                let text = String((body["text"] as? String ?? "").prefix(2000))
                let lang = body["lang"] as? String ?? "en-US"
                let rate = Float(body["rate"] as? Double ?? 0.5)
                tts.speak(text, language: lang, rate: rate)
            case "stopSpeech":
                tts.stop()
            case "emergency":
                // C14: Rate limit — max 1 emergency trigger per 30 seconds
                let now = Date().timeIntervalSince1970
                guard now - lastEmergencyTriggerTime >= 30 else {
                    NSLog("[PrismAAC] Emergency rate-limited (too frequent)")
                    return
                }
                lastEmergencyTriggerTime = now

                // C14: Origin validation — only honor from verified origin
                guard let pageURL = message.webView?.url,
                      Self.isAllowedOrigin(pageURL) else {
                    NSLog("[PrismAAC] Emergency blocked from untrusted origin: \(message.webView?.url?.host ?? "nil")")
                    return
                }

                // C14: Main frame only
                guard message.frameInfo.isMainFrame else { return }

                // C14: Phrase length cap
                let phrase = String((body["phrase"] as? String ?? "Help").prefix(500))
                Task { @MainActor in
                    WatchEmergencyBridge.shared.trigger(phrase: phrase)
                }
            case "memoryPressure":
                let free = AppState.measureFreeMemoryMB()
                message.webView?.evaluateJavaScript(
                    "window.prismNativeCallback && window.prismNativeCallback('memoryPressure', \(free))",
                    completionHandler: nil
                )
            case "askAI":
                NSLog("[PrismAAC-AI-DIAG] askAI message received")
                guard let pageURL = message.webView?.url,
                      Self.isAllowedOrigin(pageURL),
                      message.frameInfo.isMainFrame else {
                    NSLog("[PrismAAC-AI-DIAG] askAI REJECTED — origin/frame")
                    return
                }
                let question = String((body["question"] as? String ?? "").prefix(500))
                let lang = body["lang"] as? String ?? "en"
                NSLog("[PrismAAC-AI-DIAG] askAI question='\(question.prefix(40))' lang=\(lang)")
                guard !question.isEmpty else {
                    NSLog("[PrismAAC-AI-DIAG] askAI empty question")
                    return
                }
                let webView = message.webView
                Task { @MainActor in
                    let encoder = JSONEncoder()
                    NSLog("[PrismAAC-AI-DIAG] askAI calling pipeline.ask")
                    var tokenCount = 0
                    for await token in self.pipeline.ask(question: question, language: lang) {
                        tokenCount += 1
                        if tokenCount == 1 || tokenCount % 20 == 0 {
                            NSLog("[PrismAAC-AI-DIAG] token #\(tokenCount): '\(token.prefix(40))'")
                        }
                        // JSONSerialization.data(withJSONObject:) requires Array/Dict at top
                        // level — passing a String raises NSInvalidArgumentException which
                        // `try?` cannot catch (NSException → SIGABRT). JSONEncoder safely
                        // encodes primitive Encodable values including String.
                        guard let data = try? encoder.encode(token),
                              let json = String(data: data, encoding: .utf8) else { continue }
                        webView?.evaluateJavaScript(
                            "window.prismNativeAIResult && window.prismNativeAIResult(\(json))"
                        ) { _, _ in }
                    }
                    NSLog("[PrismAAC-AI-DIAG] askAI done — total tokens=\(tokenCount)")
                    webView?.evaluateJavaScript(
                        "window.prismNativeAIDone && window.prismNativeAIDone()"
                    ) { _, _ in }
                }
            case "startVoice":
                NSLog("[PrismAAC-MIC-DIAG] startVoice message received")
                guard let pageURL = message.webView?.url,
                      Self.isAllowedOrigin(pageURL),
                      message.frameInfo.isMainFrame else {
                    NSLog("[PrismAAC-MIC-DIAG] startVoice REJECTED — origin/frame check failed (url=\(message.webView?.url?.absoluteString ?? "nil"))")
                    return
                }
                let lang = body["lang"] as? String ?? "en-US"
                NSLog("[PrismAAC-MIC-DIAG] startVoice → startSpeechRecognition(lang=\(lang))")
                startSpeechRecognition(lang: lang, webView: message.webView)
            case "stopVoice":
                NSLog("[PrismAAC-MIC-DIAG] stopVoice message received")
                stopSpeechRecognition()
            default: break
            }
        }

        func webView(_ webView: WKWebView,
                     requestMediaCapturePermissionFor origin: WKSecurityOrigin,
                     initiatedByFrame frame: WKFrameInfo,
                     type: WKMediaCaptureType,
                     decisionHandler: @escaping (WKPermissionDecision) -> Void) {
            guard let originURL = URL(string: "\(origin.protocol)://\(origin.host)"),
                  Self.isAllowedOrigin(originURL) else {
                decisionHandler(.deny)
                return
            }
            switch type {
            case .microphone, .cameraAndMicrophone:
                decisionHandler(.grant)
            case .camera:
                decisionHandler(.deny)
            @unknown default:
                decisionHandler(.prompt)
            }
        }

        // MARK: - SFSpeechRecognizer bridge

        private static let langPattern = try! NSRegularExpression(pattern: "^[a-zA-Z]{2,3}(-[a-zA-Z0-9]{2,8})?$")
        private var recognitionGeneration: UInt64 = 0
        private var recognitionTimeout: DispatchWorkItem?
        private var lastStartVoiceTime: TimeInterval = 0

        private func startSpeechRecognition(lang: String, webView: WKWebView?) {
            let now = Date().timeIntervalSince1970
            guard now - lastStartVoiceTime >= 0.5 else {
                NSLog("[PrismAAC-MIC-DIAG] DEBOUNCED — last start was \(now - lastStartVoiceTime)s ago")
                return
            }
            lastStartVoiceTime = now

            // iOS Simulator: SFSpeechRecognizer's on-device daemon
            // (localspeechrecognition) is broken (kLSRErrorDomain 300) AND
            // AVAudioEngine.start() can SIGABRT when AURemoteIO gets stuck
            // after prior bad cycles. We surface the error immediately
            // without touching the audio session/engine at all — the JS
            // side maps "ondevice-unavailable" to a clear banner and the
            // Web Speech API fallback.
            #if targetEnvironment(simulator)
            NSLog("[PrismAAC-MIC-DIAG] SIM detected — skipping audio engine to avoid AURemoteIO SIGABRT")
            activeWebView = webView
            sendSpeechError("ondevice-unavailable")
            return
            #else
            stopSpeechRecognition()
            activeWebView = webView
            #endif
            recognitionGeneration &+= 1
            let gen = recognitionGeneration

            let safeLang = String(lang.prefix(11))
            let range = NSRange(safeLang.startIndex..., in: safeLang)
            guard Self.langPattern.firstMatch(in: safeLang, range: range) != nil else {
                NSLog("[PrismAAC-MIC-DIAG] FAILED — invalid-language: \(safeLang)")
                sendSpeechError("invalid-language")
                return
            }

            let locale = Locale(identifier: safeLang)
            speechRecognizer = SFSpeechRecognizer(locale: locale) ?? SFSpeechRecognizer()

            guard let speechRecognizer, speechRecognizer.isAvailable else {
                NSLog("[PrismAAC-MIC-DIAG] FAILED — SFSpeechRecognizer unavailable (locale=\(safeLang), isAvailable=\(speechRecognizer?.isAvailable ?? false))")
                sendSpeechError("unavailable")
                return
            }
            NSLog("[PrismAAC-MIC-DIAG] requesting authorization (locale=\(safeLang))")

            SFSpeechRecognizer.requestAuthorization { [weak self] status in
                DispatchQueue.main.async {
                    NSLog("[PrismAAC-MIC-DIAG] authorization status: \(status.rawValue)")
                    guard let self, self.recognitionGeneration == gen else {
                        NSLog("[PrismAAC-MIC-DIAG] stale generation — aborting")
                        return
                    }
                    switch status {
                    case .authorized:
                        NSLog("[PrismAAC-MIC-DIAG] ✓ authorized → beginRecognitionSession")
                        self.beginRecognitionSession(generation: gen)
                    case .denied:
                        NSLog("[PrismAAC-MIC-DIAG] ✗ denied")
                        self.sendSpeechError("denied")
                    case .restricted:
                        NSLog("[PrismAAC-MIC-DIAG] ✗ restricted")
                        self.sendSpeechError("restricted")
                    case .notDetermined:
                        NSLog("[PrismAAC-MIC-DIAG] ✗ not-determined")
                        self.sendSpeechError("not-determined")
                    @unknown default:
                        NSLog("[PrismAAC-MIC-DIAG] ✗ unknown status \(status.rawValue)")
                        self.sendSpeechError("unavailable")
                    }
                }
            }
        }

        private func beginRecognitionSession(generation: UInt64) {
            guard recognitionGeneration == generation else {
                NSLog("[PrismAAC-MIC-DIAG] beginRecognitionSession — stale generation")
                return
            }
            NSLog("[PrismAAC-MIC-DIAG] configuring AVAudioSession")
            let audioSession = AVAudioSession.sharedInstance()
            do {
                try audioSession.setCategory(.playAndRecord, options: [.defaultToSpeaker, .allowBluetoothHFP])
                try audioSession.setMode(.measurement)
                try audioSession.setActive(true, options: .notifyOthersOnDeactivation)
                NSLog("[PrismAAC-MIC-DIAG] ✓ audio session active")
            } catch {
                NSLog("[PrismAAC-MIC-DIAG] ✗ audio-session-failed: \(error.localizedDescription)")
                sendSpeechError("audio-session-failed")
                return
            }

            recognitionRequest = SFSpeechAudioBufferRecognitionRequest()
            guard let recognitionRequest else {
                NSLog("[PrismAAC-MIC-DIAG] ✗ request-failed (couldn't create SFSpeechAudioBufferRecognitionRequest)")
                sendSpeechError("request-failed")
                return
            }
            recognitionRequest.shouldReportPartialResults = true
            // Force server-based recognition. On the iOS Simulator the
            // on-device speech recognizer (`localspeechrecognition` daemon)
            // often fails to initialize with kLSRErrorDomain code=300
            // "Failed to initialize recognizer" because the on-device
            // language model isn't shipped with the simulator runtime.
            // Server-based works fine on both sim and device when online.
            recognitionRequest.requiresOnDeviceRecognition = false
            recognitionRequest.taskHint = .dictation

            let inputNode = audioEngine.inputNode
            let recordingFormat = inputNode.outputFormat(forBus: 0)
            NSLog("[PrismAAC-MIC-DIAG] input format: \(recordingFormat) (sampleRate=\(recordingFormat.sampleRate))")
            var bufferCount = 0
            inputNode.installTap(onBus: 0, bufferSize: 1024, format: recordingFormat) { [weak self] buffer, _ in
                bufferCount += 1
                if bufferCount == 1 || bufferCount % 50 == 0 {
                    NSLog("[PrismAAC-MIC-DIAG] audio buffer #\(bufferCount) frames=\(buffer.frameLength)")
                }
                self?.recognitionRequest?.append(buffer)
            }

            recognitionTask = speechRecognizer?.recognitionTask(with: recognitionRequest) { [weak self] result, error in
                DispatchQueue.main.async {
                    guard let self, self.recognitionGeneration == generation else { return }
                    if let result {
                        let text = String(result.bestTranscription.formattedString.prefix(2000))
                        NSLog("[PrismAAC-MIC-DIAG] result text='\(text.prefix(60))' isFinal=\(result.isFinal)")
                        self.sendSpeechResult(interim: result.isFinal ? "" : text,
                                              final: result.isFinal ? text : "")
                        if result.isFinal { self.stopSpeechRecognition() }
                    } else if let error {
                        let nsErr = error as NSError
                        if nsErr.code != 216 {
                            NSLog("[PrismAAC-MIC-DIAG] ✗ recognition error code=\(nsErr.code) domain=\(nsErr.domain): \(error.localizedDescription)")
                            // kLSRErrorDomain 300/301 → on-device model
                            // missing (typical on iOS Simulator).
                            // Differentiate so the UI can show a useful
                            // hint instead of a generic failure.
                            if nsErr.domain == "kLSRErrorDomain" {
                                self.sendSpeechError("ondevice-unavailable")
                            } else {
                                self.sendSpeechError("recognition-failed")
                            }
                        }
                    }
                }
            }

            guard recognitionTask != nil else {
                NSLog("[PrismAAC-MIC-DIAG] ✗ recognitionTask is nil")
                audioEngine.inputNode.removeTap(onBus: 0)
                sendSpeechError("recognition-failed")
                return
            }

            audioEngine.prepare()
            do {
                try audioEngine.start()
                NSLog("[PrismAAC-MIC-DIAG] ✓ audioEngine started — listening")
            } catch {
                NSLog("[PrismAAC-MIC-DIAG] ✗ audio-engine-failed: \(error.localizedDescription)")
                sendSpeechError("audio-engine-failed")
                stopSpeechRecognition()
                return
            }

            recognitionTimeout?.cancel()
            let timeout = DispatchWorkItem { [weak self] in
                guard let self, self.recognitionGeneration == generation else { return }
                self.sendSpeechError("timeout")
                self.stopSpeechRecognition()
            }
            recognitionTimeout = timeout
            DispatchQueue.main.asyncAfter(deadline: .now() + 120, execute: timeout)
        }

        private func stopSpeechRecognition() {
            recognitionTimeout?.cancel()
            recognitionTimeout = nil
            if audioEngine.isRunning {
                audioEngine.stop()
                audioEngine.inputNode.removeTap(onBus: 0)
            }
            recognitionRequest?.endAudio()
            recognitionRequest = nil
            recognitionTask?.cancel()
            recognitionTask = nil
            speechRecognizer = nil
            // Restore audio session for TTS
            try? AVAudioSession.sharedInstance().setCategory(.playback, options: [.defaultToSpeaker])
            try? AVAudioSession.sharedInstance().setMode(.default)
            try? AVAudioSession.sharedInstance().setActive(true, options: .notifyOthersOnDeactivation)
        }

        private func sendSpeechResult(interim: String, final: String) {
            guard let data = try? JSONSerialization.data(withJSONObject: ["interim": interim, "final": final]),
                  let json = String(data: data, encoding: .utf8) else { return }
            activeWebView?.evaluateJavaScript(
                "window.prismNativeSpeechResult && window.prismNativeSpeechResult(\(json))"
            ) { [weak self] _, error in
                if error != nil { self?.stopSpeechRecognition() }
            }
        }

        private func sendSpeechError(_ code: String) {
            NSLog("[PrismAAC] Speech error: \(code)")
            // Same SIGABRT class as the askAI streaming path: JSONSerialization
            // raises NSException on non-Array/Dict top-level. Use JSONEncoder
            // which handles Encodable primitives safely.
            guard let data = try? JSONEncoder().encode(code),
                  let json = String(data: data, encoding: .utf8) else { return }
            activeWebView?.evaluateJavaScript(
                "window.prismNativeSpeechError && window.prismNativeSpeechError(\(json))"
            ) { _, _ in }
        }

        func webView(_ webView: WKWebView, didFailProvisionalNavigation _: WKNavigation!, withError error: Error) {
            if let url = Bundle.main.url(forResource: "offline", withExtension: "html"),
               let html = try? String(contentsOf: url, encoding: .utf8) {
                webView.loadHTMLString(html, baseURL: url.deletingLastPathComponent())
            } else {
                webView.loadHTMLString("<body style='background:#14161d;color:#fff;text-align:center;padding-top:40vh'><h2>No connection</h2><button onclick='location.reload()'>Retry</button></body>", baseURL: nil)
            }
        }
    }
}

// MARK: - Native TTS wrapper (better than WebSpeech on iOS)

final class WKWebTTS: NSObject {
    private let synth = AVSpeechSynthesizer()

    func speak(_ text: String, language: String = "en-US", rate: Float = 0.5) {
        synth.stopSpeaking(at: .immediate)
        // FIX L3: cap text length
        let utt = AVSpeechUtterance(string: String(text.prefix(2000)))
        utt.voice = AVSpeechSynthesisVoice(language: language)
        utt.rate = max(AVSpeechUtteranceMinimumSpeechRate,
                       min(AVSpeechUtteranceMaximumSpeechRate, rate))
        synth.speak(utt)
    }

    func stop() { synth.stopSpeaking(at: .immediate) }
}

// MARK: - Emergency bridge — sends SOS to Watch via WatchConnectivity

@MainActor
final class WatchEmergencyBridge: NSObject, WCSessionDelegate {
    static let shared = WatchEmergencyBridge()
    private static let iso8601 = ISO8601DateFormatter()

    /// Forwarder installed by the WKWebView Coordinator. When the Watch
    /// sends `send_alert` or `send_message`, this closure is invoked on
    /// MainActor with the parsed payload so the web app can ship the SMS
    /// via its existing portal/sendToContact infrastructure.
    var watchMessageForwarder: ((_ type: String, _ body: String, _ to: String?) -> Void)?

    // FIX H1: Activate WCSession at app startup with a delegate
    func activateSession() {
        guard WCSession.isSupported() else { return }
        WCSession.default.delegate = self
        WCSession.default.activate()
    }

    // WCSessionDelegate required methods
    nonisolated func session(_ session: WCSession, activationDidCompleteWith activationState: WCSessionActivationState, error: Error?) {
        if let error = error { NSLog("[WatchEmergencyBridge] Activation error: \(error)") }
    }
    nonisolated func sessionDidBecomeInactive(_ session: WCSession) {}
    nonisolated func sessionDidDeactivate(_ session: WCSession) {
        session.activate()
    }

    /// Watch → iPhone message receiver. Reachable-mode path (live, replyHandler available).
    /// Catches `send_alert` (one-tap caregiver alert) and `send_message` (composed SMS from
    /// WatchSendMessageView). Both route through the webview to the existing web sendToContact
    /// infrastructure. Replies optimistically ("queued"); actual delivery error surfaces in
    /// the iPhone UI rather than racing back to the Watch.
    nonisolated func session(_ session: WCSession, didReceiveMessage message: [String: Any], replyHandler: @escaping ([String: Any]) -> Void) {
        let type = (message["type"] as? String) ?? ""
        let body = String(((message["text"] as? String) ?? "").prefix(500))
        let to = (message["to"] as? String).map { String($0.prefix(100)) }
        guard type == "send_alert" || type == "send_message", !body.isEmpty else {
            replyHandler(["ok": false, "reason": "unsupported_or_empty"])
            return
        }
        Task { @MainActor in
            WatchEmergencyBridge.shared.watchMessageForwarder?(type, body, to)
            replyHandler(["ok": true, "status": "queued"])
        }
    }

    /// Watch → iPhone message receiver. Background-queue path (transferUserInfo).
    /// No replyHandler available. Forwards to the same path.
    nonisolated func session(_ session: WCSession, didReceiveUserInfo userInfo: [String : Any] = [:]) {
        let type = (userInfo["type"] as? String) ?? ""
        let body = String(((userInfo["text"] as? String) ?? "").prefix(500))
        let to = (userInfo["to"] as? String).map { String($0.prefix(100)) }
        guard type == "send_alert" || type == "send_message", !body.isEmpty else { return }
        Task { @MainActor in
            WatchEmergencyBridge.shared.watchMessageForwarder?(type, body, to)
        }
    }

    func trigger(phrase: String) {
        // FIX H4: Sanitize phrase before sending to Watch (defense-in-depth)
        let safePhrase = AACPipeline.sanitizeText(phrase, maxLength: 200)
        let msg: [String: Any] = [
            "type": "emergency",
            "phrase": safePhrase.isEmpty ? "Emergency" : safePhrase,
            "severity": "standard",
            "timestamp": Self.iso8601.string(from: Date()),
        ]
        guard WCSession.isSupported() else { return }
        let session = WCSession.default
        // FIX M2: transferUserInfo also requires activated session — log and return
        guard session.activationState == .activated else {
            NSLog("[WatchEmergencyBridge] Session not activated — cannot dispatch emergency")
            return
        }
        if session.isReachable {
            session.sendMessage(msg, replyHandler: nil, errorHandler: { err in
                NSLog("[WatchEmergencyBridge] sendMessage failed: \(err) — queueing")
                session.transferUserInfo(msg)
            })
        } else {
            session.transferUserInfo(msg)
        }
    }
}

// MARK: - Memory banner (shown as overlay)

struct MemoryBannerView: View {
    let message: String
    let tier: AppState.FeatureTier
    private var color: Color { tier == .emergency ? .red : .orange }

    var body: some View {
        HStack {
            Image(systemName: tier == .emergency ? "exclamationmark.triangle.fill" : "memorychip")
            Text(message).font(.caption).fontWeight(.medium)
            Spacer()
        }
        .padding(.horizontal, 12).padding(.vertical, 6)
        .background(color.opacity(0.9)).foregroundColor(.white)
    }
}

// MARK: - Model loading screen (shown before web if model download needed)

struct ModelLoadingView: View {
    @EnvironmentObject var app: AppState
    @State private var phase: Phase = .checking

    enum Phase { case checking, downloading, failed, lowMemory }

    var body: some View {
        VStack(spacing: 24) {
            Spacer()
            Image(systemName: "brain.fill").font(.system(size: 64)).foregroundColor(.accentColor)
            switch phase {
            case .checking: ProgressView("Checking…")
            case .downloading:
                VStack(spacing: 8) {
                    Text("Downloading AI model (1 GB)").font(.headline)
                    ProgressView().padding(.horizontal, 32)
                }
            case .lowMemory:
                VStack(spacing: 12) {
                    Text("Low memory").font(.headline)
                    Text("Cloud AI is active. Core AAC works offline.").foregroundColor(.secondary)
                    Button("Continue") { app.enterCoreOnlyMode() }.buttonStyle(.borderedProminent)
                }
            case .failed:
                VStack(spacing: 12) {
                    Text("Download failed").font(.headline)
                    Button("Try again") { Task { await start() } }.buttonStyle(.bordered)
                    Button("Skip") { app.enterCoreOnlyMode() }
                }
            }
            Spacer()
            if phase != .lowMemory && phase != .failed {
                Button("Skip AI model") { app.enterCoreOnlyMode() }
                    .font(.caption).foregroundColor(.secondary)
            }
        }
        .task { await start() }
    }

    private func start() async {
        phase = .checking
        guard AppState.measureFreeMemoryMB() >= 1_200 else { phase = .lowMemory; return }
        let url = FileManager.default
            .urls(for: .documentDirectory, in: .userDomainMask)[0]
            .appendingPathComponent("models/prism-aac-1b7-q4km.gguf")
        if FileManager.default.fileExists(atPath: url.path) { await app.loadModel(from: url); return }
        phase = .downloading
        do {
            // FIX L4: Use download task instead of byte-by-byte streaming (avoids quadratic realloc)
            let cdnURL = URL(string: "https://huggingface.co/dcostenco/prism-coder-1.7b/resolve/main/prism-aac-1b7-q4km.gguf")!
            try FileManager.default.createDirectory(at: url.deletingLastPathComponent(), withIntermediateDirectories: true)
            let (tempURL, response) = try await URLSession.shared.download(from: cdnURL)
            if let http = response as? HTTPURLResponse, !(200...299).contains(http.statusCode) {
                phase = .failed; return
            }
            try FileManager.default.moveItem(at: tempURL, to: url)
            await app.loadModel(from: url)
        } catch { phase = .failed }
    }
}
