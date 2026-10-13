// @vitest-environment node
/**
 * Every picture on the Watch home screen fits the decoded-picture cache.
 *
 * The home screen builds all of its cards at once: Yes/No, up to six recents
 * and every category. Each render asks AACPictureLibrary for each card's
 * thumbnail. If the cache holds fewer thumbnails than the screen shows, every
 * render evicts the next one it needs and decodes them all again on the main
 * thread. This compiles the real AACPictureLibrary over a pack of real 256px
 * PNGs, decodes one per home-screen card, and requires all of them to stay
 * cached. Needs a Swift toolchain (macOS); skipped where none is installed.
 */
import { describe, expect, it } from 'vitest';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import zlib from 'node:zlib';

const ROOT = path.resolve(__dirname, '..');
const WATCH = path.join(ROOT, 'ios-native/PrismAACWatch/Sources');
const LIBRARY = path.join(WATCH, 'Resources/AACPictureLibrary.swift');
const hasSwift = process.platform === 'darwin' && spawnSync('xcrun', ['--find', 'swiftc']).status === 0;

/**
 * Cards the home screen can show at once: Yes/No, the recents cap, and the
 * larger of the default category set and the synced-category cap.
 */
function homeScreenCards(): number {
  const vocab = fs.readFileSync(path.join(WATCH, 'AI/WatchVocabSync.swift'), 'utf8');
  const set = vocab.slice(vocab.indexOf('static let iOSDefaultSet'));
  const defaults = set.slice(0, set.indexOf('\n    ]')).match(/WatchCategory\(id: "/g)?.length ?? 0;
  const syncedCaps = [...vocab.matchAll(/vocab\.categories\.prefix\((\d+)\)/g)].map(m => Number(m[1]));
  const cards = fs.readFileSync(path.join(WATCH, 'Views/WatchPictogramCards.swift'), 'utf8');
  const recents = Number(/if records\.count > (\d+)/.exec(cards)?.[1]);
  expect(defaults).toBeGreaterThan(10);
  expect(syncedCaps.length).toBeGreaterThan(0);
  expect(recents).toBe(6);
  return 2 + recents + Math.max(defaults, ...syncedCaps);
}

function chunk(type: string, data: Buffer): Buffer {
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(zlib.crc32(body) >>> 0);
  return Buffer.concat([length, body, crc]);
}

/** A 256×256 RGB PNG filled with one shade, so every file has distinct bytes. */
function png(shade: number): Buffer {
  const header = Buffer.alloc(13);
  header.writeUInt32BE(256, 0);
  header.writeUInt32BE(256, 4);
  header.set([8, 2, 0, 0, 0], 8);
  const row = Buffer.concat([Buffer.from([0]), Buffer.alloc(256 * 3, shade)]);
  const pixels = zlib.deflateSync(Buffer.concat(Array.from({ length: 256 }, () => row)));
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk('IHDR', header), chunk('IDAT', pixels), chunk('IEND', Buffer.alloc(0))]);
}

function writeBundle(dir: string, names: string[]) {
  const images = names.map((_, i) => png(i));
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
  fs.writeFileSync(path.join(dir, 'aacPictureSymbols.json'), JSON.stringify({ phrases: {}, categories: {}, words: {} }));
}

describe.skipIf(!hasSwift)('Watch picture cache', () => {
  it('keeps every home-screen picture decoded across renders', () => {
    const cards = homeScreenCards();
    const names = Array.from({ length: cards }, (_, i) => `card-${String(i).padStart(2, '0')}.png`);
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'watch-picture-cache-'));
    try {
      const bundle = path.join(dir, 'bundle');
      fs.mkdirSync(bundle);
      writeBundle(bundle, names);
      fs.writeFileSync(path.join(dir, 'main.swift'), `import Foundation
let library = AACPictureLibrary(directory: URL(fileURLWithPath: CommandLine.arguments[1], isDirectory: true))
let names = try JSONDecoder().decode([String].self, from: FileHandle.standardInput.readDataToEndOfFile())
struct Result: Encodable { let fileCount: Int; let decoded: Int; let cached: Int; let cachedAfterSecondRender: Int; let bytes: Int }
let result = await MainActor.run { () -> Result in
    let decoded = names.filter { library.image(filename: $0) != nil }.count
    let cached = library.cachedImageCount
    _ = names.map { library.image(filename: $0) }
    return Result(fileCount: library.fileCount, decoded: decoded, cached: cached,
                  cachedAfterSecondRender: library.cachedImageCount, bytes: library.cachedDecodedBytes)
}
print(String(data: try JSONEncoder().encode(result), encoding: .utf8)!)
`);
      const binary = path.join(dir, 'cache');
      const build = spawnSync('xcrun', ['swiftc', LIBRARY, path.join(dir, 'main.swift'), '-o', binary], { encoding: 'utf8' });
      expect(build.status, build.stderr).toBe(0);
      const run = spawnSync(binary, [bundle], { input: JSON.stringify(names), encoding: 'utf8' });
      expect(run.status, run.stderr).toBe(0);
      const result = JSON.parse(run.stdout);
      expect(result.fileCount).toBe(cards);
      expect(result.decoded).toBe(cards);
      expect(result.cached).toBe(cards);
      expect(result.cachedAfterSecondRender).toBe(cards);
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  }, 120_000);
});
