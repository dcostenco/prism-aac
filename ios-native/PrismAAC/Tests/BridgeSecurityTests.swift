import XCTest
import UIKit
import WebKit
@testable import PrismAAC

/// Unit tests for BridgeSecurityPolicy — the central security gate for all
/// WKWebView ↔ Swift bridge actions.
///
/// Tests run on the host without a WKWebView, simulator, or network.
/// Every named constant, every whitelist rule, and every validator must
/// have at least one passing test and one failing test (positive + negative).
final class BridgeSecurityTests: XCTestCase {
    func test_only_the_main_bundled_document_can_discard_a_billing_draft_by_speaking() {
        XCTAssertTrue(BridgeSecurityPolicy.isAllowedBundledFrame(pageURL: Bundle.main.bundleURL, isMainFrame: true))
        XCTAssertFalse(BridgeSecurityPolicy.isAllowedBundledFrame(pageURL: Bundle.main.bundleURL, isMainFrame: false))
        for other in [nil, url("https://synalux.ai/prism-aac"), url("file:///tmp/other/"), url("about:blank")] {
            XCTAssertFalse(BridgeSecurityPolicy.isAllowedBundledFrame(pageURL: other, isMainFrame: true))
        }
    }
    @MainActor
    func test_unused_speech_client_can_be_released_without_a_disconnect_notification() async {
        var disconnected = false
        var client: InworldSTTClient? = InworldSTTClient()
        weak var releasedClient = client
        client?.onDisconnected = { disconnected = true }

        client = nil

        XCTAssertNil(releasedClient)
        // Drain the main queue so a destruction callback cannot hide behind
        // the test finishing before scheduled work runs.
        await withCheckedContinuation { continuation in
            DispatchQueue.main.async { continuation.resume() }
        }
        XCTAssertFalse(disconnected)
    }

    @MainActor
    func test_explicit_speech_disconnect_notifies_and_client_can_then_be_released() async {
        let disconnected = expectation(description: "Explicit disconnect notifies its caller")
        var client: InworldSTTClient? = InworldSTTClient()
        weak var releasedClient = client
        client?.onDisconnected = { disconnected.fulfill() }

        client?.disconnect()
        await fulfillment(of: [disconnected], timeout: 2)
        XCTAssertFalse(client?.isConnected ?? true)

        client = nil
        XCTAssertNil(releasedClient)
    }

    @MainActor
    func test_each_rendered_board_starts_a_new_recovery_budget() {
        let view = RecoveryWebView()
        var ready = 0
        let coordinator = PrismWebView.Coordinator(pipeline: AACPipeline(llm: LLMEngine()), onLoaded: { ready += 1 })
        for count in 1...4 {
            coordinator.webViewWebContentProcessDidTerminate(view)
            XCTAssertEqual(view.requests.count, count)
            coordinator.webView(view, didStartProvisionalNavigation: nil)
            coordinator.webView(view, didFinish: nil)
        }
        XCTAssertEqual(ready, 4)
        XCTAssertEqual(view.bundledLoads, 0)
    }
    @MainActor
    func test_a_bundled_board_can_recover_after_its_web_process_dies() {
        let view = RecoveryWebView()
        var ready = 0
        let coordinator = PrismWebView.Coordinator(pipeline: AACPipeline(llm: LLMEngine()), onLoaded: { ready += 1 })
        let offline = NSError(domain: NSURLErrorDomain, code: NSURLErrorNotConnectedToInternet)
        coordinator.webView(view, didFailProvisionalNavigation: nil, withError: offline)
        coordinator.webView(view, didFailProvisionalNavigation: nil, withError: offline)
        XCTAssertEqual(view.bundledLoads, 1)
        coordinator.webView(view, didStartProvisionalNavigation: nil)
        coordinator.webView(view, didFinish: nil)
        coordinator.webViewWebContentProcessDidTerminate(view)
        XCTAssertEqual(view.bundledLoads, 2)
        coordinator.webView(view, didStartProvisionalNavigation: nil)
        coordinator.webView(view, didFinish: nil)
        XCTAssertEqual(ready, 2)
    }

