import XCTest

final class OfflineWatchTests: XCTestCase {
    private var app: XCUIApplication!

    override func setUpWithError() throws {
        continueAfterFailure = false
        app = XCUIApplication()
        app.launch()
    }

    func testLocalPhraseCardsSwitchFromEnglishToRussian() {
        openLanguagePicker()
        selectLanguage("🇺🇸 EN")
        app.buttons["Done"].tap()

        XCTAssertTrue(app.buttons["Say: Yes"].waitForExistence(timeout: 15))
        XCTAssertTrue(app.buttons["Say: No"].exists)
        capture("standalone-english-core")
        XCTAssertFalse(app.buttons["Say: More"].exists, "The recent phrase should start empty")

        openCategory("I / You / We category")
        let iPhrase = app.buttons["Say: I"]
        XCTAssertTrue(iPhrase.waitForExistence(timeout: 10))
        iPhrase.tap()
        returnToTop()
        app.terminate()
        app.launch()
        XCTAssertTrue(app.buttons["Say: I"].waitForExistence(timeout: 15), "A full-vocabulary selection must survive offline relaunch")
        XCTAssertEqual(app.buttons["Say: I"].identifier, "aac-picture-cw-i.png")
        revealFully(app.buttons["Say: I"])
        capture("standalone-i-recent")

        let moreCategory = app.buttons["More / Not / All category"]
        for _ in 0..<16 where !moreCategory.isHittable {
            scrollUpSlightly()
        }
        XCTAssertTrue(moreCategory.waitForExistence(timeout: 5), app.debugDescription)
        XCTAssertTrue(moreCategory.isHittable, app.debugDescription)
        moreCategory.tap()

        let morePhrase = app.buttons["Say: More"]
        XCTAssertTrue(morePhrase.waitForExistence(timeout: 10))
        morePhrase.tap()

        let recentMore = app.buttons["Say: More"]
        for _ in 0..<16 where !recentMore.isHittable {
            scrollDownSlightly()
        }
        XCTAssertTrue(recentMore.waitForExistence(timeout: 10))
        XCTAssertTrue(recentMore.isHittable, "The selected phrase should appear in the home recents")
        revealFully(recentMore)

        capture("standalone-more-recent")
        app.terminate()
        app.launch()
        let persistedMore = app.buttons["Say: More"]
        XCTAssertTrue(persistedMore.waitForExistence(timeout: 15))
        XCTAssertTrue(persistedMore.isHittable, "The recent phrase should remain visible after relaunch")

        openLanguagePicker()
        selectLanguage("🇷🇺 RU")
        app.buttons["Done"].tap()
        XCTAssertTrue(app.buttons["Say: Да"].waitForExistence(timeout: 10))
        XCTAssertTrue(app.buttons["Say: Нет"].exists)
        capture("standalone-russian-core")

        openLanguagePicker()
        selectLanguage("🇺🇸 EN")
        app.buttons["Done"].tap()
        openCategory("Colors category")
        let orange = app.buttons["Say: Orange"]
        for _ in 0..<24 where !orange.isHittable { scrollUpSlightly() }
        XCTAssertTrue(orange.isHittable)
        XCTAssertEqual(orange.identifier, "aac-picture-co-orange.png")
        revealFully(orange)
        capture("standalone-orange-color-selected")
        orange.tap()
        returnToTop()
        app.terminate()
        app.launch()
        XCTAssertTrue(app.buttons["Say: Orange"].waitForExistence(timeout: 15))
        for _ in 0..<24 where !app.buttons["Say: Orange"].isHittable { scrollUpSlightly() }
        XCTAssertTrue(app.buttons["Say: Orange"].isHittable)
        XCTAssertEqual(app.buttons["Say: Orange"].identifier, "aac-picture-co-orange.png", "A color selection must never reopen as fruit")
        revealFully(app.buttons["Say: Orange"])
        capture("standalone-orange-color-recent")
    }

    private func openCategory(_ label: String) {
        let category = app.buttons[label]
        for _ in 0..<60 where !category.isHittable { scrollBroadly(up: true) }
        XCTAssertTrue(category.isHittable, app.debugDescription)
        revealFully(category)
        category.tap()
    }

