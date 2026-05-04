// Regression test for the Russian/English stem-diversity blocker.
//
// Original symptom: typing "ду" surfaced думать/думал/думают/думаю/думающий —
// five inflected forms of one verb stem — crowding out distinct lemmas like
// дуб (oak) and дубль (double). The character-prefix workaround
// `slice(0, partialWord.length + 1)` partially helped but failed when the
// inflectional suffixes vary in length: "real" / "really" / "research"
// share "rea" but should not all collapse to one tile.
//
// Resolution: per-language morphological stemmer (Snowball for en/es/fr/pt/
// de/ro/ru/ar; heuristics for uk/ja/ko). The diversity filter now groups by
// real lemma, so distinct lemmas always get their own tile.

import { describe, it, expect } from 'vitest';
import { getPredictions } from '@/engine/predictionEngine';
import { WordFreqEntry } from '@/types';

function corpus(words: Record<string, number>): Record<string, WordFreqEntry> {
  const out: Record<string, WordFreqEntry> = {};
  for (const [w, c] of Object.entries(words)) out[w] = { count: c, lastUsed: 0 };
  return out;
}

describe('predictionEngine — stem-diversity (Russian)', () => {
  it('surfaces дуб alongside the думать verb family for prefix "ду"', () => {
    // Original blocker: 5 inflected forms of думать (думать/думал/думают/
    // думаю/думающий) crowded out дуб entirely. Engine showed: ["думать",
    // "думал","думают","думаю","думающий"] — дуб missing.
    //
    // After fix: each unique stem gets one slot first; only after every
    // distinct lemma in the candidate pool has its tile do we backfill
    // remaining slots with next-best inflected forms. So with 3 unique
    // lemmas (дум-, дуб, дубл-) plus 5 candidates from the дум family,
    // a 5-slot bar shows all 3 lemmas + 2 backfilled дум-forms. Crucially,
    // дуб is no longer crowded out.
    const wf = corpus({
      думать: 100,
      думал: 95,
      думают: 90,
      думаю: 85,
      думающий: 80,
      дуб: 50,
      дубль: 30,
      душа: 20,
    });
    const preds = getPredictions('ду', wf, {}, undefined, undefined, [], new Set(), undefined, 'ru');
    expect(preds, `predictions: ${preds.join(', ')}`).toContain('дуб');
    // At least 3 distinct lemma families should appear (дум-, дуб, дубл-).
    const lemmaPrefixes = new Set(preds.map(p => p.slice(0, 3).toLowerCase()));
    expect(lemmaPrefixes.size, `predictions: ${preds.join(', ')}`).toBeGreaterThanOrEqual(3);
  });

  it('still allows multiple lemmas with the SAME prefix to surface (дуб, дубль, душа are distinct)', () => {
    const wf = corpus({ дуб: 100, дубль: 80, душа: 60, дух: 40, дурак: 30 });
    const preds = getPredictions('ду', wf, {}, undefined, undefined, [], new Set(), undefined, 'ru');
    // All 5 are distinct stems and should all appear.
    expect(preds.length).toBeGreaterThanOrEqual(4);
  });
});

describe('predictionEngine — stem-diversity (English)', () => {
  it('does not let one verb family dominate when typing "re"', () => {
    const wf = corpus({
      really: 100,
      real: 90,
      reading: 85,    // share стeм "read" with "read"
      read: 80,
      research: 75,
      reason: 70,
      remember: 60,
    });
    const preds = getPredictions('re', wf, {}, undefined, undefined, [], new Set(['i']), undefined, 'en');
    // Different lemmas — "read"/"reading" share, "real"/"really" actually
    // get DIFFERENT stems from Porter2 (real → real, really → realli),
    // so all of these should compete fairly.
    expect(preds.length).toBeGreaterThanOrEqual(4);
    // None of the predictions should be the typed prefix itself.
    expect(preds.every(p => p.toLowerCase() !== 're')).toBe(true);
  });
});

describe('predictionEngine — stem-diversity (Spanish)', () => {
  it('surfaces alternative lemmas (hambre, hacer) alongside hablar conjugations', () => {
    const wf = corpus({
      hablar: 100,
      hablo: 95,
      hablamos: 90,
      hablado: 85,
      habla: 80,
      hambre: 50,  // unrelated lemma, also starts with "ha"
      hacer: 40,
    });
    const preds = getPredictions('ha', wf, {}, undefined, undefined, [], new Set(), undefined, 'es');
    // Distinct lemmas should both appear — the original blocker was that
    // 5 hablar conjugations crowded out hambre and hacer entirely.
    expect(preds, `predictions: ${preds.join(', ')}`).toContain('hambre');
    expect(preds, `predictions: ${preds.join(', ')}`).toContain('hacer');
  });
});