    @MainActor
    func test_failed_bundled_rendering_stops_retrying_and_offers_native_reconnect() {
        let view = RecoveryWebView()
        var retry: (() -> Void)?
        var unavailable = 0
        let coordinator = PrismWebView.Coordinator(pipeline: AACPipeline(llm: LLMEngine()),
            onUnavailable: { action in unavailable += 1; retry = action })
        let offline = NSError(domain: NSURLErrorDomain, code: NSURLErrorNotConnectedToInternet)
        for _ in 0..<4 { coordinator.webView(view, didFailProvisionalNavigation: nil, withError: offline) }
        XCTAssertEqual(view.requests.count, 1)
        XCTAssertEqual(view.bundledLoads, 2)
        XCTAssertEqual(unavailable, 1)
        XCTAssertNotNil(retry)
        retry?()
        XCTAssertEqual(view.requests.count, 2)
        XCTAssertEqual(view.requests.last?.url?.host, "synalux.ai")
        XCTAssertEqual(view.requests.last?.url?.path, "/prism-aac")
    }

    @MainActor
    func test_bundled_reconnect_loads_the_full_app_instead_of_the_bundle_directory() {
        let view = RecoveryWebView()
        let coordinator = PrismWebView.Coordinator(pipeline: AACPipeline(llm: LLMEngine()))
        let offline = NSError(domain: NSURLErrorDomain, code: NSURLErrorNotConnectedToInternet)
        coordinator.webView(view, didFailProvisionalNavigation: nil, withError: offline)
        coordinator.webView(view, didFailProvisionalNavigation: nil, withError: offline)
        XCTAssertEqual(coordinator.mainFrameNavigationPolicy(url("prism-aac-reconnect://app"), webView: view), .cancel)
        XCTAssertEqual(view.requests.count, 2)
        XCTAssertEqual(view.requests.last?.url?.host, "synalux.ai")
        XCTAssertEqual(view.requests.last?.url?.path, "/prism-aac")
        XCTAssertNotNil(view.requests.last?.url?.query)
    }

    @MainActor
    func test_external_communication_intents_leave_the_working_board_in_place() {
        let view = RecoveryWebView()
        var opened: [URL] = []
        var loading = 0
        let coordinator = PrismWebView.Coordinator(pipeline: AACPipeline(llm: LLMEngine()),
            onLoading: { loading += 1 }, openExternalURL: { opened.append($0) })
        for intent in ["tel:123", "mailto:person@example.test", "sms:123"] {
            let destination = url(intent)
            XCTAssertEqual(coordinator.mainFrameNavigationPolicy(destination, webView: view), .cancel)
            XCTAssertEqual(opened.last, destination)
        }
        coordinator.webView(view, didFailProvisionalNavigation: nil,
            withError: NSError(domain: NSURLErrorDomain, code: NSURLErrorCancelled))
        XCTAssertEqual(loading, 0)
        XCTAssertTrue(view.requests.isEmpty)
        XCTAssertEqual(view.bundledLoads, 0)
    }

    @MainActor
    func test_sign_out_document_is_visible_and_does_not_consume_aac_recovery() {
        let view = RecoveryWebView()
        var loading = 0
        var visible = 0
        let coordinator = PrismWebView.Coordinator(pipeline: AACPipeline(llm: LLMEngine()),
            onLoaded: { visible += 1 }, onLoading: { loading += 1 })
        XCTAssertEqual(coordinator.mainFrameNavigationPolicy(url("https://synalux.ai/api/auth/signout"), webView: view), .allow)
        coordinator.webView(view, didStartProvisionalNavigation: nil)
        coordinator.webView(view, didFinish: nil)
        let failure = NSError(domain: NSURLErrorDomain, code: NSURLErrorNotConnectedToInternet)
        coordinator.webView(view, didFailProvisionalNavigation: nil, withError: failure)
        coordinator.webView(view, didFail: nil, withError: failure)
        XCTAssertGreaterThan(visible, 0)
        XCTAssertEqual(loading, 0)
        XCTAssertEqual(view.readinessChecks, 0)
        XCTAssertTrue(view.requests.isEmpty)
        XCTAssertEqual(view.bundledLoads, 0)
        _ = coordinator.mainFrameNavigationPolicy(url("https://synalux.ai/prism-aac"), webView: view)
        coordinator.webViewWebContentProcessDidTerminate(view)
        XCTAssertEqual(view.requests.count, 1)
        XCTAssertEqual(view.bundledLoads, 0)
    }