    func testOfflineSpatialCardsKeepGeneratedPicturesAndMeanings() {
        for (language, category, inside, on) in [
            ("🇩🇪 DE", "Mehr / Nicht / Alle category", "Rein", "Auf"),
            ("🇪🇸 ES", "Más / No / Todo category", "Dentro", "Sobre")
        ] {
            openLanguagePicker()
            selectLanguage(language)
            app.buttons["Done"].tap()
            openCategory(category)
            for (filename, label) in [("cw-in.png", inside), ("cw-on.png", on)] {
                let card = categoryPictureCard(filename)
                for _ in 0..<32 where !card.isHittable { scrollUpSlightly() }
                revealFully(card)
                XCTAssertEqual(card.label, "Say: \(label)")
                capture("spatial-\(language)-\(filename)")
            }
            categoryPictureCard("cw-on.png").tap()
            app.terminate()
            app.launch()
            let recent = app.buttons["Say: \(on)"]
            XCTAssertTrue(recent.waitForExistence(timeout: 15))
            XCTAssertEqual(recent.identifier, "aac-picture-cw-on.png")
        }
    }

    private func categoryPictureCard(_ filename: String) -> XCUIElement {
        // The modal card follows any home recent with the same canonical picture.
        let matches = app.buttons.matching(identifier: "aac-picture-\(filename)")
        return matches.element(boundBy: max(0, matches.count - 1))
    }

    func testZLegacyLabelsDoNotGuessOrangeMeaning() {
        // This scenario asserts English legacy labels even after a preceding
        // language-switch workflow has persisted another display language.
        openLanguagePicker()
        selectLanguage("🇺🇸 EN")
        app.buttons["Done"].tap()
        app.terminate()
        app.launchArguments = ["-recent_phrase_records", "legacy", "-recent_phrase_labels", "\"[\\\"Orange\\\",\\\"I\\\"]\""]
        app.launch()
        let orange = app.buttons["Say: Orange"]
        XCTAssertTrue(orange.waitForExistence(timeout: 15))
        revealFully(orange)
        XCTAssertEqual(orange.identifier, "aac-picture-text", "A legacy label cannot choose between fruit and color artwork")
        let iPhrase = app.buttons["Say: I"]
        XCTAssertTrue(iPhrase.isHittable)
        XCTAssertEqual(iPhrase.identifier, "aac-picture-cw-i.png", "An unambiguous legacy word should retain its generated picture")
        capture("legacy-orange-text-and-generated-i")
    }

    func testBasicWordsUseGeneratedPicturesAfterColdRelaunch() throws {
        openLanguagePicker()
        selectLanguage("🇺🇸 EN")
        app.buttons["Done"].tap()
        app.terminate()
        try launchRecentWords(["girls", "boys", "bottles", "bother", "was"], sourceLanguage: "en-US")
        for (word, filename) in [
            ("girls", "pp-girl.png"), ("boys", "pp-boy.png"),
            ("bottles", "w-bottle.png"), ("bother", "w-bother.png"),
            ("was", "w-past-being.png")
        ] {
            let card = app.buttons["Say: \(word)"]
            XCTAssertTrue(card.waitForExistence(timeout: 15))
            revealFully(card)
            XCTAssertEqual(card.identifier, "aac-picture-\(filename)")
            capture("basic-generated-\(word)")
        }
        let bother = app.buttons["Say: bother"]
        revealFully(bother)
        bother.tap()
        app.terminate()
        app.launchArguments = []
        app.launch()
        let persisted = app.buttons["Say: bother"]
        XCTAssertTrue(persisted.waitForExistence(timeout: 15))
        revealFully(persisted)
        XCTAssertEqual(persisted.identifier, "aac-picture-w-bother.png")
        capture("basic-generated-bother-relaunched")
        openLanguagePicker()
        selectLanguage("🇪🇸 ES")
        app.buttons["Done"].tap()
        let switched = app.buttons["Say: bother"]
        XCTAssertTrue(switched.waitForExistence(timeout: 15))
        revealFully(switched)
        XCTAssertEqual(switched.identifier, "aac-picture-w-bother.png", "Changing display language must retain the original recent word picture")
        capture("basic-generated-bother-spanish")
        app.terminate()
        app.launch()
        let relaunched = app.buttons["Say: bother"]
        XCTAssertTrue(relaunched.waitForExistence(timeout: 15))
        revealFully(relaunched)
        XCTAssertEqual(relaunched.identifier, "aac-picture-w-bother.png")
        capture("basic-generated-bother-spanish-relaunched")
    }

