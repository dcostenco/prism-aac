// @vitest-environment node
/**
 * Watch card ids stay unique per label.
 *
 * AACPhrase.id keys SwiftUI ForEach rows (the recents row shows any labels the
 * user tapped). Phrases in one category share their symbol, so labels that
 * differ only in punctuation or spacing ("Tiptoe" / "Tip-toe") must still get
 * different ids. This compiles the real AACPhrase from the Watch source and
 * computes ids for every phrase in the Watch's built-in vocabulary. Needs a
 * Swift toolchain (macOS); skipped where none is installed.
 */
import { describe, expect, it } from 'vitest';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const ROOT = path.resolve(__dirname, '..');
const CARDS = path.join(ROOT, 'ios-native/PrismAACWatch/Sources/Views/WatchPictogramCards.swift');
const VOCAB = path.join(ROOT, 'ios-native/PrismAACWatch/Sources/AI/WatchVocabSync.swift');
const hasSwift = process.platform === 'darwin' && spawnSync('xcrun', ['--find', 'swiftc']).status === 0;

/** The `struct AACPhrase` declaration, cut out by brace matching. */
function aacPhraseSource(): string {
  const source = fs.readFileSync(CARDS, 'utf8');
  const start = source.indexOf('struct AACPhrase: Identifiable {');
  expect(start).toBeGreaterThan(-1);
  let depth = 0;
  for (let i = source.indexOf('{', start); i < source.length; i++) {
    if (source[i] === '{') depth++;
    if (source[i] === '}' && --depth === 0) return source.slice(start, i + 1);
  }
  throw new Error('unbalanced AACPhrase declaration');
}

function unescapeSwift(text: string): string {
  return text.replace(/\\(["\\])/g, '$1');
}

/** Every (label, symbol) pair the Watch ships, in both vocabulary sets. */
function vocabularyPairs(): Array<{ label: string; symbol: string }> {
  const source = fs.readFileSync(VOCAB, 'utf8');
  const pattern = /WatchPhrase\(id: "[^"]*",\s*label: "((?:[^"\\]|\\.)*)",\s*sfSymbol: "([^"]*)"/g;
  return [...source.matchAll(pattern)].map(m => ({ label: unescapeSwift(m[1]), symbol: m[2] }));
}

function computeIds(pairs: Array<{ label: string; symbol: string }>): string[] {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'watch-phrase-ids-'));
  fs.writeFileSync(path.join(dir, 'AACPhrase.swift'), `import SwiftUI\n\n${aacPhraseSource()}\n`);
  fs.writeFileSync(path.join(dir, 'main.swift'), `import Foundation
struct Pair: Decodable { let label: String; let symbol: String }
let pairs = try JSONDecoder().decode([Pair].self, from: FileHandle.standardInput.readDataToEndOfFile())
let ids = pairs.map { AACPhrase(label: $0.label, sfSymbol: $0.symbol, color: .blue).id }
print(String(data: try JSONEncoder().encode(ids), encoding: .utf8)!)
`);
  try {
    const binary = path.join(dir, 'ids');
    const build = spawnSync('xcrun', ['swiftc', path.join(dir, 'AACPhrase.swift'), path.join(dir, 'main.swift'), '-o', binary], { encoding: 'utf8' });
    expect(build.status, build.stderr).toBe(0);
    const run = spawnSync(binary, [], { input: JSON.stringify(pairs), encoding: 'utf8' });
    expect(run.status, run.stderr).toBe(0);
    return JSON.parse(run.stdout);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
}

describe.skipIf(!hasSwift)('Watch card ids', () => {
  it('give different labels different ids across the whole built-in vocabulary', () => {
    const pairs = vocabularyPairs();
    expect(pairs.length).toBeGreaterThan(1000);
    const known = [
      { label: 'Tiptoe', symbol: 'figure.walk' }, { label: 'Tip-toe', symbol: 'figure.walk' },
      { label: 'Where are we going?', symbol: 'questionmark.circle' }, { label: 'Where are we going', symbol: 'questionmark.circle' },
      { label: 'Yes', symbol: 'checkmark.circle.fill' }, { label: 'No', symbol: 'xmark.circle.fill' },
    ];
    const all = [...known, ...pairs];
    const ids = computeIds(all);
    const labelsById = new Map<string, Set<string>>();
    all.forEach(({ label }, i) => labelsById.set(ids[i], (labelsById.get(ids[i]) ?? new Set()).add(label)));
    const shared = [...labelsById].filter(([, labels]) => labels.size > 1).map(([id, labels]) => `${id}: ${[...labels].join(' | ')}`);
    expect(shared).toEqual([]);
    // Yes/No are found by id prefix (yesNoPhrases, recentPhraseCards).
    expect(ids[4].startsWith('yes-')).toBe(true);
    expect(ids[5].startsWith('no-')).toBe(true);
  }, 120_000);
});
