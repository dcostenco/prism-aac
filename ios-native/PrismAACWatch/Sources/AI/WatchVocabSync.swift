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

    /// Update the language pair and reload vocabulary.
    /// Vocabulary labels are loaded in `input` language so the AAC user
    /// can read them in their native language. TTS speaks in `output`.
    func setLanguages(input: String, output: String) {
        // #13: validate before writing — rejects arbitrary locale strings from the wire
        let safeInput  = Self.allowedLangs.contains(input)  ? input  : "en-US"
        let safeOutput = Self.allowedLangs.contains(output) ? output : "en-US"
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
        // Restore saved language pair — #15: stored in Keychain (PII-adjacent), validated against allowlist
        if let inp = KeychainHelper.shared.read(service: "prism-aac", account: "watchInputLanguage"),
           Self.allowedLangs.contains(inp) { inputLanguage = inp }
        if let out = KeychainHelper.shared.read(service: "prism-aac", account: "watchOutputLanguage"),
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
            WatchPhrase(id: "yes",   label: "Yes",      sfSymbol: "checkmark.circle.fill"),
            WatchPhrase(id: "no",    label: "No",       sfSymbol: "xmark.circle.fill"),
            WatchPhrase(id: "more",  label: "More",     sfSymbol: "plus.circle"),
            WatchPhrase(id: "done",  label: "All done", sfSymbol: "checkmark.seal"),
            WatchPhrase(id: "help",  label: "Help",     sfSymbol: "sos"),
            WatchPhrase(id: "stop",  label: "Stop",     sfSymbol: "hand.raised.fill"),
            WatchPhrase(id: "water", label: "Water",    sfSymbol: "drop.fill"),
            WatchPhrase(id: "hurt",  label: "Hurt",     sfSymbol: "cross.fill", isEmergency: true),
        ]),
    ]

