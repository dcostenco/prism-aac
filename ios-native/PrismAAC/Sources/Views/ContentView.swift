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
///     TTS (better than WebSpeech on iOS), on-device 1.5B inference, Watch
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

    var body: some View {
        ZStack(alignment: .top) {
            PrismWebView(pipeline: app.pipeline)
                .ignoresSafeArea()

            // Memory pressure banner — overlay when degraded
            if let banner = app.memoryBanner {
                VStack {
                    MemoryBannerView(message: banner, tier: app.tier)
                    Spacer()
                }
            }
        }
    }
}

// MARK: - Web view

struct PrismWebView: UIViewRepresentable {
    let pipeline: AACPipeline

    func makeCoordinator() -> Coordinator { Coordinator(pipeline: pipeline) }

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
            }
        };
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
        // C14: rate-limit emergency triggers
        private var lastEmergencyTriggerTime: TimeInterval = 0
        // SFSpeechRecognizer bridge for web app voice input
        private var speechRecognizer: SFSpeechRecognizer?
        private var recognitionRequest: SFSpeechAudioBufferRecognitionRequest?
        private var recognitionTask: SFSpeechRecognitionTask?
        private lazy var audioEngine = AVAudioEngine()
        private weak var activeWebView: WKWebView?

        init(pipeline: AACPipeline) { self.pipeline = pipeline }

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
            case "startVoice":
                guard let pageURL = message.webView?.url,
                      Self.isAllowedOrigin(pageURL),
                      message.frameInfo.isMainFrame else { return }
                let lang = body["lang"] as? String ?? "en-US"
                startSpeechRecognition(lang: lang, webView: message.webView)
            case "stopVoice":
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
            guard now - lastStartVoiceTime >= 0.5 else { return }
            lastStartVoiceTime = now

            stopSpeechRecognition()
            activeWebView = webView
            recognitionGeneration &+= 1
            let gen = recognitionGeneration

            let safeLang = String(lang.prefix(11))
            let range = NSRange(safeLang.startIndex..., in: safeLang)
            guard Self.langPattern.firstMatch(in: safeLang, range: range) != nil else {
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
                    guard let self, self.recognitionGeneration == gen else { return }
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
            guard recognitionGeneration == generation else { return }

            let audioSession = AVAudioSession.sharedInstance()
            do {
                try audioSession.setCategory(.playAndRecord, options: [.defaultToSpeaker, .allowBluetooth])
                try audioSession.setMode(.measurement)
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

            let inputNode = audioEngine.inputNode
            let recordingFormat = inputNode.outputFormat(forBus: 0)
            inputNode.installTap(onBus: 0, bufferSize: 1024, format: recordingFormat) { [weak self] buffer, _ in
                self?.recognitionRequest?.append(buffer)
            }

            recognitionTask = speechRecognizer?.recognitionTask(with: recognitionRequest) { [weak self] result, error in
                DispatchQueue.main.async {
                    guard let self, self.recognitionGeneration == generation else { return }
                    if let result {
                        let text = String(result.bestTranscription.formattedString.prefix(2000))
                        self.sendSpeechResult(interim: result.isFinal ? "" : text,
                                              final: result.isFinal ? text : "")
                        if result.isFinal { self.stopSpeechRecognition() }
                    } else if let error {
                        if (error as NSError).code != 216 {
                            self.sendSpeechError("recognition-failed")
                            NSLog("[PrismAAC] Recognition error: \(error.localizedDescription)")
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
            guard let data = try? JSONSerialization.data(withJSONObject: code),
                  let json = String(data: data, encoding: .utf8) else { return }
            activeWebView?.evaluateJavaScript(
                "window.prismNativeSpeechError && window.prismNativeSpeechError(\(json))"
            ) { _, _ in }
        }

        // Show offline fallback if load fails
        func webView(_ webView: WKWebView, didFailProvisionalNavigation _: WKNavigation!, withError error: Error) {
            // M22: Add CSP to offline fallback HTML; M23: use about:blank baseURL
            let offlineHTML = """
            <!DOCTYPE html>
            <html>
            <head>
            <meta http-equiv="Content-Security-Policy" content="default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'">
            </head>
            <body style='background:#14161d;color:white;font-family:sans-serif;
            display:flex;align-items:center;justify-content:center;height:100vh;margin:0;
            flex-direction:column;gap:16px;text-align:center;padding:20px'>
            <div style='font-size:48px'>📵</div>
            <h2 style='margin:0'>No connection</h2>
            <p style='margin:0;opacity:0.7'>Core phrases and emergency still work from the Watch app.</p>
            <button onclick='location.reload()' style='padding:12px 24px;border-radius:8px;
            background:#4CAF50;color:white;border:none;font-size:16px;cursor:pointer'>
            Try again</button>
            </body></html>
            """
            webView.loadHTMLString(offlineHTML, baseURL: URL(string: "about:blank"))
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
                    Text("Downloading AI model (864 MB)").font(.headline)
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
            .appendingPathComponent("models/prism-ios-1.5b-q4.gguf")
        if FileManager.default.fileExists(atPath: url.path) { await app.loadModel(from: url); return }
        phase = .downloading
        do {
            // FIX L4: Use download task instead of byte-by-byte streaming (avoids quadratic realloc)
            let cdnURL = URL(string: "https://synalux.ai/models/prism-ios-1.5b-q4.gguf")!
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
