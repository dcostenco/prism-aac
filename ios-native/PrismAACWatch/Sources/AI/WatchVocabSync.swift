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
                                arasaacId: ph.arasaacId,
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
                                arasaacId: ph.arasaacId,
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
    let arasaacId: Int?
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
    let arasaacId: Int?
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
                arasaacId:   $0.arasaacId,
                sfSymbol:    String($0.sfSymbol?.prefix(50) ?? "circle.fill"),
                isEmergency: isEmergencyCat
            )
        }
    }

    // Minimal offline core — always available even with no connectivity.
    // Contains only the most critical AAC phrases. Full vocabulary comes from API.
    static let offlineCore: [WatchCategory] = [
        WatchCategory(id: "quick", icon: "⚡", name: "Quick", phrases: [
            WatchPhrase(id: "yes",   label: "Yes",      arasaacId: 5584, sfSymbol: "checkmark.circle.fill"),
            WatchPhrase(id: "no",    label: "No",       arasaacId: 5578, sfSymbol: "xmark.circle.fill"),
            WatchPhrase(id: "more",  label: "More",     arasaacId: 5571, sfSymbol: "plus.circle"),
            WatchPhrase(id: "done",  label: "All done", arasaacId: 5552, sfSymbol: "checkmark.seal"),
            WatchPhrase(id: "help",  label: "Help",     arasaacId: 5557, sfSymbol: "sos"),
            WatchPhrase(id: "stop",  label: "Stop",     arasaacId: 5581, sfSymbol: "hand.raised.fill"),
            WatchPhrase(id: "water", label: "Water",    arasaacId: 14981, sfSymbol: "drop.fill"),
            WatchPhrase(id: "hurt",  label: "Hurt",     arasaacId: nil,  sfSymbol: "cross.fill", isEmergency: true),
        ]),
    ]

