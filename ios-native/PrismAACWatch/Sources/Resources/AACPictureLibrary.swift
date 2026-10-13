import Foundation
import CryptoKit
import CoreGraphics
import ImageIO

/// Immutable generated artwork, installed in the app bundle before signing.
/// Selection uses approved IDs; changing a displayed language never changes the art.
final class AACPictureLibrary {
    static let shared = AACPictureLibrary(directory: Bundle.main.resourceURL)
    private static let packLimit = 16 * 1024 * 1024
    private static let metadataLimit = 512 * 1024
    private static let thumbnailPixels = 104
    private static let decodedBudget = 1024 * 1024
    private static let cacheCountLimit = 20
    private static let magic = Data("PAACPK01".utf8)

    private struct Manifest: Decodable {
        let format: Int
        let version: String
        let byteLength: Int
        let fileCount: Int
        let indexByteLength: Int
    }
    private struct Entry: Decodable {
        let offset: Int
        let length: Int
        let sha256: String
    }
    private struct Index: Decodable { let files: [String: Entry] }
    private struct BasicEntry: Decodable {
        let file: String
        let means: String
    }
    private struct BasicVocabulary: Decodable {
        let generatedFrom: String
        let languages: [String: [String: BasicEntry]]
        let alternatives: [String: [String: AlternativeEntry]]?
    }
    private struct AlternativeEntry: Decodable {
        let files: [String]
        let means: String
    }
    private struct Symbols: Decodable {
        let phrases: [String: String]
        let categories: [String: String]
        let words: [String: String]?
        let basicVocabulary: BasicVocabulary?
    }
    private struct Storage {
        let bytes: Data
        let dataStart: Int
        let files: [String: Entry]
        let symbols: Symbols
        let version: String
    }
    private enum Invalid: Error { case resource }
    private let storage: Storage?
    @MainActor private var images: [String: CGImage] = [:]
    @MainActor private var recentFiles: [String] = []
    @MainActor private var decodedBytes = 0

    init(directory: URL?) {
        storage = try? Self.load(directory: directory)
        if storage == nil { NSLog("[WatchPictures] Bundled library unavailable; retaining word labels") }
    }

    var fileCount: Int { storage?.files.count ?? 0 }
    var version: String? { storage?.version }

    func filename(phraseID: String) -> String? {
        approved(storage?.symbols.phrases[phraseID])
    }
    func filename(categoryID: String) -> String? {
        approved(storage?.symbols.categories[categoryID])
    }
    func filename(legacyWord: String) -> String? {
        guard let basicVocabulary = storage?.symbols.basicVocabulary else { return nil }
        let languages = basicVocabulary.languages
        // A legacy label has no language. If any language reads it two ways
        // ("Orange": fruit or color), no single picture is its meaning.
        if let alternatives = basicVocabulary.alternatives,
           alternatives.keys.contains(where: { !alternativeFilenames(word: legacyWord, language: $0).isEmpty }) {
            return nil
        }
        let candidates = Set(languages.keys.compactMap {
            filename(word: legacyWord, language: $0, allowEnglishWordFallback: false)
        })
        return candidates.count == 1 ? approved(candidates.first) : nil
    }
    /// A known-language word can show its reviewed meanings without guessing one.
    func alternativeFilenames(word: String, language: String) -> [String] {
        let code = language.replacingOccurrences(of: "_", with: "-").split(separator: "-").first?.lowercased() ?? ""
        guard let table = storage?.symbols.basicVocabulary?.alternatives?[code] else { return [] }
        let key = Self.normalizedWord(word, language: language, stripEdgePunctuation: true)
        guard let entry = table[key], (2...3).contains(entry.files.count),
              Set(entry.files).count == entry.files.count,
              entry.files.allSatisfy({ approved($0) != nil }) else { return [] }
        return entry.files
    }
    func filename(word: String, language: String, allowEnglishWordFallback: Bool = true) -> String? {
        guard let storage else { return nil }
        guard alternativeFilenames(word: word, language: language).isEmpty else { return nil }
        let exactKey = Self.normalizedWord(word, language: language, stripEdgePunctuation: false)
        guard !exactKey.isEmpty else { return nil }
        if let table = Self.basicVocabularyTable(language, in: storage.symbols.basicVocabulary?.languages) {
            let exactCandidates = Self.wordCandidates(table.mapValues(\.file), matching: exactKey, language: language, stripEdgePunctuation: false)
            if !exactCandidates.isEmpty {
                return exactCandidates.count == 1 ? approved(exactCandidates.first) : nil
            }
            let fallbackKey = Self.normalizedWord(word, language: language, stripEdgePunctuation: true)
            if !fallbackKey.isEmpty {
                let fallbackCandidates = Self.wordCandidates(table.mapValues(\.file), matching: fallbackKey, language: language, stripEdgePunctuation: true)
                if !fallbackCandidates.isEmpty {
                    return fallbackCandidates.count == 1 ? approved(fallbackCandidates.first) : nil
                }
            }
        }
        let languageCode = String(language.replacingOccurrences(of: "_", with: "-").split(separator: "-").first ?? "").lowercased()
        guard allowEnglishWordFallback, languageCode == "en", let words = storage.symbols.words else { return nil }
        let exactWordCandidates = Self.wordCandidates(words, matching: exactKey, language: language, stripEdgePunctuation: false)
        if !exactWordCandidates.isEmpty {
            return exactWordCandidates.count == 1 ? approved(exactWordCandidates.first) : nil
        }
        let fallbackKey = Self.normalizedWord(word, language: language, stripEdgePunctuation: true)
        guard !fallbackKey.isEmpty else { return nil }
        let fallbackWordCandidates = Self.wordCandidates(words, matching: fallbackKey, language: language, stripEdgePunctuation: true)
        return fallbackWordCandidates.count == 1 ? approved(fallbackWordCandidates.first) : nil
    }
    private func approved(_ filename: String?) -> String? {
        guard let filename, storage?.files[filename] != nil else { return nil }
        return filename
    }

