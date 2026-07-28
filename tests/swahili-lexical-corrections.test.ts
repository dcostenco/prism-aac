/**
 * Swahili lexical corrections, and the distinctions they restored.
 *
 * Swahili was the one new language that never got functional verification.
 * Amharic and Bengali were checked by asserting native-script rendering;
 * Swahili uses Latin script, so the browser check could only confirm the
 * locale was selectable — it would have passed just as happily on English
 * text. Nothing tested what the words meant.
 *
 * Collision analysis found them: one Swahili string serving two unrelated
 * English tiles. A collision is a lead, not a verdict — Swahili really does
 * use `yeye` for both he and she, `kaa` for sit and crab, `ndege` for bird and
 * aeroplane. Each correction below was checked against a source outside the
 * model (Wiktionary, Glosbe, Swahili-localized medical publishers) before
 * being accepted, and the untouched homonyms are asserted here too so a later
 * "cleanup" does not flatten real polysemy.
 */
import { describe, it, expect } from 'vitest';
import { getPhraseText } from '@/constants/phraseTranslations';
import { DEFAULT_PHRASES } from '@/constants/phrases';

const sw = (id: string) => getPhraseText(id, 'sw', '');

/** id -> the corrected Swahili string, with the meaning it must not revert to. */
const CORRECTIONS: [string, string, string][] = [
  ['cw-bite', 'Uma', 'Ona means "to see", not "to bite"'],
  ['cw-always', 'Daima', 'Laini means soft/smooth, not always'],
  ['fs-cheese', 'Jibini', 'Paka means cat'],
  ['we-snowy', 'Yenye theluji', 'Barafu is ice, not snow'],
  ['an-dolphin', 'Pomboo', 'Poboo is a misspelling'],
  ['as-dolphin', 'Pomboo', 'Poboo is a misspelling'],
  ['pls-gym', 'Ukumbi wa mazoezi', 'Uwanja wa michezo is a playground'],
  ['hb-inhaler', 'Kipulizio', 'Inhela is not a Swahili word'],
  ['hm-inhaler', 'Kipulizio', 'Inhela is not a Swahili word'],
  ['ac-roll', 'Viringisha', 'Gubika means to cover'],
  ['ac-roll-it', 'Viringisha', 'Gubika means to cover'],
  ['an-monkey', 'Tumbili', 'Kima is one specific species'],
  ['aw-monkey', 'Tumbili', 'Kima is one specific species'],
  ['qt-hi', 'Habari', 'Sasa means "now"'],
  ['ac-march', 'Enda machi', 'Bare Machi is the month'],
];

describe('Swahili lexical corrections', () => {
  it.each(CORRECTIONS)('%s is %s', (id, expected, why) => {
    expect(sw(id), why).toBe(expected);
  });

  /**
   * The point of each fix was to separate two tiles that had become the same
   * word. Asserting the new string alone would still pass if the OTHER tile
   * were later changed to match it.
   */
  it.each([
    ['cw-see', 'cw-bite'],
    ['cw-soft', 'cw-always'],
    ['an-cat', 'fs-cheese'],
    ['hm-ice-pack', 'we-snowy'],
    ['pl-playground', 'pls-gym'],
    ['ti-now', 'qt-hi'],
    ['tm-mar', 'ac-march'],
  ])('%s and %s stay distinct in Swahili', (a, b) => {
    const [x, y] = [sw(a), sw(b)];
    expect(x, `${a} has no Swahili`).toBeTruthy();
    expect(y, `${b} has no Swahili`).toBeTruthy();
    expect(x.toLowerCase()).not.toBe(y.toLowerCase());
  });

  /**
   * Guard the other direction. These pairs SHOULD share a word — Swahili does
   * not mark gender on pronouns, and kaa/ndege are genuine homonyms. A future
   * pass that treats every collision as a bug would "fix" correct language.
   */
  it.each([
    ['cw-he', 'cw-she', 'Swahili pronouns are not gendered'],
    ['cw-i', 'cw-me', 'mimi covers I and me'],
    ['cw-we', 'cw-us', 'sisi covers we and us'],
  ])('%s and %s legitimately share a word (%s)', (a, b) => {
    expect(sw(a).toLowerCase()).toBe(sw(b).toLowerCase());
  });

  it('leaves every corrected id still present in the phrase set', () => {
    const ids = new Set(DEFAULT_PHRASES.map((p) => p.id));
    const orphans = CORRECTIONS.map(([id]) => id).filter((id) => !ids.has(id));
    expect(orphans, `corrected ids no longer exist: ${orphans.join(', ')}`).toEqual([]);
  });
});
