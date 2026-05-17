import XCTest
@testable import PrismAAC

/// Unit tests for BridgeSecurityPolicy — the central security gate for all
/// WKWebView ↔ Swift bridge actions.
///
/// Tests run on the host without a WKWebView, simulator, or network.
/// Every named constant, every whitelist rule, and every validator must
/// have at least one passing test and one failing test (positive + negative).
final class BridgeSecurityTests: XCTestCase {

    // MARK: - isAllowedOrigin — trusted origins

    func test_origin_synaluxAI_apex_allowed() {
        XCTAssertTrue(BridgeSecurityPolicy.isAllowedOrigin(url("https://synalux.ai/prism-aac")))
    }

    func test_origin_synaluxAI_apex_http_allowed() {
        // http is still a valid scheme; the security gate is the host, not the scheme.
        // In practice WKWebView will upgrade to HTTPS but origin checks must not rely on that.
        XCTAssertTrue(BridgeSecurityPolicy.isAllowedOrigin(url("http://synalux.ai/prism-aac")))
    }

    func test_origin_staging_subdomain_allowed() {
        XCTAssertTrue(BridgeSecurityPolicy.isAllowedOrigin(url("https://staging.synalux.ai")))
    }

    func test_origin_deep_subdomain_allowed() {
        XCTAssertTrue(BridgeSecurityPolicy.isAllowedOrigin(url("https://dev.us.synalux.ai")))
    }

    // MARK: - isAllowedOrigin — blocked origins (attack vectors)

    func test_origin_evil_com_blocked() {
        XCTAssertFalse(BridgeSecurityPolicy.isAllowedOrigin(url("https://evil.com")))
    }

    func test_origin_synalux_lookalike_subpath_blocked() {
        // "synalux.ai.evil.com" must NOT pass the suffix check
        XCTAssertFalse(BridgeSecurityPolicy.isAllowedOrigin(url("https://synalux.ai.evil.com")))
    }

    func test_origin_prefix_match_blocked() {
        // "notsynalux.ai" shares the suffix "synalux.ai" but must NOT be allowed.
        // The check uses hasSuffix(".synalux.ai") with a leading dot, closing this gap.
        XCTAssertFalse(BridgeSecurityPolicy.isAllowedOrigin(url("https://notsynalux.ai")))
    }

    func test_origin_file_scheme_blocked() {
        // file:// URI has no host — must be blocked
        XCTAssertFalse(BridgeSecurityPolicy.isAllowedOrigin(url("file:///etc/passwd")))
    }

    func test_origin_data_uri_blocked() {
        // data: URI has no host
        XCTAssertFalse(BridgeSecurityPolicy.isAllowedOrigin(url("data:text/html,<script>bad</script>")))
    }

    func test_origin_synaluxai_no_dot_blocked() {
        // "synaluxai.com" must not match
        XCTAssertFalse(BridgeSecurityPolicy.isAllowedOrigin(url("https://synaluxai.com")))
    }

    func test_origin_empty_host_url_blocked() {
        // Constructed URL with empty host
        var comps = URLComponents()
        comps.scheme = "https"
        comps.host = ""
        comps.path = "/path"
        XCTAssertFalse(BridgeSecurityPolicy.isAllowedOrigin(comps.url!))
    }

    // MARK: - settingsURL — whitelist enforcement

    func test_settingsURL_unknown_section_returns_accessibility_root() {
        let result = BridgeSecurityPolicy.settingsURL(for: "unknown-section")!
        XCTAssertEqual(result.absoluteString, "prefs:root=ACCESSIBILITY",
            "Unknown section must fall through to Accessibility root")
    }

    func test_settingsURL_injection_attempt_does_not_propagate() {
        // Attacker passes "ACCESSIBILITY&evil=1" hoping it gets interpolated
        let result = BridgeSecurityPolicy.settingsURL(for: "ACCESSIBILITY&evil=1")!
        XCTAssertEqual(result.absoluteString, "prefs:root=ACCESSIBILITY",
            "Injection attempt must be swallowed — output must be the safe default")
        XCTAssertFalse(result.absoluteString.contains("evil"),
            "Attacker-controlled string must never appear in the URL")
    }

    func test_settingsURL_path_traversal_rejected() {
        let result = BridgeSecurityPolicy.settingsURL(for: "../../etc/passwd")!
        XCTAssertEqual(result.absoluteString, "prefs:root=ACCESSIBILITY")
        XCTAssertFalse(result.absoluteString.contains("etc"))
    }

    func test_settingsURL_speech_correct() {
        let result = BridgeSecurityPolicy.settingsURL(for: "speech")!
        XCTAssertEqual(result.absoluteString, "prefs:root=ACCESSIBILITY&path=SPEECH")
    }

    func test_settingsURL_voiceControl_correct() {
        let result = BridgeSecurityPolicy.settingsURL(for: "voiceControl")!
        XCTAssertEqual(result.absoluteString, "prefs:root=ACCESSIBILITY&path=VOICECONTROL")
    }

    func test_settingsURL_switchControl_correct() {
        let result = BridgeSecurityPolicy.settingsURL(for: "switchControl")!
        XCTAssertEqual(result.absoluteString, "prefs:root=ACCESSIBILITY&path=SWITCH_CONTROL")
    }