// generated: 1274 phrases × 22 categories
    /// iOS-parity default set — generated from constants/phrases.ts
    /// by scripts/gen-watch-default-set.py. Sync rule: when phrases.ts
    /// changes, re-run gen-watch-default-set.py.
    static let iOSDefaultSet: [WatchCategory] = [
        WatchCategory(id: "core-pronouns", icon: "person.2.fill", name: "I / You / We", phrases: [
            WatchPhrase(id: "cw-i", label: "I", sfSymbol: "person.fill", isEmergency: false),
            WatchPhrase(id: "cw-you", label: "You", sfSymbol: "person.fill", isEmergency: false),
            WatchPhrase(id: "cw-he", label: "He", sfSymbol: "person.fill", isEmergency: false),
            WatchPhrase(id: "cw-she", label: "She", sfSymbol: "person.fill", isEmergency: false),
            WatchPhrase(id: "cw-it", label: "It", sfSymbol: "person.fill", isEmergency: false),
            WatchPhrase(id: "cw-we", label: "We", sfSymbol: "person.fill", isEmergency: false),
            WatchPhrase(id: "cw-they", label: "They", sfSymbol: "person.fill", isEmergency: false),
            WatchPhrase(id: "cw-me", label: "Me", sfSymbol: "person.fill", isEmergency: false),
            WatchPhrase(id: "cw-my", label: "My", sfSymbol: "person.fill", isEmergency: false),
            WatchPhrase(id: "cw-your", label: "Your", sfSymbol: "person.fill", isEmergency: false),
            WatchPhrase(id: "cw-his", label: "His", sfSymbol: "person.fill", isEmergency: false),
            WatchPhrase(id: "cw-her", label: "Her", sfSymbol: "person.fill", isEmergency: false),
            WatchPhrase(id: "cw-this", label: "This", sfSymbol: "person.fill", isEmergency: false),
            WatchPhrase(id: "cw-that", label: "That", sfSymbol: "person.fill", isEmergency: false),
            WatchPhrase(id: "cw-us", label: "Us", sfSymbol: "person.fill", isEmergency: false),
            WatchPhrase(id: "cw-them", label: "Them", sfSymbol: "person.fill", isEmergency: false),
            WatchPhrase(id: "cw-mine", label: "Mine", sfSymbol: "person.fill", isEmergency: false),
            WatchPhrase(id: "cw-yours", label: "Yours", sfSymbol: "person.fill", isEmergency: false),
            WatchPhrase(id: "cw-theirs", label: "Theirs", sfSymbol: "person.fill", isEmergency: false),
            WatchPhrase(id: "cw-ours", label: "Ours", sfSymbol: "person.fill", isEmergency: false),
            WatchPhrase(id: "cw-hers", label: "Hers", sfSymbol: "person.fill", isEmergency: false),
            WatchPhrase(id: "cw-myself", label: "Myself", sfSymbol: "person.fill", isEmergency: false),
            WatchPhrase(id: "cw-yourself", label: "Yourself", sfSymbol: "person.fill", isEmergency: false),
            WatchPhrase(id: "cw-themselves", label: "Themselves", sfSymbol: "person.fill", isEmergency: false),
            WatchPhrase(id: "cw-ourselves", label: "Ourselves", sfSymbol: "person.fill", isEmergency: false),
            WatchPhrase(id: "cw-each-other", label: "Each other", sfSymbol: "person.fill", isEmergency: false),
            WatchPhrase(id: "cw-anyone", label: "Anyone", sfSymbol: "person.fill", isEmergency: false),
            WatchPhrase(id: "cw-someone", label: "Someone", sfSymbol: "person.fill", isEmergency: false),
            WatchPhrase(id: "cw-everyone", label: "Everyone", sfSymbol: "person.fill", isEmergency: false),
            WatchPhrase(id: "cw-no-one", label: "No one", sfSymbol: "person.fill", isEmergency: false),
            WatchPhrase(id: "cw-nobody", label: "Nobody", sfSymbol: "person.fill", isEmergency: false),
            WatchPhrase(id: "cw-whose", label: "Whose", sfSymbol: "person.fill", isEmergency: false),
        ]),
        WatchCategory(id: "core-verbs", icon: "bolt.fill", name: "Core Verbs", phrases: [
            WatchPhrase(id: "cw-want", label: "Want", sfSymbol: "bolt", isEmergency: false),
            WatchPhrase(id: "cw-want-to", label: "Want to", sfSymbol: "bolt", isEmergency: false),
            WatchPhrase(id: "cw-like", label: "Like", sfSymbol: "bolt", isEmergency: false),
            WatchPhrase(id: "cw-have", label: "Have", sfSymbol: "bolt", isEmergency: false),
            WatchPhrase(id: "cw-do", label: "Do", sfSymbol: "bolt", isEmergency: false),
            WatchPhrase(id: "cw-can", label: "Can", sfSymbol: "bolt", isEmergency: false),
            WatchPhrase(id: "cw-need", label: "Need", sfSymbol: "bolt", isEmergency: false),
            WatchPhrase(id: "cw-know", label: "Know", sfSymbol: "bolt", isEmergency: false),
            WatchPhrase(id: "cw-see", label: "See", sfSymbol: "bolt", isEmergency: false),
            WatchPhrase(id: "cw-think", label: "Think", sfSymbol: "bolt", isEmergency: false),
            WatchPhrase(id: "cw-feel", label: "Feel", sfSymbol: "bolt", isEmergency: false),
            WatchPhrase(id: "cw-say", label: "Say", sfSymbol: "bolt", isEmergency: false),
            WatchPhrase(id: "cw-tell", label: "Tell", sfSymbol: "bolt", isEmergency: false),
            WatchPhrase(id: "cw-try", label: "Try", sfSymbol: "bolt", isEmergency: false),
            WatchPhrase(id: "cw-let", label: "Let", sfSymbol: "bolt", isEmergency: false),
            WatchPhrase(id: "cw-help", label: "Help", sfSymbol: "bolt", isEmergency: true),
            WatchPhrase(id: "cw-make", label: "Make", sfSymbol: "bolt", isEmergency: false),
            WatchPhrase(id: "cw-come", label: "Come", sfSymbol: "bolt", isEmergency: false),
            WatchPhrase(id: "cw-go-core", label: "Go", sfSymbol: "bolt", isEmergency: false),
            WatchPhrase(id: "cw-get-core", label: "Get", sfSymbol: "bolt", isEmergency: false),
            WatchPhrase(id: "cw-put-core", label: "Put", sfSymbol: "bolt", isEmergency: false),
            WatchPhrase(id: "cw-wait", label: "Wait", sfSymbol: "bolt", isEmergency: false),
            WatchPhrase(id: "cw-stop", label: "Stop", sfSymbol: "bolt", isEmergency: false),
            WatchPhrase(id: "cw-start", label: "Start", sfSymbol: "bolt", isEmergency: false),
            WatchPhrase(id: "cw-finish", label: "Finish", sfSymbol: "bolt", isEmergency: false),
            WatchPhrase(id: "cw-begin", label: "Begin", sfSymbol: "bolt", isEmergency: false),
            WatchPhrase(id: "cw-end", label: "End", sfSymbol: "bolt", isEmergency: false),
            WatchPhrase(id: "cw-stay", label: "Stay", sfSymbol: "bolt", isEmergency: false),
            WatchPhrase(id: "cw-leave", label: "Leave", sfSymbol: "bolt", isEmergency: false),
            WatchPhrase(id: "cw-look", label: "Look", sfSymbol: "bolt", isEmergency: false),
            WatchPhrase(id: "cw-watch", label: "Watch", sfSymbol: "bolt", isEmergency: false),
            WatchPhrase(id: "cw-hear", label: "Hear", sfSymbol: "bolt", isEmergency: false),
            WatchPhrase(id: "cw-listen", label: "Listen", sfSymbol: "bolt", isEmergency: false),
            WatchPhrase(id: "cw-smell", label: "Smell", sfSymbol: "bolt", isEmergency: false),
            WatchPhrase(id: "cw-taste", label: "Taste", sfSymbol: "bolt", isEmergency: false),
            WatchPhrase(id: "cw-touch", label: "Touch", sfSymbol: "bolt", isEmergency: false),
            WatchPhrase(id: "cw-hold", label: "Hold", sfSymbol: "bolt", isEmergency: false),
            WatchPhrase(id: "cw-grab", label: "Grab", sfSymbol: "bolt", isEmergency: false),
            WatchPhrase(id: "cw-push", label: "Push", sfSymbol: "bolt", isEmergency: false),
            WatchPhrase(id: "cw-pull", label: "Pull", sfSymbol: "bolt", isEmergency: false),
            WatchPhrase(id: "cw-lift", label: "Lift", sfSymbol: "bolt", isEmergency: false),
            WatchPhrase(id: "cw-carry", label: "Carry", sfSymbol: "bolt", isEmergency: false),
            WatchPhrase(id: "cw-drop", label: "Drop", sfSymbol: "bolt", isEmergency: false),
            WatchPhrase(id: "cw-throw", label: "Throw", sfSymbol: "bolt", isEmergency: false),
            WatchPhrase(id: "cw-catch", label: "Catch", sfSymbol: "bolt", isEmergency: false),
            WatchPhrase(id: "cw-open", label: "Open", sfSymbol: "bolt", isEmergency: false),
            WatchPhrase(id: "cw-close", label: "Close", sfSymbol: "bolt", isEmergency: false),
            WatchPhrase(id: "cw-turn", label: "Turn", sfSymbol: "bolt", isEmergency: false),
            WatchPhrase(id: "cw-move", label: "Move", sfSymbol: "bolt", isEmergency: false),
            WatchPhrase(id: "cw-sit", label: "Sit", sfSymbol: "bolt", isEmergency: false),
            WatchPhrase(id: "cw-stand", label: "Stand", sfSymbol: "bolt", isEmergency: false),
            WatchPhrase(id: "cw-walk", label: "Walk", sfSymbol: "bolt", isEmergency: false),
            WatchPhrase(id: "cw-run", label: "Run", sfSymbol: "bolt", isEmergency: false),
            WatchPhrase(id: "cw-jump", label: "Jump", sfSymbol: "bolt", isEmergency: false),
            WatchPhrase(id: "cw-climb", label: "Climb", sfSymbol: "bolt", isEmergency: false),
            WatchPhrase(id: "cw-fall", label: "Fall", sfSymbol: "bolt", isEmergency: false),
            WatchPhrase(id: "cw-rest", label: "Rest", sfSymbol: "bolt", isEmergency: false),
            WatchPhrase(id: "cw-sleep", label: "Sleep", sfSymbol: "bolt", isEmergency: false),
            WatchPhrase(id: "cw-wake", label: "Wake", sfSymbol: "bolt", isEmergency: false),
            WatchPhrase(id: "cw-dream", label: "Dream", sfSymbol: "bolt", isEmergency: false),
            WatchPhrase(id: "cw-eat", label: "Eat", sfSymbol: "bolt", isEmergency: false),
            WatchPhrase(id: "cw-drink", label: "Drink", sfSymbol: "bolt", isEmergency: false),
            WatchPhrase(id: "cw-bite", label: "Bite", sfSymbol: "bolt", isEmergency: false),
            WatchPhrase(id: "cw-chew", label: "Chew", sfSymbol: "bolt", isEmergency: false),
            WatchPhrase(id: "cw-swallow", label: "Swallow", sfSymbol: "bolt", isEmergency: false),
            WatchPhrase(id: "cw-spit", label: "Spit", sfSymbol: "bolt", isEmergency: false),
            WatchPhrase(id: "cw-talk", label: "Talk", sfSymbol: "bolt", isEmergency: false),
            WatchPhrase(id: "cw-speak", label: "Speak", sfSymbol: "bolt", isEmergency: false),
            WatchPhrase(id: "cw-whisper", label: "Whisper", sfSymbol: "bolt", isEmergency: false),
            WatchPhrase(id: "cw-shout", label: "Shout", sfSymbol: "bolt", isEmergency: false),
            WatchPhrase(id: "cw-sing", label: "Sing", sfSymbol: "bolt", isEmergency: false),
            WatchPhrase(id: "cw-laugh", label: "Laugh", sfSymbol: "bolt", isEmergency: false),
            WatchPhrase(id: "cw-cry", label: "Cry", sfSymbol: "bolt", isEmergency: false),
            WatchPhrase(id: "cw-smile", label: "Smile", sfSymbol: "bolt", isEmergency: false),
            WatchPhrase(id: "cw-read", label: "Read", sfSymbol: "bolt", isEmergency: false),
            WatchPhrase(id: "cw-write", label: "Write", sfSymbol: "bolt", isEmergency: false),
            WatchPhrase(id: "cw-draw", label: "Draw", sfSymbol: "bolt", isEmergency: false),
            WatchPhrase(id: "cw-paint", label: "Paint", sfSymbol: "bolt", isEmergency: false),
            WatchPhrase(id: "cw-color", label: "Color", sfSymbol: "bolt", isEmergency: false),
            WatchPhrase(id: "cw-cut", label: "Cut", sfSymbol: "bolt", isEmergency: false),
            WatchPhrase(id: "cw-glue", label: "Glue", sfSymbol: "bolt", isEmergency: false),
            WatchPhrase(id: "cw-build", label: "Build", sfSymbol: "bolt", isEmergency: false),
            WatchPhrase(id: "cw-break", label: "Break", sfSymbol: "bolt", isEmergency: false),
            WatchPhrase(id: "cw-fix", label: "Fix", sfSymbol: "bolt", isEmergency: false),
            WatchPhrase(id: "cw-clean", label: "Clean", sfSymbol: "bolt", isEmergency: false),
            WatchPhrase(id: "cw-wash", label: "Wash", sfSymbol: "bolt", isEmergency: false),
            WatchPhrase(id: "cw-find", label: "Find", sfSymbol: "bolt", isEmergency: false),
            WatchPhrase(id: "cw-look-for", label: "Look for", sfSymbol: "bolt", isEmergency: false),
            WatchPhrase(id: "cw-lose", label: "Lose", sfSymbol: "bolt", isEmergency: false),
            WatchPhrase(id: "cw-save", label: "Save", sfSymbol: "bolt", isEmergency: false),
            WatchPhrase(id: "cw-keep", label: "Keep", sfSymbol: "bolt", isEmergency: false),
            WatchPhrase(id: "cw-buy", label: "Buy", sfSymbol: "bolt", isEmergency: false),
            WatchPhrase(id: "cw-sell", label: "Sell", sfSymbol: "bolt", isEmergency: false),
            WatchPhrase(id: "cw-pay", label: "Pay", sfSymbol: "bolt", isEmergency: false),
            WatchPhrase(id: "cw-trade", label: "Trade", sfSymbol: "bolt", isEmergency: false),
            WatchPhrase(id: "cw-send", label: "Send", sfSymbol: "bolt", isEmergency: false),
            WatchPhrase(id: "cw-bring", label: "Bring", sfSymbol: "bolt", isEmergency: false),
            WatchPhrase(id: "cw-take", label: "Take", sfSymbol: "bolt", isEmergency: false),
            WatchPhrase(id: "cw-give", label: "Give", sfSymbol: "bolt", isEmergency: false),
            WatchPhrase(id: "cw-share", label: "Share", sfSymbol: "bolt", isEmergency: false),
            WatchPhrase(id: "cw-ask", label: "Ask", sfSymbol: "bolt", isEmergency: false),
            WatchPhrase(id: "cw-answer", label: "Answer", sfSymbol: "bolt", isEmergency: false),
            WatchPhrase(id: "cw-show", label: "Show", sfSymbol: "bolt", isEmergency: false),
            WatchPhrase(id: "cw-hide", label: "Hide", sfSymbol: "bolt", isEmergency: false),
            WatchPhrase(id: "cw-learn", label: "Learn", sfSymbol: "bolt", isEmergency: false),
            WatchPhrase(id: "cw-teach", label: "Teach", sfSymbol: "bolt", isEmergency: false),
            WatchPhrase(id: "cw-study", label: "Study", sfSymbol: "bolt", isEmergency: false),
            WatchPhrase(id: "cw-practice", label: "Practice", sfSymbol: "bolt", isEmergency: false),
            WatchPhrase(id: "cw-work", label: "Work", sfSymbol: "bolt", isEmergency: false),
            WatchPhrase(id: "cw-play", label: "Play", sfSymbol: "bolt", isEmergency: false),
            WatchPhrase(id: "cw-win", label: "Win", sfSymbol: "bolt", isEmergency: false),
            WatchPhrase(id: "cw-try-again", label: "Try again", sfSymbol: "bolt", isEmergency: false),
            WatchPhrase(id: "cw-hug", label: "Hug", sfSymbol: "bolt", isEmergency: false),
            WatchPhrase(id: "cw-kiss", label: "Kiss", sfSymbol: "bolt", isEmergency: false),
            WatchPhrase(id: "cw-pet", label: "Pet", sfSymbol: "bolt", isEmergency: false),
            WatchPhrase(id: "cw-tickle", label: "Tickle", sfSymbol: "bolt", isEmergency: false),
            WatchPhrase(id: "cw-wait-for-me", label: "Wait for me", sfSymbol: "bolt", isEmergency: false),
            WatchPhrase(id: "cw-help-me", label: "Help me", sfSymbol: "bolt", isEmergency: false),
            WatchPhrase(id: "cw-show-me", label: "Show me", sfSymbol: "bolt", isEmergency: false),
            WatchPhrase(id: "cw-tell-me", label: "Tell me", sfSymbol: "bolt", isEmergency: false),
            WatchPhrase(id: "cw-stop-that", label: "Stop that", sfSymbol: "bolt", isEmergency: false),
            WatchPhrase(id: "cw-i-want-to", label: "I want to", sfSymbol: "bolt", isEmergency: false),
            WatchPhrase(id: "cw-i-do-not-want", label: "I do not want", sfSymbol: "bolt", isEmergency: false),
            WatchPhrase(id: "cw-let-me-try", label: "Let me try", sfSymbol: "bolt", isEmergency: false),
            WatchPhrase(id: "cw-let-me-see", label: "Let me see", sfSymbol: "bolt", isEmergency: false),
        ]),
        WatchCategory(id: "core-descriptors", icon: "ruler.fill", name: "More / Not / All", phrases: [
            WatchPhrase(id: "cw-more", label: "More", sfSymbol: "arrow.up.and.down", isEmergency: false),
            WatchPhrase(id: "cw-not", label: "Not", sfSymbol: "arrow.up.and.down", isEmergency: false),
            WatchPhrase(id: "cw-no-core", label: "No", sfSymbol: "arrow.up.and.down", isEmergency: false),
            WatchPhrase(id: "cw-yes-core", label: "Yes", sfSymbol: "arrow.up.and.down", isEmergency: false),
            WatchPhrase(id: "cw-all", label: "All", sfSymbol: "arrow.up.and.down", isEmergency: false),
            WatchPhrase(id: "cw-some", label: "Some", sfSymbol: "arrow.up.and.down", isEmergency: false),
            WatchPhrase(id: "cw-other", label: "Other", sfSymbol: "arrow.up.and.down", isEmergency: false),
            WatchPhrase(id: "cw-very", label: "Very", sfSymbol: "arrow.up.and.down", isEmergency: false),
            WatchPhrase(id: "cw-here", label: "Here", sfSymbol: "arrow.up.and.down", isEmergency: false),
            WatchPhrase(id: "cw-there", label: "There", sfSymbol: "arrow.up.and.down", isEmergency: false),
            WatchPhrase(id: "cw-up", label: "Up", sfSymbol: "arrow.up.and.down", isEmergency: false),
            WatchPhrase(id: "cw-down", label: "Down", sfSymbol: "arrow.up.and.down", isEmergency: false),
            WatchPhrase(id: "cw-in", label: "In", sfSymbol: "arrow.up.and.down", isEmergency: false),
            WatchPhrase(id: "cw-out", label: "Out", sfSymbol: "arrow.up.and.down", isEmergency: false),
            WatchPhrase(id: "cw-on", label: "On", sfSymbol: "arrow.up.and.down", isEmergency: false),
            WatchPhrase(id: "cw-off", label: "Off", sfSymbol: "arrow.up.and.down", isEmergency: false),
            WatchPhrase(id: "cw-done", label: "Done", sfSymbol: "arrow.up.and.down", isEmergency: false),
            WatchPhrase(id: "cw-again", label: "Again", sfSymbol: "arrow.up.and.down", isEmergency: false),
            WatchPhrase(id: "cw-too", label: "Too", sfSymbol: "arrow.up.and.down", isEmergency: false),
            WatchPhrase(id: "cw-same-core", label: "Same", sfSymbol: "arrow.up.and.down", isEmergency: false),
            WatchPhrase(id: "cw-little", label: "Little", sfSymbol: "arrow.up.and.down", isEmergency: false),
            WatchPhrase(id: "cw-lots", label: "Lots", sfSymbol: "arrow.up.and.down", isEmergency: false),
            WatchPhrase(id: "cw-many", label: "Many", sfSymbol: "arrow.up.and.down", isEmergency: false),
            WatchPhrase(id: "cw-few", label: "Few", sfSymbol: "arrow.up.and.down", isEmergency: false),
            WatchPhrase(id: "cw-every", label: "Every", sfSymbol: "arrow.up.and.down", isEmergency: false),
            WatchPhrase(id: "cw-any", label: "Any", sfSymbol: "arrow.up.and.down", isEmergency: false),
            WatchPhrase(id: "cw-only", label: "Only", sfSymbol: "arrow.up.and.down", isEmergency: false),
            WatchPhrase(id: "cw-just", label: "Just", sfSymbol: "arrow.up.and.down", isEmergency: false),
            WatchPhrase(id: "cw-full", label: "Full", sfSymbol: "arrow.up.and.down", isEmergency: false),
            WatchPhrase(id: "cw-empty", label: "Empty", sfSymbol: "arrow.up.and.down", isEmergency: false),
            WatchPhrase(id: "cw-open-2", label: "Open", sfSymbol: "arrow.up.and.down", isEmergency: false),
            WatchPhrase(id: "cw-closed", label: "Closed", sfSymbol: "arrow.up.and.down", isEmergency: false),
            WatchPhrase(id: "cw-easy", label: "Easy", sfSymbol: "arrow.up.and.down", isEmergency: false),
            WatchPhrase(id: "cw-hard", label: "Hard", sfSymbol: "arrow.up.and.down", isEmergency: false),
            WatchPhrase(id: "cw-soft", label: "Soft", sfSymbol: "arrow.up.and.down", isEmergency: false),
            WatchPhrase(id: "cw-loud", label: "Loud", sfSymbol: "arrow.up.and.down", isEmergency: false),
            WatchPhrase(id: "cw-quiet", label: "Quiet", sfSymbol: "arrow.up.and.down", isEmergency: false),
            WatchPhrase(id: "cw-bright", label: "Bright", sfSymbol: "arrow.up.and.down", isEmergency: false),
            WatchPhrase(id: "cw-dark", label: "Dark", sfSymbol: "arrow.up.and.down", isEmergency: false),
            WatchPhrase(id: "cw-heavy", label: "Heavy", sfSymbol: "arrow.up.and.down", isEmergency: false),
            WatchPhrase(id: "cw-light", label: "Light", sfSymbol: "arrow.up.and.down", isEmergency: false),
            WatchPhrase(id: "cw-above", label: "Above", sfSymbol: "arrow.up.and.down", isEmergency: false),
            WatchPhrase(id: "cw-below", label: "Below", sfSymbol: "arrow.up.and.down", isEmergency: false),
            WatchPhrase(id: "cw-beside", label: "Beside", sfSymbol: "arrow.up.and.down", isEmergency: false),
            WatchPhrase(id: "cw-between", label: "Between", sfSymbol: "arrow.up.and.down", isEmergency: false),
            WatchPhrase(id: "cw-near", label: "Near", sfSymbol: "arrow.up.and.down", isEmergency: false),
            WatchPhrase(id: "cw-far", label: "Far", sfSymbol: "arrow.up.and.down", isEmergency: false),
            WatchPhrase(id: "cw-around", label: "Around", sfSymbol: "arrow.up.and.down", isEmergency: false),
            WatchPhrase(id: "cw-through", label: "Through", sfSymbol: "arrow.up.and.down", isEmergency: false),
            WatchPhrase(id: "cw-over", label: "Over", sfSymbol: "arrow.up.and.down", isEmergency: false),
            WatchPhrase(id: "cw-under", label: "Under", sfSymbol: "arrow.up.and.down", isEmergency: false),
            WatchPhrase(id: "cw-across", label: "Across", sfSymbol: "arrow.up.and.down", isEmergency: false),
            WatchPhrase(id: "cw-behind", label: "Behind", sfSymbol: "arrow.up.and.down", isEmergency: false),
            WatchPhrase(id: "cw-ahead", label: "Ahead", sfSymbol: "arrow.up.and.down", isEmergency: false),
            WatchPhrase(id: "cw-always", label: "Always", sfSymbol: "arrow.up.and.down", isEmergency: false),
            WatchPhrase(id: "cw-never", label: "Never", sfSymbol: "arrow.up.and.down", isEmergency: false),
            WatchPhrase(id: "cw-often", label: "Often", sfSymbol: "arrow.up.and.down", isEmergency: false),
            WatchPhrase(id: "cw-sometimes", label: "Sometimes", sfSymbol: "arrow.up.and.down", isEmergency: false),
            WatchPhrase(id: "cw-maybe", label: "Maybe", sfSymbol: "arrow.up.and.down", isEmergency: false),
            WatchPhrase(id: "cw-almost", label: "Almost", sfSymbol: "arrow.up.and.down", isEmergency: false),
            WatchPhrase(id: "cw-already", label: "Already", sfSymbol: "arrow.up.and.down", isEmergency: false),
            WatchPhrase(id: "cw-still", label: "Still", sfSymbol: "arrow.up.and.down", isEmergency: false),
            WatchPhrase(id: "cw-yet", label: "Yet", sfSymbol: "arrow.up.and.down", isEmergency: false),
            WatchPhrase(id: "cw-right-now", label: "Right now", sfSymbol: "arrow.up.and.down", isEmergency: false),
            WatchPhrase(id: "cw-right-here", label: "Right here", sfSymbol: "arrow.up.and.down", isEmergency: false),
            WatchPhrase(id: "cw-way-too-much", label: "Way too much", sfSymbol: "arrow.up.and.down", isEmergency: false),
            WatchPhrase(id: "cw-not-enough", label: "Not enough", sfSymbol: "arrow.up.and.down", isEmergency: false),
        ]),
        WatchCategory(id: "core-little-words", icon: "link", name: "Little Words", phrases: [
            WatchPhrase(id: "cw-is", label: "Is", sfSymbol: "textformat", isEmergency: false),
            WatchPhrase(id: "cw-the", label: "The", sfSymbol: "textformat", isEmergency: false),
            WatchPhrase(id: "cw-a", label: "A", sfSymbol: "textformat", isEmergency: false),
            WatchPhrase(id: "cw-and", label: "And", sfSymbol: "textformat", isEmergency: false),
            WatchPhrase(id: "cw-but", label: "But", sfSymbol: "textformat", isEmergency: false),
            WatchPhrase(id: "cw-or", label: "Or", sfSymbol: "textformat", isEmergency: false),
            WatchPhrase(id: "cw-to", label: "To", sfSymbol: "textformat", isEmergency: false),
            WatchPhrase(id: "cw-for", label: "For", sfSymbol: "textformat", isEmergency: false),
            WatchPhrase(id: "cw-with", label: "With", sfSymbol: "textformat", isEmergency: false),
            WatchPhrase(id: "cw-at", label: "At", sfSymbol: "textformat", isEmergency: false),
            WatchPhrase(id: "cw-of", label: "Of", sfSymbol: "textformat", isEmergency: false),
            WatchPhrase(id: "cw-about", label: "About", sfSymbol: "textformat", isEmergency: false),
            WatchPhrase(id: "cw-because", label: "Because", sfSymbol: "textformat", isEmergency: false),
            WatchPhrase(id: "cw-if", label: "If", sfSymbol: "textformat", isEmergency: false),
            WatchPhrase(id: "cw-when-core", label: "When", sfSymbol: "textformat", isEmergency: false),
            WatchPhrase(id: "cw-where-core", label: "Where", sfSymbol: "textformat", isEmergency: false),
            WatchPhrase(id: "cw-by", label: "By", sfSymbol: "textformat", isEmergency: false),
            WatchPhrase(id: "cw-from", label: "From", sfSymbol: "textformat", isEmergency: false),
            WatchPhrase(id: "cw-since", label: "Since", sfSymbol: "textformat", isEmergency: false),
            WatchPhrase(id: "cw-until", label: "Until", sfSymbol: "textformat", isEmergency: false),
            WatchPhrase(id: "cw-into", label: "Into", sfSymbol: "textformat", isEmergency: false),
            WatchPhrase(id: "cw-onto", label: "Onto", sfSymbol: "textformat", isEmergency: false),
            WatchPhrase(id: "cw-off-of", label: "Off of", sfSymbol: "textformat", isEmergency: false),
            WatchPhrase(id: "cw-away", label: "Away", sfSymbol: "textformat", isEmergency: false),
            WatchPhrase(id: "cw-back", label: "Back", sfSymbol: "textformat", isEmergency: false),
            WatchPhrase(id: "cw-beside-2", label: "Beside", sfSymbol: "textformat", isEmergency: false),
            WatchPhrase(id: "cw-past", label: "Past", sfSymbol: "textformat", isEmergency: false),
            WatchPhrase(id: "cw-among", label: "Among", sfSymbol: "textformat", isEmergency: false),
            WatchPhrase(id: "cw-during", label: "During", sfSymbol: "textformat", isEmergency: false),
            WatchPhrase(id: "cw-while", label: "While", sfSymbol: "textformat", isEmergency: false),
            WatchPhrase(id: "cw-whenever", label: "Whenever", sfSymbol: "textformat", isEmergency: false),
            WatchPhrase(id: "cw-wherever", label: "Wherever", sfSymbol: "textformat", isEmergency: false),
            WatchPhrase(id: "cw-both", label: "Both", sfSymbol: "textformat", isEmergency: false),
            WatchPhrase(id: "cw-either", label: "Either", sfSymbol: "textformat", isEmergency: false),
            WatchPhrase(id: "cw-neither", label: "Neither", sfSymbol: "textformat", isEmergency: false),
            WatchPhrase(id: "cw-whether", label: "Whether", sfSymbol: "textformat", isEmergency: false),
            WatchPhrase(id: "cw-although", label: "Although", sfSymbol: "textformat", isEmergency: false),
            WatchPhrase(id: "cw-though", label: "Though", sfSymbol: "textformat", isEmergency: false),
            WatchPhrase(id: "cw-unless", label: "Unless", sfSymbol: "textformat", isEmergency: false),
            WatchPhrase(id: "cw-so", label: "So", sfSymbol: "textformat", isEmergency: false),
            WatchPhrase(id: "cw-then", label: "Then", sfSymbol: "textformat", isEmergency: false),
            WatchPhrase(id: "cw-also", label: "Also", sfSymbol: "textformat", isEmergency: false),
            WatchPhrase(id: "cw-plus", label: "Plus", sfSymbol: "textformat", isEmergency: false),
            WatchPhrase(id: "cw-like-2", label: "Like", sfSymbol: "textformat", isEmergency: false),
            WatchPhrase(id: "cw-as", label: "As", sfSymbol: "textformat", isEmergency: false),
            WatchPhrase(id: "cw-such-as", label: "Such as", sfSymbol: "textformat", isEmergency: false),
            WatchPhrase(id: "cw-versus", label: "Versus", sfSymbol: "textformat", isEmergency: false),
            WatchPhrase(id: "cw-since-then", label: "Since then", sfSymbol: "textformat", isEmergency: false),
            WatchPhrase(id: "cw-until-now", label: "Until now", sfSymbol: "textformat", isEmergency: false),
            WatchPhrase(id: "cw-right-after", label: "Right after", sfSymbol: "textformat", isEmergency: false),
            WatchPhrase(id: "cw-just-before", label: "Just before", sfSymbol: "textformat", isEmergency: false),
            WatchPhrase(id: "cw-up-to", label: "Up to", sfSymbol: "textformat", isEmergency: false),
            WatchPhrase(id: "cw-down-to", label: "Down to", sfSymbol: "textformat", isEmergency: false),
            WatchPhrase(id: "cw-next-to", label: "Next to", sfSymbol: "textformat", isEmergency: false),
            WatchPhrase(id: "cw-out-of", label: "Out of", sfSymbol: "textformat", isEmergency: false),
            WatchPhrase(id: "cw-a-few", label: "A few", sfSymbol: "textformat", isEmergency: false),
            WatchPhrase(id: "cw-a-lot", label: "A lot", sfSymbol: "textformat", isEmergency: false),
            WatchPhrase(id: "cw-a-little", label: "A little", sfSymbol: "textformat", isEmergency: false),
        ]),
        WatchCategory(id: "help-needs", icon: "sos", name: "Help / Needs", phrases: [
            WatchPhrase(id: "help-all-done", label: "All done", sfSymbol: "exclamationmark.triangle", isEmergency: false),
            WatchPhrase(id: "help-break", label: "Take a break", sfSymbol: "exclamationmark.triangle", isEmergency: false),
            WatchPhrase(id: "help-need-help", label: "I need help", sfSymbol: "exclamationmark.triangle", isEmergency: true),
            WatchPhrase(id: "help-hungry", label: "I am hungry", sfSymbol: "exclamationmark.triangle", isEmergency: false),
            WatchPhrase(id: "help-thirsty", label: "I am thirsty", sfSymbol: "exclamationmark.triangle", isEmergency: false),
            WatchPhrase(id: "help-bathroom", label: "Bathroom", sfSymbol: "exclamationmark.triangle", isEmergency: false),
            WatchPhrase(id: "help-yes", label: "Yes", sfSymbol: "exclamationmark.triangle", isEmergency: false),
            WatchPhrase(id: "help-no", label: "No", sfSymbol: "exclamationmark.triangle", isEmergency: false),
            WatchPhrase(id: "help-stop", label: "Stop", sfSymbol: "exclamationmark.triangle", isEmergency: false),
            WatchPhrase(id: "help-more", label: "More", sfSymbol: "exclamationmark.triangle", isEmergency: false),
            WatchPhrase(id: "help-want", label: "I want", sfSymbol: "exclamationmark.triangle", isEmergency: false),
            WatchPhrase(id: "help-hurts", label: "It hurts", sfSymbol: "exclamationmark.triangle", isEmergency: false),
            WatchPhrase(id: "help-tired", label: "I am tired", sfSymbol: "exclamationmark.triangle", isEmergency: false),
            WatchPhrase(id: "help-i-am-cold", label: "I am cold", sfSymbol: "exclamationmark.triangle", isEmergency: false),
            WatchPhrase(id: "help-i-am-hot", label: "I am hot", sfSymbol: "exclamationmark.triangle", isEmergency: false),
            WatchPhrase(id: "help-i-am-sleepy", label: "I am sleepy", sfSymbol: "exclamationmark.triangle", isEmergency: false),
            WatchPhrase(id: "help-i-am-scared", label: "I am scared", sfSymbol: "exclamationmark.triangle", isEmergency: false),
            WatchPhrase(id: "help-i-am-sick", label: "I am sick", sfSymbol: "exclamationmark.triangle", isEmergency: false),
            WatchPhrase(id: "help-i-am-okay", label: "I am okay", sfSymbol: "exclamationmark.triangle", isEmergency: false),
            WatchPhrase(id: "help-i-am-not-okay", label: "I am not okay", sfSymbol: "exclamationmark.triangle", isEmergency: false),
            WatchPhrase(id: "help-i-am-ready", label: "I am ready", sfSymbol: "exclamationmark.triangle", isEmergency: false),
            WatchPhrase(id: "help-i-am-not-ready", label: "I am not ready", sfSymbol: "exclamationmark.triangle", isEmergency: false),
            WatchPhrase(id: "help-too-loud", label: "Too loud", sfSymbol: "exclamationmark.triangle", isEmergency: false),
            WatchPhrase(id: "help-too-bright", label: "Too bright", sfSymbol: "exclamationmark.triangle", isEmergency: false),
            WatchPhrase(id: "help-too-fast", label: "Too fast", sfSymbol: "exclamationmark.triangle", isEmergency: false),
            WatchPhrase(id: "help-too-slow", label: "Too slow", sfSymbol: "exclamationmark.triangle", isEmergency: false),
            WatchPhrase(id: "help-i-need-quiet", label: "I need quiet", sfSymbol: "exclamationmark.triangle", isEmergency: false),
            WatchPhrase(id: "help-i-need-a-break", label: "I need a break", sfSymbol: "exclamationmark.triangle", isEmergency: false),
            WatchPhrase(id: "help-i-need-water", label: "I need water", sfSymbol: "exclamationmark.triangle", isEmergency: false),
            WatchPhrase(id: "help-i-need-air", label: "I need air", sfSymbol: "exclamationmark.triangle", isEmergency: false),
            WatchPhrase(id: "help-i-need-my-mom", label: "I need my mom", sfSymbol: "exclamationmark.triangle", isEmergency: false),
            WatchPhrase(id: "help-i-need-my-dad", label: "I need my dad", sfSymbol: "exclamationmark.triangle", isEmergency: false),
            WatchPhrase(id: "help-i-need-my-teacher", label: "I need my teacher", sfSymbol: "exclamationmark.triangle", isEmergency: false),
            WatchPhrase(id: "help-i-need-a-hug", label: "I need a hug", sfSymbol: "exclamationmark.triangle", isEmergency: false),
            WatchPhrase(id: "help-i-need-space", label: "I need space", sfSymbol: "exclamationmark.triangle", isEmergency: false),
            WatchPhrase(id: "help-i-need-time", label: "I need time", sfSymbol: "exclamationmark.triangle", isEmergency: false),
            WatchPhrase(id: "help-hold-my-hand", label: "Hold my hand", sfSymbol: "exclamationmark.triangle", isEmergency: false),
            WatchPhrase(id: "help-watch-me", label: "Watch me", sfSymbol: "exclamationmark.triangle", isEmergency: false),
            WatchPhrase(id: "help-listen-to-me", label: "Listen to me", sfSymbol: "exclamationmark.triangle", isEmergency: false),
            WatchPhrase(id: "help-look-at-this", label: "Look at this", sfSymbol: "exclamationmark.triangle", isEmergency: false),
            WatchPhrase(id: "help-help-me-please", label: "Help me please", sfSymbol: "exclamationmark.triangle", isEmergency: false),
            WatchPhrase(id: "help-help-with-this", label: "Help with this", sfSymbol: "exclamationmark.triangle", isEmergency: false),
            WatchPhrase(id: "help-wait-for-me", label: "Wait for me", sfSymbol: "exclamationmark.triangle", isEmergency: false),
            WatchPhrase(id: "help-slow-down-please", label: "Slow down please", sfSymbol: "exclamationmark.triangle", isEmergency: false),
            WatchPhrase(id: "help-speak-more-slowly", label: "Speak more slowly", sfSymbol: "exclamationmark.triangle", isEmergency: false),
            WatchPhrase(id: "help-one-at-a-time", label: "One at a time", sfSymbol: "exclamationmark.triangle", isEmergency: false),
            WatchPhrase(id: "help-i-am-overwhelmed", label: "I am overwhelmed", sfSymbol: "exclamationmark.triangle", isEmergency: false),
            WatchPhrase(id: "help-i-am-confused", label: "I am confused", sfSymbol: "exclamationmark.triangle", isEmergency: false),
            WatchPhrase(id: "help-i-do-not-understand", label: "I do not understand", sfSymbol: "exclamationmark.triangle", isEmergency: false),
            WatchPhrase(id: "help-please-be-patient", label: "Please be patient", sfSymbol: "exclamationmark.triangle", isEmergency: false),
            WatchPhrase(id: "help-give-me-a-minute", label: "Give me a minute", sfSymbol: "exclamationmark.triangle", isEmergency: false),
            WatchPhrase(id: "help-try-again", label: "Try again", sfSymbol: "exclamationmark.triangle", isEmergency: false),
            WatchPhrase(id: "help-calm-down", label: "Calm down", sfSymbol: "exclamationmark.triangle", isEmergency: false),
            WatchPhrase(id: "help-let-me-think", label: "Let me think", sfSymbol: "exclamationmark.triangle", isEmergency: false),
            WatchPhrase(id: "help-show-me-how", label: "Show me how", sfSymbol: "exclamationmark.triangle", isEmergency: false),
            WatchPhrase(id: "help-i-do-not-feel-good", label: "I do not feel good", sfSymbol: "exclamationmark.triangle", isEmergency: false),
            WatchPhrase(id: "help-my-head-hurts", label: "My head hurts", sfSymbol: "exclamationmark.triangle", isEmergency: false),
            WatchPhrase(id: "help-my-tummy-hurts", label: "My tummy hurts", sfSymbol: "exclamationmark.triangle", isEmergency: false),
            WatchPhrase(id: "help-my-ears-hurt", label: "My ears hurt", sfSymbol: "exclamationmark.triangle", isEmergency: false),
            WatchPhrase(id: "help-my-eyes-hurt", label: "My eyes hurt", sfSymbol: "exclamationmark.triangle", isEmergency: false),
            WatchPhrase(id: "help-i-feel-dizzy", label: "I feel dizzy", sfSymbol: "exclamationmark.triangle", isEmergency: false),
            WatchPhrase(id: "help-get-help", label: "Get help", sfSymbol: "exclamationmark.triangle", isEmergency: false),
            WatchPhrase(id: "help-call-my-mom", label: "Call my mom", sfSymbol: "exclamationmark.triangle", isEmergency: false),
            WatchPhrase(id: "help-call-my-dad", label: "Call my dad", sfSymbol: "exclamationmark.triangle", isEmergency: false),
            WatchPhrase(id: "help-call-the-nurse", label: "Call the nurse", sfSymbol: "exclamationmark.triangle", isEmergency: false),
            WatchPhrase(id: "help-where-is-my-aac", label: "Where is my AAC", sfSymbol: "exclamationmark.triangle", isEmergency: false),
            WatchPhrase(id: "help-my-battery-is-low", label: "My battery is low", sfSymbol: "exclamationmark.triangle", isEmergency: false),
            WatchPhrase(id: "help-i-dropped-my-tablet", label: "I dropped my tablet", sfSymbol: "exclamationmark.triangle", isEmergency: false),
        ]),
        WatchCategory(id: "quick-talk", icon: "bubble.left.and.bubble.right.fill", name: "Quick Talk", phrases: [
            WatchPhrase(id: "qt-hello", label: "Hello", sfSymbol: "bubble.left", isEmergency: false),
            WatchPhrase(id: "qt-goodbye", label: "Goodbye", sfSymbol: "bubble.left", isEmergency: false),
            WatchPhrase(id: "qt-thank-you", label: "Thank you", sfSymbol: "bubble.left", isEmergency: false),
            WatchPhrase(id: "qt-please", label: "Please", sfSymbol: "bubble.left", isEmergency: false),
            WatchPhrase(id: "qt-excuse-me", label: "Excuse me", sfSymbol: "bubble.left", isEmergency: false),
            WatchPhrase(id: "qt-wait", label: "Wait", sfSymbol: "bubble.left", isEmergency: false),
            WatchPhrase(id: "qt-come-here", label: "Come here", sfSymbol: "bubble.left", isEmergency: false),
            WatchPhrase(id: "qt-how-are-you", label: "How are you?", sfSymbol: "bubble.left", isEmergency: false),
            WatchPhrase(id: "qt-sorry", label: "Sorry", sfSymbol: "bubble.left", isEmergency: false),
            WatchPhrase(id: "qt-my-name", label: "My name is", sfSymbol: "bubble.left", isEmergency: false),
            WatchPhrase(id: "qt-nice-meet", label: "Nice to meet you", sfSymbol: "bubble.left", isEmergency: false),
            WatchPhrase(id: "qt-see-later", label: "See you later", sfSymbol: "bubble.left", isEmergency: false),
            WatchPhrase(id: "qt-hi", label: "Hi", sfSymbol: "bubble.left", isEmergency: false),
            WatchPhrase(id: "qt-hey", label: "Hey", sfSymbol: "bubble.left", isEmergency: false),
            WatchPhrase(id: "qt-bye", label: "Bye", sfSymbol: "bubble.left", isEmergency: false),
            WatchPhrase(id: "qt-bye-bye", label: "Bye-bye", sfSymbol: "bubble.left", isEmergency: false),
            WatchPhrase(id: "qt-see-you", label: "See you", sfSymbol: "bubble.left", isEmergency: false),
            WatchPhrase(id: "qt-see-you-soon", label: "See you soon", sfSymbol: "bubble.left", isEmergency: false),
            WatchPhrase(id: "qt-see-you-tomorrow", label: "See you tomorrow", sfSymbol: "bubble.left", isEmergency: false),
            WatchPhrase(id: "qt-take-care", label: "Take care", sfSymbol: "bubble.left", isEmergency: false),
            WatchPhrase(id: "qt-have-fun", label: "Have fun", sfSymbol: "bubble.left", isEmergency: false),
            WatchPhrase(id: "qt-good-morning", label: "Good morning", sfSymbol: "bubble.left", isEmergency: false),
            WatchPhrase(id: "qt-good-afternoon", label: "Good afternoon", sfSymbol: "bubble.left", isEmergency: false),
            WatchPhrase(id: "qt-good-evening", label: "Good evening", sfSymbol: "bubble.left", isEmergency: false),
            WatchPhrase(id: "qt-good-night", label: "Good night", sfSymbol: "bubble.left", isEmergency: false),
            WatchPhrase(id: "qt-good-job", label: "Good job", sfSymbol: "bubble.left", isEmergency: false),
            WatchPhrase(id: "qt-well-done", label: "Well done", sfSymbol: "bubble.left", isEmergency: false),
            WatchPhrase(id: "qt-way-to-go", label: "Way to go", sfSymbol: "bubble.left", isEmergency: false),
            WatchPhrase(id: "qt-awesome", label: "Awesome", sfSymbol: "bubble.left", isEmergency: false),
            WatchPhrase(id: "qt-cool", label: "Cool", sfSymbol: "bubble.left", isEmergency: false),
            WatchPhrase(id: "qt-nice", label: "Nice", sfSymbol: "bubble.left", isEmergency: false),
            WatchPhrase(id: "qt-great", label: "Great", sfSymbol: "bubble.left", isEmergency: false),
            WatchPhrase(id: "qt-wonderful", label: "Wonderful", sfSymbol: "bubble.left", isEmergency: false),
            WatchPhrase(id: "qt-amazing", label: "Amazing", sfSymbol: "bubble.left", isEmergency: false),
            WatchPhrase(id: "qt-perfect", label: "Perfect", sfSymbol: "bubble.left", isEmergency: false),
            WatchPhrase(id: "qt-yay", label: "Yay", sfSymbol: "bubble.left", isEmergency: false),
            WatchPhrase(id: "qt-okay", label: "Okay", sfSymbol: "bubble.left", isEmergency: false),
            WatchPhrase(id: "qt-alright", label: "Alright", sfSymbol: "bubble.left", isEmergency: false),
            WatchPhrase(id: "qt-sure", label: "Sure", sfSymbol: "bubble.left", isEmergency: false),
            WatchPhrase(id: "qt-of-course", label: "Of course", sfSymbol: "bubble.left", isEmergency: false),
            WatchPhrase(id: "qt-definitely", label: "Definitely", sfSymbol: "bubble.left", isEmergency: false),
            WatchPhrase(id: "qt-maybe", label: "Maybe", sfSymbol: "bubble.left", isEmergency: false),
            WatchPhrase(id: "qt-i-think-so", label: "I think so", sfSymbol: "bubble.left", isEmergency: false),
            WatchPhrase(id: "qt-i-am-not-sure", label: "I am not sure", sfSymbol: "bubble.left", isEmergency: false),
            WatchPhrase(id: "qt-it-is-fine", label: "It is fine", sfSymbol: "bubble.left", isEmergency: false),
            WatchPhrase(id: "qt-no-problem", label: "No problem", sfSymbol: "bubble.left", isEmergency: false),
            WatchPhrase(id: "qt-no-worries", label: "No worries", sfSymbol: "bubble.left", isEmergency: false),
            WatchPhrase(id: "qt-never-mind", label: "Never mind", sfSymbol: "bubble.left", isEmergency: false),
            WatchPhrase(id: "qt-my-bad", label: "My bad", sfSymbol: "bubble.left", isEmergency: false),
            WatchPhrase(id: "qt-oops", label: "Oops", sfSymbol: "bubble.left", isEmergency: false),
            WatchPhrase(id: "qt-bless-you", label: "Bless you", sfSymbol: "bubble.left", isEmergency: false),
            WatchPhrase(id: "qt-happy-birthday", label: "Happy birthday", sfSymbol: "bubble.left", isEmergency: false),
            WatchPhrase(id: "qt-happy-holidays", label: "Happy holidays", sfSymbol: "bubble.left", isEmergency: false),
            WatchPhrase(id: "qt-merry-christmas", label: "Merry Christmas", sfSymbol: "bubble.left", isEmergency: false),
            WatchPhrase(id: "qt-happy-new-year", label: "Happy New Year", sfSymbol: "bubble.left", isEmergency: false),
            WatchPhrase(id: "qt-eid-mubarak", label: "Eid Mubarak", sfSymbol: "bubble.left", isEmergency: false),
            WatchPhrase(id: "qt-happy-hanukkah", label: "Happy Hanukkah", sfSymbol: "bubble.left", isEmergency: false),
            WatchPhrase(id: "qt-congratulations", label: "Congratulations", sfSymbol: "bubble.left", isEmergency: false),
            WatchPhrase(id: "qt-i-am-proud-of-you", label: "I am proud of you", sfSymbol: "bubble.left", isEmergency: false),
            WatchPhrase(id: "qt-you-did-it", label: "You did it", sfSymbol: "bubble.left", isEmergency: false),
            WatchPhrase(id: "qt-how-was-your-day", label: "How was your day", sfSymbol: "bubble.left", isEmergency: false),
            WatchPhrase(id: "qt-i-had-a-good-day", label: "I had a good day", sfSymbol: "bubble.left", isEmergency: false),
            WatchPhrase(id: "qt-i-had-a-bad-day", label: "I had a bad day", sfSymbol: "bubble.left", isEmergency: false),
            WatchPhrase(id: "qt-tell-me-about-your-day", label: "Tell me about your day", sfSymbol: "bubble.left", isEmergency: false),
            WatchPhrase(id: "qt-i-missed-you", label: "I missed you", sfSymbol: "bubble.left", isEmergency: false),
            WatchPhrase(id: "qt-i-am-here", label: "I am here", sfSymbol: "bubble.left", isEmergency: false),
            WatchPhrase(id: "qt-i-love-you-too", label: "I love you too", sfSymbol: "bubble.left", isEmergency: false),
            WatchPhrase(id: "qt-you-are-my-friend", label: "You are my friend", sfSymbol: "bubble.left", isEmergency: false),
            WatchPhrase(id: "qt-best-friends", label: "Best friends", sfSymbol: "bubble.left", isEmergency: false),
        ]),
        WatchCategory(id: "feelings", icon: "face.smiling", name: "Feelings", phrases: [
            WatchPhrase(id: "fe-happy", label: "Happy", sfSymbol: "face.smiling", isEmergency: false),
            WatchPhrase(id: "fe-sad", label: "Sad", sfSymbol: "face.smiling", isEmergency: false),
            WatchPhrase(id: "fe-angry", label: "Angry", sfSymbol: "face.smiling", isEmergency: false),
            WatchPhrase(id: "fe-scared", label: "Scared", sfSymbol: "face.smiling", isEmergency: false),
            WatchPhrase(id: "fe-excited", label: "Excited", sfSymbol: "face.smiling", isEmergency: false),
            WatchPhrase(id: "fe-frustrated", label: "Frustrated", sfSymbol: "face.smiling", isEmergency: false),
            WatchPhrase(id: "fe-bored", label: "Bored", sfSymbol: "face.smiling", isEmergency: false),
            WatchPhrase(id: "fe-surprised", label: "Surprised", sfSymbol: "face.smiling", isEmergency: false),
            WatchPhrase(id: "fe-confused", label: "Confused", sfSymbol: "face.smiling", isEmergency: false),
            WatchPhrase(id: "fe-proud", label: "Proud", sfSymbol: "face.smiling", isEmergency: false),
            WatchPhrase(id: "fe-nervous", label: "Nervous", sfSymbol: "face.smiling", isEmergency: false),
            WatchPhrase(id: "fe-silly", label: "Silly", sfSymbol: "face.smiling", isEmergency: false),
            WatchPhrase(id: "fe-love", label: "I love you", sfSymbol: "face.smiling", isEmergency: false),
            WatchPhrase(id: "fe-hurt", label: "My feelings are hurt", sfSymbol: "face.smiling", isEmergency: false),
            WatchPhrase(id: "fe-calm", label: "Calm", sfSymbol: "face.smiling", isEmergency: false),
            WatchPhrase(id: "fe-peaceful", label: "Peaceful", sfSymbol: "face.smiling", isEmergency: false),
            WatchPhrase(id: "fe-relaxed", label: "Relaxed", sfSymbol: "face.smiling", isEmergency: false),
            WatchPhrase(id: "fe-content", label: "Content", sfSymbol: "face.smiling", isEmergency: false),
            WatchPhrase(id: "fe-joyful", label: "Joyful", sfSymbol: "face.smiling", isEmergency: false),
            WatchPhrase(id: "fe-glad", label: "Glad", sfSymbol: "face.smiling", isEmergency: false),
            WatchPhrase(id: "fe-cheerful", label: "Cheerful", sfSymbol: "face.smiling", isEmergency: false),
            WatchPhrase(id: "fe-hopeful", label: "Hopeful", sfSymbol: "face.smiling", isEmergency: false),
            WatchPhrase(id: "fe-grateful", label: "Grateful", sfSymbol: "face.smiling", isEmergency: false),
            WatchPhrase(id: "fe-thankful", label: "Thankful", sfSymbol: "face.smiling", isEmergency: false),
            WatchPhrase(id: "fe-loved", label: "Loved", sfSymbol: "face.smiling", isEmergency: false),
            WatchPhrase(id: "fe-safe", label: "Safe", sfSymbol: "face.smiling", isEmergency: false),
            WatchPhrase(id: "fe-comfortable", label: "Comfortable", sfSymbol: "face.smiling", isEmergency: false),
            WatchPhrase(id: "fe-warm-inside", label: "Warm inside", sfSymbol: "face.smiling", isEmergency: false),
            WatchPhrase(id: "fe-tired", label: "Tired", sfSymbol: "face.smiling", isEmergency: false),
            WatchPhrase(id: "fe-sleepy", label: "Sleepy", sfSymbol: "face.smiling", isEmergency: false),
            WatchPhrase(id: "fe-hungry", label: "Hungry", sfSymbol: "face.smiling", isEmergency: false),
            WatchPhrase(id: "fe-full", label: "Full", sfSymbol: "face.smiling", isEmergency: false),
            WatchPhrase(id: "fe-thirsty", label: "Thirsty", sfSymbol: "face.smiling", isEmergency: false),
            WatchPhrase(id: "fe-sick", label: "Sick", sfSymbol: "face.smiling", isEmergency: false),
            WatchPhrase(id: "fe-lonely", label: "Lonely", sfSymbol: "face.smiling", isEmergency: false),
            WatchPhrase(id: "fe-embarrassed", label: "Embarrassed", sfSymbol: "face.smiling", isEmergency: false),
            WatchPhrase(id: "fe-shy", label: "Shy", sfSymbol: "face.smiling", isEmergency: false),
            WatchPhrase(id: "fe-ashamed", label: "Ashamed", sfSymbol: "face.smiling", isEmergency: false),
            WatchPhrase(id: "fe-guilty", label: "Guilty", sfSymbol: "face.smiling", isEmergency: false),
            WatchPhrase(id: "fe-jealous", label: "Jealous", sfSymbol: "face.smiling", isEmergency: false),
            WatchPhrase(id: "fe-disappointed", label: "Disappointed", sfSymbol: "face.smiling", isEmergency: false),
            WatchPhrase(id: "fe-annoyed", label: "Annoyed", sfSymbol: "face.smiling", isEmergency: false),
            WatchPhrase(id: "fe-anxious", label: "Anxious", sfSymbol: "face.smiling", isEmergency: false),
            WatchPhrase(id: "fe-worried", label: "Worried", sfSymbol: "face.smiling", isEmergency: false),
            WatchPhrase(id: "fe-stressed", label: "Stressed", sfSymbol: "face.smiling", isEmergency: false),
            WatchPhrase(id: "fe-panicked", label: "Panicked", sfSymbol: "face.smiling", isEmergency: false),
            WatchPhrase(id: "fe-terrified", label: "Terrified", sfSymbol: "face.smiling", isEmergency: false),
            WatchPhrase(id: "fe-brave", label: "Brave", sfSymbol: "face.smiling", isEmergency: false),
            WatchPhrase(id: "fe-strong", label: "Strong", sfSymbol: "face.smiling", isEmergency: false),
            WatchPhrase(id: "fe-weak", label: "Weak", sfSymbol: "face.smiling", isEmergency: false),
            WatchPhrase(id: "fe-dizzy", label: "Dizzy", sfSymbol: "face.smiling", isEmergency: false),
            WatchPhrase(id: "fe-itchy", label: "Itchy", sfSymbol: "face.smiling", isEmergency: false),
            WatchPhrase(id: "fe-ticklish", label: "Ticklish", sfSymbol: "face.smiling", isEmergency: false),
            WatchPhrase(id: "fe-numb", label: "Numb", sfSymbol: "face.smiling", isEmergency: false),
            WatchPhrase(id: "fe-cold-inside", label: "Cold inside", sfSymbol: "face.smiling", isEmergency: false),
            WatchPhrase(id: "fe-empty", label: "Empty", sfSymbol: "face.smiling", isEmergency: false),
            WatchPhrase(id: "fe-heavy-heart", label: "Heavy heart", sfSymbol: "face.smiling", isEmergency: false),
            WatchPhrase(id: "fe-mixed-up", label: "Mixed up", sfSymbol: "face.smiling", isEmergency: false),
            WatchPhrase(id: "fe-confused-inside", label: "Confused inside", sfSymbol: "face.smiling", isEmergency: false),
            WatchPhrase(id: "fe-stuck", label: "Stuck", sfSymbol: "face.smiling", isEmergency: false),
            WatchPhrase(id: "fe-missing-someone", label: "Missing someone", sfSymbol: "face.smiling", isEmergency: false),
            WatchPhrase(id: "fe-homesick", label: "Homesick", sfSymbol: "face.smiling", isEmergency: false),
            WatchPhrase(id: "fe-overwhelmed", label: "Overwhelmed", sfSymbol: "face.smiling", isEmergency: false),
            WatchPhrase(id: "fe-done-with-this", label: "Done with this", sfSymbol: "face.smiling", isEmergency: false),
            WatchPhrase(id: "fe-i-have-had-enough", label: "I have had enough", sfSymbol: "face.smiling", isEmergency: false),
            WatchPhrase(id: "fe-i-feel-good", label: "I feel good", sfSymbol: "face.smiling", isEmergency: false),
            WatchPhrase(id: "fe-i-feel-bad", label: "I feel bad", sfSymbol: "face.smiling", isEmergency: false),
            WatchPhrase(id: "fe-i-feel-okay", label: "I feel okay", sfSymbol: "face.smiling", isEmergency: false),
            WatchPhrase(id: "fe-i-feel-weird", label: "I feel weird", sfSymbol: "face.smiling", isEmergency: false),
        ]),
        WatchCategory(id: "questions", icon: "questionmark.circle.fill", name: "Questions", phrases: [
            WatchPhrase(id: "qu-what", label: "What?", sfSymbol: "questionmark.circle", isEmergency: false),
            WatchPhrase(id: "qu-where", label: "Where?", sfSymbol: "questionmark.circle", isEmergency: false),
            WatchPhrase(id: "qu-when", label: "When?", sfSymbol: "questionmark.circle", isEmergency: false),
            WatchPhrase(id: "qu-who", label: "Who?", sfSymbol: "questionmark.circle", isEmergency: false),
            WatchPhrase(id: "qu-why", label: "Why?", sfSymbol: "questionmark.circle", isEmergency: false),
            WatchPhrase(id: "qu-how", label: "How?", sfSymbol: "questionmark.circle", isEmergency: false),
            WatchPhrase(id: "qu-which", label: "Which one?", sfSymbol: "questionmark.circle", isEmergency: false),
            WatchPhrase(id: "qu-how-many", label: "How many?", sfSymbol: "questionmark.circle", isEmergency: false),
            WatchPhrase(id: "qu-can-i", label: "Can I?", sfSymbol: "questionmark.circle", isEmergency: false),
            WatchPhrase(id: "qu-is-it", label: "Is it?", sfSymbol: "questionmark.circle", isEmergency: false),
            WatchPhrase(id: "qu-where-going", label: "Where are we going?", sfSymbol: "questionmark.circle", isEmergency: false),
            WatchPhrase(id: "qu-who-is-that", label: "Who is that", sfSymbol: "questionmark.circle", isEmergency: false),
            WatchPhrase(id: "qu-what-is-that", label: "What is that", sfSymbol: "questionmark.circle", isEmergency: false),
            WatchPhrase(id: "qu-where-is-it", label: "Where is it", sfSymbol: "questionmark.circle", isEmergency: false),
            WatchPhrase(id: "qu-when-is-it", label: "When is it", sfSymbol: "questionmark.circle", isEmergency: false),
            WatchPhrase(id: "qu-why-is-that", label: "Why is that", sfSymbol: "questionmark.circle", isEmergency: false),
            WatchPhrase(id: "qu-how-does-it-work", label: "How does it work", sfSymbol: "questionmark.circle", isEmergency: false),
            WatchPhrase(id: "qu-how-do-i", label: "How do I", sfSymbol: "questionmark.circle", isEmergency: false),
            WatchPhrase(id: "qu-can-i-have-it", label: "Can I have it", sfSymbol: "questionmark.circle", isEmergency: false),
            WatchPhrase(id: "qu-can-i-try", label: "Can I try", sfSymbol: "questionmark.circle", isEmergency: false),
            WatchPhrase(id: "qu-can-i-go", label: "Can I go", sfSymbol: "questionmark.circle", isEmergency: false),
            WatchPhrase(id: "qu-may-i-please", label: "May I please", sfSymbol: "questionmark.circle", isEmergency: false),
            WatchPhrase(id: "qu-will-you-help", label: "Will you help", sfSymbol: "questionmark.circle", isEmergency: false),
            WatchPhrase(id: "qu-are-you-okay", label: "Are you okay", sfSymbol: "questionmark.circle", isEmergency: false),
            WatchPhrase(id: "qu-are-we-there-yet", label: "Are we there yet", sfSymbol: "questionmark.circle", isEmergency: false),
            WatchPhrase(id: "qu-where-are-we-going", label: "Where are we going", sfSymbol: "questionmark.circle", isEmergency: false),
            WatchPhrase(id: "qu-when-will-we-be-there", label: "When will we be there", sfSymbol: "questionmark.circle", isEmergency: false),
            WatchPhrase(id: "qu-how-much-longer", label: "How much longer", sfSymbol: "questionmark.circle", isEmergency: false),
            WatchPhrase(id: "qu-what-time-is-it", label: "What time is it", sfSymbol: "questionmark.circle", isEmergency: false),
            WatchPhrase(id: "qu-what-day-is-it", label: "What day is it", sfSymbol: "questionmark.circle", isEmergency: false),
            WatchPhrase(id: "qu-is-it-ready-yet", label: "Is it ready yet", sfSymbol: "questionmark.circle", isEmergency: false),
            WatchPhrase(id: "qu-can-we-go-now", label: "Can we go now", sfSymbol: "questionmark.circle", isEmergency: false),
            WatchPhrase(id: "qu-can-we-do-this", label: "Can we do this", sfSymbol: "questionmark.circle", isEmergency: false),
            WatchPhrase(id: "qu-did-you-see-that", label: "Did you see that", sfSymbol: "questionmark.circle", isEmergency: false),
            WatchPhrase(id: "qu-did-i-do-good", label: "Did I do good", sfSymbol: "questionmark.circle", isEmergency: false),
            WatchPhrase(id: "qu-what-happened", label: "What happened", sfSymbol: "questionmark.circle", isEmergency: false),
            WatchPhrase(id: "qu-where-did-it-go", label: "Where did it go", sfSymbol: "questionmark.circle", isEmergency: false),
            WatchPhrase(id: "qu-who-said-that", label: "Who said that", sfSymbol: "questionmark.circle", isEmergency: false),
            WatchPhrase(id: "qu-what-did-they-say", label: "What did they say", sfSymbol: "questionmark.circle", isEmergency: false),
            WatchPhrase(id: "qu-how-old-are-you", label: "How old are you", sfSymbol: "questionmark.circle", isEmergency: false),
            WatchPhrase(id: "qu-what-is-your-name", label: "What is your name", sfSymbol: "questionmark.circle", isEmergency: false),
            WatchPhrase(id: "qu-how-are-you-feeling", label: "How are you feeling", sfSymbol: "questionmark.circle", isEmergency: false),
            WatchPhrase(id: "qu-what-is-for-dinner", label: "What is for dinner", sfSymbol: "questionmark.circle", isEmergency: false),
            WatchPhrase(id: "qu-what-is-for-snack", label: "What is for snack", sfSymbol: "questionmark.circle", isEmergency: false),
            WatchPhrase(id: "qu-is-it-bedtime", label: "Is it bedtime", sfSymbol: "questionmark.circle", isEmergency: false),
            WatchPhrase(id: "qu-are-you-my-friend", label: "Are you my friend", sfSymbol: "questionmark.circle", isEmergency: false),
            WatchPhrase(id: "qu-will-you-play-with-me", label: "Will you play with me", sfSymbol: "questionmark.circle", isEmergency: false),
        ]),
        WatchCategory(id: "actions", icon: "figure.run", name: "Actions", phrases: [
            WatchPhrase(id: "ac-go", label: "Go", sfSymbol: "figure.walk", isEmergency: false),
            WatchPhrase(id: "ac-stop", label: "Stop", sfSymbol: "figure.walk", isEmergency: false),
            WatchPhrase(id: "ac-eat", label: "Eat", sfSymbol: "figure.walk", isEmergency: false),
            WatchPhrase(id: "ac-drink", label: "Drink", sfSymbol: "figure.walk", isEmergency: false),
            WatchPhrase(id: "ac-play", label: "Play", sfSymbol: "figure.walk", isEmergency: false),
            WatchPhrase(id: "ac-read", label: "Read", sfSymbol: "figure.walk", isEmergency: false),
            WatchPhrase(id: "ac-watch", label: "Watch", sfSymbol: "figure.walk", isEmergency: false),
            WatchPhrase(id: "ac-listen", label: "Listen", sfSymbol: "figure.walk", isEmergency: false),
            WatchPhrase(id: "ac-open", label: "Open", sfSymbol: "figure.walk", isEmergency: false),
            WatchPhrase(id: "ac-close", label: "Close", sfSymbol: "figure.walk", isEmergency: false),
            WatchPhrase(id: "ac-give", label: "Give", sfSymbol: "figure.walk", isEmergency: false),
            WatchPhrase(id: "ac-take", label: "Take", sfSymbol: "figure.walk", isEmergency: false),
            WatchPhrase(id: "ac-look", label: "Look", sfSymbol: "figure.walk", isEmergency: false),
            WatchPhrase(id: "ac-sit", label: "Sit", sfSymbol: "figure.walk", isEmergency: false),
            WatchPhrase(id: "ac-stand", label: "Stand up", sfSymbol: "figure.walk", isEmergency: false),
            WatchPhrase(id: "ac-walk", label: "Walk", sfSymbol: "figure.walk", isEmergency: false),
            WatchPhrase(id: "ac-run", label: "Run", sfSymbol: "figure.walk", isEmergency: false),
            WatchPhrase(id: "ac-write", label: "Write", sfSymbol: "figure.walk", isEmergency: false),
            WatchPhrase(id: "ac-draw", label: "Draw", sfSymbol: "figure.walk", isEmergency: false),
            WatchPhrase(id: "ac-make", label: "Make", sfSymbol: "figure.walk", isEmergency: false),
            WatchPhrase(id: "ac-put", label: "Put", sfSymbol: "figure.walk", isEmergency: false),
            WatchPhrase(id: "ac-get", label: "Get", sfSymbol: "figure.walk", isEmergency: false),
            WatchPhrase(id: "ac-turn", label: "Turn", sfSymbol: "figure.walk", isEmergency: false),
            WatchPhrase(id: "ac-wash", label: "Wash", sfSymbol: "figure.walk", isEmergency: false),
            WatchPhrase(id: "ac-wave", label: "Wave", sfSymbol: "figure.walk", isEmergency: false),
            WatchPhrase(id: "ac-clap", label: "Clap", sfSymbol: "figure.walk", isEmergency: false),
            WatchPhrase(id: "ac-point", label: "Point", sfSymbol: "figure.walk", isEmergency: false),
            WatchPhrase(id: "ac-nod", label: "Nod", sfSymbol: "figure.walk", isEmergency: false),
            WatchPhrase(id: "ac-shake-head", label: "Shake head", sfSymbol: "figure.walk", isEmergency: false),
            WatchPhrase(id: "ac-whisper", label: "Whisper", sfSymbol: "figure.walk", isEmergency: false),
            WatchPhrase(id: "ac-shout", label: "Shout", sfSymbol: "figure.walk", isEmergency: false),
            WatchPhrase(id: "ac-sing", label: "Sing", sfSymbol: "figure.walk", isEmergency: false),
            WatchPhrase(id: "ac-hum", label: "Hum", sfSymbol: "figure.walk", isEmergency: false),
            WatchPhrase(id: "ac-roll", label: "Roll", sfSymbol: "figure.walk", isEmergency: false),
            WatchPhrase(id: "ac-slide", label: "Slide", sfSymbol: "figure.walk", isEmergency: false),
            WatchPhrase(id: "ac-spin", label: "Spin", sfSymbol: "figure.walk", isEmergency: false),
            WatchPhrase(id: "ac-hop", label: "Hop", sfSymbol: "figure.walk", isEmergency: false),
            WatchPhrase(id: "ac-skip", label: "Skip", sfSymbol: "figure.walk", isEmergency: false),
            WatchPhrase(id: "ac-crawl", label: "Crawl", sfSymbol: "figure.walk", isEmergency: false),
            WatchPhrase(id: "ac-tiptoe", label: "Tiptoe", sfSymbol: "figure.walk", isEmergency: false),
            WatchPhrase(id: "ac-tip-toe", label: "Tip-toe", sfSymbol: "figure.walk", isEmergency: false),
            WatchPhrase(id: "ac-march", label: "March", sfSymbol: "figure.walk", isEmergency: false),
            WatchPhrase(id: "ac-climb-up", label: "Climb up", sfSymbol: "figure.walk", isEmergency: false),
            WatchPhrase(id: "ac-climb-down", label: "Climb down", sfSymbol: "figure.walk", isEmergency: false),
            WatchPhrase(id: "ac-push-it", label: "Push it", sfSymbol: "figure.walk", isEmergency: false),
            WatchPhrase(id: "ac-pull-it", label: "Pull it", sfSymbol: "figure.walk", isEmergency: false),
            WatchPhrase(id: "ac-pick-it-up", label: "Pick it up", sfSymbol: "figure.walk", isEmergency: false),
            WatchPhrase(id: "ac-set-it-down", label: "Set it down", sfSymbol: "figure.walk", isEmergency: false),
            WatchPhrase(id: "ac-pour", label: "Pour", sfSymbol: "figure.walk", isEmergency: false),
            WatchPhrase(id: "ac-stir", label: "Stir", sfSymbol: "figure.walk", isEmergency: false),
            WatchPhrase(id: "ac-mix", label: "Mix", sfSymbol: "figure.walk", isEmergency: false),
            WatchPhrase(id: "ac-spread", label: "Spread", sfSymbol: "figure.walk", isEmergency: false),
            WatchPhrase(id: "ac-fold", label: "Fold", sfSymbol: "figure.walk", isEmergency: false),
            WatchPhrase(id: "ac-tie", label: "Tie", sfSymbol: "figure.walk", isEmergency: false),
            WatchPhrase(id: "ac-untie", label: "Untie", sfSymbol: "figure.walk", isEmergency: false),
            WatchPhrase(id: "ac-zip", label: "Zip", sfSymbol: "figure.walk", isEmergency: false),
            WatchPhrase(id: "ac-unzip", label: "Unzip", sfSymbol: "figure.walk", isEmergency: false),
            WatchPhrase(id: "ac-snap", label: "Snap", sfSymbol: "figure.walk", isEmergency: false),
            WatchPhrase(id: "ac-buckle", label: "Buckle", sfSymbol: "figure.walk", isEmergency: false),
            WatchPhrase(id: "ac-brush-teeth", label: "Brush teeth", sfSymbol: "figure.walk", isEmergency: false),
            WatchPhrase(id: "ac-brush-hair", label: "Brush hair", sfSymbol: "figure.walk", isEmergency: false),
            WatchPhrase(id: "ac-comb", label: "Comb", sfSymbol: "figure.walk", isEmergency: false),
            WatchPhrase(id: "ac-floss", label: "Floss", sfSymbol: "figure.walk", isEmergency: false),
            WatchPhrase(id: "ac-get-dressed", label: "Get dressed", sfSymbol: "figure.walk", isEmergency: false),
            WatchPhrase(id: "ac-get-undressed", label: "Get undressed", sfSymbol: "figure.walk", isEmergency: false),
            WatchPhrase(id: "ac-put-on-shoes", label: "Put on shoes", sfSymbol: "figure.walk", isEmergency: false),
            WatchPhrase(id: "ac-take-off-shoes", label: "Take off shoes", sfSymbol: "figure.walk", isEmergency: false),
            WatchPhrase(id: "ac-wash-hands", label: "Wash hands", sfSymbol: "figure.walk", isEmergency: false),
            WatchPhrase(id: "ac-take-a-bath", label: "Take a bath", sfSymbol: "figure.walk", isEmergency: false),
            WatchPhrase(id: "ac-take-a-shower", label: "Take a shower", sfSymbol: "figure.walk", isEmergency: false),
            WatchPhrase(id: "ac-sleep", label: "Sleep", sfSymbol: "figure.walk", isEmergency: false),
            WatchPhrase(id: "ac-take-a-nap", label: "Take a nap", sfSymbol: "figure.walk", isEmergency: false),
            WatchPhrase(id: "ac-wake-up", label: "Wake up", sfSymbol: "figure.walk", isEmergency: false),
            WatchPhrase(id: "ac-wait-for", label: "Wait for", sfSymbol: "figure.walk", isEmergency: false),
            WatchPhrase(id: "ac-look-for", label: "Look for", sfSymbol: "figure.walk", isEmergency: false),
            WatchPhrase(id: "ac-search", label: "Search", sfSymbol: "figure.walk", isEmergency: false),
            WatchPhrase(id: "ac-discover", label: "Discover", sfSymbol: "figure.walk", isEmergency: false),
            WatchPhrase(id: "ac-hide", label: "Hide", sfSymbol: "figure.walk", isEmergency: false),
            WatchPhrase(id: "ac-seek", label: "Seek", sfSymbol: "figure.walk", isEmergency: false),
            WatchPhrase(id: "ac-tag", label: "Tag", sfSymbol: "figure.walk", isEmergency: false),
            WatchPhrase(id: "ac-race", label: "Race", sfSymbol: "figure.walk", isEmergency: false),
            WatchPhrase(id: "ac-cuddle", label: "Cuddle", sfSymbol: "figure.walk", isEmergency: false),
            WatchPhrase(id: "ac-snuggle", label: "Snuggle", sfSymbol: "figure.walk", isEmergency: false),
            WatchPhrase(id: "ac-pat", label: "Pat", sfSymbol: "figure.walk", isEmergency: false),
            WatchPhrase(id: "ac-tickle", label: "Tickle", sfSymbol: "figure.walk", isEmergency: false),
            WatchPhrase(id: "ac-sweep", label: "Sweep", sfSymbol: "figure.walk", isEmergency: false),
            WatchPhrase(id: "ac-mop", label: "Mop", sfSymbol: "figure.walk", isEmergency: false),
            WatchPhrase(id: "ac-vacuum", label: "Vacuum", sfSymbol: "figure.walk", isEmergency: false),
            WatchPhrase(id: "ac-dust", label: "Dust", sfSymbol: "figure.walk", isEmergency: false),
            WatchPhrase(id: "ac-carry-it", label: "Carry it", sfSymbol: "figure.walk", isEmergency: false),
            WatchPhrase(id: "ac-drop-it", label: "Drop it", sfSymbol: "figure.walk", isEmergency: false),
            WatchPhrase(id: "ac-toss-it", label: "Toss it", sfSymbol: "figure.walk", isEmergency: false),
            WatchPhrase(id: "ac-roll-it", label: "Roll it", sfSymbol: "figure.walk", isEmergency: false),
        ]),
        WatchCategory(id: "describing", icon: "paintpalette.fill", name: "Describing Words", phrases: [
            WatchPhrase(id: "dw-big", label: "Big", sfSymbol: "paintpalette", isEmergency: false),
            WatchPhrase(id: "dw-small", label: "Small", sfSymbol: "paintpalette", isEmergency: false),
            WatchPhrase(id: "dw-hot", label: "Hot", sfSymbol: "paintpalette", isEmergency: false),
            WatchPhrase(id: "dw-cold", label: "Cold", sfSymbol: "paintpalette", isEmergency: false),
            WatchPhrase(id: "dw-good", label: "Good", sfSymbol: "paintpalette", isEmergency: false),
            WatchPhrase(id: "dw-bad", label: "Bad", sfSymbol: "paintpalette", isEmergency: false),
            WatchPhrase(id: "dw-fast", label: "Fast", sfSymbol: "paintpalette", isEmergency: false),
            WatchPhrase(id: "dw-slow", label: "Slow", sfSymbol: "paintpalette", isEmergency: false),
            WatchPhrase(id: "dw-new", label: "New", sfSymbol: "paintpalette", isEmergency: false),
            WatchPhrase(id: "dw-old", label: "Old", sfSymbol: "paintpalette", isEmergency: false),
            WatchPhrase(id: "dw-same", label: "Same", sfSymbol: "paintpalette", isEmergency: false),
            WatchPhrase(id: "dw-different", label: "Different", sfSymbol: "paintpalette", isEmergency: false),
            WatchPhrase(id: "dw-funny", label: "Funny", sfSymbol: "paintpalette", isEmergency: false),
            WatchPhrase(id: "dw-pretty", label: "Pretty", sfSymbol: "paintpalette", isEmergency: false),
            WatchPhrase(id: "dw-yucky", label: "Yucky", sfSymbol: "paintpalette", isEmergency: false),
            WatchPhrase(id: "dw-favorite", label: "Favorite", sfSymbol: "paintpalette", isEmergency: false),
            WatchPhrase(id: "dw-tall", label: "Tall", sfSymbol: "paintpalette", isEmergency: false),
            WatchPhrase(id: "dw-short", label: "Short", sfSymbol: "paintpalette", isEmergency: false),
            WatchPhrase(id: "dw-long", label: "Long", sfSymbol: "paintpalette", isEmergency: false),
            WatchPhrase(id: "dw-wide", label: "Wide", sfSymbol: "paintpalette", isEmergency: false),
            WatchPhrase(id: "dw-narrow", label: "Narrow", sfSymbol: "paintpalette", isEmergency: false),
            WatchPhrase(id: "dw-thick", label: "Thick", sfSymbol: "paintpalette", isEmergency: false),
            WatchPhrase(id: "dw-thin", label: "Thin", sfSymbol: "paintpalette", isEmergency: false),
            WatchPhrase(id: "dw-round", label: "Round", sfSymbol: "paintpalette", isEmergency: false),
            WatchPhrase(id: "dw-square", label: "Square", sfSymbol: "paintpalette", isEmergency: false),
            WatchPhrase(id: "dw-smooth", label: "Smooth", sfSymbol: "paintpalette", isEmergency: false),
            WatchPhrase(id: "dw-rough", label: "Rough", sfSymbol: "paintpalette", isEmergency: false),
            WatchPhrase(id: "dw-sticky", label: "Sticky", sfSymbol: "paintpalette", isEmergency: false),
            WatchPhrase(id: "dw-wet", label: "Wet", sfSymbol: "paintpalette", isEmergency: false),
            WatchPhrase(id: "dw-dry", label: "Dry", sfSymbol: "paintpalette", isEmergency: false),
            WatchPhrase(id: "dw-clean", label: "Clean", sfSymbol: "paintpalette", isEmergency: false),
            WatchPhrase(id: "dw-dirty", label: "Dirty", sfSymbol: "paintpalette", isEmergency: false),
            WatchPhrase(id: "dw-soft", label: "Soft", sfSymbol: "paintpalette", isEmergency: false),
            WatchPhrase(id: "dw-hard", label: "Hard", sfSymbol: "paintpalette", isEmergency: false),
            WatchPhrase(id: "dw-sweet", label: "Sweet", sfSymbol: "paintpalette", isEmergency: false),
            WatchPhrase(id: "dw-salty", label: "Salty", sfSymbol: "paintpalette", isEmergency: false),
            WatchPhrase(id: "dw-sour", label: "Sour", sfSymbol: "paintpalette", isEmergency: false),
            WatchPhrase(id: "dw-spicy", label: "Spicy", sfSymbol: "paintpalette", isEmergency: false),
            WatchPhrase(id: "dw-bitter", label: "Bitter", sfSymbol: "paintpalette", isEmergency: false),
            WatchPhrase(id: "dw-quiet", label: "Quiet", sfSymbol: "paintpalette", isEmergency: false),
            WatchPhrase(id: "dw-loud", label: "Loud", sfSymbol: "paintpalette", isEmergency: false),
            WatchPhrase(id: "dw-bright", label: "Bright", sfSymbol: "paintpalette", isEmergency: false),
            WatchPhrase(id: "dw-dark", label: "Dark", sfSymbol: "paintpalette", isEmergency: false),
            WatchPhrase(id: "dw-shiny", label: "Shiny", sfSymbol: "paintpalette", isEmergency: false),
            WatchPhrase(id: "dw-heavy", label: "Heavy", sfSymbol: "paintpalette", isEmergency: false),
            WatchPhrase(id: "dw-light", label: "Light", sfSymbol: "paintpalette", isEmergency: false),
            WatchPhrase(id: "dw-empty", label: "Empty", sfSymbol: "paintpalette", isEmergency: false),
            WatchPhrase(id: "dw-full", label: "Full", sfSymbol: "paintpalette", isEmergency: false),
            WatchPhrase(id: "dw-easy", label: "Easy", sfSymbol: "paintpalette", isEmergency: false),
            WatchPhrase(id: "dw-tricky", label: "Tricky", sfSymbol: "paintpalette", isEmergency: false),
            WatchPhrase(id: "dw-simple", label: "Simple", sfSymbol: "paintpalette", isEmergency: false),
            WatchPhrase(id: "dw-fun", label: "Fun", sfSymbol: "paintpalette", isEmergency: false),
            WatchPhrase(id: "dw-boring", label: "Boring", sfSymbol: "paintpalette", isEmergency: false),
            WatchPhrase(id: "dw-cool", label: "Cool", sfSymbol: "paintpalette", isEmergency: false),
            WatchPhrase(id: "dw-awesome", label: "Awesome", sfSymbol: "paintpalette", isEmergency: false),
            WatchPhrase(id: "dw-scary", label: "Scary", sfSymbol: "paintpalette", isEmergency: false),
            WatchPhrase(id: "dw-safe", label: "Safe", sfSymbol: "paintpalette", isEmergency: false),
            WatchPhrase(id: "dw-dangerous", label: "Dangerous", sfSymbol: "paintpalette", isEmergency: false),
            WatchPhrase(id: "dw-friendly", label: "Friendly", sfSymbol: "paintpalette", isEmergency: false),
            WatchPhrase(id: "dw-mean", label: "Mean", sfSymbol: "paintpalette", isEmergency: false),
            WatchPhrase(id: "dw-nice", label: "Nice", sfSymbol: "paintpalette", isEmergency: false),
            WatchPhrase(id: "dw-helpful", label: "Helpful", sfSymbol: "paintpalette", isEmergency: false),
            WatchPhrase(id: "dw-mine", label: "Mine", sfSymbol: "paintpalette", isEmergency: false),
            WatchPhrase(id: "dw-special", label: "Special", sfSymbol: "paintpalette", isEmergency: false),
        ]),
        WatchCategory(id: "people-social", icon: "person.3.fill", name: "People", phrases: [
            WatchPhrase(id: "pp-mom", label: "Mom", sfSymbol: "person.fill", isEmergency: false),
            WatchPhrase(id: "pp-dad", label: "Dad", sfSymbol: "person.fill", isEmergency: false),
            WatchPhrase(id: "pp-teacher", label: "Teacher", sfSymbol: "person.fill", isEmergency: false),
            WatchPhrase(id: "pp-friend", label: "Friend", sfSymbol: "person.fill", isEmergency: false),
            WatchPhrase(id: "pp-family", label: "Family", sfSymbol: "person.fill", isEmergency: false),
            WatchPhrase(id: "pp-doctor", label: "Doctor", sfSymbol: "person.fill", isEmergency: false),
            WatchPhrase(id: "pp-brother", label: "Brother", sfSymbol: "person.fill", isEmergency: false),
            WatchPhrase(id: "pp-sister", label: "Sister", sfSymbol: "person.fill", isEmergency: false),
            WatchPhrase(id: "pp-grandma", label: "Grandma", sfSymbol: "person.fill", isEmergency: false),
            WatchPhrase(id: "pp-grandpa", label: "Grandpa", sfSymbol: "person.fill", isEmergency: false),
            WatchPhrase(id: "pp-baby", label: "Baby", sfSymbol: "person.fill", isEmergency: false),
            WatchPhrase(id: "pp-boy", label: "Boy", sfSymbol: "person.fill", isEmergency: false),
            WatchPhrase(id: "pp-girl", label: "Girl", sfSymbol: "person.fill", isEmergency: false),
            WatchPhrase(id: "pp-therapist", label: "Therapist", sfSymbol: "person.fill", isEmergency: false),
            WatchPhrase(id: "pp-aunt", label: "Aunt", sfSymbol: "person.fill", isEmergency: false),
            WatchPhrase(id: "pp-uncle", label: "Uncle", sfSymbol: "person.fill", isEmergency: false),
            WatchPhrase(id: "pp-cousin", label: "Cousin", sfSymbol: "person.fill", isEmergency: false),
            WatchPhrase(id: "pp-stepmom", label: "Stepmom", sfSymbol: "person.fill", isEmergency: false),
            WatchPhrase(id: "pp-stepdad", label: "Stepdad", sfSymbol: "person.fill", isEmergency: false),
            WatchPhrase(id: "pp-bus-driver", label: "Bus driver", sfSymbol: "person.fill", isEmergency: false),
            WatchPhrase(id: "pp-coach", label: "Coach", sfSymbol: "person.fill", isEmergency: false),
            WatchPhrase(id: "pp-principal", label: "Principal", sfSymbol: "person.fill", isEmergency: false),
            WatchPhrase(id: "pp-counselor", label: "Counselor", sfSymbol: "person.fill", isEmergency: false),
            WatchPhrase(id: "pp-nurse", label: "Nurse", sfSymbol: "person.fill", isEmergency: false),
            WatchPhrase(id: "pp-dentist", label: "Dentist", sfSymbol: "person.fill", isEmergency: false),
            WatchPhrase(id: "pp-bcba", label: "BCBA", sfSymbol: "person.fill", isEmergency: false),
            WatchPhrase(id: "pp-rbt", label: "RBT", sfSymbol: "person.fill", isEmergency: false),
            WatchPhrase(id: "pp-babysitter", label: "Babysitter", sfSymbol: "person.fill", isEmergency: false),
            WatchPhrase(id: "pp-neighbor", label: "Neighbor", sfSymbol: "person.fill", isEmergency: false),
            WatchPhrase(id: "pp-helper", label: "Helper", sfSymbol: "person.fill", isEmergency: false),
            WatchPhrase(id: "pp-classmate", label: "Classmate", sfSymbol: "person.fill", isEmergency: false),
            WatchPhrase(id: "pp-best-friend", label: "Best friend", sfSymbol: "person.fill", isEmergency: false),
            WatchPhrase(id: "pp-new-friend", label: "New friend", sfSymbol: "person.fill", isEmergency: false),
            WatchPhrase(id: "pp-man", label: "Man", sfSymbol: "person.fill", isEmergency: false),
            WatchPhrase(id: "pp-woman", label: "Woman", sfSymbol: "person.fill", isEmergency: false),
            WatchPhrase(id: "pp-kid", label: "Kid", sfSymbol: "person.fill", isEmergency: false),
            WatchPhrase(id: "pp-grown-up", label: "Grown-up", sfSymbol: "person.fill", isEmergency: false),
            WatchPhrase(id: "pp-stranger", label: "Stranger", sfSymbol: "person.fill", isEmergency: false),
            WatchPhrase(id: "pp-police-officer", label: "Police officer", sfSymbol: "person.fill", isEmergency: false),
            WatchPhrase(id: "pp-firefighter", label: "Firefighter", sfSymbol: "person.fill", isEmergency: false),
            WatchPhrase(id: "pp-paramedic", label: "Paramedic", sfSymbol: "person.fill", isEmergency: false),
            WatchPhrase(id: "pp-my-family", label: "My family", sfSymbol: "person.fill", isEmergency: false),
            WatchPhrase(id: "pp-my-class", label: "My class", sfSymbol: "person.fill", isEmergency: false),
            WatchPhrase(id: "pp-my-team", label: "My team", sfSymbol: "person.fill", isEmergency: false),
            WatchPhrase(id: "pc-librarian", label: "Librarian", sfSymbol: "person.fill", isEmergency: false),
        ]),
        WatchCategory(id: "food-ordering", icon: "fork.knife", name: "Food & Drink", phrases: [
            WatchPhrase(id: "fd-water", label: "Water", sfSymbol: "fork.knife", isEmergency: false),
            WatchPhrase(id: "fd-juice", label: "Juice", sfSymbol: "fork.knife", isEmergency: false),
            WatchPhrase(id: "fd-milk", label: "Milk", sfSymbol: "fork.knife", isEmergency: false),
            WatchPhrase(id: "fd-pizza", label: "Pizza", sfSymbol: "fork.knife", isEmergency: false),
            WatchPhrase(id: "fd-sandwich", label: "Sandwich", sfSymbol: "fork.knife", isEmergency: false),
            WatchPhrase(id: "fd-chicken", label: "Chicken", sfSymbol: "fork.knife", isEmergency: false),
            WatchPhrase(id: "fd-fries", label: "Fries", sfSymbol: "fork.knife", isEmergency: false),
            WatchPhrase(id: "fd-fruit", label: "Fruit", sfSymbol: "fork.knife", isEmergency: false),
            WatchPhrase(id: "fd-snack", label: "Snack", sfSymbol: "fork.knife", isEmergency: false),
            WatchPhrase(id: "fd-more", label: "More please", sfSymbol: "fork.knife", isEmergency: false),
            WatchPhrase(id: "fd-no-thanks", label: "No thanks", sfSymbol: "fork.knife", isEmergency: false),
            WatchPhrase(id: "fd-cookie", label: "Cookie", sfSymbol: "fork.knife", isEmergency: false),
            WatchPhrase(id: "fd-apple", label: "Apple", sfSymbol: "fork.knife", isEmergency: false),
            WatchPhrase(id: "fd-banana", label: "Banana", sfSymbol: "fork.knife", isEmergency: false),
            WatchPhrase(id: "fd-cereal", label: "Cereal", sfSymbol: "fork.knife", isEmergency: false),
            WatchPhrase(id: "fd-cheese", label: "Cheese", sfSymbol: "fork.knife", isEmergency: false),
            WatchPhrase(id: "fd-ice-cream", label: "Ice cream", sfSymbol: "fork.knife", isEmergency: false),
            WatchPhrase(id: "fd-crackers", label: "Crackers", sfSymbol: "fork.knife", isEmergency: false),
            WatchPhrase(id: "fd-bread", label: "Bread", sfSymbol: "fork.knife", isEmergency: false),
            WatchPhrase(id: "fd-toast", label: "Toast", sfSymbol: "fork.knife", isEmergency: false),
            WatchPhrase(id: "fd-pancakes", label: "Pancakes", sfSymbol: "fork.knife", isEmergency: false),
            WatchPhrase(id: "fd-waffles", label: "Waffles", sfSymbol: "fork.knife", isEmergency: false),
            WatchPhrase(id: "fd-eggs", label: "Eggs", sfSymbol: "fork.knife", isEmergency: false),
            WatchPhrase(id: "fd-bacon", label: "Bacon", sfSymbol: "fork.knife", isEmergency: false),
            WatchPhrase(id: "fd-yogurt", label: "Yogurt", sfSymbol: "fork.knife", isEmergency: false),
            WatchPhrase(id: "fd-oatmeal", label: "Oatmeal", sfSymbol: "fork.knife", isEmergency: false),
            WatchPhrase(id: "fd-granola", label: "Granola", sfSymbol: "fork.knife", isEmergency: false),
            WatchPhrase(id: "fd-smoothie", label: "Smoothie", sfSymbol: "fork.knife", isEmergency: false),
            WatchPhrase(id: "fd-pasta", label: "Pasta", sfSymbol: "fork.knife", isEmergency: false),
            WatchPhrase(id: "fd-noodles", label: "Noodles", sfSymbol: "fork.knife", isEmergency: false),
            WatchPhrase(id: "fd-rice", label: "Rice", sfSymbol: "fork.knife", isEmergency: false),
            WatchPhrase(id: "fd-soup", label: "Soup", sfSymbol: "fork.knife", isEmergency: false),
            WatchPhrase(id: "fd-salad", label: "Salad", sfSymbol: "fork.knife", isEmergency: false),
            WatchPhrase(id: "fd-wrap", label: "Wrap", sfSymbol: "fork.knife", isEmergency: false),
            WatchPhrase(id: "fd-hamburger", label: "Hamburger", sfSymbol: "fork.knife", isEmergency: false),
            WatchPhrase(id: "fd-hot-dog", label: "Hot dog", sfSymbol: "fork.knife", isEmergency: false),
            WatchPhrase(id: "fd-taco", label: "Taco", sfSymbol: "fork.knife", isEmergency: false),
            WatchPhrase(id: "fd-burrito", label: "Burrito", sfSymbol: "fork.knife", isEmergency: false),
            WatchPhrase(id: "fd-quesadilla", label: "Quesadilla", sfSymbol: "fork.knife", isEmergency: false),
            WatchPhrase(id: "fd-sushi", label: "Sushi", sfSymbol: "fork.knife", isEmergency: false),
            WatchPhrase(id: "fd-dumplings", label: "Dumplings", sfSymbol: "fork.knife", isEmergency: false),
            WatchPhrase(id: "fd-curry", label: "Curry", sfSymbol: "fork.knife", isEmergency: false),
            WatchPhrase(id: "fd-stir-fry", label: "Stir fry", sfSymbol: "fork.knife", isEmergency: false),
            WatchPhrase(id: "fd-carrots", label: "Carrots", sfSymbol: "fork.knife", isEmergency: false),
            WatchPhrase(id: "fd-broccoli", label: "Broccoli", sfSymbol: "fork.knife", isEmergency: false),
            WatchPhrase(id: "fd-peas", label: "Peas", sfSymbol: "fork.knife", isEmergency: false),
            WatchPhrase(id: "fd-corn", label: "Corn", sfSymbol: "fork.knife", isEmergency: false),
            WatchPhrase(id: "fd-tomato", label: "Tomato", sfSymbol: "fork.knife", isEmergency: false),
            WatchPhrase(id: "fd-cucumber", label: "Cucumber", sfSymbol: "fork.knife", isEmergency: false),
            WatchPhrase(id: "fd-lettuce", label: "Lettuce", sfSymbol: "fork.knife", isEmergency: false),
            WatchPhrase(id: "fd-spinach", label: "Spinach", sfSymbol: "fork.knife", isEmergency: false),
            WatchPhrase(id: "fd-potato", label: "Potato", sfSymbol: "fork.knife", isEmergency: false),
            WatchPhrase(id: "fd-sweet-potato", label: "Sweet potato", sfSymbol: "fork.knife", isEmergency: false),
            WatchPhrase(id: "fd-strawberry", label: "Strawberry", sfSymbol: "fork.knife", isEmergency: false),
            WatchPhrase(id: "fd-blueberry", label: "Blueberry", sfSymbol: "fork.knife", isEmergency: false),
            WatchPhrase(id: "fd-grapes", label: "Grapes", sfSymbol: "fork.knife", isEmergency: false),
            WatchPhrase(id: "fd-watermelon", label: "Watermelon", sfSymbol: "fork.knife", isEmergency: false),
            WatchPhrase(id: "fd-orange", label: "Orange", sfSymbol: "fork.knife", isEmergency: false),
            WatchPhrase(id: "fd-pear", label: "Pear", sfSymbol: "fork.knife", isEmergency: false),
            WatchPhrase(id: "fd-peach", label: "Peach", sfSymbol: "fork.knife", isEmergency: false),
            WatchPhrase(id: "fd-mango", label: "Mango", sfSymbol: "fork.knife", isEmergency: false),
            WatchPhrase(id: "fd-pineapple", label: "Pineapple", sfSymbol: "fork.knife", isEmergency: false),
            WatchPhrase(id: "fd-cake", label: "Cake", sfSymbol: "fork.knife", isEmergency: false),
            WatchPhrase(id: "fd-cupcake", label: "Cupcake", sfSymbol: "fork.knife", isEmergency: false),
            WatchPhrase(id: "fd-brownie", label: "Brownie", sfSymbol: "fork.knife", isEmergency: false),
            WatchPhrase(id: "fd-donut", label: "Donut", sfSymbol: "fork.knife", isEmergency: false),
            WatchPhrase(id: "fd-muffin", label: "Muffin", sfSymbol: "fork.knife", isEmergency: false),
            WatchPhrase(id: "fd-pie", label: "Pie", sfSymbol: "fork.knife", isEmergency: false),
            WatchPhrase(id: "fd-pudding", label: "Pudding", sfSymbol: "fork.knife", isEmergency: false),
            WatchPhrase(id: "fd-jello", label: "Jello", sfSymbol: "fork.knife", isEmergency: false),
            WatchPhrase(id: "fd-candy", label: "Candy", sfSymbol: "fork.knife", isEmergency: false),
            WatchPhrase(id: "fd-chocolate", label: "Chocolate", sfSymbol: "fork.knife", isEmergency: false),
            WatchPhrase(id: "fd-lollipop", label: "Lollipop", sfSymbol: "fork.knife", isEmergency: false),
            WatchPhrase(id: "fd-gum", label: "Gum", sfSymbol: "fork.knife", isEmergency: false),
            WatchPhrase(id: "fd-soda", label: "Soda", sfSymbol: "fork.knife", isEmergency: false),
            WatchPhrase(id: "fd-tea", label: "Tea", sfSymbol: "fork.knife", isEmergency: false),
            WatchPhrase(id: "fd-hot-chocolate", label: "Hot chocolate", sfSymbol: "fork.knife", isEmergency: false),
            WatchPhrase(id: "fd-lemonade", label: "Lemonade", sfSymbol: "fork.knife", isEmergency: false),
            WatchPhrase(id: "fd-spoon", label: "Spoon", sfSymbol: "fork.knife", isEmergency: false),
            WatchPhrase(id: "fd-fork", label: "Fork", sfSymbol: "fork.knife", isEmergency: false),
            WatchPhrase(id: "fd-knife", label: "Knife", sfSymbol: "fork.knife", isEmergency: false),
            WatchPhrase(id: "fd-plate", label: "Plate", sfSymbol: "fork.knife", isEmergency: false),
            WatchPhrase(id: "fd-bowl", label: "Bowl", sfSymbol: "fork.knife", isEmergency: false),
            WatchPhrase(id: "fd-cup", label: "Cup", sfSymbol: "fork.knife", isEmergency: false),
            WatchPhrase(id: "fd-straw", label: "Straw", sfSymbol: "fork.knife", isEmergency: false),
            WatchPhrase(id: "fd-napkin", label: "Napkin", sfSymbol: "fork.knife", isEmergency: false),
            WatchPhrase(id: "fd-bib", label: "Bib", sfSymbol: "fork.knife", isEmergency: false),
            WatchPhrase(id: "fd-open-it-please", label: "Open it please", sfSymbol: "fork.knife", isEmergency: false),
            WatchPhrase(id: "fd-cut-it-up-please", label: "Cut it up please", sfSymbol: "fork.knife", isEmergency: false),
            WatchPhrase(id: "fd-not-too-hot", label: "Not too hot", sfSymbol: "fork.knife", isEmergency: false),
            WatchPhrase(id: "fd-i-am-allergic", label: "I am allergic", sfSymbol: "fork.knife", isEmergency: false),
            WatchPhrase(id: "fm-breakfast", label: "Breakfast", sfSymbol: "fork.knife", isEmergency: false),
            WatchPhrase(id: "fm-hamburger", label: "Hamburger", sfSymbol: "fork.knife", isEmergency: false),
            WatchPhrase(id: "ff-strawberry", label: "Strawberry", sfSymbol: "fork.knife", isEmergency: false),
            WatchPhrase(id: "ff-watermelon", label: "Watermelon", sfSymbol: "fork.knife", isEmergency: false),
            WatchPhrase(id: "fv-broccoli", label: "Broccoli", sfSymbol: "fork.knife", isEmergency: false),
            WatchPhrase(id: "fv-cucumber", label: "Cucumber", sfSymbol: "fork.knife", isEmergency: false),
            WatchPhrase(id: "fd-lemonade-2", label: "Lemonade", sfSymbol: "fork.knife", isEmergency: false),
            WatchPhrase(id: "fd-smoothie-2", label: "Smoothie", sfSymbol: "fork.knife", isEmergency: false),
            WatchPhrase(id: "fs-crackers", label: "Crackers", sfSymbol: "fork.knife", isEmergency: false),
            WatchPhrase(id: "fs-pretzels", label: "Pretzels", sfSymbol: "fork.knife", isEmergency: false),
        ]),
        WatchCategory(id: "places-plans", icon: "mappin.and.ellipse", name: "Places", phrases: [
            WatchPhrase(id: "pl-home", label: "Home", sfSymbol: "mappin.circle", isEmergency: false),
            WatchPhrase(id: "pl-school", label: "School", sfSymbol: "mappin.circle", isEmergency: false),
            WatchPhrase(id: "pl-park", label: "Park", sfSymbol: "mappin.circle", isEmergency: false),
            WatchPhrase(id: "pl-store", label: "Store", sfSymbol: "mappin.circle", isEmergency: false),
            WatchPhrase(id: "pl-restaurant", label: "Restaurant", sfSymbol: "mappin.circle", isEmergency: false),
            WatchPhrase(id: "pl-library", label: "Library", sfSymbol: "mappin.circle", isEmergency: false),
            WatchPhrase(id: "pl-pool", label: "Pool", sfSymbol: "mappin.circle", isEmergency: false),
            WatchPhrase(id: "pl-car", label: "Car", sfSymbol: "mappin.circle", isEmergency: false),
            WatchPhrase(id: "pl-outside", label: "Outside", sfSymbol: "mappin.circle", isEmergency: false),
            WatchPhrase(id: "pl-inside", label: "Inside", sfSymbol: "mappin.circle", isEmergency: false),
            WatchPhrase(id: "pl-bathroom", label: "Bathroom", sfSymbol: "mappin.circle", isEmergency: false),
            WatchPhrase(id: "pl-bedroom", label: "Bedroom", sfSymbol: "mappin.circle", isEmergency: false),
            WatchPhrase(id: "pl-kitchen", label: "Kitchen", sfSymbol: "mappin.circle", isEmergency: false),
            WatchPhrase(id: "pl-playground", label: "Playground", sfSymbol: "mappin.circle", isEmergency: false),
            WatchPhrase(id: "pl-backyard", label: "Backyard", sfSymbol: "mappin.circle", isEmergency: false),
            WatchPhrase(id: "pl-front-yard", label: "Front yard", sfSymbol: "mappin.circle", isEmergency: false),
            WatchPhrase(id: "pl-garden", label: "Garden", sfSymbol: "mappin.circle", isEmergency: false),
            WatchPhrase(id: "pl-driveway", label: "Driveway", sfSymbol: "mappin.circle", isEmergency: false),
            WatchPhrase(id: "pl-living-room", label: "Living room", sfSymbol: "mappin.circle", isEmergency: false),
            WatchPhrase(id: "pl-dining-room", label: "Dining room", sfSymbol: "mappin.circle", isEmergency: false),
            WatchPhrase(id: "pl-garage", label: "Garage", sfSymbol: "mappin.circle", isEmergency: false),
            WatchPhrase(id: "pl-basement", label: "Basement", sfSymbol: "mappin.circle", isEmergency: false),
            WatchPhrase(id: "pl-attic", label: "Attic", sfSymbol: "mappin.circle", isEmergency: false),
            WatchPhrase(id: "pl-hospital", label: "Hospital", sfSymbol: "mappin.circle", isEmergency: false),
            WatchPhrase(id: "pl-doctor-office", label: "Doctor office", sfSymbol: "mappin.circle", isEmergency: false),
            WatchPhrase(id: "pl-dentist-office", label: "Dentist office", sfSymbol: "mappin.circle", isEmergency: false),
            WatchPhrase(id: "pl-pharmacy", label: "Pharmacy", sfSymbol: "mappin.circle", isEmergency: false),
            WatchPhrase(id: "pl-grocery-store", label: "Grocery store", sfSymbol: "mappin.circle", isEmergency: false),
            WatchPhrase(id: "pl-mall", label: "Mall", sfSymbol: "mappin.circle", isEmergency: false),
            WatchPhrase(id: "pl-pet-store", label: "Pet store", sfSymbol: "mappin.circle", isEmergency: false),
            WatchPhrase(id: "pl-toy-store", label: "Toy store", sfSymbol: "mappin.circle", isEmergency: false),
            WatchPhrase(id: "pl-movie-theater", label: "Movie theater", sfSymbol: "mappin.circle", isEmergency: false),
            WatchPhrase(id: "pl-bowling-alley", label: "Bowling alley", sfSymbol: "mappin.circle", isEmergency: false),
            WatchPhrase(id: "pl-arcade", label: "Arcade", sfSymbol: "mappin.circle", isEmergency: false),
            WatchPhrase(id: "pl-beach", label: "Beach", sfSymbol: "mappin.circle", isEmergency: false),
            WatchPhrase(id: "pl-lake", label: "Lake", sfSymbol: "mappin.circle", isEmergency: false),
            WatchPhrase(id: "pl-mountain", label: "Mountain", sfSymbol: "mappin.circle", isEmergency: false),
            WatchPhrase(id: "pl-forest", label: "Forest", sfSymbol: "mappin.circle", isEmergency: false),
            WatchPhrase(id: "pl-camp", label: "Camp", sfSymbol: "mappin.circle", isEmergency: false),
            WatchPhrase(id: "pl-zoo", label: "Zoo", sfSymbol: "mappin.circle", isEmergency: false),
            WatchPhrase(id: "pl-aquarium", label: "Aquarium", sfSymbol: "mappin.circle", isEmergency: false),
            WatchPhrase(id: "pl-museum", label: "Museum", sfSymbol: "mappin.circle", isEmergency: false),
            WatchPhrase(id: "pl-farm", label: "Farm", sfSymbol: "mappin.circle", isEmergency: false),
            WatchPhrase(id: "pl-church", label: "Church", sfSymbol: "mappin.circle", isEmergency: false),
            WatchPhrase(id: "pl-temple", label: "Temple", sfSymbol: "mappin.circle", isEmergency: false),
            WatchPhrase(id: "pl-mosque", label: "Mosque", sfSymbol: "mappin.circle", isEmergency: false),
            WatchPhrase(id: "pl-synagogue", label: "Synagogue", sfSymbol: "mappin.circle", isEmergency: false),
            WatchPhrase(id: "pl-bus-stop", label: "Bus stop", sfSymbol: "mappin.circle", isEmergency: false),
            WatchPhrase(id: "pl-train-station", label: "Train station", sfSymbol: "mappin.circle", isEmergency: false),
            WatchPhrase(id: "pl-airport", label: "Airport", sfSymbol: "mappin.circle", isEmergency: false),
            WatchPhrase(id: "pls-classroom", label: "Classroom", sfSymbol: "mappin.circle", isEmergency: false),
            WatchPhrase(id: "pls-lunchroom", label: "Lunchroom", sfSymbol: "mappin.circle", isEmergency: false),
            WatchPhrase(id: "plh-bathroom", label: "Bathroom", sfSymbol: "mappin.circle", isEmergency: false),
            WatchPhrase(id: "plh-backyard", label: "Backyard", sfSymbol: "mappin.circle", isEmergency: false),
            WatchPhrase(id: "plh-basement", label: "Basement", sfSymbol: "mappin.circle", isEmergency: false),
            WatchPhrase(id: "plo-playground", label: "Playground", sfSymbol: "mappin.circle", isEmergency: false),
            WatchPhrase(id: "plst-pharmacy", label: "Pharmacy", sfSymbol: "mappin.circle", isEmergency: false),
        ]),
        WatchCategory(id: "school-work", icon: "book.fill", name: "School / Work", phrases: [
            WatchPhrase(id: "sw-class", label: "Class", sfSymbol: "book", isEmergency: false),
            WatchPhrase(id: "sw-homework", label: "Homework", sfSymbol: "book", isEmergency: false),
            WatchPhrase(id: "sw-computer", label: "Computer", sfSymbol: "book", isEmergency: false),
            WatchPhrase(id: "sw-book", label: "Book", sfSymbol: "book", isEmergency: false),
            WatchPhrase(id: "sw-pencil", label: "Pencil", sfSymbol: "book", isEmergency: false),
            WatchPhrase(id: "sw-question", label: "I have a question", sfSymbol: "book", isEmergency: false),
            WatchPhrase(id: "sw-help", label: "I need help with this", sfSymbol: "book", isEmergency: false),
            WatchPhrase(id: "sw-paper", label: "Paper", sfSymbol: "book", isEmergency: false),
            WatchPhrase(id: "sw-table", label: "Table", sfSymbol: "book", isEmergency: false),
            WatchPhrase(id: "sw-chair", label: "Chair", sfSymbol: "book", isEmergency: false),
            WatchPhrase(id: "sw-art", label: "Art", sfSymbol: "book", isEmergency: false),
            WatchPhrase(id: "sw-music", label: "Music", sfSymbol: "book", isEmergency: false),
            WatchPhrase(id: "sw-recess", label: "Recess", sfSymbol: "book", isEmergency: false),
            WatchPhrase(id: "sw-backpack", label: "Backpack", sfSymbol: "book", isEmergency: false),
            WatchPhrase(id: "sw-lunchbox", label: "Lunchbox", sfSymbol: "book", isEmergency: false),
            WatchPhrase(id: "sw-folder", label: "Folder", sfSymbol: "book", isEmergency: false),
            WatchPhrase(id: "sw-notebook", label: "Notebook", sfSymbol: "book", isEmergency: false),
            WatchPhrase(id: "sw-crayons", label: "Crayons", sfSymbol: "book", isEmergency: false),
            WatchPhrase(id: "sw-markers", label: "Markers", sfSymbol: "book", isEmergency: false),
            WatchPhrase(id: "sw-scissors", label: "Scissors", sfSymbol: "book", isEmergency: false),
            WatchPhrase(id: "sw-glue", label: "Glue", sfSymbol: "book", isEmergency: false),
            WatchPhrase(id: "sw-tape", label: "Tape", sfSymbol: "book", isEmergency: false),
            WatchPhrase(id: "sw-eraser", label: "Eraser", sfSymbol: "book", isEmergency: false),
            WatchPhrase(id: "sw-ruler", label: "Ruler", sfSymbol: "book", isEmergency: false),
            WatchPhrase(id: "sw-whiteboard", label: "Whiteboard", sfSymbol: "book", isEmergency: false),
            WatchPhrase(id: "sw-smart-board", label: "Smart board", sfSymbol: "book", isEmergency: false),
            WatchPhrase(id: "sw-projector", label: "Projector", sfSymbol: "book", isEmergency: false),
            WatchPhrase(id: "sw-math", label: "Math", sfSymbol: "book", isEmergency: false),
            WatchPhrase(id: "sw-reading", label: "Reading", sfSymbol: "book", isEmergency: false),
            WatchPhrase(id: "sw-writing", label: "Writing", sfSymbol: "book", isEmergency: false),
            WatchPhrase(id: "sw-spelling", label: "Spelling", sfSymbol: "book", isEmergency: false),
            WatchPhrase(id: "sw-science", label: "Science", sfSymbol: "book", isEmergency: false),
            WatchPhrase(id: "sw-social-studies", label: "Social studies", sfSymbol: "book", isEmergency: false),
            WatchPhrase(id: "sw-history", label: "History", sfSymbol: "book", isEmergency: false),
            WatchPhrase(id: "sw-pe", label: "PE", sfSymbol: "book", isEmergency: false),
            WatchPhrase(id: "sw-gym", label: "Gym", sfSymbol: "book", isEmergency: false),
            WatchPhrase(id: "sw-recess-time", label: "Recess time", sfSymbol: "book", isEmergency: false),
            WatchPhrase(id: "sw-library-time", label: "Library time", sfSymbol: "book", isEmergency: false),
            WatchPhrase(id: "sw-story-time", label: "Story time", sfSymbol: "book", isEmergency: false),
            WatchPhrase(id: "sw-circle-time", label: "Circle time", sfSymbol: "book", isEmergency: false),
            WatchPhrase(id: "sw-lunch-time", label: "Lunch time", sfSymbol: "book", isEmergency: false),
            WatchPhrase(id: "sw-snack-time", label: "Snack time", sfSymbol: "book", isEmergency: false),
            WatchPhrase(id: "sw-worksheet", label: "Worksheet", sfSymbol: "book", isEmergency: false),
            WatchPhrase(id: "sw-quiz", label: "Quiz", sfSymbol: "book", isEmergency: false),
            WatchPhrase(id: "sw-test", label: "Test", sfSymbol: "book", isEmergency: false),
            WatchPhrase(id: "sw-project", label: "Project", sfSymbol: "book", isEmergency: false),
            WatchPhrase(id: "sw-field-trip", label: "Field trip", sfSymbol: "book", isEmergency: false),
            WatchPhrase(id: "sw-assembly", label: "Assembly", sfSymbol: "book", isEmergency: false),
            WatchPhrase(id: "sw-bus-ride", label: "Bus ride", sfSymbol: "book", isEmergency: false),
        ]),
        WatchCategory(id: "health-body", icon: "cross.case.fill", name: "Health / Body", phrases: [
            WatchPhrase(id: "hb-head", label: "Head", sfSymbol: "cross", isEmergency: false),
            WatchPhrase(id: "hb-tummy", label: "Tummy", sfSymbol: "cross", isEmergency: false),
            WatchPhrase(id: "hb-hand", label: "Hand", sfSymbol: "cross", isEmergency: false),
            WatchPhrase(id: "hb-foot", label: "Foot", sfSymbol: "cross", isEmergency: false),
            WatchPhrase(id: "hb-eye", label: "Eye", sfSymbol: "cross", isEmergency: false),
            WatchPhrase(id: "hb-ear", label: "Ear", sfSymbol: "cross", isEmergency: false),
            WatchPhrase(id: "hb-mouth", label: "Mouth", sfSymbol: "cross", isEmergency: false),
            WatchPhrase(id: "hb-nose", label: "Nose", sfSymbol: "cross", isEmergency: false),
            WatchPhrase(id: "hb-hurts", label: "It hurts", sfSymbol: "cross", isEmergency: false),
            WatchPhrase(id: "hb-sick", label: "I feel sick", sfSymbol: "cross", isEmergency: false),
            WatchPhrase(id: "hb-medicine", label: "Medicine", sfSymbol: "cross", isEmergency: false),
            WatchPhrase(id: "hb-teeth", label: "Teeth", sfSymbol: "cross", isEmergency: false),
            WatchPhrase(id: "hb-back", label: "Back", sfSymbol: "cross", isEmergency: false),
            WatchPhrase(id: "hb-arm", label: "Arm", sfSymbol: "cross", isEmergency: false),
            WatchPhrase(id: "hb-hair", label: "Hair", sfSymbol: "cross", isEmergency: false),
            WatchPhrase(id: "hb-face", label: "Face", sfSymbol: "cross", isEmergency: false),
            WatchPhrase(id: "hb-forehead", label: "Forehead", sfSymbol: "cross", isEmergency: false),
            WatchPhrase(id: "hb-cheek", label: "Cheek", sfSymbol: "cross", isEmergency: false),
            WatchPhrase(id: "hb-chin", label: "Chin", sfSymbol: "cross", isEmergency: false),
            WatchPhrase(id: "hb-lips", label: "Lips", sfSymbol: "cross", isEmergency: false),
            WatchPhrase(id: "hb-tongue", label: "Tongue", sfSymbol: "cross", isEmergency: false),
            WatchPhrase(id: "hb-throat", label: "Throat", sfSymbol: "cross", isEmergency: false),
            WatchPhrase(id: "hb-neck", label: "Neck", sfSymbol: "cross", isEmergency: false),
            WatchPhrase(id: "hb-shoulder", label: "Shoulder", sfSymbol: "cross", isEmergency: false),
            WatchPhrase(id: "hb-elbow", label: "Elbow", sfSymbol: "cross", isEmergency: false),
            WatchPhrase(id: "hb-wrist", label: "Wrist", sfSymbol: "cross", isEmergency: false),
            WatchPhrase(id: "hb-finger", label: "Finger", sfSymbol: "cross", isEmergency: false),
            WatchPhrase(id: "hb-thumb", label: "Thumb", sfSymbol: "cross", isEmergency: false),
            WatchPhrase(id: "hb-knuckle", label: "Knuckle", sfSymbol: "cross", isEmergency: false),
            WatchPhrase(id: "hb-knee", label: "Knee", sfSymbol: "cross", isEmergency: false),
            WatchPhrase(id: "hb-ankle", label: "Ankle", sfSymbol: "cross", isEmergency: false),
            WatchPhrase(id: "hb-toe", label: "Toe", sfSymbol: "cross", isEmergency: false),
            WatchPhrase(id: "hb-heel", label: "Heel", sfSymbol: "cross", isEmergency: false),
            WatchPhrase(id: "hb-chest", label: "Chest", sfSymbol: "cross", isEmergency: false),
            WatchPhrase(id: "hb-belly", label: "Belly", sfSymbol: "cross", isEmergency: false),
            WatchPhrase(id: "hb-hip", label: "Hip", sfSymbol: "cross", isEmergency: false),
            WatchPhrase(id: "hb-bottom", label: "Bottom", sfSymbol: "cross", isEmergency: false),
            WatchPhrase(id: "hb-skin", label: "Skin", sfSymbol: "cross", isEmergency: false),
            WatchPhrase(id: "hb-bone", label: "Bone", sfSymbol: "cross", isEmergency: false),
            WatchPhrase(id: "hb-muscle", label: "Muscle", sfSymbol: "cross", isEmergency: false),
            WatchPhrase(id: "hb-headache", label: "Headache", sfSymbol: "cross", isEmergency: false),
            WatchPhrase(id: "hb-stomachache", label: "Stomachache", sfSymbol: "cross", isEmergency: false),
            WatchPhrase(id: "hb-earache", label: "Earache", sfSymbol: "cross", isEmergency: false),
            WatchPhrase(id: "hb-toothache", label: "Toothache", sfSymbol: "cross", isEmergency: false),
            WatchPhrase(id: "hb-sore-throat", label: "Sore throat", sfSymbol: "cross", isEmergency: false),
            WatchPhrase(id: "hb-cough", label: "Cough", sfSymbol: "cross", isEmergency: false),
            WatchPhrase(id: "hb-sneeze", label: "Sneeze", sfSymbol: "cross", isEmergency: false),
            WatchPhrase(id: "hb-runny-nose", label: "Runny nose", sfSymbol: "cross", isEmergency: false),
            WatchPhrase(id: "hb-stuffy-nose", label: "Stuffy nose", sfSymbol: "cross", isEmergency: false),
            WatchPhrase(id: "hb-fever", label: "Fever", sfSymbol: "cross", isEmergency: false),
            WatchPhrase(id: "hb-chills", label: "Chills", sfSymbol: "cross", isEmergency: false),
            WatchPhrase(id: "hb-shaking", label: "Shaking", sfSymbol: "cross", isEmergency: false),
            WatchPhrase(id: "hb-dizzy-spell", label: "Dizzy spell", sfSymbol: "cross", isEmergency: false),
            WatchPhrase(id: "hb-bruise", label: "Bruise", sfSymbol: "cross", isEmergency: false),
            WatchPhrase(id: "hb-cut", label: "Cut", sfSymbol: "cross", isEmergency: false),
            WatchPhrase(id: "hb-scrape", label: "Scrape", sfSymbol: "cross", isEmergency: false),
            WatchPhrase(id: "hb-bump", label: "Bump", sfSymbol: "cross", isEmergency: false),
            WatchPhrase(id: "hb-bandage", label: "Bandage", sfSymbol: "cross", isEmergency: false),
            WatchPhrase(id: "hb-itchy-spot", label: "Itchy spot", sfSymbol: "cross", isEmergency: false),
            WatchPhrase(id: "hb-rash", label: "Rash", sfSymbol: "cross", isEmergency: false),
            WatchPhrase(id: "hb-allergic-reaction", label: "Allergic reaction", sfSymbol: "cross", isEmergency: false),
            WatchPhrase(id: "hb-pain", label: "Pain", sfSymbol: "cross", isEmergency: false),
            WatchPhrase(id: "hb-sharp-pain", label: "Sharp pain", sfSymbol: "cross", isEmergency: false),
            WatchPhrase(id: "hb-dull-pain", label: "Dull pain", sfSymbol: "cross", isEmergency: false),
            WatchPhrase(id: "hb-burning", label: "Burning", sfSymbol: "cross", isEmergency: false),
            WatchPhrase(id: "hb-vitamins", label: "Vitamins", sfSymbol: "cross", isEmergency: false),
            WatchPhrase(id: "hb-inhaler", label: "Inhaler", sfSymbol: "cross", isEmergency: false),
            WatchPhrase(id: "hb-epipen", label: "EpiPen", sfSymbol: "cross", isEmergency: false),
            WatchPhrase(id: "hb-pill", label: "Pill", sfSymbol: "cross", isEmergency: false),
            WatchPhrase(id: "hb-drops", label: "Drops", sfSymbol: "cross", isEmergency: false),
            WatchPhrase(id: "hb-doctor-visit", label: "Doctor visit", sfSymbol: "cross", isEmergency: false),
            WatchPhrase(id: "hb-shot", label: "Shot", sfSymbol: "cross", isEmergency: false),
            WatchPhrase(id: "hb-x-ray", label: "X-ray", sfSymbol: "cross", isEmergency: false),
            WatchPhrase(id: "hb-check-up", label: "Check-up", sfSymbol: "cross", isEmergency: false),
            WatchPhrase(id: "hb-wash-my-hands", label: "Wash my hands", sfSymbol: "cross", isEmergency: false),
            WatchPhrase(id: "hb-brush-my-teeth", label: "Brush my teeth", sfSymbol: "cross", isEmergency: false),
            WatchPhrase(id: "hr-wash-hands", label: "Wash hands", sfSymbol: "cross", isEmergency: false),
        ]),
        WatchCategory(id: "time", icon: "clock.fill", name: "Time", phrases: [
            WatchPhrase(id: "ti-now", label: "Now", sfSymbol: "clock", isEmergency: false),
            WatchPhrase(id: "ti-later", label: "Later", sfSymbol: "clock", isEmergency: false),
            WatchPhrase(id: "ti-today", label: "Today", sfSymbol: "clock", isEmergency: false),
            WatchPhrase(id: "ti-tomorrow", label: "Tomorrow", sfSymbol: "clock", isEmergency: false),
            WatchPhrase(id: "ti-yesterday", label: "Yesterday", sfSymbol: "clock", isEmergency: false),
            WatchPhrase(id: "ti-morning", label: "Morning", sfSymbol: "clock", isEmergency: false),
            WatchPhrase(id: "ti-afternoon", label: "Afternoon", sfSymbol: "clock", isEmergency: false),
            WatchPhrase(id: "ti-night", label: "Night", sfSymbol: "clock", isEmergency: false),
            WatchPhrase(id: "ti-before", label: "Before", sfSymbol: "clock", isEmergency: false),
            WatchPhrase(id: "ti-after", label: "After", sfSymbol: "clock", isEmergency: false),
            WatchPhrase(id: "ti-first", label: "First", sfSymbol: "clock", isEmergency: false),
            WatchPhrase(id: "ti-last", label: "Last", sfSymbol: "clock", isEmergency: false),
            WatchPhrase(id: "ti-right-now", label: "Right now", sfSymbol: "clock", isEmergency: false),
            WatchPhrase(id: "ti-in-a-minute", label: "In a minute", sfSymbol: "clock", isEmergency: false),
            WatchPhrase(id: "ti-soon", label: "Soon", sfSymbol: "clock", isEmergency: false),
            WatchPhrase(id: "ti-later-today", label: "Later today", sfSymbol: "clock", isEmergency: false),
            WatchPhrase(id: "ti-tonight", label: "Tonight", sfSymbol: "clock", isEmergency: false),
            WatchPhrase(id: "ti-this-morning", label: "This morning", sfSymbol: "clock", isEmergency: false),
            WatchPhrase(id: "ti-this-afternoon", label: "This afternoon", sfSymbol: "clock", isEmergency: false),
            WatchPhrase(id: "ti-this-evening", label: "This evening", sfSymbol: "clock", isEmergency: false),
            WatchPhrase(id: "ti-last-night", label: "Last night", sfSymbol: "clock", isEmergency: false),
            WatchPhrase(id: "ti-all-day", label: "All day", sfSymbol: "clock", isEmergency: false),
            WatchPhrase(id: "ti-all-night", label: "All night", sfSymbol: "clock", isEmergency: false),
            WatchPhrase(id: "ti-a-long-time", label: "A long time", sfSymbol: "clock", isEmergency: false),
            WatchPhrase(id: "ti-a-short-time", label: "A short time", sfSymbol: "clock", isEmergency: false),
            WatchPhrase(id: "ti-a-while-ago", label: "A while ago", sfSymbol: "clock", isEmergency: false),
            WatchPhrase(id: "ti-weekend", label: "Weekend", sfSymbol: "clock", isEmergency: false),
            WatchPhrase(id: "ti-weekday", label: "Weekday", sfSymbol: "clock", isEmergency: false),
            WatchPhrase(id: "ti-monday", label: "Monday", sfSymbol: "clock", isEmergency: false),
            WatchPhrase(id: "ti-tuesday", label: "Tuesday", sfSymbol: "clock", isEmergency: false),
            WatchPhrase(id: "ti-wednesday", label: "Wednesday", sfSymbol: "clock", isEmergency: false),
            WatchPhrase(id: "ti-thursday", label: "Thursday", sfSymbol: "clock", isEmergency: false),
            WatchPhrase(id: "ti-friday", label: "Friday", sfSymbol: "clock", isEmergency: false),
            WatchPhrase(id: "ti-saturday", label: "Saturday", sfSymbol: "clock", isEmergency: false),
            WatchPhrase(id: "ti-sunday", label: "Sunday", sfSymbol: "clock", isEmergency: false),
            WatchPhrase(id: "ti-birthday", label: "Birthday", sfSymbol: "clock", isEmergency: false),
            WatchPhrase(id: "ti-holiday", label: "Holiday", sfSymbol: "clock", isEmergency: false),
            WatchPhrase(id: "td-wednesday", label: "Wednesday", sfSymbol: "clock", isEmergency: false),
            WatchPhrase(id: "td-yesterday", label: "Yesterday", sfSymbol: "clock", isEmergency: false),
            WatchPhrase(id: "tm-jan", label: "January", sfSymbol: "clock", isEmergency: false),
            WatchPhrase(id: "tm-feb", label: "February", sfSymbol: "clock", isEmergency: false),
            WatchPhrase(id: "tm-mar", label: "March", sfSymbol: "clock", isEmergency: false),
            WatchPhrase(id: "tm-apr", label: "April", sfSymbol: "clock", isEmergency: false),
            WatchPhrase(id: "tm-may", label: "May", sfSymbol: "clock", isEmergency: false),
            WatchPhrase(id: "tm-jun", label: "June", sfSymbol: "clock", isEmergency: false),
            WatchPhrase(id: "tm-jul", label: "July", sfSymbol: "clock", isEmergency: false),
            WatchPhrase(id: "tm-aug", label: "August", sfSymbol: "clock", isEmergency: false),
            WatchPhrase(id: "tm-sep", label: "September", sfSymbol: "clock", isEmergency: false),
            WatchPhrase(id: "tm-oct", label: "October", sfSymbol: "clock", isEmergency: false),
            WatchPhrase(id: "tm-nov", label: "November", sfSymbol: "clock", isEmergency: false),
            WatchPhrase(id: "tm-dec", label: "December", sfSymbol: "clock", isEmergency: false),
            WatchPhrase(id: "tdate-10", label: "10th", sfSymbol: "clock", isEmergency: false),
            WatchPhrase(id: "tdate-11", label: "11th", sfSymbol: "clock", isEmergency: false),
            WatchPhrase(id: "tdate-12", label: "12th", sfSymbol: "clock", isEmergency: false),
            WatchPhrase(id: "tdate-13", label: "13th", sfSymbol: "clock", isEmergency: false),
            WatchPhrase(id: "tdate-14", label: "14th", sfSymbol: "clock", isEmergency: false),
            WatchPhrase(id: "tdate-15", label: "15th", sfSymbol: "clock", isEmergency: false),
            WatchPhrase(id: "tdate-16", label: "16th", sfSymbol: "clock", isEmergency: false),
            WatchPhrase(id: "tdate-17", label: "17th", sfSymbol: "clock", isEmergency: false),
            WatchPhrase(id: "tdate-18", label: "18th", sfSymbol: "clock", isEmergency: false),
            WatchPhrase(id: "tdate-19", label: "19th", sfSymbol: "clock", isEmergency: false),
            WatchPhrase(id: "tdate-20", label: "20th", sfSymbol: "clock", isEmergency: false),
            WatchPhrase(id: "tdate-21", label: "21st", sfSymbol: "clock", isEmergency: false),
            WatchPhrase(id: "tdate-22", label: "22nd", sfSymbol: "clock", isEmergency: false),
            WatchPhrase(id: "tdate-23", label: "23rd", sfSymbol: "clock", isEmergency: false),
            WatchPhrase(id: "tdate-24", label: "24th", sfSymbol: "clock", isEmergency: false),
            WatchPhrase(id: "tdate-25", label: "25th", sfSymbol: "clock", isEmergency: false),
            WatchPhrase(id: "tdate-26", label: "26th", sfSymbol: "clock", isEmergency: false),
            WatchPhrase(id: "tdate-27", label: "27th", sfSymbol: "clock", isEmergency: false),
            WatchPhrase(id: "tdate-28", label: "28th", sfSymbol: "clock", isEmergency: false),
            WatchPhrase(id: "tdate-29", label: "29th", sfSymbol: "clock", isEmergency: false),
            WatchPhrase(id: "tdate-30", label: "30th", sfSymbol: "clock", isEmergency: false),
            WatchPhrase(id: "tdate-31", label: "31st", sfSymbol: "clock", isEmergency: false),
        ]),
        WatchCategory(id: "animals", icon: "pawprint.fill", name: "Animals", phrases: [
            WatchPhrase(id: "an-dog", label: "Dog", sfSymbol: "pawprint", isEmergency: false),
            WatchPhrase(id: "an-cat", label: "Cat", sfSymbol: "pawprint", isEmergency: false),
            WatchPhrase(id: "an-fish", label: "Fish", sfSymbol: "pawprint", isEmergency: false),
            WatchPhrase(id: "an-bird", label: "Bird", sfSymbol: "pawprint", isEmergency: false),
            WatchPhrase(id: "an-horse", label: "Horse", sfSymbol: "pawprint", isEmergency: false),
            WatchPhrase(id: "an-cow", label: "Cow", sfSymbol: "pawprint", isEmergency: false),
            WatchPhrase(id: "an-pig", label: "Pig", sfSymbol: "pawprint", isEmergency: false),
            WatchPhrase(id: "an-rabbit", label: "Rabbit", sfSymbol: "pawprint", isEmergency: false),
            WatchPhrase(id: "an-bear", label: "Bear", sfSymbol: "pawprint", isEmergency: false),
            WatchPhrase(id: "an-elephant", label: "Elephant", sfSymbol: "pawprint", isEmergency: false),
            WatchPhrase(id: "an-duck", label: "Duck", sfSymbol: "pawprint", isEmergency: false),
            WatchPhrase(id: "an-butterfly", label: "Butterfly", sfSymbol: "pawprint", isEmergency: false),
            WatchPhrase(id: "an-puppy", label: "Puppy", sfSymbol: "pawprint", isEmergency: false),
            WatchPhrase(id: "an-kitten", label: "Kitten", sfSymbol: "pawprint", isEmergency: false),
            WatchPhrase(id: "an-hamster", label: "Hamster", sfSymbol: "pawprint", isEmergency: false),
            WatchPhrase(id: "an-guinea-pig", label: "Guinea pig", sfSymbol: "pawprint", isEmergency: false),
            WatchPhrase(id: "an-turtle", label: "Turtle", sfSymbol: "pawprint", isEmergency: false),
            WatchPhrase(id: "an-frog", label: "Frog", sfSymbol: "pawprint", isEmergency: false),
            WatchPhrase(id: "an-snake", label: "Snake", sfSymbol: "pawprint", isEmergency: false),
            WatchPhrase(id: "an-lizard", label: "Lizard", sfSymbol: "pawprint", isEmergency: false),
            WatchPhrase(id: "an-spider", label: "Spider", sfSymbol: "pawprint", isEmergency: false),
            WatchPhrase(id: "an-bug", label: "Bug", sfSymbol: "pawprint", isEmergency: false),
            WatchPhrase(id: "an-bee", label: "Bee", sfSymbol: "pawprint", isEmergency: false),
            WatchPhrase(id: "an-ant", label: "Ant", sfSymbol: "pawprint", isEmergency: false),
            WatchPhrase(id: "an-lion", label: "Lion", sfSymbol: "pawprint", isEmergency: false),
            WatchPhrase(id: "an-tiger", label: "Tiger", sfSymbol: "pawprint", isEmergency: false),
            WatchPhrase(id: "an-monkey", label: "Monkey", sfSymbol: "pawprint", isEmergency: false),
            WatchPhrase(id: "an-giraffe", label: "Giraffe", sfSymbol: "pawprint", isEmergency: false),
            WatchPhrase(id: "an-zebra", label: "Zebra", sfSymbol: "pawprint", isEmergency: false),
            WatchPhrase(id: "an-hippo", label: "Hippo", sfSymbol: "pawprint", isEmergency: false),
            WatchPhrase(id: "an-penguin", label: "Penguin", sfSymbol: "pawprint", isEmergency: false),
            WatchPhrase(id: "an-owl", label: "Owl", sfSymbol: "pawprint", isEmergency: false),
            WatchPhrase(id: "an-eagle", label: "Eagle", sfSymbol: "pawprint", isEmergency: false),
            WatchPhrase(id: "an-parrot", label: "Parrot", sfSymbol: "pawprint", isEmergency: false),
            WatchPhrase(id: "an-chicken", label: "Chicken", sfSymbol: "pawprint", isEmergency: false),
            WatchPhrase(id: "an-rooster", label: "Rooster", sfSymbol: "pawprint", isEmergency: false),
            WatchPhrase(id: "an-sheep", label: "Sheep", sfSymbol: "pawprint", isEmergency: false),
            WatchPhrase(id: "an-goat", label: "Goat", sfSymbol: "pawprint", isEmergency: false),
            WatchPhrase(id: "an-donkey", label: "Donkey", sfSymbol: "pawprint", isEmergency: false),
            WatchPhrase(id: "an-dolphin", label: "Dolphin", sfSymbol: "pawprint", isEmergency: false),
            WatchPhrase(id: "an-whale", label: "Whale", sfSymbol: "pawprint", isEmergency: false),
            WatchPhrase(id: "an-shark", label: "Shark", sfSymbol: "pawprint", isEmergency: false),
            WatchPhrase(id: "an-octopus", label: "Octopus", sfSymbol: "pawprint", isEmergency: false),
            WatchPhrase(id: "an-crab", label: "Crab", sfSymbol: "pawprint", isEmergency: false),
            WatchPhrase(id: "an-starfish", label: "Starfish", sfSymbol: "pawprint", isEmergency: false),
            WatchPhrase(id: "an-my-pet", label: "My pet", sfSymbol: "pawprint", isEmergency: false),
            WatchPhrase(id: "an-my-dog", label: "My dog", sfSymbol: "pawprint", isEmergency: false),
            WatchPhrase(id: "an-my-cat", label: "My cat", sfSymbol: "pawprint", isEmergency: false),
            WatchPhrase(id: "ap-hamster", label: "Hamster", sfSymbol: "pawprint", isEmergency: false),
            WatchPhrase(id: "af-chicken", label: "Chicken", sfSymbol: "pawprint", isEmergency: false),
            WatchPhrase(id: "aw-elephant", label: "Elephant", sfSymbol: "pawprint", isEmergency: false),
            WatchPhrase(id: "ab-penguin", label: "Penguin", sfSymbol: "pawprint", isEmergency: false),
            WatchPhrase(id: "ab-sparrow", label: "Sparrow", sfSymbol: "pawprint", isEmergency: false),
            WatchPhrase(id: "as-starfish", label: "Starfish", sfSymbol: "pawprint", isEmergency: false),
        ]),
        WatchCategory(id: "colors", icon: "paintpalette", name: "Colors", phrases: [
            WatchPhrase(id: "co-red", label: "Red", sfSymbol: "circle.fill", isEmergency: false),
            WatchPhrase(id: "co-blue", label: "Blue", sfSymbol: "circle.fill", isEmergency: false),
            WatchPhrase(id: "co-green", label: "Green", sfSymbol: "circle.fill", isEmergency: false),
            WatchPhrase(id: "co-yellow", label: "Yellow", sfSymbol: "circle.fill", isEmergency: false),
            WatchPhrase(id: "co-orange", label: "Orange", sfSymbol: "circle.fill", isEmergency: false),
            WatchPhrase(id: "co-purple", label: "Purple", sfSymbol: "circle.fill", isEmergency: false),
            WatchPhrase(id: "co-pink", label: "Pink", sfSymbol: "circle.fill", isEmergency: false),
            WatchPhrase(id: "co-black", label: "Black", sfSymbol: "circle.fill", isEmergency: false),
            WatchPhrase(id: "co-white", label: "White", sfSymbol: "circle.fill", isEmergency: false),
            WatchPhrase(id: "co-brown", label: "Brown", sfSymbol: "circle.fill", isEmergency: false),
            WatchPhrase(id: "co-gray", label: "Gray", sfSymbol: "circle.fill", isEmergency: false),
            WatchPhrase(id: "co-silver", label: "Silver", sfSymbol: "circle.fill", isEmergency: false),
            WatchPhrase(id: "co-gold", label: "Gold", sfSymbol: "circle.fill", isEmergency: false),
            WatchPhrase(id: "co-beige", label: "Beige", sfSymbol: "circle.fill", isEmergency: false),
            WatchPhrase(id: "co-tan", label: "Tan", sfSymbol: "circle.fill", isEmergency: false),
            WatchPhrase(id: "co-light-blue", label: "Light blue", sfSymbol: "circle.fill", isEmergency: false),
            WatchPhrase(id: "co-dark-blue", label: "Dark blue", sfSymbol: "circle.fill", isEmergency: false),
            WatchPhrase(id: "co-light-green", label: "Light green", sfSymbol: "circle.fill", isEmergency: false),
            WatchPhrase(id: "co-dark-green", label: "Dark green", sfSymbol: "circle.fill", isEmergency: false),
            WatchPhrase(id: "co-light-pink", label: "Light pink", sfSymbol: "circle.fill", isEmergency: false),
            WatchPhrase(id: "co-hot-pink", label: "Hot pink", sfSymbol: "circle.fill", isEmergency: false),
            WatchPhrase(id: "co-rainbow", label: "Rainbow", sfSymbol: "circle.fill", isEmergency: false),
            WatchPhrase(id: "co-my-favorite-color", label: "My favorite color", sfSymbol: "circle.fill", isEmergency: false),
        ]),
        WatchCategory(id: "clothes", icon: "tshirt.fill", name: "Clothes", phrases: [
            WatchPhrase(id: "cl-shirt", label: "Shirt", sfSymbol: "tshirt", isEmergency: false),
            WatchPhrase(id: "cl-pants", label: "Pants", sfSymbol: "tshirt", isEmergency: false),
            WatchPhrase(id: "cl-shoes", label: "Shoes", sfSymbol: "tshirt", isEmergency: false),
            WatchPhrase(id: "cl-socks", label: "Socks", sfSymbol: "tshirt", isEmergency: false),
            WatchPhrase(id: "cl-jacket", label: "Jacket", sfSymbol: "tshirt", isEmergency: false),
            WatchPhrase(id: "cl-hat", label: "Hat", sfSymbol: "tshirt", isEmergency: false),
            WatchPhrase(id: "cl-dress", label: "Dress", sfSymbol: "tshirt", isEmergency: false),
            WatchPhrase(id: "cl-pajamas", label: "Pajamas", sfSymbol: "tshirt", isEmergency: false),
            WatchPhrase(id: "cl-underwear", label: "Underwear", sfSymbol: "tshirt", isEmergency: false),
            WatchPhrase(id: "cl-boots", label: "Boots", sfSymbol: "tshirt", isEmergency: false),
            WatchPhrase(id: "cl-t-shirt", label: "T-shirt", sfSymbol: "tshirt", isEmergency: false),
            WatchPhrase(id: "cl-sweater", label: "Sweater", sfSymbol: "tshirt", isEmergency: false),
            WatchPhrase(id: "cl-sweatshirt", label: "Sweatshirt", sfSymbol: "tshirt", isEmergency: false),
            WatchPhrase(id: "cl-hoodie", label: "Hoodie", sfSymbol: "tshirt", isEmergency: false),
            WatchPhrase(id: "cl-coat", label: "Coat", sfSymbol: "tshirt", isEmergency: false),
            WatchPhrase(id: "cl-shorts", label: "Shorts", sfSymbol: "tshirt", isEmergency: false),
            WatchPhrase(id: "cl-skirt", label: "Skirt", sfSymbol: "tshirt", isEmergency: false),
            WatchPhrase(id: "cl-leggings", label: "Leggings", sfSymbol: "tshirt", isEmergency: false),
            WatchPhrase(id: "cl-sandals", label: "Sandals", sfSymbol: "tshirt", isEmergency: false),
            WatchPhrase(id: "cl-sneakers", label: "Sneakers", sfSymbol: "tshirt", isEmergency: false),
            WatchPhrase(id: "cl-mittens", label: "Mittens", sfSymbol: "tshirt", isEmergency: false),
            WatchPhrase(id: "cl-gloves", label: "Gloves", sfSymbol: "tshirt", isEmergency: false),
            WatchPhrase(id: "cl-scarf", label: "Scarf", sfSymbol: "tshirt", isEmergency: false),
            WatchPhrase(id: "cl-belt", label: "Belt", sfSymbol: "tshirt", isEmergency: false),
            WatchPhrase(id: "cl-backpack", label: "Backpack", sfSymbol: "tshirt", isEmergency: false),
            WatchPhrase(id: "cl-helmet", label: "Helmet", sfSymbol: "tshirt", isEmergency: false),
            WatchPhrase(id: "cl-glasses", label: "Glasses", sfSymbol: "tshirt", isEmergency: false),
            WatchPhrase(id: "cl-sunglasses", label: "Sunglasses", sfSymbol: "tshirt", isEmergency: false),
            WatchPhrase(id: "cl-diaper", label: "Diaper", sfSymbol: "tshirt", isEmergency: false),
            WatchPhrase(id: "cl-pull-up", label: "Pull-up", sfSymbol: "tshirt", isEmergency: false),
        ]),
        WatchCategory(id: "transport", icon: "car.fill", name: "Transportation", phrases: [
            WatchPhrase(id: "tr-car", label: "Car", sfSymbol: "car", isEmergency: false),
            WatchPhrase(id: "tr-bus", label: "Bus", sfSymbol: "car", isEmergency: false),
            WatchPhrase(id: "tr-train", label: "Train", sfSymbol: "car", isEmergency: false),
            WatchPhrase(id: "tr-airplane", label: "Airplane", sfSymbol: "car", isEmergency: false),
            WatchPhrase(id: "tr-bike", label: "Bike", sfSymbol: "car", isEmergency: false),
            WatchPhrase(id: "tr-truck", label: "Truck", sfSymbol: "car", isEmergency: false),
            WatchPhrase(id: "tr-boat", label: "Boat", sfSymbol: "car", isEmergency: false),
            WatchPhrase(id: "tr-walk", label: "Walk", sfSymbol: "car", isEmergency: false),
            WatchPhrase(id: "tr-wheelchair", label: "Wheelchair", sfSymbol: "car", isEmergency: false),
            WatchPhrase(id: "tr-scooter", label: "Scooter", sfSymbol: "car", isEmergency: false),
            WatchPhrase(id: "tr-stroller", label: "Stroller", sfSymbol: "car", isEmergency: false),
            WatchPhrase(id: "tr-tricycle", label: "Tricycle", sfSymbol: "car", isEmergency: false),
            WatchPhrase(id: "tr-skateboard", label: "Skateboard", sfSymbol: "car", isEmergency: false),
            WatchPhrase(id: "tr-roller-skates", label: "Roller skates", sfSymbol: "car", isEmergency: false),
            WatchPhrase(id: "tr-subway", label: "Subway", sfSymbol: "car", isEmergency: false),
            WatchPhrase(id: "tr-taxi", label: "Taxi", sfSymbol: "car", isEmergency: false),
            WatchPhrase(id: "tr-helicopter", label: "Helicopter", sfSymbol: "car", isEmergency: false),
            WatchPhrase(id: "tr-rocket", label: "Rocket", sfSymbol: "car", isEmergency: false),
            WatchPhrase(id: "tr-tractor", label: "Tractor", sfSymbol: "car", isEmergency: false),
            WatchPhrase(id: "tr-fire-truck", label: "Fire truck", sfSymbol: "car", isEmergency: false),
            WatchPhrase(id: "tr-police-car", label: "Police car", sfSymbol: "car", isEmergency: false),
            WatchPhrase(id: "tr-ambulance", label: "Ambulance", sfSymbol: "car", isEmergency: false),
            WatchPhrase(id: "tr-ferry", label: "Ferry", sfSymbol: "car", isEmergency: false),
            WatchPhrase(id: "tr-sled", label: "Sled", sfSymbol: "car", isEmergency: false),
            WatchPhrase(id: "tr-drive", label: "Drive", sfSymbol: "car", isEmergency: false),
            WatchPhrase(id: "tr-ride", label: "Ride", sfSymbol: "car", isEmergency: false),
        ]),
        WatchCategory(id: "weather", icon: "cloud.sun.fill", name: "Weather", phrases: [
            WatchPhrase(id: "we-sunny", label: "Sunny", sfSymbol: "cloud", isEmergency: false),
            WatchPhrase(id: "we-rainy", label: "Rainy", sfSymbol: "cloud", isEmergency: false),
            WatchPhrase(id: "we-cloudy", label: "Cloudy", sfSymbol: "cloud", isEmergency: false),
            WatchPhrase(id: "we-snowy", label: "Snowy", sfSymbol: "cloud", isEmergency: false),
            WatchPhrase(id: "we-windy", label: "Windy", sfSymbol: "cloud", isEmergency: false),
            WatchPhrase(id: "we-hot", label: "Hot", sfSymbol: "cloud", isEmergency: false),
            WatchPhrase(id: "we-cold", label: "Cold", sfSymbol: "cloud", isEmergency: false),
            WatchPhrase(id: "we-storm", label: "Storm", sfSymbol: "cloud", isEmergency: false),
            WatchPhrase(id: "we-foggy", label: "Foggy", sfSymbol: "cloud", isEmergency: false),
            WatchPhrase(id: "we-rainbow", label: "Rainbow", sfSymbol: "cloud", isEmergency: false),
            WatchPhrase(id: "we-lightning", label: "Lightning", sfSymbol: "cloud", isEmergency: false),
            WatchPhrase(id: "we-thunder", label: "Thunder", sfSymbol: "cloud", isEmergency: false),
            WatchPhrase(id: "we-tornado", label: "Tornado", sfSymbol: "cloud", isEmergency: false),
            WatchPhrase(id: "we-hurricane", label: "Hurricane", sfSymbol: "cloud", isEmergency: false),
            WatchPhrase(id: "we-earthquake", label: "Earthquake", sfSymbol: "cloud", isEmergency: false),
            WatchPhrase(id: "we-warm-out", label: "Warm out", sfSymbol: "cloud", isEmergency: false),
            WatchPhrase(id: "we-cool-out", label: "Cool out", sfSymbol: "cloud", isEmergency: false),
            WatchPhrase(id: "we-freezing", label: "Freezing", sfSymbol: "cloud", isEmergency: false),
            WatchPhrase(id: "we-wear-a-coat", label: "Wear a coat", sfSymbol: "cloud", isEmergency: false),
            WatchPhrase(id: "we-wear-shorts", label: "Wear shorts", sfSymbol: "cloud", isEmergency: false),
        ]),
        WatchCategory(id: "toys-fun", icon: "gamecontroller.fill", name: "Toys & Fun", phrases: [
            WatchPhrase(id: "tf-ball", label: "Ball", sfSymbol: "gamecontroller", isEmergency: false),
            WatchPhrase(id: "tf-blocks", label: "Blocks", sfSymbol: "gamecontroller", isEmergency: false),
            WatchPhrase(id: "tf-doll", label: "Doll", sfSymbol: "gamecontroller", isEmergency: false),
            WatchPhrase(id: "tf-puzzle", label: "Puzzle", sfSymbol: "gamecontroller", isEmergency: false),
            WatchPhrase(id: "tf-game", label: "Game", sfSymbol: "gamecontroller", isEmergency: false),
            WatchPhrase(id: "tf-movie", label: "Movie", sfSymbol: "gamecontroller", isEmergency: false),
            WatchPhrase(id: "tf-music", label: "Music", sfSymbol: "gamecontroller", isEmergency: false),
            WatchPhrase(id: "tf-bubbles", label: "Bubbles", sfSymbol: "gamecontroller", isEmergency: false),
            WatchPhrase(id: "tf-swing", label: "Swing", sfSymbol: "gamecontroller", isEmergency: false),
            WatchPhrase(id: "tf-slide", label: "Slide", sfSymbol: "gamecontroller", isEmergency: false),
            WatchPhrase(id: "tf-coloring", label: "Coloring", sfSymbol: "gamecontroller", isEmergency: false),
            WatchPhrase(id: "tf-tablet", label: "Tablet", sfSymbol: "gamecontroller", isEmergency: false),
            WatchPhrase(id: "tf-stuffed-animal", label: "Stuffed animal", sfSymbol: "gamecontroller", isEmergency: false),
            WatchPhrase(id: "tf-action-figure", label: "Action figure", sfSymbol: "gamecontroller", isEmergency: false),
            WatchPhrase(id: "tf-lego", label: "Lego", sfSymbol: "gamecontroller", isEmergency: false),
            WatchPhrase(id: "tf-train-set", label: "Train set", sfSymbol: "gamecontroller", isEmergency: false),
            WatchPhrase(id: "tf-card-game", label: "Card game", sfSymbol: "gamecontroller", isEmergency: false),
            WatchPhrase(id: "tf-board-game", label: "Board game", sfSymbol: "gamecontroller", isEmergency: false),
            WatchPhrase(id: "tf-video-game", label: "Video game", sfSymbol: "gamecontroller", isEmergency: false),
            WatchPhrase(id: "tf-crayons", label: "Crayons", sfSymbol: "gamecontroller", isEmergency: false),
            WatchPhrase(id: "tf-stickers", label: "Stickers", sfSymbol: "gamecontroller", isEmergency: false),
            WatchPhrase(id: "tf-sandbox", label: "Sandbox", sfSymbol: "gamecontroller", isEmergency: false),
            WatchPhrase(id: "tf-trampoline", label: "Trampoline", sfSymbol: "gamecontroller", isEmergency: false),
            WatchPhrase(id: "tf-sprinkler", label: "Sprinkler", sfSymbol: "gamecontroller", isEmergency: false),
            WatchPhrase(id: "tf-story", label: "Story", sfSymbol: "gamecontroller", isEmergency: false),
            WatchPhrase(id: "tf-song", label: "Song", sfSymbol: "gamecontroller", isEmergency: false),
            WatchPhrase(id: "tf-cartoon", label: "Cartoon", sfSymbol: "gamecontroller", isEmergency: false),
        ]),
    ]
}
