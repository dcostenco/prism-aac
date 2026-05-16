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
    /// iOS-parity default set — generated from constants/phrases.ts
    /// by scripts/gen-watch-default-set.py. Sync rule: when phrases.ts
    /// changes, re-run the generator and paste the output here.
    static let iOSDefaultSet: [WatchCategory] = [
        WatchCategory(id: "core-pronouns", icon: "person.2.fill", name: "I / You / We", phrases: [
            WatchPhrase(id: "cw-i", label: "I", arasaacId: nil, sfSymbol: "person.fill", isEmergency: false),
            WatchPhrase(id: "cw-you", label: "You", arasaacId: nil, sfSymbol: "person.fill", isEmergency: false),
            WatchPhrase(id: "cw-he", label: "He", arasaacId: nil, sfSymbol: "person.fill", isEmergency: false),
            WatchPhrase(id: "cw-she", label: "She", arasaacId: nil, sfSymbol: "person.fill", isEmergency: false),
            WatchPhrase(id: "cw-it", label: "It", arasaacId: nil, sfSymbol: "person.fill", isEmergency: false),
            WatchPhrase(id: "cw-we", label: "We", arasaacId: nil, sfSymbol: "person.fill", isEmergency: false),
            WatchPhrase(id: "cw-they", label: "They", arasaacId: nil, sfSymbol: "person.fill", isEmergency: false),
            WatchPhrase(id: "cw-me", label: "Me", arasaacId: nil, sfSymbol: "person.fill", isEmergency: false),
            WatchPhrase(id: "cw-my", label: "My", arasaacId: nil, sfSymbol: "person.fill", isEmergency: false),
            WatchPhrase(id: "cw-your", label: "Your", arasaacId: nil, sfSymbol: "person.fill", isEmergency: false),
            WatchPhrase(id: "cw-his", label: "His", arasaacId: nil, sfSymbol: "person.fill", isEmergency: false),
            WatchPhrase(id: "cw-her", label: "Her", arasaacId: nil, sfSymbol: "person.fill", isEmergency: false),
            WatchPhrase(id: "cw-this", label: "This", arasaacId: nil, sfSymbol: "person.fill", isEmergency: false),
            WatchPhrase(id: "cw-that", label: "That", arasaacId: nil, sfSymbol: "person.fill", isEmergency: false),
            WatchPhrase(id: "cw-us", label: "Us", arasaacId: nil, sfSymbol: "person.fill", isEmergency: false),
            WatchPhrase(id: "cw-them", label: "Them", arasaacId: nil, sfSymbol: "person.fill", isEmergency: false),
            WatchPhrase(id: "cw-mine", label: "Mine", arasaacId: nil, sfSymbol: "person.fill", isEmergency: false),
            WatchPhrase(id: "cw-yours", label: "Yours", arasaacId: nil, sfSymbol: "person.fill", isEmergency: false),
            WatchPhrase(id: "cw-theirs", label: "Theirs", arasaacId: nil, sfSymbol: "person.fill", isEmergency: false),
            WatchPhrase(id: "cw-ours", label: "Ours", arasaacId: nil, sfSymbol: "person.fill", isEmergency: false),
            WatchPhrase(id: "cw-hers", label: "Hers", arasaacId: nil, sfSymbol: "person.fill", isEmergency: false),
            WatchPhrase(id: "cw-myself", label: "Myself", arasaacId: nil, sfSymbol: "person.fill", isEmergency: false),
            WatchPhrase(id: "cw-yourself", label: "Yourself", arasaacId: nil, sfSymbol: "person.fill", isEmergency: false),
            WatchPhrase(id: "cw-themselves", label: "Themselves", arasaacId: nil, sfSymbol: "person.fill", isEmergency: false),
            WatchPhrase(id: "cw-ourselves", label: "Ourselves", arasaacId: nil, sfSymbol: "person.fill", isEmergency: false),
            WatchPhrase(id: "cw-each-other", label: "Each other", arasaacId: nil, sfSymbol: "person.fill", isEmergency: false),
            WatchPhrase(id: "cw-anyone", label: "Anyone", arasaacId: nil, sfSymbol: "person.fill", isEmergency: false),
            WatchPhrase(id: "cw-someone", label: "Someone", arasaacId: nil, sfSymbol: "person.fill", isEmergency: false),
            WatchPhrase(id: "cw-everyone", label: "Everyone", arasaacId: nil, sfSymbol: "person.fill", isEmergency: false),
            WatchPhrase(id: "cw-no-one", label: "No one", arasaacId: nil, sfSymbol: "person.fill", isEmergency: false),
            WatchPhrase(id: "cw-nobody", label: "Nobody", arasaacId: nil, sfSymbol: "person.fill", isEmergency: false),
            WatchPhrase(id: "cw-whose", label: "Whose", arasaacId: nil, sfSymbol: "person.fill", isEmergency: false),
        ]),
        WatchCategory(id: "core-verbs", icon: "bolt.fill", name: "Core Verbs", phrases: [
            WatchPhrase(id: "cw-want", label: "Want", arasaacId: nil, sfSymbol: "bolt", isEmergency: false),
            WatchPhrase(id: "cw-want-to", label: "Want to", arasaacId: nil, sfSymbol: "bolt", isEmergency: false),
            WatchPhrase(id: "cw-like", label: "Like", arasaacId: nil, sfSymbol: "bolt", isEmergency: false),
            WatchPhrase(id: "cw-have", label: "Have", arasaacId: nil, sfSymbol: "bolt", isEmergency: false),
            WatchPhrase(id: "cw-do", label: "Do", arasaacId: nil, sfSymbol: "bolt", isEmergency: false),
            WatchPhrase(id: "cw-can", label: "Can", arasaacId: nil, sfSymbol: "bolt", isEmergency: false),
            WatchPhrase(id: "cw-need", label: "Need", arasaacId: nil, sfSymbol: "bolt", isEmergency: false),
            WatchPhrase(id: "cw-know", label: "Know", arasaacId: nil, sfSymbol: "bolt", isEmergency: false),
            WatchPhrase(id: "cw-see", label: "See", arasaacId: nil, sfSymbol: "bolt", isEmergency: false),
            WatchPhrase(id: "cw-think", label: "Think", arasaacId: nil, sfSymbol: "bolt", isEmergency: false),
            WatchPhrase(id: "cw-feel", label: "Feel", arasaacId: nil, sfSymbol: "bolt", isEmergency: false),
            WatchPhrase(id: "cw-say", label: "Say", arasaacId: nil, sfSymbol: "bolt", isEmergency: false),
            WatchPhrase(id: "cw-tell", label: "Tell", arasaacId: nil, sfSymbol: "bolt", isEmergency: false),
            WatchPhrase(id: "cw-try", label: "Try", arasaacId: nil, sfSymbol: "bolt", isEmergency: false),
            WatchPhrase(id: "cw-let", label: "Let", arasaacId: nil, sfSymbol: "bolt", isEmergency: false),
            WatchPhrase(id: "cw-help", label: "Help", arasaacId: nil, sfSymbol: "bolt", isEmergency: true),
            WatchPhrase(id: "cw-make", label: "Make", arasaacId: nil, sfSymbol: "bolt", isEmergency: false),
            WatchPhrase(id: "cw-come", label: "Come", arasaacId: nil, sfSymbol: "bolt", isEmergency: false),
            WatchPhrase(id: "cw-go-core", label: "Go", arasaacId: nil, sfSymbol: "bolt", isEmergency: false),
            WatchPhrase(id: "cw-get-core", label: "Get", arasaacId: nil, sfSymbol: "bolt", isEmergency: false),
            WatchPhrase(id: "cw-put-core", label: "Put", arasaacId: nil, sfSymbol: "bolt", isEmergency: false),
            WatchPhrase(id: "cw-wait", label: "Wait", arasaacId: nil, sfSymbol: "bolt", isEmergency: false),
            WatchPhrase(id: "cw-stop", label: "Stop", arasaacId: nil, sfSymbol: "bolt", isEmergency: false),
            WatchPhrase(id: "cw-start", label: "Start", arasaacId: nil, sfSymbol: "bolt", isEmergency: false),
            WatchPhrase(id: "cw-finish", label: "Finish", arasaacId: nil, sfSymbol: "bolt", isEmergency: false),
            WatchPhrase(id: "cw-begin", label: "Begin", arasaacId: nil, sfSymbol: "bolt", isEmergency: false),
            WatchPhrase(id: "cw-end", label: "End", arasaacId: nil, sfSymbol: "bolt", isEmergency: false),
            WatchPhrase(id: "cw-stay", label: "Stay", arasaacId: nil, sfSymbol: "bolt", isEmergency: false),
            WatchPhrase(id: "cw-leave", label: "Leave", arasaacId: nil, sfSymbol: "bolt", isEmergency: false),
            WatchPhrase(id: "cw-look", label: "Look", arasaacId: nil, sfSymbol: "bolt", isEmergency: false),
            WatchPhrase(id: "cw-watch", label: "Watch", arasaacId: nil, sfSymbol: "bolt", isEmergency: false),
            WatchPhrase(id: "cw-hear", label: "Hear", arasaacId: nil, sfSymbol: "bolt", isEmergency: false),
            WatchPhrase(id: "cw-listen", label: "Listen", arasaacId: nil, sfSymbol: "bolt", isEmergency: false),
            WatchPhrase(id: "cw-smell", label: "Smell", arasaacId: nil, sfSymbol: "bolt", isEmergency: false),
            WatchPhrase(id: "cw-taste", label: "Taste", arasaacId: nil, sfSymbol: "bolt", isEmergency: false),
            WatchPhrase(id: "cw-touch", label: "Touch", arasaacId: nil, sfSymbol: "bolt", isEmergency: false),
            WatchPhrase(id: "cw-hold", label: "Hold", arasaacId: nil, sfSymbol: "bolt", isEmergency: false),
            WatchPhrase(id: "cw-grab", label: "Grab", arasaacId: nil, sfSymbol: "bolt", isEmergency: false),
            WatchPhrase(id: "cw-push", label: "Push", arasaacId: nil, sfSymbol: "bolt", isEmergency: false),
            WatchPhrase(id: "cw-pull", label: "Pull", arasaacId: nil, sfSymbol: "bolt", isEmergency: false),
            WatchPhrase(id: "cw-lift", label: "Lift", arasaacId: nil, sfSymbol: "bolt", isEmergency: false),
            WatchPhrase(id: "cw-carry", label: "Carry", arasaacId: nil, sfSymbol: "bolt", isEmergency: false),
            WatchPhrase(id: "cw-drop", label: "Drop", arasaacId: nil, sfSymbol: "bolt", isEmergency: false),
            WatchPhrase(id: "cw-throw", label: "Throw", arasaacId: nil, sfSymbol: "bolt", isEmergency: false),
            WatchPhrase(id: "cw-catch", label: "Catch", arasaacId: nil, sfSymbol: "bolt", isEmergency: false),
            WatchPhrase(id: "cw-open", label: "Open", arasaacId: nil, sfSymbol: "bolt", isEmergency: false),
            WatchPhrase(id: "cw-close", label: "Close", arasaacId: nil, sfSymbol: "bolt", isEmergency: false),
            WatchPhrase(id: "cw-turn", label: "Turn", arasaacId: nil, sfSymbol: "bolt", isEmergency: false),
            WatchPhrase(id: "cw-move", label: "Move", arasaacId: nil, sfSymbol: "bolt", isEmergency: false),
            WatchPhrase(id: "cw-sit", label: "Sit", arasaacId: nil, sfSymbol: "bolt", isEmergency: false),
            WatchPhrase(id: "cw-stand", label: "Stand", arasaacId: nil, sfSymbol: "bolt", isEmergency: false),
            WatchPhrase(id: "cw-walk", label: "Walk", arasaacId: nil, sfSymbol: "bolt", isEmergency: false),
            WatchPhrase(id: "cw-run", label: "Run", arasaacId: nil, sfSymbol: "bolt", isEmergency: false),
            WatchPhrase(id: "cw-jump", label: "Jump", arasaacId: nil, sfSymbol: "bolt", isEmergency: false),
            WatchPhrase(id: "cw-climb", label: "Climb", arasaacId: nil, sfSymbol: "bolt", isEmergency: false),
            WatchPhrase(id: "cw-fall", label: "Fall", arasaacId: nil, sfSymbol: "bolt", isEmergency: false),
            WatchPhrase(id: "cw-rest", label: "Rest", arasaacId: nil, sfSymbol: "bolt", isEmergency: false),
            WatchPhrase(id: "cw-sleep", label: "Sleep", arasaacId: nil, sfSymbol: "bolt", isEmergency: false),
            WatchPhrase(id: "cw-wake", label: "Wake", arasaacId: nil, sfSymbol: "bolt", isEmergency: false),
            WatchPhrase(id: "cw-dream", label: "Dream", arasaacId: nil, sfSymbol: "bolt", isEmergency: false),
            WatchPhrase(id: "cw-eat", label: "Eat", arasaacId: nil, sfSymbol: "bolt", isEmergency: false),
            WatchPhrase(id: "cw-drink", label: "Drink", arasaacId: nil, sfSymbol: "bolt", isEmergency: false),
            WatchPhrase(id: "cw-bite", label: "Bite", arasaacId: nil, sfSymbol: "bolt", isEmergency: false),
            WatchPhrase(id: "cw-chew", label: "Chew", arasaacId: nil, sfSymbol: "bolt", isEmergency: false),
            WatchPhrase(id: "cw-swallow", label: "Swallow", arasaacId: nil, sfSymbol: "bolt", isEmergency: false),
            WatchPhrase(id: "cw-spit", label: "Spit", arasaacId: nil, sfSymbol: "bolt", isEmergency: false),
            WatchPhrase(id: "cw-talk", label: "Talk", arasaacId: nil, sfSymbol: "bolt", isEmergency: false),
            WatchPhrase(id: "cw-speak", label: "Speak", arasaacId: nil, sfSymbol: "bolt", isEmergency: false),
            WatchPhrase(id: "cw-whisper", label: "Whisper", arasaacId: nil, sfSymbol: "bolt", isEmergency: false),
            WatchPhrase(id: "cw-shout", label: "Shout", arasaacId: nil, sfSymbol: "bolt", isEmergency: false),
            WatchPhrase(id: "cw-sing", label: "Sing", arasaacId: nil, sfSymbol: "bolt", isEmergency: false),
            WatchPhrase(id: "cw-laugh", label: "Laugh", arasaacId: nil, sfSymbol: "bolt", isEmergency: false),
            WatchPhrase(id: "cw-cry", label: "Cry", arasaacId: nil, sfSymbol: "bolt", isEmergency: false),
            WatchPhrase(id: "cw-smile", label: "Smile", arasaacId: nil, sfSymbol: "bolt", isEmergency: false),
            WatchPhrase(id: "cw-read", label: "Read", arasaacId: nil, sfSymbol: "bolt", isEmergency: false),
            WatchPhrase(id: "cw-write", label: "Write", arasaacId: nil, sfSymbol: "bolt", isEmergency: false),
            WatchPhrase(id: "cw-draw", label: "Draw", arasaacId: nil, sfSymbol: "bolt", isEmergency: false),
            WatchPhrase(id: "cw-paint", label: "Paint", arasaacId: nil, sfSymbol: "bolt", isEmergency: false),
            WatchPhrase(id: "cw-color", label: "Color", arasaacId: nil, sfSymbol: "bolt", isEmergency: false),
            WatchPhrase(id: "cw-cut", label: "Cut", arasaacId: nil, sfSymbol: "bolt", isEmergency: false),
            WatchPhrase(id: "cw-glue", label: "Glue", arasaacId: nil, sfSymbol: "bolt", isEmergency: false),
            WatchPhrase(id: "cw-build", label: "Build", arasaacId: nil, sfSymbol: "bolt", isEmergency: false),
            WatchPhrase(id: "cw-break", label: "Break", arasaacId: nil, sfSymbol: "bolt", isEmergency: false),
            WatchPhrase(id: "cw-fix", label: "Fix", arasaacId: nil, sfSymbol: "bolt", isEmergency: false),
            WatchPhrase(id: "cw-clean", label: "Clean", arasaacId: nil, sfSymbol: "bolt", isEmergency: false),
            WatchPhrase(id: "cw-wash", label: "Wash", arasaacId: nil, sfSymbol: "bolt", isEmergency: false),
            WatchPhrase(id: "cw-find", label: "Find", arasaacId: nil, sfSymbol: "bolt", isEmergency: false),
            WatchPhrase(id: "cw-look-for", label: "Look for", arasaacId: nil, sfSymbol: "bolt", isEmergency: false),
            WatchPhrase(id: "cw-lose", label: "Lose", arasaacId: nil, sfSymbol: "bolt", isEmergency: false),
            WatchPhrase(id: "cw-save", label: "Save", arasaacId: nil, sfSymbol: "bolt", isEmergency: false),
            WatchPhrase(id: "cw-keep", label: "Keep", arasaacId: nil, sfSymbol: "bolt", isEmergency: false),
            WatchPhrase(id: "cw-buy", label: "Buy", arasaacId: nil, sfSymbol: "bolt", isEmergency: false),
            WatchPhrase(id: "cw-sell", label: "Sell", arasaacId: nil, sfSymbol: "bolt", isEmergency: false),
            WatchPhrase(id: "cw-pay", label: "Pay", arasaacId: nil, sfSymbol: "bolt", isEmergency: false),
            WatchPhrase(id: "cw-trade", label: "Trade", arasaacId: nil, sfSymbol: "bolt", isEmergency: false),
            WatchPhrase(id: "cw-send", label: "Send", arasaacId: nil, sfSymbol: "bolt", isEmergency: false),
            WatchPhrase(id: "cw-bring", label: "Bring", arasaacId: nil, sfSymbol: "bolt", isEmergency: false),
            WatchPhrase(id: "cw-take", label: "Take", arasaacId: nil, sfSymbol: "bolt", isEmergency: false),
            WatchPhrase(id: "cw-give", label: "Give", arasaacId: nil, sfSymbol: "bolt", isEmergency: false),
            WatchPhrase(id: "cw-share", label: "Share", arasaacId: nil, sfSymbol: "bolt", isEmergency: false),
            WatchPhrase(id: "cw-ask", label: "Ask", arasaacId: nil, sfSymbol: "bolt", isEmergency: false),
            WatchPhrase(id: "cw-answer", label: "Answer", arasaacId: nil, sfSymbol: "bolt", isEmergency: false),
            WatchPhrase(id: "cw-show", label: "Show", arasaacId: nil, sfSymbol: "bolt", isEmergency: false),
            WatchPhrase(id: "cw-hide", label: "Hide", arasaacId: nil, sfSymbol: "bolt", isEmergency: false),
            WatchPhrase(id: "cw-learn", label: "Learn", arasaacId: nil, sfSymbol: "bolt", isEmergency: false),
            WatchPhrase(id: "cw-teach", label: "Teach", arasaacId: nil, sfSymbol: "bolt", isEmergency: false),
            WatchPhrase(id: "cw-study", label: "Study", arasaacId: nil, sfSymbol: "bolt", isEmergency: false),
            WatchPhrase(id: "cw-practice", label: "Practice", arasaacId: nil, sfSymbol: "bolt", isEmergency: false),
            WatchPhrase(id: "cw-work", label: "Work", arasaacId: nil, sfSymbol: "bolt", isEmergency: false),
            WatchPhrase(id: "cw-play", label: "Play", arasaacId: nil, sfSymbol: "bolt", isEmergency: false),
            WatchPhrase(id: "cw-win", label: "Win", arasaacId: nil, sfSymbol: "bolt", isEmergency: false),
            WatchPhrase(id: "cw-try-again", label: "Try again", arasaacId: nil, sfSymbol: "bolt", isEmergency: false),
            WatchPhrase(id: "cw-hug", label: "Hug", arasaacId: nil, sfSymbol: "bolt", isEmergency: false),
            WatchPhrase(id: "cw-kiss", label: "Kiss", arasaacId: nil, sfSymbol: "bolt", isEmergency: false),
            WatchPhrase(id: "cw-pet", label: "Pet", arasaacId: nil, sfSymbol: "bolt", isEmergency: false),
            WatchPhrase(id: "cw-tickle", label: "Tickle", arasaacId: nil, sfSymbol: "bolt", isEmergency: false),
            WatchPhrase(id: "cw-wait-for-me", label: "Wait for me", arasaacId: nil, sfSymbol: "bolt", isEmergency: false),
            WatchPhrase(id: "cw-help-me", label: "Help me", arasaacId: nil, sfSymbol: "bolt", isEmergency: false),
            WatchPhrase(id: "cw-show-me", label: "Show me", arasaacId: nil, sfSymbol: "bolt", isEmergency: false),
            WatchPhrase(id: "cw-tell-me", label: "Tell me", arasaacId: nil, sfSymbol: "bolt", isEmergency: false),
            WatchPhrase(id: "cw-stop-that", label: "Stop that", arasaacId: nil, sfSymbol: "bolt", isEmergency: false),
            WatchPhrase(id: "cw-i-want-to", label: "I want to", arasaacId: nil, sfSymbol: "bolt", isEmergency: false),
            WatchPhrase(id: "cw-i-do-not-want", label: "I do not want", arasaacId: nil, sfSymbol: "bolt", isEmergency: false),
            WatchPhrase(id: "cw-let-me-try", label: "Let me try", arasaacId: nil, sfSymbol: "bolt", isEmergency: false),
            WatchPhrase(id: "cw-let-me-see", label: "Let me see", arasaacId: nil, sfSymbol: "bolt", isEmergency: false),
        ]),
        WatchCategory(id: "core-descriptors", icon: "ruler.fill", name: "More / Not / All", phrases: [
            WatchPhrase(id: "cw-more", label: "More", arasaacId: nil, sfSymbol: "arrow.up.and.down", isEmergency: false),
            WatchPhrase(id: "cw-not", label: "Not", arasaacId: nil, sfSymbol: "arrow.up.and.down", isEmergency: false),
            WatchPhrase(id: "cw-no-core", label: "No", arasaacId: nil, sfSymbol: "arrow.up.and.down", isEmergency: false),
            WatchPhrase(id: "cw-yes-core", label: "Yes", arasaacId: nil, sfSymbol: "arrow.up.and.down", isEmergency: false),
            WatchPhrase(id: "cw-all", label: "All", arasaacId: nil, sfSymbol: "arrow.up.and.down", isEmergency: false),
            WatchPhrase(id: "cw-some", label: "Some", arasaacId: nil, sfSymbol: "arrow.up.and.down", isEmergency: false),
            WatchPhrase(id: "cw-other", label: "Other", arasaacId: nil, sfSymbol: "arrow.up.and.down", isEmergency: false),
            WatchPhrase(id: "cw-very", label: "Very", arasaacId: nil, sfSymbol: "arrow.up.and.down", isEmergency: false),
            WatchPhrase(id: "cw-here", label: "Here", arasaacId: nil, sfSymbol: "arrow.up.and.down", isEmergency: false),
            WatchPhrase(id: "cw-there", label: "There", arasaacId: nil, sfSymbol: "arrow.up.and.down", isEmergency: false),
            WatchPhrase(id: "cw-up", label: "Up", arasaacId: nil, sfSymbol: "arrow.up.and.down", isEmergency: false),
            WatchPhrase(id: "cw-down", label: "Down", arasaacId: nil, sfSymbol: "arrow.up.and.down", isEmergency: false),
            WatchPhrase(id: "cw-in", label: "In", arasaacId: nil, sfSymbol: "arrow.up.and.down", isEmergency: false),
            WatchPhrase(id: "cw-out", label: "Out", arasaacId: nil, sfSymbol: "arrow.up.and.down", isEmergency: false),
            WatchPhrase(id: "cw-on", label: "On", arasaacId: nil, sfSymbol: "arrow.up.and.down", isEmergency: false),
            WatchPhrase(id: "cw-off", label: "Off", arasaacId: nil, sfSymbol: "arrow.up.and.down", isEmergency: false),
            WatchPhrase(id: "cw-done", label: "Done", arasaacId: nil, sfSymbol: "arrow.up.and.down", isEmergency: false),
            WatchPhrase(id: "cw-again", label: "Again", arasaacId: nil, sfSymbol: "arrow.up.and.down", isEmergency: false),
            WatchPhrase(id: "cw-too", label: "Too", arasaacId: nil, sfSymbol: "arrow.up.and.down", isEmergency: false),
            WatchPhrase(id: "cw-same-core", label: "Same", arasaacId: nil, sfSymbol: "arrow.up.and.down", isEmergency: false),
            WatchPhrase(id: "cw-little", label: "Little", arasaacId: nil, sfSymbol: "arrow.up.and.down", isEmergency: false),
            WatchPhrase(id: "cw-lots", label: "Lots", arasaacId: nil, sfSymbol: "arrow.up.and.down", isEmergency: false),
            WatchPhrase(id: "cw-many", label: "Many", arasaacId: nil, sfSymbol: "arrow.up.and.down", isEmergency: false),
            WatchPhrase(id: "cw-few", label: "Few", arasaacId: nil, sfSymbol: "arrow.up.and.down", isEmergency: false),
            WatchPhrase(id: "cw-every", label: "Every", arasaacId: nil, sfSymbol: "arrow.up.and.down", isEmergency: false),
            WatchPhrase(id: "cw-any", label: "Any", arasaacId: nil, sfSymbol: "arrow.up.and.down", isEmergency: false),
            WatchPhrase(id: "cw-only", label: "Only", arasaacId: nil, sfSymbol: "arrow.up.and.down", isEmergency: false),
            WatchPhrase(id: "cw-just", label: "Just", arasaacId: nil, sfSymbol: "arrow.up.and.down", isEmergency: false),
            WatchPhrase(id: "cw-full", label: "Full", arasaacId: nil, sfSymbol: "arrow.up.and.down", isEmergency: false),
            WatchPhrase(id: "cw-empty", label: "Empty", arasaacId: nil, sfSymbol: "arrow.up.and.down", isEmergency: false),
            WatchPhrase(id: "cw-open-2", label: "Open", arasaacId: nil, sfSymbol: "arrow.up.and.down", isEmergency: false),
            WatchPhrase(id: "cw-closed", label: "Closed", arasaacId: nil, sfSymbol: "arrow.up.and.down", isEmergency: false),
            WatchPhrase(id: "cw-easy", label: "Easy", arasaacId: nil, sfSymbol: "arrow.up.and.down", isEmergency: false),
            WatchPhrase(id: "cw-hard", label: "Hard", arasaacId: nil, sfSymbol: "arrow.up.and.down", isEmergency: false),
            WatchPhrase(id: "cw-soft", label: "Soft", arasaacId: nil, sfSymbol: "arrow.up.and.down", isEmergency: false),
            WatchPhrase(id: "cw-loud", label: "Loud", arasaacId: nil, sfSymbol: "arrow.up.and.down", isEmergency: false),
            WatchPhrase(id: "cw-quiet", label: "Quiet", arasaacId: nil, sfSymbol: "arrow.up.and.down", isEmergency: false),
            WatchPhrase(id: "cw-bright", label: "Bright", arasaacId: nil, sfSymbol: "arrow.up.and.down", isEmergency: false),
            WatchPhrase(id: "cw-dark", label: "Dark", arasaacId: nil, sfSymbol: "arrow.up.and.down", isEmergency: false),
            WatchPhrase(id: "cw-heavy", label: "Heavy", arasaacId: nil, sfSymbol: "arrow.up.and.down", isEmergency: false),
            WatchPhrase(id: "cw-light", label: "Light", arasaacId: nil, sfSymbol: "arrow.up.and.down", isEmergency: false),
            WatchPhrase(id: "cw-above", label: "Above", arasaacId: nil, sfSymbol: "arrow.up.and.down", isEmergency: false),
            WatchPhrase(id: "cw-below", label: "Below", arasaacId: nil, sfSymbol: "arrow.up.and.down", isEmergency: false),
            WatchPhrase(id: "cw-beside", label: "Beside", arasaacId: nil, sfSymbol: "arrow.up.and.down", isEmergency: false),
            WatchPhrase(id: "cw-between", label: "Between", arasaacId: nil, sfSymbol: "arrow.up.and.down", isEmergency: false),
            WatchPhrase(id: "cw-near", label: "Near", arasaacId: nil, sfSymbol: "arrow.up.and.down", isEmergency: false),
            WatchPhrase(id: "cw-far", label: "Far", arasaacId: nil, sfSymbol: "arrow.up.and.down", isEmergency: false),
            WatchPhrase(id: "cw-around", label: "Around", arasaacId: nil, sfSymbol: "arrow.up.and.down", isEmergency: false),
            WatchPhrase(id: "cw-through", label: "Through", arasaacId: nil, sfSymbol: "arrow.up.and.down", isEmergency: false),
            WatchPhrase(id: "cw-over", label: "Over", arasaacId: nil, sfSymbol: "arrow.up.and.down", isEmergency: false),
            WatchPhrase(id: "cw-under", label: "Under", arasaacId: nil, sfSymbol: "arrow.up.and.down", isEmergency: false),
            WatchPhrase(id: "cw-across", label: "Across", arasaacId: nil, sfSymbol: "arrow.up.and.down", isEmergency: false),
            WatchPhrase(id: "cw-behind", label: "Behind", arasaacId: nil, sfSymbol: "arrow.up.and.down", isEmergency: false),
            WatchPhrase(id: "cw-ahead", label: "Ahead", arasaacId: nil, sfSymbol: "arrow.up.and.down", isEmergency: false),
            WatchPhrase(id: "cw-always", label: "Always", arasaacId: nil, sfSymbol: "arrow.up.and.down", isEmergency: false),
            WatchPhrase(id: "cw-never", label: "Never", arasaacId: nil, sfSymbol: "arrow.up.and.down", isEmergency: false),
            WatchPhrase(id: "cw-often", label: "Often", arasaacId: nil, sfSymbol: "arrow.up.and.down", isEmergency: false),
            WatchPhrase(id: "cw-sometimes", label: "Sometimes", arasaacId: nil, sfSymbol: "arrow.up.and.down", isEmergency: false),
            WatchPhrase(id: "cw-maybe", label: "Maybe", arasaacId: nil, sfSymbol: "arrow.up.and.down", isEmergency: false),
            WatchPhrase(id: "cw-almost", label: "Almost", arasaacId: nil, sfSymbol: "arrow.up.and.down", isEmergency: false),
            WatchPhrase(id: "cw-already", label: "Already", arasaacId: nil, sfSymbol: "arrow.up.and.down", isEmergency: false),
            WatchPhrase(id: "cw-still", label: "Still", arasaacId: nil, sfSymbol: "arrow.up.and.down", isEmergency: false),
            WatchPhrase(id: "cw-yet", label: "Yet", arasaacId: nil, sfSymbol: "arrow.up.and.down", isEmergency: false),
            WatchPhrase(id: "cw-right-now", label: "Right now", arasaacId: nil, sfSymbol: "arrow.up.and.down", isEmergency: false),
            WatchPhrase(id: "cw-right-here", label: "Right here", arasaacId: nil, sfSymbol: "arrow.up.and.down", isEmergency: false),
            WatchPhrase(id: "cw-way-too-much", label: "Way too much", arasaacId: nil, sfSymbol: "arrow.up.and.down", isEmergency: false),
            WatchPhrase(id: "cw-not-enough", label: "Not enough", arasaacId: nil, sfSymbol: "arrow.up.and.down", isEmergency: false),
        ]),
        WatchCategory(id: "core-little-words", icon: "link", name: "Little Words", phrases: [
            WatchPhrase(id: "cw-is", label: "Is", arasaacId: nil, sfSymbol: "textformat", isEmergency: false),
            WatchPhrase(id: "cw-the", label: "The", arasaacId: nil, sfSymbol: "textformat", isEmergency: false),
            WatchPhrase(id: "cw-a", label: "A", arasaacId: nil, sfSymbol: "textformat", isEmergency: false),
            WatchPhrase(id: "cw-and", label: "And", arasaacId: nil, sfSymbol: "textformat", isEmergency: false),
            WatchPhrase(id: "cw-but", label: "But", arasaacId: nil, sfSymbol: "textformat", isEmergency: false),
            WatchPhrase(id: "cw-or", label: "Or", arasaacId: nil, sfSymbol: "textformat", isEmergency: false),
            WatchPhrase(id: "cw-to", label: "To", arasaacId: nil, sfSymbol: "textformat", isEmergency: false),
            WatchPhrase(id: "cw-for", label: "For", arasaacId: nil, sfSymbol: "textformat", isEmergency: false),
            WatchPhrase(id: "cw-with", label: "With", arasaacId: nil, sfSymbol: "textformat", isEmergency: false),
            WatchPhrase(id: "cw-at", label: "At", arasaacId: nil, sfSymbol: "textformat", isEmergency: false),
            WatchPhrase(id: "cw-of", label: "Of", arasaacId: nil, sfSymbol: "textformat", isEmergency: false),
            WatchPhrase(id: "cw-about", label: "About", arasaacId: nil, sfSymbol: "textformat", isEmergency: false),
            WatchPhrase(id: "cw-because", label: "Because", arasaacId: nil, sfSymbol: "textformat", isEmergency: false),
            WatchPhrase(id: "cw-if", label: "If", arasaacId: nil, sfSymbol: "textformat", isEmergency: false),
            WatchPhrase(id: "cw-when-core", label: "When", arasaacId: nil, sfSymbol: "textformat", isEmergency: false),
            WatchPhrase(id: "cw-where-core", label: "Where", arasaacId: nil, sfSymbol: "textformat", isEmergency: false),
            WatchPhrase(id: "cw-by", label: "By", arasaacId: nil, sfSymbol: "textformat", isEmergency: false),
            WatchPhrase(id: "cw-from", label: "From", arasaacId: nil, sfSymbol: "textformat", isEmergency: false),
            WatchPhrase(id: "cw-since", label: "Since", arasaacId: nil, sfSymbol: "textformat", isEmergency: false),
            WatchPhrase(id: "cw-until", label: "Until", arasaacId: nil, sfSymbol: "textformat", isEmergency: false),
            WatchPhrase(id: "cw-into", label: "Into", arasaacId: nil, sfSymbol: "textformat", isEmergency: false),
            WatchPhrase(id: "cw-onto", label: "Onto", arasaacId: nil, sfSymbol: "textformat", isEmergency: false),
            WatchPhrase(id: "cw-off-of", label: "Off of", arasaacId: nil, sfSymbol: "textformat", isEmergency: false),
            WatchPhrase(id: "cw-away", label: "Away", arasaacId: nil, sfSymbol: "textformat", isEmergency: false),
            WatchPhrase(id: "cw-back", label: "Back", arasaacId: nil, sfSymbol: "textformat", isEmergency: false),
            WatchPhrase(id: "cw-beside-2", label: "Beside", arasaacId: nil, sfSymbol: "textformat", isEmergency: false),
            WatchPhrase(id: "cw-past", label: "Past", arasaacId: nil, sfSymbol: "textformat", isEmergency: false),
            WatchPhrase(id: "cw-among", label: "Among", arasaacId: nil, sfSymbol: "textformat", isEmergency: false),
            WatchPhrase(id: "cw-during", label: "During", arasaacId: nil, sfSymbol: "textformat", isEmergency: false),
            WatchPhrase(id: "cw-while", label: "While", arasaacId: nil, sfSymbol: "textformat", isEmergency: false),
            WatchPhrase(id: "cw-whenever", label: "Whenever", arasaacId: nil, sfSymbol: "textformat", isEmergency: false),
            WatchPhrase(id: "cw-wherever", label: "Wherever", arasaacId: nil, sfSymbol: "textformat", isEmergency: false),
            WatchPhrase(id: "cw-both", label: "Both", arasaacId: nil, sfSymbol: "textformat", isEmergency: false),
            WatchPhrase(id: "cw-either", label: "Either", arasaacId: nil, sfSymbol: "textformat", isEmergency: false),
            WatchPhrase(id: "cw-neither", label: "Neither", arasaacId: nil, sfSymbol: "textformat", isEmergency: false),
            WatchPhrase(id: "cw-whether", label: "Whether", arasaacId: nil, sfSymbol: "textformat", isEmergency: false),
            WatchPhrase(id: "cw-although", label: "Although", arasaacId: nil, sfSymbol: "textformat", isEmergency: false),
            WatchPhrase(id: "cw-though", label: "Though", arasaacId: nil, sfSymbol: "textformat", isEmergency: false),
            WatchPhrase(id: "cw-unless", label: "Unless", arasaacId: nil, sfSymbol: "textformat", isEmergency: false),
            WatchPhrase(id: "cw-so", label: "So", arasaacId: nil, sfSymbol: "textformat", isEmergency: false),
            WatchPhrase(id: "cw-then", label: "Then", arasaacId: nil, sfSymbol: "textformat", isEmergency: false),
            WatchPhrase(id: "cw-also", label: "Also", arasaacId: nil, sfSymbol: "textformat", isEmergency: false),
            WatchPhrase(id: "cw-plus", label: "Plus", arasaacId: nil, sfSymbol: "textformat", isEmergency: false),
            WatchPhrase(id: "cw-like-2", label: "Like", arasaacId: nil, sfSymbol: "textformat", isEmergency: false),
            WatchPhrase(id: "cw-as", label: "As", arasaacId: nil, sfSymbol: "textformat", isEmergency: false),
            WatchPhrase(id: "cw-such-as", label: "Such as", arasaacId: nil, sfSymbol: "textformat", isEmergency: false),
            WatchPhrase(id: "cw-versus", label: "Versus", arasaacId: nil, sfSymbol: "textformat", isEmergency: false),
            WatchPhrase(id: "cw-since-then", label: "Since then", arasaacId: nil, sfSymbol: "textformat", isEmergency: false),
            WatchPhrase(id: "cw-until-now", label: "Until now", arasaacId: nil, sfSymbol: "textformat", isEmergency: false),
            WatchPhrase(id: "cw-right-after", label: "Right after", arasaacId: nil, sfSymbol: "textformat", isEmergency: false),
            WatchPhrase(id: "cw-just-before", label: "Just before", arasaacId: nil, sfSymbol: "textformat", isEmergency: false),
            WatchPhrase(id: "cw-up-to", label: "Up to", arasaacId: nil, sfSymbol: "textformat", isEmergency: false),
            WatchPhrase(id: "cw-down-to", label: "Down to", arasaacId: nil, sfSymbol: "textformat", isEmergency: false),
            WatchPhrase(id: "cw-next-to", label: "Next to", arasaacId: nil, sfSymbol: "textformat", isEmergency: false),
            WatchPhrase(id: "cw-out-of", label: "Out of", arasaacId: nil, sfSymbol: "textformat", isEmergency: false),
            WatchPhrase(id: "cw-a-few", label: "A few", arasaacId: nil, sfSymbol: "textformat", isEmergency: false),
            WatchPhrase(id: "cw-a-lot", label: "A lot", arasaacId: nil, sfSymbol: "textformat", isEmergency: false),
            WatchPhrase(id: "cw-a-little", label: "A little", arasaacId: nil, sfSymbol: "textformat", isEmergency: false),
        ]),
        WatchCategory(id: "help-needs", icon: "sos", name: "Help / Needs", phrases: [
            WatchPhrase(id: "help-all-done", label: "All done", arasaacId: nil, sfSymbol: "exclamationmark.triangle", isEmergency: false),
            WatchPhrase(id: "help-break", label: "Take a break", arasaacId: nil, sfSymbol: "exclamationmark.triangle", isEmergency: false),
            WatchPhrase(id: "help-need-help", label: "I need help", arasaacId: nil, sfSymbol: "exclamationmark.triangle", isEmergency: true),
            WatchPhrase(id: "help-hungry", label: "I am hungry", arasaacId: nil, sfSymbol: "exclamationmark.triangle", isEmergency: false),
            WatchPhrase(id: "help-thirsty", label: "I am thirsty", arasaacId: nil, sfSymbol: "exclamationmark.triangle", isEmergency: false),
            WatchPhrase(id: "help-bathroom", label: "Bathroom", arasaacId: nil, sfSymbol: "exclamationmark.triangle", isEmergency: false),
            WatchPhrase(id: "help-yes", label: "Yes", arasaacId: nil, sfSymbol: "exclamationmark.triangle", isEmergency: false),
            WatchPhrase(id: "help-no", label: "No", arasaacId: nil, sfSymbol: "exclamationmark.triangle", isEmergency: false),
            WatchPhrase(id: "help-stop", label: "Stop", arasaacId: nil, sfSymbol: "exclamationmark.triangle", isEmergency: false),
            WatchPhrase(id: "help-more", label: "More", arasaacId: nil, sfSymbol: "exclamationmark.triangle", isEmergency: false),
            WatchPhrase(id: "help-want", label: "I want", arasaacId: nil, sfSymbol: "exclamationmark.triangle", isEmergency: false),
            WatchPhrase(id: "help-hurts", label: "It hurts", arasaacId: nil, sfSymbol: "exclamationmark.triangle", isEmergency: false),
            WatchPhrase(id: "help-tired", label: "I am tired", arasaacId: nil, sfSymbol: "exclamationmark.triangle", isEmergency: false),
            WatchPhrase(id: "help-i-am-cold", label: "I am cold", arasaacId: nil, sfSymbol: "exclamationmark.triangle", isEmergency: false),
            WatchPhrase(id: "help-i-am-hot", label: "I am hot", arasaacId: nil, sfSymbol: "exclamationmark.triangle", isEmergency: false),
            WatchPhrase(id: "help-i-am-sleepy", label: "I am sleepy", arasaacId: nil, sfSymbol: "exclamationmark.triangle", isEmergency: false),
            WatchPhrase(id: "help-i-am-scared", label: "I am scared", arasaacId: nil, sfSymbol: "exclamationmark.triangle", isEmergency: false),
            WatchPhrase(id: "help-i-am-sick", label: "I am sick", arasaacId: nil, sfSymbol: "exclamationmark.triangle", isEmergency: false),
            WatchPhrase(id: "help-i-am-okay", label: "I am okay", arasaacId: nil, sfSymbol: "exclamationmark.triangle", isEmergency: false),
            WatchPhrase(id: "help-i-am-not-okay", label: "I am not okay", arasaacId: nil, sfSymbol: "exclamationmark.triangle", isEmergency: false),
            WatchPhrase(id: "help-i-am-ready", label: "I am ready", arasaacId: nil, sfSymbol: "exclamationmark.triangle", isEmergency: false),
            WatchPhrase(id: "help-i-am-not-ready", label: "I am not ready", arasaacId: nil, sfSymbol: "exclamationmark.triangle", isEmergency: false),
            WatchPhrase(id: "help-too-loud", label: "Too loud", arasaacId: nil, sfSymbol: "exclamationmark.triangle", isEmergency: false),
            WatchPhrase(id: "help-too-bright", label: "Too bright", arasaacId: nil, sfSymbol: "exclamationmark.triangle", isEmergency: false),
            WatchPhrase(id: "help-too-fast", label: "Too fast", arasaacId: nil, sfSymbol: "exclamationmark.triangle", isEmergency: false),
            WatchPhrase(id: "help-too-slow", label: "Too slow", arasaacId: nil, sfSymbol: "exclamationmark.triangle", isEmergency: false),
            WatchPhrase(id: "help-i-need-quiet", label: "I need quiet", arasaacId: nil, sfSymbol: "exclamationmark.triangle", isEmergency: false),
            WatchPhrase(id: "help-i-need-a-break", label: "I need a break", arasaacId: nil, sfSymbol: "exclamationmark.triangle", isEmergency: false),
            WatchPhrase(id: "help-i-need-water", label: "I need water", arasaacId: nil, sfSymbol: "exclamationmark.triangle", isEmergency: false),
            WatchPhrase(id: "help-i-need-air", label: "I need air", arasaacId: nil, sfSymbol: "exclamationmark.triangle", isEmergency: false),
            WatchPhrase(id: "help-i-need-my-mom", label: "I need my mom", arasaacId: nil, sfSymbol: "exclamationmark.triangle", isEmergency: false),
            WatchPhrase(id: "help-i-need-my-dad", label: "I need my dad", arasaacId: nil, sfSymbol: "exclamationmark.triangle", isEmergency: false),
            WatchPhrase(id: "help-i-need-my-teacher", label: "I need my teacher", arasaacId: nil, sfSymbol: "exclamationmark.triangle", isEmergency: false),
            WatchPhrase(id: "help-i-need-a-hug", label: "I need a hug", arasaacId: nil, sfSymbol: "exclamationmark.triangle", isEmergency: false),
            WatchPhrase(id: "help-i-need-space", label: "I need space", arasaacId: nil, sfSymbol: "exclamationmark.triangle", isEmergency: false),
            WatchPhrase(id: "help-i-need-time", label: "I need time", arasaacId: nil, sfSymbol: "exclamationmark.triangle", isEmergency: false),
            WatchPhrase(id: "help-hold-my-hand", label: "Hold my hand", arasaacId: nil, sfSymbol: "exclamationmark.triangle", isEmergency: false),
            WatchPhrase(id: "help-watch-me", label: "Watch me", arasaacId: nil, sfSymbol: "exclamationmark.triangle", isEmergency: false),
            WatchPhrase(id: "help-listen-to-me", label: "Listen to me", arasaacId: nil, sfSymbol: "exclamationmark.triangle", isEmergency: false),
            WatchPhrase(id: "help-look-at-this", label: "Look at this", arasaacId: nil, sfSymbol: "exclamationmark.triangle", isEmergency: false),
            WatchPhrase(id: "help-help-me-please", label: "Help me please", arasaacId: nil, sfSymbol: "exclamationmark.triangle", isEmergency: false),
            WatchPhrase(id: "help-help-with-this", label: "Help with this", arasaacId: nil, sfSymbol: "exclamationmark.triangle", isEmergency: false),
            WatchPhrase(id: "help-wait-for-me", label: "Wait for me", arasaacId: nil, sfSymbol: "exclamationmark.triangle", isEmergency: false),
            WatchPhrase(id: "help-slow-down-please", label: "Slow down please", arasaacId: nil, sfSymbol: "exclamationmark.triangle", isEmergency: false),
            WatchPhrase(id: "help-speak-more-slowly", label: "Speak more slowly", arasaacId: nil, sfSymbol: "exclamationmark.triangle", isEmergency: false),
            WatchPhrase(id: "help-one-at-a-time", label: "One at a time", arasaacId: nil, sfSymbol: "exclamationmark.triangle", isEmergency: false),
            WatchPhrase(id: "help-i-am-overwhelmed", label: "I am overwhelmed", arasaacId: nil, sfSymbol: "exclamationmark.triangle", isEmergency: false),
            WatchPhrase(id: "help-i-am-confused", label: "I am confused", arasaacId: nil, sfSymbol: "exclamationmark.triangle", isEmergency: false),
            WatchPhrase(id: "help-i-do-not-understand", label: "I do not understand", arasaacId: nil, sfSymbol: "exclamationmark.triangle", isEmergency: false),
            WatchPhrase(id: "help-please-be-patient", label: "Please be patient", arasaacId: nil, sfSymbol: "exclamationmark.triangle", isEmergency: false),
            WatchPhrase(id: "help-give-me-a-minute", label: "Give me a minute", arasaacId: nil, sfSymbol: "exclamationmark.triangle", isEmergency: false),
            WatchPhrase(id: "help-try-again", label: "Try again", arasaacId: nil, sfSymbol: "exclamationmark.triangle", isEmergency: false),
            WatchPhrase(id: "help-calm-down", label: "Calm down", arasaacId: nil, sfSymbol: "exclamationmark.triangle", isEmergency: false),
            WatchPhrase(id: "help-let-me-think", label: "Let me think", arasaacId: nil, sfSymbol: "exclamationmark.triangle", isEmergency: false),
            WatchPhrase(id: "help-show-me-how", label: "Show me how", arasaacId: nil, sfSymbol: "exclamationmark.triangle", isEmergency: false),
            WatchPhrase(id: "help-i-do-not-feel-good", label: "I do not feel good", arasaacId: nil, sfSymbol: "exclamationmark.triangle", isEmergency: false),
            WatchPhrase(id: "help-my-head-hurts", label: "My head hurts", arasaacId: nil, sfSymbol: "exclamationmark.triangle", isEmergency: false),
            WatchPhrase(id: "help-my-tummy-hurts", label: "My tummy hurts", arasaacId: nil, sfSymbol: "exclamationmark.triangle", isEmergency: false),
            WatchPhrase(id: "help-my-ears-hurt", label: "My ears hurt", arasaacId: nil, sfSymbol: "exclamationmark.triangle", isEmergency: false),
            WatchPhrase(id: "help-my-eyes-hurt", label: "My eyes hurt", arasaacId: nil, sfSymbol: "exclamationmark.triangle", isEmergency: false),
            WatchPhrase(id: "help-i-feel-dizzy", label: "I feel dizzy", arasaacId: nil, sfSymbol: "exclamationmark.triangle", isEmergency: false),
            WatchPhrase(id: "help-get-help", label: "Get help", arasaacId: nil, sfSymbol: "exclamationmark.triangle", isEmergency: false),
            WatchPhrase(id: "help-call-my-mom", label: "Call my mom", arasaacId: nil, sfSymbol: "exclamationmark.triangle", isEmergency: false),
            WatchPhrase(id: "help-call-my-dad", label: "Call my dad", arasaacId: nil, sfSymbol: "exclamationmark.triangle", isEmergency: false),
            WatchPhrase(id: "help-call-the-nurse", label: "Call the nurse", arasaacId: nil, sfSymbol: "exclamationmark.triangle", isEmergency: false),
            WatchPhrase(id: "help-where-is-my-aac", label: "Where is my AAC", arasaacId: nil, sfSymbol: "exclamationmark.triangle", isEmergency: false),
            WatchPhrase(id: "help-my-battery-is-low", label: "My battery is low", arasaacId: nil, sfSymbol: "exclamationmark.triangle", isEmergency: false),
            WatchPhrase(id: "help-i-dropped-my-tablet", label: "I dropped my tablet", arasaacId: nil, sfSymbol: "exclamationmark.triangle", isEmergency: false),
        ]),
        WatchCategory(id: "quick-talk", icon: "bubble.left.and.bubble.right.fill", name: "Quick Talk", phrases: [
            WatchPhrase(id: "qt-hello", label: "Hello", arasaacId: nil, sfSymbol: "bubble.left", isEmergency: false),
            WatchPhrase(id: "qt-goodbye", label: "Goodbye", arasaacId: nil, sfSymbol: "bubble.left", isEmergency: false),
            WatchPhrase(id: "qt-thank-you", label: "Thank you", arasaacId: nil, sfSymbol: "bubble.left", isEmergency: false),
            WatchPhrase(id: "qt-please", label: "Please", arasaacId: nil, sfSymbol: "bubble.left", isEmergency: false),
            WatchPhrase(id: "qt-excuse-me", label: "Excuse me", arasaacId: nil, sfSymbol: "bubble.left", isEmergency: false),
            WatchPhrase(id: "qt-wait", label: "Wait", arasaacId: nil, sfSymbol: "bubble.left", isEmergency: false),
            WatchPhrase(id: "qt-come-here", label: "Come here", arasaacId: nil, sfSymbol: "bubble.left", isEmergency: false),
            WatchPhrase(id: "qt-how-are-you", label: "How are you?", arasaacId: nil, sfSymbol: "bubble.left", isEmergency: false),
            WatchPhrase(id: "qt-sorry", label: "Sorry", arasaacId: nil, sfSymbol: "bubble.left", isEmergency: false),
            WatchPhrase(id: "qt-my-name", label: "My name is", arasaacId: nil, sfSymbol: "bubble.left", isEmergency: false),
            WatchPhrase(id: "qt-nice-meet", label: "Nice to meet you", arasaacId: nil, sfSymbol: "bubble.left", isEmergency: false),
            WatchPhrase(id: "qt-see-later", label: "See you later", arasaacId: nil, sfSymbol: "bubble.left", isEmergency: false),
            WatchPhrase(id: "qt-hi", label: "Hi", arasaacId: nil, sfSymbol: "bubble.left", isEmergency: false),
            WatchPhrase(id: "qt-hey", label: "Hey", arasaacId: nil, sfSymbol: "bubble.left", isEmergency: false),
            WatchPhrase(id: "qt-bye", label: "Bye", arasaacId: nil, sfSymbol: "bubble.left", isEmergency: false),
            WatchPhrase(id: "qt-bye-bye", label: "Bye-bye", arasaacId: nil, sfSymbol: "bubble.left", isEmergency: false),
            WatchPhrase(id: "qt-see-you", label: "See you", arasaacId: nil, sfSymbol: "bubble.left", isEmergency: false),
            WatchPhrase(id: "qt-see-you-soon", label: "See you soon", arasaacId: nil, sfSymbol: "bubble.left", isEmergency: false),
            WatchPhrase(id: "qt-see-you-tomorrow", label: "See you tomorrow", arasaacId: nil, sfSymbol: "bubble.left", isEmergency: false),
            WatchPhrase(id: "qt-take-care", label: "Take care", arasaacId: nil, sfSymbol: "bubble.left", isEmergency: false),
            WatchPhrase(id: "qt-have-fun", label: "Have fun", arasaacId: nil, sfSymbol: "bubble.left", isEmergency: false),
            WatchPhrase(id: "qt-good-morning", label: "Good morning", arasaacId: nil, sfSymbol: "bubble.left", isEmergency: false),
            WatchPhrase(id: "qt-good-afternoon", label: "Good afternoon", arasaacId: nil, sfSymbol: "bubble.left", isEmergency: false),
            WatchPhrase(id: "qt-good-evening", label: "Good evening", arasaacId: nil, sfSymbol: "bubble.left", isEmergency: false),
            WatchPhrase(id: "qt-good-night", label: "Good night", arasaacId: nil, sfSymbol: "bubble.left", isEmergency: false),
            WatchPhrase(id: "qt-good-job", label: "Good job", arasaacId: nil, sfSymbol: "bubble.left", isEmergency: false),
            WatchPhrase(id: "qt-well-done", label: "Well done", arasaacId: nil, sfSymbol: "bubble.left", isEmergency: false),
            WatchPhrase(id: "qt-way-to-go", label: "Way to go", arasaacId: nil, sfSymbol: "bubble.left", isEmergency: false),
            WatchPhrase(id: "qt-awesome", label: "Awesome", arasaacId: nil, sfSymbol: "bubble.left", isEmergency: false),
            WatchPhrase(id: "qt-cool", label: "Cool", arasaacId: nil, sfSymbol: "bubble.left", isEmergency: false),
            WatchPhrase(id: "qt-nice", label: "Nice", arasaacId: nil, sfSymbol: "bubble.left", isEmergency: false),
            WatchPhrase(id: "qt-great", label: "Great", arasaacId: nil, sfSymbol: "bubble.left", isEmergency: false),
            WatchPhrase(id: "qt-wonderful", label: "Wonderful", arasaacId: nil, sfSymbol: "bubble.left", isEmergency: false),
            WatchPhrase(id: "qt-amazing", label: "Amazing", arasaacId: nil, sfSymbol: "bubble.left", isEmergency: false),
            WatchPhrase(id: "qt-perfect", label: "Perfect", arasaacId: nil, sfSymbol: "bubble.left", isEmergency: false),
            WatchPhrase(id: "qt-yay", label: "Yay", arasaacId: nil, sfSymbol: "bubble.left", isEmergency: false),
            WatchPhrase(id: "qt-okay", label: "Okay", arasaacId: nil, sfSymbol: "bubble.left", isEmergency: false),
            WatchPhrase(id: "qt-alright", label: "Alright", arasaacId: nil, sfSymbol: "bubble.left", isEmergency: false),
            WatchPhrase(id: "qt-sure", label: "Sure", arasaacId: nil, sfSymbol: "bubble.left", isEmergency: false),
            WatchPhrase(id: "qt-of-course", label: "Of course", arasaacId: nil, sfSymbol: "bubble.left", isEmergency: false),
            WatchPhrase(id: "qt-definitely", label: "Definitely", arasaacId: nil, sfSymbol: "bubble.left", isEmergency: false),
            WatchPhrase(id: "qt-maybe", label: "Maybe", arasaacId: nil, sfSymbol: "bubble.left", isEmergency: false),
            WatchPhrase(id: "qt-i-think-so", label: "I think so", arasaacId: nil, sfSymbol: "bubble.left", isEmergency: false),
            WatchPhrase(id: "qt-i-am-not-sure", label: "I am not sure", arasaacId: nil, sfSymbol: "bubble.left", isEmergency: false),
            WatchPhrase(id: "qt-it-is-fine", label: "It is fine", arasaacId: nil, sfSymbol: "bubble.left", isEmergency: false),
            WatchPhrase(id: "qt-no-problem", label: "No problem", arasaacId: nil, sfSymbol: "bubble.left", isEmergency: false),
            WatchPhrase(id: "qt-no-worries", label: "No worries", arasaacId: nil, sfSymbol: "bubble.left", isEmergency: false),
            WatchPhrase(id: "qt-never-mind", label: "Never mind", arasaacId: nil, sfSymbol: "bubble.left", isEmergency: false),
            WatchPhrase(id: "qt-my-bad", label: "My bad", arasaacId: nil, sfSymbol: "bubble.left", isEmergency: false),
            WatchPhrase(id: "qt-oops", label: "Oops", arasaacId: nil, sfSymbol: "bubble.left", isEmergency: false),
            WatchPhrase(id: "qt-bless-you", label: "Bless you", arasaacId: nil, sfSymbol: "bubble.left", isEmergency: false),
            WatchPhrase(id: "qt-happy-birthday", label: "Happy birthday", arasaacId: nil, sfSymbol: "bubble.left", isEmergency: false),
            WatchPhrase(id: "qt-happy-holidays", label: "Happy holidays", arasaacId: nil, sfSymbol: "bubble.left", isEmergency: false),
            WatchPhrase(id: "qt-merry-christmas", label: "Merry Christmas", arasaacId: nil, sfSymbol: "bubble.left", isEmergency: false),
            WatchPhrase(id: "qt-happy-new-year", label: "Happy New Year", arasaacId: nil, sfSymbol: "bubble.left", isEmergency: false),
            WatchPhrase(id: "qt-eid-mubarak", label: "Eid Mubarak", arasaacId: nil, sfSymbol: "bubble.left", isEmergency: false),
            WatchPhrase(id: "qt-happy-hanukkah", label: "Happy Hanukkah", arasaacId: nil, sfSymbol: "bubble.left", isEmergency: false),
            WatchPhrase(id: "qt-congratulations", label: "Congratulations", arasaacId: nil, sfSymbol: "bubble.left", isEmergency: false),
            WatchPhrase(id: "qt-i-am-proud-of-you", label: "I am proud of you", arasaacId: nil, sfSymbol: "bubble.left", isEmergency: false),
            WatchPhrase(id: "qt-you-did-it", label: "You did it", arasaacId: nil, sfSymbol: "bubble.left", isEmergency: false),
            WatchPhrase(id: "qt-how-was-your-day", label: "How was your day", arasaacId: nil, sfSymbol: "bubble.left", isEmergency: false),
            WatchPhrase(id: "qt-i-had-a-good-day", label: "I had a good day", arasaacId: nil, sfSymbol: "bubble.left", isEmergency: false),
            WatchPhrase(id: "qt-i-had-a-bad-day", label: "I had a bad day", arasaacId: nil, sfSymbol: "bubble.left", isEmergency: false),
            WatchPhrase(id: "qt-tell-me-about-your-day", label: "Tell me about your day", arasaacId: nil, sfSymbol: "bubble.left", isEmergency: false),
            WatchPhrase(id: "qt-i-missed-you", label: "I missed you", arasaacId: nil, sfSymbol: "bubble.left", isEmergency: false),
            WatchPhrase(id: "qt-i-am-here", label: "I am here", arasaacId: nil, sfSymbol: "bubble.left", isEmergency: false),
            WatchPhrase(id: "qt-i-love-you-too", label: "I love you too", arasaacId: nil, sfSymbol: "bubble.left", isEmergency: false),
            WatchPhrase(id: "qt-you-are-my-friend", label: "You are my friend", arasaacId: nil, sfSymbol: "bubble.left", isEmergency: false),
            WatchPhrase(id: "qt-best-friends", label: "Best friends", arasaacId: nil, sfSymbol: "bubble.left", isEmergency: false),
        ]),
        WatchCategory(id: "feelings", icon: "face.smiling", name: "Feelings", phrases: [
            WatchPhrase(id: "fe-happy", label: "Happy", arasaacId: nil, sfSymbol: "face.smiling", isEmergency: false),
            WatchPhrase(id: "fe-sad", label: "Sad", arasaacId: nil, sfSymbol: "face.smiling", isEmergency: false),
            WatchPhrase(id: "fe-angry", label: "Angry", arasaacId: nil, sfSymbol: "face.smiling", isEmergency: false),
            WatchPhrase(id: "fe-scared", label: "Scared", arasaacId: nil, sfSymbol: "face.smiling", isEmergency: false),
            WatchPhrase(id: "fe-excited", label: "Excited", arasaacId: nil, sfSymbol: "face.smiling", isEmergency: false),
            WatchPhrase(id: "fe-frustrated", label: "Frustrated", arasaacId: nil, sfSymbol: "face.smiling", isEmergency: false),
            WatchPhrase(id: "fe-bored", label: "Bored", arasaacId: nil, sfSymbol: "face.smiling", isEmergency: false),
            WatchPhrase(id: "fe-surprised", label: "Surprised", arasaacId: nil, sfSymbol: "face.smiling", isEmergency: false),
            WatchPhrase(id: "fe-confused", label: "Confused", arasaacId: nil, sfSymbol: "face.smiling", isEmergency: false),
            WatchPhrase(id: "fe-proud", label: "Proud", arasaacId: nil, sfSymbol: "face.smiling", isEmergency: false),
            WatchPhrase(id: "fe-nervous", label: "Nervous", arasaacId: nil, sfSymbol: "face.smiling", isEmergency: false),
            WatchPhrase(id: "fe-silly", label: "Silly", arasaacId: nil, sfSymbol: "face.smiling", isEmergency: false),
            WatchPhrase(id: "fe-love", label: "I love you", arasaacId: nil, sfSymbol: "face.smiling", isEmergency: false),
            WatchPhrase(id: "fe-hurt", label: "My feelings are hurt", arasaacId: nil, sfSymbol: "face.smiling", isEmergency: false),
            WatchPhrase(id: "fe-calm", label: "Calm", arasaacId: nil, sfSymbol: "face.smiling", isEmergency: false),
            WatchPhrase(id: "fe-peaceful", label: "Peaceful", arasaacId: nil, sfSymbol: "face.smiling", isEmergency: false),
            WatchPhrase(id: "fe-relaxed", label: "Relaxed", arasaacId: nil, sfSymbol: "face.smiling", isEmergency: false),
            WatchPhrase(id: "fe-content", label: "Content", arasaacId: nil, sfSymbol: "face.smiling", isEmergency: false),
            WatchPhrase(id: "fe-joyful", label: "Joyful", arasaacId: nil, sfSymbol: "face.smiling", isEmergency: false),
            WatchPhrase(id: "fe-glad", label: "Glad", arasaacId: nil, sfSymbol: "face.smiling", isEmergency: false),
            WatchPhrase(id: "fe-cheerful", label: "Cheerful", arasaacId: nil, sfSymbol: "face.smiling", isEmergency: false),
            WatchPhrase(id: "fe-hopeful", label: "Hopeful", arasaacId: nil, sfSymbol: "face.smiling", isEmergency: false),
            WatchPhrase(id: "fe-grateful", label: "Grateful", arasaacId: nil, sfSymbol: "face.smiling", isEmergency: false),
            WatchPhrase(id: "fe-thankful", label: "Thankful", arasaacId: nil, sfSymbol: "face.smiling", isEmergency: false),
            WatchPhrase(id: "fe-loved", label: "Loved", arasaacId: nil, sfSymbol: "face.smiling", isEmergency: false),
            WatchPhrase(id: "fe-safe", label: "Safe", arasaacId: nil, sfSymbol: "face.smiling", isEmergency: false),
            WatchPhrase(id: "fe-comfortable", label: "Comfortable", arasaacId: nil, sfSymbol: "face.smiling", isEmergency: false),
            WatchPhrase(id: "fe-warm-inside", label: "Warm inside", arasaacId: nil, sfSymbol: "face.smiling", isEmergency: false),
            WatchPhrase(id: "fe-tired", label: "Tired", arasaacId: nil, sfSymbol: "face.smiling", isEmergency: false),
            WatchPhrase(id: "fe-sleepy", label: "Sleepy", arasaacId: nil, sfSymbol: "face.smiling", isEmergency: false),
            WatchPhrase(id: "fe-hungry", label: "Hungry", arasaacId: nil, sfSymbol: "face.smiling", isEmergency: false),
            WatchPhrase(id: "fe-full", label: "Full", arasaacId: nil, sfSymbol: "face.smiling", isEmergency: false),
            WatchPhrase(id: "fe-thirsty", label: "Thirsty", arasaacId: nil, sfSymbol: "face.smiling", isEmergency: false),
            WatchPhrase(id: "fe-sick", label: "Sick", arasaacId: nil, sfSymbol: "face.smiling", isEmergency: false),
            WatchPhrase(id: "fe-lonely", label: "Lonely", arasaacId: nil, sfSymbol: "face.smiling", isEmergency: false),
            WatchPhrase(id: "fe-embarrassed", label: "Embarrassed", arasaacId: nil, sfSymbol: "face.smiling", isEmergency: false),
            WatchPhrase(id: "fe-shy", label: "Shy", arasaacId: nil, sfSymbol: "face.smiling", isEmergency: false),
            WatchPhrase(id: "fe-ashamed", label: "Ashamed", arasaacId: nil, sfSymbol: "face.smiling", isEmergency: false),
            WatchPhrase(id: "fe-guilty", label: "Guilty", arasaacId: nil, sfSymbol: "face.smiling", isEmergency: false),
            WatchPhrase(id: "fe-jealous", label: "Jealous", arasaacId: nil, sfSymbol: "face.smiling", isEmergency: false),
            WatchPhrase(id: "fe-disappointed", label: "Disappointed", arasaacId: nil, sfSymbol: "face.smiling", isEmergency: false),
            WatchPhrase(id: "fe-annoyed", label: "Annoyed", arasaacId: nil, sfSymbol: "face.smiling", isEmergency: false),
            WatchPhrase(id: "fe-anxious", label: "Anxious", arasaacId: nil, sfSymbol: "face.smiling", isEmergency: false),
            WatchPhrase(id: "fe-worried", label: "Worried", arasaacId: nil, sfSymbol: "face.smiling", isEmergency: false),
            WatchPhrase(id: "fe-stressed", label: "Stressed", arasaacId: nil, sfSymbol: "face.smiling", isEmergency: false),
            WatchPhrase(id: "fe-panicked", label: "Panicked", arasaacId: nil, sfSymbol: "face.smiling", isEmergency: false),
            WatchPhrase(id: "fe-terrified", label: "Terrified", arasaacId: nil, sfSymbol: "face.smiling", isEmergency: false),
            WatchPhrase(id: "fe-brave", label: "Brave", arasaacId: nil, sfSymbol: "face.smiling", isEmergency: false),
            WatchPhrase(id: "fe-strong", label: "Strong", arasaacId: nil, sfSymbol: "face.smiling", isEmergency: false),
            WatchPhrase(id: "fe-weak", label: "Weak", arasaacId: nil, sfSymbol: "face.smiling", isEmergency: false),
            WatchPhrase(id: "fe-dizzy", label: "Dizzy", arasaacId: nil, sfSymbol: "face.smiling", isEmergency: false),
            WatchPhrase(id: "fe-itchy", label: "Itchy", arasaacId: nil, sfSymbol: "face.smiling", isEmergency: false),
            WatchPhrase(id: "fe-ticklish", label: "Ticklish", arasaacId: nil, sfSymbol: "face.smiling", isEmergency: false),
            WatchPhrase(id: "fe-numb", label: "Numb", arasaacId: nil, sfSymbol: "face.smiling", isEmergency: false),
            WatchPhrase(id: "fe-cold-inside", label: "Cold inside", arasaacId: nil, sfSymbol: "face.smiling", isEmergency: false),
            WatchPhrase(id: "fe-empty", label: "Empty", arasaacId: nil, sfSymbol: "face.smiling", isEmergency: false),
            WatchPhrase(id: "fe-heavy-heart", label: "Heavy heart", arasaacId: nil, sfSymbol: "face.smiling", isEmergency: false),
            WatchPhrase(id: "fe-mixed-up", label: "Mixed up", arasaacId: nil, sfSymbol: "face.smiling", isEmergency: false),
            WatchPhrase(id: "fe-confused-inside", label: "Confused inside", arasaacId: nil, sfSymbol: "face.smiling", isEmergency: false),
            WatchPhrase(id: "fe-stuck", label: "Stuck", arasaacId: nil, sfSymbol: "face.smiling", isEmergency: false),
            WatchPhrase(id: "fe-missing-someone", label: "Missing someone", arasaacId: nil, sfSymbol: "face.smiling", isEmergency: false),
            WatchPhrase(id: "fe-homesick", label: "Homesick", arasaacId: nil, sfSymbol: "face.smiling", isEmergency: false),
            WatchPhrase(id: "fe-overwhelmed", label: "Overwhelmed", arasaacId: nil, sfSymbol: "face.smiling", isEmergency: false),
            WatchPhrase(id: "fe-done-with-this", label: "Done with this", arasaacId: nil, sfSymbol: "face.smiling", isEmergency: false),
            WatchPhrase(id: "fe-i-have-had-enough", label: "I have had enough", arasaacId: nil, sfSymbol: "face.smiling", isEmergency: false),
            WatchPhrase(id: "fe-i-feel-good", label: "I feel good", arasaacId: nil, sfSymbol: "face.smiling", isEmergency: false),
            WatchPhrase(id: "fe-i-feel-bad", label: "I feel bad", arasaacId: nil, sfSymbol: "face.smiling", isEmergency: false),
            WatchPhrase(id: "fe-i-feel-okay", label: "I feel okay", arasaacId: nil, sfSymbol: "face.smiling", isEmergency: false),
            WatchPhrase(id: "fe-i-feel-weird", label: "I feel weird", arasaacId: nil, sfSymbol: "face.smiling", isEmergency: false),
        ]),
        WatchCategory(id: "questions", icon: "questionmark.circle.fill", name: "Questions", phrases: [
            WatchPhrase(id: "qu-what", label: "What?", arasaacId: nil, sfSymbol: "questionmark.circle", isEmergency: false),
            WatchPhrase(id: "qu-where", label: "Where?", arasaacId: nil, sfSymbol: "questionmark.circle", isEmergency: false),
            WatchPhrase(id: "qu-when", label: "When?", arasaacId: nil, sfSymbol: "questionmark.circle", isEmergency: false),
            WatchPhrase(id: "qu-who", label: "Who?", arasaacId: nil, sfSymbol: "questionmark.circle", isEmergency: false),
            WatchPhrase(id: "qu-why", label: "Why?", arasaacId: nil, sfSymbol: "questionmark.circle", isEmergency: false),
            WatchPhrase(id: "qu-how", label: "How?", arasaacId: nil, sfSymbol: "questionmark.circle", isEmergency: false),
            WatchPhrase(id: "qu-which", label: "Which one?", arasaacId: nil, sfSymbol: "questionmark.circle", isEmergency: false),
            WatchPhrase(id: "qu-how-many", label: "How many?", arasaacId: nil, sfSymbol: "questionmark.circle", isEmergency: false),
            WatchPhrase(id: "qu-can-i", label: "Can I?", arasaacId: nil, sfSymbol: "questionmark.circle", isEmergency: false),
            WatchPhrase(id: "qu-is-it", label: "Is it?", arasaacId: nil, sfSymbol: "questionmark.circle", isEmergency: false),
            WatchPhrase(id: "qu-where-going", label: "Where are we going?", arasaacId: nil, sfSymbol: "questionmark.circle", isEmergency: false),
            WatchPhrase(id: "qu-who-is-that", label: "Who is that", arasaacId: nil, sfSymbol: "questionmark.circle", isEmergency: false),
            WatchPhrase(id: "qu-what-is-that", label: "What is that", arasaacId: nil, sfSymbol: "questionmark.circle", isEmergency: false),
            WatchPhrase(id: "qu-where-is-it", label: "Where is it", arasaacId: nil, sfSymbol: "questionmark.circle", isEmergency: false),
            WatchPhrase(id: "qu-when-is-it", label: "When is it", arasaacId: nil, sfSymbol: "questionmark.circle", isEmergency: false),
            WatchPhrase(id: "qu-why-is-that", label: "Why is that", arasaacId: nil, sfSymbol: "questionmark.circle", isEmergency: false),
            WatchPhrase(id: "qu-how-does-it-work", label: "How does it work", arasaacId: nil, sfSymbol: "questionmark.circle", isEmergency: false),
            WatchPhrase(id: "qu-how-do-i", label: "How do I", arasaacId: nil, sfSymbol: "questionmark.circle", isEmergency: false),
            WatchPhrase(id: "qu-can-i-have-it", label: "Can I have it", arasaacId: nil, sfSymbol: "questionmark.circle", isEmergency: false),
            WatchPhrase(id: "qu-can-i-try", label: "Can I try", arasaacId: nil, sfSymbol: "questionmark.circle", isEmergency: false),
            WatchPhrase(id: "qu-can-i-go", label: "Can I go", arasaacId: nil, sfSymbol: "questionmark.circle", isEmergency: false),
            WatchPhrase(id: "qu-may-i-please", label: "May I please", arasaacId: nil, sfSymbol: "questionmark.circle", isEmergency: false),
            WatchPhrase(id: "qu-will-you-help", label: "Will you help", arasaacId: nil, sfSymbol: "questionmark.circle", isEmergency: false),
            WatchPhrase(id: "qu-are-you-okay", label: "Are you okay", arasaacId: nil, sfSymbol: "questionmark.circle", isEmergency: false),
            WatchPhrase(id: "qu-are-we-there-yet", label: "Are we there yet", arasaacId: nil, sfSymbol: "questionmark.circle", isEmergency: false),
            WatchPhrase(id: "qu-where-are-we-going", label: "Where are we going", arasaacId: nil, sfSymbol: "questionmark.circle", isEmergency: false),
            WatchPhrase(id: "qu-when-will-we-be-there", label: "When will we be there", arasaacId: nil, sfSymbol: "questionmark.circle", isEmergency: false),
            WatchPhrase(id: "qu-how-much-longer", label: "How much longer", arasaacId: nil, sfSymbol: "questionmark.circle", isEmergency: false),
            WatchPhrase(id: "qu-what-time-is-it", label: "What time is it", arasaacId: nil, sfSymbol: "questionmark.circle", isEmergency: false),
            WatchPhrase(id: "qu-what-day-is-it", label: "What day is it", arasaacId: nil, sfSymbol: "questionmark.circle", isEmergency: false),
            WatchPhrase(id: "qu-is-it-ready-yet", label: "Is it ready yet", arasaacId: nil, sfSymbol: "questionmark.circle", isEmergency: false),
            WatchPhrase(id: "qu-can-we-go-now", label: "Can we go now", arasaacId: nil, sfSymbol: "questionmark.circle", isEmergency: false),
            WatchPhrase(id: "qu-can-we-do-this", label: "Can we do this", arasaacId: nil, sfSymbol: "questionmark.circle", isEmergency: false),
            WatchPhrase(id: "qu-did-you-see-that", label: "Did you see that", arasaacId: nil, sfSymbol: "questionmark.circle", isEmergency: false),
            WatchPhrase(id: "qu-did-i-do-good", label: "Did I do good", arasaacId: nil, sfSymbol: "questionmark.circle", isEmergency: false),
            WatchPhrase(id: "qu-what-happened", label: "What happened", arasaacId: nil, sfSymbol: "questionmark.circle", isEmergency: false),
            WatchPhrase(id: "qu-where-did-it-go", label: "Where did it go", arasaacId: nil, sfSymbol: "questionmark.circle", isEmergency: false),
            WatchPhrase(id: "qu-who-said-that", label: "Who said that", arasaacId: nil, sfSymbol: "questionmark.circle", isEmergency: false),
            WatchPhrase(id: "qu-what-did-they-say", label: "What did they say", arasaacId: nil, sfSymbol: "questionmark.circle", isEmergency: false),
            WatchPhrase(id: "qu-how-old-are-you", label: "How old are you", arasaacId: nil, sfSymbol: "questionmark.circle", isEmergency: false),
            WatchPhrase(id: "qu-what-is-your-name", label: "What is your name", arasaacId: nil, sfSymbol: "questionmark.circle", isEmergency: false),
            WatchPhrase(id: "qu-how-are-you-feeling", label: "How are you feeling", arasaacId: nil, sfSymbol: "questionmark.circle", isEmergency: false),
            WatchPhrase(id: "qu-what-is-for-dinner", label: "What is for dinner", arasaacId: nil, sfSymbol: "questionmark.circle", isEmergency: false),
            WatchPhrase(id: "qu-what-is-for-snack", label: "What is for snack", arasaacId: nil, sfSymbol: "questionmark.circle", isEmergency: false),
            WatchPhrase(id: "qu-is-it-bedtime", label: "Is it bedtime", arasaacId: nil, sfSymbol: "questionmark.circle", isEmergency: false),
            WatchPhrase(id: "qu-are-you-my-friend", label: "Are you my friend", arasaacId: nil, sfSymbol: "questionmark.circle", isEmergency: false),
            WatchPhrase(id: "qu-will-you-play-with-me", label: "Will you play with me", arasaacId: nil, sfSymbol: "questionmark.circle", isEmergency: false),
        ]),
        WatchCategory(id: "actions", icon: "figure.run", name: "Actions", phrases: [
            WatchPhrase(id: "ac-go", label: "Go", arasaacId: nil, sfSymbol: "figure.walk", isEmergency: false),
            WatchPhrase(id: "ac-stop", label: "Stop", arasaacId: nil, sfSymbol: "figure.walk", isEmergency: false),
            WatchPhrase(id: "ac-eat", label: "Eat", arasaacId: nil, sfSymbol: "figure.walk", isEmergency: false),
            WatchPhrase(id: "ac-drink", label: "Drink", arasaacId: nil, sfSymbol: "figure.walk", isEmergency: false),
            WatchPhrase(id: "ac-play", label: "Play", arasaacId: nil, sfSymbol: "figure.walk", isEmergency: false),
            WatchPhrase(id: "ac-read", label: "Read", arasaacId: nil, sfSymbol: "figure.walk", isEmergency: false),
            WatchPhrase(id: "ac-watch", label: "Watch", arasaacId: nil, sfSymbol: "figure.walk", isEmergency: false),
            WatchPhrase(id: "ac-listen", label: "Listen", arasaacId: nil, sfSymbol: "figure.walk", isEmergency: false),
            WatchPhrase(id: "ac-open", label: "Open", arasaacId: nil, sfSymbol: "figure.walk", isEmergency: false),
            WatchPhrase(id: "ac-close", label: "Close", arasaacId: nil, sfSymbol: "figure.walk", isEmergency: false),
            WatchPhrase(id: "ac-give", label: "Give", arasaacId: nil, sfSymbol: "figure.walk", isEmergency: false),
            WatchPhrase(id: "ac-take", label: "Take", arasaacId: nil, sfSymbol: "figure.walk", isEmergency: false),
            WatchPhrase(id: "ac-look", label: "Look", arasaacId: nil, sfSymbol: "figure.walk", isEmergency: false),
            WatchPhrase(id: "ac-sit", label: "Sit", arasaacId: nil, sfSymbol: "figure.walk", isEmergency: false),
            WatchPhrase(id: "ac-stand", label: "Stand up", arasaacId: nil, sfSymbol: "figure.walk", isEmergency: false),
            WatchPhrase(id: "ac-walk", label: "Walk", arasaacId: nil, sfSymbol: "figure.walk", isEmergency: false),
            WatchPhrase(id: "ac-run", label: "Run", arasaacId: nil, sfSymbol: "figure.walk", isEmergency: false),
            WatchPhrase(id: "ac-write", label: "Write", arasaacId: nil, sfSymbol: "figure.walk", isEmergency: false),
            WatchPhrase(id: "ac-draw", label: "Draw", arasaacId: nil, sfSymbol: "figure.walk", isEmergency: false),
            WatchPhrase(id: "ac-make", label: "Make", arasaacId: nil, sfSymbol: "figure.walk", isEmergency: false),
            WatchPhrase(id: "ac-put", label: "Put", arasaacId: nil, sfSymbol: "figure.walk", isEmergency: false),
            WatchPhrase(id: "ac-get", label: "Get", arasaacId: nil, sfSymbol: "figure.walk", isEmergency: false),
            WatchPhrase(id: "ac-turn", label: "Turn", arasaacId: nil, sfSymbol: "figure.walk", isEmergency: false),
            WatchPhrase(id: "ac-wash", label: "Wash", arasaacId: nil, sfSymbol: "figure.walk", isEmergency: false),
            WatchPhrase(id: "ac-wave", label: "Wave", arasaacId: nil, sfSymbol: "figure.walk", isEmergency: false),
            WatchPhrase(id: "ac-clap", label: "Clap", arasaacId: nil, sfSymbol: "figure.walk", isEmergency: false),
            WatchPhrase(id: "ac-point", label: "Point", arasaacId: nil, sfSymbol: "figure.walk", isEmergency: false),
            WatchPhrase(id: "ac-nod", label: "Nod", arasaacId: nil, sfSymbol: "figure.walk", isEmergency: false),
            WatchPhrase(id: "ac-shake-head", label: "Shake head", arasaacId: nil, sfSymbol: "figure.walk", isEmergency: false),
            WatchPhrase(id: "ac-whisper", label: "Whisper", arasaacId: nil, sfSymbol: "figure.walk", isEmergency: false),
            WatchPhrase(id: "ac-shout", label: "Shout", arasaacId: nil, sfSymbol: "figure.walk", isEmergency: false),
            WatchPhrase(id: "ac-sing", label: "Sing", arasaacId: nil, sfSymbol: "figure.walk", isEmergency: false),
            WatchPhrase(id: "ac-hum", label: "Hum", arasaacId: nil, sfSymbol: "figure.walk", isEmergency: false),
            WatchPhrase(id: "ac-roll", label: "Roll", arasaacId: nil, sfSymbol: "figure.walk", isEmergency: false),
            WatchPhrase(id: "ac-slide", label: "Slide", arasaacId: nil, sfSymbol: "figure.walk", isEmergency: false),
            WatchPhrase(id: "ac-spin", label: "Spin", arasaacId: nil, sfSymbol: "figure.walk", isEmergency: false),
            WatchPhrase(id: "ac-hop", label: "Hop", arasaacId: nil, sfSymbol: "figure.walk", isEmergency: false),
            WatchPhrase(id: "ac-skip", label: "Skip", arasaacId: nil, sfSymbol: "figure.walk", isEmergency: false),
            WatchPhrase(id: "ac-crawl", label: "Crawl", arasaacId: nil, sfSymbol: "figure.walk", isEmergency: false),
            WatchPhrase(id: "ac-tiptoe", label: "Tiptoe", arasaacId: nil, sfSymbol: "figure.walk", isEmergency: false),
            WatchPhrase(id: "ac-tip-toe", label: "Tip-toe", arasaacId: nil, sfSymbol: "figure.walk", isEmergency: false),
            WatchPhrase(id: "ac-march", label: "March", arasaacId: nil, sfSymbol: "figure.walk", isEmergency: false),
            WatchPhrase(id: "ac-climb-up", label: "Climb up", arasaacId: nil, sfSymbol: "figure.walk", isEmergency: false),
            WatchPhrase(id: "ac-climb-down", label: "Climb down", arasaacId: nil, sfSymbol: "figure.walk", isEmergency: false),
            WatchPhrase(id: "ac-push-it", label: "Push it", arasaacId: nil, sfSymbol: "figure.walk", isEmergency: false),
            WatchPhrase(id: "ac-pull-it", label: "Pull it", arasaacId: nil, sfSymbol: "figure.walk", isEmergency: false),
            WatchPhrase(id: "ac-pick-it-up", label: "Pick it up", arasaacId: nil, sfSymbol: "figure.walk", isEmergency: false),
            WatchPhrase(id: "ac-set-it-down", label: "Set it down", arasaacId: nil, sfSymbol: "figure.walk", isEmergency: false),
            WatchPhrase(id: "ac-pour", label: "Pour", arasaacId: nil, sfSymbol: "figure.walk", isEmergency: false),
            WatchPhrase(id: "ac-stir", label: "Stir", arasaacId: nil, sfSymbol: "figure.walk", isEmergency: false),
            WatchPhrase(id: "ac-mix", label: "Mix", arasaacId: nil, sfSymbol: "figure.walk", isEmergency: false),
            WatchPhrase(id: "ac-spread", label: "Spread", arasaacId: nil, sfSymbol: "figure.walk", isEmergency: false),
            WatchPhrase(id: "ac-fold", label: "Fold", arasaacId: nil, sfSymbol: "figure.walk", isEmergency: false),
            WatchPhrase(id: "ac-tie", label: "Tie", arasaacId: nil, sfSymbol: "figure.walk", isEmergency: false),
            WatchPhrase(id: "ac-untie", label: "Untie", arasaacId: nil, sfSymbol: "figure.walk", isEmergency: false),
            WatchPhrase(id: "ac-zip", label: "Zip", arasaacId: nil, sfSymbol: "figure.walk", isEmergency: false),
            WatchPhrase(id: "ac-unzip", label: "Unzip", arasaacId: nil, sfSymbol: "figure.walk", isEmergency: false),
            WatchPhrase(id: "ac-snap", label: "Snap", arasaacId: nil, sfSymbol: "figure.walk", isEmergency: false),
            WatchPhrase(id: "ac-buckle", label: "Buckle", arasaacId: nil, sfSymbol: "figure.walk", isEmergency: false),
            WatchPhrase(id: "ac-brush-teeth", label: "Brush teeth", arasaacId: nil, sfSymbol: "figure.walk", isEmergency: false),
            WatchPhrase(id: "ac-brush-hair", label: "Brush hair", arasaacId: nil, sfSymbol: "figure.walk", isEmergency: false),
            WatchPhrase(id: "ac-comb", label: "Comb", arasaacId: nil, sfSymbol: "figure.walk", isEmergency: false),
            WatchPhrase(id: "ac-floss", label: "Floss", arasaacId: nil, sfSymbol: "figure.walk", isEmergency: false),
            WatchPhrase(id: "ac-get-dressed", label: "Get dressed", arasaacId: nil, sfSymbol: "figure.walk", isEmergency: false),
            WatchPhrase(id: "ac-get-undressed", label: "Get undressed", arasaacId: nil, sfSymbol: "figure.walk", isEmergency: false),
            WatchPhrase(id: "ac-put-on-shoes", label: "Put on shoes", arasaacId: nil, sfSymbol: "figure.walk", isEmergency: false),
            WatchPhrase(id: "ac-take-off-shoes", label: "Take off shoes", arasaacId: nil, sfSymbol: "figure.walk", isEmergency: false),
            WatchPhrase(id: "ac-wash-hands", label: "Wash hands", arasaacId: nil, sfSymbol: "figure.walk", isEmergency: false),
            WatchPhrase(id: "ac-take-a-bath", label: "Take a bath", arasaacId: nil, sfSymbol: "figure.walk", isEmergency: false),
            WatchPhrase(id: "ac-take-a-shower", label: "Take a shower", arasaacId: nil, sfSymbol: "figure.walk", isEmergency: false),
            WatchPhrase(id: "ac-sleep", label: "Sleep", arasaacId: nil, sfSymbol: "figure.walk", isEmergency: false),
            WatchPhrase(id: "ac-take-a-nap", label: "Take a nap", arasaacId: nil, sfSymbol: "figure.walk", isEmergency: false),
            WatchPhrase(id: "ac-wake-up", label: "Wake up", arasaacId: nil, sfSymbol: "figure.walk", isEmergency: false),
            WatchPhrase(id: "ac-wait-for", label: "Wait for", arasaacId: nil, sfSymbol: "figure.walk", isEmergency: false),
            WatchPhrase(id: "ac-look-for", label: "Look for", arasaacId: nil, sfSymbol: "figure.walk", isEmergency: false),
            WatchPhrase(id: "ac-search", label: "Search", arasaacId: nil, sfSymbol: "figure.walk", isEmergency: false),
            WatchPhrase(id: "ac-discover", label: "Discover", arasaacId: nil, sfSymbol: "figure.walk", isEmergency: false),
            WatchPhrase(id: "ac-hide", label: "Hide", arasaacId: nil, sfSymbol: "figure.walk", isEmergency: false),
            WatchPhrase(id: "ac-seek", label: "Seek", arasaacId: nil, sfSymbol: "figure.walk", isEmergency: false),
            WatchPhrase(id: "ac-tag", label: "Tag", arasaacId: nil, sfSymbol: "figure.walk", isEmergency: false),
            WatchPhrase(id: "ac-race", label: "Race", arasaacId: nil, sfSymbol: "figure.walk", isEmergency: false),
            WatchPhrase(id: "ac-cuddle", label: "Cuddle", arasaacId: nil, sfSymbol: "figure.walk", isEmergency: false),
            WatchPhrase(id: "ac-snuggle", label: "Snuggle", arasaacId: nil, sfSymbol: "figure.walk", isEmergency: false),
            WatchPhrase(id: "ac-pat", label: "Pat", arasaacId: nil, sfSymbol: "figure.walk", isEmergency: false),
            WatchPhrase(id: "ac-tickle", label: "Tickle", arasaacId: nil, sfSymbol: "figure.walk", isEmergency: false),
            WatchPhrase(id: "ac-sweep", label: "Sweep", arasaacId: nil, sfSymbol: "figure.walk", isEmergency: false),
            WatchPhrase(id: "ac-mop", label: "Mop", arasaacId: nil, sfSymbol: "figure.walk", isEmergency: false),
            WatchPhrase(id: "ac-vacuum", label: "Vacuum", arasaacId: nil, sfSymbol: "figure.walk", isEmergency: false),
            WatchPhrase(id: "ac-dust", label: "Dust", arasaacId: nil, sfSymbol: "figure.walk", isEmergency: false),
            WatchPhrase(id: "ac-carry-it", label: "Carry it", arasaacId: nil, sfSymbol: "figure.walk", isEmergency: false),
            WatchPhrase(id: "ac-drop-it", label: "Drop it", arasaacId: nil, sfSymbol: "figure.walk", isEmergency: false),
            WatchPhrase(id: "ac-toss-it", label: "Toss it", arasaacId: nil, sfSymbol: "figure.walk", isEmergency: false),
            WatchPhrase(id: "ac-roll-it", label: "Roll it", arasaacId: nil, sfSymbol: "figure.walk", isEmergency: false),
        ]),
        WatchCategory(id: "describing", icon: "paintpalette.fill", name: "Describing Words", phrases: [
            WatchPhrase(id: "dw-big", label: "Big", arasaacId: nil, sfSymbol: "paintpalette", isEmergency: false),
            WatchPhrase(id: "dw-small", label: "Small", arasaacId: nil, sfSymbol: "paintpalette", isEmergency: false),
            WatchPhrase(id: "dw-hot", label: "Hot", arasaacId: nil, sfSymbol: "paintpalette", isEmergency: false),
            WatchPhrase(id: "dw-cold", label: "Cold", arasaacId: nil, sfSymbol: "paintpalette", isEmergency: false),
            WatchPhrase(id: "dw-good", label: "Good", arasaacId: nil, sfSymbol: "paintpalette", isEmergency: false),
            WatchPhrase(id: "dw-bad", label: "Bad", arasaacId: nil, sfSymbol: "paintpalette", isEmergency: false),
            WatchPhrase(id: "dw-fast", label: "Fast", arasaacId: nil, sfSymbol: "paintpalette", isEmergency: false),
            WatchPhrase(id: "dw-slow", label: "Slow", arasaacId: nil, sfSymbol: "paintpalette", isEmergency: false),
            WatchPhrase(id: "dw-new", label: "New", arasaacId: nil, sfSymbol: "paintpalette", isEmergency: false),
            WatchPhrase(id: "dw-old", label: "Old", arasaacId: nil, sfSymbol: "paintpalette", isEmergency: false),
            WatchPhrase(id: "dw-same", label: "Same", arasaacId: nil, sfSymbol: "paintpalette", isEmergency: false),
            WatchPhrase(id: "dw-different", label: "Different", arasaacId: nil, sfSymbol: "paintpalette", isEmergency: false),
            WatchPhrase(id: "dw-funny", label: "Funny", arasaacId: nil, sfSymbol: "paintpalette", isEmergency: false),
            WatchPhrase(id: "dw-pretty", label: "Pretty", arasaacId: nil, sfSymbol: "paintpalette", isEmergency: false),
            WatchPhrase(id: "dw-yucky", label: "Yucky", arasaacId: nil, sfSymbol: "paintpalette", isEmergency: false),
            WatchPhrase(id: "dw-favorite", label: "Favorite", arasaacId: nil, sfSymbol: "paintpalette", isEmergency: false),
            WatchPhrase(id: "dw-tall", label: "Tall", arasaacId: nil, sfSymbol: "paintpalette", isEmergency: false),
            WatchPhrase(id: "dw-short", label: "Short", arasaacId: nil, sfSymbol: "paintpalette", isEmergency: false),
            WatchPhrase(id: "dw-long", label: "Long", arasaacId: nil, sfSymbol: "paintpalette", isEmergency: false),
            WatchPhrase(id: "dw-wide", label: "Wide", arasaacId: nil, sfSymbol: "paintpalette", isEmergency: false),
            WatchPhrase(id: "dw-narrow", label: "Narrow", arasaacId: nil, sfSymbol: "paintpalette", isEmergency: false),
            WatchPhrase(id: "dw-thick", label: "Thick", arasaacId: nil, sfSymbol: "paintpalette", isEmergency: false),
            WatchPhrase(id: "dw-thin", label: "Thin", arasaacId: nil, sfSymbol: "paintpalette", isEmergency: false),
            WatchPhrase(id: "dw-round", label: "Round", arasaacId: nil, sfSymbol: "paintpalette", isEmergency: false),
            WatchPhrase(id: "dw-square", label: "Square", arasaacId: nil, sfSymbol: "paintpalette", isEmergency: false),
            WatchPhrase(id: "dw-smooth", label: "Smooth", arasaacId: nil, sfSymbol: "paintpalette", isEmergency: false),
            WatchPhrase(id: "dw-rough", label: "Rough", arasaacId: nil, sfSymbol: "paintpalette", isEmergency: false),
            WatchPhrase(id: "dw-sticky", label: "Sticky", arasaacId: nil, sfSymbol: "paintpalette", isEmergency: false),
            WatchPhrase(id: "dw-wet", label: "Wet", arasaacId: nil, sfSymbol: "paintpalette", isEmergency: false),
            WatchPhrase(id: "dw-dry", label: "Dry", arasaacId: nil, sfSymbol: "paintpalette", isEmergency: false),
            WatchPhrase(id: "dw-clean", label: "Clean", arasaacId: nil, sfSymbol: "paintpalette", isEmergency: false),
            WatchPhrase(id: "dw-dirty", label: "Dirty", arasaacId: nil, sfSymbol: "paintpalette", isEmergency: false),
            WatchPhrase(id: "dw-soft", label: "Soft", arasaacId: nil, sfSymbol: "paintpalette", isEmergency: false),
            WatchPhrase(id: "dw-hard", label: "Hard", arasaacId: nil, sfSymbol: "paintpalette", isEmergency: false),
            WatchPhrase(id: "dw-sweet", label: "Sweet", arasaacId: nil, sfSymbol: "paintpalette", isEmergency: false),
            WatchPhrase(id: "dw-salty", label: "Salty", arasaacId: nil, sfSymbol: "paintpalette", isEmergency: false),
            WatchPhrase(id: "dw-sour", label: "Sour", arasaacId: nil, sfSymbol: "paintpalette", isEmergency: false),
            WatchPhrase(id: "dw-spicy", label: "Spicy", arasaacId: nil, sfSymbol: "paintpalette", isEmergency: false),
            WatchPhrase(id: "dw-bitter", label: "Bitter", arasaacId: nil, sfSymbol: "paintpalette", isEmergency: false),
            WatchPhrase(id: "dw-quiet", label: "Quiet", arasaacId: nil, sfSymbol: "paintpalette", isEmergency: false),
            WatchPhrase(id: "dw-loud", label: "Loud", arasaacId: nil, sfSymbol: "paintpalette", isEmergency: false),
            WatchPhrase(id: "dw-bright", label: "Bright", arasaacId: nil, sfSymbol: "paintpalette", isEmergency: false),
            WatchPhrase(id: "dw-dark", label: "Dark", arasaacId: nil, sfSymbol: "paintpalette", isEmergency: false),
            WatchPhrase(id: "dw-shiny", label: "Shiny", arasaacId: nil, sfSymbol: "paintpalette", isEmergency: false),
            WatchPhrase(id: "dw-heavy", label: "Heavy", arasaacId: nil, sfSymbol: "paintpalette", isEmergency: false),
            WatchPhrase(id: "dw-light", label: "Light", arasaacId: nil, sfSymbol: "paintpalette", isEmergency: false),
            WatchPhrase(id: "dw-empty", label: "Empty", arasaacId: nil, sfSymbol: "paintpalette", isEmergency: false),
            WatchPhrase(id: "dw-full", label: "Full", arasaacId: nil, sfSymbol: "paintpalette", isEmergency: false),
            WatchPhrase(id: "dw-easy", label: "Easy", arasaacId: nil, sfSymbol: "paintpalette", isEmergency: false),
            WatchPhrase(id: "dw-tricky", label: "Tricky", arasaacId: nil, sfSymbol: "paintpalette", isEmergency: false),
            WatchPhrase(id: "dw-simple", label: "Simple", arasaacId: nil, sfSymbol: "paintpalette", isEmergency: false),
            WatchPhrase(id: "dw-fun", label: "Fun", arasaacId: nil, sfSymbol: "paintpalette", isEmergency: false),
            WatchPhrase(id: "dw-boring", label: "Boring", arasaacId: nil, sfSymbol: "paintpalette", isEmergency: false),
            WatchPhrase(id: "dw-cool", label: "Cool", arasaacId: nil, sfSymbol: "paintpalette", isEmergency: false),
            WatchPhrase(id: "dw-awesome", label: "Awesome", arasaacId: nil, sfSymbol: "paintpalette", isEmergency: false),
            WatchPhrase(id: "dw-scary", label: "Scary", arasaacId: nil, sfSymbol: "paintpalette", isEmergency: false),
            WatchPhrase(id: "dw-safe", label: "Safe", arasaacId: nil, sfSymbol: "paintpalette", isEmergency: false),
            WatchPhrase(id: "dw-dangerous", label: "Dangerous", arasaacId: nil, sfSymbol: "paintpalette", isEmergency: false),
            WatchPhrase(id: "dw-friendly", label: "Friendly", arasaacId: nil, sfSymbol: "paintpalette", isEmergency: false),
            WatchPhrase(id: "dw-mean", label: "Mean", arasaacId: nil, sfSymbol: "paintpalette", isEmergency: false),
            WatchPhrase(id: "dw-nice", label: "Nice", arasaacId: nil, sfSymbol: "paintpalette", isEmergency: false),
            WatchPhrase(id: "dw-helpful", label: "Helpful", arasaacId: nil, sfSymbol: "paintpalette", isEmergency: false),
            WatchPhrase(id: "dw-mine", label: "Mine", arasaacId: nil, sfSymbol: "paintpalette", isEmergency: false),
            WatchPhrase(id: "dw-special", label: "Special", arasaacId: nil, sfSymbol: "paintpalette", isEmergency: false),
        ]),
        WatchCategory(id: "people-social", icon: "person.3.fill", name: "People", phrases: [
            WatchPhrase(id: "pp-mom", label: "Mom", arasaacId: nil, sfSymbol: "person.fill", isEmergency: false),
            WatchPhrase(id: "pp-dad", label: "Dad", arasaacId: nil, sfSymbol: "person.fill", isEmergency: false),
            WatchPhrase(id: "pp-teacher", label: "Teacher", arasaacId: nil, sfSymbol: "person.fill", isEmergency: false),
            WatchPhrase(id: "pp-friend", label: "Friend", arasaacId: nil, sfSymbol: "person.fill", isEmergency: false),
            WatchPhrase(id: "pp-family", label: "Family", arasaacId: nil, sfSymbol: "person.fill", isEmergency: false),
            WatchPhrase(id: "pp-doctor", label: "Doctor", arasaacId: nil, sfSymbol: "person.fill", isEmergency: false),
            WatchPhrase(id: "pp-brother", label: "Brother", arasaacId: nil, sfSymbol: "person.fill", isEmergency: false),
            WatchPhrase(id: "pp-sister", label: "Sister", arasaacId: nil, sfSymbol: "person.fill", isEmergency: false),
            WatchPhrase(id: "pp-grandma", label: "Grandma", arasaacId: nil, sfSymbol: "person.fill", isEmergency: false),
            WatchPhrase(id: "pp-grandpa", label: "Grandpa", arasaacId: nil, sfSymbol: "person.fill", isEmergency: false),
            WatchPhrase(id: "pp-baby", label: "Baby", arasaacId: nil, sfSymbol: "person.fill", isEmergency: false),
            WatchPhrase(id: "pp-boy", label: "Boy", arasaacId: nil, sfSymbol: "person.fill", isEmergency: false),
            WatchPhrase(id: "pp-girl", label: "Girl", arasaacId: nil, sfSymbol: "person.fill", isEmergency: false),
            WatchPhrase(id: "pp-therapist", label: "Therapist", arasaacId: nil, sfSymbol: "person.fill", isEmergency: false),
            WatchPhrase(id: "pp-aunt", label: "Aunt", arasaacId: nil, sfSymbol: "person.fill", isEmergency: false),
            WatchPhrase(id: "pp-uncle", label: "Uncle", arasaacId: nil, sfSymbol: "person.fill", isEmergency: false),
            WatchPhrase(id: "pp-cousin", label: "Cousin", arasaacId: nil, sfSymbol: "person.fill", isEmergency: false),
            WatchPhrase(id: "pp-stepmom", label: "Stepmom", arasaacId: nil, sfSymbol: "person.fill", isEmergency: false),
            WatchPhrase(id: "pp-stepdad", label: "Stepdad", arasaacId: nil, sfSymbol: "person.fill", isEmergency: false),
            WatchPhrase(id: "pp-bus-driver", label: "Bus driver", arasaacId: nil, sfSymbol: "person.fill", isEmergency: false),
            WatchPhrase(id: "pp-coach", label: "Coach", arasaacId: nil, sfSymbol: "person.fill", isEmergency: false),
            WatchPhrase(id: "pp-principal", label: "Principal", arasaacId: nil, sfSymbol: "person.fill", isEmergency: false),
            WatchPhrase(id: "pp-counselor", label: "Counselor", arasaacId: nil, sfSymbol: "person.fill", isEmergency: false),
            WatchPhrase(id: "pp-nurse", label: "Nurse", arasaacId: nil, sfSymbol: "person.fill", isEmergency: false),
            WatchPhrase(id: "pp-dentist", label: "Dentist", arasaacId: nil, sfSymbol: "person.fill", isEmergency: false),
            WatchPhrase(id: "pp-bcba", label: "BCBA", arasaacId: nil, sfSymbol: "person.fill", isEmergency: false),
            WatchPhrase(id: "pp-rbt", label: "RBT", arasaacId: nil, sfSymbol: "person.fill", isEmergency: false),
            WatchPhrase(id: "pp-babysitter", label: "Babysitter", arasaacId: nil, sfSymbol: "person.fill", isEmergency: false),
            WatchPhrase(id: "pp-neighbor", label: "Neighbor", arasaacId: nil, sfSymbol: "person.fill", isEmergency: false),
            WatchPhrase(id: "pp-helper", label: "Helper", arasaacId: nil, sfSymbol: "person.fill", isEmergency: false),
            WatchPhrase(id: "pp-classmate", label: "Classmate", arasaacId: nil, sfSymbol: "person.fill", isEmergency: false),
            WatchPhrase(id: "pp-best-friend", label: "Best friend", arasaacId: nil, sfSymbol: "person.fill", isEmergency: false),
            WatchPhrase(id: "pp-new-friend", label: "New friend", arasaacId: nil, sfSymbol: "person.fill", isEmergency: false),
            WatchPhrase(id: "pp-man", label: "Man", arasaacId: nil, sfSymbol: "person.fill", isEmergency: false),
            WatchPhrase(id: "pp-woman", label: "Woman", arasaacId: nil, sfSymbol: "person.fill", isEmergency: false),
            WatchPhrase(id: "pp-kid", label: "Kid", arasaacId: nil, sfSymbol: "person.fill", isEmergency: false),
            WatchPhrase(id: "pp-grown-up", label: "Grown-up", arasaacId: nil, sfSymbol: "person.fill", isEmergency: false),
            WatchPhrase(id: "pp-stranger", label: "Stranger", arasaacId: nil, sfSymbol: "person.fill", isEmergency: false),
            WatchPhrase(id: "pp-police-officer", label: "Police officer", arasaacId: nil, sfSymbol: "person.fill", isEmergency: false),
            WatchPhrase(id: "pp-firefighter", label: "Firefighter", arasaacId: nil, sfSymbol: "person.fill", isEmergency: false),
            WatchPhrase(id: "pp-paramedic", label: "Paramedic", arasaacId: nil, sfSymbol: "person.fill", isEmergency: false),
            WatchPhrase(id: "pp-my-family", label: "My family", arasaacId: nil, sfSymbol: "person.fill", isEmergency: false),
            WatchPhrase(id: "pp-my-class", label: "My class", arasaacId: nil, sfSymbol: "person.fill", isEmergency: false),
            WatchPhrase(id: "pp-my-team", label: "My team", arasaacId: nil, sfSymbol: "person.fill", isEmergency: false),
            WatchPhrase(id: "pc-librarian", label: "Librarian", arasaacId: nil, sfSymbol: "person.fill", isEmergency: false),
        ]),
        WatchCategory(id: "food-ordering", icon: "fork.knife", name: "Food & Drink", phrases: [
            WatchPhrase(id: "fd-water", label: "Water", arasaacId: nil, sfSymbol: "fork.knife", isEmergency: false),
            WatchPhrase(id: "fd-juice", label: "Juice", arasaacId: nil, sfSymbol: "fork.knife", isEmergency: false),
            WatchPhrase(id: "fd-milk", label: "Milk", arasaacId: nil, sfSymbol: "fork.knife", isEmergency: false),
            WatchPhrase(id: "fd-pizza", label: "Pizza", arasaacId: nil, sfSymbol: "fork.knife", isEmergency: false),
            WatchPhrase(id: "fd-sandwich", label: "Sandwich", arasaacId: nil, sfSymbol: "fork.knife", isEmergency: false),
            WatchPhrase(id: "fd-chicken", label: "Chicken", arasaacId: nil, sfSymbol: "fork.knife", isEmergency: false),
            WatchPhrase(id: "fd-fries", label: "Fries", arasaacId: nil, sfSymbol: "fork.knife", isEmergency: false),
            WatchPhrase(id: "fd-fruit", label: "Fruit", arasaacId: nil, sfSymbol: "fork.knife", isEmergency: false),
            WatchPhrase(id: "fd-snack", label: "Snack", arasaacId: nil, sfSymbol: "fork.knife", isEmergency: false),
            WatchPhrase(id: "fd-more", label: "More please", arasaacId: nil, sfSymbol: "fork.knife", isEmergency: false),
            WatchPhrase(id: "fd-no-thanks", label: "No thanks", arasaacId: nil, sfSymbol: "fork.knife", isEmergency: false),
            WatchPhrase(id: "fd-cookie", label: "Cookie", arasaacId: nil, sfSymbol: "fork.knife", isEmergency: false),
            WatchPhrase(id: "fd-apple", label: "Apple", arasaacId: nil, sfSymbol: "fork.knife", isEmergency: false),
            WatchPhrase(id: "fd-banana", label: "Banana", arasaacId: nil, sfSymbol: "fork.knife", isEmergency: false),
            WatchPhrase(id: "fd-cereal", label: "Cereal", arasaacId: nil, sfSymbol: "fork.knife", isEmergency: false),
            WatchPhrase(id: "fd-cheese", label: "Cheese", arasaacId: nil, sfSymbol: "fork.knife", isEmergency: false),
            WatchPhrase(id: "fd-ice-cream", label: "Ice cream", arasaacId: nil, sfSymbol: "fork.knife", isEmergency: false),
            WatchPhrase(id: "fd-crackers", label: "Crackers", arasaacId: nil, sfSymbol: "fork.knife", isEmergency: false),
            WatchPhrase(id: "fd-bread", label: "Bread", arasaacId: nil, sfSymbol: "fork.knife", isEmergency: false),
            WatchPhrase(id: "fd-toast", label: "Toast", arasaacId: nil, sfSymbol: "fork.knife", isEmergency: false),
            WatchPhrase(id: "fd-pancakes", label: "Pancakes", arasaacId: nil, sfSymbol: "fork.knife", isEmergency: false),
            WatchPhrase(id: "fd-waffles", label: "Waffles", arasaacId: nil, sfSymbol: "fork.knife", isEmergency: false),
            WatchPhrase(id: "fd-eggs", label: "Eggs", arasaacId: nil, sfSymbol: "fork.knife", isEmergency: false),
            WatchPhrase(id: "fd-bacon", label: "Bacon", arasaacId: nil, sfSymbol: "fork.knife", isEmergency: false),
            WatchPhrase(id: "fd-yogurt", label: "Yogurt", arasaacId: nil, sfSymbol: "fork.knife", isEmergency: false),
            WatchPhrase(id: "fd-oatmeal", label: "Oatmeal", arasaacId: nil, sfSymbol: "fork.knife", isEmergency: false),
            WatchPhrase(id: "fd-granola", label: "Granola", arasaacId: nil, sfSymbol: "fork.knife", isEmergency: false),
            WatchPhrase(id: "fd-smoothie", label: "Smoothie", arasaacId: nil, sfSymbol: "fork.knife", isEmergency: false),
            WatchPhrase(id: "fd-pasta", label: "Pasta", arasaacId: nil, sfSymbol: "fork.knife", isEmergency: false),
            WatchPhrase(id: "fd-noodles", label: "Noodles", arasaacId: nil, sfSymbol: "fork.knife", isEmergency: false),
            WatchPhrase(id: "fd-rice", label: "Rice", arasaacId: nil, sfSymbol: "fork.knife", isEmergency: false),
            WatchPhrase(id: "fd-soup", label: "Soup", arasaacId: nil, sfSymbol: "fork.knife", isEmergency: false),
            WatchPhrase(id: "fd-salad", label: "Salad", arasaacId: nil, sfSymbol: "fork.knife", isEmergency: false),
            WatchPhrase(id: "fd-wrap", label: "Wrap", arasaacId: nil, sfSymbol: "fork.knife", isEmergency: false),
            WatchPhrase(id: "fd-hamburger", label: "Hamburger", arasaacId: nil, sfSymbol: "fork.knife", isEmergency: false),
            WatchPhrase(id: "fd-hot-dog", label: "Hot dog", arasaacId: nil, sfSymbol: "fork.knife", isEmergency: false),
            WatchPhrase(id: "fd-taco", label: "Taco", arasaacId: nil, sfSymbol: "fork.knife", isEmergency: false),
            WatchPhrase(id: "fd-burrito", label: "Burrito", arasaacId: nil, sfSymbol: "fork.knife", isEmergency: false),
            WatchPhrase(id: "fd-quesadilla", label: "Quesadilla", arasaacId: nil, sfSymbol: "fork.knife", isEmergency: false),
            WatchPhrase(id: "fd-sushi", label: "Sushi", arasaacId: nil, sfSymbol: "fork.knife", isEmergency: false),
            WatchPhrase(id: "fd-dumplings", label: "Dumplings", arasaacId: nil, sfSymbol: "fork.knife", isEmergency: false),
            WatchPhrase(id: "fd-curry", label: "Curry", arasaacId: nil, sfSymbol: "fork.knife", isEmergency: false),
            WatchPhrase(id: "fd-stir-fry", label: "Stir fry", arasaacId: nil, sfSymbol: "fork.knife", isEmergency: false),
            WatchPhrase(id: "fd-carrots", label: "Carrots", arasaacId: nil, sfSymbol: "fork.knife", isEmergency: false),
            WatchPhrase(id: "fd-broccoli", label: "Broccoli", arasaacId: nil, sfSymbol: "fork.knife", isEmergency: false),
            WatchPhrase(id: "fd-peas", label: "Peas", arasaacId: nil, sfSymbol: "fork.knife", isEmergency: false),
            WatchPhrase(id: "fd-corn", label: "Corn", arasaacId: nil, sfSymbol: "fork.knife", isEmergency: false),
            WatchPhrase(id: "fd-tomato", label: "Tomato", arasaacId: nil, sfSymbol: "fork.knife", isEmergency: false),
            WatchPhrase(id: "fd-cucumber", label: "Cucumber", arasaacId: nil, sfSymbol: "fork.knife", isEmergency: false),
            WatchPhrase(id: "fd-lettuce", label: "Lettuce", arasaacId: nil, sfSymbol: "fork.knife", isEmergency: false),
            WatchPhrase(id: "fd-spinach", label: "Spinach", arasaacId: nil, sfSymbol: "fork.knife", isEmergency: false),
            WatchPhrase(id: "fd-potato", label: "Potato", arasaacId: nil, sfSymbol: "fork.knife", isEmergency: false),
            WatchPhrase(id: "fd-sweet-potato", label: "Sweet potato", arasaacId: nil, sfSymbol: "fork.knife", isEmergency: false),
            WatchPhrase(id: "fd-strawberry", label: "Strawberry", arasaacId: nil, sfSymbol: "fork.knife", isEmergency: false),
            WatchPhrase(id: "fd-blueberry", label: "Blueberry", arasaacId: nil, sfSymbol: "fork.knife", isEmergency: false),
            WatchPhrase(id: "fd-grapes", label: "Grapes", arasaacId: nil, sfSymbol: "fork.knife", isEmergency: false),
            WatchPhrase(id: "fd-watermelon", label: "Watermelon", arasaacId: nil, sfSymbol: "fork.knife", isEmergency: false),
            WatchPhrase(id: "fd-orange", label: "Orange", arasaacId: nil, sfSymbol: "fork.knife", isEmergency: false),
            WatchPhrase(id: "fd-pear", label: "Pear", arasaacId: nil, sfSymbol: "fork.knife", isEmergency: false),
            WatchPhrase(id: "fd-peach", label: "Peach", arasaacId: nil, sfSymbol: "fork.knife", isEmergency: false),
            WatchPhrase(id: "fd-mango", label: "Mango", arasaacId: nil, sfSymbol: "fork.knife", isEmergency: false),
            WatchPhrase(id: "fd-pineapple", label: "Pineapple", arasaacId: nil, sfSymbol: "fork.knife", isEmergency: false),
            WatchPhrase(id: "fd-cake", label: "Cake", arasaacId: nil, sfSymbol: "fork.knife", isEmergency: false),
            WatchPhrase(id: "fd-cupcake", label: "Cupcake", arasaacId: nil, sfSymbol: "fork.knife", isEmergency: false),
            WatchPhrase(id: "fd-brownie", label: "Brownie", arasaacId: nil, sfSymbol: "fork.knife", isEmergency: false),
            WatchPhrase(id: "fd-donut", label: "Donut", arasaacId: nil, sfSymbol: "fork.knife", isEmergency: false),
            WatchPhrase(id: "fd-muffin", label: "Muffin", arasaacId: nil, sfSymbol: "fork.knife", isEmergency: false),
            WatchPhrase(id: "fd-pie", label: "Pie", arasaacId: nil, sfSymbol: "fork.knife", isEmergency: false),
            WatchPhrase(id: "fd-pudding", label: "Pudding", arasaacId: nil, sfSymbol: "fork.knife", isEmergency: false),
            WatchPhrase(id: "fd-jello", label: "Jello", arasaacId: nil, sfSymbol: "fork.knife", isEmergency: false),
            WatchPhrase(id: "fd-candy", label: "Candy", arasaacId: nil, sfSymbol: "fork.knife", isEmergency: false),
            WatchPhrase(id: "fd-chocolate", label: "Chocolate", arasaacId: nil, sfSymbol: "fork.knife", isEmergency: false),
            WatchPhrase(id: "fd-lollipop", label: "Lollipop", arasaacId: nil, sfSymbol: "fork.knife", isEmergency: false),
            WatchPhrase(id: "fd-gum", label: "Gum", arasaacId: nil, sfSymbol: "fork.knife", isEmergency: false),
            WatchPhrase(id: "fd-soda", label: "Soda", arasaacId: nil, sfSymbol: "fork.knife", isEmergency: false),
            WatchPhrase(id: "fd-tea", label: "Tea", arasaacId: nil, sfSymbol: "fork.knife", isEmergency: false),
            WatchPhrase(id: "fd-hot-chocolate", label: "Hot chocolate", arasaacId: nil, sfSymbol: "fork.knife", isEmergency: false),
            WatchPhrase(id: "fd-lemonade", label: "Lemonade", arasaacId: nil, sfSymbol: "fork.knife", isEmergency: false),
            WatchPhrase(id: "fd-spoon", label: "Spoon", arasaacId: nil, sfSymbol: "fork.knife", isEmergency: false),
            WatchPhrase(id: "fd-fork", label: "Fork", arasaacId: nil, sfSymbol: "fork.knife", isEmergency: false),
            WatchPhrase(id: "fd-knife", label: "Knife", arasaacId: nil, sfSymbol: "fork.knife", isEmergency: false),
            WatchPhrase(id: "fd-plate", label: "Plate", arasaacId: nil, sfSymbol: "fork.knife", isEmergency: false),
            WatchPhrase(id: "fd-bowl", label: "Bowl", arasaacId: nil, sfSymbol: "fork.knife", isEmergency: false),
            WatchPhrase(id: "fd-cup", label: "Cup", arasaacId: nil, sfSymbol: "fork.knife", isEmergency: false),
            WatchPhrase(id: "fd-straw", label: "Straw", arasaacId: nil, sfSymbol: "fork.knife", isEmergency: false),
            WatchPhrase(id: "fd-napkin", label: "Napkin", arasaacId: nil, sfSymbol: "fork.knife", isEmergency: false),
            WatchPhrase(id: "fd-bib", label: "Bib", arasaacId: nil, sfSymbol: "fork.knife", isEmergency: false),
            WatchPhrase(id: "fd-open-it-please", label: "Open it please", arasaacId: nil, sfSymbol: "fork.knife", isEmergency: false),
            WatchPhrase(id: "fd-cut-it-up-please", label: "Cut it up please", arasaacId: nil, sfSymbol: "fork.knife", isEmergency: false),
            WatchPhrase(id: "fd-not-too-hot", label: "Not too hot", arasaacId: nil, sfSymbol: "fork.knife", isEmergency: false),
            WatchPhrase(id: "fd-i-am-allergic", label: "I am allergic", arasaacId: nil, sfSymbol: "fork.knife", isEmergency: false),
            WatchPhrase(id: "fm-breakfast", label: "Breakfast", arasaacId: nil, sfSymbol: "fork.knife", isEmergency: false),
            WatchPhrase(id: "fm-hamburger", label: "Hamburger", arasaacId: nil, sfSymbol: "fork.knife", isEmergency: false),
            WatchPhrase(id: "ff-strawberry", label: "Strawberry", arasaacId: nil, sfSymbol: "fork.knife", isEmergency: false),
            WatchPhrase(id: "ff-watermelon", label: "Watermelon", arasaacId: nil, sfSymbol: "fork.knife", isEmergency: false),
            WatchPhrase(id: "fv-broccoli", label: "Broccoli", arasaacId: nil, sfSymbol: "fork.knife", isEmergency: false),
            WatchPhrase(id: "fv-cucumber", label: "Cucumber", arasaacId: nil, sfSymbol: "fork.knife", isEmergency: false),
            WatchPhrase(id: "fd-lemonade-2", label: "Lemonade", arasaacId: nil, sfSymbol: "fork.knife", isEmergency: false),
            WatchPhrase(id: "fd-smoothie-2", label: "Smoothie", arasaacId: nil, sfSymbol: "fork.knife", isEmergency: false),
            WatchPhrase(id: "fs-crackers", label: "Crackers", arasaacId: nil, sfSymbol: "fork.knife", isEmergency: false),
            WatchPhrase(id: "fs-pretzels", label: "Pretzels", arasaacId: nil, sfSymbol: "fork.knife", isEmergency: false),
        ]),
        WatchCategory(id: "places-plans", icon: "mappin.and.ellipse", name: "Places", phrases: [
            WatchPhrase(id: "pl-home", label: "Home", arasaacId: nil, sfSymbol: "mappin.circle", isEmergency: false),
            WatchPhrase(id: "pl-school", label: "School", arasaacId: nil, sfSymbol: "mappin.circle", isEmergency: false),
            WatchPhrase(id: "pl-park", label: "Park", arasaacId: nil, sfSymbol: "mappin.circle", isEmergency: false),
            WatchPhrase(id: "pl-store", label: "Store", arasaacId: nil, sfSymbol: "mappin.circle", isEmergency: false),
            WatchPhrase(id: "pl-restaurant", label: "Restaurant", arasaacId: nil, sfSymbol: "mappin.circle", isEmergency: false),
            WatchPhrase(id: "pl-library", label: "Library", arasaacId: nil, sfSymbol: "mappin.circle", isEmergency: false),
            WatchPhrase(id: "pl-pool", label: "Pool", arasaacId: nil, sfSymbol: "mappin.circle", isEmergency: false),
            WatchPhrase(id: "pl-car", label: "Car", arasaacId: nil, sfSymbol: "mappin.circle", isEmergency: false),
            WatchPhrase(id: "pl-outside", label: "Outside", arasaacId: nil, sfSymbol: "mappin.circle", isEmergency: false),
            WatchPhrase(id: "pl-inside", label: "Inside", arasaacId: nil, sfSymbol: "mappin.circle", isEmergency: false),
            WatchPhrase(id: "pl-bathroom", label: "Bathroom", arasaacId: nil, sfSymbol: "mappin.circle", isEmergency: false),
            WatchPhrase(id: "pl-bedroom", label: "Bedroom", arasaacId: nil, sfSymbol: "mappin.circle", isEmergency: false),
            WatchPhrase(id: "pl-kitchen", label: "Kitchen", arasaacId: nil, sfSymbol: "mappin.circle", isEmergency: false),
            WatchPhrase(id: "pl-playground", label: "Playground", arasaacId: nil, sfSymbol: "mappin.circle", isEmergency: false),
            WatchPhrase(id: "pl-backyard", label: "Backyard", arasaacId: nil, sfSymbol: "mappin.circle", isEmergency: false),
            WatchPhrase(id: "pl-front-yard", label: "Front yard", arasaacId: nil, sfSymbol: "mappin.circle", isEmergency: false),
            WatchPhrase(id: "pl-garden", label: "Garden", arasaacId: nil, sfSymbol: "mappin.circle", isEmergency: false),
            WatchPhrase(id: "pl-driveway", label: "Driveway", arasaacId: nil, sfSymbol: "mappin.circle", isEmergency: false),
            WatchPhrase(id: "pl-living-room", label: "Living room", arasaacId: nil, sfSymbol: "mappin.circle", isEmergency: false),
            WatchPhrase(id: "pl-dining-room", label: "Dining room", arasaacId: nil, sfSymbol: "mappin.circle", isEmergency: false),
            WatchPhrase(id: "pl-garage", label: "Garage", arasaacId: nil, sfSymbol: "mappin.circle", isEmergency: false),
            WatchPhrase(id: "pl-basement", label: "Basement", arasaacId: nil, sfSymbol: "mappin.circle", isEmergency: false),
            WatchPhrase(id: "pl-attic", label: "Attic", arasaacId: nil, sfSymbol: "mappin.circle", isEmergency: false),
            WatchPhrase(id: "pl-hospital", label: "Hospital", arasaacId: nil, sfSymbol: "mappin.circle", isEmergency: false),
            WatchPhrase(id: "pl-doctor-office", label: "Doctor office", arasaacId: nil, sfSymbol: "mappin.circle", isEmergency: false),
            WatchPhrase(id: "pl-dentist-office", label: "Dentist office", arasaacId: nil, sfSymbol: "mappin.circle", isEmergency: false),
            WatchPhrase(id: "pl-pharmacy", label: "Pharmacy", arasaacId: nil, sfSymbol: "mappin.circle", isEmergency: false),
            WatchPhrase(id: "pl-grocery-store", label: "Grocery store", arasaacId: nil, sfSymbol: "mappin.circle", isEmergency: false),
            WatchPhrase(id: "pl-mall", label: "Mall", arasaacId: nil, sfSymbol: "mappin.circle", isEmergency: false),
            WatchPhrase(id: "pl-pet-store", label: "Pet store", arasaacId: nil, sfSymbol: "mappin.circle", isEmergency: false),
            WatchPhrase(id: "pl-toy-store", label: "Toy store", arasaacId: nil, sfSymbol: "mappin.circle", isEmergency: false),
            WatchPhrase(id: "pl-movie-theater", label: "Movie theater", arasaacId: nil, sfSymbol: "mappin.circle", isEmergency: false),
            WatchPhrase(id: "pl-bowling-alley", label: "Bowling alley", arasaacId: nil, sfSymbol: "mappin.circle", isEmergency: false),
            WatchPhrase(id: "pl-arcade", label: "Arcade", arasaacId: nil, sfSymbol: "mappin.circle", isEmergency: false),
            WatchPhrase(id: "pl-beach", label: "Beach", arasaacId: nil, sfSymbol: "mappin.circle", isEmergency: false),
            WatchPhrase(id: "pl-lake", label: "Lake", arasaacId: nil, sfSymbol: "mappin.circle", isEmergency: false),
            WatchPhrase(id: "pl-mountain", label: "Mountain", arasaacId: nil, sfSymbol: "mappin.circle", isEmergency: false),
            WatchPhrase(id: "pl-forest", label: "Forest", arasaacId: nil, sfSymbol: "mappin.circle", isEmergency: false),
            WatchPhrase(id: "pl-camp", label: "Camp", arasaacId: nil, sfSymbol: "mappin.circle", isEmergency: false),
            WatchPhrase(id: "pl-zoo", label: "Zoo", arasaacId: nil, sfSymbol: "mappin.circle", isEmergency: false),
            WatchPhrase(id: "pl-aquarium", label: "Aquarium", arasaacId: nil, sfSymbol: "mappin.circle", isEmergency: false),
            WatchPhrase(id: "pl-museum", label: "Museum", arasaacId: nil, sfSymbol: "mappin.circle", isEmergency: false),
            WatchPhrase(id: "pl-farm", label: "Farm", arasaacId: nil, sfSymbol: "mappin.circle", isEmergency: false),
            WatchPhrase(id: "pl-church", label: "Church", arasaacId: nil, sfSymbol: "mappin.circle", isEmergency: false),
            WatchPhrase(id: "pl-temple", label: "Temple", arasaacId: nil, sfSymbol: "mappin.circle", isEmergency: false),
            WatchPhrase(id: "pl-mosque", label: "Mosque", arasaacId: nil, sfSymbol: "mappin.circle", isEmergency: false),
            WatchPhrase(id: "pl-synagogue", label: "Synagogue", arasaacId: nil, sfSymbol: "mappin.circle", isEmergency: false),
            WatchPhrase(id: "pl-bus-stop", label: "Bus stop", arasaacId: nil, sfSymbol: "mappin.circle", isEmergency: false),
            WatchPhrase(id: "pl-train-station", label: "Train station", arasaacId: nil, sfSymbol: "mappin.circle", isEmergency: false),
            WatchPhrase(id: "pl-airport", label: "Airport", arasaacId: nil, sfSymbol: "mappin.circle", isEmergency: false),
            WatchPhrase(id: "pls-classroom", label: "Classroom", arasaacId: nil, sfSymbol: "mappin.circle", isEmergency: false),
            WatchPhrase(id: "pls-lunchroom", label: "Lunchroom", arasaacId: nil, sfSymbol: "mappin.circle", isEmergency: false),
            WatchPhrase(id: "plh-bathroom", label: "Bathroom", arasaacId: nil, sfSymbol: "mappin.circle", isEmergency: false),
            WatchPhrase(id: "plh-backyard", label: "Backyard", arasaacId: nil, sfSymbol: "mappin.circle", isEmergency: false),
            WatchPhrase(id: "plh-basement", label: "Basement", arasaacId: nil, sfSymbol: "mappin.circle", isEmergency: false),
            WatchPhrase(id: "plo-playground", label: "Playground", arasaacId: nil, sfSymbol: "mappin.circle", isEmergency: false),
            WatchPhrase(id: "plst-pharmacy", label: "Pharmacy", arasaacId: nil, sfSymbol: "mappin.circle", isEmergency: false),
        ]),
        WatchCategory(id: "school-work", icon: "book.fill", name: "School / Work", phrases: [
            WatchPhrase(id: "sw-class", label: "Class", arasaacId: nil, sfSymbol: "book", isEmergency: false),
            WatchPhrase(id: "sw-homework", label: "Homework", arasaacId: nil, sfSymbol: "book", isEmergency: false),
            WatchPhrase(id: "sw-computer", label: "Computer", arasaacId: nil, sfSymbol: "book", isEmergency: false),
            WatchPhrase(id: "sw-book", label: "Book", arasaacId: nil, sfSymbol: "book", isEmergency: false),
            WatchPhrase(id: "sw-pencil", label: "Pencil", arasaacId: nil, sfSymbol: "book", isEmergency: false),
            WatchPhrase(id: "sw-question", label: "I have a question", arasaacId: nil, sfSymbol: "book", isEmergency: false),
            WatchPhrase(id: "sw-help", label: "I need help with this", arasaacId: nil, sfSymbol: "book", isEmergency: false),
            WatchPhrase(id: "sw-paper", label: "Paper", arasaacId: nil, sfSymbol: "book", isEmergency: false),
            WatchPhrase(id: "sw-table", label: "Table", arasaacId: nil, sfSymbol: "book", isEmergency: false),
            WatchPhrase(id: "sw-chair", label: "Chair", arasaacId: nil, sfSymbol: "book", isEmergency: false),
            WatchPhrase(id: "sw-art", label: "Art", arasaacId: nil, sfSymbol: "book", isEmergency: false),
            WatchPhrase(id: "sw-music", label: "Music", arasaacId: nil, sfSymbol: "book", isEmergency: false),
            WatchPhrase(id: "sw-recess", label: "Recess", arasaacId: nil, sfSymbol: "book", isEmergency: false),
            WatchPhrase(id: "sw-backpack", label: "Backpack", arasaacId: nil, sfSymbol: "book", isEmergency: false),
            WatchPhrase(id: "sw-lunchbox", label: "Lunchbox", arasaacId: nil, sfSymbol: "book", isEmergency: false),
            WatchPhrase(id: "sw-folder", label: "Folder", arasaacId: nil, sfSymbol: "book", isEmergency: false),
            WatchPhrase(id: "sw-notebook", label: "Notebook", arasaacId: nil, sfSymbol: "book", isEmergency: false),
            WatchPhrase(id: "sw-crayons", label: "Crayons", arasaacId: nil, sfSymbol: "book", isEmergency: false),
            WatchPhrase(id: "sw-markers", label: "Markers", arasaacId: nil, sfSymbol: "book", isEmergency: false),
            WatchPhrase(id: "sw-scissors", label: "Scissors", arasaacId: nil, sfSymbol: "book", isEmergency: false),
            WatchPhrase(id: "sw-glue", label: "Glue", arasaacId: nil, sfSymbol: "book", isEmergency: false),
            WatchPhrase(id: "sw-tape", label: "Tape", arasaacId: nil, sfSymbol: "book", isEmergency: false),
            WatchPhrase(id: "sw-eraser", label: "Eraser", arasaacId: nil, sfSymbol: "book", isEmergency: false),
            WatchPhrase(id: "sw-ruler", label: "Ruler", arasaacId: nil, sfSymbol: "book", isEmergency: false),
            WatchPhrase(id: "sw-whiteboard", label: "Whiteboard", arasaacId: nil, sfSymbol: "book", isEmergency: false),
            WatchPhrase(id: "sw-smart-board", label: "Smart board", arasaacId: nil, sfSymbol: "book", isEmergency: false),
            WatchPhrase(id: "sw-projector", label: "Projector", arasaacId: nil, sfSymbol: "book", isEmergency: false),
            WatchPhrase(id: "sw-math", label: "Math", arasaacId: nil, sfSymbol: "book", isEmergency: false),
            WatchPhrase(id: "sw-reading", label: "Reading", arasaacId: nil, sfSymbol: "book", isEmergency: false),
            WatchPhrase(id: "sw-writing", label: "Writing", arasaacId: nil, sfSymbol: "book", isEmergency: false),
            WatchPhrase(id: "sw-spelling", label: "Spelling", arasaacId: nil, sfSymbol: "book", isEmergency: false),
            WatchPhrase(id: "sw-science", label: "Science", arasaacId: nil, sfSymbol: "book", isEmergency: false),
            WatchPhrase(id: "sw-social-studies", label: "Social studies", arasaacId: nil, sfSymbol: "book", isEmergency: false),
            WatchPhrase(id: "sw-history", label: "History", arasaacId: nil, sfSymbol: "book", isEmergency: false),
            WatchPhrase(id: "sw-pe", label: "PE", arasaacId: nil, sfSymbol: "book", isEmergency: false),
            WatchPhrase(id: "sw-gym", label: "Gym", arasaacId: nil, sfSymbol: "book", isEmergency: false),
            WatchPhrase(id: "sw-recess-time", label: "Recess time", arasaacId: nil, sfSymbol: "book", isEmergency: false),
            WatchPhrase(id: "sw-library-time", label: "Library time", arasaacId: nil, sfSymbol: "book", isEmergency: false),
            WatchPhrase(id: "sw-story-time", label: "Story time", arasaacId: nil, sfSymbol: "book", isEmergency: false),
            WatchPhrase(id: "sw-circle-time", label: "Circle time", arasaacId: nil, sfSymbol: "book", isEmergency: false),
            WatchPhrase(id: "sw-lunch-time", label: "Lunch time", arasaacId: nil, sfSymbol: "book", isEmergency: false),
            WatchPhrase(id: "sw-snack-time", label: "Snack time", arasaacId: nil, sfSymbol: "book", isEmergency: false),
            WatchPhrase(id: "sw-worksheet", label: "Worksheet", arasaacId: nil, sfSymbol: "book", isEmergency: false),
            WatchPhrase(id: "sw-quiz", label: "Quiz", arasaacId: nil, sfSymbol: "book", isEmergency: false),
            WatchPhrase(id: "sw-test", label: "Test", arasaacId: nil, sfSymbol: "book", isEmergency: false),
            WatchPhrase(id: "sw-project", label: "Project", arasaacId: nil, sfSymbol: "book", isEmergency: false),
            WatchPhrase(id: "sw-field-trip", label: "Field trip", arasaacId: nil, sfSymbol: "book", isEmergency: false),
            WatchPhrase(id: "sw-assembly", label: "Assembly", arasaacId: nil, sfSymbol: "book", isEmergency: false),
            WatchPhrase(id: "sw-bus-ride", label: "Bus ride", arasaacId: nil, sfSymbol: "book", isEmergency: false),
        ]),
        WatchCategory(id: "health-body", icon: "cross.case.fill", name: "Health / Body", phrases: [
            WatchPhrase(id: "hb-head", label: "Head", arasaacId: nil, sfSymbol: "cross", isEmergency: false),
            WatchPhrase(id: "hb-tummy", label: "Tummy", arasaacId: nil, sfSymbol: "cross", isEmergency: false),
            WatchPhrase(id: "hb-hand", label: "Hand", arasaacId: nil, sfSymbol: "cross", isEmergency: false),
            WatchPhrase(id: "hb-foot", label: "Foot", arasaacId: nil, sfSymbol: "cross", isEmergency: false),
            WatchPhrase(id: "hb-eye", label: "Eye", arasaacId: nil, sfSymbol: "cross", isEmergency: false),
            WatchPhrase(id: "hb-ear", label: "Ear", arasaacId: nil, sfSymbol: "cross", isEmergency: false),
            WatchPhrase(id: "hb-mouth", label: "Mouth", arasaacId: nil, sfSymbol: "cross", isEmergency: false),
            WatchPhrase(id: "hb-nose", label: "Nose", arasaacId: nil, sfSymbol: "cross", isEmergency: false),
            WatchPhrase(id: "hb-hurts", label: "It hurts", arasaacId: nil, sfSymbol: "cross", isEmergency: false),
            WatchPhrase(id: "hb-sick", label: "I feel sick", arasaacId: nil, sfSymbol: "cross", isEmergency: false),
            WatchPhrase(id: "hb-medicine", label: "Medicine", arasaacId: nil, sfSymbol: "cross", isEmergency: false),
            WatchPhrase(id: "hb-teeth", label: "Teeth", arasaacId: nil, sfSymbol: "cross", isEmergency: false),
            WatchPhrase(id: "hb-back", label: "Back", arasaacId: nil, sfSymbol: "cross", isEmergency: false),
            WatchPhrase(id: "hb-arm", label: "Arm", arasaacId: nil, sfSymbol: "cross", isEmergency: false),
            WatchPhrase(id: "hb-hair", label: "Hair", arasaacId: nil, sfSymbol: "cross", isEmergency: false),
            WatchPhrase(id: "hb-face", label: "Face", arasaacId: nil, sfSymbol: "cross", isEmergency: false),
            WatchPhrase(id: "hb-forehead", label: "Forehead", arasaacId: nil, sfSymbol: "cross", isEmergency: false),
            WatchPhrase(id: "hb-cheek", label: "Cheek", arasaacId: nil, sfSymbol: "cross", isEmergency: false),
            WatchPhrase(id: "hb-chin", label: "Chin", arasaacId: nil, sfSymbol: "cross", isEmergency: false),
            WatchPhrase(id: "hb-lips", label: "Lips", arasaacId: nil, sfSymbol: "cross", isEmergency: false),
            WatchPhrase(id: "hb-tongue", label: "Tongue", arasaacId: nil, sfSymbol: "cross", isEmergency: false),
            WatchPhrase(id: "hb-throat", label: "Throat", arasaacId: nil, sfSymbol: "cross", isEmergency: false),
            WatchPhrase(id: "hb-neck", label: "Neck", arasaacId: nil, sfSymbol: "cross", isEmergency: false),
            WatchPhrase(id: "hb-shoulder", label: "Shoulder", arasaacId: nil, sfSymbol: "cross", isEmergency: false),
            WatchPhrase(id: "hb-elbow", label: "Elbow", arasaacId: nil, sfSymbol: "cross", isEmergency: false),
            WatchPhrase(id: "hb-wrist", label: "Wrist", arasaacId: nil, sfSymbol: "cross", isEmergency: false),
            WatchPhrase(id: "hb-finger", label: "Finger", arasaacId: nil, sfSymbol: "cross", isEmergency: false),
            WatchPhrase(id: "hb-thumb", label: "Thumb", arasaacId: nil, sfSymbol: "cross", isEmergency: false),
            WatchPhrase(id: "hb-knuckle", label: "Knuckle", arasaacId: nil, sfSymbol: "cross", isEmergency: false),
            WatchPhrase(id: "hb-knee", label: "Knee", arasaacId: nil, sfSymbol: "cross", isEmergency: false),
            WatchPhrase(id: "hb-ankle", label: "Ankle", arasaacId: nil, sfSymbol: "cross", isEmergency: false),
            WatchPhrase(id: "hb-toe", label: "Toe", arasaacId: nil, sfSymbol: "cross", isEmergency: false),
            WatchPhrase(id: "hb-heel", label: "Heel", arasaacId: nil, sfSymbol: "cross", isEmergency: false),
            WatchPhrase(id: "hb-chest", label: "Chest", arasaacId: nil, sfSymbol: "cross", isEmergency: false),
            WatchPhrase(id: "hb-belly", label: "Belly", arasaacId: nil, sfSymbol: "cross", isEmergency: false),
            WatchPhrase(id: "hb-hip", label: "Hip", arasaacId: nil, sfSymbol: "cross", isEmergency: false),
            WatchPhrase(id: "hb-bottom", label: "Bottom", arasaacId: nil, sfSymbol: "cross", isEmergency: false),
            WatchPhrase(id: "hb-skin", label: "Skin", arasaacId: nil, sfSymbol: "cross", isEmergency: false),
            WatchPhrase(id: "hb-bone", label: "Bone", arasaacId: nil, sfSymbol: "cross", isEmergency: false),
            WatchPhrase(id: "hb-muscle", label: "Muscle", arasaacId: nil, sfSymbol: "cross", isEmergency: false),
            WatchPhrase(id: "hb-headache", label: "Headache", arasaacId: nil, sfSymbol: "cross", isEmergency: false),
            WatchPhrase(id: "hb-stomachache", label: "Stomachache", arasaacId: nil, sfSymbol: "cross", isEmergency: false),
            WatchPhrase(id: "hb-earache", label: "Earache", arasaacId: nil, sfSymbol: "cross", isEmergency: false),
            WatchPhrase(id: "hb-toothache", label: "Toothache", arasaacId: nil, sfSymbol: "cross", isEmergency: false),
            WatchPhrase(id: "hb-sore-throat", label: "Sore throat", arasaacId: nil, sfSymbol: "cross", isEmergency: false),
            WatchPhrase(id: "hb-cough", label: "Cough", arasaacId: nil, sfSymbol: "cross", isEmergency: false),
            WatchPhrase(id: "hb-sneeze", label: "Sneeze", arasaacId: nil, sfSymbol: "cross", isEmergency: false),
            WatchPhrase(id: "hb-runny-nose", label: "Runny nose", arasaacId: nil, sfSymbol: "cross", isEmergency: false),
            WatchPhrase(id: "hb-stuffy-nose", label: "Stuffy nose", arasaacId: nil, sfSymbol: "cross", isEmergency: false),
            WatchPhrase(id: "hb-fever", label: "Fever", arasaacId: nil, sfSymbol: "cross", isEmergency: false),
            WatchPhrase(id: "hb-chills", label: "Chills", arasaacId: nil, sfSymbol: "cross", isEmergency: false),
            WatchPhrase(id: "hb-shaking", label: "Shaking", arasaacId: nil, sfSymbol: "cross", isEmergency: false),
            WatchPhrase(id: "hb-dizzy-spell", label: "Dizzy spell", arasaacId: nil, sfSymbol: "cross", isEmergency: false),
            WatchPhrase(id: "hb-bruise", label: "Bruise", arasaacId: nil, sfSymbol: "cross", isEmergency: false),
            WatchPhrase(id: "hb-cut", label: "Cut", arasaacId: nil, sfSymbol: "cross", isEmergency: false),
            WatchPhrase(id: "hb-scrape", label: "Scrape", arasaacId: nil, sfSymbol: "cross", isEmergency: false),
            WatchPhrase(id: "hb-bump", label: "Bump", arasaacId: nil, sfSymbol: "cross", isEmergency: false),
            WatchPhrase(id: "hb-bandage", label: "Bandage", arasaacId: nil, sfSymbol: "cross", isEmergency: false),
            WatchPhrase(id: "hb-itchy-spot", label: "Itchy spot", arasaacId: nil, sfSymbol: "cross", isEmergency: false),
            WatchPhrase(id: "hb-rash", label: "Rash", arasaacId: nil, sfSymbol: "cross", isEmergency: false),
            WatchPhrase(id: "hb-allergic-reaction", label: "Allergic reaction", arasaacId: nil, sfSymbol: "cross", isEmergency: false),
            WatchPhrase(id: "hb-pain", label: "Pain", arasaacId: nil, sfSymbol: "cross", isEmergency: false),
            WatchPhrase(id: "hb-sharp-pain", label: "Sharp pain", arasaacId: nil, sfSymbol: "cross", isEmergency: false),
            WatchPhrase(id: "hb-dull-pain", label: "Dull pain", arasaacId: nil, sfSymbol: "cross", isEmergency: false),
            WatchPhrase(id: "hb-burning", label: "Burning", arasaacId: nil, sfSymbol: "cross", isEmergency: false),
            WatchPhrase(id: "hb-vitamins", label: "Vitamins", arasaacId: nil, sfSymbol: "cross", isEmergency: false),
            WatchPhrase(id: "hb-inhaler", label: "Inhaler", arasaacId: nil, sfSymbol: "cross", isEmergency: false),
            WatchPhrase(id: "hb-epipen", label: "EpiPen", arasaacId: nil, sfSymbol: "cross", isEmergency: false),
            WatchPhrase(id: "hb-pill", label: "Pill", arasaacId: nil, sfSymbol: "cross", isEmergency: false),
            WatchPhrase(id: "hb-drops", label: "Drops", arasaacId: nil, sfSymbol: "cross", isEmergency: false),
            WatchPhrase(id: "hb-doctor-visit", label: "Doctor visit", arasaacId: nil, sfSymbol: "cross", isEmergency: false),
            WatchPhrase(id: "hb-shot", label: "Shot", arasaacId: nil, sfSymbol: "cross", isEmergency: false),
            WatchPhrase(id: "hb-x-ray", label: "X-ray", arasaacId: nil, sfSymbol: "cross", isEmergency: false),
            WatchPhrase(id: "hb-check-up", label: "Check-up", arasaacId: nil, sfSymbol: "cross", isEmergency: false),
            WatchPhrase(id: "hb-wash-my-hands", label: "Wash my hands", arasaacId: nil, sfSymbol: "cross", isEmergency: false),
            WatchPhrase(id: "hb-brush-my-teeth", label: "Brush my teeth", arasaacId: nil, sfSymbol: "cross", isEmergency: false),
            WatchPhrase(id: "hr-wash-hands", label: "Wash hands", arasaacId: nil, sfSymbol: "cross", isEmergency: false),
        ]),
        WatchCategory(id: "time", icon: "clock.fill", name: "Time", phrases: [
            WatchPhrase(id: "ti-now", label: "Now", arasaacId: nil, sfSymbol: "clock", isEmergency: false),
            WatchPhrase(id: "ti-later", label: "Later", arasaacId: nil, sfSymbol: "clock", isEmergency: false),
            WatchPhrase(id: "ti-today", label: "Today", arasaacId: nil, sfSymbol: "clock", isEmergency: false),
            WatchPhrase(id: "ti-tomorrow", label: "Tomorrow", arasaacId: nil, sfSymbol: "clock", isEmergency: false),
            WatchPhrase(id: "ti-yesterday", label: "Yesterday", arasaacId: nil, sfSymbol: "clock", isEmergency: false),
            WatchPhrase(id: "ti-morning", label: "Morning", arasaacId: nil, sfSymbol: "clock", isEmergency: false),
            WatchPhrase(id: "ti-afternoon", label: "Afternoon", arasaacId: nil, sfSymbol: "clock", isEmergency: false),
            WatchPhrase(id: "ti-night", label: "Night", arasaacId: nil, sfSymbol: "clock", isEmergency: false),
            WatchPhrase(id: "ti-before", label: "Before", arasaacId: nil, sfSymbol: "clock", isEmergency: false),
            WatchPhrase(id: "ti-after", label: "After", arasaacId: nil, sfSymbol: "clock", isEmergency: false),
            WatchPhrase(id: "ti-first", label: "First", arasaacId: nil, sfSymbol: "clock", isEmergency: false),
            WatchPhrase(id: "ti-last", label: "Last", arasaacId: nil, sfSymbol: "clock", isEmergency: false),
            WatchPhrase(id: "ti-right-now", label: "Right now", arasaacId: nil, sfSymbol: "clock", isEmergency: false),
            WatchPhrase(id: "ti-in-a-minute", label: "In a minute", arasaacId: nil, sfSymbol: "clock", isEmergency: false),
            WatchPhrase(id: "ti-soon", label: "Soon", arasaacId: nil, sfSymbol: "clock", isEmergency: false),
            WatchPhrase(id: "ti-later-today", label: "Later today", arasaacId: nil, sfSymbol: "clock", isEmergency: false),
            WatchPhrase(id: "ti-tonight", label: "Tonight", arasaacId: nil, sfSymbol: "clock", isEmergency: false),
            WatchPhrase(id: "ti-this-morning", label: "This morning", arasaacId: nil, sfSymbol: "clock", isEmergency: false),
            WatchPhrase(id: "ti-this-afternoon", label: "This afternoon", arasaacId: nil, sfSymbol: "clock", isEmergency: false),
            WatchPhrase(id: "ti-this-evening", label: "This evening", arasaacId: nil, sfSymbol: "clock", isEmergency: false),
            WatchPhrase(id: "ti-last-night", label: "Last night", arasaacId: nil, sfSymbol: "clock", isEmergency: false),
            WatchPhrase(id: "ti-all-day", label: "All day", arasaacId: nil, sfSymbol: "clock", isEmergency: false),
            WatchPhrase(id: "ti-all-night", label: "All night", arasaacId: nil, sfSymbol: "clock", isEmergency: false),
            WatchPhrase(id: "ti-a-long-time", label: "A long time", arasaacId: nil, sfSymbol: "clock", isEmergency: false),
            WatchPhrase(id: "ti-a-short-time", label: "A short time", arasaacId: nil, sfSymbol: "clock", isEmergency: false),
            WatchPhrase(id: "ti-a-while-ago", label: "A while ago", arasaacId: nil, sfSymbol: "clock", isEmergency: false),
            WatchPhrase(id: "ti-weekend", label: "Weekend", arasaacId: nil, sfSymbol: "clock", isEmergency: false),
            WatchPhrase(id: "ti-weekday", label: "Weekday", arasaacId: nil, sfSymbol: "clock", isEmergency: false),
            WatchPhrase(id: "ti-monday", label: "Monday", arasaacId: nil, sfSymbol: "clock", isEmergency: false),
            WatchPhrase(id: "ti-tuesday", label: "Tuesday", arasaacId: nil, sfSymbol: "clock", isEmergency: false),
            WatchPhrase(id: "ti-wednesday", label: "Wednesday", arasaacId: nil, sfSymbol: "clock", isEmergency: false),
            WatchPhrase(id: "ti-thursday", label: "Thursday", arasaacId: nil, sfSymbol: "clock", isEmergency: false),
            WatchPhrase(id: "ti-friday", label: "Friday", arasaacId: nil, sfSymbol: "clock", isEmergency: false),
            WatchPhrase(id: "ti-saturday", label: "Saturday", arasaacId: nil, sfSymbol: "clock", isEmergency: false),
            WatchPhrase(id: "ti-sunday", label: "Sunday", arasaacId: nil, sfSymbol: "clock", isEmergency: false),
            WatchPhrase(id: "ti-birthday", label: "Birthday", arasaacId: nil, sfSymbol: "clock", isEmergency: false),
            WatchPhrase(id: "ti-holiday", label: "Holiday", arasaacId: nil, sfSymbol: "clock", isEmergency: false),
            WatchPhrase(id: "td-wednesday", label: "Wednesday", arasaacId: nil, sfSymbol: "clock", isEmergency: false),
            WatchPhrase(id: "td-yesterday", label: "Yesterday", arasaacId: nil, sfSymbol: "clock", isEmergency: false),
            WatchPhrase(id: "tm-jan", label: "January", arasaacId: nil, sfSymbol: "clock", isEmergency: false),
            WatchPhrase(id: "tm-feb", label: "February", arasaacId: nil, sfSymbol: "clock", isEmergency: false),
            WatchPhrase(id: "tm-mar", label: "March", arasaacId: nil, sfSymbol: "clock", isEmergency: false),
            WatchPhrase(id: "tm-apr", label: "April", arasaacId: nil, sfSymbol: "clock", isEmergency: false),
            WatchPhrase(id: "tm-may", label: "May", arasaacId: nil, sfSymbol: "clock", isEmergency: false),
            WatchPhrase(id: "tm-jun", label: "June", arasaacId: nil, sfSymbol: "clock", isEmergency: false),
            WatchPhrase(id: "tm-jul", label: "July", arasaacId: nil, sfSymbol: "clock", isEmergency: false),
            WatchPhrase(id: "tm-aug", label: "August", arasaacId: nil, sfSymbol: "clock", isEmergency: false),
            WatchPhrase(id: "tm-sep", label: "September", arasaacId: nil, sfSymbol: "clock", isEmergency: false),
            WatchPhrase(id: "tm-oct", label: "October", arasaacId: nil, sfSymbol: "clock", isEmergency: false),
            WatchPhrase(id: "tm-nov", label: "November", arasaacId: nil, sfSymbol: "clock", isEmergency: false),
            WatchPhrase(id: "tm-dec", label: "December", arasaacId: nil, sfSymbol: "clock", isEmergency: false),
            WatchPhrase(id: "tdate-10", label: "10th", arasaacId: nil, sfSymbol: "clock", isEmergency: false),
            WatchPhrase(id: "tdate-11", label: "11th", arasaacId: nil, sfSymbol: "clock", isEmergency: false),
            WatchPhrase(id: "tdate-12", label: "12th", arasaacId: nil, sfSymbol: "clock", isEmergency: false),
            WatchPhrase(id: "tdate-13", label: "13th", arasaacId: nil, sfSymbol: "clock", isEmergency: false),
            WatchPhrase(id: "tdate-14", label: "14th", arasaacId: nil, sfSymbol: "clock", isEmergency: false),
            WatchPhrase(id: "tdate-15", label: "15th", arasaacId: nil, sfSymbol: "clock", isEmergency: false),
            WatchPhrase(id: "tdate-16", label: "16th", arasaacId: nil, sfSymbol: "clock", isEmergency: false),
            WatchPhrase(id: "tdate-17", label: "17th", arasaacId: nil, sfSymbol: "clock", isEmergency: false),
            WatchPhrase(id: "tdate-18", label: "18th", arasaacId: nil, sfSymbol: "clock", isEmergency: false),
            WatchPhrase(id: "tdate-19", label: "19th", arasaacId: nil, sfSymbol: "clock", isEmergency: false),
            WatchPhrase(id: "tdate-20", label: "20th", arasaacId: nil, sfSymbol: "clock", isEmergency: false),
            WatchPhrase(id: "tdate-21", label: "21st", arasaacId: nil, sfSymbol: "clock", isEmergency: false),
            WatchPhrase(id: "tdate-22", label: "22nd", arasaacId: nil, sfSymbol: "clock", isEmergency: false),
            WatchPhrase(id: "tdate-23", label: "23rd", arasaacId: nil, sfSymbol: "clock", isEmergency: false),
            WatchPhrase(id: "tdate-24", label: "24th", arasaacId: nil, sfSymbol: "clock", isEmergency: false),
            WatchPhrase(id: "tdate-25", label: "25th", arasaacId: nil, sfSymbol: "clock", isEmergency: false),
            WatchPhrase(id: "tdate-26", label: "26th", arasaacId: nil, sfSymbol: "clock", isEmergency: false),
            WatchPhrase(id: "tdate-27", label: "27th", arasaacId: nil, sfSymbol: "clock", isEmergency: false),
            WatchPhrase(id: "tdate-28", label: "28th", arasaacId: nil, sfSymbol: "clock", isEmergency: false),
            WatchPhrase(id: "tdate-29", label: "29th", arasaacId: nil, sfSymbol: "clock", isEmergency: false),
            WatchPhrase(id: "tdate-30", label: "30th", arasaacId: nil, sfSymbol: "clock", isEmergency: false),
            WatchPhrase(id: "tdate-31", label: "31st", arasaacId: nil, sfSymbol: "clock", isEmergency: false),
        ]),
        WatchCategory(id: "animals", icon: "pawprint.fill", name: "Animals", phrases: [
            WatchPhrase(id: "an-dog", label: "Dog", arasaacId: nil, sfSymbol: "pawprint", isEmergency: false),
            WatchPhrase(id: "an-cat", label: "Cat", arasaacId: nil, sfSymbol: "pawprint", isEmergency: false),
            WatchPhrase(id: "an-fish", label: "Fish", arasaacId: nil, sfSymbol: "pawprint", isEmergency: false),
            WatchPhrase(id: "an-bird", label: "Bird", arasaacId: nil, sfSymbol: "pawprint", isEmergency: false),
            WatchPhrase(id: "an-horse", label: "Horse", arasaacId: nil, sfSymbol: "pawprint", isEmergency: false),
            WatchPhrase(id: "an-cow", label: "Cow", arasaacId: nil, sfSymbol: "pawprint", isEmergency: false),
            WatchPhrase(id: "an-pig", label: "Pig", arasaacId: nil, sfSymbol: "pawprint", isEmergency: false),
            WatchPhrase(id: "an-rabbit", label: "Rabbit", arasaacId: nil, sfSymbol: "pawprint", isEmergency: false),
            WatchPhrase(id: "an-bear", label: "Bear", arasaacId: nil, sfSymbol: "pawprint", isEmergency: false),
            WatchPhrase(id: "an-elephant", label: "Elephant", arasaacId: nil, sfSymbol: "pawprint", isEmergency: false),
            WatchPhrase(id: "an-duck", label: "Duck", arasaacId: nil, sfSymbol: "pawprint", isEmergency: false),
            WatchPhrase(id: "an-butterfly", label: "Butterfly", arasaacId: nil, sfSymbol: "pawprint", isEmergency: false),
            WatchPhrase(id: "an-puppy", label: "Puppy", arasaacId: nil, sfSymbol: "pawprint", isEmergency: false),
            WatchPhrase(id: "an-kitten", label: "Kitten", arasaacId: nil, sfSymbol: "pawprint", isEmergency: false),
            WatchPhrase(id: "an-hamster", label: "Hamster", arasaacId: nil, sfSymbol: "pawprint", isEmergency: false),
            WatchPhrase(id: "an-guinea-pig", label: "Guinea pig", arasaacId: nil, sfSymbol: "pawprint", isEmergency: false),
            WatchPhrase(id: "an-turtle", label: "Turtle", arasaacId: nil, sfSymbol: "pawprint", isEmergency: false),
            WatchPhrase(id: "an-frog", label: "Frog", arasaacId: nil, sfSymbol: "pawprint", isEmergency: false),
            WatchPhrase(id: "an-snake", label: "Snake", arasaacId: nil, sfSymbol: "pawprint", isEmergency: false),
            WatchPhrase(id: "an-lizard", label: "Lizard", arasaacId: nil, sfSymbol: "pawprint", isEmergency: false),
            WatchPhrase(id: "an-spider", label: "Spider", arasaacId: nil, sfSymbol: "pawprint", isEmergency: false),
            WatchPhrase(id: "an-bug", label: "Bug", arasaacId: nil, sfSymbol: "pawprint", isEmergency: false),
            WatchPhrase(id: "an-bee", label: "Bee", arasaacId: nil, sfSymbol: "pawprint", isEmergency: false),
            WatchPhrase(id: "an-ant", label: "Ant", arasaacId: nil, sfSymbol: "pawprint", isEmergency: false),
            WatchPhrase(id: "an-lion", label: "Lion", arasaacId: nil, sfSymbol: "pawprint", isEmergency: false),
            WatchPhrase(id: "an-tiger", label: "Tiger", arasaacId: nil, sfSymbol: "pawprint", isEmergency: false),
            WatchPhrase(id: "an-monkey", label: "Monkey", arasaacId: nil, sfSymbol: "pawprint", isEmergency: false),
            WatchPhrase(id: "an-giraffe", label: "Giraffe", arasaacId: nil, sfSymbol: "pawprint", isEmergency: false),
            WatchPhrase(id: "an-zebra", label: "Zebra", arasaacId: nil, sfSymbol: "pawprint", isEmergency: false),
            WatchPhrase(id: "an-hippo", label: "Hippo", arasaacId: nil, sfSymbol: "pawprint", isEmergency: false),
            WatchPhrase(id: "an-penguin", label: "Penguin", arasaacId: nil, sfSymbol: "pawprint", isEmergency: false),
            WatchPhrase(id: "an-owl", label: "Owl", arasaacId: nil, sfSymbol: "pawprint", isEmergency: false),
            WatchPhrase(id: "an-eagle", label: "Eagle", arasaacId: nil, sfSymbol: "pawprint", isEmergency: false),
            WatchPhrase(id: "an-parrot", label: "Parrot", arasaacId: nil, sfSymbol: "pawprint", isEmergency: false),
            WatchPhrase(id: "an-chicken", label: "Chicken", arasaacId: nil, sfSymbol: "pawprint", isEmergency: false),
            WatchPhrase(id: "an-rooster", label: "Rooster", arasaacId: nil, sfSymbol: "pawprint", isEmergency: false),
            WatchPhrase(id: "an-sheep", label: "Sheep", arasaacId: nil, sfSymbol: "pawprint", isEmergency: false),
            WatchPhrase(id: "an-goat", label: "Goat", arasaacId: nil, sfSymbol: "pawprint", isEmergency: false),
            WatchPhrase(id: "an-donkey", label: "Donkey", arasaacId: nil, sfSymbol: "pawprint", isEmergency: false),
            WatchPhrase(id: "an-dolphin", label: "Dolphin", arasaacId: nil, sfSymbol: "pawprint", isEmergency: false),
            WatchPhrase(id: "an-whale", label: "Whale", arasaacId: nil, sfSymbol: "pawprint", isEmergency: false),
            WatchPhrase(id: "an-shark", label: "Shark", arasaacId: nil, sfSymbol: "pawprint", isEmergency: false),
            WatchPhrase(id: "an-octopus", label: "Octopus", arasaacId: nil, sfSymbol: "pawprint", isEmergency: false),
            WatchPhrase(id: "an-crab", label: "Crab", arasaacId: nil, sfSymbol: "pawprint", isEmergency: false),
            WatchPhrase(id: "an-starfish", label: "Starfish", arasaacId: nil, sfSymbol: "pawprint", isEmergency: false),
            WatchPhrase(id: "an-my-pet", label: "My pet", arasaacId: nil, sfSymbol: "pawprint", isEmergency: false),
            WatchPhrase(id: "an-my-dog", label: "My dog", arasaacId: nil, sfSymbol: "pawprint", isEmergency: false),
            WatchPhrase(id: "an-my-cat", label: "My cat", arasaacId: nil, sfSymbol: "pawprint", isEmergency: false),
            WatchPhrase(id: "ap-hamster", label: "Hamster", arasaacId: nil, sfSymbol: "pawprint", isEmergency: false),
            WatchPhrase(id: "af-chicken", label: "Chicken", arasaacId: nil, sfSymbol: "pawprint", isEmergency: false),
            WatchPhrase(id: "aw-elephant", label: "Elephant", arasaacId: nil, sfSymbol: "pawprint", isEmergency: false),
            WatchPhrase(id: "ab-penguin", label: "Penguin", arasaacId: nil, sfSymbol: "pawprint", isEmergency: false),
            WatchPhrase(id: "ab-sparrow", label: "Sparrow", arasaacId: nil, sfSymbol: "pawprint", isEmergency: false),
            WatchPhrase(id: "as-starfish", label: "Starfish", arasaacId: nil, sfSymbol: "pawprint", isEmergency: false),
        ]),
        WatchCategory(id: "colors", icon: "paintpalette", name: "Colors", phrases: [
            WatchPhrase(id: "co-red", label: "Red", arasaacId: nil, sfSymbol: "circle.fill", isEmergency: false),
            WatchPhrase(id: "co-blue", label: "Blue", arasaacId: nil, sfSymbol: "circle.fill", isEmergency: false),
            WatchPhrase(id: "co-green", label: "Green", arasaacId: nil, sfSymbol: "circle.fill", isEmergency: false),
            WatchPhrase(id: "co-yellow", label: "Yellow", arasaacId: nil, sfSymbol: "circle.fill", isEmergency: false),
            WatchPhrase(id: "co-orange", label: "Orange", arasaacId: nil, sfSymbol: "circle.fill", isEmergency: false),
            WatchPhrase(id: "co-purple", label: "Purple", arasaacId: nil, sfSymbol: "circle.fill", isEmergency: false),
            WatchPhrase(id: "co-pink", label: "Pink", arasaacId: nil, sfSymbol: "circle.fill", isEmergency: false),
            WatchPhrase(id: "co-black", label: "Black", arasaacId: nil, sfSymbol: "circle.fill", isEmergency: false),
            WatchPhrase(id: "co-white", label: "White", arasaacId: nil, sfSymbol: "circle.fill", isEmergency: false),
            WatchPhrase(id: "co-brown", label: "Brown", arasaacId: nil, sfSymbol: "circle.fill", isEmergency: false),
            WatchPhrase(id: "co-gray", label: "Gray", arasaacId: nil, sfSymbol: "circle.fill", isEmergency: false),
            WatchPhrase(id: "co-silver", label: "Silver", arasaacId: nil, sfSymbol: "circle.fill", isEmergency: false),
            WatchPhrase(id: "co-gold", label: "Gold", arasaacId: nil, sfSymbol: "circle.fill", isEmergency: false),
            WatchPhrase(id: "co-beige", label: "Beige", arasaacId: nil, sfSymbol: "circle.fill", isEmergency: false),
            WatchPhrase(id: "co-tan", label: "Tan", arasaacId: nil, sfSymbol: "circle.fill", isEmergency: false),
            WatchPhrase(id: "co-light-blue", label: "Light blue", arasaacId: nil, sfSymbol: "circle.fill", isEmergency: false),
            WatchPhrase(id: "co-dark-blue", label: "Dark blue", arasaacId: nil, sfSymbol: "circle.fill", isEmergency: false),
            WatchPhrase(id: "co-light-green", label: "Light green", arasaacId: nil, sfSymbol: "circle.fill", isEmergency: false),
            WatchPhrase(id: "co-dark-green", label: "Dark green", arasaacId: nil, sfSymbol: "circle.fill", isEmergency: false),
            WatchPhrase(id: "co-light-pink", label: "Light pink", arasaacId: nil, sfSymbol: "circle.fill", isEmergency: false),
            WatchPhrase(id: "co-hot-pink", label: "Hot pink", arasaacId: nil, sfSymbol: "circle.fill", isEmergency: false),
            WatchPhrase(id: "co-rainbow", label: "Rainbow", arasaacId: nil, sfSymbol: "circle.fill", isEmergency: false),
            WatchPhrase(id: "co-my-favorite-color", label: "My favorite color", arasaacId: nil, sfSymbol: "circle.fill", isEmergency: false),
        ]),
        WatchCategory(id: "clothes", icon: "tshirt.fill", name: "Clothes", phrases: [
            WatchPhrase(id: "cl-shirt", label: "Shirt", arasaacId: nil, sfSymbol: "tshirt", isEmergency: false),
            WatchPhrase(id: "cl-pants", label: "Pants", arasaacId: nil, sfSymbol: "tshirt", isEmergency: false),
            WatchPhrase(id: "cl-shoes", label: "Shoes", arasaacId: nil, sfSymbol: "tshirt", isEmergency: false),
            WatchPhrase(id: "cl-socks", label: "Socks", arasaacId: nil, sfSymbol: "tshirt", isEmergency: false),
            WatchPhrase(id: "cl-jacket", label: "Jacket", arasaacId: nil, sfSymbol: "tshirt", isEmergency: false),
            WatchPhrase(id: "cl-hat", label: "Hat", arasaacId: nil, sfSymbol: "tshirt", isEmergency: false),
            WatchPhrase(id: "cl-dress", label: "Dress", arasaacId: nil, sfSymbol: "tshirt", isEmergency: false),
            WatchPhrase(id: "cl-pajamas", label: "Pajamas", arasaacId: nil, sfSymbol: "tshirt", isEmergency: false),
            WatchPhrase(id: "cl-underwear", label: "Underwear", arasaacId: nil, sfSymbol: "tshirt", isEmergency: false),
            WatchPhrase(id: "cl-boots", label: "Boots", arasaacId: nil, sfSymbol: "tshirt", isEmergency: false),
            WatchPhrase(id: "cl-t-shirt", label: "T-shirt", arasaacId: nil, sfSymbol: "tshirt", isEmergency: false),
            WatchPhrase(id: "cl-sweater", label: "Sweater", arasaacId: nil, sfSymbol: "tshirt", isEmergency: false),
            WatchPhrase(id: "cl-sweatshirt", label: "Sweatshirt", arasaacId: nil, sfSymbol: "tshirt", isEmergency: false),
            WatchPhrase(id: "cl-hoodie", label: "Hoodie", arasaacId: nil, sfSymbol: "tshirt", isEmergency: false),
            WatchPhrase(id: "cl-coat", label: "Coat", arasaacId: nil, sfSymbol: "tshirt", isEmergency: false),
            WatchPhrase(id: "cl-shorts", label: "Shorts", arasaacId: nil, sfSymbol: "tshirt", isEmergency: false),
            WatchPhrase(id: "cl-skirt", label: "Skirt", arasaacId: nil, sfSymbol: "tshirt", isEmergency: false),
            WatchPhrase(id: "cl-leggings", label: "Leggings", arasaacId: nil, sfSymbol: "tshirt", isEmergency: false),
            WatchPhrase(id: "cl-sandals", label: "Sandals", arasaacId: nil, sfSymbol: "tshirt", isEmergency: false),
            WatchPhrase(id: "cl-sneakers", label: "Sneakers", arasaacId: nil, sfSymbol: "tshirt", isEmergency: false),
            WatchPhrase(id: "cl-mittens", label: "Mittens", arasaacId: nil, sfSymbol: "tshirt", isEmergency: false),
            WatchPhrase(id: "cl-gloves", label: "Gloves", arasaacId: nil, sfSymbol: "tshirt", isEmergency: false),
            WatchPhrase(id: "cl-scarf", label: "Scarf", arasaacId: nil, sfSymbol: "tshirt", isEmergency: false),
            WatchPhrase(id: "cl-belt", label: "Belt", arasaacId: nil, sfSymbol: "tshirt", isEmergency: false),
            WatchPhrase(id: "cl-backpack", label: "Backpack", arasaacId: nil, sfSymbol: "tshirt", isEmergency: false),
            WatchPhrase(id: "cl-helmet", label: "Helmet", arasaacId: nil, sfSymbol: "tshirt", isEmergency: false),
            WatchPhrase(id: "cl-glasses", label: "Glasses", arasaacId: nil, sfSymbol: "tshirt", isEmergency: false),
            WatchPhrase(id: "cl-sunglasses", label: "Sunglasses", arasaacId: nil, sfSymbol: "tshirt", isEmergency: false),
            WatchPhrase(id: "cl-diaper", label: "Diaper", arasaacId: nil, sfSymbol: "tshirt", isEmergency: false),
            WatchPhrase(id: "cl-pull-up", label: "Pull-up", arasaacId: nil, sfSymbol: "tshirt", isEmergency: false),
        ]),
        WatchCategory(id: "transport", icon: "car.fill", name: "Transportation", phrases: [
            WatchPhrase(id: "tr-car", label: "Car", arasaacId: nil, sfSymbol: "car", isEmergency: false),
            WatchPhrase(id: "tr-bus", label: "Bus", arasaacId: nil, sfSymbol: "car", isEmergency: false),
            WatchPhrase(id: "tr-train", label: "Train", arasaacId: nil, sfSymbol: "car", isEmergency: false),
            WatchPhrase(id: "tr-airplane", label: "Airplane", arasaacId: nil, sfSymbol: "car", isEmergency: false),
            WatchPhrase(id: "tr-bike", label: "Bike", arasaacId: nil, sfSymbol: "car", isEmergency: false),
            WatchPhrase(id: "tr-truck", label: "Truck", arasaacId: nil, sfSymbol: "car", isEmergency: false),
            WatchPhrase(id: "tr-boat", label: "Boat", arasaacId: nil, sfSymbol: "car", isEmergency: false),
            WatchPhrase(id: "tr-walk", label: "Walk", arasaacId: nil, sfSymbol: "car", isEmergency: false),
            WatchPhrase(id: "tr-wheelchair", label: "Wheelchair", arasaacId: nil, sfSymbol: "car", isEmergency: false),
            WatchPhrase(id: "tr-scooter", label: "Scooter", arasaacId: nil, sfSymbol: "car", isEmergency: false),
            WatchPhrase(id: "tr-stroller", label: "Stroller", arasaacId: nil, sfSymbol: "car", isEmergency: false),
            WatchPhrase(id: "tr-tricycle", label: "Tricycle", arasaacId: nil, sfSymbol: "car", isEmergency: false),
            WatchPhrase(id: "tr-skateboard", label: "Skateboard", arasaacId: nil, sfSymbol: "car", isEmergency: false),
            WatchPhrase(id: "tr-roller-skates", label: "Roller skates", arasaacId: nil, sfSymbol: "car", isEmergency: false),
            WatchPhrase(id: "tr-subway", label: "Subway", arasaacId: nil, sfSymbol: "car", isEmergency: false),
            WatchPhrase(id: "tr-taxi", label: "Taxi", arasaacId: nil, sfSymbol: "car", isEmergency: false),
            WatchPhrase(id: "tr-helicopter", label: "Helicopter", arasaacId: nil, sfSymbol: "car", isEmergency: false),
            WatchPhrase(id: "tr-rocket", label: "Rocket", arasaacId: nil, sfSymbol: "car", isEmergency: false),
            WatchPhrase(id: "tr-tractor", label: "Tractor", arasaacId: nil, sfSymbol: "car", isEmergency: false),
            WatchPhrase(id: "tr-fire-truck", label: "Fire truck", arasaacId: nil, sfSymbol: "car", isEmergency: false),
            WatchPhrase(id: "tr-police-car", label: "Police car", arasaacId: nil, sfSymbol: "car", isEmergency: false),
            WatchPhrase(id: "tr-ambulance", label: "Ambulance", arasaacId: nil, sfSymbol: "car", isEmergency: false),
            WatchPhrase(id: "tr-ferry", label: "Ferry", arasaacId: nil, sfSymbol: "car", isEmergency: false),
            WatchPhrase(id: "tr-sled", label: "Sled", arasaacId: nil, sfSymbol: "car", isEmergency: false),
            WatchPhrase(id: "tr-drive", label: "Drive", arasaacId: nil, sfSymbol: "car", isEmergency: false),
            WatchPhrase(id: "tr-ride", label: "Ride", arasaacId: nil, sfSymbol: "car", isEmergency: false),
        ]),
        WatchCategory(id: "weather", icon: "cloud.sun.fill", name: "Weather", phrases: [
            WatchPhrase(id: "we-sunny", label: "Sunny", arasaacId: nil, sfSymbol: "cloud", isEmergency: false),
            WatchPhrase(id: "we-rainy", label: "Rainy", arasaacId: nil, sfSymbol: "cloud", isEmergency: false),
            WatchPhrase(id: "we-cloudy", label: "Cloudy", arasaacId: nil, sfSymbol: "cloud", isEmergency: false),
            WatchPhrase(id: "we-snowy", label: "Snowy", arasaacId: nil, sfSymbol: "cloud", isEmergency: false),
            WatchPhrase(id: "we-windy", label: "Windy", arasaacId: nil, sfSymbol: "cloud", isEmergency: false),
            WatchPhrase(id: "we-hot", label: "Hot", arasaacId: nil, sfSymbol: "cloud", isEmergency: false),
            WatchPhrase(id: "we-cold", label: "Cold", arasaacId: nil, sfSymbol: "cloud", isEmergency: false),
            WatchPhrase(id: "we-storm", label: "Storm", arasaacId: nil, sfSymbol: "cloud", isEmergency: false),
            WatchPhrase(id: "we-foggy", label: "Foggy", arasaacId: nil, sfSymbol: "cloud", isEmergency: false),
            WatchPhrase(id: "we-rainbow", label: "Rainbow", arasaacId: nil, sfSymbol: "cloud", isEmergency: false),
            WatchPhrase(id: "we-lightning", label: "Lightning", arasaacId: nil, sfSymbol: "cloud", isEmergency: false),
            WatchPhrase(id: "we-thunder", label: "Thunder", arasaacId: nil, sfSymbol: "cloud", isEmergency: false),
            WatchPhrase(id: "we-tornado", label: "Tornado", arasaacId: nil, sfSymbol: "cloud", isEmergency: false),
            WatchPhrase(id: "we-hurricane", label: "Hurricane", arasaacId: nil, sfSymbol: "cloud", isEmergency: false),
            WatchPhrase(id: "we-earthquake", label: "Earthquake", arasaacId: nil, sfSymbol: "cloud", isEmergency: false),
            WatchPhrase(id: "we-warm-out", label: "Warm out", arasaacId: nil, sfSymbol: "cloud", isEmergency: false),
            WatchPhrase(id: "we-cool-out", label: "Cool out", arasaacId: nil, sfSymbol: "cloud", isEmergency: false),
            WatchPhrase(id: "we-freezing", label: "Freezing", arasaacId: nil, sfSymbol: "cloud", isEmergency: false),
            WatchPhrase(id: "we-wear-a-coat", label: "Wear a coat", arasaacId: nil, sfSymbol: "cloud", isEmergency: false),
            WatchPhrase(id: "we-wear-shorts", label: "Wear shorts", arasaacId: nil, sfSymbol: "cloud", isEmergency: false),
        ]),
        WatchCategory(id: "toys-fun", icon: "gamecontroller.fill", name: "Toys & Fun", phrases: [
            WatchPhrase(id: "tf-ball", label: "Ball", arasaacId: nil, sfSymbol: "gamecontroller", isEmergency: false),
            WatchPhrase(id: "tf-blocks", label: "Blocks", arasaacId: nil, sfSymbol: "gamecontroller", isEmergency: false),
            WatchPhrase(id: "tf-doll", label: "Doll", arasaacId: nil, sfSymbol: "gamecontroller", isEmergency: false),
            WatchPhrase(id: "tf-puzzle", label: "Puzzle", arasaacId: nil, sfSymbol: "gamecontroller", isEmergency: false),
            WatchPhrase(id: "tf-game", label: "Game", arasaacId: nil, sfSymbol: "gamecontroller", isEmergency: false),
            WatchPhrase(id: "tf-movie", label: "Movie", arasaacId: nil, sfSymbol: "gamecontroller", isEmergency: false),
            WatchPhrase(id: "tf-music", label: "Music", arasaacId: nil, sfSymbol: "gamecontroller", isEmergency: false),
            WatchPhrase(id: "tf-bubbles", label: "Bubbles", arasaacId: nil, sfSymbol: "gamecontroller", isEmergency: false),
            WatchPhrase(id: "tf-swing", label: "Swing", arasaacId: nil, sfSymbol: "gamecontroller", isEmergency: false),
            WatchPhrase(id: "tf-slide", label: "Slide", arasaacId: nil, sfSymbol: "gamecontroller", isEmergency: false),
            WatchPhrase(id: "tf-coloring", label: "Coloring", arasaacId: nil, sfSymbol: "gamecontroller", isEmergency: false),
            WatchPhrase(id: "tf-tablet", label: "Tablet", arasaacId: nil, sfSymbol: "gamecontroller", isEmergency: false),
            WatchPhrase(id: "tf-stuffed-animal", label: "Stuffed animal", arasaacId: nil, sfSymbol: "gamecontroller", isEmergency: false),
            WatchPhrase(id: "tf-action-figure", label: "Action figure", arasaacId: nil, sfSymbol: "gamecontroller", isEmergency: false),
            WatchPhrase(id: "tf-lego", label: "Lego", arasaacId: nil, sfSymbol: "gamecontroller", isEmergency: false),
            WatchPhrase(id: "tf-train-set", label: "Train set", arasaacId: nil, sfSymbol: "gamecontroller", isEmergency: false),
            WatchPhrase(id: "tf-card-game", label: "Card game", arasaacId: nil, sfSymbol: "gamecontroller", isEmergency: false),
            WatchPhrase(id: "tf-board-game", label: "Board game", arasaacId: nil, sfSymbol: "gamecontroller", isEmergency: false),
            WatchPhrase(id: "tf-video-game", label: "Video game", arasaacId: nil, sfSymbol: "gamecontroller", isEmergency: false),
            WatchPhrase(id: "tf-crayons", label: "Crayons", arasaacId: nil, sfSymbol: "gamecontroller", isEmergency: false),
            WatchPhrase(id: "tf-stickers", label: "Stickers", arasaacId: nil, sfSymbol: "gamecontroller", isEmergency: false),
            WatchPhrase(id: "tf-sandbox", label: "Sandbox", arasaacId: nil, sfSymbol: "gamecontroller", isEmergency: false),
            WatchPhrase(id: "tf-trampoline", label: "Trampoline", arasaacId: nil, sfSymbol: "gamecontroller", isEmergency: false),
            WatchPhrase(id: "tf-sprinkler", label: "Sprinkler", arasaacId: nil, sfSymbol: "gamecontroller", isEmergency: false),
            WatchPhrase(id: "tf-story", label: "Story", arasaacId: nil, sfSymbol: "gamecontroller", isEmergency: false),
            WatchPhrase(id: "tf-song", label: "Song", arasaacId: nil, sfSymbol: "gamecontroller", isEmergency: false),
            WatchPhrase(id: "tf-cartoon", label: "Cartoon", arasaacId: nil, sfSymbol: "gamecontroller", isEmergency: false),
        ]),
    ]
}
