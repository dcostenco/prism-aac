/**
 * authStore — profile fetch, loading guard, clear, cleanup
 *
 * Covers: initial state, refresh() fetches and sets profile, loading guard
 * prevents concurrent calls, fetch failure sets profile=null+loaded, clear()
 * resets state and calls cache-clear helpers, cleanupAuthStore() stops timer.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';

const fetchProfileMock = vi.fn();
const clearTranslationCacheMock = vi.fn();
const clearTextCorrectCacheMock = vi.fn();
const clearPredictionMemoryCacheMock = vi.fn();
const rotateAnonymousPredictionSessionScopeMock = vi.fn();
const destroyAacHrrMock = vi.fn();
const settingsUpdateMock = vi.fn();

vi.mock('@/services/aiService', () => ({
  fetchSynaluxProfile: (...a: unknown[]) => fetchProfileMock(...a),
}));
vi.mock('@/services/translateService', () => ({
  clearTranslationCache: (...a: unknown[]) => clearTranslationCacheMock(...a),
}));
vi.mock('@/services/textCorrectService', () => ({
  clearTextCorrectCache: (...a: unknown[]) => clearTextCorrectCacheMock(...a),
}));
vi.mock('@/services/predictionMemoryService', () => ({
  clearPredictionMemoryCache: (...a: unknown[]) => clearPredictionMemoryCacheMock(...a),
  rotateAnonymousPredictionSessionScope: (...a: unknown[]) => rotateAnonymousPredictionSessionScopeMock(...a),
}));
vi.mock('@/services/hrrContext', () => ({
  destroyAacHrr: (...a: unknown[]) => destroyAacHrrMock(...a),
}));
vi.mock('@/store/settingsStore', () => ({
  useSettingsStore: {
    getState: () => ({ update: settingsUpdateMock }),
  },
}));

const { useAuthStore, cleanupAuthStore } = await import('@/store/authStore');

beforeEach(() => {
  vi.clearAllMocks();
  useAuthStore.setState({ profile: null, loaded: false, loading: false });
});

// ── initial state ──────────────────────────────────────────────────────────────

describe('authStore — initial state', () => {
  it('profile is null', () => {
    expect(useAuthStore.getState().profile).toBeNull();
  });

  it('loaded is false', () => {
    expect(useAuthStore.getState().loaded).toBe(false);
  });

  it('loading is false', () => {
    expect(useAuthStore.getState().loading).toBe(false);
  });
});

// ── refresh() ─────────────────────────────────────────────────────────────────

describe('authStore — refresh()', () => {
  it('sets profile and loaded=true on success', async () => {
    const fakeProfile = { tier: 'pro', email: 'test@example.com' };
    fetchProfileMock.mockResolvedValue(fakeProfile);
    await useAuthStore.getState().refresh();
    expect(useAuthStore.getState().profile).toEqual(fakeProfile);
    expect(useAuthStore.getState().loaded).toBe(true);
    expect(useAuthStore.getState().loading).toBe(false);
  });

  it('sets profile=null and loaded=true on fetch failure', async () => {
    fetchProfileMock.mockRejectedValue(new Error('network error'));
    await useAuthStore.getState().refresh();
    expect(useAuthStore.getState().profile).toBeNull();
    expect(useAuthStore.getState().loaded).toBe(true);
    expect(useAuthStore.getState().loading).toBe(false);
  });

  it('loading guard: second call while loading is a no-op', async () => {
    let resolveFetch!: (v: unknown) => void;
    fetchProfileMock.mockReturnValue(new Promise((r) => { resolveFetch = r; }));
    const p1 = useAuthStore.getState().refresh();
    const p2 = useAuthStore.getState().refresh(); // concurrent call
    resolveFetch({ tier: 'free' });
    await Promise.all([p1, p2]);
    // fetchProfile should only be called once
    expect(fetchProfileMock).toHaveBeenCalledOnce();
  });

  it('clears personalized prediction memory when the signed-in account changes', async () => {
    useAuthStore.setState({
      profile: {
        email: 'first@example.com',
        name: 'First',
        plan: 'free',
        isPlatformAdmin: false,
      },
      loaded: true,
      loading: false,
    });
    fetchProfileMock.mockResolvedValue({
      email: 'second@example.com',
      name: 'Second',
      plan: 'free',
      isPlatformAdmin: false,
    });

    await useAuthStore.getState().refresh();

    expect(clearPredictionMemoryCacheMock).toHaveBeenCalledOnce();
    expect(destroyAacHrrMock).toHaveBeenCalledOnce();
    expect(rotateAnonymousPredictionSessionScopeMock).toHaveBeenCalledOnce();
    expect(settingsUpdateMock).toHaveBeenCalledWith({ cloudPredictionEnabled: false });
    expect(useAuthStore.getState().profile?.email).toBe('second@example.com');
  });

  it('clears personalized prediction memory when refresh loses the signed-in account', async () => {
    useAuthStore.setState({
      profile: {
        email: 'first@example.com',
        name: 'First',
        plan: 'free',
        isPlatformAdmin: false,
      },
      loaded: true,
      loading: false,
    });
    fetchProfileMock.mockRejectedValue(new Error('session expired'));

    await useAuthStore.getState().refresh();

    expect(clearPredictionMemoryCacheMock).toHaveBeenCalledOnce();
    expect(destroyAacHrrMock).toHaveBeenCalledOnce();
    expect(rotateAnonymousPredictionSessionScopeMock).toHaveBeenCalledOnce();
    expect(settingsUpdateMock).toHaveBeenCalledWith({ cloudPredictionEnabled: false });
    expect(useAuthStore.getState().profile).toBeNull();
  });
});

// ── clear() ───────────────────────────────────────────────────────────────────

describe('authStore — clear()', () => {
  it('sets profile to null', async () => {
    fetchProfileMock.mockResolvedValue({ tier: 'pro' });
    await useAuthStore.getState().refresh();
    useAuthStore.getState().clear();
    expect(useAuthStore.getState().profile).toBeNull();
  });

  it('sets loaded to true after clear', () => {
    useAuthStore.getState().clear();
    expect(useAuthStore.getState().loaded).toBe(true);
  });

  it('sets loading to false after clear', () => {
    useAuthStore.getState().clear();
    expect(useAuthStore.getState().loading).toBe(false);
  });

  it('calls clearTranslationCache', () => {
    useAuthStore.getState().clear();
    expect(clearTranslationCacheMock).toHaveBeenCalledOnce();
  });

  it('calls clearTextCorrectCache', () => {
    useAuthStore.getState().clear();
    expect(clearTextCorrectCacheMock).toHaveBeenCalledOnce();
  });

  it('clears personalized AAC prediction memory', () => {
    useAuthStore.getState().clear();
    expect(clearPredictionMemoryCacheMock).toHaveBeenCalledOnce();
    expect(destroyAacHrrMock).toHaveBeenCalledOnce();
    expect(settingsUpdateMock).toHaveBeenCalledWith({ cloudPredictionEnabled: false });
  });

  it('rotates the anonymous tab scope after clear', () => {
    useAuthStore.getState().clear();
    expect(rotateAnonymousPredictionSessionScopeMock).toHaveBeenCalledOnce();
  });
});

// ── cleanupAuthStore() ────────────────────────────────────────────────────────

describe('authStore — cleanupAuthStore()', () => {
  it('cleanupAuthStore() does not throw', () => {
    expect(() => cleanupAuthStore()).not.toThrow();
  });

  it('calling cleanup twice is idempotent', () => {
    expect(() => { cleanupAuthStore(); cleanupAuthStore(); }).not.toThrow();
  });
});
