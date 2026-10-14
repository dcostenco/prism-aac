/**
 * The Watch's default vocabulary (WatchVocabSync.swift, iOSDefaultSet) is generated from constants/phrases.ts by
 * scripts/gen-watch-default-set.py. Its phrases used to carry their category's SF Symbol, and a Watch card always draws a
 * phrase's symbol, so Crayons, Story and Song showed a game controller and Sad a smiling face. A phrase now carries no symbol
 * and its card shows the word; categories keep their symbols.
 */
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const ROOT = process.cwd();
const swift = readFileSync(join(ROOT, 'ios-native/PrismAACWatch/Sources/AI/WatchVocabSync.swift'), 'utf8');
const start = swift.indexOf('    /// iOS-parity default set');
const end = swift.indexOf('\n    ]\n', swift.indexOf('static let iOSDefaultSet')) + '\n    ]'.length;
const block = swift.slice(start, end);
const phrases = [...block.matchAll(/WatchPhrase\(id: "([^"]+)", label: "((?:[^"\\]|\\.)*)", sfSymbol: "([^"]*)"/g)]
  .map(([, id, label, symbol]) => ({ id, label, symbol }));

describe('the Watch default vocabulary', () => {
  it('is the generated set, with every built-in phrase', () => {
    expect(start).toBeGreaterThan(0);
    expect(phrases.length).toBeGreaterThan(1200);
    const generated = execFileSync('python3', [join(ROOT, 'scripts/gen-watch-default-set.py')], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] });
    expect(block).toBe(generated.replace(/\n+$/, ''));
  });

  it('gives no phrase a category symbol, so a word never shows a picture that means something else', () => {
    expect(phrases.filter((p) => p.symbol !== '').map((p) => `${p.id} ${p.symbol}`)).toEqual([]);
    for (const id of ['tf-crayons', 'tf-story', 'tf-song', 'fe-sad']) expect(phrases.find((p) => p.id === id)?.symbol, id).toBe('');
  });

  it('keeps a symbol on every category', () => {
    const categories = [...block.matchAll(/WatchCategory\(id: "([^"]+)", icon: "([^"]*)"/g)];
    expect(categories.length).toBeGreaterThan(15);
    expect(categories.filter(([, , icon]) => icon === '').map(([, id]) => id)).toEqual([]);
  });
});
