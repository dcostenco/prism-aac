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
    /// Legacy alias.
    var language: String { outputLanguage }
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
        KeychainHelper.shared.write(value: safeInput,  service: "prism-aac", account: "watchInputLanguage")
        KeychainHelper.shared.write(value: safeOutput, service: "prism-aac", account: "watchOutputLanguage")
        Task { await loadFromAPI(lang: safeInput) }   // vocab labels in INPUT lang
    }

    /// Shorthand: set only output language (input unchanged).
    func setLanguage(_ lang: String) {
        setLanguages(input: inputLanguage, output: lang)
    }

    enum Source { case offline, companion, cloud }

    private let apiBase = "https://synalux.ai/api/v1/prism-aac"

    override init() {
        super.init()
        // Restore saved language pair — #15: stored in Keychain (PII-adjacent), validated against allowlist
        if let inp = KeychainHelper.shared.read(service: "prism-aac", account: "watchInputLanguage"),
           Self.allowedLangs.contains(inp) { inputLanguage = inp }
        if let out = KeychainHelper.shared.read(service: "prism-aac", account: "watchOutputLanguage"),
           Self.allowedLangs.contains(out) { outputLanguage = out }
        // FIX 3: Register with router instead of setting WCSession.default.delegate = self
        WCSessionRouter.shared.registerMessageHandler(for: "vocab_update") { [weak self] _, msg in
            Task { @MainActor in self?.handleVocabReply(msg) }
        }
        // Also handle vocabulary pushed from iPhone on activation (companion path)
        WCSessionRouter.shared.registerMessageHandler(for: "vocabulary") { [weak self] _, msg in
            Task { @MainActor in self?.handleVocabReply(msg) }
        }
        Task { await loadFromAPI(lang: inputLanguage) }
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

    func loadFromAPI(lang: String? = nil) async {
        let targetLang = lang ?? language

        // Validate language code against allowlist before using in URL
        guard WatchVocabSync.allowedLangs.contains(targetLang) else {
            NSLog("[VocabSync] Unsupported language: \(targetLang)")
            return
        }

        guard var components = URLComponents(string: "\(apiBase)/vocabulary") else { return }
        components.queryItems = [URLQueryItem(name: "lang", value: targetLang)]
        guard let url = components.url else { return }

        var req = URLRequest(url: url, cachePolicy: .reloadIgnoringLocalCacheData, timeoutInterval: 10)
        if let token = KeychainHelper.shared.read(service: "prism-aac", account: "auth-token") {
            req.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
        }

        do {
            let (data, response) = try await URLSession.shared.data(for: req)
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
                    VocabPhrase(id: ph.id,
                                label: String(ph.label.prefix(120)),
                                arasaacId: ph.arasaacId,
                                sfSymbol: ph.sfSymbol)
                }
                return WatchCategory(from: VocabCategory(id: cat.id,
                                                         icon: String(cat.icon.prefix(4)),
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
        // #8: size check BEFORE decode — prevents JSON bomb allocation
        guard let data = reply["vocab"] as? Data else { return }
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
            let isEmergencyCat = cat.id == "emergency" || cat.id == "help-needs"
            return WatchCategory(
                id: cat.id,
                icon: String(cat.icon.prefix(4)),
                name: String(cat.name.prefix(120)),
                phrases: cat.phrases.prefix(100).map { ph in
                    WatchPhrase(id: ph.id, label: String(ph.label.prefix(120)),
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
        id = c.id; icon = c.icon; name = c.name
        // #10: mark phrases as emergency when they come from an emergency category
        let isEmergencyCat = c.id == "emergency" || c.id == "help-needs"
        phrases = c.phrases.map {
            WatchPhrase(id: $0.id, label: $0.label,
                        arasaacId: $0.arasaacId,
                        sfSymbol: $0.sfSymbol ?? "circle.fill",
                        isEmergency: isEmergencyCat)
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
            WatchPhrase(id: "hurt",  label: "Hurt",     arasaacId: nil,  sfSymbol: "cross.fill"),
        ]),
    ]
}
