// @vitest-environment node
/**
 * The Apple Watch app no longer shows or downloads third-party pictograms.
 *
 * Cards show their SF Symbol, the default vocabulary carries no picture ids,
 * the generator cannot write them back, and the first launch of this version
 * deletes the copies earlier versions kept in the shared URL cache. There is
 * no watchOS test target, so this checks the shipped sources directly; the
 * cache cleanup's behaviour was exercised against a real URLCache.
 */
import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(__dirname, '..');
const WATCH_SOURCES = path.join(ROOT, 'ios-native/PrismAACWatch/Sources');
const RETIRED = /arasaac/i;

function swiftFiles(dir: string): string[] {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap(entry => {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) return swiftFiles(full);
    return entry.name.endsWith('.swift') ? [full] : [];
  });
}

const relative = (file: string) => path.relative(ROOT, file);
const read = (file: string) => fs.readFileSync(file, 'utf8');

describe('Watch — retired third-party pictograms', () => {
  const sources = swiftFiles(WATCH_SOURCES);

  it('finds the Watch sources', () => {
    expect(sources.length).toBeGreaterThan(5);
  });

  it('no Watch source names the retired pictogram service or its picture ids', () => {
    expect(sources.filter(file => RETIRED.test(read(file))).map(relative)).toEqual([]);
  });

  it('cards download no pictures: no AsyncImage anywhere in the Watch app', () => {
    expect(sources.filter(file => /\bAsyncImage\b/.test(read(file))).map(relative)).toEqual([]);
  });

  it('the default-set generator cannot write picture ids back', () => {
    expect(read(path.join(ROOT, 'scripts/gen-watch-default-set.py'))).not.toMatch(RETIRED);
    expect(fs.existsSync(path.join(ROOT, 'scripts/arasaac-id-cache.json'))).toBe(false);
    expect(fs.existsSync(path.join(ROOT, 'scripts/fetch-arasaac-ids.py'))).toBe(false);
  });

  it('the app deletes the copies earlier versions cached, once, at launch', () => {
    const app = read(path.join(WATCH_SOURCES, 'App/WatchApp.swift'));
    expect(app).toMatch(/init\(\)\s*\{\s*LegacyPictogramCache\.clearOnce\(\)/);
    expect(app).toMatch(/cache\.removeAllCachedResponses\(\)/);
    expect(app).toMatch(/guard !defaults\.bool\(forKey: clearedKey\) else \{ return \}/);
  });
});
