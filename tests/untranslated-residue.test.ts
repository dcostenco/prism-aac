/**
 * Guards the rule that decides whether a mid-composition utterance is safe to
 * speak. See hasUntranslatedResidue for why script detection cannot do this.
 */
import { describe, it, expect } from 'vitest';
import { hasUntranslatedResidue } from '@/services/translateService';

describe('hasUntranslatedResidue', () => {
  it.each([
    ['I am here.', 'Eu am here.', true],          // "here" passed through
    ['I want water.', 'Vreau water.', true],      // "water" passed through
    ['I am here. I want', 'Eu am here. eu.', true],
  ])('flags a mix: %s -> %s', (src, out, expected) => {
    expect(hasUntranslatedResidue(src, out)).toBe(expected);
  });

  it.each([
    ['I need', 'Eu am nevoie', false],            // clean core-word translation
    ['I want water.', 'Eu vreau apă.', false],
    ['hello', 'bună', false],
  ])('accepts a clean translation: %s -> %s', (src, out, expected) => {
    expect(hasUntranslatedResidue(src, out)).toBe(expected);
  });

  it('ignores single characters so punctuation and "I" do not trip it', () => {
    expect(hasUntranslatedResidue('I go', 'Eu merg')).toBe(false);
  });

  it('returns false for empty source', () => {
    expect(hasUntranslatedResidue('', 'orice')).toBe(false);
  });

  // A proper-noun carve-out was tried and REVERTED. Review found it never
  // fired (the only caller passes a single word, so the token is always at
  // index 0) and that on multi-word input it leaked the exact failure this
  // function prevents — German capitalises every noun, so "Ich will Wasser"
  // -> "Vreau Wasser" was allowed through as speakable.
  //
  // These pin the strict behaviour AND the limitation it costs, so neither is
  // rediscovered as a surprise.
  it.each([
    ['Ich will Wasser', 'Vreau Wasser'],
    ['Das Haus ist gross', 'Casa Haus e mare'],
    ['I want Water now', 'Vreau Water acum'],
  ])('flags a mid-sentence capital left untranslated: %s -> %s', (src, out) => {
    expect(hasUntranslatedResidue(src, out)).toBe(true);
  });

  // KNOWN LIMITATION, pinned deliberately: a name is indistinguishable from an
  // untranslated word, so typing one gives no Echo confirmation. Silence on a
  // word, not a wrong utterance. The Speak path is unaffected.
  it('also flags a name that survives translation (accepted cost)', () => {
    expect(hasUntranslatedResidue('Maria', 'Maria')).toBe(true);
  });

  // The single-word case is what the only caller actually passes.
  it.each([
    ['Wasser', 'Wasser', true],
    ['water', 'water', true],
    ['water', 'apa', false],
    ['Haus', 'casa', false],
  ])('single word %s -> %s flags=%s', (src, out, expected) => {
    expect(hasUntranslatedResidue(src, out)).toBe(expected);
  });
});
