import { renderHook, waitFor } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { loadPictureWords } from '@/constants/pictureWords';
import { usePredictionPicture } from '@/hooks/usePredictionPicture';
import type { SupportedLanguage } from '@/engine/i18n';

describe('prediction pictures preserve reviewed sense alternatives', () => {
  it.each([
    ['de', 'weiß', ['cw-know.png', 'co-white.png']],
    ['ko', '눈', ['hb-eye.png', 'w-snow.png']],
    ['ko', '안', ['cw-not.png', 'pl-inside.png']],
  ] as [SupportedLanguage, string, string[]][])(('%s %s keeps both meanings'), async (lang, word, files) => {
    await loadPictureWords(lang);
    const { result, unmount } = renderHook(() => usePredictionPicture(word, lang, 'symbols', ''));
    await waitFor(() => expect(result.current.alternativeImages.map(image => image.file)).toEqual(files));
    expect(result.current.pictureUrl).toBeNull();
    expect(result.current.picture).toBe('symbol');
    unmount();
  });
  it('uses clear context and rejects a previous meaning after context changes', async () => {
    await loadPictureWords('de');
    const { result, rerender, unmount } = renderHook(({ context }) =>
      usePredictionPicture('weiß', 'de', 'symbols', context), { initialProps: { context: 'ich wei' } });
    await waitFor(() => expect(result.current.alternativeImages.map(image => image.file)).toEqual(['cw-know.png']));
    rerender({ context: 'es ist wei' });
    await waitFor(() => expect(result.current.alternativeImages.map(image => image.file)).toEqual(['co-white.png']));
    unmount();
  });
});