// generated: 1274 phrases × 22 categories
// 1196/1274 phrases have arasaacId (93%)
    /// iOS-parity default set — generated from constants/phrases.ts
    /// by scripts/gen-watch-default-set.py with arasaacId lookups from
    /// scripts/arasaac-id-cache.json. Sync rule: when phrases.ts changes,
    /// re-run fetch-arasaac-ids.py + gen-watch-default-set.py.
    static let iOSDefaultSet: [WatchCategory] = [
        WatchCategory(id: "core-pronouns", icon: "person.2.fill", name: "I / You / We", phrases: [
            WatchPhrase(id: "cw-i", label: "I", arasaacId: 6632, sfSymbol: "person.fill", isEmergency: false),
            WatchPhrase(id: "cw-you", label: "You", arasaacId: 6625, sfSymbol: "person.fill", isEmergency: false),
            WatchPhrase(id: "cw-he", label: "He", arasaacId: 6480, sfSymbol: "person.fill", isEmergency: false),
            WatchPhrase(id: "cw-she", label: "She", arasaacId: 7028, sfSymbol: "person.fill", isEmergency: false),
            WatchPhrase(id: "cw-it", label: "It", arasaacId: 31670, sfSymbol: "person.fill", isEmergency: false),
            WatchPhrase(id: "cw-we", label: "We", arasaacId: 7185, sfSymbol: "person.fill", isEmergency: false),
            WatchPhrase(id: "cw-they", label: "They", arasaacId: 7032, sfSymbol: "person.fill", isEmergency: false),
            WatchPhrase(id: "cw-me", label: "Me", arasaacId: 6632, sfSymbol: "person.fill", isEmergency: false),
            WatchPhrase(id: "cw-my", label: "My", arasaacId: 12264, sfSymbol: "person.fill", isEmergency: false),
            WatchPhrase(id: "cw-your", label: "Your", arasaacId: 12281, sfSymbol: "person.fill", isEmergency: false),
            WatchPhrase(id: "cw-his", label: "His", arasaacId: 12272, sfSymbol: "person.fill", isEmergency: false),
            WatchPhrase(id: "cw-her", label: "Her", arasaacId: 7029, sfSymbol: "person.fill", isEmergency: false),
            WatchPhrase(id: "cw-this", label: "This", arasaacId: 7095, sfSymbol: "person.fill", isEmergency: false),
            WatchPhrase(id: "cw-that", label: "That", arasaacId: 6906, sfSymbol: "person.fill", isEmergency: false),
            WatchPhrase(id: "cw-us", label: "Us", arasaacId: 7185, sfSymbol: "person.fill", isEmergency: false),
            WatchPhrase(id: "cw-them", label: "Them", arasaacId: 7032, sfSymbol: "person.fill", isEmergency: false),
            WatchPhrase(id: "cw-mine", label: "Mine", arasaacId: 12264, sfSymbol: "person.fill", isEmergency: false),
            WatchPhrase(id: "cw-yours", label: "Yours", arasaacId: 12281, sfSymbol: "person.fill", isEmergency: false),
            WatchPhrase(id: "cw-theirs", label: "Theirs", arasaacId: 12274, sfSymbol: "person.fill", isEmergency: false),
            WatchPhrase(id: "cw-ours", label: "Ours", arasaacId: 12268, sfSymbol: "person.fill", isEmergency: false),
            WatchPhrase(id: "cw-hers", label: "Hers", arasaacId: 12272, sfSymbol: "person.fill", isEmergency: false),
            WatchPhrase(id: "cw-myself", label: "Myself", arasaacId: 30642, sfSymbol: "person.fill", isEmergency: false),
            WatchPhrase(id: "cw-yourself", label: "Yourself", arasaacId: 6959, sfSymbol: "person.fill", isEmergency: false),
            WatchPhrase(id: "cw-themselves", label: "Themselves", arasaacId: 7032, sfSymbol: "person.fill", isEmergency: false),
            WatchPhrase(id: "cw-ourselves", label: "Ourselves", arasaacId: 7185, sfSymbol: "person.fill", isEmergency: false),
            WatchPhrase(id: "cw-each-other", label: "Each other", arasaacId: 39109, sfSymbol: "person.fill", isEmergency: false),
            WatchPhrase(id: "cw-anyone", label: "Anyone", arasaacId: 26779, sfSymbol: "person.fill", isEmergency: false),
            WatchPhrase(id: "cw-someone", label: "Someone", arasaacId: 37779, sfSymbol: "person.fill", isEmergency: false),
            WatchPhrase(id: "cw-everyone", label: "Everyone", arasaacId: 36081, sfSymbol: "person.fill", isEmergency: false),
            WatchPhrase(id: "cw-no-one", label: "No one", arasaacId: 39109, sfSymbol: "person.fill", isEmergency: false),
            WatchPhrase(id: "cw-nobody", label: "Nobody", arasaacId: 11314, sfSymbol: "person.fill", isEmergency: false),
            WatchPhrase(id: "cw-whose", label: "Whose", arasaacId: 32743, sfSymbol: "person.fill", isEmergency: false),
        ]),
        WatchCategory(id: "core-verbs", icon: "bolt.fill", name: "Core Verbs", phrases: [
            WatchPhrase(id: "cw-want", label: "Want", arasaacId: 5441, sfSymbol: "bolt", isEmergency: false),
            WatchPhrase(id: "cw-want-to", label: "Want to", arasaacId: 39109, sfSymbol: "bolt", isEmergency: false),
            WatchPhrase(id: "cw-like", label: "Like", arasaacId: 37826, sfSymbol: "bolt", isEmergency: false),
            WatchPhrase(id: "cw-have", label: "Have", arasaacId: 32761, sfSymbol: "bolt", isEmergency: false),
            WatchPhrase(id: "cw-do", label: "Do", arasaacId: 32751, sfSymbol: "bolt", isEmergency: false),
            WatchPhrase(id: "cw-can", label: "Can", arasaacId: 6544, sfSymbol: "bolt", isEmergency: false),
            WatchPhrase(id: "cw-need", label: "Need", arasaacId: 37160, sfSymbol: "bolt", isEmergency: false),
            WatchPhrase(id: "cw-know", label: "Know", arasaacId: 16885, sfSymbol: "bolt", isEmergency: false),
            WatchPhrase(id: "cw-see", label: "See", arasaacId: 6564, sfSymbol: "bolt", isEmergency: false),
            WatchPhrase(id: "cw-think", label: "Think", arasaacId: 38796, sfSymbol: "bolt", isEmergency: false),
            WatchPhrase(id: "cw-feel", label: "Feel", arasaacId: 3293, sfSymbol: "bolt", isEmergency: false),
            WatchPhrase(id: "cw-say", label: "Say", arasaacId: 9693, sfSymbol: "bolt", isEmergency: false),
            WatchPhrase(id: "cw-tell", label: "Tell", arasaacId: 9693, sfSymbol: "bolt", isEmergency: false),
            WatchPhrase(id: "cw-try", label: "Try", arasaacId: 8148, sfSymbol: "bolt", isEmergency: false),
            WatchPhrase(id: "cw-let", label: "Let", arasaacId: 2675, sfSymbol: "bolt", isEmergency: false),
            WatchPhrase(id: "cw-help", label: "Help", arasaacId: 32648, sfSymbol: "bolt", isEmergency: true),
            WatchPhrase(id: "cw-make", label: "Make", arasaacId: 32751, sfSymbol: "bolt", isEmergency: false),
            WatchPhrase(id: "cw-come", label: "Come", arasaacId: 32669, sfSymbol: "bolt", isEmergency: false),
            WatchPhrase(id: "cw-go-core", label: "Go", arasaacId: 8142, sfSymbol: "bolt", isEmergency: false),
            WatchPhrase(id: "cw-get-core", label: "Get", arasaacId: 24208, sfSymbol: "bolt", isEmergency: false),
            WatchPhrase(id: "cw-put-core", label: "Put", arasaacId: 32757, sfSymbol: "bolt", isEmergency: false),
            WatchPhrase(id: "cw-wait", label: "Wait", arasaacId: 36914, sfSymbol: "bolt", isEmergency: false),
            WatchPhrase(id: "cw-stop", label: "Stop", arasaacId: 7196, sfSymbol: "bolt", isEmergency: false),
            WatchPhrase(id: "cw-start", label: "Start", arasaacId: 5431, sfSymbol: "bolt", isEmergency: false),
            WatchPhrase(id: "cw-finish", label: "Finish", arasaacId: 32814, sfSymbol: "bolt", isEmergency: false),
            WatchPhrase(id: "cw-begin", label: "Begin", arasaacId: 5431, sfSymbol: "bolt", isEmergency: false),
            WatchPhrase(id: "cw-end", label: "End", arasaacId: 32814, sfSymbol: "bolt", isEmergency: false),
            WatchPhrase(id: "cw-stay", label: "Stay", arasaacId: 34337, sfSymbol: "bolt", isEmergency: false),
            WatchPhrase(id: "cw-leave", label: "Leave", arasaacId: 2806, sfSymbol: "bolt", isEmergency: false),
            WatchPhrase(id: "cw-look", label: "Look", arasaacId: 6564, sfSymbol: "bolt", isEmergency: false),
            WatchPhrase(id: "cw-watch", label: "Watch", arasaacId: 6564, sfSymbol: "bolt", isEmergency: false),
            WatchPhrase(id: "cw-hear", label: "Hear", arasaacId: 6572, sfSymbol: "bolt", isEmergency: false),
            WatchPhrase(id: "cw-listen", label: "Listen", arasaacId: 6572, sfSymbol: "bolt", isEmergency: false),
            WatchPhrase(id: "cw-smell", label: "Smell", arasaacId: 25275, sfSymbol: "bolt", isEmergency: false),
            WatchPhrase(id: "cw-taste", label: "Taste", arasaacId: 37834, sfSymbol: "bolt", isEmergency: false),
            WatchPhrase(id: "cw-touch", label: "Touch", arasaacId: 3293, sfSymbol: "bolt", isEmergency: false),
            WatchPhrase(id: "cw-hold", label: "Hold", arasaacId: 32761, sfSymbol: "bolt", isEmergency: false),
            WatchPhrase(id: "cw-grab", label: "Grab", arasaacId: 17044, sfSymbol: "bolt", isEmergency: false),
            WatchPhrase(id: "cw-push", label: "Push", arasaacId: 6485, sfSymbol: "bolt", isEmergency: false),
            WatchPhrase(id: "cw-pull", label: "Pull", arasaacId: 36601, sfSymbol: "bolt", isEmergency: false),
            WatchPhrase(id: "cw-lift", label: "Lift", arasaacId: 36073, sfSymbol: "bolt", isEmergency: false),
            WatchPhrase(id: "cw-carry", label: "Carry", arasaacId: 8983, sfSymbol: "bolt", isEmergency: false),
            WatchPhrase(id: "cw-drop", label: "Drop", arasaacId: 6215, sfSymbol: "bolt", isEmergency: false),
            WatchPhrase(id: "cw-throw", label: "Throw", arasaacId: 6543, sfSymbol: "bolt", isEmergency: false),
            WatchPhrase(id: "cw-catch", label: "Catch", arasaacId: 8087, sfSymbol: "bolt", isEmergency: false),
            WatchPhrase(id: "cw-open", label: "Open", arasaacId: 24825, sfSymbol: "bolt", isEmergency: false),
            WatchPhrase(id: "cw-close", label: "Close", arasaacId: 30383, sfSymbol: "bolt", isEmergency: false),
            WatchPhrase(id: "cw-turn", label: "Turn", arasaacId: 6630, sfSymbol: "bolt", isEmergency: false),
            WatchPhrase(id: "cw-move", label: "Move", arasaacId: 7167, sfSymbol: "bolt", isEmergency: false),
            WatchPhrase(id: "cw-sit", label: "Sit", arasaacId: 6611, sfSymbol: "bolt", isEmergency: false),
            WatchPhrase(id: "cw-stand", label: "Stand", arasaacId: 13370, sfSymbol: "bolt", isEmergency: false),
            WatchPhrase(id: "cw-walk", label: "Walk", arasaacId: 29951, sfSymbol: "bolt", isEmergency: false),
            WatchPhrase(id: "cw-run", label: "Run", arasaacId: 6465, sfSymbol: "bolt", isEmergency: false),
            WatchPhrase(id: "cw-jump", label: "Jump", arasaacId: 39052, sfSymbol: "bolt", isEmergency: false),
            WatchPhrase(id: "cw-climb", label: "Climb", arasaacId: 6617, sfSymbol: "bolt", isEmergency: false),
            WatchPhrase(id: "cw-fall", label: "Fall", arasaacId: 39440, sfSymbol: "bolt", isEmergency: false),
            WatchPhrase(id: "cw-rest", label: "Rest", arasaacId: 16643, sfSymbol: "bolt", isEmergency: false),
            WatchPhrase(id: "cw-sleep", label: "Sleep", arasaacId: 6479, sfSymbol: "bolt", isEmergency: false),
            WatchPhrase(id: "cw-wake", label: "Wake", arasaacId: 31874, sfSymbol: "bolt", isEmergency: false),
            WatchPhrase(id: "cw-dream", label: "Dream", arasaacId: 5590, sfSymbol: "bolt", isEmergency: false),
            WatchPhrase(id: "cw-eat", label: "Eat", arasaacId: 6456, sfSymbol: "bolt", isEmergency: false),
            WatchPhrase(id: "cw-drink", label: "Drink", arasaacId: 6061, sfSymbol: "bolt", isEmergency: false),
            WatchPhrase(id: "cw-bite", label: "Bite", arasaacId: 4700, sfSymbol: "bolt", isEmergency: false),
            WatchPhrase(id: "cw-chew", label: "Chew", arasaacId: 32654, sfSymbol: "bolt", isEmergency: false),
            WatchPhrase(id: "cw-swallow", label: "Swallow", arasaacId: 3336, sfSymbol: "bolt", isEmergency: false),
            WatchPhrase(id: "cw-spit", label: "Spit", arasaacId: 7090, sfSymbol: "bolt", isEmergency: false),
            WatchPhrase(id: "cw-talk", label: "Talk", arasaacId: 6517, sfSymbol: "bolt", isEmergency: false),
            WatchPhrase(id: "cw-speak", label: "Speak", arasaacId: 6517, sfSymbol: "bolt", isEmergency: false),
            WatchPhrase(id: "cw-whisper", label: "Whisper", arasaacId: 9037, sfSymbol: "bolt", isEmergency: false),
            WatchPhrase(id: "cw-shout", label: "Shout", arasaacId: 6552, sfSymbol: "bolt", isEmergency: false),
            WatchPhrase(id: "cw-sing", label: "Sing", arasaacId: 6960, sfSymbol: "bolt", isEmergency: false),
            WatchPhrase(id: "cw-laugh", label: "Laugh", arasaacId: 13354, sfSymbol: "bolt", isEmergency: false),
            WatchPhrase(id: "cw-cry", label: "Cry", arasaacId: 7147, sfSymbol: "bolt", isEmergency: false),
            WatchPhrase(id: "cw-smile", label: "Smile", arasaacId: 13354, sfSymbol: "bolt", isEmergency: false),
            WatchPhrase(id: "cw-read", label: "Read", arasaacId: 7141, sfSymbol: "bolt", isEmergency: false),
            WatchPhrase(id: "cw-write", label: "Write", arasaacId: 2380, sfSymbol: "bolt", isEmergency: false),
            WatchPhrase(id: "cw-draw", label: "Draw", arasaacId: 8088, sfSymbol: "bolt", isEmergency: false),
            WatchPhrase(id: "cw-paint", label: "Paint", arasaacId: 2348, sfSymbol: "bolt", isEmergency: false),
            WatchPhrase(id: "cw-color", label: "Color", arasaacId: 5968, sfSymbol: "bolt", isEmergency: false),
            WatchPhrase(id: "cw-cut", label: "Cut", arasaacId: 5975, sfSymbol: "bolt", isEmergency: false),
            WatchPhrase(id: "cw-glue", label: "Glue", arasaacId: 2709, sfSymbol: "bolt", isEmergency: false),
            WatchPhrase(id: "cw-build", label: "Build", arasaacId: 2713, sfSymbol: "bolt", isEmergency: false),
            WatchPhrase(id: "cw-break", label: "Break", arasaacId: 6604, sfSymbol: "bolt", isEmergency: false),
            WatchPhrase(id: "cw-fix", label: "Fix", arasaacId: 6910, sfSymbol: "bolt", isEmergency: false),
            WatchPhrase(id: "cw-clean", label: "Clean", arasaacId: 26172, sfSymbol: "bolt", isEmergency: false),
            WatchPhrase(id: "cw-wash", label: "Wash", arasaacId: 34826, sfSymbol: "bolt", isEmergency: false),
            WatchPhrase(id: "cw-find", label: "Find", arasaacId: 24742, sfSymbol: "bolt", isEmergency: false),
            WatchPhrase(id: "cw-look-for", label: "Look for", arasaacId: 6947, sfSymbol: "bolt", isEmergency: false),
            WatchPhrase(id: "cw-lose", label: "Lose", arasaacId: 24760, sfSymbol: "bolt", isEmergency: false),
            WatchPhrase(id: "cw-save", label: "Save", arasaacId: 4556, sfSymbol: "bolt", isEmergency: false),
            WatchPhrase(id: "cw-keep", label: "Keep", arasaacId: 17050, sfSymbol: "bolt", isEmergency: false),
            WatchPhrase(id: "cw-buy", label: "Buy", arasaacId: 8986, sfSymbol: "bolt", isEmergency: false),
            WatchPhrase(id: "cw-sell", label: "Sell", arasaacId: 6652, sfSymbol: "bolt", isEmergency: false),
            WatchPhrase(id: "cw-pay", label: "Pay", arasaacId: 6457, sfSymbol: "bolt", isEmergency: false),
            WatchPhrase(id: "cw-trade", label: "Trade", arasaacId: 6652, sfSymbol: "bolt", isEmergency: false),
            WatchPhrase(id: "cw-send", label: "Send", arasaacId: 21828, sfSymbol: "bolt", isEmergency: false),
            WatchPhrase(id: "cw-bring", label: "Bring", arasaacId: 7280, sfSymbol: "bolt", isEmergency: false),
            WatchPhrase(id: "cw-take", label: "Take", arasaacId: 10148, sfSymbol: "bolt", isEmergency: false),
            WatchPhrase(id: "cw-give", label: "Give", arasaacId: 28431, sfSymbol: "bolt", isEmergency: false),
            WatchPhrase(id: "cw-share", label: "Share", arasaacId: 38900, sfSymbol: "bolt", isEmergency: false),
            WatchPhrase(id: "cw-ask", label: "Ask", arasaacId: 25062, sfSymbol: "bolt", isEmergency: false),
            WatchPhrase(id: "cw-answer", label: "Answer", arasaacId: 9031, sfSymbol: "bolt", isEmergency: false),
            WatchPhrase(id: "cw-show", label: "Show", arasaacId: 16823, sfSymbol: "bolt", isEmergency: false),
            WatchPhrase(id: "cw-hide", label: "Hide", arasaacId: 6493, sfSymbol: "bolt", isEmergency: false),
            WatchPhrase(id: "cw-learn", label: "Learn", arasaacId: 37810, sfSymbol: "bolt", isEmergency: false),
            WatchPhrase(id: "cw-teach", label: "Teach", arasaacId: 26809, sfSymbol: "bolt", isEmergency: false),
            WatchPhrase(id: "cw-study", label: "Study", arasaacId: 6495, sfSymbol: "bolt", isEmergency: false),
            WatchPhrase(id: "cw-practice", label: "Practice", arasaacId: 14991, sfSymbol: "bolt", isEmergency: false),
            WatchPhrase(id: "cw-work", label: "Work", arasaacId: 6624, sfSymbol: "bolt", isEmergency: false),
            WatchPhrase(id: "cw-play", label: "Play", arasaacId: 23392, sfSymbol: "bolt", isEmergency: false),
            WatchPhrase(id: "cw-win", label: "Win", arasaacId: 7218, sfSymbol: "bolt", isEmergency: false),
            WatchPhrase(id: "cw-try-again", label: "Try again", arasaacId: 39109, sfSymbol: "bolt", isEmergency: false),
            WatchPhrase(id: "cw-hug", label: "Hug", arasaacId: 4550, sfSymbol: "bolt", isEmergency: false),
            WatchPhrase(id: "cw-kiss", label: "Kiss", arasaacId: 6062, sfSymbol: "bolt", isEmergency: false),
            WatchPhrase(id: "cw-pet", label: "Pet", arasaacId: 25654, sfSymbol: "bolt", isEmergency: false),
            WatchPhrase(id: "cw-tickle", label: "Tickle", arasaacId: 5480, sfSymbol: "bolt", isEmergency: false),
            WatchPhrase(id: "cw-wait-for-me", label: "Wait for me", arasaacId: 35187, sfSymbol: "bolt", isEmergency: false),
            WatchPhrase(id: "cw-help-me", label: "Help me", arasaacId: 39109, sfSymbol: "bolt", isEmergency: false),
            WatchPhrase(id: "cw-show-me", label: "Show me", arasaacId: 39109, sfSymbol: "bolt", isEmergency: false),
            WatchPhrase(id: "cw-tell-me", label: "Tell me", arasaacId: 39109, sfSymbol: "bolt", isEmergency: false),
            WatchPhrase(id: "cw-stop-that", label: "Stop that", arasaacId: 39109, sfSymbol: "bolt", isEmergency: false),
            WatchPhrase(id: "cw-i-want-to", label: "I want to", arasaacId: 39109, sfSymbol: "bolt", isEmergency: false),
            WatchPhrase(id: "cw-i-do-not-want", label: "I do not want", arasaacId: 6156, sfSymbol: "bolt", isEmergency: false),
            WatchPhrase(id: "cw-let-me-try", label: "Let me try", arasaacId: 39109, sfSymbol: "bolt", isEmergency: false),
            WatchPhrase(id: "cw-let-me-see", label: "Let me see", arasaacId: 39109, sfSymbol: "bolt", isEmergency: false),
        ]),
        WatchCategory(id: "core-descriptors", icon: "ruler.fill", name: "More / Not / All", phrases: [
            WatchPhrase(id: "cw-more", label: "More", arasaacId: 5508, sfSymbol: "arrow.up.and.down", isEmergency: false),
            WatchPhrase(id: "cw-not", label: "Not", arasaacId: 32308, sfSymbol: "arrow.up.and.down", isEmergency: false),
            WatchPhrase(id: "cw-no-core", label: "No", arasaacId: 5526, sfSymbol: "arrow.up.and.down", isEmergency: false),
            WatchPhrase(id: "cw-yes-core", label: "Yes", arasaacId: 5584, sfSymbol: "arrow.up.and.down", isEmergency: false),
            WatchPhrase(id: "cw-all", label: "All", arasaacId: 5596, sfSymbol: "arrow.up.and.down", isEmergency: false),
            WatchPhrase(id: "cw-some", label: "Some", arasaacId: 5374, sfSymbol: "arrow.up.and.down", isEmergency: false),
            WatchPhrase(id: "cw-other", label: "Other", arasaacId: 17056, sfSymbol: "arrow.up.and.down", isEmergency: false),
            WatchPhrase(id: "cw-very", label: "Very", arasaacId: 25708, sfSymbol: "arrow.up.and.down", isEmergency: false),
            WatchPhrase(id: "cw-here", label: "Here", arasaacId: 5382, sfSymbol: "arrow.up.and.down", isEmergency: false),
            WatchPhrase(id: "cw-there", label: "There", arasaacId: 5375, sfSymbol: "arrow.up.and.down", isEmergency: false),
            WatchPhrase(id: "cw-up", label: "Up", arasaacId: 5388, sfSymbol: "arrow.up.and.down", isEmergency: false),
            WatchPhrase(id: "cw-down", label: "Down", arasaacId: 37428, sfSymbol: "arrow.up.and.down", isEmergency: false),
            WatchPhrase(id: "cw-in", label: "In", arasaacId: 7034, sfSymbol: "arrow.up.and.down", isEmergency: false),
            WatchPhrase(id: "cw-out", label: "Out", arasaacId: 8252, sfSymbol: "arrow.up.and.down", isEmergency: false),
            WatchPhrase(id: "cw-on", label: "On", arasaacId: 7814, sfSymbol: "arrow.up.and.down", isEmergency: false),
            WatchPhrase(id: "cw-off", label: "Off", arasaacId: 7020, sfSymbol: "arrow.up.and.down", isEmergency: false),
            WatchPhrase(id: "cw-done", label: "Done", arasaacId: 10367, sfSymbol: "arrow.up.and.down", isEmergency: false),
            WatchPhrase(id: "cw-again", label: "Again", arasaacId: 37163, sfSymbol: "arrow.up.and.down", isEmergency: false),
            WatchPhrase(id: "cw-too", label: "Too", arasaacId: 11591, sfSymbol: "arrow.up.and.down", isEmergency: false),
            WatchPhrase(id: "cw-same-core", label: "Same", arasaacId: 4667, sfSymbol: "arrow.up.and.down", isEmergency: false),
            WatchPhrase(id: "cw-little", label: "Little", arasaacId: 25839, sfSymbol: "arrow.up.and.down", isEmergency: false),
            WatchPhrase(id: "cw-lots", label: "Lots", arasaacId: 7168, sfSymbol: "arrow.up.and.down", isEmergency: false),
            WatchPhrase(id: "cw-many", label: "Many", arasaacId: 7168, sfSymbol: "arrow.up.and.down", isEmergency: false),
            WatchPhrase(id: "cw-few", label: "Few", arasaacId: 7209, sfSymbol: "arrow.up.and.down", isEmergency: false),
            WatchPhrase(id: "cw-every", label: "Every", arasaacId: 17322, sfSymbol: "arrow.up.and.down", isEmergency: false),
            WatchPhrase(id: "cw-any", label: "Any", arasaacId: 5374, sfSymbol: "arrow.up.and.down", isEmergency: false),
            WatchPhrase(id: "cw-only", label: "Only", arasaacId: nil, sfSymbol: "arrow.up.and.down", isEmergency: false),
            WatchPhrase(id: "cw-just", label: "Just", arasaacId: 8612, sfSymbol: "arrow.up.and.down", isEmergency: false),
            WatchPhrase(id: "cw-full", label: "Full", arasaacId: 26176, sfSymbol: "arrow.up.and.down", isEmergency: false),
            WatchPhrase(id: "cw-empty", label: "Empty", arasaacId: 26527, sfSymbol: "arrow.up.and.down", isEmergency: false),
            WatchPhrase(id: "cw-open-2", label: "Open", arasaacId: 24825, sfSymbol: "arrow.up.and.down", isEmergency: false),
            WatchPhrase(id: "cw-closed", label: "Closed", arasaacId: 4596, sfSymbol: "arrow.up.and.down", isEmergency: false),
            WatchPhrase(id: "cw-easy", label: "Easy", arasaacId: 4645, sfSymbol: "arrow.up.and.down", isEmergency: false),
            WatchPhrase(id: "cw-hard", label: "Hard", arasaacId: 4637, sfSymbol: "arrow.up.and.down", isEmergency: false),
            WatchPhrase(id: "cw-soft", label: "Soft", arasaacId: 4578, sfSymbol: "arrow.up.and.down", isEmergency: false),
            WatchPhrase(id: "cw-loud", label: "Loud", arasaacId: 2647, sfSymbol: "arrow.up.and.down", isEmergency: false),
            WatchPhrase(id: "cw-quiet", label: "Quiet", arasaacId: 38050, sfSymbol: "arrow.up.and.down", isEmergency: false),
            WatchPhrase(id: "cw-bright", label: "Bright", arasaacId: nil, sfSymbol: "arrow.up.and.down", isEmergency: false),
            WatchPhrase(id: "cw-dark", label: "Dark", arasaacId: 26993, sfSymbol: "arrow.up.and.down", isEmergency: false),
            WatchPhrase(id: "cw-heavy", label: "Heavy", arasaacId: 27025, sfSymbol: "arrow.up.and.down", isEmergency: false),
            WatchPhrase(id: "cw-light", label: "Light", arasaacId: 8619, sfSymbol: "arrow.up.and.down", isEmergency: false),
            WatchPhrase(id: "cw-above", label: "Above", arasaacId: 5451, sfSymbol: "arrow.up.and.down", isEmergency: false),
            WatchPhrase(id: "cw-below", label: "Below", arasaacId: 5355, sfSymbol: "arrow.up.and.down", isEmergency: false),
            WatchPhrase(id: "cw-beside", label: "Beside", arasaacId: nil, sfSymbol: "arrow.up.and.down", isEmergency: false),
            WatchPhrase(id: "cw-between", label: "Between", arasaacId: 7765, sfSymbol: "arrow.up.and.down", isEmergency: false),
            WatchPhrase(id: "cw-near", label: "Near", arasaacId: 30383, sfSymbol: "arrow.up.and.down", isEmergency: false),
            WatchPhrase(id: "cw-far", label: "Far", arasaacId: 30385, sfSymbol: "arrow.up.and.down", isEmergency: false),
            WatchPhrase(id: "cw-around", label: "Around", arasaacId: 5376, sfSymbol: "arrow.up.and.down", isEmergency: false),
            WatchPhrase(id: "cw-through", label: "Through", arasaacId: 7212, sfSymbol: "arrow.up.and.down", isEmergency: false),
            WatchPhrase(id: "cw-over", label: "Over", arasaacId: 7814, sfSymbol: "arrow.up.and.down", isEmergency: false),
            WatchPhrase(id: "cw-under", label: "Under", arasaacId: 7047, sfSymbol: "arrow.up.and.down", isEmergency: false),
            WatchPhrase(id: "cw-across", label: "Across", arasaacId: 8274, sfSymbol: "arrow.up.and.down", isEmergency: false),
            WatchPhrase(id: "cw-behind", label: "Behind", arasaacId: 5443, sfSymbol: "arrow.up.and.down", isEmergency: false),
            WatchPhrase(id: "cw-ahead", label: "Ahead", arasaacId: 5438, sfSymbol: "arrow.up.and.down", isEmergency: false),
            WatchPhrase(id: "cw-always", label: "Always", arasaacId: 17322, sfSymbol: "arrow.up.and.down", isEmergency: false),
            WatchPhrase(id: "cw-never", label: "Never", arasaacId: 5527, sfSymbol: "arrow.up.and.down", isEmergency: false),
            WatchPhrase(id: "cw-often", label: "Often", arasaacId: 37029, sfSymbol: "arrow.up.and.down", isEmergency: false),
            WatchPhrase(id: "cw-sometimes", label: "Sometimes", arasaacId: 27385, sfSymbol: "arrow.up.and.down", isEmergency: false),
            WatchPhrase(id: "cw-maybe", label: "Maybe", arasaacId: nil, sfSymbol: "arrow.up.and.down", isEmergency: false),
            WatchPhrase(id: "cw-almost", label: "Almost", arasaacId: nil, sfSymbol: "arrow.up.and.down", isEmergency: false),
            WatchPhrase(id: "cw-already", label: "Already", arasaacId: nil, sfSymbol: "arrow.up.and.down", isEmergency: false),
            WatchPhrase(id: "cw-still", label: "Still", arasaacId: 37688, sfSymbol: "arrow.up.and.down", isEmergency: false),
            WatchPhrase(id: "cw-yet", label: "Yet", arasaacId: 38306, sfSymbol: "arrow.up.and.down", isEmergency: false),
            WatchPhrase(id: "cw-right-now", label: "Right now", arasaacId: 39109, sfSymbol: "arrow.up.and.down", isEmergency: false),
            WatchPhrase(id: "cw-right-here", label: "Right here", arasaacId: 39109, sfSymbol: "arrow.up.and.down", isEmergency: false),
            WatchPhrase(id: "cw-way-too-much", label: "Way too much", arasaacId: 39109, sfSymbol: "arrow.up.and.down", isEmergency: false),
            WatchPhrase(id: "cw-not-enough", label: "Not enough", arasaacId: 39109, sfSymbol: "arrow.up.and.down", isEmergency: false),
        ]),
        WatchCategory(id: "core-little-words", icon: "link", name: "Little Words", phrases: [
            WatchPhrase(id: "cw-is", label: "Is", arasaacId: 8115, sfSymbol: "textformat", isEmergency: false),
            WatchPhrase(id: "cw-the", label: "The", arasaacId: 8477, sfSymbol: "textformat", isEmergency: false),
            WatchPhrase(id: "cw-a", label: "A", arasaacId: 3021, sfSymbol: "textformat", isEmergency: false),
            WatchPhrase(id: "cw-and", label: "And", arasaacId: 11399, sfSymbol: "textformat", isEmergency: false),
            WatchPhrase(id: "cw-but", label: "But", arasaacId: 11377, sfSymbol: "textformat", isEmergency: false),
            WatchPhrase(id: "cw-or", label: "Or", arasaacId: 11317, sfSymbol: "textformat", isEmergency: false),
            WatchPhrase(id: "cw-to", label: "To", arasaacId: 7041, sfSymbol: "textformat", isEmergency: false),
            WatchPhrase(id: "cw-for", label: "For", arasaacId: 7081, sfSymbol: "textformat", isEmergency: false),
            WatchPhrase(id: "cw-with", label: "With", arasaacId: 7064, sfSymbol: "textformat", isEmergency: false),
            WatchPhrase(id: "cw-at", label: "At", arasaacId: 7041, sfSymbol: "textformat", isEmergency: false),
            WatchPhrase(id: "cw-of", label: "Of", arasaacId: 7074, sfSymbol: "textformat", isEmergency: false),
            WatchPhrase(id: "cw-about", label: "About", arasaacId: 7234, sfSymbol: "textformat", isEmergency: false),
            WatchPhrase(id: "cw-because", label: "Because", arasaacId: 11348, sfSymbol: "textformat", isEmergency: false),
            WatchPhrase(id: "cw-if", label: "If", arasaacId: 28359, sfSymbol: "textformat", isEmergency: false),
            WatchPhrase(id: "cw-when-core", label: "When", arasaacId: 32874, sfSymbol: "textformat", isEmergency: false),
            WatchPhrase(id: "cw-where-core", label: "Where", arasaacId: 7764, sfSymbol: "textformat", isEmergency: false),
            WatchPhrase(id: "cw-by", label: "By", arasaacId: 7074, sfSymbol: "textformat", isEmergency: false),
            WatchPhrase(id: "cw-from", label: "From", arasaacId: 7077, sfSymbol: "textformat", isEmergency: false),
            WatchPhrase(id: "cw-since", label: "Since", arasaacId: 7077, sfSymbol: "textformat", isEmergency: false),
            WatchPhrase(id: "cw-until", label: "Until", arasaacId: 7771, sfSymbol: "textformat", isEmergency: false),
            WatchPhrase(id: "cw-into", label: "Into", arasaacId: 36733, sfSymbol: "textformat", isEmergency: false),
            WatchPhrase(id: "cw-onto", label: "Onto", arasaacId: 11229, sfSymbol: "textformat", isEmergency: false),
            WatchPhrase(id: "cw-off-of", label: "Off of", arasaacId: 39109, sfSymbol: "textformat", isEmergency: false),
            WatchPhrase(id: "cw-away", label: "Away", arasaacId: 34657, sfSymbol: "textformat", isEmergency: false),
            WatchPhrase(id: "cw-back", label: "Back", arasaacId: 2748, sfSymbol: "textformat", isEmergency: false),
            WatchPhrase(id: "cw-beside-2", label: "Beside", arasaacId: nil, sfSymbol: "textformat", isEmergency: false),
            WatchPhrase(id: "cw-past", label: "Past", arasaacId: 9839, sfSymbol: "textformat", isEmergency: false),
            WatchPhrase(id: "cw-among", label: "Among", arasaacId: 7765, sfSymbol: "textformat", isEmergency: false),
            WatchPhrase(id: "cw-during", label: "During", arasaacId: 7081, sfSymbol: "textformat", isEmergency: false),
            WatchPhrase(id: "cw-while", label: "While", arasaacId: 7081, sfSymbol: "textformat", isEmergency: false),
            WatchPhrase(id: "cw-whenever", label: "Whenever", arasaacId: 17322, sfSymbol: "textformat", isEmergency: false),
            WatchPhrase(id: "cw-wherever", label: "Wherever", arasaacId: nil, sfSymbol: "textformat", isEmergency: false),
            WatchPhrase(id: "cw-both", label: "Both", arasaacId: 5367, sfSymbol: "textformat", isEmergency: false),
            WatchPhrase(id: "cw-either", label: "Either", arasaacId: nil, sfSymbol: "textformat", isEmergency: false),
            WatchPhrase(id: "cw-neither", label: "Neither", arasaacId: 11593, sfSymbol: "textformat", isEmergency: false),
            WatchPhrase(id: "cw-whether", label: "Whether", arasaacId: nil, sfSymbol: "textformat", isEmergency: false),
            WatchPhrase(id: "cw-although", label: "Although", arasaacId: 11185, sfSymbol: "textformat", isEmergency: false),
            WatchPhrase(id: "cw-though", label: "Though", arasaacId: 11185, sfSymbol: "textformat", isEmergency: false),
            WatchPhrase(id: "cw-unless", label: "Unless", arasaacId: nil, sfSymbol: "textformat", isEmergency: false),
            WatchPhrase(id: "cw-so", label: "So", arasaacId: 13080, sfSymbol: "textformat", isEmergency: false),
            WatchPhrase(id: "cw-then", label: "Then", arasaacId: 32749, sfSymbol: "textformat", isEmergency: false),
            WatchPhrase(id: "cw-also", label: "Also", arasaacId: nil, sfSymbol: "textformat", isEmergency: false),
            WatchPhrase(id: "cw-plus", label: "Plus", arasaacId: 3220, sfSymbol: "textformat", isEmergency: false),
            WatchPhrase(id: "cw-like-2", label: "Like", arasaacId: 37826, sfSymbol: "textformat", isEmergency: false),
            WatchPhrase(id: "cw-as", label: "As", arasaacId: 12313, sfSymbol: "textformat", isEmergency: false),
            WatchPhrase(id: "cw-such-as", label: "Such as", arasaacId: 39109, sfSymbol: "textformat", isEmergency: false),
            WatchPhrase(id: "cw-versus", label: "Versus", arasaacId: nil, sfSymbol: "textformat", isEmergency: false),
            WatchPhrase(id: "cw-since-then", label: "Since then", arasaacId: 39109, sfSymbol: "textformat", isEmergency: false),
            WatchPhrase(id: "cw-until-now", label: "Until now", arasaacId: 39109, sfSymbol: "textformat", isEmergency: false),
            WatchPhrase(id: "cw-right-after", label: "Right after", arasaacId: 39109, sfSymbol: "textformat", isEmergency: false),
            WatchPhrase(id: "cw-just-before", label: "Just before", arasaacId: 39109, sfSymbol: "textformat", isEmergency: false),
            WatchPhrase(id: "cw-up-to", label: "Up to", arasaacId: 7771, sfSymbol: "textformat", isEmergency: false),
            WatchPhrase(id: "cw-down-to", label: "Down to", arasaacId: 39109, sfSymbol: "textformat", isEmergency: false),
            WatchPhrase(id: "cw-next-to", label: "Next to", arasaacId: 5367, sfSymbol: "textformat", isEmergency: false),
            WatchPhrase(id: "cw-out-of", label: "Out of", arasaacId: 39109, sfSymbol: "textformat", isEmergency: false),
            WatchPhrase(id: "cw-a-few", label: "A few", arasaacId: 8475, sfSymbol: "textformat", isEmergency: false),
            WatchPhrase(id: "cw-a-lot", label: "A lot", arasaacId: 7168, sfSymbol: "textformat", isEmergency: false),
            WatchPhrase(id: "cw-a-little", label: "A little", arasaacId: 39109, sfSymbol: "textformat", isEmergency: false),
        ]),
        WatchCategory(id: "help-needs", icon: "sos", name: "Help / Needs", phrases: [
            WatchPhrase(id: "help-all-done", label: "All done", arasaacId: 39109, sfSymbol: "exclamationmark.triangle", isEmergency: false),
            WatchPhrase(id: "help-break", label: "Take a break", arasaacId: 9033, sfSymbol: "exclamationmark.triangle", isEmergency: false),
            WatchPhrase(id: "help-need-help", label: "I need help", arasaacId: 7171, sfSymbol: "exclamationmark.triangle", isEmergency: true),
            WatchPhrase(id: "help-hungry", label: "I am hungry", arasaacId: 7272, sfSymbol: "exclamationmark.triangle", isEmergency: false),
            WatchPhrase(id: "help-thirsty", label: "I am thirsty", arasaacId: 4963, sfSymbol: "exclamationmark.triangle", isEmergency: false),
            WatchPhrase(id: "help-bathroom", label: "Bathroom", arasaacId: 5921, sfSymbol: "exclamationmark.triangle", isEmergency: false),
            WatchPhrase(id: "help-yes", label: "Yes", arasaacId: 5584, sfSymbol: "exclamationmark.triangle", isEmergency: false),
            WatchPhrase(id: "help-no", label: "No", arasaacId: 5526, sfSymbol: "exclamationmark.triangle", isEmergency: false),
            WatchPhrase(id: "help-stop", label: "Stop", arasaacId: 7196, sfSymbol: "exclamationmark.triangle", isEmergency: false),
            WatchPhrase(id: "help-more", label: "More", arasaacId: 5508, sfSymbol: "exclamationmark.triangle", isEmergency: false),
            WatchPhrase(id: "help-want", label: "I want", arasaacId: 5441, sfSymbol: "exclamationmark.triangle", isEmergency: false),
            WatchPhrase(id: "help-hurts", label: "It hurts", arasaacId: 31670, sfSymbol: "exclamationmark.triangle", isEmergency: false),
            WatchPhrase(id: "help-tired", label: "I am tired", arasaacId: 6873, sfSymbol: "exclamationmark.triangle", isEmergency: false),
            WatchPhrase(id: "help-i-am-cold", label: "I am cold", arasaacId: 3280, sfSymbol: "exclamationmark.triangle", isEmergency: false),
            WatchPhrase(id: "help-i-am-hot", label: "I am hot", arasaacId: 2407, sfSymbol: "exclamationmark.triangle", isEmergency: false),
            WatchPhrase(id: "help-i-am-sleepy", label: "I am sleepy", arasaacId: nil, sfSymbol: "exclamationmark.triangle", isEmergency: false),
            WatchPhrase(id: "help-i-am-scared", label: "I am scared", arasaacId: 10746, sfSymbol: "exclamationmark.triangle", isEmergency: false),
            WatchPhrase(id: "help-i-am-sick", label: "I am sick", arasaacId: 27545, sfSymbol: "exclamationmark.triangle", isEmergency: false),
            WatchPhrase(id: "help-i-am-okay", label: "I am okay", arasaacId: 39109, sfSymbol: "exclamationmark.triangle", isEmergency: false),
            WatchPhrase(id: "help-i-am-not-okay", label: "I am not okay", arasaacId: 37182, sfSymbol: "exclamationmark.triangle", isEmergency: false),
            WatchPhrase(id: "help-i-am-ready", label: "I am ready", arasaacId: 32820, sfSymbol: "exclamationmark.triangle", isEmergency: false),
            WatchPhrase(id: "help-i-am-not-ready", label: "I am not ready", arasaacId: 32820, sfSymbol: "exclamationmark.triangle", isEmergency: false),
            WatchPhrase(id: "help-too-loud", label: "Too loud", arasaacId: 11591, sfSymbol: "exclamationmark.triangle", isEmergency: false),
            WatchPhrase(id: "help-too-bright", label: "Too bright", arasaacId: 11591, sfSymbol: "exclamationmark.triangle", isEmergency: false),
            WatchPhrase(id: "help-too-fast", label: "Too fast", arasaacId: 5306, sfSymbol: "exclamationmark.triangle", isEmergency: false),
            WatchPhrase(id: "help-too-slow", label: "Too slow", arasaacId: 4676, sfSymbol: "exclamationmark.triangle", isEmergency: false),
            WatchPhrase(id: "help-i-need-quiet", label: "I need quiet", arasaacId: 37312, sfSymbol: "exclamationmark.triangle", isEmergency: false),
            WatchPhrase(id: "help-i-need-a-break", label: "I need a break", arasaacId: 9033, sfSymbol: "exclamationmark.triangle", isEmergency: false),
            WatchPhrase(id: "help-i-need-water", label: "I need water", arasaacId: 3172, sfSymbol: "exclamationmark.triangle", isEmergency: false),
            WatchPhrase(id: "help-i-need-air", label: "I need air", arasaacId: 2344, sfSymbol: "exclamationmark.triangle", isEmergency: false),
            WatchPhrase(id: "help-i-need-my-mom", label: "I need my mom", arasaacId: 2458, sfSymbol: "exclamationmark.triangle", isEmergency: false),
            WatchPhrase(id: "help-i-need-my-dad", label: "I need my dad", arasaacId: 31146, sfSymbol: "exclamationmark.triangle", isEmergency: false),
            WatchPhrase(id: "help-i-need-my-teacher", label: "I need my teacher", arasaacId: 36261, sfSymbol: "exclamationmark.triangle", isEmergency: false),
            WatchPhrase(id: "help-i-need-a-hug", label: "I need a hug", arasaacId: 4550, sfSymbol: "exclamationmark.triangle", isEmergency: false),
            WatchPhrase(id: "help-i-need-space", label: "I need space", arasaacId: 5913, sfSymbol: "exclamationmark.triangle", isEmergency: false),
            WatchPhrase(id: "help-i-need-time", label: "I need time", arasaacId: 5527, sfSymbol: "exclamationmark.triangle", isEmergency: false),
            WatchPhrase(id: "help-hold-my-hand", label: "Hold my hand", arasaacId: 31873, sfSymbol: "exclamationmark.triangle", isEmergency: false),
            WatchPhrase(id: "help-watch-me", label: "Watch me", arasaacId: 29198, sfSymbol: "exclamationmark.triangle", isEmergency: false),
            WatchPhrase(id: "help-listen-to-me", label: "Listen to me", arasaacId: 2746, sfSymbol: "exclamationmark.triangle", isEmergency: false),
            WatchPhrase(id: "help-look-at-this", label: "Look at this", arasaacId: 39109, sfSymbol: "exclamationmark.triangle", isEmergency: false),
            WatchPhrase(id: "help-help-me-please", label: "Help me please", arasaacId: 39109, sfSymbol: "exclamationmark.triangle", isEmergency: false),
            WatchPhrase(id: "help-help-with-this", label: "Help with this", arasaacId: 39109, sfSymbol: "exclamationmark.triangle", isEmergency: false),
            WatchPhrase(id: "help-wait-for-me", label: "Wait for me", arasaacId: 35187, sfSymbol: "exclamationmark.triangle", isEmergency: false),
            WatchPhrase(id: "help-slow-down-please", label: "Slow down please", arasaacId: 4676, sfSymbol: "exclamationmark.triangle", isEmergency: false),
            WatchPhrase(id: "help-speak-more-slowly", label: "Speak more slowly", arasaacId: 4662, sfSymbol: "exclamationmark.triangle", isEmergency: false),
            WatchPhrase(id: "help-one-at-a-time", label: "One at a time", arasaacId: 5527, sfSymbol: "exclamationmark.triangle", isEmergency: false),
            WatchPhrase(id: "help-i-am-overwhelmed", label: "I am overwhelmed", arasaacId: nil, sfSymbol: "exclamationmark.triangle", isEmergency: false),
            WatchPhrase(id: "help-i-am-confused", label: "I am confused", arasaacId: 2352, sfSymbol: "exclamationmark.triangle", isEmergency: false),
            WatchPhrase(id: "help-i-do-not-understand", label: "I do not understand", arasaacId: 27363, sfSymbol: "exclamationmark.triangle", isEmergency: false),
            WatchPhrase(id: "help-please-be-patient", label: "Please be patient", arasaacId: 39196, sfSymbol: "exclamationmark.triangle", isEmergency: false),
            WatchPhrase(id: "help-give-me-a-minute", label: "Give me a minute", arasaacId: 37374, sfSymbol: "exclamationmark.triangle", isEmergency: false),
            WatchPhrase(id: "help-try-again", label: "Try again", arasaacId: 39109, sfSymbol: "exclamationmark.triangle", isEmergency: false),
            WatchPhrase(id: "help-calm-down", label: "Calm down", arasaacId: 32780, sfSymbol: "exclamationmark.triangle", isEmergency: false),
            WatchPhrase(id: "help-let-me-think", label: "Let me think", arasaacId: 39109, sfSymbol: "exclamationmark.triangle", isEmergency: false),
            WatchPhrase(id: "help-show-me-how", label: "Show me how", arasaacId: 39109, sfSymbol: "exclamationmark.triangle", isEmergency: false),
            WatchPhrase(id: "help-i-do-not-feel-good", label: "I do not feel good", arasaacId: 28614, sfSymbol: "exclamationmark.triangle", isEmergency: false),
            WatchPhrase(id: "help-my-head-hurts", label: "My head hurts", arasaacId: 37874, sfSymbol: "exclamationmark.triangle", isEmergency: false),
            WatchPhrase(id: "help-my-tummy-hurts", label: "My tummy hurts", arasaacId: 2786, sfSymbol: "exclamationmark.triangle", isEmergency: false),
            WatchPhrase(id: "help-my-ears-hurt", label: "My ears hurt", arasaacId: 21565, sfSymbol: "exclamationmark.triangle", isEmergency: false),
            WatchPhrase(id: "help-my-eyes-hurt", label: "My eyes hurt", arasaacId: 21565, sfSymbol: "exclamationmark.triangle", isEmergency: false),
            WatchPhrase(id: "help-i-feel-dizzy", label: "I feel dizzy", arasaacId: 36736, sfSymbol: "exclamationmark.triangle", isEmergency: false),
            WatchPhrase(id: "help-get-help", label: "Get help", arasaacId: 39109, sfSymbol: "exclamationmark.triangle", isEmergency: false),
            WatchPhrase(id: "help-call-my-mom", label: "Call my mom", arasaacId: 2458, sfSymbol: "exclamationmark.triangle", isEmergency: false),
            WatchPhrase(id: "help-call-my-dad", label: "Call my dad", arasaacId: 31146, sfSymbol: "exclamationmark.triangle", isEmergency: false),
            WatchPhrase(id: "help-call-the-nurse", label: "Call the nurse", arasaacId: 37341, sfSymbol: "exclamationmark.triangle", isEmergency: false),
            WatchPhrase(id: "help-where-is-my-aac", label: "Where is my AAC", arasaacId: 36723, sfSymbol: "exclamationmark.triangle", isEmergency: false),
            WatchPhrase(id: "help-my-battery-is-low", label: "My battery is low", arasaacId: 38332, sfSymbol: "exclamationmark.triangle", isEmergency: false),
            WatchPhrase(id: "help-i-dropped-my-tablet", label: "I dropped my tablet", arasaacId: 9165, sfSymbol: "exclamationmark.triangle", isEmergency: false),
        ]),
        WatchCategory(id: "quick-talk", icon: "bubble.left.and.bubble.right.fill", name: "Quick Talk", phrases: [
            WatchPhrase(id: "qt-hello", label: "Hello", arasaacId: 6522, sfSymbol: "bubble.left", isEmergency: false),
            WatchPhrase(id: "qt-goodbye", label: "Goodbye", arasaacId: 6028, sfSymbol: "bubble.left", isEmergency: false),
            WatchPhrase(id: "qt-thank-you", label: "Thank you", arasaacId: 8129, sfSymbol: "bubble.left", isEmergency: false),
            WatchPhrase(id: "qt-please", label: "Please", arasaacId: 8195, sfSymbol: "bubble.left", isEmergency: false),
            WatchPhrase(id: "qt-excuse-me", label: "Excuse me", arasaacId: nil, sfSymbol: "bubble.left", isEmergency: false),
            WatchPhrase(id: "qt-wait", label: "Wait", arasaacId: 36914, sfSymbol: "bubble.left", isEmergency: false),
            WatchPhrase(id: "qt-come-here", label: "Come here", arasaacId: 39109, sfSymbol: "bubble.left", isEmergency: false),
            WatchPhrase(id: "qt-how-are-you", label: "How are you?", arasaacId: 11597, sfSymbol: "bubble.left", isEmergency: false),
            WatchPhrase(id: "qt-sorry", label: "Sorry", arasaacId: 11625, sfSymbol: "bubble.left", isEmergency: false),
            WatchPhrase(id: "qt-my-name", label: "My name is", arasaacId: 39109, sfSymbol: "bubble.left", isEmergency: false),
            WatchPhrase(id: "qt-nice-meet", label: "Nice to meet you", arasaacId: 24711, sfSymbol: "bubble.left", isEmergency: false),
            WatchPhrase(id: "qt-see-later", label: "See you later", arasaacId: 6028, sfSymbol: "bubble.left", isEmergency: false),
            WatchPhrase(id: "qt-hi", label: "Hi", arasaacId: 6522, sfSymbol: "bubble.left", isEmergency: false),
            WatchPhrase(id: "qt-hey", label: "Hey", arasaacId: 7032, sfSymbol: "bubble.left", isEmergency: false),
            WatchPhrase(id: "qt-bye", label: "Bye", arasaacId: 6028, sfSymbol: "bubble.left", isEmergency: false),
            WatchPhrase(id: "qt-bye-bye", label: "Bye-bye", arasaacId: 5896, sfSymbol: "bubble.left", isEmergency: false),
            WatchPhrase(id: "qt-see-you", label: "See you", arasaacId: 6028, sfSymbol: "bubble.left", isEmergency: false),
            WatchPhrase(id: "qt-see-you-soon", label: "See you soon", arasaacId: 39109, sfSymbol: "bubble.left", isEmergency: false),
            WatchPhrase(id: "qt-see-you-tomorrow", label: "See you tomorrow", arasaacId: 38277, sfSymbol: "bubble.left", isEmergency: false),
            WatchPhrase(id: "qt-take-care", label: "Take care", arasaacId: 30468, sfSymbol: "bubble.left", isEmergency: false),
            WatchPhrase(id: "qt-have-fun", label: "Have fun", arasaacId: 8992, sfSymbol: "bubble.left", isEmergency: false),
            WatchPhrase(id: "qt-good-morning", label: "Good morning", arasaacId: 6944, sfSymbol: "bubble.left", isEmergency: false),
            WatchPhrase(id: "qt-good-afternoon", label: "Good afternoon", arasaacId: 6943, sfSymbol: "bubble.left", isEmergency: false),
            WatchPhrase(id: "qt-good-evening", label: "Good evening", arasaacId: 38567, sfSymbol: "bubble.left", isEmergency: false),
            WatchPhrase(id: "qt-good-night", label: "Good night", arasaacId: 6942, sfSymbol: "bubble.left", isEmergency: false),
            WatchPhrase(id: "qt-good-job", label: "Good job", arasaacId: 37554, sfSymbol: "bubble.left", isEmergency: false),
            WatchPhrase(id: "qt-well-done", label: "Well done", arasaacId: 35875, sfSymbol: "bubble.left", isEmergency: false),
            WatchPhrase(id: "qt-way-to-go", label: "Way to go", arasaacId: 39109, sfSymbol: "bubble.left", isEmergency: false),
            WatchPhrase(id: "qt-awesome", label: "Awesome", arasaacId: nil, sfSymbol: "bubble.left", isEmergency: false),
            WatchPhrase(id: "qt-cool", label: "Cool", arasaacId: 27735, sfSymbol: "bubble.left", isEmergency: false),
            WatchPhrase(id: "qt-nice", label: "Nice", arasaacId: 7251, sfSymbol: "bubble.left", isEmergency: false),
            WatchPhrase(id: "qt-great", label: "Great", arasaacId: 11599, sfSymbol: "bubble.left", isEmergency: false),
            WatchPhrase(id: "qt-wonderful", label: "Wonderful", arasaacId: nil, sfSymbol: "bubble.left", isEmergency: false),
            WatchPhrase(id: "qt-amazing", label: "Amazing", arasaacId: nil, sfSymbol: "bubble.left", isEmergency: false),
            WatchPhrase(id: "qt-perfect", label: "Perfect", arasaacId: 38006, sfSymbol: "bubble.left", isEmergency: false),
            WatchPhrase(id: "qt-yay", label: "Yay", arasaacId: nil, sfSymbol: "bubble.left", isEmergency: false),
            WatchPhrase(id: "qt-okay", label: "Okay", arasaacId: 5397, sfSymbol: "bubble.left", isEmergency: false),
            WatchPhrase(id: "qt-alright", label: "Alright", arasaacId: nil, sfSymbol: "bubble.left", isEmergency: false),
            WatchPhrase(id: "qt-sure", label: "Sure", arasaacId: 2913, sfSymbol: "bubble.left", isEmergency: false),
            WatchPhrase(id: "qt-of-course", label: "Of course", arasaacId: 39109, sfSymbol: "bubble.left", isEmergency: false),
            WatchPhrase(id: "qt-definitely", label: "Definitely", arasaacId: nil, sfSymbol: "bubble.left", isEmergency: false),
            WatchPhrase(id: "qt-maybe", label: "Maybe", arasaacId: nil, sfSymbol: "bubble.left", isEmergency: false),
            WatchPhrase(id: "qt-i-think-so", label: "I think so", arasaacId: 39109, sfSymbol: "bubble.left", isEmergency: false),
            WatchPhrase(id: "qt-i-am-not-sure", label: "I am not sure", arasaacId: 39109, sfSymbol: "bubble.left", isEmergency: false),
            WatchPhrase(id: "qt-it-is-fine", label: "It is fine", arasaacId: 5397, sfSymbol: "bubble.left", isEmergency: false),
            WatchPhrase(id: "qt-no-problem", label: "No problem", arasaacId: 39109, sfSymbol: "bubble.left", isEmergency: false),
            WatchPhrase(id: "qt-no-worries", label: "No worries", arasaacId: 5526, sfSymbol: "bubble.left", isEmergency: false),
            WatchPhrase(id: "qt-never-mind", label: "Never mind", arasaacId: 12349, sfSymbol: "bubble.left", isEmergency: false),
            WatchPhrase(id: "qt-my-bad", label: "My bad", arasaacId: 6140, sfSymbol: "bubble.left", isEmergency: false),
            WatchPhrase(id: "qt-oops", label: "Oops", arasaacId: 3253, sfSymbol: "bubble.left", isEmergency: false),
            WatchPhrase(id: "qt-bless-you", label: "Bless you", arasaacId: 30894, sfSymbol: "bubble.left", isEmergency: false),
            WatchPhrase(id: "qt-happy-birthday", label: "Happy birthday", arasaacId: 5997, sfSymbol: "bubble.left", isEmergency: false),
            WatchPhrase(id: "qt-happy-holidays", label: "Happy holidays", arasaacId: 32442, sfSymbol: "bubble.left", isEmergency: false),
            WatchPhrase(id: "qt-merry-christmas", label: "Merry Christmas", arasaacId: 32456, sfSymbol: "bubble.left", isEmergency: false),
            WatchPhrase(id: "qt-happy-new-year", label: "Happy New Year", arasaacId: 32480, sfSymbol: "bubble.left", isEmergency: false),
            WatchPhrase(id: "qt-eid-mubarak", label: "Eid Mubarak", arasaacId: 10305, sfSymbol: "bubble.left", isEmergency: false),
            WatchPhrase(id: "qt-happy-hanukkah", label: "Happy Hanukkah", arasaacId: 10744, sfSymbol: "bubble.left", isEmergency: false),
            WatchPhrase(id: "qt-congratulations", label: "Congratulations", arasaacId: 38566, sfSymbol: "bubble.left", isEmergency: false),
            WatchPhrase(id: "qt-i-am-proud-of-you", label: "I am proud of you", arasaacId: 39109, sfSymbol: "bubble.left", isEmergency: false),
            WatchPhrase(id: "qt-you-did-it", label: "You did it", arasaacId: 39109, sfSymbol: "bubble.left", isEmergency: false),
            WatchPhrase(id: "qt-how-was-your-day", label: "How was your day", arasaacId: 37372, sfSymbol: "bubble.left", isEmergency: false),
            WatchPhrase(id: "qt-i-had-a-good-day", label: "I had a good day", arasaacId: 37372, sfSymbol: "bubble.left", isEmergency: false),
            WatchPhrase(id: "qt-i-had-a-bad-day", label: "I had a bad day", arasaacId: 29458, sfSymbol: "bubble.left", isEmergency: false),
            WatchPhrase(id: "qt-tell-me-about-your-day", label: "Tell me about your day", arasaacId: 37372, sfSymbol: "bubble.left", isEmergency: false),
            WatchPhrase(id: "qt-i-missed-you", label: "I missed you", arasaacId: nil, sfSymbol: "bubble.left", isEmergency: false),
            WatchPhrase(id: "qt-i-am-here", label: "I am here", arasaacId: 39109, sfSymbol: "bubble.left", isEmergency: false),
            WatchPhrase(id: "qt-i-love-you-too", label: "I love you too", arasaacId: 11519, sfSymbol: "bubble.left", isEmergency: false),
            WatchPhrase(id: "qt-you-are-my-friend", label: "You are my friend", arasaacId: 38941, sfSymbol: "bubble.left", isEmergency: false),
            WatchPhrase(id: "qt-best-friends", label: "Best friends", arasaacId: 38941, sfSymbol: "bubble.left", isEmergency: false),
        ]),
        WatchCategory(id: "feelings", icon: "face.smiling", name: "Feelings", phrases: [
            WatchPhrase(id: "fe-happy", label: "Happy", arasaacId: 35533, sfSymbol: "face.smiling", isEmergency: false),
            WatchPhrase(id: "fe-sad", label: "Sad", arasaacId: 35545, sfSymbol: "face.smiling", isEmergency: false),
            WatchPhrase(id: "fe-angry", label: "Angry", arasaacId: 35539, sfSymbol: "face.smiling", isEmergency: false),
            WatchPhrase(id: "fe-scared", label: "Scared", arasaacId: 35535, sfSymbol: "face.smiling", isEmergency: false),
            WatchPhrase(id: "fe-excited", label: "Excited", arasaacId: 39090, sfSymbol: "face.smiling", isEmergency: false),
            WatchPhrase(id: "fe-frustrated", label: "Frustrated", arasaacId: nil, sfSymbol: "face.smiling", isEmergency: false),
            WatchPhrase(id: "fe-bored", label: "Bored", arasaacId: 35531, sfSymbol: "face.smiling", isEmergency: false),
            WatchPhrase(id: "fe-surprised", label: "Surprised", arasaacId: 35529, sfSymbol: "face.smiling", isEmergency: false),
            WatchPhrase(id: "fe-confused", label: "Confused", arasaacId: 2352, sfSymbol: "face.smiling", isEmergency: false),
            WatchPhrase(id: "fe-proud", label: "Proud", arasaacId: 31408, sfSymbol: "face.smiling", isEmergency: false),
            WatchPhrase(id: "fe-nervous", label: "Nervous", arasaacId: 30391, sfSymbol: "face.smiling", isEmergency: false),
            WatchPhrase(id: "fe-silly", label: "Silly", arasaacId: 15483, sfSymbol: "face.smiling", isEmergency: false),
            WatchPhrase(id: "fe-love", label: "I love you", arasaacId: 11519, sfSymbol: "face.smiling", isEmergency: false),
            WatchPhrase(id: "fe-hurt", label: "My feelings are hurt", arasaacId: 5484, sfSymbol: "face.smiling", isEmergency: false),
            WatchPhrase(id: "fe-calm", label: "Calm", arasaacId: 31310, sfSymbol: "face.smiling", isEmergency: false),
            WatchPhrase(id: "fe-peaceful", label: "Peaceful", arasaacId: nil, sfSymbol: "face.smiling", isEmergency: false),
            WatchPhrase(id: "fe-relaxed", label: "Relaxed", arasaacId: nil, sfSymbol: "face.smiling", isEmergency: false),
            WatchPhrase(id: "fe-content", label: "Content", arasaacId: 35547, sfSymbol: "face.smiling", isEmergency: false),
            WatchPhrase(id: "fe-joyful", label: "Joyful", arasaacId: nil, sfSymbol: "face.smiling", isEmergency: false),
            WatchPhrase(id: "fe-glad", label: "Glad", arasaacId: 6892, sfSymbol: "face.smiling", isEmergency: false),
            WatchPhrase(id: "fe-cheerful", label: "Cheerful", arasaacId: 35533, sfSymbol: "face.smiling", isEmergency: false),
            WatchPhrase(id: "fe-hopeful", label: "Hopeful", arasaacId: nil, sfSymbol: "face.smiling", isEmergency: false),
            WatchPhrase(id: "fe-grateful", label: "Grateful", arasaacId: nil, sfSymbol: "face.smiling", isEmergency: false),
            WatchPhrase(id: "fe-thankful", label: "Thankful", arasaacId: nil, sfSymbol: "face.smiling", isEmergency: false),
            WatchPhrase(id: "fe-loved", label: "Loved", arasaacId: 11178, sfSymbol: "face.smiling", isEmergency: false),
            WatchPhrase(id: "fe-safe", label: "Safe", arasaacId: 6068, sfSymbol: "face.smiling", isEmergency: false),
            WatchPhrase(id: "fe-comfortable", label: "Comfortable", arasaacId: 11248, sfSymbol: "face.smiling", isEmergency: false),
            WatchPhrase(id: "fe-warm-inside", label: "Warm inside", arasaacId: 36506, sfSymbol: "face.smiling", isEmergency: false),
            WatchPhrase(id: "fe-tired", label: "Tired", arasaacId: 35537, sfSymbol: "face.smiling", isEmergency: false),
            WatchPhrase(id: "fe-sleepy", label: "Sleepy", arasaacId: nil, sfSymbol: "face.smiling", isEmergency: false),
            WatchPhrase(id: "fe-hungry", label: "Hungry", arasaacId: 4962, sfSymbol: "face.smiling", isEmergency: false),
            WatchPhrase(id: "fe-full", label: "Full", arasaacId: 26176, sfSymbol: "face.smiling", isEmergency: false),
            WatchPhrase(id: "fe-thirsty", label: "Thirsty", arasaacId: 4963, sfSymbol: "face.smiling", isEmergency: false),
            WatchPhrase(id: "fe-sick", label: "Sick", arasaacId: 7040, sfSymbol: "face.smiling", isEmergency: false),
            WatchPhrase(id: "fe-lonely", label: "Lonely", arasaacId: 7253, sfSymbol: "face.smiling", isEmergency: false),
            WatchPhrase(id: "fe-embarrassed", label: "Embarrassed", arasaacId: 6922, sfSymbol: "face.smiling", isEmergency: false),
            WatchPhrase(id: "fe-shy", label: "Shy", arasaacId: 8707, sfSymbol: "face.smiling", isEmergency: false),
            WatchPhrase(id: "fe-ashamed", label: "Ashamed", arasaacId: 6922, sfSymbol: "face.smiling", isEmergency: false),
            WatchPhrase(id: "fe-guilty", label: "Guilty", arasaacId: nil, sfSymbol: "face.smiling", isEmergency: false),
            WatchPhrase(id: "fe-jealous", label: "Jealous", arasaacId: 30630, sfSymbol: "face.smiling", isEmergency: false),
            WatchPhrase(id: "fe-disappointed", label: "Disappointed", arasaacId: nil, sfSymbol: "face.smiling", isEmergency: false),
            WatchPhrase(id: "fe-annoyed", label: "Annoyed", arasaacId: 35539, sfSymbol: "face.smiling", isEmergency: false),
            WatchPhrase(id: "fe-anxious", label: "Anxious", arasaacId: 30484, sfSymbol: "face.smiling", isEmergency: false),
            WatchPhrase(id: "fe-worried", label: "Worried", arasaacId: 26985, sfSymbol: "face.smiling", isEmergency: false),
            WatchPhrase(id: "fe-stressed", label: "Stressed", arasaacId: nil, sfSymbol: "face.smiling", isEmergency: false),
            WatchPhrase(id: "fe-panicked", label: "Panicked", arasaacId: nil, sfSymbol: "face.smiling", isEmergency: false),
            WatchPhrase(id: "fe-terrified", label: "Terrified", arasaacId: nil, sfSymbol: "face.smiling", isEmergency: false),
            WatchPhrase(id: "fe-brave", label: "Brave", arasaacId: 36163, sfSymbol: "face.smiling", isEmergency: false),
            WatchPhrase(id: "fe-strong", label: "Strong", arasaacId: 25121, sfSymbol: "face.smiling", isEmergency: false),
            WatchPhrase(id: "fe-weak", label: "Weak", arasaacId: 25044, sfSymbol: "face.smiling", isEmergency: false),
            WatchPhrase(id: "fe-dizzy", label: "Dizzy", arasaacId: 2464, sfSymbol: "face.smiling", isEmergency: false),
            WatchPhrase(id: "fe-itchy", label: "Itchy", arasaacId: nil, sfSymbol: "face.smiling", isEmergency: false),
            WatchPhrase(id: "fe-ticklish", label: "Ticklish", arasaacId: nil, sfSymbol: "face.smiling", isEmergency: false),
            WatchPhrase(id: "fe-numb", label: "Numb", arasaacId: 2879, sfSymbol: "face.smiling", isEmergency: false),
            WatchPhrase(id: "fe-cold-inside", label: "Cold inside", arasaacId: 3280, sfSymbol: "face.smiling", isEmergency: false),
            WatchPhrase(id: "fe-empty", label: "Empty", arasaacId: 26527, sfSymbol: "face.smiling", isEmergency: false),
            WatchPhrase(id: "fe-heavy-heart", label: "Heavy heart", arasaacId: 27025, sfSymbol: "face.smiling", isEmergency: false),
            WatchPhrase(id: "fe-mixed-up", label: "Mixed up", arasaacId: 36889, sfSymbol: "face.smiling", isEmergency: false),
            WatchPhrase(id: "fe-confused-inside", label: "Confused inside", arasaacId: 2352, sfSymbol: "face.smiling", isEmergency: false),
            WatchPhrase(id: "fe-stuck", label: "Stuck", arasaacId: 38271, sfSymbol: "face.smiling", isEmergency: false),
            WatchPhrase(id: "fe-missing-someone", label: "Missing someone", arasaacId: 9851, sfSymbol: "face.smiling", isEmergency: false),
            WatchPhrase(id: "fe-homesick", label: "Homesick", arasaacId: nil, sfSymbol: "face.smiling", isEmergency: false),
            WatchPhrase(id: "fe-overwhelmed", label: "Overwhelmed", arasaacId: nil, sfSymbol: "face.smiling", isEmergency: false),
            WatchPhrase(id: "fe-done-with-this", label: "Done with this", arasaacId: 39109, sfSymbol: "face.smiling", isEmergency: false),
            WatchPhrase(id: "fe-i-have-had-enough", label: "I have had enough", arasaacId: 39109, sfSymbol: "face.smiling", isEmergency: false),
            WatchPhrase(id: "fe-i-feel-good", label: "I feel good", arasaacId: 28614, sfSymbol: "face.smiling", isEmergency: false),
            WatchPhrase(id: "fe-i-feel-bad", label: "I feel bad", arasaacId: 28614, sfSymbol: "face.smiling", isEmergency: false),
            WatchPhrase(id: "fe-i-feel-okay", label: "I feel okay", arasaacId: 28614, sfSymbol: "face.smiling", isEmergency: false),
            WatchPhrase(id: "fe-i-feel-weird", label: "I feel weird", arasaacId: 28614, sfSymbol: "face.smiling", isEmergency: false),
        ]),
        WatchCategory(id: "questions", icon: "questionmark.circle.fill", name: "Questions", phrases: [
            WatchPhrase(id: "qu-what", label: "What?", arasaacId: 22620, sfSymbol: "questionmark.circle", isEmergency: false),
            WatchPhrase(id: "qu-where", label: "Where?", arasaacId: 7764, sfSymbol: "questionmark.circle", isEmergency: false),
            WatchPhrase(id: "qu-when", label: "When?", arasaacId: 22621, sfSymbol: "questionmark.circle", isEmergency: false),
            WatchPhrase(id: "qu-who", label: "Who?", arasaacId: 10276, sfSymbol: "questionmark.circle", isEmergency: false),
            WatchPhrase(id: "qu-why", label: "Why?", arasaacId: 24763, sfSymbol: "questionmark.circle", isEmergency: false),
            WatchPhrase(id: "qu-how", label: "How?", arasaacId: 22619, sfSymbol: "questionmark.circle", isEmergency: false),
            WatchPhrase(id: "qu-which", label: "Which one?", arasaacId: 5441, sfSymbol: "questionmark.circle", isEmergency: false),
            WatchPhrase(id: "qu-how-many", label: "How many?", arasaacId: 24731, sfSymbol: "questionmark.circle", isEmergency: false),
            WatchPhrase(id: "qu-can-i", label: "Can I?", arasaacId: 31760, sfSymbol: "questionmark.circle", isEmergency: false),
            WatchPhrase(id: "qu-is-it", label: "Is it?", arasaacId: 7075, sfSymbol: "questionmark.circle", isEmergency: false),
            WatchPhrase(id: "qu-where-going", label: "Where are we going?", arasaacId: 7079, sfSymbol: "questionmark.circle", isEmergency: false),
            WatchPhrase(id: "qu-who-is-that", label: "Who is that", arasaacId: 39109, sfSymbol: "questionmark.circle", isEmergency: false),
            WatchPhrase(id: "qu-what-is-that", label: "What is that", arasaacId: 39109, sfSymbol: "questionmark.circle", isEmergency: false),
            WatchPhrase(id: "qu-where-is-it", label: "Where is it", arasaacId: 39109, sfSymbol: "questionmark.circle", isEmergency: false),
            WatchPhrase(id: "qu-when-is-it", label: "When is it", arasaacId: 39109, sfSymbol: "questionmark.circle", isEmergency: false),
            WatchPhrase(id: "qu-why-is-that", label: "Why is that", arasaacId: 39109, sfSymbol: "questionmark.circle", isEmergency: false),
            WatchPhrase(id: "qu-how-does-it-work", label: "How does it work", arasaacId: 39109, sfSymbol: "questionmark.circle", isEmergency: false),
            WatchPhrase(id: "qu-how-do-i", label: "How do I", arasaacId: 39109, sfSymbol: "questionmark.circle", isEmergency: false),
            WatchPhrase(id: "qu-can-i-have-it", label: "Can I have it", arasaacId: 39109, sfSymbol: "questionmark.circle", isEmergency: false),
            WatchPhrase(id: "qu-can-i-try", label: "Can I try", arasaacId: 39109, sfSymbol: "questionmark.circle", isEmergency: false),
            WatchPhrase(id: "qu-can-i-go", label: "Can I go", arasaacId: 39109, sfSymbol: "questionmark.circle", isEmergency: false),
            WatchPhrase(id: "qu-may-i-please", label: "May I please", arasaacId: 39109, sfSymbol: "questionmark.circle", isEmergency: false),
            WatchPhrase(id: "qu-will-you-help", label: "Will you help", arasaacId: 39109, sfSymbol: "questionmark.circle", isEmergency: false),
            WatchPhrase(id: "qu-are-you-okay", label: "Are you okay", arasaacId: 39109, sfSymbol: "questionmark.circle", isEmergency: false),
            WatchPhrase(id: "qu-are-we-there-yet", label: "Are we there yet", arasaacId: 39109, sfSymbol: "questionmark.circle", isEmergency: false),
            WatchPhrase(id: "qu-where-are-we-going", label: "Where are we going", arasaacId: 39109, sfSymbol: "questionmark.circle", isEmergency: false),
            WatchPhrase(id: "qu-when-will-we-be-there", label: "When will we be there", arasaacId: 39109, sfSymbol: "questionmark.circle", isEmergency: false),
            WatchPhrase(id: "qu-how-much-longer", label: "How much longer", arasaacId: 39109, sfSymbol: "questionmark.circle", isEmergency: false),
            WatchPhrase(id: "qu-what-time-is-it", label: "What time is it", arasaacId: 5527, sfSymbol: "questionmark.circle", isEmergency: false),
            WatchPhrase(id: "qu-what-day-is-it", label: "What day is it", arasaacId: 37372, sfSymbol: "questionmark.circle", isEmergency: false),
            WatchPhrase(id: "qu-is-it-ready-yet", label: "Is it ready yet", arasaacId: 32820, sfSymbol: "questionmark.circle", isEmergency: false),
            WatchPhrase(id: "qu-can-we-go-now", label: "Can we go now", arasaacId: 39109, sfSymbol: "questionmark.circle", isEmergency: false),
            WatchPhrase(id: "qu-can-we-do-this", label: "Can we do this", arasaacId: 39109, sfSymbol: "questionmark.circle", isEmergency: false),
            WatchPhrase(id: "qu-did-you-see-that", label: "Did you see that", arasaacId: 39109, sfSymbol: "questionmark.circle", isEmergency: false),
            WatchPhrase(id: "qu-did-i-do-good", label: "Did I do good", arasaacId: 39109, sfSymbol: "questionmark.circle", isEmergency: false),
            WatchPhrase(id: "qu-what-happened", label: "What happened", arasaacId: 22620, sfSymbol: "questionmark.circle", isEmergency: false),
            WatchPhrase(id: "qu-where-did-it-go", label: "Where did it go", arasaacId: 39109, sfSymbol: "questionmark.circle", isEmergency: false),
            WatchPhrase(id: "qu-who-said-that", label: "Who said that", arasaacId: 39109, sfSymbol: "questionmark.circle", isEmergency: false),
            WatchPhrase(id: "qu-what-did-they-say", label: "What did they say", arasaacId: 39109, sfSymbol: "questionmark.circle", isEmergency: false),
            WatchPhrase(id: "qu-how-old-are-you", label: "How old are you", arasaacId: 39109, sfSymbol: "questionmark.circle", isEmergency: false),
            WatchPhrase(id: "qu-what-is-your-name", label: "What is your name", arasaacId: 39109, sfSymbol: "questionmark.circle", isEmergency: false),
            WatchPhrase(id: "qu-how-are-you-feeling", label: "How are you feeling", arasaacId: 39091, sfSymbol: "questionmark.circle", isEmergency: false),
            WatchPhrase(id: "qu-what-is-for-dinner", label: "What is for dinner", arasaacId: 4944, sfSymbol: "questionmark.circle", isEmergency: false),
            WatchPhrase(id: "qu-what-is-for-snack", label: "What is for snack", arasaacId: 37531, sfSymbol: "questionmark.circle", isEmergency: false),
            WatchPhrase(id: "qu-is-it-bedtime", label: "Is it bedtime", arasaacId: 31670, sfSymbol: "questionmark.circle", isEmergency: false),
            WatchPhrase(id: "qu-are-you-my-friend", label: "Are you my friend", arasaacId: 38941, sfSymbol: "questionmark.circle", isEmergency: false),
            WatchPhrase(id: "qu-will-you-play-with-me", label: "Will you play with me", arasaacId: 36145, sfSymbol: "questionmark.circle", isEmergency: false),
        ]),
        WatchCategory(id: "actions", icon: "figure.run", name: "Actions", phrases: [
            WatchPhrase(id: "ac-go", label: "Go", arasaacId: 8142, sfSymbol: "figure.walk", isEmergency: false),
            WatchPhrase(id: "ac-stop", label: "Stop", arasaacId: 7196, sfSymbol: "figure.walk", isEmergency: false),
            WatchPhrase(id: "ac-eat", label: "Eat", arasaacId: 6456, sfSymbol: "figure.walk", isEmergency: false),
            WatchPhrase(id: "ac-drink", label: "Drink", arasaacId: 6061, sfSymbol: "figure.walk", isEmergency: false),
            WatchPhrase(id: "ac-play", label: "Play", arasaacId: 23392, sfSymbol: "figure.walk", isEmergency: false),
            WatchPhrase(id: "ac-read", label: "Read", arasaacId: 7141, sfSymbol: "figure.walk", isEmergency: false),
            WatchPhrase(id: "ac-watch", label: "Watch", arasaacId: 6564, sfSymbol: "figure.walk", isEmergency: false),
            WatchPhrase(id: "ac-listen", label: "Listen", arasaacId: 6572, sfSymbol: "figure.walk", isEmergency: false),
            WatchPhrase(id: "ac-open", label: "Open", arasaacId: 24825, sfSymbol: "figure.walk", isEmergency: false),
            WatchPhrase(id: "ac-close", label: "Close", arasaacId: 30383, sfSymbol: "figure.walk", isEmergency: false),
            WatchPhrase(id: "ac-give", label: "Give", arasaacId: 28431, sfSymbol: "figure.walk", isEmergency: false),
            WatchPhrase(id: "ac-take", label: "Take", arasaacId: 10148, sfSymbol: "figure.walk", isEmergency: false),
            WatchPhrase(id: "ac-look", label: "Look", arasaacId: 6564, sfSymbol: "figure.walk", isEmergency: false),
            WatchPhrase(id: "ac-sit", label: "Sit", arasaacId: 6611, sfSymbol: "figure.walk", isEmergency: false),
            WatchPhrase(id: "ac-stand", label: "Stand up", arasaacId: 13370, sfSymbol: "figure.walk", isEmergency: false),
            WatchPhrase(id: "ac-walk", label: "Walk", arasaacId: 29951, sfSymbol: "figure.walk", isEmergency: false),
            WatchPhrase(id: "ac-run", label: "Run", arasaacId: 6465, sfSymbol: "figure.walk", isEmergency: false),
            WatchPhrase(id: "ac-write", label: "Write", arasaacId: 2380, sfSymbol: "figure.walk", isEmergency: false),
            WatchPhrase(id: "ac-draw", label: "Draw", arasaacId: 8088, sfSymbol: "figure.walk", isEmergency: false),
            WatchPhrase(id: "ac-make", label: "Make", arasaacId: 32751, sfSymbol: "figure.walk", isEmergency: false),
            WatchPhrase(id: "ac-put", label: "Put", arasaacId: 32757, sfSymbol: "figure.walk", isEmergency: false),
            WatchPhrase(id: "ac-get", label: "Get", arasaacId: 24208, sfSymbol: "figure.walk", isEmergency: false),
            WatchPhrase(id: "ac-turn", label: "Turn", arasaacId: 6630, sfSymbol: "figure.walk", isEmergency: false),
            WatchPhrase(id: "ac-wash", label: "Wash", arasaacId: 34826, sfSymbol: "figure.walk", isEmergency: false),
            WatchPhrase(id: "ac-wave", label: "Wave", arasaacId: 4706, sfSymbol: "figure.walk", isEmergency: false),
            WatchPhrase(id: "ac-clap", label: "Clap", arasaacId: 4563, sfSymbol: "figure.walk", isEmergency: false),
            WatchPhrase(id: "ac-point", label: "Point", arasaacId: 6612, sfSymbol: "figure.walk", isEmergency: false),
            WatchPhrase(id: "ac-nod", label: "Nod", arasaacId: 34983, sfSymbol: "figure.walk", isEmergency: false),
            WatchPhrase(id: "ac-shake-head", label: "Shake head", arasaacId: 37868, sfSymbol: "figure.walk", isEmergency: false),
            WatchPhrase(id: "ac-whisper", label: "Whisper", arasaacId: 9037, sfSymbol: "figure.walk", isEmergency: false),
            WatchPhrase(id: "ac-shout", label: "Shout", arasaacId: 6552, sfSymbol: "figure.walk", isEmergency: false),
            WatchPhrase(id: "ac-sing", label: "Sing", arasaacId: 6960, sfSymbol: "figure.walk", isEmergency: false),
            WatchPhrase(id: "ac-hum", label: "Hum", arasaacId: 3195, sfSymbol: "figure.walk", isEmergency: false),
            WatchPhrase(id: "ac-roll", label: "Roll", arasaacId: 6603, sfSymbol: "figure.walk", isEmergency: false),
            WatchPhrase(id: "ac-slide", label: "Slide", arasaacId: 4759, sfSymbol: "figure.walk", isEmergency: false),
            WatchPhrase(id: "ac-spin", label: "Spin", arasaacId: 39713, sfSymbol: "figure.walk", isEmergency: false),
            WatchPhrase(id: "ac-hop", label: "Hop", arasaacId: 39052, sfSymbol: "figure.walk", isEmergency: false),
            WatchPhrase(id: "ac-skip", label: "Skip", arasaacId: 5570, sfSymbol: "figure.walk", isEmergency: false),
            WatchPhrase(id: "ac-crawl", label: "Crawl", arasaacId: 6511, sfSymbol: "figure.walk", isEmergency: false),
            WatchPhrase(id: "ac-tiptoe", label: "Tiptoe", arasaacId: 37637, sfSymbol: "figure.walk", isEmergency: false),
            WatchPhrase(id: "ac-tip-toe", label: "Tip-toe", arasaacId: 36569, sfSymbol: "figure.walk", isEmergency: false),
            WatchPhrase(id: "ac-march", label: "March", arasaacId: 6558, sfSymbol: "figure.walk", isEmergency: false),
            WatchPhrase(id: "ac-climb-up", label: "Climb up", arasaacId: 8236, sfSymbol: "figure.walk", isEmergency: false),
            WatchPhrase(id: "ac-climb-down", label: "Climb down", arasaacId: 27278, sfSymbol: "figure.walk", isEmergency: false),
            WatchPhrase(id: "ac-push-it", label: "Push it", arasaacId: 31947, sfSymbol: "figure.walk", isEmergency: false),
            WatchPhrase(id: "ac-pull-it", label: "Pull it", arasaacId: 36601, sfSymbol: "figure.walk", isEmergency: false),
            WatchPhrase(id: "ac-pick-it-up", label: "Pick it up", arasaacId: 10147, sfSymbol: "figure.walk", isEmergency: false),
            WatchPhrase(id: "ac-set-it-down", label: "Set it down", arasaacId: 5896, sfSymbol: "figure.walk", isEmergency: false),
            WatchPhrase(id: "ac-pour", label: "Pour", arasaacId: 7298, sfSymbol: "figure.walk", isEmergency: false),
            WatchPhrase(id: "ac-stir", label: "Stir", arasaacId: 5981, sfSymbol: "figure.walk", isEmergency: false),
            WatchPhrase(id: "ac-mix", label: "Mix", arasaacId: 5515, sfSymbol: "figure.walk", isEmergency: false),
            WatchPhrase(id: "ac-spread", label: "Spread", arasaacId: 7292, sfSymbol: "figure.walk", isEmergency: false),
            WatchPhrase(id: "ac-fold", label: "Fold", arasaacId: 5544, sfSymbol: "figure.walk", isEmergency: false),
            WatchPhrase(id: "ac-tie", label: "Tie", arasaacId: 4614, sfSymbol: "figure.walk", isEmergency: false),
            WatchPhrase(id: "ac-untie", label: "Untie", arasaacId: 39213, sfSymbol: "figure.walk", isEmergency: false),
            WatchPhrase(id: "ac-zip", label: "Zip", arasaacId: 16897, sfSymbol: "figure.walk", isEmergency: false),
            WatchPhrase(id: "ac-unzip", label: "Unzip", arasaacId: 37414, sfSymbol: "figure.walk", isEmergency: false),
            WatchPhrase(id: "ac-snap", label: "Snap", arasaacId: 6604, sfSymbol: "figure.walk", isEmergency: false),
            WatchPhrase(id: "ac-buckle", label: "Buckle", arasaacId: nil, sfSymbol: "figure.walk", isEmergency: false),
            WatchPhrase(id: "ac-brush-teeth", label: "Brush teeth", arasaacId: 2326, sfSymbol: "figure.walk", isEmergency: false),
            WatchPhrase(id: "ac-brush-hair", label: "Brush hair", arasaacId: 21529, sfSymbol: "figure.walk", isEmergency: false),
            WatchPhrase(id: "ac-comb", label: "Comb", arasaacId: 26947, sfSymbol: "figure.walk", isEmergency: false),
            WatchPhrase(id: "ac-floss", label: "Floss", arasaacId: 9144, sfSymbol: "figure.walk", isEmergency: false),
            WatchPhrase(id: "ac-get-dressed", label: "Get dressed", arasaacId: 6627, sfSymbol: "figure.walk", isEmergency: false),
            WatchPhrase(id: "ac-get-undressed", label: "Get undressed", arasaacId: 11233, sfSymbol: "figure.walk", isEmergency: false),
            WatchPhrase(id: "ac-put-on-shoes", label: "Put on shoes", arasaacId: 14534, sfSymbol: "figure.walk", isEmergency: false),
            WatchPhrase(id: "ac-take-off-shoes", label: "Take off shoes", arasaacId: 14536, sfSymbol: "figure.walk", isEmergency: false),
            WatchPhrase(id: "ac-wash-hands", label: "Wash hands", arasaacId: 9006, sfSymbol: "figure.walk", isEmergency: false),
            WatchPhrase(id: "ac-take-a-bath", label: "Take a bath", arasaacId: 6058, sfSymbol: "figure.walk", isEmergency: false),
            WatchPhrase(id: "ac-take-a-shower", label: "Take a shower", arasaacId: 3335, sfSymbol: "figure.walk", isEmergency: false),
            WatchPhrase(id: "ac-sleep", label: "Sleep", arasaacId: 6479, sfSymbol: "figure.walk", isEmergency: false),
            WatchPhrase(id: "ac-take-a-nap", label: "Take a nap", arasaacId: 28426, sfSymbol: "figure.walk", isEmergency: false),
            WatchPhrase(id: "ac-wake-up", label: "Wake up", arasaacId: 8989, sfSymbol: "figure.walk", isEmergency: false),
            WatchPhrase(id: "ac-wait-for", label: "Wait for", arasaacId: 35187, sfSymbol: "figure.walk", isEmergency: false),
            WatchPhrase(id: "ac-look-for", label: "Look for", arasaacId: 6947, sfSymbol: "figure.walk", isEmergency: false),
            WatchPhrase(id: "ac-search", label: "Search", arasaacId: 6947, sfSymbol: "figure.walk", isEmergency: false),
            WatchPhrase(id: "ac-discover", label: "Discover", arasaacId: 6019, sfSymbol: "figure.walk", isEmergency: false),
            WatchPhrase(id: "ac-hide", label: "Hide", arasaacId: 6493, sfSymbol: "figure.walk", isEmergency: false),
            WatchPhrase(id: "ac-seek", label: "Seek", arasaacId: 38136, sfSymbol: "figure.walk", isEmergency: false),
            WatchPhrase(id: "ac-tag", label: "Tag", arasaacId: 9920, sfSymbol: "figure.walk", isEmergency: false),
            WatchPhrase(id: "ac-race", label: "Race", arasaacId: 11205, sfSymbol: "figure.walk", isEmergency: false),
            WatchPhrase(id: "ac-cuddle", label: "Cuddle", arasaacId: 6023, sfSymbol: "figure.walk", isEmergency: false),
            WatchPhrase(id: "ac-snuggle", label: "Snuggle", arasaacId: nil, sfSymbol: "figure.walk", isEmergency: false),
            WatchPhrase(id: "ac-pat", label: "Pat", arasaacId: 39656, sfSymbol: "figure.walk", isEmergency: false),
            WatchPhrase(id: "ac-tickle", label: "Tickle", arasaacId: 5480, sfSymbol: "figure.walk", isEmergency: false),
            WatchPhrase(id: "ac-sweep", label: "Sweep", arasaacId: 2658, sfSymbol: "figure.walk", isEmergency: false),
            WatchPhrase(id: "ac-mop", label: "Mop", arasaacId: 2908, sfSymbol: "figure.walk", isEmergency: false),
            WatchPhrase(id: "ac-vacuum", label: "Vacuum", arasaacId: 3227, sfSymbol: "figure.walk", isEmergency: false),
            WatchPhrase(id: "ac-dust", label: "Dust", arasaacId: 4878, sfSymbol: "figure.walk", isEmergency: false),
            WatchPhrase(id: "ac-carry-it", label: "Carry it", arasaacId: 33930, sfSymbol: "figure.walk", isEmergency: false),
            WatchPhrase(id: "ac-drop-it", label: "Drop it", arasaacId: 6215, sfSymbol: "figure.walk", isEmergency: false),
            WatchPhrase(id: "ac-toss-it", label: "Toss it", arasaacId: 35231, sfSymbol: "figure.walk", isEmergency: false),
            WatchPhrase(id: "ac-roll-it", label: "Roll it", arasaacId: 11328, sfSymbol: "figure.walk", isEmergency: false),
        ]),
        WatchCategory(id: "describing", icon: "paintpalette.fill", name: "Describing Words", phrases: [
            WatchPhrase(id: "dw-big", label: "Big", arasaacId: 4658, sfSymbol: "paintpalette", isEmergency: false),
            WatchPhrase(id: "dw-small", label: "Small", arasaacId: 4716, sfSymbol: "paintpalette", isEmergency: false),
            WatchPhrase(id: "dw-hot", label: "Hot", arasaacId: 2300, sfSymbol: "paintpalette", isEmergency: false),
            WatchPhrase(id: "dw-cold", label: "Cold", arasaacId: 4652, sfSymbol: "paintpalette", isEmergency: false),
            WatchPhrase(id: "dw-good", label: "Good", arasaacId: 4581, sfSymbol: "paintpalette", isEmergency: false),
            WatchPhrase(id: "dw-bad", label: "Bad", arasaacId: 5504, sfSymbol: "paintpalette", isEmergency: false),
            WatchPhrase(id: "dw-fast", label: "Fast", arasaacId: 5306, sfSymbol: "paintpalette", isEmergency: false),
            WatchPhrase(id: "dw-slow", label: "Slow", arasaacId: 4676, sfSymbol: "paintpalette", isEmergency: false),
            WatchPhrase(id: "dw-new", label: "New", arasaacId: 11316, sfSymbol: "paintpalette", isEmergency: false),
            WatchPhrase(id: "dw-old", label: "Old", arasaacId: 11394, sfSymbol: "paintpalette", isEmergency: false),
            WatchPhrase(id: "dw-same", label: "Same", arasaacId: 4667, sfSymbol: "paintpalette", isEmergency: false),
            WatchPhrase(id: "dw-different", label: "Different", arasaacId: 4628, sfSymbol: "paintpalette", isEmergency: false),
            WatchPhrase(id: "dw-funny", label: "Funny", arasaacId: 24733, sfSymbol: "paintpalette", isEmergency: false),
            WatchPhrase(id: "dw-pretty", label: "Pretty", arasaacId: 11194, sfSymbol: "paintpalette", isEmergency: false),
            WatchPhrase(id: "dw-yucky", label: "Yucky", arasaacId: nil, sfSymbol: "paintpalette", isEmergency: false),
            WatchPhrase(id: "dw-favorite", label: "Favorite", arasaacId: 30012, sfSymbol: "paintpalette", isEmergency: false),
            WatchPhrase(id: "dw-tall", label: "Tall", arasaacId: 25782, sfSymbol: "paintpalette", isEmergency: false),
            WatchPhrase(id: "dw-short", label: "Short", arasaacId: 26002, sfSymbol: "paintpalette", isEmergency: false),
            WatchPhrase(id: "dw-long", label: "Long", arasaacId: 26162, sfSymbol: "paintpalette", isEmergency: false),
            WatchPhrase(id: "dw-wide", label: "Wide", arasaacId: 4559, sfSymbol: "paintpalette", isEmergency: false),
            WatchPhrase(id: "dw-narrow", label: "Narrow", arasaacId: 4643, sfSymbol: "paintpalette", isEmergency: false),
            WatchPhrase(id: "dw-thick", label: "Thick", arasaacId: 34017, sfSymbol: "paintpalette", isEmergency: false),
            WatchPhrase(id: "dw-thin", label: "Thin", arasaacId: 25048, sfSymbol: "paintpalette", isEmergency: false),
            WatchPhrase(id: "dw-round", label: "Round", arasaacId: 38116, sfSymbol: "paintpalette", isEmergency: false),
            WatchPhrase(id: "dw-square", label: "Square", arasaacId: 4616, sfSymbol: "paintpalette", isEmergency: false),
            WatchPhrase(id: "dw-smooth", label: "Smooth", arasaacId: 4685, sfSymbol: "paintpalette", isEmergency: false),
            WatchPhrase(id: "dw-rough", label: "Rough", arasaacId: 4568, sfSymbol: "paintpalette", isEmergency: false),
            WatchPhrase(id: "dw-sticky", label: "Sticky", arasaacId: 25307, sfSymbol: "paintpalette", isEmergency: false),
            WatchPhrase(id: "dw-wet", label: "Wet", arasaacId: 37364, sfSymbol: "paintpalette", isEmergency: false),
            WatchPhrase(id: "dw-dry", label: "Dry", arasaacId: 34715, sfSymbol: "paintpalette", isEmergency: false),
            WatchPhrase(id: "dw-clean", label: "Clean", arasaacId: 26172, sfSymbol: "paintpalette", isEmergency: false),
            WatchPhrase(id: "dw-dirty", label: "Dirty", arasaacId: 4750, sfSymbol: "paintpalette", isEmergency: false),
            WatchPhrase(id: "dw-soft", label: "Soft", arasaacId: 4578, sfSymbol: "paintpalette", isEmergency: false),
            WatchPhrase(id: "dw-hard", label: "Hard", arasaacId: 4637, sfSymbol: "paintpalette", isEmergency: false),
            WatchPhrase(id: "dw-sweet", label: "Sweet", arasaacId: 32440, sfSymbol: "paintpalette", isEmergency: false),
            WatchPhrase(id: "dw-salty", label: "Salty", arasaacId: 32524, sfSymbol: "paintpalette", isEmergency: false),
            WatchPhrase(id: "dw-sour", label: "Sour", arasaacId: 32352, sfSymbol: "paintpalette", isEmergency: false),
            WatchPhrase(id: "dw-spicy", label: "Spicy", arasaacId: 4719, sfSymbol: "paintpalette", isEmergency: false),
            WatchPhrase(id: "dw-bitter", label: "Bitter", arasaacId: 30928, sfSymbol: "paintpalette", isEmergency: false),
            WatchPhrase(id: "dw-quiet", label: "Quiet", arasaacId: 38050, sfSymbol: "paintpalette", isEmergency: false),
            WatchPhrase(id: "dw-loud", label: "Loud", arasaacId: 2647, sfSymbol: "paintpalette", isEmergency: false),
            WatchPhrase(id: "dw-bright", label: "Bright", arasaacId: nil, sfSymbol: "paintpalette", isEmergency: false),
            WatchPhrase(id: "dw-dark", label: "Dark", arasaacId: 26993, sfSymbol: "paintpalette", isEmergency: false),
            WatchPhrase(id: "dw-shiny", label: "Shiny", arasaacId: nil, sfSymbol: "paintpalette", isEmergency: false),
            WatchPhrase(id: "dw-heavy", label: "Heavy", arasaacId: 27025, sfSymbol: "paintpalette", isEmergency: false),
            WatchPhrase(id: "dw-light", label: "Light", arasaacId: 8619, sfSymbol: "paintpalette", isEmergency: false),
            WatchPhrase(id: "dw-empty", label: "Empty", arasaacId: 26527, sfSymbol: "paintpalette", isEmergency: false),
            WatchPhrase(id: "dw-full", label: "Full", arasaacId: 26176, sfSymbol: "paintpalette", isEmergency: false),
            WatchPhrase(id: "dw-easy", label: "Easy", arasaacId: 4645, sfSymbol: "paintpalette", isEmergency: false),
            WatchPhrase(id: "dw-tricky", label: "Tricky", arasaacId: nil, sfSymbol: "paintpalette", isEmergency: false),
            WatchPhrase(id: "dw-simple", label: "Simple", arasaacId: 4645, sfSymbol: "paintpalette", isEmergency: false),
            WatchPhrase(id: "dw-fun", label: "Fun", arasaacId: 24733, sfSymbol: "paintpalette", isEmergency: false),
            WatchPhrase(id: "dw-boring", label: "Boring", arasaacId: 2245, sfSymbol: "paintpalette", isEmergency: false),
            WatchPhrase(id: "dw-cool", label: "Cool", arasaacId: 27735, sfSymbol: "paintpalette", isEmergency: false),
            WatchPhrase(id: "dw-awesome", label: "Awesome", arasaacId: nil, sfSymbol: "paintpalette", isEmergency: false),
            WatchPhrase(id: "dw-scary", label: "Scary", arasaacId: nil, sfSymbol: "paintpalette", isEmergency: false),
            WatchPhrase(id: "dw-safe", label: "Safe", arasaacId: 6068, sfSymbol: "paintpalette", isEmergency: false),
            WatchPhrase(id: "dw-dangerous", label: "Dangerous", arasaacId: nil, sfSymbol: "paintpalette", isEmergency: false),
            WatchPhrase(id: "dw-friendly", label: "Friendly", arasaacId: 39269, sfSymbol: "paintpalette", isEmergency: false),
            WatchPhrase(id: "dw-mean", label: "Mean", arasaacId: 10351, sfSymbol: "paintpalette", isEmergency: false),
            WatchPhrase(id: "dw-nice", label: "Nice", arasaacId: 7251, sfSymbol: "paintpalette", isEmergency: false),
            WatchPhrase(id: "dw-helpful", label: "Helpful", arasaacId: nil, sfSymbol: "paintpalette", isEmergency: false),
            WatchPhrase(id: "dw-mine", label: "Mine", arasaacId: 12264, sfSymbol: "paintpalette", isEmergency: false),
            WatchPhrase(id: "dw-special", label: "Special", arasaacId: 3267, sfSymbol: "paintpalette", isEmergency: false),
        ]),
        WatchCategory(id: "people-social", icon: "person.3.fill", name: "People", phrases: [
            WatchPhrase(id: "pp-mom", label: "Mom", arasaacId: 2458, sfSymbol: "person.fill", isEmergency: false),
            WatchPhrase(id: "pp-dad", label: "Dad", arasaacId: 31146, sfSymbol: "person.fill", isEmergency: false),
            WatchPhrase(id: "pp-teacher", label: "Teacher", arasaacId: 6556, sfSymbol: "person.fill", isEmergency: false),
            WatchPhrase(id: "pp-friend", label: "Friend", arasaacId: 25790, sfSymbol: "person.fill", isEmergency: false),
            WatchPhrase(id: "pp-family", label: "Family", arasaacId: 38351, sfSymbol: "person.fill", isEmergency: false),
            WatchPhrase(id: "pp-doctor", label: "Doctor", arasaacId: 6561, sfSymbol: "person.fill", isEmergency: false),
            WatchPhrase(id: "pp-brother", label: "Brother", arasaacId: 2423, sfSymbol: "person.fill", isEmergency: false),
            WatchPhrase(id: "pp-sister", label: "Sister", arasaacId: 2422, sfSymbol: "person.fill", isEmergency: false),
            WatchPhrase(id: "pp-grandma", label: "Grandma", arasaacId: 23710, sfSymbol: "person.fill", isEmergency: false),
            WatchPhrase(id: "pp-grandpa", label: "Grandpa", arasaacId: 23718, sfSymbol: "person.fill", isEmergency: false),
            WatchPhrase(id: "pp-baby", label: "Baby", arasaacId: 6060, sfSymbol: "person.fill", isEmergency: false),
            WatchPhrase(id: "pp-boy", label: "Boy", arasaacId: 7176, sfSymbol: "person.fill", isEmergency: false),
            WatchPhrase(id: "pp-girl", label: "Girl", arasaacId: 27509, sfSymbol: "person.fill", isEmergency: false),
            WatchPhrase(id: "pp-therapist", label: "Therapist", arasaacId: 36179, sfSymbol: "person.fill", isEmergency: false),
            WatchPhrase(id: "pp-aunt", label: "Aunt", arasaacId: 30271, sfSymbol: "person.fill", isEmergency: false),
            WatchPhrase(id: "pp-uncle", label: "Uncle", arasaacId: 30255, sfSymbol: "person.fill", isEmergency: false),
            WatchPhrase(id: "pp-cousin", label: "Cousin", arasaacId: 30340, sfSymbol: "person.fill", isEmergency: false),
            WatchPhrase(id: "pp-stepmom", label: "Stepmom", arasaacId: nil, sfSymbol: "person.fill", isEmergency: false),
            WatchPhrase(id: "pp-stepdad", label: "Stepdad", arasaacId: nil, sfSymbol: "person.fill", isEmergency: false),
            WatchPhrase(id: "pp-bus-driver", label: "Bus driver", arasaacId: 38086, sfSymbol: "person.fill", isEmergency: false),
            WatchPhrase(id: "pp-coach", label: "Coach", arasaacId: 2262, sfSymbol: "person.fill", isEmergency: false),
            WatchPhrase(id: "pp-principal", label: "Principal", arasaacId: 4631, sfSymbol: "person.fill", isEmergency: false),
            WatchPhrase(id: "pp-counselor", label: "Counselor", arasaacId: 34707, sfSymbol: "person.fill", isEmergency: false),
            WatchPhrase(id: "pp-nurse", label: "Nurse", arasaacId: 6050, sfSymbol: "person.fill", isEmergency: false),
            WatchPhrase(id: "pp-dentist", label: "Dentist", arasaacId: 2733, sfSymbol: "person.fill", isEmergency: false),
            WatchPhrase(id: "pp-bcba", label: "BCBA", arasaacId: nil, sfSymbol: "person.fill", isEmergency: false),
            WatchPhrase(id: "pp-rbt", label: "RBT", arasaacId: nil, sfSymbol: "person.fill", isEmergency: false),
            WatchPhrase(id: "pp-babysitter", label: "Babysitter", arasaacId: nil, sfSymbol: "person.fill", isEmergency: false),
            WatchPhrase(id: "pp-neighbor", label: "Neighbor", arasaacId: 37228, sfSymbol: "person.fill", isEmergency: false),
            WatchPhrase(id: "pp-helper", label: "Helper", arasaacId: 2476, sfSymbol: "person.fill", isEmergency: false),
            WatchPhrase(id: "pp-classmate", label: "Classmate", arasaacId: 39421, sfSymbol: "person.fill", isEmergency: false),
            WatchPhrase(id: "pp-best-friend", label: "Best friend", arasaacId: 38941, sfSymbol: "person.fill", isEmergency: false),
            WatchPhrase(id: "pp-new-friend", label: "New friend", arasaacId: 38941, sfSymbol: "person.fill", isEmergency: false),
            WatchPhrase(id: "pp-man", label: "Man", arasaacId: 4665, sfSymbol: "person.fill", isEmergency: false),
            WatchPhrase(id: "pp-woman", label: "Woman", arasaacId: 24621, sfSymbol: "person.fill", isEmergency: false),
            WatchPhrase(id: "pp-kid", label: "Kid", arasaacId: 27509, sfSymbol: "person.fill", isEmergency: false),
            WatchPhrase(id: "pp-grown-up", label: "Grown-up", arasaacId: 27278, sfSymbol: "person.fill", isEmergency: false),
            WatchPhrase(id: "pp-stranger", label: "Stranger", arasaacId: nil, sfSymbol: "person.fill", isEmergency: false),
            WatchPhrase(id: "pp-police-officer", label: "Police officer", arasaacId: 37367, sfSymbol: "person.fill", isEmergency: false),
            WatchPhrase(id: "pp-firefighter", label: "Firefighter", arasaacId: 6066, sfSymbol: "person.fill", isEmergency: false),
            WatchPhrase(id: "pp-paramedic", label: "Paramedic", arasaacId: nil, sfSymbol: "person.fill", isEmergency: false),
            WatchPhrase(id: "pp-my-family", label: "My family", arasaacId: 39610, sfSymbol: "person.fill", isEmergency: false),
            WatchPhrase(id: "pp-my-class", label: "My class", arasaacId: 35401, sfSymbol: "person.fill", isEmergency: false),
            WatchPhrase(id: "pp-my-team", label: "My team", arasaacId: 24666, sfSymbol: "person.fill", isEmergency: false),
            WatchPhrase(id: "pc-librarian", label: "Librarian", arasaacId: 27499, sfSymbol: "person.fill", isEmergency: false),
        ]),
        WatchCategory(id: "food-ordering", icon: "fork.knife", name: "Food & Drink", phrases: [
            WatchPhrase(id: "fd-water", label: "Water", arasaacId: 32464, sfSymbol: "fork.knife", isEmergency: false),
            WatchPhrase(id: "fd-juice", label: "Juice", arasaacId: 11461, sfSymbol: "fork.knife", isEmergency: false),
            WatchPhrase(id: "fd-milk", label: "Milk", arasaacId: 2445, sfSymbol: "fork.knife", isEmergency: false),
            WatchPhrase(id: "fd-pizza", label: "Pizza", arasaacId: 2527, sfSymbol: "fork.knife", isEmergency: false),
            WatchPhrase(id: "fd-sandwich", label: "Sandwich", arasaacId: 2281, sfSymbol: "fork.knife", isEmergency: false),
            WatchPhrase(id: "fd-chicken", label: "Chicken", arasaacId: 4952, sfSymbol: "fork.knife", isEmergency: false),
            WatchPhrase(id: "fd-fries", label: "Fries", arasaacId: 5400, sfSymbol: "fork.knife", isEmergency: false),
            WatchPhrase(id: "fd-fruit", label: "Fruit", arasaacId: 28339, sfSymbol: "fork.knife", isEmergency: false),
            WatchPhrase(id: "fd-snack", label: "Snack", arasaacId: 4694, sfSymbol: "fork.knife", isEmergency: false),
            WatchPhrase(id: "fd-more", label: "More please", arasaacId: 39109, sfSymbol: "fork.knife", isEmergency: false),
            WatchPhrase(id: "fd-no-thanks", label: "No thanks", arasaacId: 39109, sfSymbol: "fork.knife", isEmergency: false),
            WatchPhrase(id: "fd-cookie", label: "Cookie", arasaacId: 8312, sfSymbol: "fork.knife", isEmergency: false),
            WatchPhrase(id: "fd-apple", label: "Apple", arasaacId: 2462, sfSymbol: "fork.knife", isEmergency: false),
            WatchPhrase(id: "fd-banana", label: "Banana", arasaacId: 2530, sfSymbol: "fork.knife", isEmergency: false),
            WatchPhrase(id: "fd-cereal", label: "Cereal", arasaacId: 34749, sfSymbol: "fork.knife", isEmergency: false),
            WatchPhrase(id: "fd-cheese", label: "Cheese", arasaacId: 2541, sfSymbol: "fork.knife", isEmergency: false),
            WatchPhrase(id: "fd-ice-cream", label: "Ice cream", arasaacId: 3348, sfSymbol: "fork.knife", isEmergency: false),
            WatchPhrase(id: "fd-crackers", label: "Crackers", arasaacId: 16851, sfSymbol: "fork.knife", isEmergency: false),
            WatchPhrase(id: "fd-bread", label: "Bread", arasaacId: 2494, sfSymbol: "fork.knife", isEmergency: false),
            WatchPhrase(id: "fd-toast", label: "Toast", arasaacId: 17330, sfSymbol: "fork.knife", isEmergency: false),
            WatchPhrase(id: "fd-pancakes", label: "Pancakes", arasaacId: 37849, sfSymbol: "fork.knife", isEmergency: false),
            WatchPhrase(id: "fd-waffles", label: "Waffles", arasaacId: 34227, sfSymbol: "fork.knife", isEmergency: false),
            WatchPhrase(id: "fd-eggs", label: "Eggs", arasaacId: 2427, sfSymbol: "fork.knife", isEmergency: false),
            WatchPhrase(id: "fd-bacon", label: "Bacon", arasaacId: 2994, sfSymbol: "fork.knife", isEmergency: false),
            WatchPhrase(id: "fd-yogurt", label: "Yogurt", arasaacId: 2618, sfSymbol: "fork.knife", isEmergency: false),
            WatchPhrase(id: "fd-oatmeal", label: "Oatmeal", arasaacId: 38524, sfSymbol: "fork.knife", isEmergency: false),
            WatchPhrase(id: "fd-granola", label: "Granola", arasaacId: 35899, sfSymbol: "fork.knife", isEmergency: false),
            WatchPhrase(id: "fd-smoothie", label: "Smoothie", arasaacId: nil, sfSymbol: "fork.knife", isEmergency: false),
            WatchPhrase(id: "fd-pasta", label: "Pasta", arasaacId: 8652, sfSymbol: "fork.knife", isEmergency: false),
            WatchPhrase(id: "fd-noodles", label: "Noodles", arasaacId: 8584, sfSymbol: "fork.knife", isEmergency: false),
            WatchPhrase(id: "fd-rice", label: "Rice", arasaacId: 6911, sfSymbol: "fork.knife", isEmergency: false),
            WatchPhrase(id: "fd-soup", label: "Soup", arasaacId: 2573, sfSymbol: "fork.knife", isEmergency: false),
            WatchPhrase(id: "fd-salad", label: "Salad", arasaacId: 2377, sfSymbol: "fork.knife", isEmergency: false),
            WatchPhrase(id: "fd-wrap", label: "Wrap", arasaacId: 7084, sfSymbol: "fork.knife", isEmergency: false),
            WatchPhrase(id: "fd-hamburger", label: "Hamburger", arasaacId: 2419, sfSymbol: "fork.knife", isEmergency: false),
            WatchPhrase(id: "fd-hot-dog", label: "Hot dog", arasaacId: 6647, sfSymbol: "fork.knife", isEmergency: false),
            WatchPhrase(id: "fd-taco", label: "Taco", arasaacId: 39698, sfSymbol: "fork.knife", isEmergency: false),
            WatchPhrase(id: "fd-burrito", label: "Burrito", arasaacId: 10219, sfSymbol: "fork.knife", isEmergency: false),
            WatchPhrase(id: "fd-quesadilla", label: "Quesadilla", arasaacId: nil, sfSymbol: "fork.knife", isEmergency: false),
            WatchPhrase(id: "fd-sushi", label: "Sushi", arasaacId: 38993, sfSymbol: "fork.knife", isEmergency: false),
            WatchPhrase(id: "fd-dumplings", label: "Dumplings", arasaacId: nil, sfSymbol: "fork.knife", isEmergency: false),
            WatchPhrase(id: "fd-curry", label: "Curry", arasaacId: 35817, sfSymbol: "fork.knife", isEmergency: false),
            WatchPhrase(id: "fd-stir-fry", label: "Stir fry", arasaacId: 5981, sfSymbol: "fork.knife", isEmergency: false),
            WatchPhrase(id: "fd-carrots", label: "Carrots", arasaacId: 2619, sfSymbol: "fork.knife", isEmergency: false),
            WatchPhrase(id: "fd-broccoli", label: "Broccoli", arasaacId: 23853, sfSymbol: "fork.knife", isEmergency: false),
            WatchPhrase(id: "fd-peas", label: "Peas", arasaacId: 7182, sfSymbol: "fork.knife", isEmergency: false),
            WatchPhrase(id: "fd-corn", label: "Corn", arasaacId: 4879, sfSymbol: "fork.knife", isEmergency: false),
            WatchPhrase(id: "fd-tomato", label: "Tomato", arasaacId: 2594, sfSymbol: "fork.knife", isEmergency: false),
            WatchPhrase(id: "fd-cucumber", label: "Cucumber", arasaacId: 2847, sfSymbol: "fork.knife", isEmergency: false),
            WatchPhrase(id: "fd-lettuce", label: "Lettuce", arasaacId: 2446, sfSymbol: "fork.knife", isEmergency: false),
            WatchPhrase(id: "fd-spinach", label: "Spinach", arasaacId: 8311, sfSymbol: "fork.knife", isEmergency: false),
            WatchPhrase(id: "fd-potato", label: "Potato", arasaacId: 2503, sfSymbol: "fork.knife", isEmergency: false),
            WatchPhrase(id: "fd-sweet-potato", label: "Sweet potato", arasaacId: 36354, sfSymbol: "fork.knife", isEmergency: false),
            WatchPhrase(id: "fd-strawberry", label: "Strawberry", arasaacId: 2400, sfSymbol: "fork.knife", isEmergency: false),
            WatchPhrase(id: "fd-blueberry", label: "Blueberry", arasaacId: 36488, sfSymbol: "fork.knife", isEmergency: false),
            WatchPhrase(id: "fd-grapes", label: "Grapes", arasaacId: 3247, sfSymbol: "fork.knife", isEmergency: false),
            WatchPhrase(id: "fd-watermelon", label: "Watermelon", arasaacId: 2557, sfSymbol: "fork.knife", isEmergency: false),
            WatchPhrase(id: "fd-orange", label: "Orange", arasaacId: 2888, sfSymbol: "fork.knife", isEmergency: false),
            WatchPhrase(id: "fd-pear", label: "Pear", arasaacId: 2561, sfSymbol: "fork.knife", isEmergency: false),
            WatchPhrase(id: "fd-peach", label: "Peach", arasaacId: 2468, sfSymbol: "fork.knife", isEmergency: false),
            WatchPhrase(id: "fd-mango", label: "Mango", arasaacId: 16813, sfSymbol: "fork.knife", isEmergency: false),
            WatchPhrase(id: "fd-pineapple", label: "Pineapple", arasaacId: 2525, sfSymbol: "fork.knife", isEmergency: false),
            WatchPhrase(id: "fd-cake", label: "Cake", arasaacId: 2502, sfSymbol: "fork.knife", isEmergency: false),
            WatchPhrase(id: "fd-cupcake", label: "Cupcake", arasaacId: 25211, sfSymbol: "fork.knife", isEmergency: false),
            WatchPhrase(id: "fd-brownie", label: "Brownie", arasaacId: 38503, sfSymbol: "fork.knife", isEmergency: false),
            WatchPhrase(id: "fd-donut", label: "Donut", arasaacId: 2368, sfSymbol: "fork.knife", isEmergency: false),
            WatchPhrase(id: "fd-muffin", label: "Muffin", arasaacId: 25211, sfSymbol: "fork.knife", isEmergency: false),
            WatchPhrase(id: "fd-pie", label: "Pie", arasaacId: 9057, sfSymbol: "fork.knife", isEmergency: false),
            WatchPhrase(id: "fd-pudding", label: "Pudding", arasaacId: 9055, sfSymbol: "fork.knife", isEmergency: false),
            WatchPhrase(id: "fd-jello", label: "Jello", arasaacId: nil, sfSymbol: "fork.knife", isEmergency: false),
            WatchPhrase(id: "fd-candy", label: "Candy", arasaacId: 2686, sfSymbol: "fork.knife", isEmergency: false),
            WatchPhrase(id: "fd-chocolate", label: "Chocolate", arasaacId: 25940, sfSymbol: "fork.knife", isEmergency: false),
            WatchPhrase(id: "fd-lollipop", label: "Lollipop", arasaacId: 2832, sfSymbol: "fork.knife", isEmergency: false),
            WatchPhrase(id: "fd-gum", label: "Gum", arasaacId: 2709, sfSymbol: "fork.knife", isEmergency: false),
            WatchPhrase(id: "fd-soda", label: "Soda", arasaacId: 4732, sfSymbol: "fork.knife", isEmergency: false),
            WatchPhrase(id: "fd-tea", label: "Tea", arasaacId: 29802, sfSymbol: "fork.knife", isEmergency: false),
            WatchPhrase(id: "fd-hot-chocolate", label: "Hot chocolate", arasaacId: 6448, sfSymbol: "fork.knife", isEmergency: false),
            WatchPhrase(id: "fd-lemonade", label: "Lemonade", arasaacId: 6551, sfSymbol: "fork.knife", isEmergency: false),
            WatchPhrase(id: "fd-spoon", label: "Spoon", arasaacId: 2362, sfSymbol: "fork.knife", isEmergency: false),
            WatchPhrase(id: "fd-fork", label: "Fork", arasaacId: 2588, sfSymbol: "fork.knife", isEmergency: false),
            WatchPhrase(id: "fd-knife", label: "Knife", arasaacId: 4931, sfSymbol: "fork.knife", isEmergency: false),
            WatchPhrase(id: "fd-plate", label: "Plate", arasaacId: 16857, sfSymbol: "fork.knife", isEmergency: false),
            WatchPhrase(id: "fd-bowl", label: "Bowl", arasaacId: 3257, sfSymbol: "fork.knife", isEmergency: false),
            WatchPhrase(id: "fd-cup", label: "Cup", arasaacId: 2582, sfSymbol: "fork.knife", isEmergency: false),
            WatchPhrase(id: "fd-straw", label: "Straw", arasaacId: 6163, sfSymbol: "fork.knife", isEmergency: false),
            WatchPhrase(id: "fd-napkin", label: "Napkin", arasaacId: 36303, sfSymbol: "fork.knife", isEmergency: false),
            WatchPhrase(id: "fd-bib", label: "Bib", arasaacId: 37411, sfSymbol: "fork.knife", isEmergency: false),
            WatchPhrase(id: "fd-open-it-please", label: "Open it please", arasaacId: 39109, sfSymbol: "fork.knife", isEmergency: false),
            WatchPhrase(id: "fd-cut-it-up-please", label: "Cut it up please", arasaacId: 38748, sfSymbol: "fork.knife", isEmergency: false),
            WatchPhrase(id: "fd-not-too-hot", label: "Not too hot", arasaacId: 2407, sfSymbol: "fork.knife", isEmergency: false),
            WatchPhrase(id: "fd-i-am-allergic", label: "I am allergic", arasaacId: nil, sfSymbol: "fork.knife", isEmergency: false),
            WatchPhrase(id: "fm-breakfast", label: "Breakfast", arasaacId: 4626, sfSymbol: "fork.knife", isEmergency: false),
            WatchPhrase(id: "fm-hamburger", label: "Hamburger", arasaacId: 2419, sfSymbol: "fork.knife", isEmergency: false),
            WatchPhrase(id: "ff-strawberry", label: "Strawberry", arasaacId: 2400, sfSymbol: "fork.knife", isEmergency: false),
            WatchPhrase(id: "ff-watermelon", label: "Watermelon", arasaacId: 2557, sfSymbol: "fork.knife", isEmergency: false),
            WatchPhrase(id: "fv-broccoli", label: "Broccoli", arasaacId: 23853, sfSymbol: "fork.knife", isEmergency: false),
            WatchPhrase(id: "fv-cucumber", label: "Cucumber", arasaacId: 2847, sfSymbol: "fork.knife", isEmergency: false),
            WatchPhrase(id: "fd-lemonade-2", label: "Lemonade", arasaacId: 6551, sfSymbol: "fork.knife", isEmergency: false),
            WatchPhrase(id: "fd-smoothie-2", label: "Smoothie", arasaacId: nil, sfSymbol: "fork.knife", isEmergency: false),
            WatchPhrase(id: "fs-crackers", label: "Crackers", arasaacId: 16851, sfSymbol: "fork.knife", isEmergency: false),
            WatchPhrase(id: "fs-pretzels", label: "Pretzels", arasaacId: 39058, sfSymbol: "fork.knife", isEmergency: false),
        ]),
        WatchCategory(id: "places-plans", icon: "mappin.and.ellipse", name: "Places", phrases: [
            WatchPhrase(id: "pl-home", label: "Home", arasaacId: 6964, sfSymbol: "mappin.circle", isEmergency: false),
            WatchPhrase(id: "pl-school", label: "School", arasaacId: 32446, sfSymbol: "mappin.circle", isEmergency: false),
            WatchPhrase(id: "pl-park", label: "Park", arasaacId: 5379, sfSymbol: "mappin.circle", isEmergency: false),
            WatchPhrase(id: "pl-store", label: "Store", arasaacId: 35695, sfSymbol: "mappin.circle", isEmergency: false),
            WatchPhrase(id: "pl-restaurant", label: "Restaurant", arasaacId: 32408, sfSymbol: "mappin.circle", isEmergency: false),
            WatchPhrase(id: "pl-library", label: "Library", arasaacId: 6063, sfSymbol: "mappin.circle", isEmergency: false),
            WatchPhrase(id: "pl-pool", label: "Pool", arasaacId: 5398, sfSymbol: "mappin.circle", isEmergency: false),
            WatchPhrase(id: "pl-car", label: "Car", arasaacId: 2339, sfSymbol: "mappin.circle", isEmergency: false),
            WatchPhrase(id: "pl-outside", label: "Outside", arasaacId: 5475, sfSymbol: "mappin.circle", isEmergency: false),
            WatchPhrase(id: "pl-inside", label: "Inside", arasaacId: 5439, sfSymbol: "mappin.circle", isEmergency: false),
            WatchPhrase(id: "pl-bathroom", label: "Bathroom", arasaacId: 5921, sfSymbol: "mappin.circle", isEmergency: false),
            WatchPhrase(id: "pl-bedroom", label: "Bedroom", arasaacId: 5988, sfSymbol: "mappin.circle", isEmergency: false),
            WatchPhrase(id: "pl-kitchen", label: "Kitchen", arasaacId: 10752, sfSymbol: "mappin.circle", isEmergency: false),
            WatchPhrase(id: "pl-playground", label: "Playground", arasaacId: 33064, sfSymbol: "mappin.circle", isEmergency: false),
            WatchPhrase(id: "pl-backyard", label: "Backyard", arasaacId: 36611, sfSymbol: "mappin.circle", isEmergency: false),
            WatchPhrase(id: "pl-front-yard", label: "Front yard", arasaacId: 23979, sfSymbol: "mappin.circle", isEmergency: false),
            WatchPhrase(id: "pl-garden", label: "Garden", arasaacId: 2974, sfSymbol: "mappin.circle", isEmergency: false),
            WatchPhrase(id: "pl-driveway", label: "Driveway", arasaacId: nil, sfSymbol: "mappin.circle", isEmergency: false),
            WatchPhrase(id: "pl-living-room", label: "Living room", arasaacId: 6211, sfSymbol: "mappin.circle", isEmergency: false),
            WatchPhrase(id: "pl-dining-room", label: "Dining room", arasaacId: 5970, sfSymbol: "mappin.circle", isEmergency: false),
            WatchPhrase(id: "pl-garage", label: "Garage", arasaacId: 6003, sfSymbol: "mappin.circle", isEmergency: false),
            WatchPhrase(id: "pl-basement", label: "Basement", arasaacId: 8223, sfSymbol: "mappin.circle", isEmergency: false),
            WatchPhrase(id: "pl-attic", label: "Attic", arasaacId: 8047, sfSymbol: "mappin.circle", isEmergency: false),
            WatchPhrase(id: "pl-hospital", label: "Hospital", arasaacId: 36210, sfSymbol: "mappin.circle", isEmergency: false),
            WatchPhrase(id: "pl-doctor-office", label: "Doctor office", arasaacId: 9918, sfSymbol: "mappin.circle", isEmergency: false),
            WatchPhrase(id: "pl-dentist-office", label: "Dentist office", arasaacId: 9918, sfSymbol: "mappin.circle", isEmergency: false),
            WatchPhrase(id: "pl-pharmacy", label: "Pharmacy", arasaacId: 37368, sfSymbol: "mappin.circle", isEmergency: false),
            WatchPhrase(id: "pl-grocery-store", label: "Grocery store", arasaacId: 35999, sfSymbol: "mappin.circle", isEmergency: false),
            WatchPhrase(id: "pl-mall", label: "Mall", arasaacId: 15551, sfSymbol: "mappin.circle", isEmergency: false),
            WatchPhrase(id: "pl-pet-store", label: "Pet store", arasaacId: 35999, sfSymbol: "mappin.circle", isEmergency: false),
            WatchPhrase(id: "pl-toy-store", label: "Toy store", arasaacId: 11385, sfSymbol: "mappin.circle", isEmergency: false),
            WatchPhrase(id: "pl-movie-theater", label: "Movie theater", arasaacId: 30387, sfSymbol: "mappin.circle", isEmergency: false),
            WatchPhrase(id: "pl-bowling-alley", label: "Bowling alley", arasaacId: 4579, sfSymbol: "mappin.circle", isEmergency: false),
            WatchPhrase(id: "pl-arcade", label: "Arcade", arasaacId: 39518, sfSymbol: "mappin.circle", isEmergency: false),
            WatchPhrase(id: "pl-beach", label: "Beach", arasaacId: 30518, sfSymbol: "mappin.circle", isEmergency: false),
            WatchPhrase(id: "pl-lake", label: "Lake", arasaacId: 6022, sfSymbol: "mappin.circle", isEmergency: false),
            WatchPhrase(id: "pl-mountain", label: "Mountain", arasaacId: 2909, sfSymbol: "mappin.circle", isEmergency: false),
            WatchPhrase(id: "pl-forest", label: "Forest", arasaacId: 2666, sfSymbol: "mappin.circle", isEmergency: false),
            WatchPhrase(id: "pl-camp", label: "Camp", arasaacId: 25974, sfSymbol: "mappin.circle", isEmergency: false),
            WatchPhrase(id: "pl-zoo", label: "Zoo", arasaacId: 4773, sfSymbol: "mappin.circle", isEmergency: false),
            WatchPhrase(id: "pl-aquarium", label: "Aquarium", arasaacId: 5360, sfSymbol: "mappin.circle", isEmergency: false),
            WatchPhrase(id: "pl-museum", label: "Museum", arasaacId: 32406, sfSymbol: "mappin.circle", isEmergency: false),
            WatchPhrase(id: "pl-farm", label: "Farm", arasaacId: 32482, sfSymbol: "mappin.circle", isEmergency: false),
            WatchPhrase(id: "pl-church", label: "Church", arasaacId: 3118, sfSymbol: "mappin.circle", isEmergency: false),
            WatchPhrase(id: "pl-temple", label: "Temple", arasaacId: 3118, sfSymbol: "mappin.circle", isEmergency: false),
            WatchPhrase(id: "pl-mosque", label: "Mosque", arasaacId: 24177, sfSymbol: "mappin.circle", isEmergency: false),
            WatchPhrase(id: "pl-synagogue", label: "Synagogue", arasaacId: 24408, sfSymbol: "mappin.circle", isEmergency: false),
            WatchPhrase(id: "pl-bus-stop", label: "Bus stop", arasaacId: 2499, sfSymbol: "mappin.circle", isEmergency: false),
            WatchPhrase(id: "pl-train-station", label: "Train station", arasaacId: 29905, sfSymbol: "mappin.circle", isEmergency: false),
            WatchPhrase(id: "pl-airport", label: "Airport", arasaacId: 6031, sfSymbol: "mappin.circle", isEmergency: false),
            WatchPhrase(id: "pls-classroom", label: "Classroom", arasaacId: 9815, sfSymbol: "mappin.circle", isEmergency: false),
            WatchPhrase(id: "pls-lunchroom", label: "Lunchroom", arasaacId: nil, sfSymbol: "mappin.circle", isEmergency: false),
            WatchPhrase(id: "plh-bathroom", label: "Bathroom", arasaacId: 5921, sfSymbol: "mappin.circle", isEmergency: false),
            WatchPhrase(id: "plh-backyard", label: "Backyard", arasaacId: 36611, sfSymbol: "mappin.circle", isEmergency: false),
            WatchPhrase(id: "plh-basement", label: "Basement", arasaacId: 8223, sfSymbol: "mappin.circle", isEmergency: false),
            WatchPhrase(id: "plo-playground", label: "Playground", arasaacId: 33064, sfSymbol: "mappin.circle", isEmergency: false),
            WatchPhrase(id: "plst-pharmacy", label: "Pharmacy", arasaacId: 37368, sfSymbol: "mappin.circle", isEmergency: false),
        ]),
        WatchCategory(id: "school-work", icon: "book.fill", name: "School / Work", phrases: [
            WatchPhrase(id: "sw-class", label: "Class", arasaacId: 35401, sfSymbol: "book", isEmergency: false),
            WatchPhrase(id: "sw-homework", label: "Homework", arasaacId: 11228, sfSymbol: "book", isEmergency: false),
            WatchPhrase(id: "sw-computer", label: "Computer", arasaacId: 7190, sfSymbol: "book", isEmergency: false),
            WatchPhrase(id: "sw-book", label: "Book", arasaacId: 25191, sfSymbol: "book", isEmergency: false),
            WatchPhrase(id: "sw-pencil", label: "Pencil", arasaacId: 2440, sfSymbol: "book", isEmergency: false),
            WatchPhrase(id: "sw-question", label: "I have a question", arasaacId: 3418, sfSymbol: "book", isEmergency: false),
            WatchPhrase(id: "sw-help", label: "I need help with this", arasaacId: 39109, sfSymbol: "book", isEmergency: false),
            WatchPhrase(id: "sw-paper", label: "Paper", arasaacId: 8349, sfSymbol: "book", isEmergency: false),
            WatchPhrase(id: "sw-table", label: "Table", arasaacId: 3129, sfSymbol: "book", isEmergency: false),
            WatchPhrase(id: "sw-chair", label: "Chair", arasaacId: 3155, sfSymbol: "book", isEmergency: false),
            WatchPhrase(id: "sw-art", label: "Art", arasaacId: 2396, sfSymbol: "book", isEmergency: false),
            WatchPhrase(id: "sw-music", label: "Music", arasaacId: 24791, sfSymbol: "book", isEmergency: false),
            WatchPhrase(id: "sw-recess", label: "Recess", arasaacId: 27339, sfSymbol: "book", isEmergency: false),
            WatchPhrase(id: "sw-backpack", label: "Backpack", arasaacId: 2475, sfSymbol: "book", isEmergency: false),
            WatchPhrase(id: "sw-lunchbox", label: "Lunchbox", arasaacId: nil, sfSymbol: "book", isEmergency: false),
            WatchPhrase(id: "sw-folder", label: "Folder", arasaacId: 3233, sfSymbol: "book", isEmergency: false),
            WatchPhrase(id: "sw-notebook", label: "Notebook", arasaacId: 2359, sfSymbol: "book", isEmergency: false),
            WatchPhrase(id: "sw-crayons", label: "Crayons", arasaacId: 4951, sfSymbol: "book", isEmergency: false),
            WatchPhrase(id: "sw-markers", label: "Markers", arasaacId: nil, sfSymbol: "book", isEmergency: false),
            WatchPhrase(id: "sw-scissors", label: "Scissors", arasaacId: 2591, sfSymbol: "book", isEmergency: false),
            WatchPhrase(id: "sw-glue", label: "Glue", arasaacId: 2709, sfSymbol: "book", isEmergency: false),
            WatchPhrase(id: "sw-tape", label: "Tape", arasaacId: 15357, sfSymbol: "book", isEmergency: false),
            WatchPhrase(id: "sw-eraser", label: "Eraser", arasaacId: 16341, sfSymbol: "book", isEmergency: false),
            WatchPhrase(id: "sw-ruler", label: "Ruler", arasaacId: 2815, sfSymbol: "book", isEmergency: false),
            WatchPhrase(id: "sw-whiteboard", label: "Whiteboard", arasaacId: 37872, sfSymbol: "book", isEmergency: false),
            WatchPhrase(id: "sw-smart-board", label: "Smart board", arasaacId: 3054, sfSymbol: "book", isEmergency: false),
            WatchPhrase(id: "sw-projector", label: "Projector", arasaacId: 8202, sfSymbol: "book", isEmergency: false),
            WatchPhrase(id: "sw-math", label: "Math", arasaacId: 36373, sfSymbol: "book", isEmergency: false),
            WatchPhrase(id: "sw-reading", label: "Reading", arasaacId: 2447, sfSymbol: "book", isEmergency: false),
            WatchPhrase(id: "sw-writing", label: "Writing", arasaacId: 2380, sfSymbol: "book", isEmergency: false),
            WatchPhrase(id: "sw-spelling", label: "Spelling", arasaacId: nil, sfSymbol: "book", isEmergency: false),
            WatchPhrase(id: "sw-science", label: "Science", arasaacId: 32542, sfSymbol: "book", isEmergency: false),
            WatchPhrase(id: "sw-social-studies", label: "Social studies", arasaacId: 34786, sfSymbol: "book", isEmergency: false),
            WatchPhrase(id: "sw-history", label: "History", arasaacId: 32632, sfSymbol: "book", isEmergency: false),
            WatchPhrase(id: "sw-pe", label: "PE", arasaacId: 7798, sfSymbol: "book", isEmergency: false),
            WatchPhrase(id: "sw-gym", label: "Gym", arasaacId: 24785, sfSymbol: "book", isEmergency: false),
            WatchPhrase(id: "sw-recess-time", label: "Recess time", arasaacId: 5527, sfSymbol: "book", isEmergency: false),
            WatchPhrase(id: "sw-library-time", label: "Library time", arasaacId: 7131, sfSymbol: "book", isEmergency: false),
            WatchPhrase(id: "sw-story-time", label: "Story time", arasaacId: 5527, sfSymbol: "book", isEmergency: false),
            WatchPhrase(id: "sw-circle-time", label: "Circle time", arasaacId: 27575, sfSymbol: "book", isEmergency: false),
            WatchPhrase(id: "sw-lunch-time", label: "Lunch time", arasaacId: 5527, sfSymbol: "book", isEmergency: false),
            WatchPhrase(id: "sw-snack-time", label: "Snack time", arasaacId: 5527, sfSymbol: "book", isEmergency: false),
            WatchPhrase(id: "sw-worksheet", label: "Worksheet", arasaacId: 37405, sfSymbol: "book", isEmergency: false),
            WatchPhrase(id: "sw-quiz", label: "Quiz", arasaacId: 8083, sfSymbol: "book", isEmergency: false),
            WatchPhrase(id: "sw-test", label: "Test", arasaacId: 28825, sfSymbol: "book", isEmergency: false),
            WatchPhrase(id: "sw-project", label: "Project", arasaacId: 8201, sfSymbol: "book", isEmergency: false),
            WatchPhrase(id: "sw-field-trip", label: "Field trip", arasaacId: 8239, sfSymbol: "book", isEmergency: false),
            WatchPhrase(id: "sw-assembly", label: "Assembly", arasaacId: 9913, sfSymbol: "book", isEmergency: false),
            WatchPhrase(id: "sw-bus-ride", label: "Bus ride", arasaacId: 38116, sfSymbol: "book", isEmergency: false),
        ]),
        WatchCategory(id: "health-body", icon: "cross.case.fill", name: "Health / Body", phrases: [
            WatchPhrase(id: "hb-head", label: "Head", arasaacId: 2673, sfSymbol: "cross", isEmergency: false),
            WatchPhrase(id: "hb-tummy", label: "Tummy", arasaacId: 2786, sfSymbol: "cross", isEmergency: false),
            WatchPhrase(id: "hb-hand", label: "Hand", arasaacId: 28431, sfSymbol: "cross", isEmergency: false),
            WatchPhrase(id: "hb-foot", label: "Foot", arasaacId: 25327, sfSymbol: "cross", isEmergency: false),
            WatchPhrase(id: "hb-eye", label: "Eye", arasaacId: 6573, sfSymbol: "cross", isEmergency: false),
            WatchPhrase(id: "hb-ear", label: "Ear", arasaacId: 2871, sfSymbol: "cross", isEmergency: false),
            WatchPhrase(id: "hb-mouth", label: "Mouth", arasaacId: 2663, sfSymbol: "cross", isEmergency: false),
            WatchPhrase(id: "hb-nose", label: "Nose", arasaacId: 2887, sfSymbol: "cross", isEmergency: false),
            WatchPhrase(id: "hb-hurts", label: "It hurts", arasaacId: 31670, sfSymbol: "cross", isEmergency: false),
            WatchPhrase(id: "hb-sick", label: "I feel sick", arasaacId: 2376, sfSymbol: "cross", isEmergency: false),
            WatchPhrase(id: "hb-medicine", label: "Medicine", arasaacId: 8163, sfSymbol: "cross", isEmergency: false),
            WatchPhrase(id: "hb-teeth", label: "Teeth", arasaacId: 2737, sfSymbol: "cross", isEmergency: false),
            WatchPhrase(id: "hb-back", label: "Back", arasaacId: 2748, sfSymbol: "cross", isEmergency: false),
            WatchPhrase(id: "hb-arm", label: "Arm", arasaacId: 2669, sfSymbol: "cross", isEmergency: false),
            WatchPhrase(id: "hb-hair", label: "Hair", arasaacId: 2851, sfSymbol: "cross", isEmergency: false),
            WatchPhrase(id: "hb-face", label: "Face", arasaacId: 2684, sfSymbol: "cross", isEmergency: false),
            WatchPhrase(id: "hb-forehead", label: "Forehead", arasaacId: 3326, sfSymbol: "cross", isEmergency: false),
            WatchPhrase(id: "hb-cheek", label: "Cheek", arasaacId: 2919, sfSymbol: "cross", isEmergency: false),
            WatchPhrase(id: "hb-chin", label: "Chin", arasaacId: 2991, sfSymbol: "cross", isEmergency: false),
            WatchPhrase(id: "hb-lips", label: "Lips", arasaacId: 2953, sfSymbol: "cross", isEmergency: false),
            WatchPhrase(id: "hb-tongue", label: "Tongue", arasaacId: 2944, sfSymbol: "cross", isEmergency: false),
            WatchPhrase(id: "hb-throat", label: "Throat", arasaacId: 3332, sfSymbol: "cross", isEmergency: false),
            WatchPhrase(id: "hb-neck", label: "Neck", arasaacId: 2727, sfSymbol: "cross", isEmergency: false),
            WatchPhrase(id: "hb-shoulder", label: "Shoulder", arasaacId: 2977, sfSymbol: "cross", isEmergency: false),
            WatchPhrase(id: "hb-elbow", label: "Elbow", arasaacId: 2707, sfSymbol: "cross", isEmergency: false),
            WatchPhrase(id: "hb-wrist", label: "Wrist", arasaacId: 2904, sfSymbol: "cross", isEmergency: false),
            WatchPhrase(id: "hb-finger", label: "Finger", arasaacId: 3298, sfSymbol: "cross", isEmergency: false),
            WatchPhrase(id: "hb-thumb", label: "Thumb", arasaacId: 7799, sfSymbol: "cross", isEmergency: false),
            WatchPhrase(id: "hb-knuckle", label: "Knuckle", arasaacId: 31182, sfSymbol: "cross", isEmergency: false),
            WatchPhrase(id: "hb-knee", label: "Knee", arasaacId: 2810, sfSymbol: "cross", isEmergency: false),
            WatchPhrase(id: "hb-ankle", label: "Ankle", arasaacId: 3405, sfSymbol: "cross", isEmergency: false),
            WatchPhrase(id: "hb-toe", label: "Toe", arasaacId: 7284, sfSymbol: "cross", isEmergency: false),
            WatchPhrase(id: "hb-heel", label: "Heel", arasaacId: 3399, sfSymbol: "cross", isEmergency: false),
            WatchPhrase(id: "hb-chest", label: "Chest", arasaacId: 2853, sfSymbol: "cross", isEmergency: false),
            WatchPhrase(id: "hb-belly", label: "Belly", arasaacId: 2786, sfSymbol: "cross", isEmergency: false),
            WatchPhrase(id: "hb-hip", label: "Hip", arasaacId: 3000, sfSymbol: "cross", isEmergency: false),
            WatchPhrase(id: "hb-bottom", label: "Bottom", arasaacId: 32818, sfSymbol: "cross", isEmergency: false),
            WatchPhrase(id: "hb-skin", label: "Skin", arasaacId: 2840, sfSymbol: "cross", isEmergency: false),
            WatchPhrase(id: "hb-bone", label: "Bone", arasaacId: 2972, sfSymbol: "cross", isEmergency: false),
            WatchPhrase(id: "hb-muscle", label: "Muscle", arasaacId: 2891, sfSymbol: "cross", isEmergency: false),
            WatchPhrase(id: "hb-headache", label: "Headache", arasaacId: 28651, sfSymbol: "cross", isEmergency: false),
            WatchPhrase(id: "hb-stomachache", label: "Stomachache", arasaacId: 39664, sfSymbol: "cross", isEmergency: false),
            WatchPhrase(id: "hb-earache", label: "Earache", arasaacId: 28777, sfSymbol: "cross", isEmergency: false),
            WatchPhrase(id: "hb-toothache", label: "Toothache", arasaacId: 10263, sfSymbol: "cross", isEmergency: false),
            WatchPhrase(id: "hb-sore-throat", label: "Sore throat", arasaacId: 10262, sfSymbol: "cross", isEmergency: false),
            WatchPhrase(id: "hb-cough", label: "Cough", arasaacId: 3406, sfSymbol: "cross", isEmergency: false),
            WatchPhrase(id: "hb-sneeze", label: "Sneeze", arasaacId: 16703, sfSymbol: "cross", isEmergency: false),
            WatchPhrase(id: "hb-runny-nose", label: "Runny nose", arasaacId: 16821, sfSymbol: "cross", isEmergency: false),
            WatchPhrase(id: "hb-stuffy-nose", label: "Stuffy nose", arasaacId: 16821, sfSymbol: "cross", isEmergency: false),
            WatchPhrase(id: "hb-fever", label: "Fever", arasaacId: 32530, sfSymbol: "cross", isEmergency: false),
            WatchPhrase(id: "hb-chills", label: "Chills", arasaacId: 26384, sfSymbol: "cross", isEmergency: false),
            WatchPhrase(id: "hb-shaking", label: "Shaking", arasaacId: nil, sfSymbol: "cross", isEmergency: false),
            WatchPhrase(id: "hb-dizzy-spell", label: "Dizzy spell", arasaacId: 7155, sfSymbol: "cross", isEmergency: false),
            WatchPhrase(id: "hb-bruise", label: "Bruise", arasaacId: 8170, sfSymbol: "cross", isEmergency: false),
            WatchPhrase(id: "hb-cut", label: "Cut", arasaacId: 5975, sfSymbol: "cross", isEmergency: false),
            WatchPhrase(id: "hb-scrape", label: "Scrape", arasaacId: 37315, sfSymbol: "cross", isEmergency: false),
            WatchPhrase(id: "hb-bump", label: "Bump", arasaacId: 5427, sfSymbol: "cross", isEmergency: false),
            WatchPhrase(id: "hb-bandage", label: "Bandage", arasaacId: 6243, sfSymbol: "cross", isEmergency: false),
            WatchPhrase(id: "hb-itchy-spot", label: "Itchy spot", arasaacId: 7151, sfSymbol: "cross", isEmergency: false),
            WatchPhrase(id: "hb-rash", label: "Rash", arasaacId: 5578, sfSymbol: "cross", isEmergency: false),
            WatchPhrase(id: "hb-allergic-reaction", label: "Allergic reaction", arasaacId: nil, sfSymbol: "cross", isEmergency: false),
            WatchPhrase(id: "hb-pain", label: "Pain", arasaacId: 2367, sfSymbol: "cross", isEmergency: false),
            WatchPhrase(id: "hb-sharp-pain", label: "Sharp pain", arasaacId: 10357, sfSymbol: "cross", isEmergency: false),
            WatchPhrase(id: "hb-dull-pain", label: "Dull pain", arasaacId: 10357, sfSymbol: "cross", isEmergency: false),
            WatchPhrase(id: "hb-burning", label: "Burning", arasaacId: nil, sfSymbol: "cross", isEmergency: false),
            WatchPhrase(id: "hb-vitamins", label: "Vitamins", arasaacId: 36504, sfSymbol: "cross", isEmergency: false),
            WatchPhrase(id: "hb-inhaler", label: "Inhaler", arasaacId: 6017, sfSymbol: "cross", isEmergency: false),
            WatchPhrase(id: "hb-epipen", label: "EpiPen", arasaacId: nil, sfSymbol: "cross", isEmergency: false),
            WatchPhrase(id: "hb-pill", label: "Pill", arasaacId: 15000, sfSymbol: "cross", isEmergency: false),
            WatchPhrase(id: "hb-drops", label: "Drops", arasaacId: 8592, sfSymbol: "cross", isEmergency: false),
            WatchPhrase(id: "hb-doctor-visit", label: "Doctor visit", arasaacId: 26585, sfSymbol: "cross", isEmergency: false),
            WatchPhrase(id: "hb-shot", label: "Shot", arasaacId: 36517, sfSymbol: "cross", isEmergency: false),
            WatchPhrase(id: "hb-x-ray", label: "X-ray", arasaacId: 6198, sfSymbol: "cross", isEmergency: false),
            WatchPhrase(id: "hb-check-up", label: "Check-up", arasaacId: 27278, sfSymbol: "cross", isEmergency: false),
            WatchPhrase(id: "hb-wash-my-hands", label: "Wash my hands", arasaacId: 9006, sfSymbol: "cross", isEmergency: false),
            WatchPhrase(id: "hb-brush-my-teeth", label: "Brush my teeth", arasaacId: 39427, sfSymbol: "cross", isEmergency: false),
            WatchPhrase(id: "hr-wash-hands", label: "Wash hands", arasaacId: 9006, sfSymbol: "cross", isEmergency: false),
        ]),
        WatchCategory(id: "time", icon: "clock.fill", name: "Time", phrases: [
            WatchPhrase(id: "ti-now", label: "Now", arasaacId: 32747, sfSymbol: "clock", isEmergency: false),
            WatchPhrase(id: "ti-later", label: "Later", arasaacId: 32749, sfSymbol: "clock", isEmergency: false),
            WatchPhrase(id: "ti-today", label: "Today", arasaacId: 7131, sfSymbol: "clock", isEmergency: false),
            WatchPhrase(id: "ti-tomorrow", label: "Tomorrow", arasaacId: 38278, sfSymbol: "clock", isEmergency: false),
            WatchPhrase(id: "ti-yesterday", label: "Yesterday", arasaacId: 38279, sfSymbol: "clock", isEmergency: false),
            WatchPhrase(id: "ti-morning", label: "Morning", arasaacId: 25704, sfSymbol: "clock", isEmergency: false),
            WatchPhrase(id: "ti-afternoon", label: "Afternoon", arasaacId: 7268, sfSymbol: "clock", isEmergency: false),
            WatchPhrase(id: "ti-night", label: "Night", arasaacId: 26997, sfSymbol: "clock", isEmergency: false),
            WatchPhrase(id: "ti-before", label: "Before", arasaacId: 32745, sfSymbol: "clock", isEmergency: false),
            WatchPhrase(id: "ti-after", label: "After", arasaacId: 32749, sfSymbol: "clock", isEmergency: false),
            WatchPhrase(id: "ti-first", label: "First", arasaacId: 37753, sfSymbol: "clock", isEmergency: false),
            WatchPhrase(id: "ti-last", label: "Last", arasaacId: 4765, sfSymbol: "clock", isEmergency: false),
            WatchPhrase(id: "ti-right-now", label: "Right now", arasaacId: 39109, sfSymbol: "clock", isEmergency: false),
            WatchPhrase(id: "ti-in-a-minute", label: "In a minute", arasaacId: 37374, sfSymbol: "clock", isEmergency: false),
            WatchPhrase(id: "ti-soon", label: "Soon", arasaacId: 33044, sfSymbol: "clock", isEmergency: false),
            WatchPhrase(id: "ti-later-today", label: "Later today", arasaacId: 39109, sfSymbol: "clock", isEmergency: false),
            WatchPhrase(id: "ti-tonight", label: "Tonight", arasaacId: nil, sfSymbol: "clock", isEmergency: false),
            WatchPhrase(id: "ti-this-morning", label: "This morning", arasaacId: 37843, sfSymbol: "clock", isEmergency: false),
            WatchPhrase(id: "ti-this-afternoon", label: "This afternoon", arasaacId: 4695, sfSymbol: "clock", isEmergency: false),
            WatchPhrase(id: "ti-this-evening", label: "This evening", arasaacId: 38567, sfSymbol: "clock", isEmergency: false),
            WatchPhrase(id: "ti-last-night", label: "Last night", arasaacId: 39714, sfSymbol: "clock", isEmergency: false),
            WatchPhrase(id: "ti-all-day", label: "All day", arasaacId: 37372, sfSymbol: "clock", isEmergency: false),
            WatchPhrase(id: "ti-all-night", label: "All night", arasaacId: 21018, sfSymbol: "clock", isEmergency: false),
            WatchPhrase(id: "ti-a-long-time", label: "A long time", arasaacId: 5527, sfSymbol: "clock", isEmergency: false),
            WatchPhrase(id: "ti-a-short-time", label: "A short time", arasaacId: 5527, sfSymbol: "clock", isEmergency: false),
            WatchPhrase(id: "ti-a-while-ago", label: "A while ago", arasaacId: 39109, sfSymbol: "clock", isEmergency: false),
            WatchPhrase(id: "ti-weekend", label: "Weekend", arasaacId: 27329, sfSymbol: "clock", isEmergency: false),
            WatchPhrase(id: "ti-weekday", label: "Weekday", arasaacId: 37372, sfSymbol: "clock", isEmergency: false),
            WatchPhrase(id: "ti-monday", label: "Monday", arasaacId: 37730, sfSymbol: "clock", isEmergency: false),
            WatchPhrase(id: "ti-tuesday", label: "Tuesday", arasaacId: 37729, sfSymbol: "clock", isEmergency: false),
            WatchPhrase(id: "ti-wednesday", label: "Wednesday", arasaacId: 37728, sfSymbol: "clock", isEmergency: false),
            WatchPhrase(id: "ti-thursday", label: "Thursday", arasaacId: 37727, sfSymbol: "clock", isEmergency: false),
            WatchPhrase(id: "ti-friday", label: "Friday", arasaacId: 37726, sfSymbol: "clock", isEmergency: false),
            WatchPhrase(id: "ti-saturday", label: "Saturday", arasaacId: 37725, sfSymbol: "clock", isEmergency: false),
            WatchPhrase(id: "ti-sunday", label: "Sunday", arasaacId: 37723, sfSymbol: "clock", isEmergency: false),
            WatchPhrase(id: "ti-birthday", label: "Birthday", arasaacId: 37363, sfSymbol: "clock", isEmergency: false),
            WatchPhrase(id: "ti-holiday", label: "Holiday", arasaacId: 28225, sfSymbol: "clock", isEmergency: false),
            WatchPhrase(id: "td-wednesday", label: "Wednesday", arasaacId: 37728, sfSymbol: "clock", isEmergency: false),
            WatchPhrase(id: "td-yesterday", label: "Yesterday", arasaacId: 38279, sfSymbol: "clock", isEmergency: false),
            WatchPhrase(id: "tm-jan", label: "January", arasaacId: 6488, sfSymbol: "clock", isEmergency: false),
            WatchPhrase(id: "tm-feb", label: "February", arasaacId: 6498, sfSymbol: "clock", isEmergency: false),
            WatchPhrase(id: "tm-mar", label: "March", arasaacId: 6558, sfSymbol: "clock", isEmergency: false),
            WatchPhrase(id: "tm-apr", label: "April", arasaacId: 6024, sfSymbol: "clock", isEmergency: false),
            WatchPhrase(id: "tm-may", label: "May", arasaacId: 6559, sfSymbol: "clock", isEmergency: false),
            WatchPhrase(id: "tm-jun", label: "June", arasaacId: 6539, sfSymbol: "clock", isEmergency: false),
            WatchPhrase(id: "tm-jul", label: "July", arasaacId: 6538, sfSymbol: "clock", isEmergency: false),
            WatchPhrase(id: "tm-aug", label: "August", arasaacId: 6034, sfSymbol: "clock", isEmergency: false),
            WatchPhrase(id: "tm-sep", label: "September", arasaacId: 6613, sfSymbol: "clock", isEmergency: false),
            WatchPhrase(id: "tm-oct", label: "October", arasaacId: 6571, sfSymbol: "clock", isEmergency: false),
            WatchPhrase(id: "tm-nov", label: "November", arasaacId: 6570, sfSymbol: "clock", isEmergency: false),
            WatchPhrase(id: "tm-dec", label: "December", arasaacId: 6476, sfSymbol: "clock", isEmergency: false),
            WatchPhrase(id: "tdate-10", label: "10th", arasaacId: 2244, sfSymbol: "clock", isEmergency: false),
            WatchPhrase(id: "tdate-11", label: "11th", arasaacId: 2244, sfSymbol: "clock", isEmergency: false),
            WatchPhrase(id: "tdate-12", label: "12th", arasaacId: 2244, sfSymbol: "clock", isEmergency: false),
            WatchPhrase(id: "tdate-13", label: "13th", arasaacId: 2244, sfSymbol: "clock", isEmergency: false),
            WatchPhrase(id: "tdate-14", label: "14th", arasaacId: 2244, sfSymbol: "clock", isEmergency: false),
            WatchPhrase(id: "tdate-15", label: "15th", arasaacId: 2244, sfSymbol: "clock", isEmergency: false),
            WatchPhrase(id: "tdate-16", label: "16th", arasaacId: 2244, sfSymbol: "clock", isEmergency: false),
            WatchPhrase(id: "tdate-17", label: "17th", arasaacId: 2244, sfSymbol: "clock", isEmergency: false),
            WatchPhrase(id: "tdate-18", label: "18th", arasaacId: 2244, sfSymbol: "clock", isEmergency: false),
            WatchPhrase(id: "tdate-19", label: "19th", arasaacId: 2244, sfSymbol: "clock", isEmergency: false),
            WatchPhrase(id: "tdate-20", label: "20th", arasaacId: 2244, sfSymbol: "clock", isEmergency: false),
            WatchPhrase(id: "tdate-21", label: "21st", arasaacId: 19541, sfSymbol: "clock", isEmergency: false),
            WatchPhrase(id: "tdate-22", label: "22nd", arasaacId: 2244, sfSymbol: "clock", isEmergency: false),
            WatchPhrase(id: "tdate-23", label: "23rd", arasaacId: 2258, sfSymbol: "clock", isEmergency: false),
            WatchPhrase(id: "tdate-24", label: "24th", arasaacId: 2244, sfSymbol: "clock", isEmergency: false),
            WatchPhrase(id: "tdate-25", label: "25th", arasaacId: 2244, sfSymbol: "clock", isEmergency: false),
            WatchPhrase(id: "tdate-26", label: "26th", arasaacId: 2244, sfSymbol: "clock", isEmergency: false),
            WatchPhrase(id: "tdate-27", label: "27th", arasaacId: 2244, sfSymbol: "clock", isEmergency: false),
            WatchPhrase(id: "tdate-28", label: "28th", arasaacId: 2244, sfSymbol: "clock", isEmergency: false),
            WatchPhrase(id: "tdate-29", label: "29th", arasaacId: 2244, sfSymbol: "clock", isEmergency: false),
            WatchPhrase(id: "tdate-30", label: "30th", arasaacId: 2244, sfSymbol: "clock", isEmergency: false),
            WatchPhrase(id: "tdate-31", label: "31st", arasaacId: 19541, sfSymbol: "clock", isEmergency: false),
        ]),
        WatchCategory(id: "animals", icon: "pawprint.fill", name: "Animals", phrases: [
            WatchPhrase(id: "an-dog", label: "Dog", arasaacId: 7202, sfSymbol: "pawprint", isEmergency: false),
            WatchPhrase(id: "an-cat", label: "Cat", arasaacId: 7114, sfSymbol: "pawprint", isEmergency: false),
            WatchPhrase(id: "an-fish", label: "Fish", arasaacId: 2520, sfSymbol: "pawprint", isEmergency: false),
            WatchPhrase(id: "an-bird", label: "Bird", arasaacId: 2490, sfSymbol: "pawprint", isEmergency: false),
            WatchPhrase(id: "an-horse", label: "Horse", arasaacId: 2294, sfSymbol: "pawprint", isEmergency: false),
            WatchPhrase(id: "an-cow", label: "Cow", arasaacId: 2609, sfSymbol: "pawprint", isEmergency: false),
            WatchPhrase(id: "an-pig", label: "Pig", arasaacId: 24972, sfSymbol: "pawprint", isEmergency: false),
            WatchPhrase(id: "an-rabbit", label: "Rabbit", arasaacId: 2351, sfSymbol: "pawprint", isEmergency: false),
            WatchPhrase(id: "an-bear", label: "Bear", arasaacId: 2488, sfSymbol: "pawprint", isEmergency: false),
            WatchPhrase(id: "an-elephant", label: "Elephant", arasaacId: 2372, sfSymbol: "pawprint", isEmergency: false),
            WatchPhrase(id: "an-duck", label: "Duck", arasaacId: 28479, sfSymbol: "pawprint", isEmergency: false),
            WatchPhrase(id: "an-butterfly", label: "Butterfly", arasaacId: 26200, sfSymbol: "pawprint", isEmergency: false),
            WatchPhrase(id: "an-puppy", label: "Puppy", arasaacId: nil, sfSymbol: "pawprint", isEmergency: false),
            WatchPhrase(id: "an-kitten", label: "Kitten", arasaacId: 2406, sfSymbol: "pawprint", isEmergency: false),
            WatchPhrase(id: "an-hamster", label: "Hamster", arasaacId: 3346, sfSymbol: "pawprint", isEmergency: false),
            WatchPhrase(id: "an-guinea-pig", label: "Guinea pig", arasaacId: 3346, sfSymbol: "pawprint", isEmergency: false),
            WatchPhrase(id: "an-turtle", label: "Turtle", arasaacId: 10241, sfSymbol: "pawprint", isEmergency: false),
            WatchPhrase(id: "an-frog", label: "Frog", arasaacId: 28473, sfSymbol: "pawprint", isEmergency: false),
            WatchPhrase(id: "an-snake", label: "Snake", arasaacId: 2568, sfSymbol: "pawprint", isEmergency: false),
            WatchPhrase(id: "an-lizard", label: "Lizard", arasaacId: 2949, sfSymbol: "pawprint", isEmergency: false),
            WatchPhrase(id: "an-spider", label: "Spider", arasaacId: 38275, sfSymbol: "pawprint", isEmergency: false),
            WatchPhrase(id: "an-bug", label: "Bug", arasaacId: 28459, sfSymbol: "pawprint", isEmergency: false),
            WatchPhrase(id: "an-bee", label: "Bee", arasaacId: 24823, sfSymbol: "pawprint", isEmergency: false),
            WatchPhrase(id: "an-ant", label: "Ant", arasaacId: 2425, sfSymbol: "pawprint", isEmergency: false),
            WatchPhrase(id: "an-lion", label: "Lion", arasaacId: 25187, sfSymbol: "pawprint", isEmergency: false),
            WatchPhrase(id: "an-tiger", label: "Tiger", arasaacId: 2590, sfSymbol: "pawprint", isEmergency: false),
            WatchPhrase(id: "an-monkey", label: "Monkey", arasaacId: 2477, sfSymbol: "pawprint", isEmergency: false),
            WatchPhrase(id: "an-giraffe", label: "Giraffe", arasaacId: 2437, sfSymbol: "pawprint", isEmergency: false),
            WatchPhrase(id: "an-zebra", label: "Zebra", arasaacId: 2324, sfSymbol: "pawprint", isEmergency: false),
            WatchPhrase(id: "an-hippo", label: "Hippo", arasaacId: 2424, sfSymbol: "pawprint", isEmergency: false),
            WatchPhrase(id: "an-penguin", label: "Penguin", arasaacId: 3243, sfSymbol: "pawprint", isEmergency: false),
            WatchPhrase(id: "an-owl", label: "Owl", arasaacId: 2671, sfSymbol: "pawprint", isEmergency: false),
            WatchPhrase(id: "an-eagle", label: "Eagle", arasaacId: 2638, sfSymbol: "pawprint", isEmergency: false),
            WatchPhrase(id: "an-parrot", label: "Parrot", arasaacId: 2934, sfSymbol: "pawprint", isEmergency: false),
            WatchPhrase(id: "an-chicken", label: "Chicken", arasaacId: 4952, sfSymbol: "pawprint", isEmergency: false),
            WatchPhrase(id: "an-rooster", label: "Rooster", arasaacId: 2404, sfSymbol: "pawprint", isEmergency: false),
            WatchPhrase(id: "an-sheep", label: "Sheep", arasaacId: 2489, sfSymbol: "pawprint", isEmergency: false),
            WatchPhrase(id: "an-goat", label: "Goat", arasaacId: 25887, sfSymbol: "pawprint", isEmergency: false),
            WatchPhrase(id: "an-donkey", label: "Donkey", arasaacId: 2291, sfSymbol: "pawprint", isEmergency: false),
            WatchPhrase(id: "an-dolphin", label: "Dolphin", arasaacId: 2732, sfSymbol: "pawprint", isEmergency: false),
            WatchPhrase(id: "an-whale", label: "Whale", arasaacId: 2268, sfSymbol: "pawprint", isEmergency: false),
            WatchPhrase(id: "an-shark", label: "Shark", arasaacId: 2589, sfSymbol: "pawprint", isEmergency: false),
            WatchPhrase(id: "an-octopus", label: "Octopus", arasaacId: 3379, sfSymbol: "pawprint", isEmergency: false),
            WatchPhrase(id: "an-crab", label: "Crab", arasaacId: 2312, sfSymbol: "pawprint", isEmergency: false),
            WatchPhrase(id: "an-starfish", label: "Starfish", arasaacId: 3310, sfSymbol: "pawprint", isEmergency: false),
            WatchPhrase(id: "an-my-pet", label: "My pet", arasaacId: 38141, sfSymbol: "pawprint", isEmergency: false),
            WatchPhrase(id: "an-my-dog", label: "My dog", arasaacId: 9016, sfSymbol: "pawprint", isEmergency: false),
            WatchPhrase(id: "an-my-cat", label: "My cat", arasaacId: 36647, sfSymbol: "pawprint", isEmergency: false),
            WatchPhrase(id: "ap-hamster", label: "Hamster", arasaacId: 3346, sfSymbol: "pawprint", isEmergency: false),
            WatchPhrase(id: "af-chicken", label: "Chicken", arasaacId: 4952, sfSymbol: "pawprint", isEmergency: false),
            WatchPhrase(id: "aw-elephant", label: "Elephant", arasaacId: 2372, sfSymbol: "pawprint", isEmergency: false),
            WatchPhrase(id: "ab-penguin", label: "Penguin", arasaacId: 3243, sfSymbol: "pawprint", isEmergency: false),
            WatchPhrase(id: "ab-sparrow", label: "Sparrow", arasaacId: 4657, sfSymbol: "pawprint", isEmergency: false),
            WatchPhrase(id: "as-starfish", label: "Starfish", arasaacId: 3310, sfSymbol: "pawprint", isEmergency: false),
        ]),
        WatchCategory(id: "colors", icon: "paintpalette", name: "Colors", phrases: [
            WatchPhrase(id: "co-red", label: "Red", arasaacId: 2808, sfSymbol: "circle.fill", isEmergency: false),
            WatchPhrase(id: "co-blue", label: "Blue", arasaacId: 4869, sfSymbol: "circle.fill", isEmergency: false),
            WatchPhrase(id: "co-green", label: "Green", arasaacId: 4887, sfSymbol: "circle.fill", isEmergency: false),
            WatchPhrase(id: "co-yellow", label: "Yellow", arasaacId: 2648, sfSymbol: "circle.fill", isEmergency: false),
            WatchPhrase(id: "co-orange", label: "Orange", arasaacId: 2888, sfSymbol: "circle.fill", isEmergency: false),
            WatchPhrase(id: "co-purple", label: "Purple", arasaacId: 2907, sfSymbol: "circle.fill", isEmergency: false),
            WatchPhrase(id: "co-pink", label: "Pink", arasaacId: 2807, sfSymbol: "circle.fill", isEmergency: false),
            WatchPhrase(id: "co-black", label: "Black", arasaacId: 2886, sfSymbol: "circle.fill", isEmergency: false),
            WatchPhrase(id: "co-white", label: "White", arasaacId: 8043, sfSymbol: "circle.fill", isEmergency: false),
            WatchPhrase(id: "co-brown", label: "Brown", arasaacId: 2923, sfSymbol: "circle.fill", isEmergency: false),
            WatchPhrase(id: "co-gray", label: "Gray", arasaacId: 3340, sfSymbol: "circle.fill", isEmergency: false),
            WatchPhrase(id: "co-silver", label: "Silver", arasaacId: 6183, sfSymbol: "circle.fill", isEmergency: false),
            WatchPhrase(id: "co-gold", label: "Gold", arasaacId: 6161, sfSymbol: "circle.fill", isEmergency: false),
            WatchPhrase(id: "co-beige", label: "Beige", arasaacId: 9093, sfSymbol: "circle.fill", isEmergency: false),
            WatchPhrase(id: "co-tan", label: "Tan", arasaacId: 5402, sfSymbol: "circle.fill", isEmergency: false),
            WatchPhrase(id: "co-light-blue", label: "Light blue", arasaacId: 4936, sfSymbol: "circle.fill", isEmergency: false),
            WatchPhrase(id: "co-dark-blue", label: "Dark blue", arasaacId: 37592, sfSymbol: "circle.fill", isEmergency: false),
            WatchPhrase(id: "co-light-green", label: "Light green", arasaacId: 4886, sfSymbol: "circle.fill", isEmergency: false),
            WatchPhrase(id: "co-dark-green", label: "Dark green", arasaacId: 4887, sfSymbol: "circle.fill", isEmergency: false),
            WatchPhrase(id: "co-light-pink", label: "Light pink", arasaacId: 3080, sfSymbol: "circle.fill", isEmergency: false),
            WatchPhrase(id: "co-hot-pink", label: "Hot pink", arasaacId: 3080, sfSymbol: "circle.fill", isEmergency: false),
            WatchPhrase(id: "co-rainbow", label: "Rainbow", arasaacId: 2986, sfSymbol: "circle.fill", isEmergency: false),
            WatchPhrase(id: "co-my-favorite-color", label: "My favorite color", arasaacId: 2662, sfSymbol: "circle.fill", isEmergency: false),
        ]),
        WatchCategory(id: "clothes", icon: "tshirt.fill", name: "Clothes", phrases: [
            WatchPhrase(id: "cl-shirt", label: "Shirt", arasaacId: 13640, sfSymbol: "tshirt", isEmergency: false),
            WatchPhrase(id: "cl-pants", label: "Pants", arasaacId: 2565, sfSymbol: "tshirt", isEmergency: false),
            WatchPhrase(id: "cl-shoes", label: "Shoes", arasaacId: 2775, sfSymbol: "tshirt", isEmergency: false),
            WatchPhrase(id: "cl-socks", label: "Socks", arasaacId: 2298, sfSymbol: "tshirt", isEmergency: false),
            WatchPhrase(id: "cl-jacket", label: "Jacket", arasaacId: 4872, sfSymbol: "tshirt", isEmergency: false),
            WatchPhrase(id: "cl-hat", label: "Hat", arasaacId: 2572, sfSymbol: "tshirt", isEmergency: false),
            WatchPhrase(id: "cl-dress", label: "Dress", arasaacId: 6627, sfSymbol: "tshirt", isEmergency: false),
            WatchPhrase(id: "cl-pajamas", label: "Pajamas", arasaacId: 2522, sfSymbol: "tshirt", isEmergency: false),
            WatchPhrase(id: "cl-underwear", label: "Underwear", arasaacId: 25680, sfSymbol: "tshirt", isEmergency: false),
            WatchPhrase(id: "cl-boots", label: "Boots", arasaacId: 2287, sfSymbol: "tshirt", isEmergency: false),
            WatchPhrase(id: "cl-t-shirt", label: "T-shirt", arasaacId: 2309, sfSymbol: "tshirt", isEmergency: false),
            WatchPhrase(id: "cl-sweater", label: "Sweater", arasaacId: 2436, sfSymbol: "tshirt", isEmergency: false),
            WatchPhrase(id: "cl-sweatshirt", label: "Sweatshirt", arasaacId: 8701, sfSymbol: "tshirt", isEmergency: false),
            WatchPhrase(id: "cl-hoodie", label: "Hoodie", arasaacId: nil, sfSymbol: "tshirt", isEmergency: false),
            WatchPhrase(id: "cl-coat", label: "Coat", arasaacId: 2242, sfSymbol: "tshirt", isEmergency: false),
            WatchPhrase(id: "cl-shorts", label: "Shorts", arasaacId: 10142, sfSymbol: "tshirt", isEmergency: false),
            WatchPhrase(id: "cl-skirt", label: "Skirt", arasaacId: 2391, sfSymbol: "tshirt", isEmergency: false),
            WatchPhrase(id: "cl-leggings", label: "Leggings", arasaacId: 3278, sfSymbol: "tshirt", isEmergency: false),
            WatchPhrase(id: "cl-sandals", label: "Sandals", arasaacId: 2556, sfSymbol: "tshirt", isEmergency: false),
            WatchPhrase(id: "cl-sneakers", label: "Sneakers", arasaacId: 2621, sfSymbol: "tshirt", isEmergency: false),
            WatchPhrase(id: "cl-mittens", label: "Mittens", arasaacId: 2927, sfSymbol: "tshirt", isEmergency: false),
            WatchPhrase(id: "cl-gloves", label: "Gloves", arasaacId: 2415, sfSymbol: "tshirt", isEmergency: false),
            WatchPhrase(id: "cl-scarf", label: "Scarf", arasaacId: 2290, sfSymbol: "tshirt", isEmergency: false),
            WatchPhrase(id: "cl-belt", label: "Belt", arasaacId: 2336, sfSymbol: "tshirt", isEmergency: false),
            WatchPhrase(id: "cl-backpack", label: "Backpack", arasaacId: 2475, sfSymbol: "tshirt", isEmergency: false),
            WatchPhrase(id: "cl-helmet", label: "Helmet", arasaacId: 2691, sfSymbol: "tshirt", isEmergency: false),
            WatchPhrase(id: "cl-glasses", label: "Glasses", arasaacId: 9140, sfSymbol: "tshirt", isEmergency: false),
            WatchPhrase(id: "cl-sunglasses", label: "Sunglasses", arasaacId: 3330, sfSymbol: "tshirt", isEmergency: false),
            WatchPhrase(id: "cl-diaper", label: "Diaper", arasaacId: 22017, sfSymbol: "tshirt", isEmergency: false),
            WatchPhrase(id: "cl-pull-up", label: "Pull-up", arasaacId: 27278, sfSymbol: "tshirt", isEmergency: false),
        ]),
        WatchCategory(id: "transport", icon: "car.fill", name: "Transportation", phrases: [
            WatchPhrase(id: "tr-car", label: "Car", arasaacId: 2339, sfSymbol: "car", isEmergency: false),
            WatchPhrase(id: "tr-bus", label: "Bus", arasaacId: 2262, sfSymbol: "car", isEmergency: false),
            WatchPhrase(id: "tr-train", label: "Train", arasaacId: 2603, sfSymbol: "car", isEmergency: false),
            WatchPhrase(id: "tr-airplane", label: "Airplane", arasaacId: 6924, sfSymbol: "car", isEmergency: false),
            WatchPhrase(id: "tr-bike", label: "Bike", arasaacId: 6935, sfSymbol: "car", isEmergency: false),
            WatchPhrase(id: "tr-truck", label: "Truck", arasaacId: 3232, sfSymbol: "car", isEmergency: false),
            WatchPhrase(id: "tr-boat", label: "Boat", arasaacId: 6932, sfSymbol: "car", isEmergency: false),
            WatchPhrase(id: "tr-walk", label: "Walk", arasaacId: 29951, sfSymbol: "car", isEmergency: false),
            WatchPhrase(id: "tr-wheelchair", label: "Wheelchair", arasaacId: 25471, sfSymbol: "car", isEmergency: false),
            WatchPhrase(id: "tr-scooter", label: "Scooter", arasaacId: 2508, sfSymbol: "car", isEmergency: false),
            WatchPhrase(id: "tr-stroller", label: "Stroller", arasaacId: nil, sfSymbol: "car", isEmergency: false),
            WatchPhrase(id: "tr-tricycle", label: "Tricycle", arasaacId: 2605, sfSymbol: "car", isEmergency: false),
            WatchPhrase(id: "tr-skateboard", label: "Skateboard", arasaacId: 2507, sfSymbol: "car", isEmergency: false),
            WatchPhrase(id: "tr-roller-skates", label: "Roller skates", arasaacId: 2506, sfSymbol: "car", isEmergency: false),
            WatchPhrase(id: "tr-subway", label: "Subway", arasaacId: 26925, sfSymbol: "car", isEmergency: false),
            WatchPhrase(id: "tr-taxi", label: "Taxi", arasaacId: 2580, sfSymbol: "car", isEmergency: false),
            WatchPhrase(id: "tr-helicopter", label: "Helicopter", arasaacId: 7126, sfSymbol: "car", isEmergency: false),
            WatchPhrase(id: "tr-rocket", label: "Rocket", arasaacId: 2344, sfSymbol: "car", isEmergency: false),
            WatchPhrase(id: "tr-tractor", label: "Tractor", arasaacId: 2600, sfSymbol: "car", isEmergency: false),
            WatchPhrase(id: "tr-fire-truck", label: "Fire truck", arasaacId: 4925, sfSymbol: "car", isEmergency: false),
            WatchPhrase(id: "tr-police-car", label: "Police car", arasaacId: 3426, sfSymbol: "car", isEmergency: false),
            WatchPhrase(id: "tr-ambulance", label: "Ambulance", arasaacId: 6899, sfSymbol: "car", isEmergency: false),
            WatchPhrase(id: "tr-ferry", label: "Ferry", arasaacId: 30612, sfSymbol: "car", isEmergency: false),
            WatchPhrase(id: "tr-sled", label: "Sled", arasaacId: 8710, sfSymbol: "car", isEmergency: false),
            WatchPhrase(id: "tr-drive", label: "Drive", arasaacId: 6458, sfSymbol: "car", isEmergency: false),
            WatchPhrase(id: "tr-ride", label: "Ride", arasaacId: 6045, sfSymbol: "car", isEmergency: false),
        ]),
        WatchCategory(id: "weather", icon: "cloud.sun.fill", name: "Weather", phrases: [
            WatchPhrase(id: "we-sunny", label: "Sunny", arasaacId: 2796, sfSymbol: "cloud", isEmergency: false),
            WatchPhrase(id: "we-rainy", label: "Rainy", arasaacId: 2936, sfSymbol: "cloud", isEmergency: false),
            WatchPhrase(id: "we-cloudy", label: "Cloudy", arasaacId: 2882, sfSymbol: "cloud", isEmergency: false),
            WatchPhrase(id: "we-snowy", label: "Snowy", arasaacId: 2884, sfSymbol: "cloud", isEmergency: false),
            WatchPhrase(id: "we-windy", label: "Windy", arasaacId: 2779, sfSymbol: "cloud", isEmergency: false),
            WatchPhrase(id: "we-hot", label: "Hot", arasaacId: 2300, sfSymbol: "cloud", isEmergency: false),
            WatchPhrase(id: "we-cold", label: "Cold", arasaacId: 4652, sfSymbol: "cloud", isEmergency: false),
            WatchPhrase(id: "we-storm", label: "Storm", arasaacId: 34892, sfSymbol: "cloud", isEmergency: false),
            WatchPhrase(id: "we-foggy", label: "Foggy", arasaacId: 2885, sfSymbol: "cloud", isEmergency: false),
            WatchPhrase(id: "we-rainbow", label: "Rainbow", arasaacId: 2986, sfSymbol: "cloud", isEmergency: false),
            WatchPhrase(id: "we-lightning", label: "Lightning", arasaacId: 34545, sfSymbol: "cloud", isEmergency: false),
            WatchPhrase(id: "we-thunder", label: "Thunder", arasaacId: 11389, sfSymbol: "cloud", isEmergency: false),
            WatchPhrase(id: "we-tornado", label: "Tornado", arasaacId: 5598, sfSymbol: "cloud", isEmergency: false),
            WatchPhrase(id: "we-hurricane", label: "Hurricane", arasaacId: 8606, sfSymbol: "cloud", isEmergency: false),
            WatchPhrase(id: "we-earthquake", label: "Earthquake", arasaacId: 4755, sfSymbol: "cloud", isEmergency: false),
            WatchPhrase(id: "we-warm-out", label: "Warm out", arasaacId: 36506, sfSymbol: "cloud", isEmergency: false),
            WatchPhrase(id: "we-cool-out", label: "Cool out", arasaacId: 11599, sfSymbol: "cloud", isEmergency: false),
            WatchPhrase(id: "we-freezing", label: "Freezing", arasaacId: 36053, sfSymbol: "cloud", isEmergency: false),
            WatchPhrase(id: "we-wear-a-coat", label: "Wear a coat", arasaacId: 36819, sfSymbol: "cloud", isEmergency: false),
            WatchPhrase(id: "we-wear-shorts", label: "Wear shorts", arasaacId: 36819, sfSymbol: "cloud", isEmergency: false),
        ]),
        WatchCategory(id: "toys-fun", icon: "gamecontroller.fill", name: "Toys & Fun", phrases: [
            WatchPhrase(id: "tf-ball", label: "Ball", arasaacId: 3241, sfSymbol: "gamecontroller", isEmergency: false),
            WatchPhrase(id: "tf-blocks", label: "Blocks", arasaacId: 4935, sfSymbol: "gamecontroller", isEmergency: false),
            WatchPhrase(id: "tf-doll", label: "Doll", arasaacId: 26238, sfSymbol: "gamecontroller", isEmergency: false),
            WatchPhrase(id: "tf-puzzle", label: "Puzzle", arasaacId: 2540, sfSymbol: "gamecontroller", isEmergency: false),
            WatchPhrase(id: "tf-game", label: "Game", arasaacId: 6170, sfSymbol: "gamecontroller", isEmergency: false),
            WatchPhrase(id: "tf-movie", label: "Movie", arasaacId: 24797, sfSymbol: "gamecontroller", isEmergency: false),
            WatchPhrase(id: "tf-music", label: "Music", arasaacId: 24791, sfSymbol: "gamecontroller", isEmergency: false),
            WatchPhrase(id: "tf-bubbles", label: "Bubbles", arasaacId: 6945, sfSymbol: "gamecontroller", isEmergency: false),
            WatchPhrase(id: "tf-swing", label: "Swing", arasaacId: 4608, sfSymbol: "gamecontroller", isEmergency: false),
            WatchPhrase(id: "tf-slide", label: "Slide", arasaacId: 4759, sfSymbol: "gamecontroller", isEmergency: false),
            WatchPhrase(id: "tf-coloring", label: "Coloring", arasaacId: nil, sfSymbol: "gamecontroller", isEmergency: false),
            WatchPhrase(id: "tf-tablet", label: "Tablet", arasaacId: 28099, sfSymbol: "gamecontroller", isEmergency: false),
            WatchPhrase(id: "tf-stuffed-animal", label: "Stuffed animal", arasaacId: 36907, sfSymbol: "gamecontroller", isEmergency: false),
            WatchPhrase(id: "tf-action-figure", label: "Action figure", arasaacId: 7198, sfSymbol: "gamecontroller", isEmergency: false),
            WatchPhrase(id: "tf-lego", label: "Lego", arasaacId: 8508, sfSymbol: "gamecontroller", isEmergency: false),
            WatchPhrase(id: "tf-train-set", label: "Train set", arasaacId: 39572, sfSymbol: "gamecontroller", isEmergency: false),
            WatchPhrase(id: "tf-card-game", label: "Card game", arasaacId: 3182, sfSymbol: "gamecontroller", isEmergency: false),
            WatchPhrase(id: "tf-board-game", label: "Board game", arasaacId: 33020, sfSymbol: "gamecontroller", isEmergency: false),
            WatchPhrase(id: "tf-video-game", label: "Video game", arasaacId: 21945, sfSymbol: "gamecontroller", isEmergency: false),
            WatchPhrase(id: "tf-crayons", label: "Crayons", arasaacId: 4951, sfSymbol: "gamecontroller", isEmergency: false),
            WatchPhrase(id: "tf-stickers", label: "Stickers", arasaacId: 4932, sfSymbol: "gamecontroller", isEmergency: false),
            WatchPhrase(id: "tf-sandbox", label: "Sandbox", arasaacId: 6049, sfSymbol: "gamecontroller", isEmergency: false),
            WatchPhrase(id: "tf-trampoline", label: "Trampoline", arasaacId: 23891, sfSymbol: "gamecontroller", isEmergency: false),
            WatchPhrase(id: "tf-sprinkler", label: "Sprinkler", arasaacId: 6915, sfSymbol: "gamecontroller", isEmergency: false),
            WatchPhrase(id: "tf-story", label: "Story", arasaacId: 6469, sfSymbol: "gamecontroller", isEmergency: false),
            WatchPhrase(id: "tf-song", label: "Song", arasaacId: 24791, sfSymbol: "gamecontroller", isEmergency: false),
            WatchPhrase(id: "tf-cartoon", label: "Cartoon", arasaacId: 8089, sfSymbol: "gamecontroller", isEmergency: false),
        ]),
    ]
}
