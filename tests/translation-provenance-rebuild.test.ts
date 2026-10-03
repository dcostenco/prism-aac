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

type Surfaces = Record<string, Record<string, { reviewed: string[]; unreviewed: string[] }>>;

const ROOT = path.resolve(__dirname, '..');
const TRACKED = path.join(ROOT, 'i18n', 'provenance', 'machine-translations.json');

function rebuild(): Surfaces {
  const out = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'provenance-')), 'out.json');
  execFileSync('node', [path.join(ROOT, 'scripts', 'rebuild-translation-provenance.mjs')], {
    cwd: ROOT,
    env: { ...process.env, PROVENANCE_OUT: out, PRISM_CORPUS_DIR: path.join(os.tmpdir(), 'no-corpus-here') },
    stdio: 'pipe',
  });
  return JSON.parse(fs.readFileSync(out, 'utf-8')).surfaces;
}

describe('rebuilding the translation provenance', () => {
  const before: Surfaces = JSON.parse(fs.readFileSync(TRACKED, 'utf-8')).surfaces;
  const after = rebuild();

  it('keeps the corpus records when the corpus is not on this machine', () => {
    expect(after.corpus).toEqual(before.corpus);
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

  it('does not touch the tracked file', () => {
    expect(JSON.parse(fs.readFileSync(TRACKED, 'utf-8')).surfaces).toEqual(before);
  });
});
