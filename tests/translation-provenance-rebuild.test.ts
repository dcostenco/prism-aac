/**
 * @vitest-environment node
 */
import { describe, expect, it } from 'vitest';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

// scripts/rebuild-translation-provenance.mjs derives the record of which
// strings are unreviewed machine translations. Its corpus source lives outside
// the repo; without it, a run wrote the file with no corpus surface and erased
// 50,658 records. It also listed English, the source language, as machine output.

type Surfaces = Record<string, Record<string, { reviewed: string[]; unreviewed: string[];
  generatorById?: Record<string, { generator: string; generatedAt: string }> }>>;

const ROOT = path.resolve(__dirname, '..');
const TRACKED = path.join(ROOT, 'i18n', 'provenance', 'machine-translations.json');

const scratch = () => fs.mkdtempSync(path.join(os.tmpdir(), 'provenance-'));

function rebuild(corpusDir: string): Surfaces {
  const out = path.join(scratch(), 'out.json');
  execFileSync('node', [path.join(ROOT, 'scripts', 'rebuild-translation-provenance.mjs')], {
    cwd: ROOT,
    env: { ...process.env, PROVENANCE_OUT: out, PRISM_CORPUS_DIR: corpusDir },
    stdio: 'pipe',
  });
  return JSON.parse(fs.readFileSync(out, 'utf-8')).surfaces;
}

describe('rebuilding the translation provenance', () => {
  const before: Surfaces = JSON.parse(fs.readFileSync(TRACKED, 'utf-8')).surfaces;
  const after = rebuild(path.join(os.tmpdir(), 'no-corpus-here'));

  it('keeps the corpus records when the corpus is not on this machine', () => {
    expect(after.corpus).toEqual(before.corpus);
  });

  it('keeps them when the corpus directory is there but empty', () => {
    expect(rebuild(scratch()).corpus).toEqual(before.corpus);
  });

  it('keeps a language whose corpus file has no phrases', () => {
    const [lang] = Object.keys(before.corpus);
    const dir = scratch();
    fs.writeFileSync(path.join(dir, `${lang}.json`), '{}');
    expect(rebuild(dir).corpus).toEqual(before.corpus);
  });

  it('rebuilds a language the corpus supplies and keeps every other', () => {
    const [lang, ...others] = Object.keys(before.corpus);
    const dir = scratch();
    fs.writeFileSync(path.join(dir, `${lang}.json`), JSON.stringify({ phrases: ['a', 'b'] }));
    const rebuilt = rebuild(dir).corpus;
    const reviewed = new Set(before.corpus[lang].reviewed);
    expect(rebuilt[lang].unreviewed).toEqual(['phrases#0', 'phrases#1'].filter((id) => !reviewed.has(id)));
    expect(others.length).toBeGreaterThan(0);
    for (const other of others) expect(rebuilt[other], other).toEqual(before.corpus[other]);
  });

  it('loses no record of a string the app still has', () => {
    // A record may only go when its string went (the removed auto-speak
    // labels, for example); dropping any other would make machine output look
    // reviewed.
    const uiKeys = new Set(Object.keys(JSON.parse(fs.readFileSync(path.join(ROOT, 'i18n', 'translations.json'), 'utf-8'))));
    const lost: string[] = [];
    for (const [surface, langs] of Object.entries(before)) {
      for (const [lang, entry] of Object.entries(langs)) {
        const now = new Set([...(after[surface]?.[lang]?.unreviewed ?? []), ...(after[surface]?.[lang]?.reviewed ?? [])]);
        for (const id of [...entry.unreviewed, ...entry.reviewed]) {
          if (now.has(id) || (surface === 'ui' && !uiKeys.has(id))) continue;
          lost.push(`${surface}/${lang}/${id}`);
        }
      }
    }
    expect(lost).toEqual([]);
  });

  it('never lists English, the source language, as machine output', () => {
    expect(Object.entries(after).filter(([, langs]) => 'en' in langs).map(([s]) => s)).toEqual([]);
  });

  it('retains specific scanner-text origins without treating draft translations as reviewed', () => {
    const scannerKeys = ['scan_active', 'scan_stopped', 'scan_start', 'scan_stop', 'scan_keys'];
    const matrix = JSON.parse(fs.readFileSync(path.join(ROOT, 'i18n', 'translations.json'), 'utf-8'));
    for (const lang of Object.keys(matrix.scan_active).filter(lang => lang !== 'en')) {
      for (const key of scannerKeys) {
        expect(before.ui[lang].generatorById?.[key]?.generator).toBe('host-ai-draft');
        expect(after.ui[lang].generatorById?.[key]).toEqual(before.ui[lang].generatorById?.[key]);
        expect(after.ui[lang].unreviewed).toContain(key);
        expect(after.ui[lang].reviewed).not.toContain(key);
      }
    }
  });

  it('does not touch the tracked file', () => {
    expect(JSON.parse(fs.readFileSync(TRACKED, 'utf-8')).surfaces).toEqual(before);
  });
});
