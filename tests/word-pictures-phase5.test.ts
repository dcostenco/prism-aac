/**
 * Blocker repairs, wave 8: the pictures the investigation of the top-1000 gap asked for and
 * that passed the picture check: force, side, social, workout, exactly, opposite, zipper, and the "yet" tile, a code-drawn
 * symbol that passed the judge in an earlier round but was never exported because its brief was filed as a text tile.
 * whom (the relative pronoun), such, access and action stay words: no drawing read as them in two attempts. (etcetera
 * got the and-so-on grammar symbol later: tests/grammar-concepts.test.ts.)
 */
import { describe, expect, it } from 'vitest';
import { builtInPhraseSymbolUrl, builtInVocabularySymbol } from '@/lib/builtInSymbols';

const url = (word: string) => builtInVocabularySymbol(word, 'en')?.url ?? null;

describe('wave 8 pictures', () => {
  it.each(['force', 'side', 'social', 'exactly', 'opposite', 'zipper'])('shows its own drawing for "%s"', (word) => {
    expect(url(word)).toBe(`/prism-aac/symbols/w-${word}.png`);
  });

  // The drawing is a barbell and a stopwatch: it means a workout, not job or staff training, so only "workout" shows it.
  it('"workout" shows the barbell drawing and the bare word "training" stays a word', () => {
    expect(url('workout')).toBe('/prism-aac/symbols/w-training.png');
    expect(url('training')).toBeNull();
  });

  it('the "Yet" tile shows its drawing', () => {
    expect(builtInPhraseSymbolUrl('cw-yet')).toBe('/prism-aac/symbols/cw-yet.png');
    expect(url('yet')).toBe('/prism-aac/symbols/cw-yet.png');
  });

  it.each(['whom', 'such', 'access', 'action'])('"%s" has no picture', (word) => {
    expect(url(word)).toBeNull();
  });
});