    func testReportedQuarterAndQualityKeepPicturesAfterColdRelaunch() throws {
        openLanguagePicker()
        selectLanguage("🇺🇸 EN")
        app.buttons["Done"].tap()
        app.terminate()
        try launchRecentWords(["quarter", "quality"], sourceLanguage: "en-US")
        for (word, file) in [("quarter", "w-quarter.png"), ("quality", "w-quality.png")] {
            let card = app.buttons["Say: \(word)"]
            XCTAssertTrue(card.waitForExistence(timeout: 15))
            revealFully(card)
            XCTAssertEqual(card.identifier, "aac-picture-\(file)")
            capture("reported-generated-\(word)")
            card.tap()
            app.terminate()
            app.launchArguments = []
            app.launch()
            let restored = app.buttons["Say: \(word)"]
            XCTAssertTrue(restored.waitForExistence(timeout: 15))
            revealFully(restored)
            XCTAssertEqual(restored.identifier, "aac-picture-\(file)")
            capture("reported-generated-\(word)-relaunched")
        }
    }

    func testLegacyGermanQuestionKeepsLanguageProvenance() throws {
        openLanguagePicker()
        selectLanguage("🇩🇪 DE")
        app.buttons["Done"].tap()
        app.terminate()
        app.launchArguments = ["-recent_phrase_records", "legacy", "-recent_phrase_labels", "\"[\\\"Was?\\\"]\""]
        app.launch()
        let unknown = app.buttons["Say: Was?"]
        XCTAssertTrue(unknown.waitForExistence(timeout: 15))
        revealFully(unknown)
        XCTAssertEqual(unknown.identifier, "aac-picture-text", "An untagged homograph must not acquire English past-tense artwork")
        capture("legacy-german-question-unknown-language")
        openLanguagePicker()
        selectLanguage("🇺🇸 EN")
        app.buttons["Done"].tap()
        let retapped = app.buttons["Say: Was?"]
        revealFully(retapped)
        retapped.tap()
        app.terminate()
        app.launchArguments = []
        app.launch()
        let stillUnknown = app.buttons["Say: Was?"]
        XCTAssertTrue(stillUnknown.waitForExistence(timeout: 15))
        revealFully(stillUnknown)
        XCTAssertEqual(stillUnknown.identifier, "aac-picture-text", "A retap cannot invent the legacy word's source language")
        capture("legacy-german-question-retapped-english")
        app.terminate()
        try launchRecentWords(["Was?"], sourceLanguage: "de-DE")
        let known = app.buttons["Say: Was?"]
        XCTAssertTrue(known.waitForExistence(timeout: 15))
        revealFully(known)
        XCTAssertEqual(known.identifier, "aac-picture-qu-what.png")
        capture("known-german-question-generated")
        openLanguagePicker()
        selectLanguage("🇺🇸 EN")
        app.buttons["Done"].tap()
        let translated = app.buttons.matching(identifier: "aac-picture-qu-what.png").firstMatch
        XCTAssertTrue(translated.waitForExistence(timeout: 15))
        revealFully(translated)
        capture("known-german-question-english-display")
    }

    func testFrenchBreadKeepsItsMeaningAcrossDisplayLanguages() throws {
        openLanguagePicker()
        selectLanguage("🇫🇷 FR")
        app.buttons["Done"].tap()
        app.terminate()
        try launchRecentWords(["Pain"], sourceLanguage: "fr-FR", pictureID: "fd-bread")
        let bread = app.buttons["Say: Pain"]
        XCTAssertTrue(bread.waitForExistence(timeout: 15))
        revealFully(bread)
        XCTAssertEqual(bread.identifier, "aac-picture-fd-bread.png")
        capture("french-bread-pain-generated")
        openLanguagePicker()
        selectLanguage("🇩🇪 DE")
        app.buttons["Done"].tap()
        let german = app.buttons["Say: Brot"]
        XCTAssertTrue(german.waitForExistence(timeout: 15))
        revealFully(german)
        XCTAssertEqual(german.identifier, "aac-picture-fd-bread.png")
        capture("french-bread-german-display")
    }

