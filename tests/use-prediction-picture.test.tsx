/**
 * usePredictionPicture — what a prediction tile shows for its word.
 *
 * The prediction bar re-uses each tile as the predicted word changes, so the
 * hook must never show the picture answered for the previous word on the next
 * one, and must never ask for a generated picture for built-in vocabulary.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { act, renderHook, waitFor } from '@testing-library/react';
import { usePredictionPicture } from '@/hooks/usePredictionPicture';

type Pending = { phrase: string; resolve: (url: string | null) => void };
const pending: Pending[] = [];
const getPictogramUrlMock = vi.fn((phrase: string, ..._rest: unknown[]) =>
  new Promise<string | null>((resolve) => { pending.push({ phrase, resolve }); }));

vi.mock('@/services/pictogramService', () => ({
  getPictogramUrl: (phrase: string, ...rest: unknown[]) => getPictogramUrlMock(phrase, ...rest),
  typedWordPicturesEnabled: (mode: string) => mode === 'symbols-ai',
}));

beforeEach(() => {
  pending.length = 0;
  getPictogramUrlMock.mockClear();
});

const answer = async (phrase: string, url: string | null) => {
  const request = pending.find((p) => p.phrase === phrase);
  if (!request) throw new Error(`no request for ${phrase}`);
  await act(async () => { request.resolve(url); });
};

describe('usePredictionPicture', () => {
  it('shows the board symbol for built-in vocabulary and asks for nothing', () => {
    const { result } = renderHook(() => usePredictionPicture('More', 'en', 'symbols-ai'));
    expect(result.current).toMatchObject({ picture: 'symbol', pictureUrl: '/prism-aac/symbols/cw-more.png' });
    expect(getPictogramUrlMock).not.toHaveBeenCalled();
  });

  it('shows just the word for built-in vocabulary without a symbol, on a paid plan too', () => {
    const { result } = renderHook(() => usePredictionPicture('unless', 'en', 'symbols-ai'));
    expect(result.current).toMatchObject({ picture: 'text', pictureUrl: null });
    expect(getPictogramUrlMock).not.toHaveBeenCalled();
  });

  it('shows a typed word as a word on the free plan, without asking', () => {
    const { result } = renderHook(() => usePredictionPicture('zorbly', 'en', 'symbols'));
    expect(result.current.picture).toBe('text');
    expect(getPictogramUrlMock).not.toHaveBeenCalled();
  });

  it('waits, then shows the generated picture for a typed word on a paid plan', async () => {
    const { result } = renderHook(() => usePredictionPicture('zorbly', 'en', 'symbols-ai'));
    expect(result.current.picture).toBe('pending');
    // the word as the bar shows it and the board language go along, so a word listed there blocks the picture
    expect(getPictogramUrlMock).toHaveBeenCalledWith('zorbly', 'en', 'symbols-ai', { text: 'zorbly', lang: 'en' });
    await answer('zorbly', 'blob:zorbly');
    expect(result.current).toMatchObject({ picture: 'generated', pictureUrl: 'blob:zorbly' });
  });

  it("never shows the previous word's picture on the next word", async () => {
    const { result, rerender } = renderHook(
      ({ word }) => usePredictionPicture(word, 'en', 'symbols-ai'),
      { initialProps: { word: 'zorbly' } },
    );
    await answer('zorbly', 'blob:zorbly');
    expect(result.current.pictureUrl).toBe('blob:zorbly');

    rerender({ word: 'quaxle' });
    // quaxle's own answer has not arrived: the tile waits, it does not keep
    // showing zorbly's picture above the new word.
    expect(result.current).toMatchObject({ picture: 'pending', pictureUrl: null });

    await answer('quaxle', null);
    expect(result.current).toMatchObject({ picture: 'text', pictureUrl: null });
  });

  it('ignores a late answer for a word the tile has moved past', async () => {
    const { result, rerender } = renderHook(
      ({ word }) => usePredictionPicture(word, 'en', 'symbols-ai'),
      { initialProps: { word: 'zorbly' } },
    );
    rerender({ word: 'quaxle' });
    await answer('zorbly', 'blob:zorbly');
    expect(result.current.pictureUrl).toBeNull();
    await answer('quaxle', 'blob:quaxle');
    expect(result.current.pictureUrl).toBe('blob:quaxle');
  });

  it('drops a picture that fails to load and shows the word', async () => {
    const { result } = renderHook(() => usePredictionPicture('zorbly', 'en', 'symbols-ai'));
    await answer('zorbly', 'blob:broken');
    act(() => { result.current.onImageError(); });
    await waitFor(() => expect(result.current).toMatchObject({ picture: 'text', pictureUrl: null }));
  });
});
