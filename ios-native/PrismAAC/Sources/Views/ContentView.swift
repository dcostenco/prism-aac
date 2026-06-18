import SwiftUI
import WebKit
import AVFoundation
import Speech
#if canImport(DatadogWebViewTracking)
import DatadogWebViewTracking
#endif
import StoreKit
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
///   prismNative.requestReview()           → StoreKit review prompt (frequency-limited)
///
/// Offline: WKWebView built-in HTTP cache + content-world localStorage.
/// First load: fetches live. Subsequent loads: cache-first (works offline).

struct ContentView: View {
    @EnvironmentObject var app: AppState
    @State private var webLoaded = false
    @Environment(\.requestReview) private var requestReview

    var body: some View {
        ZStack(alignment: .top) {
            PrismWebView(pipeline: app.pipeline, onLoaded: { webLoaded = true }, requestReview: { requestReview() })
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
    var requestReview: (() -> Void)?

    func makeCoordinator() -> Coordinator { Coordinator(pipeline: pipeline, onLoaded: onLoaded, requestReview: requestReview) }

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
        webView.scrollView.bounces                  = false
        webView.scrollView.contentInsetAdjustmentBehavior = .never
        webView.navigationDelegate  = context.coordinator
        webView.uiDelegate          = context.coordinator

        #if canImport(DatadogWebViewTracking)
        WebViewTracking.enable(webView: webView)
        #endif
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
            },
            openSettings: function(section) {
                // Deep-links into iOS Settings (e.g. Accessibility → Voice Control).
                // The Swift handler whitelists the section value — no arbitrary URL injection.
                window.webkit.messageHandlers.prismNative.postMessage({
                    action: 'openSettings', section: section || 'accessibility'
                });
            },
            requestReview: function() {
                // Triggers App Store review prompt. Native side has frequency limiting.
                window.webkit.messageHandlers.prismNative.postMessage({
                    action: 'requestReview'
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
                if (utt.onend) setTimeout(() => utt.onend.call(utt, new Event('end')), Math.max(500, utt.text.length * 60));
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
        private var lastAskAITime: TimeInterval = 0
        private var speechRecognizer: SFSpeechRecognizer?
        private var recognitionRequest: SFSpeechAudioBufferRecognitionRequest?
        private var recognitionTask: SFSpeechRecognitionTask?
        private lazy var audioEngine = AVAudioEngine()
        private weak var activeWebView: WKWebView?
        
        private let inworldClient = InworldSTTClient()

        var requestReview: (() -> Void)?

        init(pipeline: AACPipeline, onLoaded: (() -> Void)? = nil, requestReview: (() -> Void)? = nil) {
            self.pipeline = pipeline
            self.onLoaded = onLoaded
            self.requestReview = requestReview
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

        private static func isAllowedOrigin(_ url: URL) -> Bool {
            BridgeSecurityPolicy.isAllowedOrigin(url)
        }

        // Handle JS → Native messages
        func userContentController(_ controller: WKUserContentController,
                                   didReceive message: WKScriptMessage) {
            guard let body = message.body as? [String: Any],
                  let action = body["action"] as? String else { return }
            switch action {
            case "speak":
                let text = String((body["text"] as? String ?? "").prefix(BridgeSecurityPolicy.maxSpeakTextLength))
                let rawLang = body["lang"] as? String ?? "en-US"
                let lang = BridgeSecurityPolicy.isValidLang(rawLang) ? rawLang : "en-US"
                let webSpeechRate = Float(body["rate"] as? Double ?? 1.0)
                tts.speak(text, language: lang, webSpeechRate: webSpeechRate)
                maybeRequestAppStoreReview()
            case "stopSpeech":
                tts.stop()
            case "emergency":
                let now = Date().timeIntervalSince1970
                guard now - lastEmergencyTriggerTime >= BridgeSecurityPolicy.emergencyRateLimitSeconds else {
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

                let phrase = String((body["phrase"] as? String ?? "Help").prefix(BridgeSecurityPolicy.maxEmergencyPhraseLength))
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
                guard let pageURL = message.webView?.url,
                      Self.isAllowedOrigin(pageURL),
                      message.frameInfo.isMainFrame else {
                    return
                }
                let now = Date().timeIntervalSince1970
                guard now - lastAskAITime >= BridgeSecurityPolicy.askAIRateLimitSeconds else { return }
                lastAskAITime = now
                let question = String((body["question"] as? String ?? "").prefix(BridgeSecurityPolicy.maxAskAIQuestionLength))
                let rawLang = String((body["lang"] as? String ?? "en").prefix(BridgeSecurityPolicy.maxLangTagLength))
                let lang = BridgeSecurityPolicy.isValidLang(rawLang) ? rawLang : "en"
                guard !question.isEmpty else {
                    return
                }
                weak var webView = message.webView
                Task { @MainActor in
                    let encoder = JSONEncoder()
                    var fullOutput = ""
                    var buffer = ""
                    var tokenCount = 0
                    let batchSize = 5
                    var outputBlocked = false
                    func flushBuffer() {
                        guard !buffer.isEmpty, !outputBlocked else { buffer = ""; return }
                        let result = SafetyFilter.check(fullOutput + buffer)
                        if case .safe = result {
                            // safe — continue
                        } else {
                            NSLog("[PrismAAC] AI output blocked by SafetyFilter")
                            outputBlocked = true
                            buffer = ""
                            let referral: String
                            switch result {
                            case .crisis(let response): referral = response
                            case .medical(let response): referral = response
                            default: referral = "I can't help with that. If you're in crisis, please contact 988 (Suicide & Crisis Lifeline)."
                            }
                            if let data = try? encoder.encode(referral),
                               let json = String(data: data, encoding: .utf8) {
                                webView?.evaluateJavaScript(
                                    "window.prismNativeAIResult && window.prismNativeAIResult(\(json))"
                                ) { _, _ in }
                            }
                            return
                        }
                        guard let data = try? encoder.encode(buffer),
                              let json = String(data: data, encoding: .utf8) else { return }
                        webView?.evaluateJavaScript(
                            "window.prismNativeAIResult && window.prismNativeAIResult(\(json))"
                        ) { _, _ in }
                        fullOutput += buffer
                        buffer = ""
                    }
                    for await token in self.pipeline.ask(question: question, language: lang) {
                        buffer += token
                        tokenCount += 1
                        if tokenCount % batchSize == 0 { flushBuffer() }
                    }
                    flushBuffer()
                    webView?.evaluateJavaScript(
                        "window.prismNativeAIDone && window.prismNativeAIDone()"
                    ) { _, _ in }
                }
            case "startVoice":
                guard let pageURL = message.webView?.url,
                      Self.isAllowedOrigin(pageURL),
                      message.frameInfo.isMainFrame else {
                    return
                }
                let lang = body["lang"] as? String ?? "en-US"
                startSpeechRecognition(lang: lang, webView: message.webView)
            case "stopVoice":
                stopSpeechRecognition()
            case "requestReview":
                // Web app can trigger App Store review prompt at strategic moments
                // (e.g. after completing learning exercises, after 7+ days of use).
                // Delegates to maybeRequestAppStoreReview() which already has
                // frequency limiting (every 50 speaks, max once per 60 days).
                maybeRequestAppStoreReview()
            case "openSettings":
                // Security: origin + main-frame validation (same pattern as askAI / startVoice)
                guard let pageURL = message.webView?.url,
                      Self.isAllowedOrigin(pageURL),
                      message.frameInfo.isMainFrame else {
                    return
                }
                let rawSection = String((body["section"] as? String ?? "accessibility")
                    .prefix(BridgeSecurityPolicy.maxSettingsSectionLength))
                Task { @MainActor in
                    guard let url = BridgeSecurityPolicy.settingsURL(for: rawSection) else { return }
                    UIApplication.shared.open(url, options: [:], completionHandler: nil)
                }
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

        // MARK: - App Store review prompt

        private static let speakCountKey = "prism_speak_count"
        private static let lastReviewPromptKey = "prism_last_review_prompt"

        private func maybeRequestAppStoreReview() {
            let count = UserDefaults.standard.integer(forKey: Self.speakCountKey) + 1
            UserDefaults.standard.set(count, forKey: Self.speakCountKey)
            guard count >= 5, count % 50 == 0 || count == 5 else { return }
            let lastPrompt = UserDefaults.standard.double(forKey: Self.lastReviewPromptKey)
            let now = Date().timeIntervalSince1970
            guard now - lastPrompt > 60 * 86400 else { return }
            UserDefaults.standard.set(now, forKey: Self.lastReviewPromptKey)
            requestReview?()
        }

        // MARK: - SFSpeechRecognizer bridge

        // Language validation delegated to BridgeSecurityPolicy (unit-tested there)
        private var recognitionGeneration: UInt64 = 0
        private var recognitionTimeout: DispatchWorkItem?
        private var lastStartVoiceTime: TimeInterval = 0

        private func startSpeechRecognition(lang: String, webView: WKWebView?) {
            let now = Date().timeIntervalSince1970
            guard now - lastStartVoiceTime >= BridgeSecurityPolicy.startVoiceRateLimitSeconds else {
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
            activeWebView = webView
            sendSpeechError("ondevice-unavailable")
            return
            #else
            stopSpeechRecognition()
            activeWebView = webView
            #endif
            
            if let apiKey = ProcessInfo.processInfo.environment["INWORLD_API_KEY"] ?? UserDefaults.standard.string(forKey: "inworld_api_key") {
                inworldClient.onInterim = { [weak self] text in
                    self?.sendSpeechResult(interim: text, final: "")
                }
                inworldClient.onFinal = { [weak self] text in
                    self?.sendSpeechResult(interim: "", final: text)
                    self?.stopSpeechRecognition()
                }
                inworldClient.connect(apiKey: apiKey, locale: lang)
            }
            
            recognitionGeneration &+= 1
            let gen = recognitionGeneration

            let safeLang = String(lang.prefix(BridgeSecurityPolicy.maxLangTagLength))
            guard BridgeSecurityPolicy.isValidLang(safeLang) else {
                sendSpeechError("invalid-language")
                return
            }

            let locale = Locale(identifier: safeLang)
            speechRecognizer = SFSpeechRecognizer(locale: locale) ?? SFSpeechRecognizer()

            guard let speechRecognizer, speechRecognizer.isAvailable else {
                sendSpeechError("unavailable")
                return
            }

            SFSpeechRecognizer.requestAuthorization { [weak self] status in
                DispatchQueue.main.async {
                    guard let self, self.recognitionGeneration == gen else {
                        return
                    }
                    switch status {
                    case .authorized:
                        self.beginRecognitionSession(generation: gen)
                    case .denied:
                        self.sendSpeechError("denied")
                    case .restricted:
                        self.sendSpeechError("restricted")
                    case .notDetermined:
                        self.sendSpeechError("not-determined")
                    @unknown default:
                        self.sendSpeechError("unavailable")
                    }
                }
            }
        }

        private func beginRecognitionSession(generation: UInt64) {
            guard recognitionGeneration == generation else {
                return
            }
            let audioSession = AVAudioSession.sharedInstance()
            do {
                try audioSession.setCategory(.playAndRecord, options: [.defaultToSpeaker, .allowBluetoothHFP])
                try audioSession.setMode(.voiceChat)
                try audioSession.setActive(true, options: .notifyOthersOnDeactivation)
            } catch {
                sendSpeechError("audio-session-failed")
                return
            }

            recognitionRequest = SFSpeechAudioBufferRecognitionRequest()
            guard let recognitionRequest else {
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
            var bufferCount = 0
            inputNode.installTap(onBus: 0, bufferSize: 1024, format: recordingFormat) { [weak self] buffer, _ in
                bufferCount += 1
                self?.recognitionRequest?.append(buffer)
                self?.inworldClient.sendAudioChunk(buffer)
            }

            recognitionTask = speechRecognizer?.recognitionTask(with: recognitionRequest) { [weak self] result, error in
                DispatchQueue.main.async {
                    guard let self, self.recognitionGeneration == generation else { return }
                    if let result {
                        if !self.inworldClient.isConnected {
                            let text = String(result.bestTranscription.formattedString.prefix(2000))
                            self.sendSpeechResult(interim: result.isFinal ? "" : text,
                                                  final: result.isFinal ? text : "")
                            if result.isFinal { self.stopSpeechRecognition() }
                        }
                    } else if let error {
                        let nsErr = error as NSError
                        if nsErr.code != 216 {
                            if !self.inworldClient.isConnected {
                                if nsErr.domain == "kLSRErrorDomain" {
                                    self.sendSpeechError("ondevice-unavailable")
                                } else {
                                    self.sendSpeechError("recognition-failed")
                                }
                            }
                        }
                    }
                }
            }

            guard recognitionTask != nil else {
                audioEngine.inputNode.removeTap(onBus: 0)
                sendSpeechError("recognition-failed")
                return
            }

            audioEngine.prepare()
            do {
                try audioEngine.start()
            } catch {
                audioEngine.inputNode.removeTap(onBus: 0)
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
            inworldClient.disconnect()
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
            // Restore audio session for TTS.
            try? AVAudioSession.sharedInstance().setCategory(.playback, options: [.mixWithOthers])
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

    /// Convert a Web Speech API rate to an AVSpeechSynthesizer rate.
    ///
    /// Web Speech API: default 1.0 = normal, range [0.1, 10.0]
    /// AVSpeechSynthesizer: default 0.5 = normal, range [0.0, 1.0]
    ///
    /// REGRESSION: passing the Web Speech rate directly to AVSpeechSynthesizer
    /// caused chipmunk audio — rate=1.0 (Web Speech normal) maps to 1.0 in
    /// AVSpeech which is *maximum* speed. Fix: divide by 2.0 so 1.0→0.5 (normal).
    /// Apply this helper in every iOS app that bridges window.speechSynthesis
    /// to AVSpeechSynthesizer. Copy the helper + its unit tests.
    static func avRate(fromWebSpeechRate rate: Float) -> Float {
        max(AVSpeechUtteranceMinimumSpeechRate,
            min(AVSpeechUtteranceMaximumSpeechRate, rate / 2.0))
    }

    func speak(_ text: String, language: String = "en-US", webSpeechRate: Float = 1.0) {
        synth.stopSpeaking(at: .immediate)
        // Bug 7.4: AVSpeechUtterance(string: "") raises NSInvalidArgumentException
        // on some iOS versions. Guard before creating the utterance.
        let clamped = String(text.prefix(BridgeSecurityPolicy.maxSpeakTextLength))
        guard !clamped.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty else { return }
        let utt = AVSpeechUtterance(string: clamped)
        utt.voice = AVSpeechSynthesisVoice(language: language)
        utt.rate = WKWebTTS.avRate(fromWebSpeechRate: webSpeechRate)
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
                    let sizeHint = LLMEngine.preferredTier == .medium4B ? "~2.3 GB" : "~1.2 GB"
                    Text("Downloading AI model (\(sizeHint))").font(.headline)
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

    // 4B Q3_K_M — 99.1% BFCL, 114/115 × 3 seeds, June 2026 — iPhone first gate
    private static let modelCandidateURLsSmall: [URL] = [
        URL(string: "https://huggingface.co/dcostenco/prism-coder-4b/resolve/main/Qwen3.5-4B-Q3_K_M.gguf")!,
    ]

    // 4B Q4_K_M — 100% BFCL, 115/115 × 3 seeds, June 2026 — for 8 GB+ devices
    private static let modelCandidateURLs4B: [URL] = [
        URL(string: "https://huggingface.co/dcostenco/prism-coder-4b/resolve/main/Qwen3.5-4B-Q4_K_M.gguf")!,
    ]

    private static let localModelFilenameSmall = "Qwen3.5-4B-Q3_K_M.gguf"
    private static let localModelFilename4B    = "Qwen3.5-4B-Q4_K_M.gguf"
    // Legacy filenames from previous app versions — migrated on first run.
    private static let legacyFilenames = [
        "prism-coder-4b-swe17-q4km.gguf",
        "prism-coder-4b-v43-Q4_K_M.gguf",
        "prism-coder-1b7-swe43-q4km.gguf",
        "prism-coder-1b7-v42-q4km.gguf",
        "prism-aac-1b7-q4km.gguf",
    ]

    private func start() async {
        phase = .checking
        let tier = LLMEngine.preferredTier
        let minFree = tier == .medium4B ? 2_800 : 1_200
        guard AppState.measureFreeMemoryMB() >= minFree else { phase = .lowMemory; return }

        let modelsDir = FileManager.default
            .urls(for: .documentDirectory, in: .userDomainMask)[0]
            .appendingPathComponent("models")

        let (localFilename, candidateURLs): (String, [URL]) = tier == .medium4B
            ? (Self.localModelFilename4B, Self.modelCandidateURLs4B)
            : (Self.localModelFilenameSmall, Self.modelCandidateURLsSmall)

        let destination = modelsDir.appendingPathComponent(localFilename)

        // Migrate stale cached files from previous app versions.
        if !FileManager.default.fileExists(atPath: destination.path) {
            for legacy in Self.legacyFilenames {
                let src = modelsDir.appendingPathComponent(legacy)
                if FileManager.default.fileExists(atPath: src.path) {
                    try? FileManager.default.moveItem(at: src, to: destination)
                    break
                }
            }
        }

        if FileManager.default.fileExists(atPath: destination.path) {
            // If 4B preferred but only 1.7B cached, load 1.7B — still valid.
            await app.loadModel(from: destination); return
        }

        // For 4B tier: also try loading cached Q3_K_M to avoid re-download on existing installs.
        if tier == .medium4B {
            let fallbackSmall = modelsDir.appendingPathComponent(Self.localModelFilenameSmall)
            if FileManager.default.fileExists(atPath: fallbackSmall.path) {
                await app.loadModel(from: fallbackSmall); return
            }
        }

        phase = .downloading
        do {
            try FileManager.default.createDirectory(at: modelsDir, withIntermediateDirectories: true)
            for cdnURL in candidateURLs {
                let (tempURL, response) = try await URLSession.shared.download(from: cdnURL)
                if let http = response as? HTTPURLResponse, !(200...299).contains(http.statusCode) {
                    try? FileManager.default.removeItem(at: tempURL)
                    continue
                }
                try FileManager.default.moveItem(at: tempURL, to: destination)
                do {
                    try await app.loadModelSafe(from: destination)
                } catch LLMError.insufficientMemory {
                    // 4B Q4_K_M OOM — fall back to Q3_K_M download
                    if tier == .medium4B {
                        try? FileManager.default.removeItem(at: destination)
                        await downloadAndLoad(
                            urls: Self.modelCandidateURLsSmall,
                            destination: modelsDir.appendingPathComponent(Self.localModelFilenameSmall),
                            modelsDir: modelsDir)
                    } else {
                        phase = .lowMemory
                    }
                }
                return
            }
            phase = .failed
        } catch { phase = .failed }
    }

    private func downloadAndLoad(urls: [URL], destination: URL, modelsDir: URL) async {
        do {
            for cdnURL in urls {
                let (tempURL, response) = try await URLSession.shared.download(from: cdnURL)
                if let http = response as? HTTPURLResponse, !(200...299).contains(http.statusCode) {
                    try? FileManager.default.removeItem(at: tempURL)
                    continue
                }
                try FileManager.default.moveItem(at: tempURL, to: destination)
                await app.loadModel(from: destination)
                return
            }
            phase = .failed
        } catch { phase = .failed }
    }
}
