/**
 * Deterministic AAC prediction personalization is user-authored data.
 *
 * These tests prove that a name or routine learned for one account/language
 * never becomes another user's suggestion on a shared device. Anonymous
 * learning remains tab-only, and the unowned v4 global record is discarded.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';

const fetchProfileMock = vi.fn();

vi.mock('@/services/aiService', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/services/aiService')>();
  return {
    ...actual,
    fetchSynaluxProfile: (...args: unknown[]) => fetchProfileMock(...args),
  };
});

const { useAuthStore } = await import('@/store/authStore');
const { useSettingsStore } = await import('@/store/settingsStore');
const {
  getPredictionSessionScope,
  rotateAnonymousPredictionSessionScope,
} = await import('@/services/predictionMemoryService');
const { usePredictionStore } = await import('@/store/predictionStore');

type TestProfile = NonNullable<ReturnType<typeof useAuthStore.getState>['profile']>;

const USER_A: TestProfile = {
  email: 'user-a@example.com',
  name: 'User A',
  plan: 'free',
  isPlatformAdmin: false,
};
const USER_B: TestProfile = {
  email: 'user-b@example.com',
  name: 'User B',
  plan: 'free',
  isPlatformAdmin: false,
};

let resetCounter = 0;

function scopedKey(scope: string, language: string): string {
  return `prism-aac-predictions:v5:${encodeURIComponent(scope)}:${encodeURIComponent(language)}`;
}

async function refreshAs(profile: TestProfile): Promise<void> {
  fetchProfileMock.mockResolvedValueOnce(profile);
  await useAuthStore.getState().refresh();
}

beforeEach(() => {
  vi.useFakeTimers();
  fetchProfileMock.mockReset();

  // Flush any prior signed-in write to its own key, then enter a fresh
  // anonymous scope before clearing storage.
  usePredictionStore.getState().activatePredictionIdentity(
    `anon:isolation-reset-${resetCounter += 1}`,
    'en',
  );
  localStorage.clear();
  sessionStorage.clear();
  rotateAnonymousPredictionSessionScope();
  useAuthStore.setState({ profile: null, loaded: true, loading: false });
  useSettingsStore.setState({ language: 'en', outputLanguage: 'en' });
  usePredictionStore.getState().activatePredictionIdentity(
    getPredictionSessionScope(null),
    'en',
  );
});

describe('predictionStore account and language isolation', () => {
  it('does not expose User A learning to User B through a real auth refresh', async () => {
    await refreshAs(USER_A);
    usePredictionStore.getState().learnWord('aliciazzq');
    expect(usePredictionStore.getState().wordFreq.aliciazzq).toBeDefined();

    await refreshAs(USER_B);

    expect(usePredictionStore.getState().personalizationScope)
      .toBe('user:user-b@example.com');
    expect(usePredictionStore.getState().wordFreq.aliciazzq).toBeUndefined();

    // Rehydrating User B's current store must not pull User A's persisted map.
    await usePredictionStore.persist.rehydrate();
    expect(usePredictionStore.getState().wordFreq.aliciazzq).toBeUndefined();
  });

  it('restores one account language without leaking it into another language', async () => {
    await refreshAs(USER_A);
    usePredictionStore.getState().learnWord('englishonlyzzq');
    expect(usePredictionStore.getState().wordFreq.englishonlyzzq).toBeDefined();

    useSettingsStore.setState({ language: 'ro', outputLanguage: 'ro' });
    expect(usePredictionStore.getState().personalizationLanguage).toBe('ro');
    expect(usePredictionStore.getState().wordFreq.englishonlyzzq).toBeUndefined();

    useSettingsStore.setState({ language: 'en', outputLanguage: 'en' });
    expect(usePredictionStore.getState().personalizationLanguage).toBe('en');
    expect(usePredictionStore.getState().wordFreq.englishonlyzzq).toBeDefined();
  });

  it('keeps anonymous learning tab-ephemeral across scope rotation', () => {
    const firstScope = getPredictionSessionScope(null);
    usePredictionStore.getState().activatePredictionIdentity(firstScope, 'en');
    usePredictionStore.getState().learnWord('anonymousonlyzzq');
    expect(usePredictionStore.getState().wordFreq.anonymousonlyzzq).toBeDefined();

    const secondScope = rotateAnonymousPredictionSessionScope();
    usePredictionStore.getState().activatePredictionIdentity(secondScope, 'en');

    expect(secondScope).not.toBe(firstScope);
    expect(usePredictionStore.getState().wordFreq.anonymousonlyzzq).toBeUndefined();
    expect(
      Object.keys(localStorage).some((key) => key.includes('anon%3A')),
    ).toBe(false);
  });

  it('never redirects User A pending persistence into User B storage', async () => {
    await refreshAs(USER_A);
    usePredictionStore.getState().learnWord('pendinguserazzq');

    // Account activation flushes the pending A value to A before routing any
    // subsequent write to B.
    await refreshAs(USER_B);
    vi.advanceTimersByTime(2_000);

    const userAStored = JSON.parse(
      localStorage.getItem(scopedKey('user:user-a@example.com', 'en')) ?? '{}',
    );
    const userBStored = JSON.parse(
      localStorage.getItem(scopedKey('user:user-b@example.com', 'en')) ?? '{}',
    );

    expect(userAStored.state?.wordFreq?.pendinguserazzq).toBeDefined();
    expect(userBStored.state?.wordFreq?.pendinguserazzq).toBeUndefined();
    expect(localStorage.getItem('prism-aac-predictions')).toBeNull();
  });

  it('discards unowned v4 personalization instead of assigning it to a user', async () => {
    localStorage.setItem('prism-aac-predictions', JSON.stringify({
      state: {
        wordFreq: {
          legacyprivatezzq: { count: 100_000, lastUsed: Date.now() },
        },
      },
      version: 4,
    }));

    await refreshAs(USER_A);
    await usePredictionStore.persist.rehydrate();

    expect(usePredictionStore.getState().wordFreq.legacyprivatezzq).toBeUndefined();
    expect(localStorage.getItem('prism-aac-predictions')).toBeNull();
  });
});
