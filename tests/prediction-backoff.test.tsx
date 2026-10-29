/**
 * Incomplete-word back-off (owner report 2026-10-29: typing "рыби" dropped the
 * prediction bar to the core words because no seed word starts with "рыби").
 *
 * The engine completes a slightly shorter prefix instead, within limits, and
 * a tap on such a tile must REPLACE the typed word, not append after it.
 */
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import PredictionBar from '@/components/PredictionBar';
import { getPredictions, predictionCompletionPrefix } from '@/engine/predictionEngine';
import { loadPredictionSeed } from '@/constants/predictionSeeds';
import { ensureLangCorpusLoaded } from '@/lib/langAllowlist';
import { useMessageStore } from '@/store/messageStore';
import { usePredictionStore } from '@/store/predictionStore';
import { useSettingsStore } from '@/store/settingsStore';
import { useAuthStore } from '@/store/authStore';

vi.mock('@/services/predictionMemoryService', () => ({
  getPredictionSessionScope: () => 'anon:test-tab',
  fetchMemoryPredictions: vi.fn(async () => []),
}));
vi.mock('@/services/hrrContext', () => ({
  initAacHrr: vi.fn(async () => true),
  isAacHrrReady: () => false,
  getNextWordSuggestions: () => [],
}));
vi.mock('@/services/speechService', () => ({ speakWord: vi.fn() }));
vi.mock('@/services/aacSpeak', () => ({ aacSpeak: vi.fn() }));
vi.mock('@/services/pictogramService', () => ({
  getPictogramUrl: vi.fn(async () => null),
  pictureModeForProfile: vi.fn(() => 'none'),
  typedWordPicturesEnabled: vi.fn(() => false),
}));
vi.mock('@/lib/datadog', () => ({ ddAction: vi.fn() }));
vi.mock('@/services/feedback', () => ({ tapFeedback: vi.fn() }));

const entry = (count: number) => ({ count, lastUsed: 0 });
const freq = (...words: string[]) => Object.fromEntries(words.map(w => [w, entry(50)]));

describe('predictionCompletionPrefix', () => {
  it('backs off one letter when nothing completes the typed word', () => {
    expect(predictionCompletionPrefix('рыби', freq('рыба', 'рыбы', 'рыбу'), 'ru')).toBe('рыб');
  });

  it('keeps the typed word when something completes it', () => {
    expect(predictionCompletionPrefix('рыба', freq('рыбак', 'рыбы'), 'ru')).toBe('рыба');
  });

  it('never backs off a word that is in the dictionary, including by alias', () => {
    expect(predictionCompletionPrefix('esti', freq('ești', 'estic', 'estimat'), 'ro')).toBe('esti');
  });

  it('drops at most two letters and keeps at least three', () => {
    // A name: "Zarina" must not fall back to the 2-letter corpus token "za".
    expect(predictionCompletionPrefix('zarina', freq('za', 'zax'), 'en')).toBe('zarina');
    expect(predictionCompletionPrefix('абв', freq('абсолютно', 'абу'), 'ru')).toBe('абв');
    expect(predictionCompletionPrefix('watexx', freq('water'), 'en')).toBe('wate');
  });

  it('still backs off when the shortest prefix is a spelling alias', () => {
    // "esti" is the accentless alias of ești and "weiss" of weiß; a typo past
    // "estim" / "weisse" must still reach estimat / weissen.
    expect(predictionCompletionPrefix('estimx', freq('ești', 'estimat', 'estimată'), 'ro')).toBe('estim');
    expect(predictionCompletionPrefix('weissex', freq('weiß', 'weißwein', 'weissen', 'weisser'), 'de')).toBe('weisse');
  });

  it('never backs off in languages written without spaces', () => {
    expect(predictionCompletionPrefix('你好吗呀', freq('你好'), 'zh-Hans')).toBe('你好吗呀');
    expect(predictionCompletionPrefix('たべたい', freq('たべる'), 'ja')).toBe('たべたい');
  });

  it('counts letters, not UTF-16 units', () => {
    expect(predictionCompletionPrefix('ab😀😀', freq('ab😀x'), 'en')).toBe('ab😀');
  });
});

describe('backed-off candidates', () => {
  it('are never shorter than what was typed', () => {
    const out = getPredictions('рыби', freq('рыб', 'рыба', 'рыбы'), {}, undefined, {}, ['Я', 'Да'], new Set(), undefined, 'ru')
      .map(w => w.toLowerCase());
    expect(out).toContain('рыба');
    expect(out).not.toContain('рыб');
  });
});

describe('tapping a backed-off tile', () => {
  beforeEach(async () => {
    cleanup();
    window.localStorage.clear();
    await loadPredictionSeed('ru');
    await ensureLangCorpusLoaded('ru');
    useSettingsStore.setState({
      language: 'ru',
      outputLanguage: 'ru',
      aiAutocorrectEnabled: false,
      cloudPredictionEnabled: false,
    } as never);
    useAuthStore.setState({ profile: null, loaded: true, loading: false });
    usePredictionStore.setState({ aiCompletion: null, wordFreq: {}, bigrams: {}, trigrams: {}, predictions: [] });
  });

  it('replaces "рыби" with the tapped word instead of appending it', async () => {
    useMessageStore.setState({ text: 'я хочу рыби' } as never);
    render(<PredictionBar />);
    await act(async () => { await new Promise(resolve => setTimeout(resolve, 0)); });

    const tile = screen.getAllByRole('button', { name: /^Predict:/ })
      .find(button => (button.getAttribute('title') ?? '').toLowerCase().startsWith('рыба'));
    expect(tile, 'a рыба tile is offered for "рыби"').toBeTruthy();
    const word = tile!.getAttribute('title');
    await act(async () => { fireEvent.click(tile!, { detail: 1 }); });

    expect(useMessageStore.getState().text).toBe(`я хочу ${word} `);
  });
});