    @MainActor
    func test_bundled_document_navigation_still_checks_communication_readiness() throws {
        let view = RecoveryWebView()
        var ready = 0
        let coordinator = PrismWebView.Coordinator(pipeline: AACPipeline(llm: LLMEngine()), onLoaded: { ready += 1 })
        let failure = NSError(domain: NSURLErrorDomain, code: NSURLErrorNotConnectedToInternet)
        coordinator.webView(view, didFailProvisionalNavigation: nil, withError: failure)
        coordinator.webView(view, didFailProvisionalNavigation: nil, withError: failure)
        let bundleURL = try XCTUnwrap(view.currentURL)
        XCTAssertEqual(coordinator.mainFrameNavigationPolicy(bundleURL, webView: view), .allow)
        coordinator.webView(view, didStartProvisionalNavigation: nil)
        coordinator.webView(view, didFinish: nil)
        XCTAssertEqual(view.readinessChecks, 1)
        XCTAssertEqual(ready, 1)
    }

    @MainActor
    func test_process_death_during_sign_out_still_restores_communication() {
        let view = RecoveryWebView()
        let coordinator = PrismWebView.Coordinator(pipeline: AACPipeline(llm: LLMEngine()))
        _ = coordinator.mainFrameNavigationPolicy(url("https://synalux.ai/api/auth/signout"), webView: view)
        coordinator.webViewWebContentProcessDidTerminate(view)
        XCTAssertEqual(view.requests.count, 1, "A dead web process must not strand the user on a sign-out document")
        XCTAssertEqual(view.requests.last?.url?.path, "/prism-aac")
    }

    func test_external_communication_schemes_are_explicit() {
        for allowed in ["tel:123", "mailto:person@example.test", "sms:123"] {
            XCTAssertTrue(BridgeSecurityPolicy.isExternalCommunicationURL(url(allowed)))
        }
        for other in ["javascript:alert(1)", "file:///tmp/page", "https://synalux.ai", "intent://app", "prism-aac-reconnect://app"] {
            XCTAssertFalse(BridgeSecurityPolicy.isExternalCommunicationURL(url(other)))
        }
    }
    func test_fresh_document_preserves_origin_path_and_launch_parameters() throws {
        let original = url("https://synalux.ai/prism-aac?mode=typing&_aac_launch=old#board")
        let first = PrismWebView.freshDocumentURL(original)
        let second = PrismWebView.freshDocumentURL(original)
        let components = try XCTUnwrap(URLComponents(url: first, resolvingAgainstBaseURL: false))
        XCTAssertEqual(first.scheme, original.scheme)
        XCTAssertEqual(first.host, original.host)
        XCTAssertEqual(first.path, original.path)
        XCTAssertEqual(first.fragment, original.fragment)
        XCTAssertEqual(components.queryItems?.first(where: { $0.name == "mode" })?.value, "typing")
        XCTAssertEqual(components.queryItems?.filter { $0.name == "_aac_launch" }.count, 1)
        XCTAssertNotEqual(first, second)
        XCTAssertTrue(BridgeSecurityPolicy.isAllowedSubscriptionFrame(pageURL: first, frameURL: first, isMainFrame: true))
    }

    func test_billing_opens_only_known_https_destinations_outside_the_board() {
        for allowed in ["https://checkout.stripe.com/", "https://billing.stripe.com/session",
                        "https://apps.apple.com/account/subscriptions"] {
            XCTAssertTrue(BridgeSecurityPolicy.isExternalBillingURL(url(allowed)), allowed)
        }
        for blocked in ["http://billing.stripe.com/", "https://billing.stripe.com.evil.com/",
                        "https://billing.stripe.com:444/", "https://user@billing.stripe.com/",
                        "https://apps.apple.com/other", "https://synalux.ai/prism-aac"] {
            XCTAssertFalse(BridgeSecurityPolicy.isExternalBillingURL(url(blocked)), blocked)
        }
    }

