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

  // Proper nouns are SUPPOSED to survive translation. Before the carve-out the
  // check silenced correct output — "Call Maria" -> "Sună Maria" was
  // suppressed because the name appears in both. Naming people is core AAC
  // vocabulary, so this turned a working feature into unpredictable silence.
  it.each([
    ['Call Maria', 'Sună Maria'],
    ['Tell Dad now', 'Spune-i lui Dad acum'],
    ['Where is Sam', 'Unde este Sam'],
  ])('does not flag a proper noun that survives translation: %s -> %s', (src, out) => {
    expect(hasUntranslatedResidue(src, out)).toBe(false);
  });

  it('still flags a lowercase source word that was left untranslated', () => {
    // The case the rule exists for — a genuine mixed-language utterance.
    expect(hasUntranslatedResidue('I want water.', 'Vreau water.')).toBe(true);
  });

  it('does not exempt a sentence-initial capital, which every sentence has', () => {
    // "Water" is capitalised only because it starts the sentence; it is still
    // untranslated residue and must be caught.
    expect(hasUntranslatedResidue('Water please', 'Water te rog')).toBe(true);
  });
});
