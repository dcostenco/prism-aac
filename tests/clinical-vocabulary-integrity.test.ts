/**
 * Clinical vocabulary is allowed into prediction and speech only when each
 * translation is attached to an explicit English concept. The original
 * unequal parallel arrays shifted hundreds of rows, producing dangerous
 * substitutions such as English "drip" -> Spanish "vital signs".
 */
import { describe, expect, it } from 'vitest';
import {
  getClinicalDict,
  getClinicalVocabulary,
} from '@/constants/clinicalVocabulary';
import { translateTextSync } from '@/services/translateService';

describe('clinical vocabulary semantic integrity', () => {
  it('quarantines known shifted legacy rows from offline translation', () => {
    const englishToSpanish = getClinicalDict('en', 'es');

    expect(englishToSpanish.get('drip')).not.toBe('signos vitales');
    expect(englishToSpanish.get('scatter plot')).not.toBe('regresión lineal');
    expect(englishToSpanish.get('grocery')).not.toBe('postre');
    expect(englishToSpanish.get('it is')).not.toBe('fue');

    expect(translateTextSync('drip', 'en', 'es')).not.toBe('signos vitales');
    expect(translateTextSync('scatter plot', 'en', 'es')).not.toBe('regresión lineal');
  });

  it('retains independently keyed multilingual expansion entries', () => {
    expect(getClinicalDict('en', 'es').get('phone')).toBe('teléfono');
    expect(getClinicalDict('en', 'es').get('antibiotic')).toBe('antibiótico');
    expect(getClinicalDict('es', 'en').get('teléfono')).toBe('phone');
    expect(getClinicalVocabulary('es')).toContain('teléfono');
  });

  it('does not inject English fallback words into a non-English prediction list', () => {
    const tagalog = getClinicalVocabulary('tl');
    expect(tagalog).not.toContain('phone');
    expect(tagalog).not.toContain('drip');
  });
});
