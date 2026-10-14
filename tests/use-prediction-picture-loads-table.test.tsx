/**
 * A word that several built-in tiles spell ("Más" is More, Plus and More-help in Spanish) shows the picture its language's
 * table chooses. The table used to load only when the prediction store first updated, so on an idle screen the tile was a
 * text tile and turned into its picture after the first keystroke. The hook now starts the table itself.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';

vi.mock('@/services/pictogramService', () => ({
  getPictogramUrl: vi.fn(() => new Promise(() => {})),
  typedWordPicturesEnabled: () => false,
}));

beforeEach(() => { vi.resetModules(); });

describe('usePredictionPicture starts the language table', () => {
  it('"Más" in Spanish is a word first, then its chosen picture, with nothing else loading the table', async () => {
    const { usePredictionPicture } = await import('@/hooks/usePredictionPicture');
    const { result } = renderHook(() => usePredictionPicture('Más', 'es', 'symbols'));
    await waitFor(() => expect(result.current).toMatchObject({ picture: 'symbol', pictureUrl: '/prism-aac/symbols/cw-more.png' }));
  });

  it('English needs no table and stays a symbol at once', async () => {
    const { usePredictionPicture } = await import('@/hooks/usePredictionPicture');
    const { result } = renderHook(() => usePredictionPicture('More', 'en', 'symbols'));
    expect(result.current).toMatchObject({ picture: 'symbol', pictureUrl: '/prism-aac/symbols/cw-more.png' });
  });
});