    func test_subscription_requiresHTTPSAACMainFrame() {
        let page = url("https://synalux.ai/prism-aac")
        XCTAssertTrue(BridgeSecurityPolicy.isAllowedSubscriptionFrame(pageURL: page, frameURL: page, isMainFrame: true))
        XCTAssertFalse(BridgeSecurityPolicy.isAllowedSubscriptionFrame(pageURL: page, frameURL: page, isMainFrame: false))
        for untrusted in ["http://synalux.ai/prism-aac", "https://synalux.ai/pricing",
                          "https://synalux.ai.evil.com/prism-aac", "https://other.synalux.ai/prism-aac",
                          "https://synalux.ai:444/prism-aac"] {
            XCTAssertFalse(BridgeSecurityPolicy.isAllowedSubscriptionFrame(pageURL: page,
                frameURL: url(untrusted), isMainFrame: true), untrusted)
            XCTAssertFalse(BridgeSecurityPolicy.isAllowedSubscriptionFrame(pageURL: url(untrusted),
                frameURL: page, isMainFrame: true), untrusted)
        }
        XCTAssertFalse(BridgeSecurityPolicy.isAllowedSubscriptionFrame(pageURL: nil, frameURL: page, isMainFrame: true))
    }

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

    // MARK: - settingsURL — public API and input isolation

    func test_settingsURL_unknown_section_returns_app_settings() {
        let result = BridgeSecurityPolicy.settingsURL(for: "unknown-section")!
        XCTAssertEqual(result.absoluteString, UIApplication.openSettingsURLString,
            "Unknown section must use the public app Settings API")
    }

    func test_settingsURL_injection_attempt_does_not_propagate() {
        // Attacker passes "ACCESSIBILITY&evil=1" hoping it gets interpolated
        let result = BridgeSecurityPolicy.settingsURL(for: "ACCESSIBILITY&evil=1")!
        XCTAssertEqual(result.absoluteString, UIApplication.openSettingsURLString,
            "Injection attempt must be swallowed — output must be the safe default")
        XCTAssertFalse(result.absoluteString.contains("evil"),
            "Attacker-controlled string must never appear in the URL")
    }

    func test_settingsURL_path_traversal_rejected() {
        let result = BridgeSecurityPolicy.settingsURL(for: "../../etc/passwd")!
        XCTAssertEqual(result.absoluteString, UIApplication.openSettingsURLString)
        XCTAssertFalse(result.absoluteString.contains("etc"))
    }

    func test_settingsURL_speech_correct() {
        let result = BridgeSecurityPolicy.settingsURL(for: "speech")!
        XCTAssertEqual(result.absoluteString, UIApplication.openSettingsURLString)
    }

    func test_settingsURL_voiceControl_correct() {
        let result = BridgeSecurityPolicy.settingsURL(for: "voiceControl")!
        XCTAssertEqual(result.absoluteString, UIApplication.openSettingsURLString)
    }

    func test_settingsURL_switchControl_correct() {
        let result = BridgeSecurityPolicy.settingsURL(for: "switchControl")!
        XCTAssertEqual(result.absoluteString, UIApplication.openSettingsURLString)
    }

