/**
 * Shared prediction vocabulary (owner decision 2026-10-30): words several AAC
 * users typed that no built-in dictionary has are added for everyone after a
 * server-side AI check. The app contributes new words after Speak and loads
 * the shared list per language.
 */
import { act, cleanup, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const portal = vi.hoisted(() => ({ fetch: vi.fn() }));
vi.mock('@/services/portalClient', () => ({ portalFetch: portal.fetch }));
vi.mock('@/services/predictionMemoryService', () => ({
  getPredictionSessionScope: () => 'anon:test-tab',
  fetchMemoryPredictions: vi.fn(async () => []),
}));
vi.mock('@/services/hrrContext', () => ({ initAacHrr: vi.fn(async () => true), isAacHrrReady: () => false, getNextWordSuggestions: () => [] }));
vi.mock('@/services/speechService', () => ({ speakWord: vi.fn() }));
vi.mock('@/services/aacSpeak', () => ({ aacSpeak: vi.fn() }));
vi.mock('@/services/pictogramService', () => ({
  getPictogramUrl: vi.fn(async () => null), pictureModeForProfile: vi.fn(() => 'none'), typedWordPicturesEnabled: vi.fn(() => false),
}));
vi.mock('@/lib/datadog', () => ({ ddAction: vi.fn() }));
vi.mock('@/services/feedback', () => ({ tapFeedback: vi.fn() }));

import PredictionBar from '@/components/PredictionBar';
import { contributeSharedWords, loadSharedWords, newWordsIn, _resetSharedWordsServiceForTests } from '@/services/sharedWordsService';
import { _resetSharedWordsForTests, setSharedWords } from '@/lib/sharedWords';
import { ensureLangCorpusLoaded, isAllowedInLang } from '@/lib/langAllowlist';
import { loadPredictionSeed } from '@/constants/predictionSeeds';
import { useAuthStore } from '@/store/authStore';
import { useSettingsStore } from '@/store/settingsStore';
import { useMessageStore } from '@/store/messageStore';
import { usePredictionStore } from '@/store/predictionStore';

const signIn = () => useAuthStore.setState({ profile: { email: 'aac@example.com' } as never, loaded: true, loading: false });

beforeEach(async () => {
  cleanup();
  window.localStorage.clear();
  _resetSharedWordsForTests();
  _resetSharedWordsServiceForTests();
  portal.fetch.mockReset().mockResolvedValue({ ok: true, data: { accepted: 1 }, status: 202 });
  for (const lang of ['en', 'ro']) await loadPredictionSeed(lang);
  await ensureLangCorpusLoaded('en');
  useSettingsStore.setState({ language: 'en', outputLanguage: 'en', aiAutocorrectEnabled: true, cloudPredictionEnabled: false } as never);
  useAuthStore.setState({ profile: null, loaded: true, loading: false });
  usePredictionStore.setState({ aiCompletion: null, wordFreq: {}, bigrams: {}, trigrams: {}, predictions: [] });
});

describe('which words are contributed', () => {
  it('only words in no dictionary, never another language\'s words or blocked words', () => {
    expect(newWordsIn('I want Geriatric care, eu fuck geriatric', 'en')).toEqual(['geriatric']);
  });

  it('not a word that is already shared', () => {
    setSharedWords('en', ['geriatric']);
    expect(newWordsIn('geriatric care', 'en')).toEqual([]);
  });
});

describe('contributing after Speak', () => {
  it('sends nothing when signed out or when AI autocorrect is off', async () => {
    await contributeSharedWords('geriatric care', 'en');
    signIn();
    useSettingsStore.setState({ aiAutocorrectEnabled: false } as never);
    await contributeSharedWords('geriatric care', 'en');
    expect(portal.fetch).not.toHaveBeenCalled();
  });

  it('sends new words once per session, and again after a failed send', async () => {
    signIn();
    await contributeSharedWords('geriatric care', 'en');
    expect(portal.fetch).toHaveBeenCalledExactlyOnceWith(expect.objectContaining({
      path: '/prism-aac/words', method: 'POST', body: { lang: 'en', words: ['geriatric'] },
    }));
    await contributeSharedWords('more geriatric', 'en');
    expect(portal.fetch).toHaveBeenCalledOnce();
    portal.fetch.mockResolvedValueOnce({ ok: false, error: 'offline' });
    await contributeSharedWords('gerbil', 'en');
    await contributeSharedWords('gerbil', 'en');
    expect(portal.fetch).toHaveBeenCalledTimes(3);
  });
});

describe('loading the shared list', () => {
  it('loads the list, caches it for a day, and lets shared words through the language filter', async () => {
    signIn();
    portal.fetch.mockResolvedValue({ ok: true, data: { lang: 'en', words: ['geriatric'] }, status: 200 });
    expect(isAllowedInLang('geriatric', 'en')).toBe(false);
    expect(await loadSharedWords('en')).toBe(true);
    expect(portal.fetch).toHaveBeenCalledExactlyOnceWith(expect.objectContaining({ path: '/prism-aac/words?lang=en', method: 'GET' }));
    expect(isAllowedInLang('geriatric', 'en')).toBe(true);
    // A word another language claims is not let through by being shared elsewhere.
    expect(isAllowedInLang('geriatric', 'ro')).toBe(false);
    _resetSharedWordsForTests();
    _resetSharedWordsServiceForTests();
    expect(await loadSharedWords('en')).toBe(true);
    expect(portal.fetch).toHaveBeenCalledOnce();
    expect(isAllowedInLang('geriatric', 'en')).toBe(true);
  });

  it('does not ask the portal when signed out', async () => {
    expect(await loadSharedWords('en')).toBe(false);
    expect(portal.fetch).not.toHaveBeenCalled();
  });

  it('puts a shared word on the bar for its first letters', async () => {
    setSharedWords('en', ['geriatric']);
    useMessageStore.setState({ text: 'geria' } as never);
    render(<PredictionBar />);
    await act(async () => { await new Promise(resolve => setTimeout(resolve, 0)); });
    const tiles = screen.getAllByRole('button', { name: /^Predict:/ }).map(b => (b.getAttribute('title') ?? '').toLowerCase());
    expect(tiles).toContain('geriatric');
  });
});
