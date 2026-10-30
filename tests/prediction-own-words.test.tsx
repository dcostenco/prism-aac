/**
 * Words no dictionary has (owner report 2026-10-30: typing "geria" kept the
 * bar on german / germany / gerard while the AI suggestion read "geriatric").
 *
 * The bar's language filter dropped every word absent from all dictionaries,
 * including the AI completion and the user's own learned words. Those may now
 * show; a word another language's dictionary claims is still dropped.
 */
import { act, cleanup, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import PredictionBar, { mergeAdvisoryPredictions } from '@/components/PredictionBar';
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

const tiles = () => screen.getAllByRole('button', { name: /^Predict:/ }).map(b => (b.getAttribute('title') ?? '').toLowerCase());
const settle = () => act(async () => { await new Promise(resolve => setTimeout(resolve, 0)); });

beforeEach(async () => {
  cleanup();
  window.localStorage.clear();
  for (const lang of ['en', 'ro']) await loadPredictionSeed(lang);
  await ensureLangCorpusLoaded('en');
  useSettingsStore.setState({ language: 'en', outputLanguage: 'en', aiAutocorrectEnabled: false, cloudPredictionEnabled: false } as never);
  useAuthStore.setState({ profile: null, loaded: true, loading: false });
  usePredictionStore.setState({ aiCompletion: null, wordFreq: {}, bigrams: {}, trigrams: {}, predictions: [] });
});

describe('the language filter for words no dictionary has', () => {
  it('drops an unknown word by default and keeps it when it is the user\'s own', () => {
    expect(mergeAdvisoryPredictions(['geriatric', 'I'], [], 'en')).toEqual(['I']);
    expect(mergeAdvisoryPredictions(['geriatric', 'I'], [], 'en', word => word === 'geriatric')).toEqual(['geriatric', 'I']);
  });

  it('still drops a word another language claims, even when allowed to be unknown', () => {
    // Romanian "eu" in the English bar is the leak the filter exists to stop.
    expect(mergeAdvisoryPredictions(['eu', 'I'], [], 'en', () => true)).toEqual(['I']);
  });
});

describe('the bar shows words no dictionary has', () => {
  it('shows the AI completion "geriatric" while typing "geria"', async () => {
    useMessageStore.setState({ text: 'geria' } as never);
    render(<PredictionBar />);
    await settle();
    expect(tiles()).not.toContain('geriatric');
    await act(async () => { usePredictionStore.getState().setAiCompletion('geriatric'); });
    await settle();
    expect(tiles(), JSON.stringify(tiles())).toContain('geriatric');
  });

  it('shows a word the user has used before when they type its start', async () => {
    usePredictionStore.getState().updatePredictions('x', 'en');
    for (let i = 0; i < 3; i++) usePredictionStore.getState().learnWord('geriatric');
    useMessageStore.setState({ text: 'geri' } as never);
    render(<PredictionBar />);
    await settle();
    expect(tiles()[0], JSON.stringify(tiles()) + JSON.stringify(usePredictionStore.getState().predictions)).toBe('geriatric');
  });

  it('does not offer an unknown word from one spoken message (a motor slip)', async () => {
    usePredictionStore.getState().updatePredictions('x', 'en');
    // One message learns a word twice: once on space (Keyboard), once on Speak (MessageBar).
    usePredictionStore.getState().learnWord('geriatrc');
    usePredictionStore.getState().learnWord('geriatrc');
    useMessageStore.setState({ text: 'geri' } as never);
    render(<PredictionBar />);
    await settle();
    expect(tiles()).not.toContain('geriatrc');
  });

  it('still drops an English word learned in the Romanian bar', async () => {
    useSettingsStore.setState({ language: 'ro', outputLanguage: 'ro' } as never);
    await ensureLangCorpusLoaded('ro');
    usePredictionStore.getState().updatePredictions('x', 'ro');
    for (let i = 0; i < 3; i++) usePredictionStore.getState().learnWord('house');
    useMessageStore.setState({ text: 'hou' } as never);
    render(<PredictionBar />);
    await settle();
    expect(tiles()).not.toContain('house');
  });
});