    /// Exposes original bytes for local bundle verification, never a remote URL.
    func pictureBytes(filename: String) -> Data? {
        guard let storage, let entry = storage.files[filename] else { return nil }
        let start = storage.dataStart + entry.offset
        let bytes = storage.bytes.subdata(in: start..<(start + entry.length))
        guard Self.hash(bytes) == entry.sha256 else { return nil }
        return bytes
    }

    /// Decoding is serial and display-sized. The cache has a hard byte budget.
    @MainActor func image(filename: String) -> CGImage? {
        if let image = images[filename] {
            recentFiles.removeAll { $0 == filename }
            recentFiles.append(filename)
            return image
        }
        guard let bytes = pictureBytes(filename: filename),
              let source = CGImageSourceCreateWithData(bytes as CFData,
                  [kCGImageSourceShouldCache: false] as CFDictionary),
              let properties = CGImageSourceCopyPropertiesAtIndex(source, 0, nil) as? [CFString: Any],
              let width = properties[kCGImagePropertyPixelWidth] as? Int,
              let height = properties[kCGImagePropertyPixelHeight] as? Int,
              min(width, height) >= 32, max(width, height) == 256,
              let image = CGImageSourceCreateThumbnailAtIndex(source, 0, [
                kCGImageSourceCreateThumbnailFromImageAlways: true,
                kCGImageSourceThumbnailMaxPixelSize: Self.thumbnailPixels,
                kCGImageSourceShouldCacheImmediately: true,
              ] as CFDictionary),
              image.width <= Self.thumbnailPixels, image.height <= Self.thumbnailPixels else { return nil }
        let cost = image.bytesPerRow * image.height
        guard cost <= Self.decodedBudget else { return nil }
        while decodedBytes + cost > Self.decodedBudget || images.count >= Self.cacheCountLimit {
            guard !recentFiles.isEmpty else { return nil }
            let oldest = recentFiles.removeFirst()
            if let removed = images.removeValue(forKey: oldest) {
                decodedBytes -= removed.bytesPerRow * removed.height
            }
        }
        images[filename] = image
        recentFiles.append(filename)
        decodedBytes += cost
        return image
    }

    @MainActor var cachedDecodedBytes: Int { decodedBytes }
    @MainActor var cachedImageCount: Int { images.count }