    func test_settingsURL_all_cases_use_prefs_scheme() {
        let sections = ["speech", "voiceControl", "switchControl", "anything", ""]
        for section in sections {
            let result = BridgeSecurityPolicy.settingsURL(for: section)
            XCTAssertNotNil(result, "settingsURL must never return nil for section: '\(section)'")
            XCTAssertTrue(result!.absoluteString.hasPrefix("prefs:"),
                "All settings URLs must use prefs: scheme, section: '\(section)'")
        }
    }

    func test_settingsURL_user_input_never_in_output() {
        let injections = [
            "GENERAL",
            "WIFI&evil=true",
            "'; DROP TABLE apps; --",
            "<script>alert(1)</script>",
            "ACCESSIBILITY&path=../../../../etc",
        ]
        for injection in injections {
            let result = BridgeSecurityPolicy.settingsURL(for: injection)!
            XCTAssertFalse(result.absoluteString.contains(injection),
                "User input '\(injection)' must never appear verbatim in output URL")
        }
    }

    func test_settingsURL_empty_section_returns_accessibility_root() {
        let result = BridgeSecurityPolicy.settingsURL(for: "")!
        XCTAssertEqual(result.absoluteString, "prefs:root=ACCESSIBILITY")
    }

    // MARK: - Input length caps (pin values — prevent silent regressions)

    func test_maxSpeakTextLength_is2000() {
        XCTAssertEqual(BridgeSecurityPolicy.maxSpeakTextLength, 2_000)
    }

    func test_maxEmergencyPhraseLength_is500() {
        XCTAssertEqual(BridgeSecurityPolicy.maxEmergencyPhraseLength, 500)
    }

    func test_maxAskAIQuestionLength_is500() {
        XCTAssertEqual(BridgeSecurityPolicy.maxAskAIQuestionLength, 500)
    }

    func test_maxSpeechTranscriptLength_is2000() {
        XCTAssertEqual(BridgeSecurityPolicy.maxSpeechTranscriptLength, 2_000)
    }

    func test_maxLangTagLength_is11() {
        // Longest sane BCP-47 tag: "zh-Hans-CN" = 10 chars
        XCTAssertEqual(BridgeSecurityPolicy.maxLangTagLength, 11)
    }

    func test_maxSettingsSectionLength_is50() {
        XCTAssertEqual(BridgeSecurityPolicy.maxSettingsSectionLength, 50)
    }

    // MARK: - Rate-limit thresholds (pin values)

    func test_emergencyRateLimit_is30s() {
        XCTAssertEqual(BridgeSecurityPolicy.emergencyRateLimitSeconds, 30)
    }

    func test_startVoiceRateLimit_isHalfSecond() {
        XCTAssertEqual(BridgeSecurityPolicy.startVoiceRateLimitSeconds, 0.5)
    }

    // MARK: - Language tag validator — valid tags

    func test_lang_en_valid() {
        XCTAssertTrue(BridgeSecurityPolicy.isValidLang("en"))
    }

    func test_lang_enUS_valid() {
        XCTAssertTrue(BridgeSecurityPolicy.isValidLang("en-US"))
    }

    func test_lang_zhHans_valid() {
        XCTAssertTrue(BridgeSecurityPolicy.isValidLang("zh-Hans"))
    }

    func test_lang_arSA_valid() {
        XCTAssertTrue(BridgeSecurityPolicy.isValidLang("ar-SA"))
    }

    func test_lang_fil_valid() {
        // Filipino (Tagalog)
        XCTAssertTrue(BridgeSecurityPolicy.isValidLang("fil"))
    }

    func test_lang_uk_valid() {
        XCTAssertTrue(BridgeSecurityPolicy.isValidLang("uk"))
    }

    // MARK: - Language tag validator — invalid / malicious inputs

    func test_lang_scriptTag_invalid() {
        XCTAssertFalse(BridgeSecurityPolicy.isValidLang("<script>"))
    }

    func test_lang_pathTraversal_invalid() {
        XCTAssertFalse(BridgeSecurityPolicy.isValidLang("../../etc"))
    }

    func test_lang_longString_invalid() {
        XCTAssertFalse(BridgeSecurityPolicy.isValidLang("en-US-extended-long"))
    }

    func test_lang_empty_invalid() {
        XCTAssertFalse(BridgeSecurityPolicy.isValidLang(""))
    }

    func test_lang_numbers_invalid() {
        XCTAssertFalse(BridgeSecurityPolicy.isValidLang("1234"))
    }

    func test_lang_singleChar_invalid() {
        XCTAssertFalse(BridgeSecurityPolicy.isValidLang("e"))
    }

    func test_lang_semicolonInjection_invalid() {
        XCTAssertFalse(BridgeSecurityPolicy.isValidLang("en; rm -rf /"))
    }

    func test_lang_nullByte_invalid() {
        XCTAssertFalse(BridgeSecurityPolicy.isValidLang("en\0US"))
    }

    // MARK: - Constant ordering sanity

    func test_emergencyPhraseLengthLesThanSpeakLength() {
        // Phrase cap (500) must be ≤ speak cap (2000) — paranoia guard
        XCTAssertLessThanOrEqual(
            BridgeSecurityPolicy.maxEmergencyPhraseLength,
            BridgeSecurityPolicy.maxSpeakTextLength
        )
    }

    func test_langTagLengthShorterThanSectionLength() {
        XCTAssertLessThan(
            BridgeSecurityPolicy.maxLangTagLength,
            BridgeSecurityPolicy.maxSettingsSectionLength
        )
    }

    // MARK: - Helpers

    private func url(_ string: String) -> URL {
        URL(string: string) ?? URL(string: "about:blank")!
    }
}
