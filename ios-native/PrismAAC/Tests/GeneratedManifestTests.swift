import XCTest

/// Pins what the GENERATED Info.plist and entitlements must contain.
///
/// XcodeGen generates both files from project.yml. Anything hand-added to
/// them survives only until the next `xcodegen generate` — which every
/// archive runs. That silently stripped:
///
///   • com.apple.developer.applesignin — added 2026-07-08 (28694ed) for App
///     Store approval while ContentView implements ASAuthorizationAppleID-
///     Provider. Measured absent from the shipped 1.8.4, 1.8.7 AND 1.8.8
///     archives: Sign in with Apple could never have worked in production.
///   • UIApplicationShortcutItems — four one-tap AAC phrases, likewise never
///     shipped.
///
/// Same failure class as the PrismCoach CloudKit crash the same day: feature
/// implemented in code, capability declared in a GENERATED file, generator
/// unaware, silently missing from every build. Nothing failed, so nothing
/// noticed — which is exactly what these tests exist to change.
///
/// They read the generated files from the repo (not the test bundle) so a
/// regression is caught at test time rather than at App Review.
final class GeneratedManifestTests: XCTestCase {

    private var iosDir: URL {
        // .../ios-native/PrismAAC/Tests/GeneratedManifestTests.swift
        URL(fileURLWithPath: #filePath)
            .deletingLastPathComponent()   // Tests
            .deletingLastPathComponent()   // PrismAAC
    }

    private func loadPlist(_ name: String) throws -> [String: Any] {
        let url = iosDir.appendingPathComponent(name)
        let data = try Data(contentsOf: url)
        let obj = try PropertyListSerialization.propertyList(from: data, format: nil)
        return try XCTUnwrap(obj as? [String: Any], "\(name) is not a dictionary")
    }

    func testSignInWithAppleEntitlementIsGenerated() throws {
        let ent = try loadPlist("PrismAAC.entitlements")
        let signin = ent["com.apple.developer.applesignin"] as? [String]
        XCTAssertEqual(signin, ["Default"],
                       "Sign in with Apple is implemented in ContentView; without this entitlement "
                       + "ASAuthorizationController fails at runtime. Declare it in project.yml "
                       + "under entitlements.properties — a bare `path:` regenerates an empty dict.")
    }

    func testEntitlementsAreNotAnEmptyDict() throws {
        let ent = try loadPlist("PrismAAC.entitlements")
        XCTAssertFalse(ent.isEmpty,
                       "An empty entitlements dict is the signature of a `path:`-only XcodeGen "
                       + "block silently discarding every declared capability.")
    }

    func testHomeScreenShortcutsSurviveGeneration() throws {
        let info = try loadPlist("Info.plist")
        let items = try XCTUnwrap(info["UIApplicationShortcutItems"] as? [[String: Any]],
                                  "quick actions missing — regeneration dropped them again")
        let titles = items.compactMap { $0["UIApplicationShortcutItemTitle"] as? String }
        XCTAssertEqual(titles, ["Help", "Yes", "No", "Water please"])
    }

    func testShortcutTitlesAreStringsNotYAMLBooleans() throws {
        // Bare Yes/No in YAML 1.1 are BOOLEANS: the first generated build
        // emitted <true/>/<false/> in place of the titles. They must be quoted
        // in project.yml, and this asserts the generated result, not the source.
        let info = try loadPlist("Info.plist")
        let items = try XCTUnwrap(info["UIApplicationShortcutItems"] as? [[String: Any]])
        for item in items {
            let title = item["UIApplicationShortcutItemTitle"]
            XCTAssertTrue(title is String,
                          "shortcut title is \(type(of: title)) not String — YAML coerced it")
        }
    }
}
