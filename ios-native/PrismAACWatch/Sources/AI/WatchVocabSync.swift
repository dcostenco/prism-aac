import Foundation
import Security
import WatchConnectivity

// NOTE: NSLog is used for operational logging. Auth tokens are never logged.
// Operational data (message counts, status codes) is considered acceptable in production logs.
// For future: migrate to os_log with appropriate log levels.

/// Syncs vocabulary from the web app to the Watch.
///
/// Two paths:
///   1. WatchConnectivity → iPhone sends user's current vocabulary
///   2. Direct API call → synalux.ai/api/v1/prism-aac/vocabulary (standalone, WiFi/LTE)
///
/// Falls back to a minimal offline core if both unavailable.
@MainActor
final class WatchVocabSync: NSObject, ObservableObject {

    @Published private(set) var categories: [WatchCategory] = WatchCategory.offlineCore
    /// Input (typing/selection) language — what the AAC user communicates in.
    @Published var inputLanguage: String = "en-US"
    /// Output (TTS/translation) language — what is spoken aloud.
    @Published var outputLanguage: String = "en-US"
    /// Language the loaded vocabulary labels are written in.
    /// Offline core = "en-US"; API-loaded = whatever lang was fetched.
    /// This is the correct `from` parameter for translation — NOT inputLanguage.
    @Published private(set) var vocabLanguage: String = "en-US"
    /// Deprecated: use inputLanguage or outputLanguage directly.
    /// Retained for any external callers during transition — do not use in new code.
    // var language: String { outputLanguage }
    @Published private(set) var source: Source = .offline
    private static let inputLanguagePreferenceKey = "watchInputLanguage"
    private static let outputLanguagePreferenceKey = "watchOutputLanguage"

    /// Update the language pair and reload vocabulary.
    /// Vocabulary labels are loaded in `input` language so the AAC user
    /// can read them in their native language. TTS speaks in `output`.
    func setLanguages(input: String, output: String) {
        // #13: validate before writing — rejects arbitrary locale strings from the wire
        let safeInput  = Self.allowedLangs.contains(input)  ? input  : "en-US"
        let safeOutput = Self.allowedLangs.contains(output) ? output : "en-US"
        // Language codes are preferences; commit them before publishing the change.
        UserDefaults.standard.set(safeInput, forKey: Self.inputLanguagePreferenceKey)
        UserDefaults.standard.set(safeOutput, forKey: Self.outputLanguagePreferenceKey)
        inputLanguage  = safeInput
        outputLanguage = safeOutput
        // FIX #28: Keychain writes are synchronous SecItem calls; move off @MainActor to avoid
        // blocking the UI thread for the duration of the write.
        Task.detached(priority: .utility) {
            KeychainHelper.shared.write(value: safeInput,  service: "prism-aac", account: "watchInputLanguage")
            KeychainHelper.shared.write(value: safeOutput, service: "prism-aac", account: "watchOutputLanguage")
        }
        vocabTask?.cancel()
        // #25+#34: @MainActor ensures isSpeaking/published state mutations are on main actor; [weak self] prevents retain cycle
        vocabTask = Task { @MainActor [weak self] in
            // Debounce: wait 250ms to coalesce rapid language changes
            try? await Task.sleep(nanoseconds: 250_000_000)
            guard !Task.isCancelled else { return }
            await self?.loadFromAPI(lang: safeInput)
        }   // vocab labels in INPUT lang
    }

    /// Shorthand: set only output language (input unchanged).
    func setLanguage(_ lang: String) {
        setLanguages(input: inputLanguage, output: lang)
    }

    enum Source { case offline, companion, cloud }

    private var vocabTask: Task<Void, Never>?
    // #20: track when companion delivered fresh vocab so API fetch doesn't clobber it
    private var lastCompanionUpdate: Date = .distantPast

    deinit {
        // Task.cancel() is thread-safe — sets an atomic flag, no actor state mutation.
        vocabTask?.cancel()
    }

    private let apiBase = "https://synalux.ai/api/v1/prism-aac"

    private static let vocabSession: URLSession = {
        let cfg = URLSessionConfiguration.ephemeral
        cfg.timeoutIntervalForRequest = 10
        cfg.timeoutIntervalForResource = 20
        return URLSession(configuration: cfg)
    }()

    override init() {
        super.init()
        // Read current preferences first, with the earlier Keychain values as migration fallback.
        if let inp = UserDefaults.standard.string(forKey: Self.inputLanguagePreferenceKey)
            ?? KeychainHelper.shared.read(service: "prism-aac", account: "watchInputLanguage"),
           Self.allowedLangs.contains(inp) { inputLanguage = inp }
        if let out = UserDefaults.standard.string(forKey: Self.outputLanguagePreferenceKey)
            ?? KeychainHelper.shared.read(service: "prism-aac", account: "watchOutputLanguage"),
           Self.allowedLangs.contains(out) { outputLanguage = out }
        // FIX 3: Register with router instead of setting WCSession.default.delegate = self
        WCSessionRouter.shared.registerMessageHandler(for: "vocab_update") { [weak self] _, msg in
            Task { @MainActor [weak self] in self?.handleVocabReply(msg) }
        }
        // Also handle vocabulary pushed from iPhone on activation (companion path)
        WCSessionRouter.shared.registerMessageHandler(for: "vocabulary") { [weak self] _, msg in
            Task { @MainActor [weak self] in self?.handleVocabReply(msg) }
        }
        // #25+#34: @MainActor + [weak self] — ensures @Published writes stay on main actor; no retain cycle
        // FIX #18: capture inputLanguage at call site to avoid self?.inputLanguage in async closure
        let lang = inputLanguage
        vocabTask = Task { @MainActor [weak self] in
            try? await Task.sleep(nanoseconds: 250_000_000)
            guard !Task.isCancelled else { return }
            await self?.loadFromAPI(lang: lang)
        }
    }

    // MARK: - Label sanitization

    // #27: changed from fileprivate → internal so tests and companion types can access it
    nonisolated internal static func sanitizeLabel(_ raw: String) -> String {
        // FIX #31: preliminary cap before processing — prevents quadratic cost on pathological inputs.
        let capped = String(raw.prefix(200))
        // #4: expanded to full token list — ChatML, Llama, Gemma, Mistral, legacy special tokens,
        // HTML entities, and JSON-escaped angle brackets; prevents prompt injection via vocab labels
        let tokenStripped = capped
            .replacingOccurrences(of: "<|im_start|>", with: "")
            .replacingOccurrences(of: "<|im_end|>", with: "")
            .replacingOccurrences(of: "<|system|>", with: "")
            .replacingOccurrences(of: "[INST]", with: "")
            .replacingOccurrences(of: "[/INST]", with: "")
            .replacingOccurrences(of: "<<SYS>>", with: "")
            .replacingOccurrences(of: "<</SYS>>", with: "")
            .replacingOccurrences(of: "<|eot_id|>", with: "")
            .replacingOccurrences(of: "<|start_header_id|>", with: "")
            .replacingOccurrences(of: "<|end_header_id|>", with: "")
            .replacingOccurrences(of: "<|user|>", with: "")
            .replacingOccurrences(of: "<|assistant|>", with: "")
            .replacingOccurrences(of: "<|endoftext|>", with: "")
            .replacingOccurrences(of: "<s>", with: "")
            .replacingOccurrences(of: "</s>", with: "")
            .replacingOccurrences(of: "<|end_of_turn|>", with: "")
            .replacingOccurrences(of: "<|start_of_turn|>", with: "")
            .replacingOccurrences(of: "&#x", with: "")
            .replacingOccurrences(of: "&#X", with: "")
            .replacingOccurrences(of: "&#", with: "")
            .replacingOccurrences(of: "&lt;", with: "")
            .replacingOccurrences(of: "&gt;", with: "")
            .replacingOccurrences(of: "\\u003c", with: "")
            .replacingOccurrences(of: "\\u003e", with: "")
        // FIX #16: strip bidi override characters from vocab labels before length cap.
        // These can render as invisible/reversed text in SwiftUI labels.
        let bidi = ["\u{202A}","\u{202B}","\u{202C}","\u{202D}","\u{202E}",
                    "\u{200B}","\u{200C}","\u{200D}","\u{200E}","\u{200F}",
                    "\u{2066}","\u{2067}","\u{2068}","\u{2069}","\u{FEFF}"]
        let bidiStripped = bidi.reduce(tokenStripped) { $0.replacingOccurrences(of: $1, with: "") }
        let nfkc = bidiStripped
            .applyingTransform(.init("NFKC; [:Mn:] Remove; NFKC"), reverse: false) ?? bidiStripped
        return String(nfkc.components(separatedBy: CharacterSet(charactersIn: "<>[]|")).joined().prefix(120))
    }

    // MARK: - Load from web app API (standalone path)

    // #13+#18: Set for O(1) lookup; used in setLanguages + init to validate UserDefaults reads
    private static let allowedLangs: Set<String> = [
        "en", "en-US", "es", "es-ES", "ro", "ru", "fr", "de", "it", "pt",
        "ar", "zh-Hans", "zh-Hant", "ja", "ko", "he", "hi", "nl", "pl",
        "uk", "tr", "vi", "tl", "id",
        "fr-FR", "de-DE", "ro-RO", "ru-RU", "uk-UA", "pt-BR",
        "ja-JP", "zh-CN", "ar-SA",
    ]

    private func loadFromAPI(lang: String? = nil) async {
        // Concurrency note: all callers route through setLanguages() which cancels and
        // reassigns vocabTask before each call. Because this method is @MainActor,
        // overlapping direct invocations serialize automatically. vocabTask management
        // ensures that language-change calls cancel any in-progress task.
        // #46: default to inputLanguage (not outputLanguage alias) — vocab labels are in input lang
        let targetLang = lang ?? inputLanguage

        // #20: skip API fetch if companion delivered fresher data in the last 5 seconds
        guard Date().timeIntervalSince(lastCompanionUpdate) > 5 else {
            NSLog("[VocabSync] Skipping API fetch — companion data is fresher (<5s ago)")
            return
        }

        // Validate language code against allowlist before using in URL
        guard WatchVocabSync.allowedLangs.contains(targetLang) else {
            NSLog("[VocabSync] Unsupported language: \(targetLang)")
            return
        }

        guard var components = URLComponents(string: "\(apiBase)/vocabulary") else { return }
        components.queryItems = [URLQueryItem(name: "lang", value: targetLang)]
        guard let url = components.url else { return }

        // FIX #13: guard instead of if-let — unauthenticated fetch must not proceed silently.
        var req = URLRequest(url: url, cachePolicy: .reloadIgnoringLocalCacheData)
        // FIX #14: timeout is configured on vocabSession (timeoutIntervalForRequest: 10,
        // timeoutIntervalForResource: 20); redundant timeoutInterval on URLRequest removed.
        guard let token = KeychainHelper.shared.read(service: "prism-aac", account: "auth-token") else {
            NSLog("[VocabSync] No auth token — skipping API fetch, using offline core vocabulary")
            return
        }
        req.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")

        do {
            let (data, response) = try await WatchVocabSync.vocabSession.data(for: req)
            if let http = response as? HTTPURLResponse, !(200...299).contains(http.statusCode) {
                NSLog("[VocabSync] HTTP error \(http.statusCode)")
                return
            }
            guard data.count <= 512_000 else {
                NSLog("[VocabSync] Response too large (\(data.count) bytes)")
                return
            }
            let vocab = try JSONDecoder().decode(VocabResponse.self, from: data)
            // Cap categories and phrase counts; sanitize string field lengths
            let safeCats: [WatchCategory] = vocab.categories.prefix(50).map { cat in
                let safePhrases = cat.phrases.prefix(100).map { ph in
                    // #35: cap phrase id length to prevent oversized strings from wire data
                    VocabPhrase(id: String(ph.id.prefix(50)),
                                label: Self.sanitizeLabel(ph.label),
                                sfSymbol: ph.sfSymbol)
                }
                return WatchCategory(from: VocabCategory(id: String(cat.id.prefix(50)),
                                                         icon: String(cat.icon.prefix(1)),
                                                         name: String(cat.name.prefix(120)),
                                                         phrases: Array(safePhrases)))
            }
            categories = safeCats
            let rawLang = String(vocab.language.prefix(20))
            vocabLanguage = Self.allowedLangs.contains(rawLang) ? rawLang : "en-US"   // labels are in this language
            source = .cloud
        } catch {
            NSLog("[VocabSync] API load failed: \(error)")
            // Keep offline core — never leave user without communication
        }
    }

    // MARK: - Handle vocabulary from iPhone (companion path)

    private func handleVocabReply(_ reply: [String: Any]) {
        // #20: record arrival time — used by loadFromAPI to avoid overwriting fresher companion data
        lastCompanionUpdate = Date()
        // #8: size check BEFORE decode — prevents JSON bomb allocation
        // #33: log type mismatch instead of silently returning — helps diagnose companion path issues
        guard let data: Data = {
            if let d = reply["vocab"] as? Data { return d }
            // Fallback: companion may send dict instead of Data
            // FIX #22: use do/catch instead of try? so re-encoding failures are logged.
            // NOTE: JSONSerialization→JSONDecoder round-trip: type coercions (NSNumber→Bool)
            // are possible. Primary path (Data) is preferred; dict fallback is for legacy companions.
            if let dict = reply["vocab"] as? [String: Any] {
                do {
                    let encoded = try JSONSerialization.data(withJSONObject: dict)
                    NSLog("[VocabSync] Companion sent vocab as dict — re-encoded as Data")
                    return encoded
                } catch {
                    NSLog("[VocabSync] Companion vocab dict re-encoding failed: \(error)")
                }
            }
            NSLog("[VocabSync] Companion vocab: expected Data, got \(type(of: reply["vocab"])) — ignoring")
            return nil
        }() else { return }
        guard data.count <= 512_000 else {
            NSLog("[VocabSync] Companion vocab too large (\(data.count) bytes)")
            return
        }
        let vocab: VocabResponse
        do {
            vocab = try JSONDecoder().decode(VocabResponse.self, from: data)
        } catch {
            NSLog("[VocabSync] Companion vocab decode failed: \(error)")
            return
        }
        // Apply same caps as API path:
        let safeCats = vocab.categories.prefix(50).map { cat -> WatchCategory in
            // #10: propagate emergency flag from category id (companion path)
            let catId = String(cat.id.prefix(50))
            let isEmergencyCat = catId == "emergency" || catId == "help-needs"
            return WatchCategory(
                id: catId,
                icon: String(cat.icon.prefix(1)),
                name: String(cat.name.prefix(120)),
                phrases: cat.phrases.prefix(100).map { ph in
                    // #35: cap phrase id length (companion path)
                    WatchPhrase(id: String(ph.id.prefix(50)), label: Self.sanitizeLabel(ph.label),
                                sfSymbol: ph.sfSymbol ?? "circle.fill",
                                isEmergency: isEmergencyCat)
                }
            )
        }
        categories = Array(safeCats)
        let rawLang = String(vocab.language.prefix(20))
        vocabLanguage = Self.allowedLangs.contains(rawLang) ? rawLang : "en-US"   // labels written in this language (not output lang)
        source = .companion
    }
}

// MARK: - Models

struct WatchCategory: Identifiable {
    let id: String
    let icon: String
    let name: String
    let phrases: [WatchPhrase]
}

struct WatchPhrase: Identifiable {
    let id: String
    let label: String
    let sfSymbol: String
    // #10: set true for phrases decoded from emergency-category API responses
    var isEmergency: Bool = false
}

struct VocabResponse: Decodable {
    let language: String
    let categories: [VocabCategory]
}

struct VocabCategory: Decodable {
    let id: String
    let icon: String
    let name: String
    let phrases: [VocabPhrase]
}

struct VocabPhrase: Decodable {
    let id: String
    let label: String
    let sfSymbol: String?
}

extension WatchCategory {
    init(from c: VocabCategory) {
        id     = String(c.id.prefix(50))
        icon   = String(c.icon.prefix(1))     // #12: cap icon to 1 grapheme cluster (single emoji)
        name   = String(c.name.prefix(120))   // cap name length
        // #10: mark phrases as emergency when they come from an emergency category
        let isEmergencyCat = id == "emergency" || id == "help-needs"
        phrases = c.phrases.prefix(100).map {
            WatchPhrase(
                id:          String($0.id.prefix(50)),
                label:       WatchVocabSync.sanitizeLabel($0.label),
                sfSymbol:    String($0.sfSymbol?.prefix(50) ?? "circle.fill"),
                isEmergency: isEmergencyCat
            )
        }
    }

