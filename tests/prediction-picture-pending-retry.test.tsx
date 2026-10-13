import { act, renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { PicturePendingError } from '@/services/pictogramQueue';
const state = vi.hoisted(() => ({ get: vi.fn() }));
vi.mock('@/services/pictogramService', () => ({ getPictogramUrl: state.get, typedWordPicturesEnabled: () => true }));
vi.mock('@/lib/builtInSymbols', () => ({ resolveVocabularyPicture: () => ({ kind: 'unmapped' }), reviewedVocabularyPictureChoices: () => [] }));
vi.mock('@/constants/reverseTranslation', () => ({ englishSourceFor: () => undefined }));
vi.mock('@/constants/pictureWords', () => ({ watchPictureWords: () => {}, pictureWordsVersion: () => 0, subscribePictureWords: () => () => {} }));
vi.mock('@/hooks/useRecoverablePicture', () => ({ useRecoverablePicture: (url: string | null, key: string) => ({ url, imageKey: key, onError: () => {} }) }));
vi.mock('@/hooks/useVocabularyPictureChoices', () => ({ useVocabularyPictureChoices: () => ({ ready: false, images: [] }) }));
import { usePredictionPicture } from '@/hooks/usePredictionPicture';
afterEach(() => { vi.useRealTimers(); state.get.mockReset(); });

describe('active observers of pending shared pictures', () => {
  it('waits for the server quota cooldown and still cancels when the word leaves', async () => {
    vi.useFakeTimers();
    state.get.mockRejectedValue(new PicturePendingError(60_000));
    const { unmount } = renderHook(() => usePredictionPicture('quota-word', 'en', 'symbols-ai'));
    await act(async () => {});
    await act(async () => { await vi.advanceTimersByTimeAsync(59_999); });
    expect(state.get).toHaveBeenCalledTimes(1);
    unmount();
    await act(async () => { await vi.advanceTimersByTimeAsync(60_000); });
    expect(state.get).toHaveBeenCalledTimes(1);
  });

  it('retries a pending timeout without requiring another keystroke', async () => {
    vi.useFakeTimers();
    state.get.mockRejectedValueOnce(new PicturePendingError()).mockResolvedValueOnce('blob:ready-picture');
    const { result, unmount } = renderHook(() => usePredictionPicture('pending-word', 'en', 'symbols-ai'));
    await act(async () => {});
    expect(result.current.picture).toBe('pending');
    await act(async () => { await vi.advanceTimersByTimeAsync(1000); });
    expect(state.get).toHaveBeenCalledTimes(2);
    expect(result.current.picture).toBe('generated');
    expect(result.current.pictureUrl).toBe('blob:ready-picture');
    unmount();
  });

  it('discards the retry when the prediction disappears', async () => {
    vi.useFakeTimers(); state.get.mockRejectedValue(new PicturePendingError());
    const { unmount } = renderHook(() => usePredictionPicture('obsolete-word', 'en', 'symbols-ai'));
    await act(async () => {}); unmount();
    await act(async () => { await vi.advanceTimersByTimeAsync(1000); });
    expect(state.get).toHaveBeenCalledTimes(1);
    expect(state.get.mock.calls[0][4].signal.aborted).toBe(true);
  });
});