    private static func hash(_ bytes: Data) -> String {
        SHA256.hash(data: bytes).map { String(format: "%02x", $0) }.joined()
    }
    private static func read(_ url: URL, limit: Int, mapped: Bool = false) throws -> Data {
        let properties = try url.resourceValues(forKeys: [.fileSizeKey, .isRegularFileKey, .isSymbolicLinkKey])
        guard url.isFileURL, properties.isRegularFile == true, properties.isSymbolicLink != true,
              let size = properties.fileSize, size > 0, size <= limit else { throw Invalid.resource }
        return try Data(contentsOf: url, options: mapped ? .mappedIfSafe : [])
    }
    private static func validName(_ name: String) -> Bool {
        name.range(of: "^[a-z0-9][a-z0-9_-]*\\.png$", options: .regularExpression) != nil
    }
    private static func basicVocabularyTable(
        _ language: String,
        in languages: [String: [String: BasicEntry]]?
    ) -> [String: BasicEntry]? {
        guard let languages else { return nil }
        let code = language.replacingOccurrences(of: "_", with: "-")
        if let exact = languages.first(where: { $0.key.caseInsensitiveCompare(code) == .orderedSame })?.value {
            return exact
        }
        let base = String(code.split(separator: "-").first ?? "").lowercased()
        if base == "zh" {
            return languages["zh-Hans"]
        }
        return languages.first(where: { $0.key.caseInsensitiveCompare(base) == .orderedSame })?.value
    }
    private static func wordCandidates(
        _ table: [String: String],
        matching key: String,
        language: String,
        stripEdgePunctuation: Bool
    ) -> Set<String> {
        Set(table.compactMap { spelling, entry in
            normalizedWord(spelling, language: language, stripEdgePunctuation: stripEdgePunctuation) == key
                ? entry : nil
        })
    }
    private static func normalizedWord(
        _ word: String,
        language: String,
        stripEdgePunctuation: Bool
    ) -> String {
        let normalizedLanguage = language.replacingOccurrences(of: "_", with: "-")
        let code = String(normalizedLanguage.split(separator: "-").first ?? Substring(normalizedLanguage)).lowercased()
        var folded = word.precomposedStringWithCanonicalMapping.replacingOccurrences(of: "’", with: "'")
        if code == "tr" {
            folded = folded.lowercased(with: Locale(identifier: "tr"))
                .replacingOccurrences(of: "i\u{0307}", with: "i")
        } else {
            folded = folded.lowercased()
        }
        let scalars = Array(folded.unicodeScalars)
        if code == "ar", !stripEdgePunctuation {
            let punctuation = CharacterSet.whitespacesAndNewlines.union(.punctuationCharacters)
            let trailing = scalars.reversed().prefix(while: { punctuation.contains($0) })
            if trailing.contains(where: { $0 == "?" || $0 == "؟" }) {
                return normalizedWord(word, language: language, stripEdgePunctuation: true) + "؟"
            }
        }
        let edgeCharacters = stripEdgePunctuation
            ? CharacterSet.whitespacesAndNewlines.union(.punctuationCharacters)
            : CharacterSet.whitespacesAndNewlines
        var start = 0
        var end = scalars.count
        while start < end && edgeCharacters.contains(scalars[start]) { start += 1 }
        while end > start && edgeCharacters.contains(scalars[end - 1]) { end -= 1 }
        let trimmed = String(String.UnicodeScalarView(scalars[start..<end]))
        return trimmed.components(separatedBy: .whitespacesAndNewlines)
            .filter { !$0.isEmpty }.joined(separator: " ").precomposedStringWithCanonicalMapping
    }
    private static func load(directory: URL?) throws -> Storage {
        guard let directory, directory.isFileURL else { throw Invalid.resource }
        let decoder = JSONDecoder()
        let manifest = try decoder.decode(Manifest.self, from: read(
            directory.appendingPathComponent("aacPictureManifest.json"), limit: metadataLimit))
        let symbols = try decoder.decode(Symbols.self, from: read(
            directory.appendingPathComponent("aacPictureSymbols.json"), limit: metadataLimit))
        let bytes = try read(directory.appendingPathComponent("AACPictures.aacpack"), limit: packLimit, mapped: true)
        guard manifest.format == 1, bytes.count == manifest.byteLength, bytes.count >= 13,
              manifest.fileCount > 0, manifest.indexByteLength > 0,
              manifest.indexByteLength <= metadataLimit, bytes.prefix(8) == magic,
              hash(bytes) == manifest.version else { throw Invalid.resource }
        let indexLength = bytes[8..<12].reduce(0) { ($0 << 8) | Int($1) }
        guard indexLength == manifest.indexByteLength, indexLength <= bytes.count - 12 else { throw Invalid.resource }
        let dataStart = 12 + indexLength
        let index = try decoder.decode(Index.self, from: bytes.subdata(in: 12..<dataStart))
        guard index.files.count == manifest.fileCount else { throw Invalid.resource }
        var offset = 0
        for name in index.files.keys.sorted() {
            guard let entry = index.files[name], validName(name), entry.offset == offset,
                  entry.length > 0, entry.length <= bytes.count - dataStart - offset,
                  entry.sha256.range(of: "^[a-f0-9]{64}$", options: .regularExpression) != nil else { throw Invalid.resource }
            offset += entry.length
        }
        let basicFiles = symbols.basicVocabulary?.languages.values.flatMap { $0.values.map(\.file) } ?? []
        let alternativeFiles = symbols.basicVocabulary?.alternatives?.values.flatMap { $0.values.flatMap(\.files) } ?? []
        let wordFiles = symbols.words.map { Array($0.values) } ?? []
        guard offset == bytes.count - dataStart,
              alternativeFiles.allSatisfy({ index.files[$0] != nil }),
              Array(symbols.phrases.values).allSatisfy({ index.files[$0] != nil }),
              Array(symbols.categories.values).allSatisfy({ index.files[$0] != nil }),
              wordFiles.allSatisfy({ index.files[$0] != nil }),
              basicFiles.allSatisfy({ index.files[$0] != nil }) else { throw Invalid.resource }
        return Storage(bytes: bytes, dataStart: dataStart, files: index.files,
                       symbols: symbols, version: manifest.version)
    }
}