    // Minimal offline core — always available even with no connectivity.
    // Contains only the most critical AAC phrases. Full vocabulary comes from API.
    static let offlineCore: [WatchCategory] = [
        WatchCategory(id: "quick", icon: "⚡", name: "Quick", phrases: [
            WatchPhrase(id: "yes",   label: "Yes", sfSymbol: "checkmark.circle.fill"),
            WatchPhrase(id: "no",    label: "No", sfSymbol: "xmark.circle.fill"),
            WatchPhrase(id: "more",  label: "More", sfSymbol: "plus.circle"),
            WatchPhrase(id: "done",  label: "All done", sfSymbol: "checkmark.seal"),
            WatchPhrase(id: "help",  label: "Help", sfSymbol: "sos"),
            WatchPhrase(id: "stop",  label: "Stop", sfSymbol: "hand.raised.fill"),
            WatchPhrase(id: "water", label: "Water", sfSymbol: "drop.fill"),
            WatchPhrase(id: "hurt",  label: "Hurt",  sfSymbol: "cross.fill", isEmergency: true),
        ]),
    ]

// generated: 1274 phrases × 22 categories
    /// iOS-parity default set — generated from constants/phrases.ts
    /// by scripts/gen-watch-default-set.py. Sync rule: when phrases.ts
    /// changes, re-run gen-watch-default-set.py.
    static let iOSDefaultSet: [WatchCategory] = [
        WatchCategory(id: "core-pronouns", icon: "person.2.fill", name: "I / You / We", phrases: [
            WatchPhrase(id: "cw-i", label: "I", sfSymbol: "", isEmergency: false),
            WatchPhrase(id: "cw-you", label: "You", sfSymbol: "", isEmergency: false),
            WatchPhrase(id: "cw-he", label: "He", sfSymbol: "", isEmergency: false),
            WatchPhrase(id: "cw-she", label: "She", sfSymbol: "", isEmergency: false),
            WatchPhrase(id: "cw-it", label: "It", sfSymbol: "", isEmergency: false),
            WatchPhrase(id: "cw-we", label: "We", sfSymbol: "", isEmergency: false),
            WatchPhrase(id: "cw-they", label: "They", sfSymbol: "", isEmergency: false),
            WatchPhrase(id: "cw-me", label: "Me", sfSymbol: "", isEmergency: false),
            WatchPhrase(id: "cw-my", label: "My", sfSymbol: "", isEmergency: false),
            WatchPhrase(id: "cw-your", label: "Your", sfSymbol: "", isEmergency: false),
            WatchPhrase(id: "cw-his", label: "His", sfSymbol: "", isEmergency: false),
            WatchPhrase(id: "cw-her", label: "Her", sfSymbol: "", isEmergency: false),
            WatchPhrase(id: "cw-this", label: "This", sfSymbol: "", isEmergency: false),
            WatchPhrase(id: "cw-that", label: "That", sfSymbol: "", isEmergency: false),
            WatchPhrase(id: "cw-us", label: "Us", sfSymbol: "", isEmergency: false),
            WatchPhrase(id: "cw-them", label: "Them", sfSymbol: "", isEmergency: false),
            WatchPhrase(id: "cw-mine", label: "Mine", sfSymbol: "", isEmergency: false),
            WatchPhrase(id: "cw-yours", label: "Yours", sfSymbol: "", isEmergency: false),
            WatchPhrase(id: "cw-theirs", label: "Theirs", sfSymbol: "", isEmergency: false),
            WatchPhrase(id: "cw-ours", label: "Ours", sfSymbol: "", isEmergency: false),
            WatchPhrase(id: "cw-hers", label: "Hers", sfSymbol: "", isEmergency: false),
            WatchPhrase(id: "cw-myself", label: "Myself", sfSymbol: "", isEmergency: false),
            WatchPhrase(id: "cw-yourself", label: "Yourself", sfSymbol: "", isEmergency: false),
            WatchPhrase(id: "cw-themselves", label: "Themselves", sfSymbol: "", isEmergency: false),
            WatchPhrase(id: "cw-ourselves", label: "Ourselves", sfSymbol: "", isEmergency: false),
            WatchPhrase(id: "cw-each-other", label: "Each other", sfSymbol: "", isEmergency: false),
            WatchPhrase(id: "cw-anyone", label: "Anyone", sfSymbol: "", isEmergency: false),
            WatchPhrase(id: "cw-someone", label: "Someone", sfSymbol: "", isEmergency: false),
            WatchPhrase(id: "cw-everyone", label: "Everyone", sfSymbol: "", isEmergency: false),
            WatchPhrase(id: "cw-no-one", label: "No one", sfSymbol: "", isEmergency: false),
            WatchPhrase(id: "cw-nobody", label: "Nobody", sfSymbol: "", isEmergency: false),
            WatchPhrase(id: "cw-whose", label: "Whose", sfSymbol: "", isEmergency: false),
        ]),
        WatchCategory(id: "core-verbs", icon: "bolt.fill", name: "Core Verbs", phrases: [
            WatchPhrase(id: "cw-want", label: "Want", sfSymbol: "", isEmergency: false),
            WatchPhrase(id: "cw-want-to", label: "Want to", sfSymbol: "", isEmergency: false),
            WatchPhrase(id: "cw-like", label: "Like", sfSymbol: "", isEmergency: false),
            WatchPhrase(id: "cw-have", label: "Have", sfSymbol: "", isEmergency: false),
            WatchPhrase(id: "cw-do", label: "Do", sfSymbol: "", isEmergency: false),
            WatchPhrase(id: "cw-can", label: "Can", sfSymbol: "", isEmergency: false),
            WatchPhrase(id: "cw-need", label: "Need", sfSymbol: "", isEmergency: false),
            WatchPhrase(id: "cw-know", label: "Know", sfSymbol: "", isEmergency: false),
            WatchPhrase(id: "cw-see", label: "See", sfSymbol: "", isEmergency: false),
            WatchPhrase(id: "cw-think", label: "Think", sfSymbol: "", isEmergency: false),
            WatchPhrase(id: "cw-feel", label: "Feel", sfSymbol: "", isEmergency: false),
            WatchPhrase(id: "cw-say", label: "Say", sfSymbol: "", isEmergency: false),
            WatchPhrase(id: "cw-tell", label: "Tell", sfSymbol: "", isEmergency: false),
            WatchPhrase(id: "cw-try", label: "Try", sfSymbol: "", isEmergency: false),
            WatchPhrase(id: "cw-let", label: "Let", sfSymbol: "", isEmergency: false),
            WatchPhrase(id: "cw-help", label: "Help", sfSymbol: "", isEmergency: true),
            WatchPhrase(id: "cw-make", label: "Make", sfSymbol: "", isEmergency: false),
            WatchPhrase(id: "cw-come", label: "Come", sfSymbol: "", isEmergency: false),
            WatchPhrase(id: "cw-go-core", label: "Go", sfSymbol: "", isEmergency: false),
            WatchPhrase(id: "cw-get-core", label: "Get", sfSymbol: "", isEmergency: false),
            WatchPhrase(id: "cw-put-core", label: "Put", sfSymbol: "", isEmergency: false),
            WatchPhrase(id: "cw-wait", label: "Wait", sfSymbol: "", isEmergency: false),
            WatchPhrase(id: "cw-stop", label: "Stop", sfSymbol: "", isEmergency: false),
            WatchPhrase(id: "cw-start", label: "Start", sfSymbol: "", isEmergency: false),
            WatchPhrase(id: "cw-finish", label: "Finish", sfSymbol: "", isEmergency: false),
            WatchPhrase(id: "cw-begin", label: "Begin", sfSymbol: "", isEmergency: false),
            WatchPhrase(id: "cw-end", label: "End", sfSymbol: "", isEmergency: false),
            WatchPhrase(id: "cw-stay", label: "Stay", sfSymbol: "", isEmergency: false),
            WatchPhrase(id: "cw-leave", label: "Leave", sfSymbol: "", isEmergency: false),
            WatchPhrase(id: "cw-look", label: "Look", sfSymbol: "", isEmergency: false),
            WatchPhrase(id: "cw-watch", label: "Watch", sfSymbol: "", isEmergency: false),
            WatchPhrase(id: "cw-hear", label: "Hear", sfSymbol: "", isEmergency: false),
            WatchPhrase(id: "cw-listen", label: "Listen", sfSymbol: "", isEmergency: false),
            WatchPhrase(id: "cw-smell", label: "Smell", sfSymbol: "", isEmergency: false),
            WatchPhrase(id: "cw-taste", label: "Taste", sfSymbol: "", isEmergency: false),
            WatchPhrase(id: "cw-touch", label: "Touch", sfSymbol: "", isEmergency: false),
            WatchPhrase(id: "cw-hold", label: "Hold", sfSymbol: "", isEmergency: false),
            WatchPhrase(id: "cw-grab", label: "Grab", sfSymbol: "", isEmergency: false),
            WatchPhrase(id: "cw-push", label: "Push", sfSymbol: "", isEmergency: false),
            WatchPhrase(id: "cw-pull", label: "Pull", sfSymbol: "", isEmergency: false),
            WatchPhrase(id: "cw-lift", label: "Lift", sfSymbol: "", isEmergency: false),
            WatchPhrase(id: "cw-carry", label: "Carry", sfSymbol: "", isEmergency: false),
            WatchPhrase(id: "cw-drop", label: "Drop", sfSymbol: "", isEmergency: false),
            WatchPhrase(id: "cw-throw", label: "Throw", sfSymbol: "", isEmergency: false),
            WatchPhrase(id: "cw-catch", label: "Catch", sfSymbol: "", isEmergency: false),
            WatchPhrase(id: "cw-open", label: "Open", sfSymbol: "", isEmergency: false),
            WatchPhrase(id: "cw-close", label: "Close", sfSymbol: "", isEmergency: false),
            WatchPhrase(id: "cw-turn", label: "Turn", sfSymbol: "", isEmergency: false),
            WatchPhrase(id: "cw-move", label: "Move", sfSymbol: "", isEmergency: false),
            WatchPhrase(id: "cw-sit", label: "Sit", sfSymbol: "", isEmergency: false),
            WatchPhrase(id: "cw-stand", label: "Stand", sfSymbol: "", isEmergency: false),
            WatchPhrase(id: "cw-walk", label: "Walk", sfSymbol: "", isEmergency: false),
            WatchPhrase(id: "cw-run", label: "Run", sfSymbol: "", isEmergency: false),
            WatchPhrase(id: "cw-jump", label: "Jump", sfSymbol: "", isEmergency: false),
            WatchPhrase(id: "cw-climb", label: "Climb", sfSymbol: "", isEmergency: false),
            WatchPhrase(id: "cw-fall", label: "Fall", sfSymbol: "", isEmergency: false),
            WatchPhrase(id: "cw-rest", label: "Rest", sfSymbol: "", isEmergency: false),
            WatchPhrase(id: "cw-sleep", label: "Sleep", sfSymbol: "", isEmergency: false),
            WatchPhrase(id: "cw-wake", label: "Wake", sfSymbol: "", isEmergency: false),
            WatchPhrase(id: "cw-dream", label: "Dream", sfSymbol: "", isEmergency: false),
            WatchPhrase(id: "cw-eat", label: "Eat", sfSymbol: "", isEmergency: false),
            WatchPhrase(id: "cw-drink", label: "Drink", sfSymbol: "", isEmergency: false),
            WatchPhrase(id: "cw-bite", label: "Bite", sfSymbol: "", isEmergency: false),
            WatchPhrase(id: "cw-chew", label: "Chew", sfSymbol: "", isEmergency: false),
            WatchPhrase(id: "cw-swallow", label: "Swallow", sfSymbol: "", isEmergency: false),
            WatchPhrase(id: "cw-spit", label: "Spit", sfSymbol: "", isEmergency: false),
            WatchPhrase(id: "cw-talk", label: "Talk", sfSymbol: "", isEmergency: false),
            WatchPhrase(id: "cw-speak", label: "Speak", sfSymbol: "", isEmergency: false),
            WatchPhrase(id: "cw-whisper", label: "Whisper", sfSymbol: "", isEmergency: false),
            WatchPhrase(id: "cw-shout", label: "Shout", sfSymbol: "", isEmergency: false),
            WatchPhrase(id: "cw-sing", label: "Sing", sfSymbol: "", isEmergency: false),
            WatchPhrase(id: "cw-laugh", label: "Laugh", sfSymbol: "", isEmergency: false),
            WatchPhrase(id: "cw-cry", label: "Cry", sfSymbol: "", isEmergency: false),
            WatchPhrase(id: "cw-smile", label: "Smile", sfSymbol: "", isEmergency: false),
            WatchPhrase(id: "cw-read", label: "Read", sfSymbol: "", isEmergency: false),
            WatchPhrase(id: "cw-write", label: "Write", sfSymbol: "", isEmergency: false),
            WatchPhrase(id: "cw-draw", label: "Draw", sfSymbol: "", isEmergency: false),
            WatchPhrase(id: "cw-paint", label: "Paint", sfSymbol: "", isEmergency: false),
            WatchPhrase(id: "cw-color", label: "Color", sfSymbol: "", isEmergency: false),
            WatchPhrase(id: "cw-cut", label: "Cut", sfSymbol: "", isEmergency: false),
            WatchPhrase(id: "cw-glue", label: "Glue", sfSymbol: "", isEmergency: false),
            WatchPhrase(id: "cw-build", label: "Build", sfSymbol: "", isEmergency: false),
            WatchPhrase(id: "cw-break", label: "Break", sfSymbol: "", isEmergency: false),
            WatchPhrase(id: "cw-fix", label: "Fix", sfSymbol: "", isEmergency: false),
            WatchPhrase(id: "cw-clean", label: "Clean", sfSymbol: "", isEmergency: false),
            WatchPhrase(id: "cw-wash", label: "Wash", sfSymbol: "", isEmergency: false),
            WatchPhrase(id: "cw-find", label: "Find", sfSymbol: "", isEmergency: false),
            WatchPhrase(id: "cw-look-for", label: "Look for", sfSymbol: "", isEmergency: false),
            WatchPhrase(id: "cw-lose", label: "Lose", sfSymbol: "", isEmergency: false),
            WatchPhrase(id: "cw-save", label: "Save", sfSymbol: "", isEmergency: false),
            WatchPhrase(id: "cw-keep", label: "Keep", sfSymbol: "", isEmergency: false),
            WatchPhrase(id: "cw-buy", label: "Buy", sfSymbol: "", isEmergency: false),
            WatchPhrase(id: "cw-sell", label: "Sell", sfSymbol: "", isEmergency: false),
            WatchPhrase(id: "cw-pay", label: "Pay", sfSymbol: "", isEmergency: false),
            WatchPhrase(id: "cw-trade", label: "Trade", sfSymbol: "", isEmergency: false),
            WatchPhrase(id: "cw-send", label: "Send", sfSymbol: "", isEmergency: false),
            WatchPhrase(id: "cw-bring", label: "Bring", sfSymbol: "", isEmergency: false),
            WatchPhrase(id: "cw-take", label: "Take", sfSymbol: "", isEmergency: false),
            WatchPhrase(id: "cw-give", label: "Give", sfSymbol: "", isEmergency: false),
            WatchPhrase(id: "cw-share", label: "Share", sfSymbol: "", isEmergency: false),
            WatchPhrase(id: "cw-ask", label: "Ask", sfSymbol: "", isEmergency: false),
            WatchPhrase(id: "cw-answer", label: "Answer", sfSymbol: "", isEmergency: false),
            WatchPhrase(id: "cw-show", label: "Show", sfSymbol: "", isEmergency: false),
            WatchPhrase(id: "cw-hide", label: "Hide", sfSymbol: "", isEmergency: false),
            WatchPhrase(id: "cw-learn", label: "Learn", sfSymbol: "", isEmergency: false),
            WatchPhrase(id: "cw-teach", label: "Teach", sfSymbol: "", isEmergency: false),
            WatchPhrase(id: "cw-study", label: "Study", sfSymbol: "", isEmergency: false),
            WatchPhrase(id: "cw-practice", label: "Practice", sfSymbol: "", isEmergency: false),
            WatchPhrase(id: "cw-work", label: "Work", sfSymbol: "", isEmergency: false),
            WatchPhrase(id: "cw-play", label: "Play", sfSymbol: "", isEmergency: false),
            WatchPhrase(id: "cw-win", label: "Win", sfSymbol: "", isEmergency: false),
            WatchPhrase(id: "cw-try-again", label: "Try again", sfSymbol: "", isEmergency: false),
            WatchPhrase(id: "cw-hug", label: "Hug", sfSymbol: "", isEmergency: false),
            WatchPhrase(id: "cw-kiss", label: "Kiss", sfSymbol: "", isEmergency: false),
            WatchPhrase(id: "cw-pet", label: "Pet", sfSymbol: "", isEmergency: false),
            WatchPhrase(id: "cw-tickle", label: "Tickle", sfSymbol: "", isEmergency: false),
            WatchPhrase(id: "cw-wait-for-me", label: "Wait for me", sfSymbol: "", isEmergency: false),
            WatchPhrase(id: "cw-help-me", label: "Help me", sfSymbol: "", isEmergency: false),
            WatchPhrase(id: "cw-show-me", label: "Show me", sfSymbol: "", isEmergency: false),
            WatchPhrase(id: "cw-tell-me", label: "Tell me", sfSymbol: "", isEmergency: false),
            WatchPhrase(id: "cw-stop-that", label: "Stop that", sfSymbol: "", isEmergency: false),
            WatchPhrase(id: "cw-i-want-to", label: "I want to", sfSymbol: "", isEmergency: false),
            WatchPhrase(id: "cw-i-do-not-want", label: "I do not want", sfSymbol: "", isEmergency: false),
            WatchPhrase(id: "cw-let-me-try", label: "Let me try", sfSymbol: "", isEmergency: false),
            WatchPhrase(id: "cw-let-me-see", label: "Let me see", sfSymbol: "", isEmergency: false),
        ]),
        WatchCategory(id: "core-descriptors", icon: "ruler.fill", name: "More / Not / All", phrases: [
            WatchPhrase(id: "cw-more", label: "More", sfSymbol: "", isEmergency: false),
            WatchPhrase(id: "cw-not", label: "Not", sfSymbol: "", isEmergency: false),
            WatchPhrase(id: "cw-no-core", label: "No", sfSymbol: "", isEmergency: false),
            WatchPhrase(id: "cw-yes-core", label: "Yes", sfSymbol: "", isEmergency: false),
            WatchPhrase(id: "cw-all", label: "All", sfSymbol: "", isEmergency: false),
            WatchPhrase(id: "cw-some", label: "Some", sfSymbol: "", isEmergency: false),
            WatchPhrase(id: "cw-other", label: "Other", sfSymbol: "", isEmergency: false),
            WatchPhrase(id: "cw-very", label: "Very", sfSymbol: "", isEmergency: false),
            WatchPhrase(id: "cw-here", label: "Here", sfSymbol: "", isEmergency: false),
            WatchPhrase(id: "cw-there", label: "There", sfSymbol: "", isEmergency: false),
            WatchPhrase(id: "cw-up", label: "Up", sfSymbol: "", isEmergency: false),
            WatchPhrase(id: "cw-down", label: "Down", sfSymbol: "", isEmergency: false),
            WatchPhrase(id: "cw-in", label: "In", sfSymbol: "", isEmergency: false),
            WatchPhrase(id: "cw-out", label: "Out", sfSymbol: "", isEmergency: false),
            WatchPhrase(id: "cw-on", label: "On", sfSymbol: "", isEmergency: false),
            WatchPhrase(id: "cw-off", label: "Off", sfSymbol: "", isEmergency: false),
            WatchPhrase(id: "cw-done", label: "Done", sfSymbol: "", isEmergency: false),
            WatchPhrase(id: "cw-again", label: "Again", sfSymbol: "", isEmergency: false),
            WatchPhrase(id: "cw-too", label: "Too", sfSymbol: "", isEmergency: false),
            WatchPhrase(id: "cw-same-core", label: "Same", sfSymbol: "", isEmergency: false),
            WatchPhrase(id: "cw-little", label: "Little", sfSymbol: "", isEmergency: false),
            WatchPhrase(id: "cw-lots", label: "Lots", sfSymbol: "", isEmergency: false),
            WatchPhrase(id: "cw-many", label: "Many", sfSymbol: "", isEmergency: false),
            WatchPhrase(id: "cw-few", label: "Few", sfSymbol: "", isEmergency: false),
            WatchPhrase(id: "cw-every", label: "Every", sfSymbol: "", isEmergency: false),
            WatchPhrase(id: "cw-any", label: "Any", sfSymbol: "", isEmergency: false),
            WatchPhrase(id: "cw-only", label: "Only", sfSymbol: "", isEmergency: false),
            WatchPhrase(id: "cw-just", label: "Just", sfSymbol: "", isEmergency: false),
            WatchPhrase(id: "cw-full", label: "Full", sfSymbol: "", isEmergency: false),
            WatchPhrase(id: "cw-empty", label: "Empty", sfSymbol: "", isEmergency: false),
            WatchPhrase(id: "cw-open-2", label: "Open", sfSymbol: "", isEmergency: false),
            WatchPhrase(id: "cw-closed", label: "Closed", sfSymbol: "", isEmergency: false),
            WatchPhrase(id: "cw-easy", label: "Easy", sfSymbol: "", isEmergency: false),
            WatchPhrase(id: "cw-hard", label: "Hard", sfSymbol: "", isEmergency: false),
            WatchPhrase(id: "cw-soft", label: "Soft", sfSymbol: "", isEmergency: false),
            WatchPhrase(id: "cw-loud", label: "Loud", sfSymbol: "", isEmergency: false),
            WatchPhrase(id: "cw-quiet", label: "Quiet", sfSymbol: "", isEmergency: false),
            WatchPhrase(id: "cw-bright", label: "Bright", sfSymbol: "", isEmergency: false),
            WatchPhrase(id: "cw-dark", label: "Dark", sfSymbol: "", isEmergency: false),
            WatchPhrase(id: "cw-heavy", label: "Heavy", sfSymbol: "", isEmergency: false),
            WatchPhrase(id: "cw-light", label: "Light", sfSymbol: "", isEmergency: false),
            WatchPhrase(id: "cw-above", label: "Above", sfSymbol: "", isEmergency: false),
            WatchPhrase(id: "cw-below", label: "Below", sfSymbol: "", isEmergency: false),
            WatchPhrase(id: "cw-beside", label: "Beside", sfSymbol: "", isEmergency: false),
            WatchPhrase(id: "cw-between", label: "Between", sfSymbol: "", isEmergency: false),
            WatchPhrase(id: "cw-near", label: "Near", sfSymbol: "", isEmergency: false),
            WatchPhrase(id: "cw-far", label: "Far", sfSymbol: "", isEmergency: false),
            WatchPhrase(id: "cw-around", label: "Around", sfSymbol: "", isEmergency: false),
            WatchPhrase(id: "cw-through", label: "Through", sfSymbol: "", isEmergency: false),
            WatchPhrase(id: "cw-over", label: "Over", sfSymbol: "", isEmergency: false),
            WatchPhrase(id: "cw-under", label: "Under", sfSymbol: "", isEmergency: false),
            WatchPhrase(id: "cw-across", label: "Across", sfSymbol: "", isEmergency: false),
            WatchPhrase(id: "cw-behind", label: "Behind", sfSymbol: "", isEmergency: false),
            WatchPhrase(id: "cw-ahead", label: "Ahead", sfSymbol: "", isEmergency: false),
            WatchPhrase(id: "cw-always", label: "Always", sfSymbol: "", isEmergency: false),
            WatchPhrase(id: "cw-never", label: "Never", sfSymbol: "", isEmergency: false),
            WatchPhrase(id: "cw-often", label: "Often", sfSymbol: "", isEmergency: false),
            WatchPhrase(id: "cw-sometimes", label: "Sometimes", sfSymbol: "", isEmergency: false),
            WatchPhrase(id: "cw-maybe", label: "Maybe", sfSymbol: "", isEmergency: false),
            WatchPhrase(id: "cw-almost", label: "Almost", sfSymbol: "", isEmergency: false),
            WatchPhrase(id: "cw-already", label: "Already", sfSymbol: "", isEmergency: false),
            WatchPhrase(id: "cw-still", label: "Still", sfSymbol: "", isEmergency: false),
            WatchPhrase(id: "cw-yet", label: "Yet", sfSymbol: "", isEmergency: false),
            WatchPhrase(id: "cw-right-now", label: "Right now", sfSymbol: "", isEmergency: false),
            WatchPhrase(id: "cw-right-here", label: "Right here", sfSymbol: "", isEmergency: false),
            WatchPhrase(id: "cw-way-too-much", label: "Way too much", sfSymbol: "", isEmergency: false),
            WatchPhrase(id: "cw-not-enough", label: "Not enough", sfSymbol: "", isEmergency: false),
        ]),
        WatchCategory(id: "core-little-words", icon: "link", name: "Little Words", phrases: [
            WatchPhrase(id: "cw-is", label: "Is", sfSymbol: "", isEmergency: false),
            WatchPhrase(id: "cw-the", label: "The", sfSymbol: "", isEmergency: false),
            WatchPhrase(id: "cw-a", label: "A", sfSymbol: "", isEmergency: false),
            WatchPhrase(id: "cw-and", label: "And", sfSymbol: "", isEmergency: false),
            WatchPhrase(id: "cw-but", label: "But", sfSymbol: "", isEmergency: false),
            WatchPhrase(id: "cw-or", label: "Or", sfSymbol: "", isEmergency: false),
            WatchPhrase(id: "cw-to", label: "To", sfSymbol: "", isEmergency: false),
            WatchPhrase(id: "cw-for", label: "For", sfSymbol: "", isEmergency: false),
            WatchPhrase(id: "cw-with", label: "With", sfSymbol: "", isEmergency: false),
            WatchPhrase(id: "cw-at", label: "At", sfSymbol: "", isEmergency: false),
            WatchPhrase(id: "cw-of", label: "Of", sfSymbol: "", isEmergency: false),
            WatchPhrase(id: "cw-about", label: "About", sfSymbol: "", isEmergency: false),
            WatchPhrase(id: "cw-because", label: "Because", sfSymbol: "", isEmergency: false),
            WatchPhrase(id: "cw-if", label: "If", sfSymbol: "", isEmergency: false),
            WatchPhrase(id: "cw-when-core", label: "When", sfSymbol: "", isEmergency: false),
            WatchPhrase(id: "cw-where-core", label: "Where", sfSymbol: "", isEmergency: false),
            WatchPhrase(id: "cw-by", label: "By", sfSymbol: "", isEmergency: false),
            WatchPhrase(id: "cw-from", label: "From", sfSymbol: "", isEmergency: false),
            WatchPhrase(id: "cw-since", label: "Since", sfSymbol: "", isEmergency: false),
            WatchPhrase(id: "cw-until", label: "Until", sfSymbol: "", isEmergency: false),
            WatchPhrase(id: "cw-into", label: "Into", sfSymbol: "", isEmergency: false),
            WatchPhrase(id: "cw-onto", label: "Onto", sfSymbol: "", isEmergency: false),
            WatchPhrase(id: "cw-off-of", label: "Off of", sfSymbol: "", isEmergency: false),
            WatchPhrase(id: "cw-away", label: "Away", sfSymbol: "", isEmergency: false),
            WatchPhrase(id: "cw-back", label: "Back", sfSymbol: "", isEmergency: false),
            WatchPhrase(id: "cw-beside-2", label: "Beside", sfSymbol: "", isEmergency: false),
            WatchPhrase(id: "cw-past", label: "Past", sfSymbol: "", isEmergency: false),
            WatchPhrase(id: "cw-among", label: "Among", sfSymbol: "", isEmergency: false),
            WatchPhrase(id: "cw-during", label: "During", sfSymbol: "", isEmergency: false),
            WatchPhrase(id: "cw-while", label: "While", sfSymbol: "", isEmergency: false),
            WatchPhrase(id: "cw-whenever", label: "Whenever", sfSymbol: "", isEmergency: false),
            WatchPhrase(id: "cw-wherever", label: "Wherever", sfSymbol: "", isEmergency: false),
            WatchPhrase(id: "cw-both", label: "Both", sfSymbol: "", isEmergency: false),
            WatchPhrase(id: "cw-either", label: "Either", sfSymbol: "", isEmergency: false),
            WatchPhrase(id: "cw-neither", label: "Neither", sfSymbol: "", isEmergency: false),
            WatchPhrase(id: "cw-whether", label: "Whether", sfSymbol: "", isEmergency: false),
            WatchPhrase(id: "cw-although", label: "Although", sfSymbol: "", isEmergency: false),
            WatchPhrase(id: "cw-though", label: "Though", sfSymbol: "", isEmergency: false),
            WatchPhrase(id: "cw-unless", label: "Unless", sfSymbol: "", isEmergency: false),
            WatchPhrase(id: "cw-so", label: "So", sfSymbol: "", isEmergency: false),
            WatchPhrase(id: "cw-then", label: "Then", sfSymbol: "", isEmergency: false),
            WatchPhrase(id: "cw-also", label: "Also", sfSymbol: "", isEmergency: false),
            WatchPhrase(id: "cw-plus", label: "Plus", sfSymbol: "", isEmergency: false),
            WatchPhrase(id: "cw-like-2", label: "Like", sfSymbol: "", isEmergency: false),
            WatchPhrase(id: "cw-as", label: "As", sfSymbol: "", isEmergency: false),
            WatchPhrase(id: "cw-such-as", label: "Such as", sfSymbol: "", isEmergency: false),
            WatchPhrase(id: "cw-versus", label: "Versus", sfSymbol: "", isEmergency: false),
            WatchPhrase(id: "cw-since-then", label: "Since then", sfSymbol: "", isEmergency: false),
            WatchPhrase(id: "cw-until-now", label: "Until now", sfSymbol: "", isEmergency: false),
            WatchPhrase(id: "cw-right-after", label: "Right after", sfSymbol: "", isEmergency: false),
            WatchPhrase(id: "cw-just-before", label: "Just before", sfSymbol: "", isEmergency: false),
            WatchPhrase(id: "cw-up-to", label: "Up to", sfSymbol: "", isEmergency: false),
            WatchPhrase(id: "cw-down-to", label: "Down to", sfSymbol: "", isEmergency: false),
            WatchPhrase(id: "cw-next-to", label: "Next to", sfSymbol: "", isEmergency: false),
            WatchPhrase(id: "cw-out-of", label: "Out of", sfSymbol: "", isEmergency: false),
            WatchPhrase(id: "cw-a-few", label: "A few", sfSymbol: "", isEmergency: false),
            WatchPhrase(id: "cw-a-lot", label: "A lot", sfSymbol: "", isEmergency: false),
            WatchPhrase(id: "cw-a-little", label: "A little", sfSymbol: "", isEmergency: false),
        ]),
        WatchCategory(id: "help-needs", icon: "sos", name: "Help / Needs", phrases: [
            WatchPhrase(id: "help-all-done", label: "All done", sfSymbol: "", isEmergency: false),
            WatchPhrase(id: "help-break", label: "Take a break", sfSymbol: "", isEmergency: false),
            WatchPhrase(id: "help-need-help", label: "I need help", sfSymbol: "", isEmergency: true),
            WatchPhrase(id: "help-hungry", label: "I am hungry", sfSymbol: "", isEmergency: false),
            WatchPhrase(id: "help-thirsty", label: "I am thirsty", sfSymbol: "", isEmergency: false),
            WatchPhrase(id: "help-bathroom", label: "Bathroom", sfSymbol: "", isEmergency: false),
            WatchPhrase(id: "help-yes", label: "Yes", sfSymbol: "", isEmergency: false),
            WatchPhrase(id: "help-no", label: "No", sfSymbol: "", isEmergency: false),
            WatchPhrase(id: "help-stop", label: "Stop", sfSymbol: "", isEmergency: false),
            WatchPhrase(id: "help-more", label: "More", sfSymbol: "", isEmergency: false),
            WatchPhrase(id: "help-want", label: "I want", sfSymbol: "", isEmergency: false),
            WatchPhrase(id: "help-hurts", label: "It hurts", sfSymbol: "", isEmergency: false),
            WatchPhrase(id: "help-tired", label: "I am tired", sfSymbol: "", isEmergency: false),
            WatchPhrase(id: "help-i-am-cold", label: "I am cold", sfSymbol: "", isEmergency: false),
            WatchPhrase(id: "help-i-am-hot", label: "I am hot", sfSymbol: "", isEmergency: false),
            WatchPhrase(id: "help-i-am-sleepy", label: "I am sleepy", sfSymbol: "", isEmergency: false),
            WatchPhrase(id: "help-i-am-scared", label: "I am scared", sfSymbol: "", isEmergency: false),
            WatchPhrase(id: "help-i-am-sick", label: "I am sick", sfSymbol: "", isEmergency: false),
            WatchPhrase(id: "help-i-am-okay", label: "I am okay", sfSymbol: "", isEmergency: false),
            WatchPhrase(id: "help-i-am-not-okay", label: "I am not okay", sfSymbol: "", isEmergency: false),
            WatchPhrase(id: "help-i-am-ready", label: "I am ready", sfSymbol: "", isEmergency: false),
            WatchPhrase(id: "help-i-am-not-ready", label: "I am not ready", sfSymbol: "", isEmergency: false),
            WatchPhrase(id: "help-too-loud", label: "Too loud", sfSymbol: "", isEmergency: false),
            WatchPhrase(id: "help-too-bright", label: "Too bright", sfSymbol: "", isEmergency: false),
            WatchPhrase(id: "help-too-fast", label: "Too fast", sfSymbol: "", isEmergency: false),
            WatchPhrase(id: "help-too-slow", label: "Too slow", sfSymbol: "", isEmergency: false),
            WatchPhrase(id: "help-i-need-quiet", label: "I need quiet", sfSymbol: "", isEmergency: false),
            WatchPhrase(id: "help-i-need-a-break", label: "I need a break", sfSymbol: "", isEmergency: false),
            WatchPhrase(id: "help-i-need-water", label: "I need water", sfSymbol: "", isEmergency: false),
            WatchPhrase(id: "help-i-need-air", label: "I need air", sfSymbol: "", isEmergency: false),
            WatchPhrase(id: "help-i-need-my-mom", label: "I need my mom", sfSymbol: "", isEmergency: false),
            WatchPhrase(id: "help-i-need-my-dad", label: "I need my dad", sfSymbol: "", isEmergency: false),
            WatchPhrase(id: "help-i-need-my-teacher", label: "I need my teacher", sfSymbol: "", isEmergency: false),
            WatchPhrase(id: "help-i-need-a-hug", label: "I need a hug", sfSymbol: "", isEmergency: false),
            WatchPhrase(id: "help-i-need-space", label: "I need space", sfSymbol: "", isEmergency: false),
            WatchPhrase(id: "help-i-need-time", label: "I need time", sfSymbol: "", isEmergency: false),
            WatchPhrase(id: "help-hold-my-hand", label: "Hold my hand", sfSymbol: "", isEmergency: false),
            WatchPhrase(id: "help-watch-me", label: "Watch me", sfSymbol: "", isEmergency: false),
            WatchPhrase(id: "help-listen-to-me", label: "Listen to me", sfSymbol: "", isEmergency: false),
            WatchPhrase(id: "help-look-at-this", label: "Look at this", sfSymbol: "", isEmergency: false),
            WatchPhrase(id: "help-help-me-please", label: "Help me please", sfSymbol: "", isEmergency: false),
            WatchPhrase(id: "help-help-with-this", label: "Help with this", sfSymbol: "", isEmergency: false),
            WatchPhrase(id: "help-wait-for-me", label: "Wait for me", sfSymbol: "", isEmergency: false),
            WatchPhrase(id: "help-slow-down-please", label: "Slow down please", sfSymbol: "", isEmergency: false),
            WatchPhrase(id: "help-speak-more-slowly", label: "Speak more slowly", sfSymbol: "", isEmergency: false),
            WatchPhrase(id: "help-one-at-a-time", label: "One at a time", sfSymbol: "", isEmergency: false),
            WatchPhrase(id: "help-i-am-overwhelmed", label: "I am overwhelmed", sfSymbol: "", isEmergency: false),
            WatchPhrase(id: "help-i-am-confused", label: "I am confused", sfSymbol: "", isEmergency: false),
            WatchPhrase(id: "help-i-do-not-understand", label: "I do not understand", sfSymbol: "", isEmergency: false),
            WatchPhrase(id: "help-please-be-patient", label: "Please be patient", sfSymbol: "", isEmergency: false),
            WatchPhrase(id: "help-give-me-a-minute", label: "Give me a minute", sfSymbol: "", isEmergency: false),
            WatchPhrase(id: "help-try-again", label: "Try again", sfSymbol: "", isEmergency: false),
            WatchPhrase(id: "help-calm-down", label: "Calm down", sfSymbol: "", isEmergency: false),
            WatchPhrase(id: "help-let-me-think", label: "Let me think", sfSymbol: "", isEmergency: false),
            WatchPhrase(id: "help-show-me-how", label: "Show me how", sfSymbol: "", isEmergency: false),
            WatchPhrase(id: "help-i-do-not-feel-good", label: "I do not feel good", sfSymbol: "", isEmergency: false),
            WatchPhrase(id: "help-my-head-hurts", label: "My head hurts", sfSymbol: "", isEmergency: false),
            WatchPhrase(id: "help-my-tummy-hurts", label: "My tummy hurts", sfSymbol: "", isEmergency: false),
            WatchPhrase(id: "help-my-ears-hurt", label: "My ears hurt", sfSymbol: "", isEmergency: false),
            WatchPhrase(id: "help-my-eyes-hurt", label: "My eyes hurt", sfSymbol: "", isEmergency: false),
            WatchPhrase(id: "help-i-feel-dizzy", label: "I feel dizzy", sfSymbol: "", isEmergency: false),
            WatchPhrase(id: "help-get-help", label: "Get help", sfSymbol: "", isEmergency: false),
            WatchPhrase(id: "help-call-my-mom", label: "Call my mom", sfSymbol: "", isEmergency: false),
            WatchPhrase(id: "help-call-my-dad", label: "Call my dad", sfSymbol: "", isEmergency: false),
            WatchPhrase(id: "help-call-the-nurse", label: "Call the nurse", sfSymbol: "", isEmergency: false),
            WatchPhrase(id: "help-where-is-my-aac", label: "Where is my AAC", sfSymbol: "", isEmergency: false),
            WatchPhrase(id: "help-my-battery-is-low", label: "My battery is low", sfSymbol: "", isEmergency: false),
            WatchPhrase(id: "help-i-dropped-my-tablet", label: "I dropped my tablet", sfSymbol: "", isEmergency: false),
        ]),
        WatchCategory(id: "quick-talk", icon: "bubble.left.and.bubble.right.fill", name: "Quick Talk", phrases: [
            WatchPhrase(id: "qt-hello", label: "Hello", sfSymbol: "", isEmergency: false),
            WatchPhrase(id: "qt-goodbye", label: "Goodbye", sfSymbol: "", isEmergency: false),
            WatchPhrase(id: "qt-thank-you", label: "Thank you", sfSymbol: "", isEmergency: false),
            WatchPhrase(id: "qt-please", label: "Please", sfSymbol: "", isEmergency: false),
            WatchPhrase(id: "qt-excuse-me", label: "Excuse me", sfSymbol: "", isEmergency: false),
            WatchPhrase(id: "qt-wait", label: "Wait", sfSymbol: "", isEmergency: false),
            WatchPhrase(id: "qt-come-here", label: "Come here", sfSymbol: "", isEmergency: false),
            WatchPhrase(id: "qt-how-are-you", label: "How are you?", sfSymbol: "", isEmergency: false),
            WatchPhrase(id: "qt-sorry", label: "Sorry", sfSymbol: "", isEmergency: false),
            WatchPhrase(id: "qt-my-name", label: "My name is", sfSymbol: "", isEmergency: false),
            WatchPhrase(id: "qt-nice-meet", label: "Nice to meet you", sfSymbol: "", isEmergency: false),
            WatchPhrase(id: "qt-see-later", label: "See you later", sfSymbol: "", isEmergency: false),
            WatchPhrase(id: "qt-hi", label: "Hi", sfSymbol: "", isEmergency: false),
            WatchPhrase(id: "qt-hey", label: "Hey", sfSymbol: "", isEmergency: false),
            WatchPhrase(id: "qt-bye", label: "Bye", sfSymbol: "", isEmergency: false),
            WatchPhrase(id: "qt-bye-bye", label: "Bye-bye", sfSymbol: "", isEmergency: false),
            WatchPhrase(id: "qt-see-you", label: "See you", sfSymbol: "", isEmergency: false),
            WatchPhrase(id: "qt-see-you-soon", label: "See you soon", sfSymbol: "", isEmergency: false),
            WatchPhrase(id: "qt-see-you-tomorrow", label: "See you tomorrow", sfSymbol: "", isEmergency: false),
            WatchPhrase(id: "qt-take-care", label: "Take care", sfSymbol: "", isEmergency: false),
            WatchPhrase(id: "qt-have-fun", label: "Have fun", sfSymbol: "", isEmergency: false),
            WatchPhrase(id: "qt-good-morning", label: "Good morning", sfSymbol: "", isEmergency: false),
            WatchPhrase(id: "qt-good-afternoon", label: "Good afternoon", sfSymbol: "", isEmergency: false),
            WatchPhrase(id: "qt-good-evening", label: "Good evening", sfSymbol: "", isEmergency: false),
            WatchPhrase(id: "qt-good-night", label: "Good night", sfSymbol: "", isEmergency: false),
            WatchPhrase(id: "qt-good-job", label: "Good job", sfSymbol: "", isEmergency: false),
            WatchPhrase(id: "qt-well-done", label: "Well done", sfSymbol: "", isEmergency: false),
            WatchPhrase(id: "qt-way-to-go", label: "Way to go", sfSymbol: "", isEmergency: false),
            WatchPhrase(id: "qt-awesome", label: "Awesome", sfSymbol: "", isEmergency: false),
            WatchPhrase(id: "qt-cool", label: "Cool", sfSymbol: "", isEmergency: false),
            WatchPhrase(id: "qt-nice", label: "Nice", sfSymbol: "", isEmergency: false),
            WatchPhrase(id: "qt-great", label: "Great", sfSymbol: "", isEmergency: false),
            WatchPhrase(id: "qt-wonderful", label: "Wonderful", sfSymbol: "", isEmergency: false),
            WatchPhrase(id: "qt-amazing", label: "Amazing", sfSymbol: "", isEmergency: false),
            WatchPhrase(id: "qt-perfect", label: "Perfect", sfSymbol: "", isEmergency: false),
            WatchPhrase(id: "qt-yay", label: "Yay", sfSymbol: "", isEmergency: false),
            WatchPhrase(id: "qt-okay", label: "Okay", sfSymbol: "", isEmergency: false),
            WatchPhrase(id: "qt-alright", label: "Alright", sfSymbol: "", isEmergency: false),
            WatchPhrase(id: "qt-sure", label: "Sure", sfSymbol: "", isEmergency: false),
            WatchPhrase(id: "qt-of-course", label: "Of course", sfSymbol: "", isEmergency: false),
            WatchPhrase(id: "qt-definitely", label: "Definitely", sfSymbol: "", isEmergency: false),
            WatchPhrase(id: "qt-maybe", label: "Maybe", sfSymbol: "", isEmergency: false),
            WatchPhrase(id: "qt-i-think-so", label: "I think so", sfSymbol: "", isEmergency: false),
            WatchPhrase(id: "qt-i-am-not-sure", label: "I am not sure", sfSymbol: "", isEmergency: false),
            WatchPhrase(id: "qt-it-is-fine", label: "It is fine", sfSymbol: "", isEmergency: false),
            WatchPhrase(id: "qt-no-problem", label: "No problem", sfSymbol: "", isEmergency: false),
            WatchPhrase(id: "qt-no-worries", label: "No worries", sfSymbol: "", isEmergency: false),
            WatchPhrase(id: "qt-never-mind", label: "Never mind", sfSymbol: "", isEmergency: false),
            WatchPhrase(id: "qt-my-bad", label: "My bad", sfSymbol: "", isEmergency: false),
            WatchPhrase(id: "qt-oops", label: "Oops", sfSymbol: "", isEmergency: false),
            WatchPhrase(id: "qt-bless-you", label: "Bless you", sfSymbol: "", isEmergency: false),
            WatchPhrase(id: "qt-happy-birthday", label: "Happy birthday", sfSymbol: "", isEmergency: false),
            WatchPhrase(id: "qt-happy-holidays", label: "Happy holidays", sfSymbol: "", isEmergency: false),
            WatchPhrase(id: "qt-merry-christmas", label: "Merry Christmas", sfSymbol: "", isEmergency: false),
            WatchPhrase(id: "qt-happy-new-year", label: "Happy New Year", sfSymbol: "", isEmergency: false),
            WatchPhrase(id: "qt-eid-mubarak", label: "Eid Mubarak", sfSymbol: "", isEmergency: false),
            WatchPhrase(id: "qt-happy-hanukkah", label: "Happy Hanukkah", sfSymbol: "", isEmergency: false),
            WatchPhrase(id: "qt-congratulations", label: "Congratulations", sfSymbol: "", isEmergency: false),
            WatchPhrase(id: "qt-i-am-proud-of-you", label: "I am proud of you", sfSymbol: "", isEmergency: false),
            WatchPhrase(id: "qt-you-did-it", label: "You did it", sfSymbol: "", isEmergency: false),
            WatchPhrase(id: "qt-how-was-your-day", label: "How was your day", sfSymbol: "", isEmergency: false),
            WatchPhrase(id: "qt-i-had-a-good-day", label: "I had a good day", sfSymbol: "", isEmergency: false),
            WatchPhrase(id: "qt-i-had-a-bad-day", label: "I had a bad day", sfSymbol: "", isEmergency: false),
            WatchPhrase(id: "qt-tell-me-about-your-day", label: "Tell me about your day", sfSymbol: "", isEmergency: false),
            WatchPhrase(id: "qt-i-missed-you", label: "I missed you", sfSymbol: "", isEmergency: false),
            WatchPhrase(id: "qt-i-am-here", label: "I am here", sfSymbol: "", isEmergency: false),
            WatchPhrase(id: "qt-i-love-you-too", label: "I love you too", sfSymbol: "", isEmergency: false),
            WatchPhrase(id: "qt-you-are-my-friend", label: "You are my friend", sfSymbol: "", isEmergency: false),
            WatchPhrase(id: "qt-best-friends", label: "Best friends", sfSymbol: "", isEmergency: false),
        ]),
        WatchCategory(id: "feelings", icon: "face.smiling", name: "Feelings", phrases: [
            WatchPhrase(id: "fe-happy", label: "Happy", sfSymbol: "", isEmergency: false),
            WatchPhrase(id: "fe-sad", label: "Sad", sfSymbol: "", isEmergency: false),
            WatchPhrase(id: "fe-angry", label: "Angry", sfSymbol: "", isEmergency: false),
            WatchPhrase(id: "fe-scared", label: "Scared", sfSymbol: "", isEmergency: false),
            WatchPhrase(id: "fe-excited", label: "Excited", sfSymbol: "", isEmergency: false),
            WatchPhrase(id: "fe-frustrated", label: "Frustrated", sfSymbol: "", isEmergency: false),
            WatchPhrase(id: "fe-bored", label: "Bored", sfSymbol: "", isEmergency: false),
            WatchPhrase(id: "fe-surprised", label: "Surprised", sfSymbol: "", isEmergency: false),
            WatchPhrase(id: "fe-confused", label: "Confused", sfSymbol: "", isEmergency: false),
            WatchPhrase(id: "fe-proud", label: "Proud", sfSymbol: "", isEmergency: false),
            WatchPhrase(id: "fe-nervous", label: "Nervous", sfSymbol: "", isEmergency: false),
            WatchPhrase(id: "fe-silly", label: "Silly", sfSymbol: "", isEmergency: false),
            WatchPhrase(id: "fe-love", label: "I love you", sfSymbol: "", isEmergency: false),
            WatchPhrase(id: "fe-hurt", label: "My feelings are hurt", sfSymbol: "", isEmergency: false),
            WatchPhrase(id: "fe-calm", label: "Calm", sfSymbol: "", isEmergency: false),
            WatchPhrase(id: "fe-peaceful", label: "Peaceful", sfSymbol: "", isEmergency: false),
            WatchPhrase(id: "fe-relaxed", label: "Relaxed", sfSymbol: "", isEmergency: false),
            WatchPhrase(id: "fe-content", label: "Content", sfSymbol: "", isEmergency: false),
            WatchPhrase(id: "fe-joyful", label: "Joyful", sfSymbol: "", isEmergency: false),
            WatchPhrase(id: "fe-glad", label: "Glad", sfSymbol: "", isEmergency: false),
            WatchPhrase(id: "fe-cheerful", label: "Cheerful", sfSymbol: "", isEmergency: false),
            WatchPhrase(id: "fe-hopeful", label: "Hopeful", sfSymbol: "", isEmergency: false),
            WatchPhrase(id: "fe-grateful", label: "Grateful", sfSymbol: "", isEmergency: false),
            WatchPhrase(id: "fe-thankful", label: "Thankful", sfSymbol: "", isEmergency: false),
            WatchPhrase(id: "fe-loved", label: "Loved", sfSymbol: "", isEmergency: false),
            WatchPhrase(id: "fe-safe", label: "Safe", sfSymbol: "", isEmergency: false),
            WatchPhrase(id: "fe-comfortable", label: "Comfortable", sfSymbol: "", isEmergency: false),
            WatchPhrase(id: "fe-warm-inside", label: "Warm inside", sfSymbol: "", isEmergency: false),
            WatchPhrase(id: "fe-tired", label: "Tired", sfSymbol: "", isEmergency: false),
            WatchPhrase(id: "fe-sleepy", label: "Sleepy", sfSymbol: "", isEmergency: false),
            WatchPhrase(id: "fe-hungry", label: "Hungry", sfSymbol: "", isEmergency: false),
            WatchPhrase(id: "fe-full", label: "Full", sfSymbol: "", isEmergency: false),
            WatchPhrase(id: "fe-thirsty", label: "Thirsty", sfSymbol: "", isEmergency: false),
            WatchPhrase(id: "fe-sick", label: "Sick", sfSymbol: "", isEmergency: false),
            WatchPhrase(id: "fe-lonely", label: "Lonely", sfSymbol: "", isEmergency: false),
            WatchPhrase(id: "fe-embarrassed", label: "Embarrassed", sfSymbol: "", isEmergency: false),
            WatchPhrase(id: "fe-shy", label: "Shy", sfSymbol: "", isEmergency: false),
            WatchPhrase(id: "fe-ashamed", label: "Ashamed", sfSymbol: "", isEmergency: false),
            WatchPhrase(id: "fe-guilty", label: "Guilty", sfSymbol: "", isEmergency: false),
            WatchPhrase(id: "fe-jealous", label: "Jealous", sfSymbol: "", isEmergency: false),
            WatchPhrase(id: "fe-disappointed", label: "Disappointed", sfSymbol: "", isEmergency: false),
            WatchPhrase(id: "fe-annoyed", label: "Annoyed", sfSymbol: "", isEmergency: false),
            WatchPhrase(id: "fe-anxious", label: "Anxious", sfSymbol: "", isEmergency: false),
            WatchPhrase(id: "fe-worried", label: "Worried", sfSymbol: "", isEmergency: false),
            WatchPhrase(id: "fe-stressed", label: "Stressed", sfSymbol: "", isEmergency: false),
            WatchPhrase(id: "fe-panicked", label: "Panicked", sfSymbol: "", isEmergency: false),
            WatchPhrase(id: "fe-terrified", label: "Terrified", sfSymbol: "", isEmergency: false),
            WatchPhrase(id: "fe-brave", label: "Brave", sfSymbol: "", isEmergency: false),
            WatchPhrase(id: "fe-strong", label: "Strong", sfSymbol: "", isEmergency: false),
            WatchPhrase(id: "fe-weak", label: "Weak", sfSymbol: "", isEmergency: false),
            WatchPhrase(id: "fe-dizzy", label: "Dizzy", sfSymbol: "", isEmergency: false),
            WatchPhrase(id: "fe-itchy", label: "Itchy", sfSymbol: "", isEmergency: false),
            WatchPhrase(id: "fe-ticklish", label: "Ticklish", sfSymbol: "", isEmergency: false),
            WatchPhrase(id: "fe-numb", label: "Numb", sfSymbol: "", isEmergency: false),
            WatchPhrase(id: "fe-cold-inside", label: "Cold inside", sfSymbol: "", isEmergency: false),
            WatchPhrase(id: "fe-empty", label: "Empty", sfSymbol: "", isEmergency: false),
            WatchPhrase(id: "fe-heavy-heart", label: "Heavy heart", sfSymbol: "", isEmergency: false),
            WatchPhrase(id: "fe-mixed-up", label: "Mixed up", sfSymbol: "", isEmergency: false),
            WatchPhrase(id: "fe-confused-inside", label: "Confused inside", sfSymbol: "", isEmergency: false),
            WatchPhrase(id: "fe-stuck", label: "Stuck", sfSymbol: "", isEmergency: false),
            WatchPhrase(id: "fe-missing-someone", label: "Missing someone", sfSymbol: "", isEmergency: false),
            WatchPhrase(id: "fe-homesick", label: "Homesick", sfSymbol: "", isEmergency: false),
            WatchPhrase(id: "fe-overwhelmed", label: "Overwhelmed", sfSymbol: "", isEmergency: false),
            WatchPhrase(id: "fe-done-with-this", label: "Done with this", sfSymbol: "", isEmergency: false),
            WatchPhrase(id: "fe-i-have-had-enough", label: "I have had enough", sfSymbol: "", isEmergency: false),
            WatchPhrase(id: "fe-i-feel-good", label: "I feel good", sfSymbol: "", isEmergency: false),
            WatchPhrase(id: "fe-i-feel-bad", label: "I feel bad", sfSymbol: "", isEmergency: false),
            WatchPhrase(id: "fe-i-feel-okay", label: "I feel okay", sfSymbol: "", isEmergency: false),
            WatchPhrase(id: "fe-i-feel-weird", label: "I feel weird", sfSymbol: "", isEmergency: false),
        ]),
        WatchCategory(id: "questions", icon: "questionmark.circle.fill", name: "Questions", phrases: [
            WatchPhrase(id: "qu-what", label: "What?", sfSymbol: "", isEmergency: false),
            WatchPhrase(id: "qu-where", label: "Where?", sfSymbol: "", isEmergency: false),
            WatchPhrase(id: "qu-when", label: "When?", sfSymbol: "", isEmergency: false),
            WatchPhrase(id: "qu-who", label: "Who?", sfSymbol: "", isEmergency: false),
            WatchPhrase(id: "qu-why", label: "Why?", sfSymbol: "", isEmergency: false),
            WatchPhrase(id: "qu-how", label: "How?", sfSymbol: "", isEmergency: false),
            WatchPhrase(id: "qu-which", label: "Which one?", sfSymbol: "", isEmergency: false),
            WatchPhrase(id: "qu-how-many", label: "How many?", sfSymbol: "", isEmergency: false),
            WatchPhrase(id: "qu-can-i", label: "Can I?", sfSymbol: "", isEmergency: false),
            WatchPhrase(id: "qu-is-it", label: "Is it?", sfSymbol: "", isEmergency: false),
            WatchPhrase(id: "qu-where-going", label: "Where are we going?", sfSymbol: "", isEmergency: false),
            WatchPhrase(id: "qu-who-is-that", label: "Who is that", sfSymbol: "", isEmergency: false),
            WatchPhrase(id: "qu-what-is-that", label: "What is that", sfSymbol: "", isEmergency: false),
            WatchPhrase(id: "qu-where-is-it", label: "Where is it", sfSymbol: "", isEmergency: false),
            WatchPhrase(id: "qu-when-is-it", label: "When is it", sfSymbol: "", isEmergency: false),
            WatchPhrase(id: "qu-why-is-that", label: "Why is that", sfSymbol: "", isEmergency: false),
            WatchPhrase(id: "qu-how-does-it-work", label: "How does it work", sfSymbol: "", isEmergency: false),
            WatchPhrase(id: "qu-how-do-i", label: "How do I", sfSymbol: "", isEmergency: false),
            WatchPhrase(id: "qu-can-i-have-it", label: "Can I have it", sfSymbol: "", isEmergency: false),
            WatchPhrase(id: "qu-can-i-try", label: "Can I try", sfSymbol: "", isEmergency: false),
            WatchPhrase(id: "qu-can-i-go", label: "Can I go", sfSymbol: "", isEmergency: false),
            WatchPhrase(id: "qu-may-i-please", label: "May I please", sfSymbol: "", isEmergency: false),
            WatchPhrase(id: "qu-will-you-help", label: "Will you help", sfSymbol: "", isEmergency: false),
            WatchPhrase(id: "qu-are-you-okay", label: "Are you okay", sfSymbol: "", isEmergency: false),
            WatchPhrase(id: "qu-are-we-there-yet", label: "Are we there yet", sfSymbol: "", isEmergency: false),
            WatchPhrase(id: "qu-where-are-we-going", label: "Where are we going", sfSymbol: "", isEmergency: false),
            WatchPhrase(id: "qu-when-will-we-be-there", label: "When will we be there", sfSymbol: "", isEmergency: false),
            WatchPhrase(id: "qu-how-much-longer", label: "How much longer", sfSymbol: "", isEmergency: false),
            WatchPhrase(id: "qu-what-time-is-it", label: "What time is it", sfSymbol: "", isEmergency: false),
            WatchPhrase(id: "qu-what-day-is-it", label: "What day is it", sfSymbol: "", isEmergency: false),
            WatchPhrase(id: "qu-is-it-ready-yet", label: "Is it ready yet", sfSymbol: "", isEmergency: false),
            WatchPhrase(id: "qu-can-we-go-now", label: "Can we go now", sfSymbol: "", isEmergency: false),
            WatchPhrase(id: "qu-can-we-do-this", label: "Can we do this", sfSymbol: "", isEmergency: false),
            WatchPhrase(id: "qu-did-you-see-that", label: "Did you see that", sfSymbol: "", isEmergency: false),
            WatchPhrase(id: "qu-did-i-do-good", label: "Did I do good", sfSymbol: "", isEmergency: false),
            WatchPhrase(id: "qu-what-happened", label: "What happened", sfSymbol: "", isEmergency: false),
            WatchPhrase(id: "qu-where-did-it-go", label: "Where did it go", sfSymbol: "", isEmergency: false),
            WatchPhrase(id: "qu-who-said-that", label: "Who said that", sfSymbol: "", isEmergency: false),
            WatchPhrase(id: "qu-what-did-they-say", label: "What did they say", sfSymbol: "", isEmergency: false),
            WatchPhrase(id: "qu-how-old-are-you", label: "How old are you", sfSymbol: "", isEmergency: false),
            WatchPhrase(id: "qu-what-is-your-name", label: "What is your name", sfSymbol: "", isEmergency: false),
            WatchPhrase(id: "qu-how-are-you-feeling", label: "How are you feeling", sfSymbol: "", isEmergency: false),
            WatchPhrase(id: "qu-what-is-for-dinner", label: "What is for dinner", sfSymbol: "", isEmergency: false),
            WatchPhrase(id: "qu-what-is-for-snack", label: "What is for snack", sfSymbol: "", isEmergency: false),
            WatchPhrase(id: "qu-is-it-bedtime", label: "Is it bedtime", sfSymbol: "", isEmergency: false),
            WatchPhrase(id: "qu-are-you-my-friend", label: "Are you my friend", sfSymbol: "", isEmergency: false),
            WatchPhrase(id: "qu-will-you-play-with-me", label: "Will you play with me", sfSymbol: "", isEmergency: false),
        ]),
        WatchCategory(id: "actions", icon: "figure.run", name: "Actions", phrases: [
            WatchPhrase(id: "ac-go", label: "Go", sfSymbol: "", isEmergency: false),
            WatchPhrase(id: "ac-stop", label: "Stop", sfSymbol: "", isEmergency: false),
            WatchPhrase(id: "ac-eat", label: "Eat", sfSymbol: "", isEmergency: false),
            WatchPhrase(id: "ac-drink", label: "Drink", sfSymbol: "", isEmergency: false),
            WatchPhrase(id: "ac-play", label: "Play", sfSymbol: "", isEmergency: false),
            WatchPhrase(id: "ac-read", label: "Read", sfSymbol: "", isEmergency: false),
            WatchPhrase(id: "ac-watch", label: "Watch", sfSymbol: "", isEmergency: false),
            WatchPhrase(id: "ac-listen", label: "Listen", sfSymbol: "", isEmergency: false),
            WatchPhrase(id: "ac-open", label: "Open", sfSymbol: "", isEmergency: false),
            WatchPhrase(id: "ac-close", label: "Close", sfSymbol: "", isEmergency: false),
            WatchPhrase(id: "ac-give", label: "Give", sfSymbol: "", isEmergency: false),
            WatchPhrase(id: "ac-take", label: "Take", sfSymbol: "", isEmergency: false),
            WatchPhrase(id: "ac-look", label: "Look", sfSymbol: "", isEmergency: false),
            WatchPhrase(id: "ac-sit", label: "Sit", sfSymbol: "", isEmergency: false),
            WatchPhrase(id: "ac-stand", label: "Stand up", sfSymbol: "", isEmergency: false),
            WatchPhrase(id: "ac-walk", label: "Walk", sfSymbol: "", isEmergency: false),
            WatchPhrase(id: "ac-run", label: "Run", sfSymbol: "", isEmergency: false),
            WatchPhrase(id: "ac-write", label: "Write", sfSymbol: "", isEmergency: false),
            WatchPhrase(id: "ac-draw", label: "Draw", sfSymbol: "", isEmergency: false),
            WatchPhrase(id: "ac-make", label: "Make", sfSymbol: "", isEmergency: false),
            WatchPhrase(id: "ac-put", label: "Put", sfSymbol: "", isEmergency: false),
            WatchPhrase(id: "ac-get", label: "Get", sfSymbol: "", isEmergency: false),
            WatchPhrase(id: "ac-turn", label: "Turn", sfSymbol: "", isEmergency: false),
            WatchPhrase(id: "ac-wash", label: "Wash", sfSymbol: "", isEmergency: false),
            WatchPhrase(id: "ac-wave", label: "Wave", sfSymbol: "", isEmergency: false),
            WatchPhrase(id: "ac-clap", label: "Clap", sfSymbol: "", isEmergency: false),
            WatchPhrase(id: "ac-point", label: "Point", sfSymbol: "", isEmergency: false),
            WatchPhrase(id: "ac-nod", label: "Nod", sfSymbol: "", isEmergency: false),
            WatchPhrase(id: "ac-shake-head", label: "Shake head", sfSymbol: "", isEmergency: false),
            WatchPhrase(id: "ac-whisper", label: "Whisper", sfSymbol: "", isEmergency: false),
            WatchPhrase(id: "ac-shout", label: "Shout", sfSymbol: "", isEmergency: false),
            WatchPhrase(id: "ac-sing", label: "Sing", sfSymbol: "", isEmergency: false),
            WatchPhrase(id: "ac-hum", label: "Hum", sfSymbol: "", isEmergency: false),
            WatchPhrase(id: "ac-roll", label: "Roll", sfSymbol: "", isEmergency: false),
            WatchPhrase(id: "ac-slide", label: "Slide", sfSymbol: "", isEmergency: false),
            WatchPhrase(id: "ac-spin", label: "Spin", sfSymbol: "", isEmergency: false),
            WatchPhrase(id: "ac-hop", label: "Hop", sfSymbol: "", isEmergency: false),
            WatchPhrase(id: "ac-skip", label: "Skip", sfSymbol: "", isEmergency: false),
            WatchPhrase(id: "ac-crawl", label: "Crawl", sfSymbol: "", isEmergency: false),
            WatchPhrase(id: "ac-tiptoe", label: "Tiptoe", sfSymbol: "", isEmergency: false),
            WatchPhrase(id: "ac-tip-toe", label: "Tip-toe", sfSymbol: "", isEmergency: false),
            WatchPhrase(id: "ac-march", label: "March", sfSymbol: "", isEmergency: false),
            WatchPhrase(id: "ac-climb-up", label: "Climb up", sfSymbol: "", isEmergency: false),
            WatchPhrase(id: "ac-climb-down", label: "Climb down", sfSymbol: "", isEmergency: false),
            WatchPhrase(id: "ac-push-it", label: "Push it", sfSymbol: "", isEmergency: false),
            WatchPhrase(id: "ac-pull-it", label: "Pull it", sfSymbol: "", isEmergency: false),
            WatchPhrase(id: "ac-pick-it-up", label: "Pick it up", sfSymbol: "", isEmergency: false),
            WatchPhrase(id: "ac-set-it-down", label: "Set it down", sfSymbol: "", isEmergency: false),
            WatchPhrase(id: "ac-pour", label: "Pour", sfSymbol: "", isEmergency: false),
            WatchPhrase(id: "ac-stir", label: "Stir", sfSymbol: "", isEmergency: false),
            WatchPhrase(id: "ac-mix", label: "Mix", sfSymbol: "", isEmergency: false),
            WatchPhrase(id: "ac-spread", label: "Spread", sfSymbol: "", isEmergency: false),
            WatchPhrase(id: "ac-fold", label: "Fold", sfSymbol: "", isEmergency: false),
            WatchPhrase(id: "ac-tie", label: "Tie", sfSymbol: "", isEmergency: false),
            WatchPhrase(id: "ac-untie", label: "Untie", sfSymbol: "", isEmergency: false),
            WatchPhrase(id: "ac-zip", label: "Zip", sfSymbol: "", isEmergency: false),
            WatchPhrase(id: "ac-unzip", label: "Unzip", sfSymbol: "", isEmergency: false),
            WatchPhrase(id: "ac-snap", label: "Snap", sfSymbol: "", isEmergency: false),
            WatchPhrase(id: "ac-buckle", label: "Buckle", sfSymbol: "", isEmergency: false),
            WatchPhrase(id: "ac-brush-teeth", label: "Brush teeth", sfSymbol: "", isEmergency: false),
            WatchPhrase(id: "ac-brush-hair", label: "Brush hair", sfSymbol: "", isEmergency: false),
            WatchPhrase(id: "ac-comb", label: "Comb", sfSymbol: "", isEmergency: false),
            WatchPhrase(id: "ac-floss", label: "Floss", sfSymbol: "", isEmergency: false),
            WatchPhrase(id: "ac-get-dressed", label: "Get dressed", sfSymbol: "", isEmergency: false),
            WatchPhrase(id: "ac-get-undressed", label: "Get undressed", sfSymbol: "", isEmergency: false),
            WatchPhrase(id: "ac-put-on-shoes", label: "Put on shoes", sfSymbol: "", isEmergency: false),
            WatchPhrase(id: "ac-take-off-shoes", label: "Take off shoes", sfSymbol: "", isEmergency: false),
            WatchPhrase(id: "ac-wash-hands", label: "Wash hands", sfSymbol: "", isEmergency: false),
            WatchPhrase(id: "ac-take-a-bath", label: "Take a bath", sfSymbol: "", isEmergency: false),
            WatchPhrase(id: "ac-take-a-shower", label: "Take a shower", sfSymbol: "", isEmergency: false),
            WatchPhrase(id: "ac-sleep", label: "Sleep", sfSymbol: "", isEmergency: false),
            WatchPhrase(id: "ac-take-a-nap", label: "Take a nap", sfSymbol: "", isEmergency: false),
            WatchPhrase(id: "ac-wake-up", label: "Wake up", sfSymbol: "", isEmergency: false),
            WatchPhrase(id: "ac-wait-for", label: "Wait for", sfSymbol: "", isEmergency: false),
            WatchPhrase(id: "ac-look-for", label: "Look for", sfSymbol: "", isEmergency: false),
            WatchPhrase(id: "ac-search", label: "Search", sfSymbol: "", isEmergency: false),
            WatchPhrase(id: "ac-discover", label: "Discover", sfSymbol: "", isEmergency: false),
            WatchPhrase(id: "ac-hide", label: "Hide", sfSymbol: "", isEmergency: false),
            WatchPhrase(id: "ac-seek", label: "Seek", sfSymbol: "", isEmergency: false),
            WatchPhrase(id: "ac-tag", label: "Tag", sfSymbol: "", isEmergency: false),
            WatchPhrase(id: "ac-race", label: "Race", sfSymbol: "", isEmergency: false),
            WatchPhrase(id: "ac-cuddle", label: "Cuddle", sfSymbol: "", isEmergency: false),
            WatchPhrase(id: "ac-snuggle", label: "Snuggle", sfSymbol: "", isEmergency: false),
            WatchPhrase(id: "ac-pat", label: "Pat", sfSymbol: "", isEmergency: false),
            WatchPhrase(id: "ac-tickle", label: "Tickle", sfSymbol: "", isEmergency: false),
            WatchPhrase(id: "ac-sweep", label: "Sweep", sfSymbol: "", isEmergency: false),
            WatchPhrase(id: "ac-mop", label: "Mop", sfSymbol: "", isEmergency: false),
            WatchPhrase(id: "ac-vacuum", label: "Vacuum", sfSymbol: "", isEmergency: false),
            WatchPhrase(id: "ac-dust", label: "Dust", sfSymbol: "", isEmergency: false),
            WatchPhrase(id: "ac-carry-it", label: "Carry it", sfSymbol: "", isEmergency: false),
            WatchPhrase(id: "ac-drop-it", label: "Drop it", sfSymbol: "", isEmergency: false),
            WatchPhrase(id: "ac-toss-it", label: "Toss it", sfSymbol: "", isEmergency: false),
            WatchPhrase(id: "ac-roll-it", label: "Roll it", sfSymbol: "", isEmergency: false),
        ]),
        WatchCategory(id: "describing", icon: "paintpalette.fill", name: "Describing Words", phrases: [
            WatchPhrase(id: "dw-big", label: "Big", sfSymbol: "", isEmergency: false),
            WatchPhrase(id: "dw-small", label: "Small", sfSymbol: "", isEmergency: false),
            WatchPhrase(id: "dw-hot", label: "Hot", sfSymbol: "", isEmergency: false),
            WatchPhrase(id: "dw-cold", label: "Cold", sfSymbol: "", isEmergency: false),
            WatchPhrase(id: "dw-good", label: "Good", sfSymbol: "", isEmergency: false),
            WatchPhrase(id: "dw-bad", label: "Bad", sfSymbol: "", isEmergency: false),
            WatchPhrase(id: "dw-fast", label: "Fast", sfSymbol: "", isEmergency: false),
            WatchPhrase(id: "dw-slow", label: "Slow", sfSymbol: "", isEmergency: false),
            WatchPhrase(id: "dw-new", label: "New", sfSymbol: "", isEmergency: false),
            WatchPhrase(id: "dw-old", label: "Old", sfSymbol: "", isEmergency: false),
            WatchPhrase(id: "dw-same", label: "Same", sfSymbol: "", isEmergency: false),
            WatchPhrase(id: "dw-different", label: "Different", sfSymbol: "", isEmergency: false),
            WatchPhrase(id: "dw-funny", label: "Funny", sfSymbol: "", isEmergency: false),
            WatchPhrase(id: "dw-pretty", label: "Pretty", sfSymbol: "", isEmergency: false),
            WatchPhrase(id: "dw-yucky", label: "Yucky", sfSymbol: "", isEmergency: false),
            WatchPhrase(id: "dw-favorite", label: "Favorite", sfSymbol: "", isEmergency: false),
            WatchPhrase(id: "dw-tall", label: "Tall", sfSymbol: "", isEmergency: false),
            WatchPhrase(id: "dw-short", label: "Short", sfSymbol: "", isEmergency: false),
            WatchPhrase(id: "dw-long", label: "Long", sfSymbol: "", isEmergency: false),
            WatchPhrase(id: "dw-wide", label: "Wide", sfSymbol: "", isEmergency: false),
            WatchPhrase(id: "dw-narrow", label: "Narrow", sfSymbol: "", isEmergency: false),
            WatchPhrase(id: "dw-thick", label: "Thick", sfSymbol: "", isEmergency: false),
            WatchPhrase(id: "dw-thin", label: "Thin", sfSymbol: "", isEmergency: false),
            WatchPhrase(id: "dw-round", label: "Round", sfSymbol: "", isEmergency: false),
            WatchPhrase(id: "dw-square", label: "Square", sfSymbol: "", isEmergency: false),
            WatchPhrase(id: "dw-smooth", label: "Smooth", sfSymbol: "", isEmergency: false),
            WatchPhrase(id: "dw-rough", label: "Rough", sfSymbol: "", isEmergency: false),
            WatchPhrase(id: "dw-sticky", label: "Sticky", sfSymbol: "", isEmergency: false),
            WatchPhrase(id: "dw-wet", label: "Wet", sfSymbol: "", isEmergency: false),
            WatchPhrase(id: "dw-dry", label: "Dry", sfSymbol: "", isEmergency: false),
            WatchPhrase(id: "dw-clean", label: "Clean", sfSymbol: "", isEmergency: false),
            WatchPhrase(id: "dw-dirty", label: "Dirty", sfSymbol: "", isEmergency: false),
            WatchPhrase(id: "dw-soft", label: "Soft", sfSymbol: "", isEmergency: false),
            WatchPhrase(id: "dw-hard", label: "Hard", sfSymbol: "", isEmergency: false),
            WatchPhrase(id: "dw-sweet", label: "Sweet", sfSymbol: "", isEmergency: false),
            WatchPhrase(id: "dw-salty", label: "Salty", sfSymbol: "", isEmergency: false),
            WatchPhrase(id: "dw-sour", label: "Sour", sfSymbol: "", isEmergency: false),
            WatchPhrase(id: "dw-spicy", label: "Spicy", sfSymbol: "", isEmergency: false),
            WatchPhrase(id: "dw-bitter", label: "Bitter", sfSymbol: "", isEmergency: false),
            WatchPhrase(id: "dw-quiet", label: "Quiet", sfSymbol: "", isEmergency: false),
            WatchPhrase(id: "dw-loud", label: "Loud", sfSymbol: "", isEmergency: false),
            WatchPhrase(id: "dw-bright", label: "Bright", sfSymbol: "", isEmergency: false),
            WatchPhrase(id: "dw-dark", label: "Dark", sfSymbol: "", isEmergency: false),
            WatchPhrase(id: "dw-shiny", label: "Shiny", sfSymbol: "", isEmergency: false),
            WatchPhrase(id: "dw-heavy", label: "Heavy", sfSymbol: "", isEmergency: false),
            WatchPhrase(id: "dw-light", label: "Light", sfSymbol: "", isEmergency: false),
            WatchPhrase(id: "dw-empty", label: "Empty", sfSymbol: "", isEmergency: false),
            WatchPhrase(id: "dw-full", label: "Full", sfSymbol: "", isEmergency: false),
            WatchPhrase(id: "dw-easy", label: "Easy", sfSymbol: "", isEmergency: false),
            WatchPhrase(id: "dw-tricky", label: "Tricky", sfSymbol: "", isEmergency: false),
            WatchPhrase(id: "dw-simple", label: "Simple", sfSymbol: "", isEmergency: false),
            WatchPhrase(id: "dw-fun", label: "Fun", sfSymbol: "", isEmergency: false),
            WatchPhrase(id: "dw-boring", label: "Boring", sfSymbol: "", isEmergency: false),
            WatchPhrase(id: "dw-cool", label: "Cool", sfSymbol: "", isEmergency: false),
            WatchPhrase(id: "dw-awesome", label: "Awesome", sfSymbol: "", isEmergency: false),
            WatchPhrase(id: "dw-scary", label: "Scary", sfSymbol: "", isEmergency: false),
            WatchPhrase(id: "dw-safe", label: "Safe", sfSymbol: "", isEmergency: false),
            WatchPhrase(id: "dw-dangerous", label: "Dangerous", sfSymbol: "", isEmergency: false),
            WatchPhrase(id: "dw-friendly", label: "Friendly", sfSymbol: "", isEmergency: false),
            WatchPhrase(id: "dw-mean", label: "Mean", sfSymbol: "", isEmergency: false),
            WatchPhrase(id: "dw-nice", label: "Nice", sfSymbol: "", isEmergency: false),
            WatchPhrase(id: "dw-helpful", label: "Helpful", sfSymbol: "", isEmergency: false),
            WatchPhrase(id: "dw-mine", label: "Mine", sfSymbol: "", isEmergency: false),
            WatchPhrase(id: "dw-special", label: "Special", sfSymbol: "", isEmergency: false),
        ]),
        WatchCategory(id: "people-social", icon: "person.3.fill", name: "People", phrases: [
            WatchPhrase(id: "pp-mom", label: "Mom", sfSymbol: "", isEmergency: false),
            WatchPhrase(id: "pp-dad", label: "Dad", sfSymbol: "", isEmergency: false),
            WatchPhrase(id: "pp-teacher", label: "Teacher", sfSymbol: "", isEmergency: false),
            WatchPhrase(id: "pp-friend", label: "Friend", sfSymbol: "", isEmergency: false),
            WatchPhrase(id: "pp-family", label: "Family", sfSymbol: "", isEmergency: false),
            WatchPhrase(id: "pp-doctor", label: "Doctor", sfSymbol: "", isEmergency: false),
            WatchPhrase(id: "pp-brother", label: "Brother", sfSymbol: "", isEmergency: false),
            WatchPhrase(id: "pp-sister", label: "Sister", sfSymbol: "", isEmergency: false),
            WatchPhrase(id: "pp-grandma", label: "Grandma", sfSymbol: "", isEmergency: false),
            WatchPhrase(id: "pp-grandpa", label: "Grandpa", sfSymbol: "", isEmergency: false),
            WatchPhrase(id: "pp-baby", label: "Baby", sfSymbol: "", isEmergency: false),
            WatchPhrase(id: "pp-boy", label: "Boy", sfSymbol: "", isEmergency: false),
            WatchPhrase(id: "pp-girl", label: "Girl", sfSymbol: "", isEmergency: false),
            WatchPhrase(id: "pp-therapist", label: "Therapist", sfSymbol: "", isEmergency: false),
            WatchPhrase(id: "pp-aunt", label: "Aunt", sfSymbol: "", isEmergency: false),
            WatchPhrase(id: "pp-uncle", label: "Uncle", sfSymbol: "", isEmergency: false),
            WatchPhrase(id: "pp-cousin", label: "Cousin", sfSymbol: "", isEmergency: false),
            WatchPhrase(id: "pp-stepmom", label: "Stepmom", sfSymbol: "", isEmergency: false),
            WatchPhrase(id: "pp-stepdad", label: "Stepdad", sfSymbol: "", isEmergency: false),
            WatchPhrase(id: "pp-bus-driver", label: "Bus driver", sfSymbol: "", isEmergency: false),
            WatchPhrase(id: "pp-coach", label: "Coach", sfSymbol: "", isEmergency: false),
            WatchPhrase(id: "pp-principal", label: "Principal", sfSymbol: "", isEmergency: false),
            WatchPhrase(id: "pp-counselor", label: "Counselor", sfSymbol: "", isEmergency: false),
            WatchPhrase(id: "pp-nurse", label: "Nurse", sfSymbol: "", isEmergency: false),
            WatchPhrase(id: "pp-dentist", label: "Dentist", sfSymbol: "", isEmergency: false),
            WatchPhrase(id: "pp-bcba", label: "BCBA", sfSymbol: "", isEmergency: false),
            WatchPhrase(id: "pp-rbt", label: "RBT", sfSymbol: "", isEmergency: false),
            WatchPhrase(id: "pp-babysitter", label: "Babysitter", sfSymbol: "", isEmergency: false),
            WatchPhrase(id: "pp-neighbor", label: "Neighbor", sfSymbol: "", isEmergency: false),
            WatchPhrase(id: "pp-helper", label: "Helper", sfSymbol: "", isEmergency: false),
            WatchPhrase(id: "pp-classmate", label: "Classmate", sfSymbol: "", isEmergency: false),
            WatchPhrase(id: "pp-best-friend", label: "Best friend", sfSymbol: "", isEmergency: false),
            WatchPhrase(id: "pp-new-friend", label: "New friend", sfSymbol: "", isEmergency: false),
            WatchPhrase(id: "pp-man", label: "Man", sfSymbol: "", isEmergency: false),
            WatchPhrase(id: "pp-woman", label: "Woman", sfSymbol: "", isEmergency: false),
            WatchPhrase(id: "pp-kid", label: "Kid", sfSymbol: "", isEmergency: false),
            WatchPhrase(id: "pp-grown-up", label: "Grown-up", sfSymbol: "", isEmergency: false),
            WatchPhrase(id: "pp-stranger", label: "Stranger", sfSymbol: "", isEmergency: false),
            WatchPhrase(id: "pp-police-officer", label: "Police officer", sfSymbol: "", isEmergency: false),
            WatchPhrase(id: "pp-firefighter", label: "Firefighter", sfSymbol: "", isEmergency: false),
            WatchPhrase(id: "pp-paramedic", label: "Paramedic", sfSymbol: "", isEmergency: false),
            WatchPhrase(id: "pp-my-family", label: "My family", sfSymbol: "", isEmergency: false),
            WatchPhrase(id: "pp-my-class", label: "My class", sfSymbol: "", isEmergency: false),
            WatchPhrase(id: "pp-my-team", label: "My team", sfSymbol: "", isEmergency: false),
            WatchPhrase(id: "pc-librarian", label: "Librarian", sfSymbol: "", isEmergency: false),
        ]),
        WatchCategory(id: "food-ordering", icon: "fork.knife", name: "Food & Drink", phrases: [
            WatchPhrase(id: "fd-water", label: "Water", sfSymbol: "", isEmergency: false),
            WatchPhrase(id: "fd-juice", label: "Juice", sfSymbol: "", isEmergency: false),
            WatchPhrase(id: "fd-milk", label: "Milk", sfSymbol: "", isEmergency: false),
            WatchPhrase(id: "fd-pizza", label: "Pizza", sfSymbol: "", isEmergency: false),
            WatchPhrase(id: "fd-sandwich", label: "Sandwich", sfSymbol: "", isEmergency: false),
            WatchPhrase(id: "fd-chicken", label: "Chicken", sfSymbol: "", isEmergency: false),
            WatchPhrase(id: "fd-fries", label: "Fries", sfSymbol: "", isEmergency: false),
            WatchPhrase(id: "fd-fruit", label: "Fruit", sfSymbol: "", isEmergency: false),
            WatchPhrase(id: "fd-snack", label: "Snack", sfSymbol: "", isEmergency: false),
            WatchPhrase(id: "fd-more", label: "More please", sfSymbol: "", isEmergency: false),
            WatchPhrase(id: "fd-no-thanks", label: "No thanks", sfSymbol: "", isEmergency: false),
            WatchPhrase(id: "fd-cookie", label: "Cookie", sfSymbol: "", isEmergency: false),
            WatchPhrase(id: "fd-apple", label: "Apple", sfSymbol: "", isEmergency: false),
            WatchPhrase(id: "fd-banana", label: "Banana", sfSymbol: "", isEmergency: false),
            WatchPhrase(id: "fd-cereal", label: "Cereal", sfSymbol: "", isEmergency: false),
            WatchPhrase(id: "fd-cheese", label: "Cheese", sfSymbol: "", isEmergency: false),
            WatchPhrase(id: "fd-ice-cream", label: "Ice cream", sfSymbol: "", isEmergency: false),
            WatchPhrase(id: "fd-crackers", label: "Crackers", sfSymbol: "", isEmergency: false),
            WatchPhrase(id: "fd-bread", label: "Bread", sfSymbol: "", isEmergency: false),
            WatchPhrase(id: "fd-toast", label: "Toast", sfSymbol: "", isEmergency: false),
            WatchPhrase(id: "fd-pancakes", label: "Pancakes", sfSymbol: "", isEmergency: false),
            WatchPhrase(id: "fd-waffles", label: "Waffles", sfSymbol: "", isEmergency: false),
            WatchPhrase(id: "fd-eggs", label: "Eggs", sfSymbol: "", isEmergency: false),
            WatchPhrase(id: "fd-bacon", label: "Bacon", sfSymbol: "", isEmergency: false),
            WatchPhrase(id: "fd-yogurt", label: "Yogurt", sfSymbol: "", isEmergency: false),
            WatchPhrase(id: "fd-oatmeal", label: "Oatmeal", sfSymbol: "", isEmergency: false),
            WatchPhrase(id: "fd-granola", label: "Granola", sfSymbol: "", isEmergency: false),
            WatchPhrase(id: "fd-smoothie", label: "Smoothie", sfSymbol: "", isEmergency: false),
            WatchPhrase(id: "fd-pasta", label: "Pasta", sfSymbol: "", isEmergency: false),
            WatchPhrase(id: "fd-noodles", label: "Noodles", sfSymbol: "", isEmergency: false),
            WatchPhrase(id: "fd-rice", label: "Rice", sfSymbol: "", isEmergency: false),
            WatchPhrase(id: "fd-soup", label: "Soup", sfSymbol: "", isEmergency: false),
            WatchPhrase(id: "fd-salad", label: "Salad", sfSymbol: "", isEmergency: false),
            WatchPhrase(id: "fd-wrap", label: "Wrap", sfSymbol: "", isEmergency: false),
            WatchPhrase(id: "fd-hamburger", label: "Hamburger", sfSymbol: "", isEmergency: false),
            WatchPhrase(id: "fd-hot-dog", label: "Hot dog", sfSymbol: "", isEmergency: false),
            WatchPhrase(id: "fd-taco", label: "Taco", sfSymbol: "", isEmergency: false),
            WatchPhrase(id: "fd-burrito", label: "Burrito", sfSymbol: "", isEmergency: false),
            WatchPhrase(id: "fd-quesadilla", label: "Quesadilla", sfSymbol: "", isEmergency: false),
            WatchPhrase(id: "fd-sushi", label: "Sushi", sfSymbol: "", isEmergency: false),
            WatchPhrase(id: "fd-dumplings", label: "Dumplings", sfSymbol: "", isEmergency: false),
            WatchPhrase(id: "fd-curry", label: "Curry", sfSymbol: "", isEmergency: false),
            WatchPhrase(id: "fd-stir-fry", label: "Stir fry", sfSymbol: "", isEmergency: false),
            WatchPhrase(id: "fd-carrots", label: "Carrots", sfSymbol: "", isEmergency: false),
            WatchPhrase(id: "fd-broccoli", label: "Broccoli", sfSymbol: "", isEmergency: false),
            WatchPhrase(id: "fd-peas", label: "Peas", sfSymbol: "", isEmergency: false),
            WatchPhrase(id: "fd-corn", label: "Corn", sfSymbol: "", isEmergency: false),
            WatchPhrase(id: "fd-tomato", label: "Tomato", sfSymbol: "", isEmergency: false),
            WatchPhrase(id: "fd-cucumber", label: "Cucumber", sfSymbol: "", isEmergency: false),
            WatchPhrase(id: "fd-lettuce", label: "Lettuce", sfSymbol: "", isEmergency: false),
            WatchPhrase(id: "fd-spinach", label: "Spinach", sfSymbol: "", isEmergency: false),
            WatchPhrase(id: "fd-potato", label: "Potato", sfSymbol: "", isEmergency: false),
            WatchPhrase(id: "fd-sweet-potato", label: "Sweet potato", sfSymbol: "", isEmergency: false),
            WatchPhrase(id: "fd-strawberry", label: "Strawberry", sfSymbol: "", isEmergency: false),
            WatchPhrase(id: "fd-blueberry", label: "Blueberry", sfSymbol: "", isEmergency: false),
            WatchPhrase(id: "fd-grapes", label: "Grapes", sfSymbol: "", isEmergency: false),
            WatchPhrase(id: "fd-watermelon", label: "Watermelon", sfSymbol: "", isEmergency: false),
            WatchPhrase(id: "fd-orange", label: "Orange", sfSymbol: "", isEmergency: false),
            WatchPhrase(id: "fd-pear", label: "Pear", sfSymbol: "", isEmergency: false),
            WatchPhrase(id: "fd-peach", label: "Peach", sfSymbol: "", isEmergency: false),
            WatchPhrase(id: "fd-mango", label: "Mango", sfSymbol: "", isEmergency: false),
            WatchPhrase(id: "fd-pineapple", label: "Pineapple", sfSymbol: "", isEmergency: false),
            WatchPhrase(id: "fd-cake", label: "Cake", sfSymbol: "", isEmergency: false),
            WatchPhrase(id: "fd-cupcake", label: "Cupcake", sfSymbol: "", isEmergency: false),
            WatchPhrase(id: "fd-brownie", label: "Brownie", sfSymbol: "", isEmergency: false),
            WatchPhrase(id: "fd-donut", label: "Donut", sfSymbol: "", isEmergency: false),
            WatchPhrase(id: "fd-muffin", label: "Muffin", sfSymbol: "", isEmergency: false),
            WatchPhrase(id: "fd-pie", label: "Pie", sfSymbol: "", isEmergency: false),
            WatchPhrase(id: "fd-pudding", label: "Pudding", sfSymbol: "", isEmergency: false),
            WatchPhrase(id: "fd-jello", label: "Jello", sfSymbol: "", isEmergency: false),
            WatchPhrase(id: "fd-candy", label: "Candy", sfSymbol: "", isEmergency: false),
            WatchPhrase(id: "fd-chocolate", label: "Chocolate", sfSymbol: "", isEmergency: false),
            WatchPhrase(id: "fd-lollipop", label: "Lollipop", sfSymbol: "", isEmergency: false),
            WatchPhrase(id: "fd-gum", label: "Gum", sfSymbol: "", isEmergency: false),
            WatchPhrase(id: "fd-soda", label: "Soda", sfSymbol: "", isEmergency: false),
            WatchPhrase(id: "fd-tea", label: "Tea", sfSymbol: "", isEmergency: false),
            WatchPhrase(id: "fd-hot-chocolate", label: "Hot chocolate", sfSymbol: "", isEmergency: false),
            WatchPhrase(id: "fd-lemonade", label: "Lemonade", sfSymbol: "", isEmergency: false),
            WatchPhrase(id: "fd-spoon", label: "Spoon", sfSymbol: "", isEmergency: false),
            WatchPhrase(id: "fd-fork", label: "Fork", sfSymbol: "", isEmergency: false),
            WatchPhrase(id: "fd-knife", label: "Knife", sfSymbol: "", isEmergency: false),
            WatchPhrase(id: "fd-plate", label: "Plate", sfSymbol: "", isEmergency: false),
            WatchPhrase(id: "fd-bowl", label: "Bowl", sfSymbol: "", isEmergency: false),
            WatchPhrase(id: "fd-cup", label: "Cup", sfSymbol: "", isEmergency: false),
            WatchPhrase(id: "fd-straw", label: "Straw", sfSymbol: "", isEmergency: false),
            WatchPhrase(id: "fd-napkin", label: "Napkin", sfSymbol: "", isEmergency: false),
            WatchPhrase(id: "fd-bib", label: "Bib", sfSymbol: "", isEmergency: false),
            WatchPhrase(id: "fd-open-it-please", label: "Open it please", sfSymbol: "", isEmergency: false),
            WatchPhrase(id: "fd-cut-it-up-please", label: "Cut it up please", sfSymbol: "", isEmergency: false),
            WatchPhrase(id: "fd-not-too-hot", label: "Not too hot", sfSymbol: "", isEmergency: false),
            WatchPhrase(id: "fd-i-am-allergic", label: "I am allergic", sfSymbol: "", isEmergency: false),
            WatchPhrase(id: "fm-breakfast", label: "Breakfast", sfSymbol: "", isEmergency: false),
            WatchPhrase(id: "fm-hamburger", label: "Hamburger", sfSymbol: "", isEmergency: false),
            WatchPhrase(id: "ff-strawberry", label: "Strawberry", sfSymbol: "", isEmergency: false),
            WatchPhrase(id: "ff-watermelon", label: "Watermelon", sfSymbol: "", isEmergency: false),
            WatchPhrase(id: "fv-broccoli", label: "Broccoli", sfSymbol: "", isEmergency: false),
            WatchPhrase(id: "fv-cucumber", label: "Cucumber", sfSymbol: "", isEmergency: false),
            WatchPhrase(id: "fd-lemonade-2", label: "Lemonade", sfSymbol: "", isEmergency: false),
            WatchPhrase(id: "fd-smoothie-2", label: "Smoothie", sfSymbol: "", isEmergency: false),
            WatchPhrase(id: "fs-crackers", label: "Crackers", sfSymbol: "", isEmergency: false),
            WatchPhrase(id: "fs-pretzels", label: "Pretzels", sfSymbol: "", isEmergency: false),
        ]),
        WatchCategory(id: "places-plans", icon: "mappin.and.ellipse", name: "Places", phrases: [
            WatchPhrase(id: "pl-home", label: "Home", sfSymbol: "", isEmergency: false),
            WatchPhrase(id: "pl-school", label: "School", sfSymbol: "", isEmergency: false),
            WatchPhrase(id: "pl-park", label: "Park", sfSymbol: "", isEmergency: false),
            WatchPhrase(id: "pl-store", label: "Store", sfSymbol: "", isEmergency: false),
            WatchPhrase(id: "pl-restaurant", label: "Restaurant", sfSymbol: "", isEmergency: false),
            WatchPhrase(id: "pl-library", label: "Library", sfSymbol: "", isEmergency: false),
            WatchPhrase(id: "pl-pool", label: "Pool", sfSymbol: "", isEmergency: false),
            WatchPhrase(id: "pl-car", label: "Car", sfSymbol: "", isEmergency: false),
            WatchPhrase(id: "pl-outside", label: "Outside", sfSymbol: "", isEmergency: false),
            WatchPhrase(id: "pl-inside", label: "Inside", sfSymbol: "", isEmergency: false),
            WatchPhrase(id: "pl-bathroom", label: "Bathroom", sfSymbol: "", isEmergency: false),
            WatchPhrase(id: "pl-bedroom", label: "Bedroom", sfSymbol: "", isEmergency: false),
            WatchPhrase(id: "pl-kitchen", label: "Kitchen", sfSymbol: "", isEmergency: false),
            WatchPhrase(id: "pl-playground", label: "Playground", sfSymbol: "", isEmergency: false),
            WatchPhrase(id: "pl-backyard", label: "Backyard", sfSymbol: "", isEmergency: false),
            WatchPhrase(id: "pl-front-yard", label: "Front yard", sfSymbol: "", isEmergency: false),
            WatchPhrase(id: "pl-garden", label: "Garden", sfSymbol: "", isEmergency: false),
            WatchPhrase(id: "pl-driveway", label: "Driveway", sfSymbol: "", isEmergency: false),
            WatchPhrase(id: "pl-living-room", label: "Living room", sfSymbol: "", isEmergency: false),
            WatchPhrase(id: "pl-dining-room", label: "Dining room", sfSymbol: "", isEmergency: false),
            WatchPhrase(id: "pl-garage", label: "Garage", sfSymbol: "", isEmergency: false),
            WatchPhrase(id: "pl-basement", label: "Basement", sfSymbol: "", isEmergency: false),
            WatchPhrase(id: "pl-attic", label: "Attic", sfSymbol: "", isEmergency: false),
            WatchPhrase(id: "pl-hospital", label: "Hospital", sfSymbol: "", isEmergency: false),
            WatchPhrase(id: "pl-doctor-office", label: "Doctor office", sfSymbol: "", isEmergency: false),
            WatchPhrase(id: "pl-dentist-office", label: "Dentist office", sfSymbol: "", isEmergency: false),
            WatchPhrase(id: "pl-pharmacy", label: "Pharmacy", sfSymbol: "", isEmergency: false),
            WatchPhrase(id: "pl-grocery-store", label: "Grocery store", sfSymbol: "", isEmergency: false),
            WatchPhrase(id: "pl-mall", label: "Mall", sfSymbol: "", isEmergency: false),
            WatchPhrase(id: "pl-pet-store", label: "Pet store", sfSymbol: "", isEmergency: false),
            WatchPhrase(id: "pl-toy-store", label: "Toy store", sfSymbol: "", isEmergency: false),
            WatchPhrase(id: "pl-movie-theater", label: "Movie theater", sfSymbol: "", isEmergency: false),
            WatchPhrase(id: "pl-bowling-alley", label: "Bowling alley", sfSymbol: "", isEmergency: false),
            WatchPhrase(id: "pl-arcade", label: "Arcade", sfSymbol: "", isEmergency: false),
            WatchPhrase(id: "pl-beach", label: "Beach", sfSymbol: "", isEmergency: false),
            WatchPhrase(id: "pl-lake", label: "Lake", sfSymbol: "", isEmergency: false),
            WatchPhrase(id: "pl-mountain", label: "Mountain", sfSymbol: "", isEmergency: false),
            WatchPhrase(id: "pl-forest", label: "Forest", sfSymbol: "", isEmergency: false),
            WatchPhrase(id: "pl-camp", label: "Camp", sfSymbol: "", isEmergency: false),
            WatchPhrase(id: "pl-zoo", label: "Zoo", sfSymbol: "", isEmergency: false),
            WatchPhrase(id: "pl-aquarium", label: "Aquarium", sfSymbol: "", isEmergency: false),
            WatchPhrase(id: "pl-museum", label: "Museum", sfSymbol: "", isEmergency: false),
            WatchPhrase(id: "pl-farm", label: "Farm", sfSymbol: "", isEmergency: false),
            WatchPhrase(id: "pl-church", label: "Church", sfSymbol: "", isEmergency: false),
            WatchPhrase(id: "pl-temple", label: "Temple", sfSymbol: "", isEmergency: false),
            WatchPhrase(id: "pl-mosque", label: "Mosque", sfSymbol: "", isEmergency: false),
            WatchPhrase(id: "pl-synagogue", label: "Synagogue", sfSymbol: "", isEmergency: false),
            WatchPhrase(id: "pl-bus-stop", label: "Bus stop", sfSymbol: "", isEmergency: false),
            WatchPhrase(id: "pl-train-station", label: "Train station", sfSymbol: "", isEmergency: false),
            WatchPhrase(id: "pl-airport", label: "Airport", sfSymbol: "", isEmergency: false),
            WatchPhrase(id: "pls-classroom", label: "Classroom", sfSymbol: "", isEmergency: false),
            WatchPhrase(id: "pls-lunchroom", label: "Lunchroom", sfSymbol: "", isEmergency: false),
            WatchPhrase(id: "plh-bathroom", label: "Bathroom", sfSymbol: "", isEmergency: false),
            WatchPhrase(id: "plh-backyard", label: "Backyard", sfSymbol: "", isEmergency: false),
            WatchPhrase(id: "plh-basement", label: "Basement", sfSymbol: "", isEmergency: false),
            WatchPhrase(id: "plo-playground", label: "Playground", sfSymbol: "", isEmergency: false),
            WatchPhrase(id: "plst-pharmacy", label: "Pharmacy", sfSymbol: "", isEmergency: false),
        ]),
        WatchCategory(id: "school-work", icon: "book.fill", name: "School / Work", phrases: [
            WatchPhrase(id: "sw-class", label: "Class", sfSymbol: "", isEmergency: false),
            WatchPhrase(id: "sw-homework", label: "Homework", sfSymbol: "", isEmergency: false),
            WatchPhrase(id: "sw-computer", label: "Computer", sfSymbol: "", isEmergency: false),
            WatchPhrase(id: "sw-book", label: "Book", sfSymbol: "", isEmergency: false),
            WatchPhrase(id: "sw-pencil", label: "Pencil", sfSymbol: "", isEmergency: false),
            WatchPhrase(id: "sw-question", label: "I have a question", sfSymbol: "", isEmergency: false),
            WatchPhrase(id: "sw-help", label: "I need help with this", sfSymbol: "", isEmergency: false),
            WatchPhrase(id: "sw-paper", label: "Paper", sfSymbol: "", isEmergency: false),
            WatchPhrase(id: "sw-table", label: "Table", sfSymbol: "", isEmergency: false),
            WatchPhrase(id: "sw-chair", label: "Chair", sfSymbol: "", isEmergency: false),
            WatchPhrase(id: "sw-art", label: "Art", sfSymbol: "", isEmergency: false),
            WatchPhrase(id: "sw-music", label: "Music", sfSymbol: "", isEmergency: false),
            WatchPhrase(id: "sw-recess", label: "Recess", sfSymbol: "", isEmergency: false),
            WatchPhrase(id: "sw-backpack", label: "Backpack", sfSymbol: "", isEmergency: false),
            WatchPhrase(id: "sw-lunchbox", label: "Lunchbox", sfSymbol: "", isEmergency: false),
            WatchPhrase(id: "sw-folder", label: "Folder", sfSymbol: "", isEmergency: false),
            WatchPhrase(id: "sw-notebook", label: "Notebook", sfSymbol: "", isEmergency: false),
            WatchPhrase(id: "sw-crayons", label: "Crayons", sfSymbol: "", isEmergency: false),
            WatchPhrase(id: "sw-markers", label: "Markers", sfSymbol: "", isEmergency: false),
            WatchPhrase(id: "sw-scissors", label: "Scissors", sfSymbol: "", isEmergency: false),
            WatchPhrase(id: "sw-glue", label: "Glue", sfSymbol: "", isEmergency: false),
            WatchPhrase(id: "sw-tape", label: "Tape", sfSymbol: "", isEmergency: false),
            WatchPhrase(id: "sw-eraser", label: "Eraser", sfSymbol: "", isEmergency: false),
            WatchPhrase(id: "sw-ruler", label: "Ruler", sfSymbol: "", isEmergency: false),
            WatchPhrase(id: "sw-whiteboard", label: "Whiteboard", sfSymbol: "", isEmergency: false),
            WatchPhrase(id: "sw-smart-board", label: "Smart board", sfSymbol: "", isEmergency: false),
            WatchPhrase(id: "sw-projector", label: "Projector", sfSymbol: "", isEmergency: false),
            WatchPhrase(id: "sw-math", label: "Math", sfSymbol: "", isEmergency: false),
            WatchPhrase(id: "sw-reading", label: "Reading", sfSymbol: "", isEmergency: false),
            WatchPhrase(id: "sw-writing", label: "Writing", sfSymbol: "", isEmergency: false),
            WatchPhrase(id: "sw-spelling", label: "Spelling", sfSymbol: "", isEmergency: false),
            WatchPhrase(id: "sw-science", label: "Science", sfSymbol: "", isEmergency: false),
            WatchPhrase(id: "sw-social-studies", label: "Social studies", sfSymbol: "", isEmergency: false),
            WatchPhrase(id: "sw-history", label: "History", sfSymbol: "", isEmergency: false),
            WatchPhrase(id: "sw-pe", label: "PE", sfSymbol: "", isEmergency: false),
            WatchPhrase(id: "sw-gym", label: "Gym", sfSymbol: "", isEmergency: false),
            WatchPhrase(id: "sw-recess-time", label: "Recess time", sfSymbol: "", isEmergency: false),
            WatchPhrase(id: "sw-library-time", label: "Library time", sfSymbol: "", isEmergency: false),
            WatchPhrase(id: "sw-story-time", label: "Story time", sfSymbol: "", isEmergency: false),
            WatchPhrase(id: "sw-circle-time", label: "Circle time", sfSymbol: "", isEmergency: false),
            WatchPhrase(id: "sw-lunch-time", label: "Lunch time", sfSymbol: "", isEmergency: false),
            WatchPhrase(id: "sw-snack-time", label: "Snack time", sfSymbol: "", isEmergency: false),
            WatchPhrase(id: "sw-worksheet", label: "Worksheet", sfSymbol: "", isEmergency: false),
            WatchPhrase(id: "sw-quiz", label: "Quiz", sfSymbol: "", isEmergency: false),
            WatchPhrase(id: "sw-test", label: "Test", sfSymbol: "", isEmergency: false),
            WatchPhrase(id: "sw-project", label: "Project", sfSymbol: "", isEmergency: false),
            WatchPhrase(id: "sw-field-trip", label: "Field trip", sfSymbol: "", isEmergency: false),
            WatchPhrase(id: "sw-assembly", label: "Assembly", sfSymbol: "", isEmergency: false),
            WatchPhrase(id: "sw-bus-ride", label: "Bus ride", sfSymbol: "", isEmergency: false),
        ]),
        WatchCategory(id: "health-body", icon: "cross.case.fill", name: "Health / Body", phrases: [
            WatchPhrase(id: "hb-head", label: "Head", sfSymbol: "", isEmergency: false),
            WatchPhrase(id: "hb-tummy", label: "Tummy", sfSymbol: "", isEmergency: false),
            WatchPhrase(id: "hb-hand", label: "Hand", sfSymbol: "", isEmergency: false),
            WatchPhrase(id: "hb-foot", label: "Foot", sfSymbol: "", isEmergency: false),
            WatchPhrase(id: "hb-eye", label: "Eye", sfSymbol: "", isEmergency: false),
            WatchPhrase(id: "hb-ear", label: "Ear", sfSymbol: "", isEmergency: false),
            WatchPhrase(id: "hb-mouth", label: "Mouth", sfSymbol: "", isEmergency: false),
            WatchPhrase(id: "hb-nose", label: "Nose", sfSymbol: "", isEmergency: false),
            WatchPhrase(id: "hb-hurts", label: "It hurts", sfSymbol: "", isEmergency: false),
            WatchPhrase(id: "hb-sick", label: "I feel sick", sfSymbol: "", isEmergency: false),
            WatchPhrase(id: "hb-medicine", label: "Medicine", sfSymbol: "", isEmergency: false),
            WatchPhrase(id: "hb-teeth", label: "Teeth", sfSymbol: "", isEmergency: false),
            WatchPhrase(id: "hb-back", label: "Back", sfSymbol: "", isEmergency: false),
            WatchPhrase(id: "hb-arm", label: "Arm", sfSymbol: "", isEmergency: false),
            WatchPhrase(id: "hb-hair", label: "Hair", sfSymbol: "", isEmergency: false),
            WatchPhrase(id: "hb-face", label: "Face", sfSymbol: "", isEmergency: false),
            WatchPhrase(id: "hb-forehead", label: "Forehead", sfSymbol: "", isEmergency: false),
            WatchPhrase(id: "hb-cheek", label: "Cheek", sfSymbol: "", isEmergency: false),
            WatchPhrase(id: "hb-chin", label: "Chin", sfSymbol: "", isEmergency: false),
            WatchPhrase(id: "hb-lips", label: "Lips", sfSymbol: "", isEmergency: false),
            WatchPhrase(id: "hb-tongue", label: "Tongue", sfSymbol: "", isEmergency: false),
            WatchPhrase(id: "hb-throat", label: "Throat", sfSymbol: "", isEmergency: false),
            WatchPhrase(id: "hb-neck", label: "Neck", sfSymbol: "", isEmergency: false),
            WatchPhrase(id: "hb-shoulder", label: "Shoulder", sfSymbol: "", isEmergency: false),
            WatchPhrase(id: "hb-elbow", label: "Elbow", sfSymbol: "", isEmergency: false),
            WatchPhrase(id: "hb-wrist", label: "Wrist", sfSymbol: "", isEmergency: false),
            WatchPhrase(id: "hb-finger", label: "Finger", sfSymbol: "", isEmergency: false),
            WatchPhrase(id: "hb-thumb", label: "Thumb", sfSymbol: "", isEmergency: false),
            WatchPhrase(id: "hb-knuckle", label: "Knuckle", sfSymbol: "", isEmergency: false),
            WatchPhrase(id: "hb-knee", label: "Knee", sfSymbol: "", isEmergency: false),
            WatchPhrase(id: "hb-ankle", label: "Ankle", sfSymbol: "", isEmergency: false),
            WatchPhrase(id: "hb-toe", label: "Toe", sfSymbol: "", isEmergency: false),
            WatchPhrase(id: "hb-heel", label: "Heel", sfSymbol: "", isEmergency: false),
            WatchPhrase(id: "hb-chest", label: "Chest", sfSymbol: "", isEmergency: false),
            WatchPhrase(id: "hb-belly", label: "Belly", sfSymbol: "", isEmergency: false),
            WatchPhrase(id: "hb-hip", label: "Hip", sfSymbol: "", isEmergency: false),
            WatchPhrase(id: "hb-bottom", label: "Bottom", sfSymbol: "", isEmergency: false),
            WatchPhrase(id: "hb-skin", label: "Skin", sfSymbol: "", isEmergency: false),
            WatchPhrase(id: "hb-bone", label: "Bone", sfSymbol: "", isEmergency: false),
            WatchPhrase(id: "hb-muscle", label: "Muscle", sfSymbol: "", isEmergency: false),
            WatchPhrase(id: "hb-headache", label: "Headache", sfSymbol: "", isEmergency: false),
            WatchPhrase(id: "hb-stomachache", label: "Stomachache", sfSymbol: "", isEmergency: false),
            WatchPhrase(id: "hb-earache", label: "Earache", sfSymbol: "", isEmergency: false),
            WatchPhrase(id: "hb-toothache", label: "Toothache", sfSymbol: "", isEmergency: false),
            WatchPhrase(id: "hb-sore-throat", label: "Sore throat", sfSymbol: "", isEmergency: false),
            WatchPhrase(id: "hb-cough", label: "Cough", sfSymbol: "", isEmergency: false),
            WatchPhrase(id: "hb-sneeze", label: "Sneeze", sfSymbol: "", isEmergency: false),
            WatchPhrase(id: "hb-runny-nose", label: "Runny nose", sfSymbol: "", isEmergency: false),
            WatchPhrase(id: "hb-stuffy-nose", label: "Stuffy nose", sfSymbol: "", isEmergency: false),
            WatchPhrase(id: "hb-fever", label: "Fever", sfSymbol: "", isEmergency: false),
            WatchPhrase(id: "hb-chills", label: "Chills", sfSymbol: "", isEmergency: false),
            WatchPhrase(id: "hb-shaking", label: "Shaking", sfSymbol: "", isEmergency: false),
            WatchPhrase(id: "hb-dizzy-spell", label: "Dizzy spell", sfSymbol: "", isEmergency: false),
            WatchPhrase(id: "hb-bruise", label: "Bruise", sfSymbol: "", isEmergency: false),
            WatchPhrase(id: "hb-cut", label: "Cut", sfSymbol: "", isEmergency: false),
            WatchPhrase(id: "hb-scrape", label: "Scrape", sfSymbol: "", isEmergency: false),
            WatchPhrase(id: "hb-bump", label: "Bump", sfSymbol: "", isEmergency: false),
            WatchPhrase(id: "hb-bandage", label: "Bandage", sfSymbol: "", isEmergency: false),
            WatchPhrase(id: "hb-itchy-spot", label: "Itchy spot", sfSymbol: "", isEmergency: false),
            WatchPhrase(id: "hb-rash", label: "Rash", sfSymbol: "", isEmergency: false),
            WatchPhrase(id: "hb-allergic-reaction", label: "Allergic reaction", sfSymbol: "", isEmergency: false),
            WatchPhrase(id: "hb-pain", label: "Pain", sfSymbol: "", isEmergency: false),
            WatchPhrase(id: "hb-sharp-pain", label: "Sharp pain", sfSymbol: "", isEmergency: false),
            WatchPhrase(id: "hb-dull-pain", label: "Dull pain", sfSymbol: "", isEmergency: false),
            WatchPhrase(id: "hb-burning", label: "Burning", sfSymbol: "", isEmergency: false),
            WatchPhrase(id: "hb-vitamins", label: "Vitamins", sfSymbol: "", isEmergency: false),
            WatchPhrase(id: "hb-inhaler", label: "Inhaler", sfSymbol: "", isEmergency: false),
            WatchPhrase(id: "hb-epipen", label: "EpiPen", sfSymbol: "", isEmergency: false),
            WatchPhrase(id: "hb-pill", label: "Pill", sfSymbol: "", isEmergency: false),
            WatchPhrase(id: "hb-drops", label: "Drops", sfSymbol: "", isEmergency: false),
            WatchPhrase(id: "hb-doctor-visit", label: "Doctor visit", sfSymbol: "", isEmergency: false),
            WatchPhrase(id: "hb-shot", label: "Shot", sfSymbol: "", isEmergency: false),
            WatchPhrase(id: "hb-x-ray", label: "X-ray", sfSymbol: "", isEmergency: false),
            WatchPhrase(id: "hb-check-up", label: "Check-up", sfSymbol: "", isEmergency: false),
            WatchPhrase(id: "hb-wash-my-hands", label: "Wash my hands", sfSymbol: "", isEmergency: false),
            WatchPhrase(id: "hb-brush-my-teeth", label: "Brush my teeth", sfSymbol: "", isEmergency: false),
            WatchPhrase(id: "hr-wash-hands", label: "Wash hands", sfSymbol: "", isEmergency: false),
        ]),
        WatchCategory(id: "time", icon: "clock.fill", name: "Time", phrases: [
            WatchPhrase(id: "ti-now", label: "Now", sfSymbol: "", isEmergency: false),
            WatchPhrase(id: "ti-later", label: "Later", sfSymbol: "", isEmergency: false),
            WatchPhrase(id: "ti-today", label: "Today", sfSymbol: "", isEmergency: false),
            WatchPhrase(id: "ti-tomorrow", label: "Tomorrow", sfSymbol: "", isEmergency: false),
            WatchPhrase(id: "ti-yesterday", label: "Yesterday", sfSymbol: "", isEmergency: false),
            WatchPhrase(id: "ti-morning", label: "Morning", sfSymbol: "", isEmergency: false),
            WatchPhrase(id: "ti-afternoon", label: "Afternoon", sfSymbol: "", isEmergency: false),
            WatchPhrase(id: "ti-night", label: "Night", sfSymbol: "", isEmergency: false),
            WatchPhrase(id: "ti-before", label: "Before", sfSymbol: "", isEmergency: false),
            WatchPhrase(id: "ti-after", label: "After", sfSymbol: "", isEmergency: false),
            WatchPhrase(id: "ti-first", label: "First", sfSymbol: "", isEmergency: false),
            WatchPhrase(id: "ti-last", label: "Last", sfSymbol: "", isEmergency: false),
            WatchPhrase(id: "ti-right-now", label: "Right now", sfSymbol: "", isEmergency: false),
            WatchPhrase(id: "ti-in-a-minute", label: "In a minute", sfSymbol: "", isEmergency: false),
            WatchPhrase(id: "ti-soon", label: "Soon", sfSymbol: "", isEmergency: false),
            WatchPhrase(id: "ti-later-today", label: "Later today", sfSymbol: "", isEmergency: false),
            WatchPhrase(id: "ti-tonight", label: "Tonight", sfSymbol: "", isEmergency: false),
            WatchPhrase(id: "ti-this-morning", label: "This morning", sfSymbol: "", isEmergency: false),
            WatchPhrase(id: "ti-this-afternoon", label: "This afternoon", sfSymbol: "", isEmergency: false),
            WatchPhrase(id: "ti-this-evening", label: "This evening", sfSymbol: "", isEmergency: false),
            WatchPhrase(id: "ti-last-night", label: "Last night", sfSymbol: "", isEmergency: false),
            WatchPhrase(id: "ti-all-day", label: "All day", sfSymbol: "", isEmergency: false),
            WatchPhrase(id: "ti-all-night", label: "All night", sfSymbol: "", isEmergency: false),
            WatchPhrase(id: "ti-a-long-time", label: "A long time", sfSymbol: "", isEmergency: false),
            WatchPhrase(id: "ti-a-short-time", label: "A short time", sfSymbol: "", isEmergency: false),
            WatchPhrase(id: "ti-a-while-ago", label: "A while ago", sfSymbol: "", isEmergency: false),
            WatchPhrase(id: "ti-weekend", label: "Weekend", sfSymbol: "", isEmergency: false),
            WatchPhrase(id: "ti-weekday", label: "Weekday", sfSymbol: "", isEmergency: false),
            WatchPhrase(id: "ti-monday", label: "Monday", sfSymbol: "", isEmergency: false),
            WatchPhrase(id: "ti-tuesday", label: "Tuesday", sfSymbol: "", isEmergency: false),
            WatchPhrase(id: "ti-wednesday", label: "Wednesday", sfSymbol: "", isEmergency: false),
            WatchPhrase(id: "ti-thursday", label: "Thursday", sfSymbol: "", isEmergency: false),
            WatchPhrase(id: "ti-friday", label: "Friday", sfSymbol: "", isEmergency: false),
            WatchPhrase(id: "ti-saturday", label: "Saturday", sfSymbol: "", isEmergency: false),
            WatchPhrase(id: "ti-sunday", label: "Sunday", sfSymbol: "", isEmergency: false),
            WatchPhrase(id: "ti-birthday", label: "Birthday", sfSymbol: "", isEmergency: false),
            WatchPhrase(id: "ti-holiday", label: "Holiday", sfSymbol: "", isEmergency: false),
            WatchPhrase(id: "td-wednesday", label: "Wednesday", sfSymbol: "", isEmergency: false),
            WatchPhrase(id: "td-yesterday", label: "Yesterday", sfSymbol: "", isEmergency: false),
            WatchPhrase(id: "tm-jan", label: "January", sfSymbol: "", isEmergency: false),
            WatchPhrase(id: "tm-feb", label: "February", sfSymbol: "", isEmergency: false),
            WatchPhrase(id: "tm-mar", label: "March", sfSymbol: "", isEmergency: false),
            WatchPhrase(id: "tm-apr", label: "April", sfSymbol: "", isEmergency: false),
            WatchPhrase(id: "tm-may", label: "May", sfSymbol: "", isEmergency: false),
            WatchPhrase(id: "tm-jun", label: "June", sfSymbol: "", isEmergency: false),
            WatchPhrase(id: "tm-jul", label: "July", sfSymbol: "", isEmergency: false),
            WatchPhrase(id: "tm-aug", label: "August", sfSymbol: "", isEmergency: false),
            WatchPhrase(id: "tm-sep", label: "September", sfSymbol: "", isEmergency: false),
            WatchPhrase(id: "tm-oct", label: "October", sfSymbol: "", isEmergency: false),
            WatchPhrase(id: "tm-nov", label: "November", sfSymbol: "", isEmergency: false),
            WatchPhrase(id: "tm-dec", label: "December", sfSymbol: "", isEmergency: false),
            WatchPhrase(id: "tdate-10", label: "10th", sfSymbol: "", isEmergency: false),
            WatchPhrase(id: "tdate-11", label: "11th", sfSymbol: "", isEmergency: false),
            WatchPhrase(id: "tdate-12", label: "12th", sfSymbol: "", isEmergency: false),
            WatchPhrase(id: "tdate-13", label: "13th", sfSymbol: "", isEmergency: false),
            WatchPhrase(id: "tdate-14", label: "14th", sfSymbol: "", isEmergency: false),
            WatchPhrase(id: "tdate-15", label: "15th", sfSymbol: "", isEmergency: false),
            WatchPhrase(id: "tdate-16", label: "16th", sfSymbol: "", isEmergency: false),
            WatchPhrase(id: "tdate-17", label: "17th", sfSymbol: "", isEmergency: false),
            WatchPhrase(id: "tdate-18", label: "18th", sfSymbol: "", isEmergency: false),
            WatchPhrase(id: "tdate-19", label: "19th", sfSymbol: "", isEmergency: false),
            WatchPhrase(id: "tdate-20", label: "20th", sfSymbol: "", isEmergency: false),
            WatchPhrase(id: "tdate-21", label: "21st", sfSymbol: "", isEmergency: false),
            WatchPhrase(id: "tdate-22", label: "22nd", sfSymbol: "", isEmergency: false),
            WatchPhrase(id: "tdate-23", label: "23rd", sfSymbol: "", isEmergency: false),
            WatchPhrase(id: "tdate-24", label: "24th", sfSymbol: "", isEmergency: false),
            WatchPhrase(id: "tdate-25", label: "25th", sfSymbol: "", isEmergency: false),
            WatchPhrase(id: "tdate-26", label: "26th", sfSymbol: "", isEmergency: false),
            WatchPhrase(id: "tdate-27", label: "27th", sfSymbol: "", isEmergency: false),
            WatchPhrase(id: "tdate-28", label: "28th", sfSymbol: "", isEmergency: false),
            WatchPhrase(id: "tdate-29", label: "29th", sfSymbol: "", isEmergency: false),
            WatchPhrase(id: "tdate-30", label: "30th", sfSymbol: "", isEmergency: false),
            WatchPhrase(id: "tdate-31", label: "31st", sfSymbol: "", isEmergency: false),
        ]),
        WatchCategory(id: "animals", icon: "pawprint.fill", name: "Animals", phrases: [
            WatchPhrase(id: "an-dog", label: "Dog", sfSymbol: "", isEmergency: false),
            WatchPhrase(id: "an-cat", label: "Cat", sfSymbol: "", isEmergency: false),
            WatchPhrase(id: "an-fish", label: "Fish", sfSymbol: "", isEmergency: false),
            WatchPhrase(id: "an-bird", label: "Bird", sfSymbol: "", isEmergency: false),
            WatchPhrase(id: "an-horse", label: "Horse", sfSymbol: "", isEmergency: false),
            WatchPhrase(id: "an-cow", label: "Cow", sfSymbol: "", isEmergency: false),
            WatchPhrase(id: "an-pig", label: "Pig", sfSymbol: "", isEmergency: false),
            WatchPhrase(id: "an-rabbit", label: "Rabbit", sfSymbol: "", isEmergency: false),
            WatchPhrase(id: "an-bear", label: "Bear", sfSymbol: "", isEmergency: false),
            WatchPhrase(id: "an-elephant", label: "Elephant", sfSymbol: "", isEmergency: false),
            WatchPhrase(id: "an-duck", label: "Duck", sfSymbol: "", isEmergency: false),
            WatchPhrase(id: "an-butterfly", label: "Butterfly", sfSymbol: "", isEmergency: false),
            WatchPhrase(id: "an-puppy", label: "Puppy", sfSymbol: "", isEmergency: false),
            WatchPhrase(id: "an-kitten", label: "Kitten", sfSymbol: "", isEmergency: false),
            WatchPhrase(id: "an-hamster", label: "Hamster", sfSymbol: "", isEmergency: false),
            WatchPhrase(id: "an-guinea-pig", label: "Guinea pig", sfSymbol: "", isEmergency: false),
            WatchPhrase(id: "an-turtle", label: "Turtle", sfSymbol: "", isEmergency: false),
            WatchPhrase(id: "an-frog", label: "Frog", sfSymbol: "", isEmergency: false),
            WatchPhrase(id: "an-snake", label: "Snake", sfSymbol: "", isEmergency: false),
            WatchPhrase(id: "an-lizard", label: "Lizard", sfSymbol: "", isEmergency: false),
            WatchPhrase(id: "an-spider", label: "Spider", sfSymbol: "", isEmergency: false),
            WatchPhrase(id: "an-bug", label: "Bug", sfSymbol: "", isEmergency: false),
            WatchPhrase(id: "an-bee", label: "Bee", sfSymbol: "", isEmergency: false),
            WatchPhrase(id: "an-ant", label: "Ant", sfSymbol: "", isEmergency: false),
            WatchPhrase(id: "an-lion", label: "Lion", sfSymbol: "", isEmergency: false),
            WatchPhrase(id: "an-tiger", label: "Tiger", sfSymbol: "", isEmergency: false),
            WatchPhrase(id: "an-monkey", label: "Monkey", sfSymbol: "", isEmergency: false),
            WatchPhrase(id: "an-giraffe", label: "Giraffe", sfSymbol: "", isEmergency: false),
            WatchPhrase(id: "an-zebra", label: "Zebra", sfSymbol: "", isEmergency: false),
            WatchPhrase(id: "an-hippo", label: "Hippo", sfSymbol: "", isEmergency: false),
            WatchPhrase(id: "an-penguin", label: "Penguin", sfSymbol: "", isEmergency: false),
            WatchPhrase(id: "an-owl", label: "Owl", sfSymbol: "", isEmergency: false),
            WatchPhrase(id: "an-eagle", label: "Eagle", sfSymbol: "", isEmergency: false),
            WatchPhrase(id: "an-parrot", label: "Parrot", sfSymbol: "", isEmergency: false),
            WatchPhrase(id: "an-chicken", label: "Chicken", sfSymbol: "", isEmergency: false),
            WatchPhrase(id: "an-rooster", label: "Rooster", sfSymbol: "", isEmergency: false),
            WatchPhrase(id: "an-sheep", label: "Sheep", sfSymbol: "", isEmergency: false),
            WatchPhrase(id: "an-goat", label: "Goat", sfSymbol: "", isEmergency: false),
            WatchPhrase(id: "an-donkey", label: "Donkey", sfSymbol: "", isEmergency: false),
            WatchPhrase(id: "an-dolphin", label: "Dolphin", sfSymbol: "", isEmergency: false),
            WatchPhrase(id: "an-whale", label: "Whale", sfSymbol: "", isEmergency: false),
            WatchPhrase(id: "an-shark", label: "Shark", sfSymbol: "", isEmergency: false),
            WatchPhrase(id: "an-octopus", label: "Octopus", sfSymbol: "", isEmergency: false),
            WatchPhrase(id: "an-crab", label: "Crab", sfSymbol: "", isEmergency: false),
            WatchPhrase(id: "an-starfish", label: "Starfish", sfSymbol: "", isEmergency: false),
            WatchPhrase(id: "an-my-pet", label: "My pet", sfSymbol: "", isEmergency: false),
            WatchPhrase(id: "an-my-dog", label: "My dog", sfSymbol: "", isEmergency: false),
            WatchPhrase(id: "an-my-cat", label: "My cat", sfSymbol: "", isEmergency: false),
            WatchPhrase(id: "ap-hamster", label: "Hamster", sfSymbol: "", isEmergency: false),
            WatchPhrase(id: "af-chicken", label: "Chicken", sfSymbol: "", isEmergency: false),
            WatchPhrase(id: "aw-elephant", label: "Elephant", sfSymbol: "", isEmergency: false),
            WatchPhrase(id: "ab-penguin", label: "Penguin", sfSymbol: "", isEmergency: false),
            WatchPhrase(id: "ab-sparrow", label: "Sparrow", sfSymbol: "", isEmergency: false),
            WatchPhrase(id: "as-starfish", label: "Starfish", sfSymbol: "", isEmergency: false),
        ]),
        WatchCategory(id: "colors", icon: "paintpalette", name: "Colors", phrases: [
            WatchPhrase(id: "co-red", label: "Red", sfSymbol: "", isEmergency: false),
            WatchPhrase(id: "co-blue", label: "Blue", sfSymbol: "", isEmergency: false),
            WatchPhrase(id: "co-green", label: "Green", sfSymbol: "", isEmergency: false),
            WatchPhrase(id: "co-yellow", label: "Yellow", sfSymbol: "", isEmergency: false),
            WatchPhrase(id: "co-orange", label: "Orange", sfSymbol: "", isEmergency: false),
            WatchPhrase(id: "co-purple", label: "Purple", sfSymbol: "", isEmergency: false),
            WatchPhrase(id: "co-pink", label: "Pink", sfSymbol: "", isEmergency: false),
            WatchPhrase(id: "co-black", label: "Black", sfSymbol: "", isEmergency: false),
            WatchPhrase(id: "co-white", label: "White", sfSymbol: "", isEmergency: false),
            WatchPhrase(id: "co-brown", label: "Brown", sfSymbol: "", isEmergency: false),
            WatchPhrase(id: "co-gray", label: "Gray", sfSymbol: "", isEmergency: false),
            WatchPhrase(id: "co-silver", label: "Silver", sfSymbol: "", isEmergency: false),
            WatchPhrase(id: "co-gold", label: "Gold", sfSymbol: "", isEmergency: false),
            WatchPhrase(id: "co-beige", label: "Beige", sfSymbol: "", isEmergency: false),
            WatchPhrase(id: "co-tan", label: "Tan", sfSymbol: "", isEmergency: false),
            WatchPhrase(id: "co-light-blue", label: "Light blue", sfSymbol: "", isEmergency: false),
            WatchPhrase(id: "co-dark-blue", label: "Dark blue", sfSymbol: "", isEmergency: false),
            WatchPhrase(id: "co-light-green", label: "Light green", sfSymbol: "", isEmergency: false),
            WatchPhrase(id: "co-dark-green", label: "Dark green", sfSymbol: "", isEmergency: false),
            WatchPhrase(id: "co-light-pink", label: "Light pink", sfSymbol: "", isEmergency: false),
            WatchPhrase(id: "co-hot-pink", label: "Hot pink", sfSymbol: "", isEmergency: false),
            WatchPhrase(id: "co-rainbow", label: "Rainbow", sfSymbol: "", isEmergency: false),
            WatchPhrase(id: "co-my-favorite-color", label: "My favorite color", sfSymbol: "", isEmergency: false),
        ]),
        WatchCategory(id: "clothes", icon: "tshirt.fill", name: "Clothes", phrases: [
            WatchPhrase(id: "cl-shirt", label: "Shirt", sfSymbol: "", isEmergency: false),
            WatchPhrase(id: "cl-pants", label: "Pants", sfSymbol: "", isEmergency: false),
            WatchPhrase(id: "cl-shoes", label: "Shoes", sfSymbol: "", isEmergency: false),
            WatchPhrase(id: "cl-socks", label: "Socks", sfSymbol: "", isEmergency: false),
            WatchPhrase(id: "cl-jacket", label: "Jacket", sfSymbol: "", isEmergency: false),
            WatchPhrase(id: "cl-hat", label: "Hat", sfSymbol: "", isEmergency: false),
            WatchPhrase(id: "cl-dress", label: "Dress", sfSymbol: "", isEmergency: false),
            WatchPhrase(id: "cl-pajamas", label: "Pajamas", sfSymbol: "", isEmergency: false),
            WatchPhrase(id: "cl-underwear", label: "Underwear", sfSymbol: "", isEmergency: false),
            WatchPhrase(id: "cl-boots", label: "Boots", sfSymbol: "", isEmergency: false),
            WatchPhrase(id: "cl-t-shirt", label: "T-shirt", sfSymbol: "", isEmergency: false),
            WatchPhrase(id: "cl-sweater", label: "Sweater", sfSymbol: "", isEmergency: false),
            WatchPhrase(id: "cl-sweatshirt", label: "Sweatshirt", sfSymbol: "", isEmergency: false),
            WatchPhrase(id: "cl-hoodie", label: "Hoodie", sfSymbol: "", isEmergency: false),
            WatchPhrase(id: "cl-coat", label: "Coat", sfSymbol: "", isEmergency: false),
            WatchPhrase(id: "cl-shorts", label: "Shorts", sfSymbol: "", isEmergency: false),
            WatchPhrase(id: "cl-skirt", label: "Skirt", sfSymbol: "", isEmergency: false),
            WatchPhrase(id: "cl-leggings", label: "Leggings", sfSymbol: "", isEmergency: false),
            WatchPhrase(id: "cl-sandals", label: "Sandals", sfSymbol: "", isEmergency: false),
            WatchPhrase(id: "cl-sneakers", label: "Sneakers", sfSymbol: "", isEmergency: false),
            WatchPhrase(id: "cl-mittens", label: "Mittens", sfSymbol: "", isEmergency: false),
            WatchPhrase(id: "cl-gloves", label: "Gloves", sfSymbol: "", isEmergency: false),
            WatchPhrase(id: "cl-scarf", label: "Scarf", sfSymbol: "", isEmergency: false),
            WatchPhrase(id: "cl-belt", label: "Belt", sfSymbol: "", isEmergency: false),
            WatchPhrase(id: "cl-backpack", label: "Backpack", sfSymbol: "", isEmergency: false),
            WatchPhrase(id: "cl-helmet", label: "Helmet", sfSymbol: "", isEmergency: false),
            WatchPhrase(id: "cl-glasses", label: "Glasses", sfSymbol: "", isEmergency: false),
            WatchPhrase(id: "cl-sunglasses", label: "Sunglasses", sfSymbol: "", isEmergency: false),
            WatchPhrase(id: "cl-diaper", label: "Diaper", sfSymbol: "", isEmergency: false),
            WatchPhrase(id: "cl-pull-up", label: "Pull-up", sfSymbol: "", isEmergency: false),
        ]),
        WatchCategory(id: "transport", icon: "car.fill", name: "Transportation", phrases: [
            WatchPhrase(id: "tr-car", label: "Car", sfSymbol: "", isEmergency: false),
            WatchPhrase(id: "tr-bus", label: "Bus", sfSymbol: "", isEmergency: false),
            WatchPhrase(id: "tr-train", label: "Train", sfSymbol: "", isEmergency: false),
            WatchPhrase(id: "tr-airplane", label: "Airplane", sfSymbol: "", isEmergency: false),
            WatchPhrase(id: "tr-bike", label: "Bike", sfSymbol: "", isEmergency: false),
            WatchPhrase(id: "tr-truck", label: "Truck", sfSymbol: "", isEmergency: false),
            WatchPhrase(id: "tr-boat", label: "Boat", sfSymbol: "", isEmergency: false),
            WatchPhrase(id: "tr-walk", label: "Walk", sfSymbol: "", isEmergency: false),
            WatchPhrase(id: "tr-wheelchair", label: "Wheelchair", sfSymbol: "", isEmergency: false),
            WatchPhrase(id: "tr-scooter", label: "Scooter", sfSymbol: "", isEmergency: false),
            WatchPhrase(id: "tr-stroller", label: "Stroller", sfSymbol: "", isEmergency: false),
            WatchPhrase(id: "tr-tricycle", label: "Tricycle", sfSymbol: "", isEmergency: false),
            WatchPhrase(id: "tr-skateboard", label: "Skateboard", sfSymbol: "", isEmergency: false),
            WatchPhrase(id: "tr-roller-skates", label: "Roller skates", sfSymbol: "", isEmergency: false),
            WatchPhrase(id: "tr-subway", label: "Subway", sfSymbol: "", isEmergency: false),
            WatchPhrase(id: "tr-taxi", label: "Taxi", sfSymbol: "", isEmergency: false),
            WatchPhrase(id: "tr-helicopter", label: "Helicopter", sfSymbol: "", isEmergency: false),
            WatchPhrase(id: "tr-rocket", label: "Rocket", sfSymbol: "", isEmergency: false),
            WatchPhrase(id: "tr-tractor", label: "Tractor", sfSymbol: "", isEmergency: false),
            WatchPhrase(id: "tr-fire-truck", label: "Fire truck", sfSymbol: "", isEmergency: false),
            WatchPhrase(id: "tr-police-car", label: "Police car", sfSymbol: "", isEmergency: false),
            WatchPhrase(id: "tr-ambulance", label: "Ambulance", sfSymbol: "", isEmergency: false),
            WatchPhrase(id: "tr-ferry", label: "Ferry", sfSymbol: "", isEmergency: false),
            WatchPhrase(id: "tr-sled", label: "Sled", sfSymbol: "", isEmergency: false),
            WatchPhrase(id: "tr-drive", label: "Drive", sfSymbol: "", isEmergency: false),
            WatchPhrase(id: "tr-ride", label: "Ride", sfSymbol: "", isEmergency: false),
        ]),
        WatchCategory(id: "weather", icon: "cloud.sun.fill", name: "Weather", phrases: [
            WatchPhrase(id: "we-sunny", label: "Sunny", sfSymbol: "", isEmergency: false),
            WatchPhrase(id: "we-rainy", label: "Rainy", sfSymbol: "", isEmergency: false),
            WatchPhrase(id: "we-cloudy", label: "Cloudy", sfSymbol: "", isEmergency: false),
            WatchPhrase(id: "we-snowy", label: "Snowy", sfSymbol: "", isEmergency: false),
            WatchPhrase(id: "we-windy", label: "Windy", sfSymbol: "", isEmergency: false),
            WatchPhrase(id: "we-hot", label: "Hot", sfSymbol: "", isEmergency: false),
            WatchPhrase(id: "we-cold", label: "Cold", sfSymbol: "", isEmergency: false),
            WatchPhrase(id: "we-storm", label: "Storm", sfSymbol: "", isEmergency: false),
            WatchPhrase(id: "we-foggy", label: "Foggy", sfSymbol: "", isEmergency: false),
            WatchPhrase(id: "we-rainbow", label: "Rainbow", sfSymbol: "", isEmergency: false),
            WatchPhrase(id: "we-lightning", label: "Lightning", sfSymbol: "", isEmergency: false),
            WatchPhrase(id: "we-thunder", label: "Thunder", sfSymbol: "", isEmergency: false),
            WatchPhrase(id: "we-tornado", label: "Tornado", sfSymbol: "", isEmergency: false),
            WatchPhrase(id: "we-hurricane", label: "Hurricane", sfSymbol: "", isEmergency: false),
            WatchPhrase(id: "we-earthquake", label: "Earthquake", sfSymbol: "", isEmergency: false),
            WatchPhrase(id: "we-warm-out", label: "Warm out", sfSymbol: "", isEmergency: false),
            WatchPhrase(id: "we-cool-out", label: "Cool out", sfSymbol: "", isEmergency: false),
            WatchPhrase(id: "we-freezing", label: "Freezing", sfSymbol: "", isEmergency: false),
            WatchPhrase(id: "we-wear-a-coat", label: "Wear a coat", sfSymbol: "", isEmergency: false),
            WatchPhrase(id: "we-wear-shorts", label: "Wear shorts", sfSymbol: "", isEmergency: false),
        ]),
        WatchCategory(id: "toys-fun", icon: "gamecontroller.fill", name: "Toys & Fun", phrases: [
            WatchPhrase(id: "tf-ball", label: "Ball", sfSymbol: "", isEmergency: false),
            WatchPhrase(id: "tf-blocks", label: "Blocks", sfSymbol: "", isEmergency: false),
            WatchPhrase(id: "tf-doll", label: "Doll", sfSymbol: "", isEmergency: false),
            WatchPhrase(id: "tf-puzzle", label: "Puzzle", sfSymbol: "", isEmergency: false),
            WatchPhrase(id: "tf-game", label: "Game", sfSymbol: "", isEmergency: false),
            WatchPhrase(id: "tf-movie", label: "Movie", sfSymbol: "", isEmergency: false),
            WatchPhrase(id: "tf-music", label: "Music", sfSymbol: "", isEmergency: false),
            WatchPhrase(id: "tf-bubbles", label: "Bubbles", sfSymbol: "", isEmergency: false),
            WatchPhrase(id: "tf-swing", label: "Swing", sfSymbol: "", isEmergency: false),
            WatchPhrase(id: "tf-slide", label: "Slide", sfSymbol: "", isEmergency: false),
            WatchPhrase(id: "tf-coloring", label: "Coloring", sfSymbol: "", isEmergency: false),
            WatchPhrase(id: "tf-tablet", label: "Tablet", sfSymbol: "", isEmergency: false),
            WatchPhrase(id: "tf-stuffed-animal", label: "Stuffed animal", sfSymbol: "", isEmergency: false),
            WatchPhrase(id: "tf-action-figure", label: "Action figure", sfSymbol: "", isEmergency: false),
            WatchPhrase(id: "tf-lego", label: "Lego", sfSymbol: "", isEmergency: false),
            WatchPhrase(id: "tf-train-set", label: "Train set", sfSymbol: "", isEmergency: false),
            WatchPhrase(id: "tf-card-game", label: "Card game", sfSymbol: "", isEmergency: false),
            WatchPhrase(id: "tf-board-game", label: "Board game", sfSymbol: "", isEmergency: false),
            WatchPhrase(id: "tf-video-game", label: "Video game", sfSymbol: "", isEmergency: false),
            WatchPhrase(id: "tf-crayons", label: "Crayons", sfSymbol: "", isEmergency: false),
            WatchPhrase(id: "tf-stickers", label: "Stickers", sfSymbol: "", isEmergency: false),
            WatchPhrase(id: "tf-sandbox", label: "Sandbox", sfSymbol: "", isEmergency: false),
            WatchPhrase(id: "tf-trampoline", label: "Trampoline", sfSymbol: "", isEmergency: false),
            WatchPhrase(id: "tf-sprinkler", label: "Sprinkler", sfSymbol: "", isEmergency: false),
            WatchPhrase(id: "tf-story", label: "Story", sfSymbol: "", isEmergency: false),
            WatchPhrase(id: "tf-song", label: "Song", sfSymbol: "", isEmergency: false),
            WatchPhrase(id: "tf-cartoon", label: "Cartoon", sfSymbol: "", isEmergency: false),
        ]),
    ]
}
