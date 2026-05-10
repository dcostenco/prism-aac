import Foundation
import WatchConnectivity

/// Syncs vocabulary from the web app to the Watch.
///
/// Two paths:
///   1. WatchConnectivity → iPhone sends user's current vocabulary
///   2. Direct API call → synalux.ai/api/v1/prism-aac/vocabulary (standalone, WiFi/LTE)
///
/// Falls back to a minimal offline core if both unavailable.
@MainActor
final class WatchVocabSync: NSObject, ObservableObject, WCSessionDelegate {

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
        inputLanguage = input
        outputLanguage = output
        UserDefaults.standard.set(input,  forKey: "watchInputLanguage")
        UserDefaults.standard.set(output, forKey: "watchOutputLanguage")
        Task { await loadFromAPI(lang: input) }   // vocab labels in INPUT lang
    }

    /// Shorthand: set only output language (input unchanged).
    func setLanguage(_ lang: String) {
        setLanguages(input: inputLanguage, output: lang)
    }

    enum Source { case offline, companion, cloud }

    private let apiBase = "https://synalux.ai/api/v1/prism-aac"

    override init() {
        super.init()
        // Restore saved language pair
        if let inp = UserDefaults.standard.string(forKey: "watchInputLanguage")  { inputLanguage  = inp }
        if let out = UserDefaults.standard.string(forKey: "watchOutputLanguage") { outputLanguage = out }
        // Legacy single-key migration
        if inputLanguage == "en-US", let legacy = UserDefaults.standard.string(forKey: "watchLanguage") {
            inputLanguage = legacy; outputLanguage = legacy
        }
        if WCSession.isSupported() {
            WCSession.default.delegate = self
            WCSession.default.activate()
        }
        Task { await loadFromAPI(lang: language) }
    }

    // MARK: - Load from web app API (standalone path)

    func loadFromAPI(lang: String? = nil) async {
        let targetLang = lang ?? language
        var components = URLComponents(string: "\(apiBase)/vocabulary")
        components?.queryItems = [URLQueryItem(name: "lang", value: targetLang)]
        guard let url = components?.url else { return }
        do {
            let (data, _) = try await URLSession.shared.data(from: url)
            let vocab = try JSONDecoder().decode(VocabResponse.self, from: data)
            categories = vocab.categories.map { WatchCategory(from: $0) }
            vocabLanguage = vocab.language   // labels are in this language
            source = .cloud
        } catch {
            // Keep offline core — never leave user without communication
        }
    }

    // MARK: - WatchConnectivity (companion path, faster)

    nonisolated func session(_ session: WCSession, activationDidCompleteWith state: WCSessionActivationState, error: Error?) {
        if state == .activated {
            // Request vocabulary from iPhone
            if session.isReachable {
                session.sendMessage(["type": "requestVocabulary"], replyHandler: { reply in
                    Task { @MainActor [weak self] in
                        self?.handleVocabReply(reply)
                    }
                }, errorHandler: nil)
            }
        }
    }

    nonisolated func session(_ session: WCSession, didReceiveMessage message: [String: Any]) {
        if message["type"] as? String == "vocabulary" {
            Task { @MainActor [weak self] in self?.handleVocabReply(message) }
        }
    }

    private func handleVocabReply(_ reply: [String: Any]) {
        guard let data = reply["vocab"] as? Data,
              let vocab = try? JSONDecoder().decode(VocabResponse.self, from: data) else { return }
        categories = vocab.categories.map { WatchCategory(from: $0) }
        outputLanguage = vocab.language
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
        phrases = c.phrases.map { WatchPhrase(id: $0.id, label: $0.label,
                                               arasaacId: $0.arasaacId,
                                               sfSymbol: $0.sfSymbol ?? "circle.fill") }
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
