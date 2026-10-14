import { describe, expect, it } from 'vitest';
import { SUPPORTED_SEED_LANGS } from '@/constants/predictionSeeds';
import { getPhraseText, hasPhraseTranslation } from '@/constants/phraseTranslations';
import { builtInPhraseSymbolUrl } from '@/lib/builtInSymbols';

describe('electrical Off and spatial Off of retain different meanings', () => {
  it.each(SUPPORTED_SEED_LANGS)('%s retains its powered-off label with the matching picture', lang => {
    expect(hasPhraseTranslation('cw-off', lang)).toBe(true);
    expect(getPhraseText('cw-off', lang, 'Off')).toBeTruthy();
    expect(builtInPhraseSymbolUrl('cw-off')).toBe('/prism-aac/symbols/w-powered-off.png');
    expect(builtInPhraseSymbolUrl('cw-off-of')).toBe('/prism-aac/symbols/cw-off-of.png');
  });
});
