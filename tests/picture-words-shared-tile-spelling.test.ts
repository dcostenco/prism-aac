/**
 * Corrected tile texts made some words the spelling of a second tile with its own picture (Chinese 我 is now both I and
 * Me, Russian благодарен both Grateful and Thankful). A word whose tiles show different pictures shows only its text,
 * so each of these words lost the picture it was reviewed with. The language's table now chooses that reviewed picture,
 * which is always one of the word's own tiles.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { builtInVocabularySymbol } from '@/lib/builtInSymbols';

type Lang = Parameters<typeof builtInVocabularySymbol>[1];

async function fresh() {
  vi.resetModules();
  return { ...(await import('@/constants/pictureWords')), ...(await import('@/lib/builtInSymbols')) };
}

beforeEach(() => { vi.resetModules(); });

describe('a word two tiles now share keeps its reviewed picture', () => {
  it.each([
    ['am', 'ንገረኝ', 'cw-tell.png'], ['am', 'ደባብስ', 'cw-pet.png'],
    ['bn', 'অবশ্যই', 'qt-of-course.png'], ['bn', 'খোলো', 'cw-open-2.png', true],
    ['ko', '목말라요', 'fe-thirsty.png'], ['nl', 'beschaamd', 'fe-embarrassed.png'], ['ru', 'благодарен', 'fe-grateful.png'],
    ['sw', 'chana nywele', 'ac-brush-hair.png'], ['sw', 'yangu', 'cw-mine.png', true],
    ['zh-Hans', '我', 'cw-i.png', true], ['zh-Hant', '我', 'cw-i.png', true], ['zh-HK', '我', 'cw-i.png', true],
    // 捲餅 / 卷饼 is a filled pancake or wrap in general, so the Wrap tile's picture, not the burrito
    ['zh-Hans', '卷饼', 'fd-wrap.png'], ['zh-Hant', '捲餅', 'fd-wrap.png'], ['zh-HK', '捲餅', 'fd-wrap.png'],
    ['zh-Hans', '回头见', 'qt-see-later.png'], ['zh-Hant', '旁邊', 'cw-beside.png'], ['zh-Hant', '晚安', 'qt-good-night.png'],
  ] as [Lang, string, string, boolean?][])('%s "%s" shows its reviewed %s picture', async (lang, word, file, primaryReady = false) => {
    const { builtInVocabularySymbol, loadPictureWords } = await fresh();
    // Reviewed basic meanings must be ready before the lazy table; other shared words wait for its choice.
    expect(builtInVocabularySymbol(word, lang)).toEqual({ url: primaryReady ? `/prism-aac/symbols/${file}` : null });
    await loadPictureWords(lang);
    expect(builtInVocabularySymbol(word, lang)?.url).toBe(`/prism-aac/symbols/${file}`);
  });
});

describe('a shared word whose everyday use is neither tile stays a word', () => {
  // Amharic ይመስለኛል is "it seems to me", not the agreeing "I think so"
  it('am "ይመስለኛል" shows no picture', async () => {
    const { builtInVocabularySymbol, loadPictureWords } = await fresh();
    await loadPictureWords('am');
    expect(builtInVocabularySymbol('ይመስለኛል', 'am')).toEqual({ url: null });
  });
});