    private func launchRecentWords(_ words: [String], sourceLanguage: String, pictureID: String? = nil) throws {
        let records = words.map { word in
            var record: [String: Any] = ["label": word, "canonicalLabel": word, "sfSymbol": "", "allowsLabelPicture": true,
             "isEmergency": false, "sourceLanguage": sourceLanguage]
            if let pictureID { record["pictureID"] = pictureID }
            return record
        }
        let data = try JSONSerialization.data(withJSONObject: records)
        let json = String(decoding: data, as: UTF8.self)
        app.launchArguments = ["-recent_phrase_records", "\"" + json.replacingOccurrences(of: "\"", with: "\\\"") + "\""]
        app.launch()
    }

    private func revealFully(_ element: XCUIElement) {
        for _ in 0..<24 {
            let frame = element.frame
            if frame.minY >= 64 && frame.maxY <= app.frame.height { break }
            if frame.maxY > app.frame.height { scrollUpSlightly() } else { scrollDownSlightly() }
        }
        XCTAssertGreaterThanOrEqual(element.frame.minY, 64, "The card must clear the fixed toolbar")
        XCTAssertLessThanOrEqual(element.frame.maxY, app.frame.height, "The picture and label must fit the display")
        XCTAssertTrue(element.isHittable)
    }

    private func returnToTop() {
        for _ in 0..<60 where !app.buttons["Say: Yes"].isHittable { scrollBroadly(up: false) }
        XCTAssertTrue(app.buttons["Say: Yes"].isHittable)
    }

    private func scrollBroadly(up: Bool) {
        let start = app.coordinate(withNormalizedOffset: CGVector(dx: 0.5, dy: up ? 0.85 : 0.40))
        let end = app.coordinate(withNormalizedOffset: CGVector(dx: 0.5, dy: up ? 0.40 : 0.85))
        start.press(forDuration: 0.15, thenDragTo: end, withVelocity: XCUIGestureVelocity(rawValue: 90), thenHoldForDuration: 0.5)
    }

    private func capture(_ name: String) {
        let shot = XCTAttachment(screenshot: XCUIScreen.main.screenshot())
        shot.name = name
        shot.lifetime = .keepAlways
        add(shot)
    }

    private func openLanguagePicker() {
        let languageButton = app.buttons["watch-language-picker"]
        XCTAssertTrue(languageButton.waitForExistence(timeout: 10))
        languageButton.tap()
        if !app.buttons["Input"].waitForExistence(timeout: 5), languageButton.exists {
            languageButton.tap()
        }
        XCTAssertTrue(app.buttons["Input"].waitForExistence(timeout: 5))
    }

    private func selectLanguage(_ label: String) {
        let language = app.buttons.matching(
            NSPredicate(format: "label CONTAINS %@", label)
        ).firstMatch
        for _ in 0..<16 where !language.isHittable {
            scrollUpSlightly()
        }
        XCTAssertTrue(language.waitForExistence(timeout: 5), "Language option should be available: \(label)")
        XCTAssertTrue(language.isHittable, "Language option should be visible: \(label)\n\(app.debugDescription)")
        language.tap()
    }

    private func scrollUpSlightly() {
        let start = app.coordinate(withNormalizedOffset: CGVector(dx: 0.5, dy: 0.80))
        let end = app.coordinate(withNormalizedOffset: CGVector(dx: 0.5, dy: 0.64))
        start.press(forDuration: 0.15, thenDragTo: end, withVelocity: XCUIGestureVelocity(rawValue: 30), thenHoldForDuration: 0.5)
    }

    private func scrollDownSlightly() {
        let start = app.coordinate(withNormalizedOffset: CGVector(dx: 0.5, dy: 0.64))
        let end = app.coordinate(withNormalizedOffset: CGVector(dx: 0.5, dy: 0.80))
        start.press(forDuration: 0.15, thenDragTo: end, withVelocity: XCUIGestureVelocity(rawValue: 30), thenHoldForDuration: 0.5)
    }
}
