// @vitest-environment node
/**
 * Watch recents saved before language provenance show a picture only when the
 * word has one meaning.
 *
 * Older Watch builds stored recent phrases as bare labels with no language.
 * AACPictureLibrary.filename(legacyWord:) chooses art for them from every
 * language's word table. A word that some language reads two ways ("Orange":
 * fruit or color) must stay text, even when another language lists only one of
 * those meanings. This compiles the real AACPictureLibrary with the shipped
 * word tables over a stand-in pack (the real pictures are not in this repo;
 * the lookup needs only their names). Needs a Swift toolchain (macOS); skipped
 * where none is installed.
 */
import { describe, expect, it } from 'vitest';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const ROOT = path.resolve(__dirname, '..');
const LIBRARY = path.join(ROOT, 'ios-native/PrismAACWatch/Sources/Resources/AACPictureLibrary.swift');
const generated = (name: string) => JSON.parse(fs.readFileSync(path.join(ROOT, 'constants/generated', name), 'utf8'));
const hasSwift = process.platform === 'darwin' && spawnSync('xcrun', ['--find', 'swiftc']).status === 0;

type Basic = {
  languages: Record<string, Record<string, { file: string }>>;
  alternatives?: Record<string, Record<string, { files: string[] }>>;
};

/** The bundle layout prepare-native-picture-pack.mjs writes, with placeholder image bytes. */
function writeBundle(dir: string, basicVocabulary: Basic) {
  const names = Object.keys(generated('phraseSymbolFiles.json').files).sort();
  const images = names.map(name => Buffer.from(`placeholder ${name}`));
  const files: Record<string, { offset: number; length: number; sha256: string }> = {};
  let offset = 0;
  names.forEach((name, i) => {
    files[name] = { offset, length: images[i].length, sha256: createHash('sha256').update(images[i]).digest('hex') };
    offset += images[i].length;
  });
  const index = Buffer.from(JSON.stringify({ files }), 'utf8');
  const length = Buffer.alloc(4);
  length.writeUInt32BE(index.length);
  const pack = Buffer.concat([Buffer.from('PAACPK01', 'ascii'), length, index, ...images]);
  fs.writeFileSync(path.join(dir, 'AACPictures.aacpack'), pack);
  fs.writeFileSync(path.join(dir, 'aacPictureManifest.json'), JSON.stringify({
    format: 1, version: createHash('sha256').update(pack).digest('hex'),
    byteLength: pack.length, fileCount: names.length, indexByteLength: index.length,
  }));
  fs.writeFileSync(path.join(dir, 'aacPictureSymbols.json'), JSON.stringify({ ...generated('phraseSymbols.json'), basicVocabulary }));
}

function legacyPictures(words: string[]): { fileCount: number; pictures: Record<string, string> } {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'watch-legacy-words-'));
  try {
    const bundle = path.join(dir, 'bundle');
    fs.mkdirSync(bundle);
    writeBundle(bundle, generated('basicVocabularyPictures.json'));
    fs.writeFileSync(path.join(dir, 'main.swift'), `import Foundation
let library = AACPictureLibrary(directory: URL(fileURLWithPath: CommandLine.arguments[1], isDirectory: true))
let words = try JSONDecoder().decode([String].self, from: FileHandle.standardInput.readDataToEndOfFile())
var pictures: [String: String] = [:]
for word in words { pictures[word] = library.filename(legacyWord: word) ?? "" }
struct Result: Encodable { let fileCount: Int; let pictures: [String: String] }
print(String(data: try JSONEncoder().encode(Result(fileCount: library.fileCount, pictures: pictures)), encoding: .utf8)!)
`);
    const binary = path.join(dir, 'legacy');
    const build = spawnSync('xcrun', ['swiftc', LIBRARY, path.join(dir, 'main.swift'), '-o', binary], { encoding: 'utf8' });
    expect(build.status, build.stderr).toBe(0);
    const run = spawnSync(binary, [bundle], { input: JSON.stringify(words), encoding: 'utf8' });
    expect(run.status, run.stderr).toBe(0);
    return JSON.parse(run.stdout);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
}

describe.skipIf(!hasSwift)('Watch legacy recent labels', () => {
  it('keep every word some language reads two ways as text, and still picture a word with one meaning', () => {
    const basic: Basic = generated('basicVocabularyPictures.json');
    const ambiguous = [...new Set(Object.values(basic.alternatives ?? {}).flatMap(table => Object.keys(table)))];
    expect(ambiguous).toContain('orange');
    // French lists only the fruit for "orange"; English and German list fruit and color.
    expect(basic.languages.fr.orange.file).toBe('fd-orange.png');

    const { fileCount, pictures } = legacyPictures([...ambiguous, 'Orange', 'I']);
    expect(fileCount).toBeGreaterThan(1000);
    expect(ambiguous.filter(word => pictures[word] !== '').map(word => `${word} -> ${pictures[word]}`)).toEqual([]);
    expect(pictures.Orange).toBe('');
    expect(pictures.I).toBe('cw-i.png');
  }, 120_000);
});
