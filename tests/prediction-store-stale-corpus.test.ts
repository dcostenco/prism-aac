/**
 * A lazy corpus import is read-only, but its completion callback must still
 * obey latest-language semantics. An old EN import must not reactivate EN
 * personalization after the AAC user has switched to Romanian.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

type EmptySeed = {
  wordFreq: Record<string, never>;
  bigrams: Record<string, never>;
  trigrams: Record<string, never>;
};

const seedMocks = vi.hoisted(() => ({
  resolvers: new Map<string, (seed: EmptySeed) => void>(),
}));

vi.mock('@/constants/predictionSeeds', () => ({
  getCachedPredictionSeed: () => null,
  loadPredictionSeed: (language: string) => new Promise<EmptySeed>((resolve) => {
    seedMocks.resolvers.set(language, resolve);
  }),
}));

const { useSettingsStore } = await import('@/store/settingsStore');
const { usePredictionStore } = await import('@/store/predictionStore');
const { useMessageStore } = await import('@/store/messageStore');

beforeEach(() => {
  vi.useFakeTimers();
  seedMocks.resolvers.clear();
  usePredictionStore.getState().activatePredictionIdentity(
    `anon:stale-corpus-reset-${Math.random()}`,
    'en',
  );
  localStorage.clear();
  usePredictionStore.getState().activatePredictionIdentity(
    'user:stale-corpus@example.com',
    'en',
  );
  useSettingsStore.setState({ language: 'en', outputLanguage: 'en' });
});

afterEach(() => {
  vi.useRealTimers();
});

describe('predictionStore lazy corpus latest-language guard', () => {
  it('does not reactivate EN when its import resolves after switching to RO', async () => {
    usePredictionStore.getState().updatePredictions('hel', 'en');
    expect(seedMocks.resolvers.has('en')).toBe(true);

    useSettingsStore.setState({ language: 'ro', outputLanguage: 'ro' });
    const romanianPredictions = [...usePredictionStore.getState().predictions];
    const englishStorageKey = 'prism-aac-predictions:v5:user%3Astale-corpus%40example.com:en';
    const englishBeforeStaleResolve = localStorage.getItem(englishStorageKey);
    expect(usePredictionStore.getState().personalizationLanguage).toBe('ro');

    seedMocks.resolvers.get('en')?.({
      wordFreq: {},
      bigrams: {},
      trigrams: {},
    });
    await Promise.resolve();
    await Promise.resolve();
    vi.advanceTimersByTime(2_000);

    expect(usePredictionStore.getState().personalizationLanguage).toBe('ro');
    expect(usePredictionStore.getState().predictions).toEqual(romanianPredictions);
    expect(localStorage.getItem(englishStorageKey)).toBe(englishBeforeStaleResolve);
  });

  it('keeps the latest prefix instead of resetting to default words after an import', async () => {
    useSettingsStore.setState({ language: 'de', outputLanguage: 'de' });
    useMessageStore.setState({ text: 'wa' });
    usePredictionStore.getState().updatePredictions('wa', 'de');
    expect(seedMocks.resolvers.has('de')).toBe(true);
    // The message can change while the import is pending.
    useMessageStore.setState({ text: 'wass' });
    seedMocks.resolvers.get('de')?.({ wordFreq: {}, bigrams: {}, trigrams: {} });
    await Promise.resolve();
    await Promise.resolve();
    expect(usePredictionStore.getState().predictions).toContain('wasser');
    expect(useMessageStore.getState().text).toBe('wass');
  });
});