    func test_settingsURL_all_cases_use_public_app_settings() {
        let sections = ["speech", "voiceControl", "switchControl", "anything", ""]
        for section in sections {
            let result = BridgeSecurityPolicy.settingsURL(for: section)
            XCTAssertNotNil(result, "settingsURL must never return nil for section: '\(section)'")
            XCTAssertEqual(result!.absoluteString, UIApplication.openSettingsURLString,
                "Private prefs: links must not return, section: '\(section)'")
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

    func test_settingsURL_empty_section_returns_app_settings() {
        let result = BridgeSecurityPolicy.settingsURL(for: "")!
        XCTAssertEqual(result.absoluteString, UIApplication.openSettingsURLString)
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

    // MARK: - mediaCaptureDecision — camera is a real AAC input

    /// Regression: the delegate used to answer `.deny` for camera-only
    /// capture. Because bodyPoseService/headTracker request
    /// `{ video: …, audio: false }`, WebKit classifies every head-tracking
    /// request as `.camera`, so hands-free control and custom picture
    /// symbols could never start inside the iOS app — 60 RUM errors in
    /// 30 days, 57 of them from WKWebView.
    func test_mediaCapture_camera_allowedOrigin_granted() {
        XCTAssertEqual(
            BridgeSecurityPolicy.mediaCaptureDecision(
                origin: url("https://synalux.ai"), type: .camera, isMainFrame: true),
            .grant
        )
    }

    func test_mediaCapture_microphone_allowedOrigin_granted() {
        XCTAssertEqual(
            BridgeSecurityPolicy.mediaCaptureDecision(
                origin: url("https://synalux.ai"), type: .microphone, isMainFrame: true),
            .grant
        )
    }

    func test_mediaCapture_cameraAndMicrophone_allowedOrigin_granted() {
        XCTAssertEqual(
            BridgeSecurityPolicy.mediaCaptureDecision(
                origin: url("https://synalux.ai"), type: .cameraAndMicrophone, isMainFrame: true),
            .grant
        )
    }

    func test_mediaCapture_subdomain_allowedOrigin_granted() {
        XCTAssertEqual(
            BridgeSecurityPolicy.mediaCaptureDecision(
                origin: url("https://staging.synalux.ai"), type: .camera, isMainFrame: true),
            .grant
        )
    }

    // MARK: - mediaCaptureDecision — the origin gate still holds

    func test_mediaCapture_camera_evilOrigin_denied() {
        XCTAssertEqual(
            BridgeSecurityPolicy.mediaCaptureDecision(
                origin: url("https://evil.com"), type: .camera, isMainFrame: true),
            .deny
        )
    }

    func test_mediaCapture_microphone_evilOrigin_denied() {
        XCTAssertEqual(
            BridgeSecurityPolicy.mediaCaptureDecision(
                origin: url("https://evil.com"), type: .microphone, isMainFrame: true),
            .deny
        )
    }

    func test_mediaCapture_camera_typosquatOrigin_denied() {
        // Opening the camera for synalux.ai.evil.com would be the worst
        // possible failure of this gate — pin it explicitly.
        XCTAssertEqual(
            BridgeSecurityPolicy.mediaCaptureDecision(
                origin: url("https://synalux.ai.evil.com"), type: .camera, isMainFrame: true),
            .deny
        )
    }

    func test_mediaCapture_camera_unparseableOrigin_denied() {
        // WKSecurityOrigin for an opaque origin yields an empty protocol/host,
        // so the delegate hands us a nil URL. That must never grant.
        XCTAssertEqual(
            BridgeSecurityPolicy.mediaCaptureDecision(origin: nil, type: .camera, isMainFrame: true),
            .deny
        )
    }

    func test_mediaCapture_camera_fileScheme_denied() {
        XCTAssertEqual(
            BridgeSecurityPolicy.mediaCaptureDecision(
                origin: url("file:///etc/passwd"), type: .camera, isMainFrame: true),
            .deny
        )
    }

    // MARK: - mediaCaptureDecision — sub-frames never get capture

    /// The app renders a full-page iframe of arbitrary user-typed URLs. The
    /// bridge script is installed `forMainFrameOnly: true`; capture permission
    /// must follow the same rule so a framed page can never reach the camera.
    func test_mediaCapture_camera_subFrame_deniedEvenOnAllowedOrigin() {
        XCTAssertEqual(
            BridgeSecurityPolicy.mediaCaptureDecision(
                origin: url("https://synalux.ai"), type: .camera, isMainFrame: false),
            .deny
        )
    }

    func test_mediaCapture_microphone_subFrame_deniedEvenOnAllowedOrigin() {
        XCTAssertEqual(
            BridgeSecurityPolicy.mediaCaptureDecision(
                origin: url("https://synalux.ai"), type: .microphone, isMainFrame: false),
            .deny
        )
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

@MainActor
private final class RecoveryWebView: WKWebView {
    var currentURL: URL? = URL(string: "https://synalux.ai/prism-aac")
    var requests: [URLRequest] = []
    var bundledLoads = 0
    var readinessChecks = 0
    override var url: URL? { currentURL }
    override func load(_ request: URLRequest) -> WKNavigation? {
        requests.append(request); currentURL = request.url; return nil
    }
    override func loadHTMLString(_ string: String, baseURL: URL?) -> WKNavigation? {
        bundledLoads += 1; currentURL = baseURL; return nil
    }
    override func evaluateJavaScript(_ javaScriptString: String, completionHandler: ((Any?, Error?) -> Void)? = nil) {
        if javaScriptString.contains("aac-safe-viewport") { readinessChecks += 1 }
        completionHandler?(true, nil)
    }
}

/// The bundled offline page mirrors the web lock offline.
final class OfflineAccessTests: XCTestCase {
    func test_full_board_when_the_policy_was_never_seen_or_the_lease_is_valid() {
        XCTAssertTrue(OfflineAccess(policySeen: false, leaseUntilMs: nil).fullBoard(nowMs: 1_000))
        XCTAssertTrue(OfflineAccess(policySeen: true, leaseUntilMs: 2_000).fullBoard(nowMs: 1_000))
    }

    func test_safety_only_when_the_policy_was_seen_without_a_valid_lease() {
        XCTAssertFalse(OfflineAccess(policySeen: true, leaseUntilMs: nil).fullBoard(nowMs: 1_000))
        XCTAssertFalse(OfflineAccess(policySeen: true, leaseUntilMs: 1_000).fullBoard(nowMs: 1_000))
    }

    func test_nothing_recorded_keeps_the_full_board() throws {
        let defaults = try XCTUnwrap(UserDefaults(suiteName: "offline-access-\(UUID().uuidString)"))
        XCTAssertTrue(OfflineAccess.offlineFullBoard(defaults, nowMs: 1_000))
        OfflineAccess(policySeen: true, leaseUntilMs: nil).save(defaults)
        XCTAssertFalse(OfflineAccess.offlineFullBoard(defaults, nowMs: 1_000))
    }

    func test_reads_only_well_formed_messages() {
        XCTAssertEqual(OfflineAccess(message: ["policySeen": true, "leaseUntil": 5.0]), OfflineAccess(policySeen: true, leaseUntilMs: 5))
        XCTAssertEqual(OfflineAccess(message: ["policySeen": false, "leaseUntil": NSNull()]), OfflineAccess(policySeen: false, leaseUntilMs: nil))
        XCTAssertNil(OfflineAccess(message: ["leaseUntil": 5.0]))
        XCTAssertNil(OfflineAccess(message: ["policySeen": true, "leaseUntil": "soon"]))
        XCTAssertNil(OfflineAccess(message: ["policySeen": true, "leaseUntil": -1.0]))
    }

    func test_the_decision_is_injected_before_the_page_script() {
        let html = "<html><head><title>x</title></head><body><script>run()</script></body></html>"
        let safety = OfflineAccess.offlineDocument(html, fullBoard: false)
        XCTAssertTrue(safety.contains("window.prismOfflineAccess={fullBoard:false};</script></head>"))
        XCTAssertLessThan(safety.range(of: "prismOfflineAccess")!.lowerBound, safety.range(of: "run()")!.lowerBound)
        XCTAssertTrue(OfflineAccess.offlineDocument(html, fullBoard: true).contains("fullBoard:true"))
    }

    func test_the_bundled_offline_page_hides_all_but_help_needs_when_told_to() throws {
        // Unit tests run hosted in the app, so the app bundle is Bundle.main.
        let url = try XCTUnwrap(Bundle.main.url(forResource: "offline", withExtension: "html"))
        let page = try String(contentsOf: url, encoding: .utf8)
        XCTAssertTrue(page.contains("window.prismOfflineAccess.fullBoard===false"))
        XCTAssertTrue(page.contains("c.n==='Help / Needs'"))
        // Emergency is outside the category list, so it shows in both modes,
        // speaks aloud, never counts toward a review prompt, and places no call.
        XCTAssertTrue(page.contains("id=\"sos\""))
        XCTAssertTrue(page.contains("speak(SOS,true)"))
        // Normal speed, so the call for help finishes before it repeats; named
        // for VoiceOver and switch access in both states.
        XCTAssertTrue(page.contains("rate:emergency?1.0:0.4"))
        XCTAssertTrue(page.contains("aria-label=\"Emergency: say the call for help aloud\""))
        XCTAssertTrue(page.contains("'Stop the call for help'"))
        XCTAssertFalse(page.contains("tel:"))
    }
}
