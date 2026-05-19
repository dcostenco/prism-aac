import Foundation

/// Central security policy for the WKWebView native bridge.
///
/// Extracted from the nested Coordinator so every rule can be unit-tested
/// in isolation — no WKWebView, no simulator, no network required.
///
/// ALL security checks that gate sensitive bridge actions must live here.
/// Adding a new bridge action without adding a corresponding test in
/// BridgeSecurityTests is a protocol violation.
enum BridgeSecurityPolicy {

    // MARK: - Origin allow-list

    /// Returns true only for origins we control.
    /// Rule: synalux.ai (apex) + *.synalux.ai (subdomains, e.g. staging)
    /// + localhost in DEBUG builds (dev server on port 3001).
    ///
    /// Attack surface closed: typosquats (synalux.ai.evil.com),
    /// prefix matches (notsynalux.ai), nil host (file://, data: URIs).
    static func isAllowedOrigin(_ url: URL) -> Bool {
        guard let host = url.host, !host.isEmpty else { return false }
        if host == "synalux.ai" { return true }
        if host.hasSuffix(".synalux.ai") { return true }
        #if DEBUG
        if host == "localhost" { return true }
        #endif
        return false
    }

    // MARK: - Rate-limit thresholds

    /// 30 s between emergency triggers — prevents accidental or
    /// scripted spam from draining battery / flooding caregiver alerts.
    static let emergencyRateLimitSeconds: TimeInterval = 30

    /// 0.5 s between startVoice calls — debounce for rapid taps.
    static let startVoiceRateLimitSeconds: TimeInterval = 0.5

    /// 1 s between askAI calls — prevents rapid-fire cancellation storms.
    /// AACPipeline already cancels the previous task, but this prevents
    /// the bridge being used as an unbounded task-creation loop.
    static let askAIRateLimitSeconds: TimeInterval = 1.0

    // MARK: - Input length caps
    // Every cap is a named constant so tests can pin the exact value.
    // Never use bare prefix(N) literals in bridge handlers — use these.

    static let maxSpeakTextLength        = 2_000
    static let maxEmergencyPhraseLength  = 500
    static let maxAskAIQuestionLength    = 500
    static let maxSpeechTranscriptLength = 2_000
    static let maxLangTagLength          = 11   // "zh-Hans-CN" = 10 chars
    static let maxSettingsSectionLength  = 50

    // MARK: - Settings URL builder (whitelist-only)

    /// Produces a `prefs:` URL for the given section keyword.
    ///
    /// Security guarantee: `rawSection` is NEVER string-interpolated into
    /// the output URL.  Unknown / attacker-controlled values fall through to
    /// the Accessibility root so no arbitrary `prefs:` path can be opened.
    ///
    /// Returns nil only if URL(string:) fails, which cannot happen for these
    /// hardcoded strings — callers may force-unwrap safely, but the nil path
    /// is kept for future-proofing.
    static func settingsURL(for rawSection: String) -> URL? {
        let urlString: String
        switch rawSection {
        case "speech":        urlString = "prefs:root=ACCESSIBILITY&path=SPEECH"
        case "voiceControl":  urlString = "prefs:root=ACCESSIBILITY&path=VOICECONTROL"
        case "switchControl": urlString = "prefs:root=ACCESSIBILITY&path=SWITCH_CONTROL"
        default:              urlString = "prefs:root=ACCESSIBILITY"
        }
        return URL(string: urlString)
    }

    // MARK: - Language tag validator

    // Pattern: 2–3 alpha chars, optional hyphen + 2–8 alphanumeric chars.
    // Rejects anything that contains <, >, /, \, or path-traversal sequences.
    private static let langRegex = try! NSRegularExpression(
        pattern: #"^[a-zA-Z]{2,3}(-[a-zA-Z0-9]{2,8})?$"#
    )

    static func isValidLang(_ tag: String) -> Bool {
        let safe = String(tag.prefix(maxLangTagLength))
        guard !safe.isEmpty else { return false }
        let range = NSRange(safe.startIndex..., in: safe)
        return langRegex.firstMatch(in: safe, range: range) != nil
    }
}
