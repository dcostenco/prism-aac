import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, render, screen } from '@testing-library/react';
import PredictionBar from '@/components/PredictionBar';
import { useSettingsStore } from '@/store/settingsStore';
import { useMessageStore } from '@/store/messageStore';
import { usePredictionStore } from '@/store/predictionStore';
import { useAuthStore } from '@/store/authStore';

const corpus = vi.hoisted(() => ({
  ready: false,
  resolvers: new Map<string, (() => void)[]>(),
  hrrInit: vi.fn(async () => false),
}));

vi.mock('@/lib/langAllowlist', () => ({
  isAllowedInLang: (word: string, language: string) => (
    !(corpus.ready && language === 'en' && word.toLowerCase() === 'eu')
  ),
  ensureLangCorpusLoaded: (language: string) => new Promise<void>((resolve) => {
    const waiting = corpus.resolvers.get(language) ?? [];
    waiting.push(resolve);
    corpus.resolvers.set(language, waiting);
  }),
}));
vi.mock('@/services/hrrContext', () => ({ initAacHrr: (...args: unknown[]) => corpus.hrrInit(...args) }));

let update: ReturnType<typeof vi.fn>;
let originalUpdate: ReturnType<typeof usePredictionStore.getState>['updatePredictions'];

beforeEach(() => {
  cleanup();
  localStorage.clear();
  corpus.ready = false;
  corpus.resolvers.clear();
  corpus.hrrInit.mockClear();
  useAuthStore.setState({ profile: null, identityGeneration: 0 });
  useSettingsStore.setState({ language: 'en', outputLanguage: 'en', cloudPredictionEnabled: false });
  useMessageStore.setState({ text: '' });
  originalUpdate = usePredictionStore.getState().updatePredictions;
  update = vi.fn();
  usePredictionStore.setState({ aiCompletion: null, predictions: [], updatePredictions: update });
});

afterEach(() => {
  cleanup();
  usePredictionStore.setState({ updatePredictions: originalUpdate });
});

async function finish(language: string) {
  await act(async () => {
    corpus.ready = true;
    for (const resolve of corpus.resolvers.get(language) ?? []) resolve();
    await Promise.resolve();
  });
}

describe('prediction corpus completion', () => {
  it('removes a foreign completion without requiring another keystroke', async () => {
    usePredictionStore.setState({ aiCompletion: 'eu' });
    await act(async () => { render(<PredictionBar />); });
    expect(screen.getByText('eu')).toBeInTheDocument();
    await finish('en');
    expect(screen.queryByText('eu')).not.toBeInTheDocument();
    expect(screen.getAllByTestId('prediction-tile')).toHaveLength(5);
  });

  it('refines the latest message when the corpus finishes', async () => {
    useMessageStore.setState({ text: 'wa' });
    await act(async () => { render(<PredictionBar />); });
    await act(async () => { useMessageStore.setState({ text: 'wat' }); });
    update.mockClear();
    await finish('en');
    expect(update).toHaveBeenCalledWith('wat', 'en');
    expect(useMessageStore.getState().text).toBe('wat');
  });

  it('ignores completion from a language the user has left', async () => {
    useMessageStore.setState({ text: 'wa' });
    await act(async () => { render(<PredictionBar />); });
    await act(async () => { useSettingsStore.setState({ language: 'ro', outputLanguage: 'ro' }); });
    update.mockClear();
    await finish('en');
    expect(update).not.toHaveBeenCalled();
    await finish('ro');
    expect(update).toHaveBeenCalledWith('wa', 'ro');
  });

  it('does not update after the prediction bar unmounts', async () => {
    useMessageStore.setState({ text: 'wa' });
    const view = render(<PredictionBar />);
    view.unmount();
    update.mockClear();
    await finish('en');
    expect(update).not.toHaveBeenCalled();
  });

  it('does not recreate a departed account after delayed corpus loading', async () => {
    useAuthStore.setState({ profile: { email: 'aac@example.com' } as never });
    useMessageStore.setState({ text: 'I need ' });
    await act(async () => { render(<PredictionBar />); });
    // Simulate an identity round trip batched before a profile rerender.
    useAuthStore.setState({ identityGeneration: 2 });
    await finish('en');
    expect(corpus.hrrInit).not.toHaveBeenCalled();
  });
});
