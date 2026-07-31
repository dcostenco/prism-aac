/**
 * Traditional/Hong Kong data is generated for every canonical Chinese AAC
 * phrase. Partial coverage would silently put Simplified labels back onto
 * selected cards when a user navigates beyond the home screen.
 */
import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import variants from '@/constants/generated/chinesePhraseVariants.json';
import { getPhraseText } from '@/constants/phraseTranslations';

describe('Chinese phrase variants', () => {
  it('does not misrepresent script conversion as Cantonese translation', () => {
    expect(variants.coverage).toEqual({
      'zh-Hant': 'orthographic-variant-of-standard-written-chinese',
      'zh-HK': 'orthographic-variant-of-standard-written-chinese',
    });
  });

  it('covers every canonical zh phrase entry', () => {
    const source = fs.readFileSync(
      path.resolve(process.cwd(), 'constants/phraseTranslations.ts'),
      'utf8',
    );
    const ids = [...source.matchAll(/^\s*'([^']+)':\s*\{[^\n]*\bzh:\s*'/gm)]
      .map((match) => match[1]);
    expect(Object.keys(variants.translations).sort()).toEqual(ids.sort());
  });

  it('serves region-correct script for high-frequency AAC sentinels', () => {
    expect(getPhraseText('cw-help', 'zh-Hans', 'Help')).toBe('帮');
    expect(getPhraseText('cw-help', 'zh-Hant', 'Help')).toBe('幫');
    expect(getPhraseText('cw-help', 'zh-HK', 'Help')).toBe('幫');
    expect(getPhraseText('qt-goodbye', 'zh-Hant', 'Goodbye')).toBe('再見');
    expect(getPhraseText('qt-thank-you', 'zh-HK', 'Thank you')).toBe('謝謝');
    expect(getPhraseText('pl-school', 'zh-Hant', 'School')).toBe('學校');
  });
});
