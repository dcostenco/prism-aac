import Foundation
import CryptoKit

@main struct NativePictureCheck {
    @MainActor static func main() throws {
        guard CommandLine.arguments.count == 3 else { fatalError("Provide bundle directory and approved file metadata") }
        let directory = URL(fileURLWithPath: CommandLine.arguments[1])
        let library = AACPictureLibrary(directory: directory)
        let reviewed = try JSONSerialization.jsonObject(with: Data(contentsOf: URL(fileURLWithPath: CommandLine.arguments[2]))) as! [String: Any]
        let files = reviewed["files"] as! [String: [String: Any]]
        guard !files.isEmpty, library.fileCount == files.count else { fatalError("Complete generated library was not loaded") }
        for (name, metadata) in files {
            guard let bytes = library.pictureBytes(filename: name),
                  SHA256.hash(data: bytes).map({ String(format: "%02x", $0) }).joined() == metadata["sha256"] as? String,
                  library.image(filename: name) != nil else { fatalError("Generated image is not usable: \(name)") }
            guard library.cachedDecodedBytes <= 1024 * 1024, library.cachedImageCount <= 20 else { fatalError("Decoded cache exceeded budget") }
        }
        let bundledSymbolsURL = directory.appendingPathComponent("aacPictureSymbols.json")
        let bundledSymbols = try JSONSerialization.jsonObject(with: Data(contentsOf: bundledSymbolsURL)) as! [String: Any]
        let basicVocabulary = bundledSymbols["basicVocabulary"] as! [String: Any]
        let languages = basicVocabulary["languages"] as! [String: [String: [String: Any]]]
        var primaryAliasCount = 0
        for (language, words) in languages {
            for (word, entry) in words {
                guard let expected = entry["file"] as? String,
                      library.filename(word: word, language: language) == expected else {
                    fatalError("Primary picture lookup mismatch for \(language): \(word)")
                }
                primaryAliasCount += 1
                if language == "tr" {
                    let uppercase = word.uppercased(with: Locale(identifier: "tr"))
                    guard library.filename(word: uppercase, language: language) == expected else {
                        fatalError("Turkish case-folded picture lookup mismatch for \(word)")
                    }
                }
            }
        }
        let englishPrimary = languages["en"] ?? [:]
        let englishWords = bundledSymbols["words"] as! [String: String]
        func normalizedEnglish(_ value: String, stripPunctuation: Bool) -> String {
            var scalars = Array(value.precomposedStringWithCanonicalMapping
                .replacingOccurrences(of: "’", with: "'").lowercased().unicodeScalars)
            let edges = stripPunctuation ? CharacterSet.whitespacesAndNewlines.union(.punctuationCharacters) : .whitespacesAndNewlines
            var start = 0
            var end = scalars.count
            while start < end && edges.contains(scalars[start]) { start += 1 }
            while end > start && edges.contains(scalars[end - 1]) { end -= 1 }
            return String(String.UnicodeScalarView(scalars[start..<end]))
                .components(separatedBy: .whitespacesAndNewlines)
                .filter { !$0.isEmpty }.joined(separator: " ").precomposedStringWithCanonicalMapping
        }
        var englishWordCount = 0
        for (word, fallbackFile) in englishWords {
            let key = normalizedEnglish(word, stripPunctuation: false)
            let exact = englishPrimary.filter { normalizedEnglish($0.key, stripPunctuation: false) == key }
            let primary = exact.isEmpty
                ? englishPrimary.filter { normalizedEnglish($0.key, stripPunctuation: true) == normalizedEnglish(word, stripPunctuation: true) }
                : exact
            let primaryFiles = Set(primary.values.compactMap { $0["file"] as? String })
            let expected = primary.isEmpty ? fallbackFile : primaryFiles.count == 1 ? primaryFiles.first : nil
            guard library.filename(word: word, language: "en") == expected else {
                fatalError("English word picture lookup mismatch for \(word); expected \(expected ?? "no unambiguous file")")
            }
            englishWordCount += 1
        }
        guard let arabicFrom = languages["ar"]?["من"]?["file"] as? String,
              let arabicWho = languages["ar"]?["من؟"]?["file"] as? String,
              arabicFrom != arabicWho,
              library.filename(word: "من", language: "ar") == arabicFrom,
              ["من؟", "من?", "من؟؟", "من??", "من؟?", "من؟!", "من?…"].allSatisfy({
                  library.filename(word: $0, language: "ar") == arabicWho
              }) else {
            fatalError("Punctuation-distinct Arabic aliases did not resolve exactly")
        }
        guard library.filename(phraseID: "cw-more") == "cw-more.png", library.filename(categoryID: "core-descriptors") == "cat-core-descriptors.png", library.filename(phraseID: "unknown-id") == nil else { fatalError("Canonical image lookup is incorrect") }
        guard library.filename(legacyWord: "Was?") == nil,
              library.filename(legacyWord: "girls") == "pp-girl.png",
              library.filename(legacyWord: "bottles") == "w-bottle.png",
              library.filename(legacyWord: "I") == "cw-i.png",
              library.filename(word: "Was?", language: "de") == "qu-what.png" else {
            fatalError("Legacy language provenance or German question lookup is incorrect")
        }
        print("Native generated picture check: \(library.fileCount) original images decoded and matched; \(primaryAliasCount) primary aliases and \(englishWordCount) English word links resolved; cache \(library.cachedDecodedBytes) bytes, \(library.cachedImageCount) images")
    }
}
