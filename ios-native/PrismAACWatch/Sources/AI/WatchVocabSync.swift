import Foundation
import Security
import WatchConnectivity

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
        vocabTask = Task { @MainActor [weak self] in await self?.loadFromAPI(lang: safeInput) }   // vocab labels in INPUT lang
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
        vocabTask = Task { @MainActor [weak self] in await self?.loadFromAPI(lang: self?.inputLanguage ?? "en-US") }
    }

    // MARK: - Label sanitization

    // #27: changed from fileprivate → internal so tests and companion types can access it
    internal static func sanitizeLabel(_ raw: String) -> String {
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
        return String(bidiStripped.prefix(120))
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
        phrases = c.phrases.map {
            WatchPhrase(
                id:          String($0.id.prefix(50)),   // cap phrase id
                label:       WatchVocabSync.sanitizeLabel($0.label),
                sfSymbol:    String($0.sfSymbol?.prefix(50) ?? "circle.fill"),
                arasaacId:   $0.arasaacId,
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
}
