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
});
