/**
 * authStore — profile fetch, loading guard, clear, cleanup
 *
 * Covers: initial state, refresh() fetches and sets profile, loading guard
 * prevents concurrent calls, unknown identity preserves drafts, clear()
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
const clearNativeDraftMock = vi.fn();
vi.mock('@/services/nativeBillingDraft', () => ({ clearNativeBillingDraft: () => clearNativeDraftMock(), hasNativeBillingDraft: () => false }));

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
const { rememberWebSignInDraft, recoverWebSignInDraft, WEB_SIGNIN_DRAFT_KEY } = await import('@/services/webSignInDraft');
const { useMessageStore } = await import('@/store/messageStore');

beforeEach(() => {
  vi.clearAllMocks();
  useAuthStore.setState({ profile: null, lastConfirmedEmail: null, identityUnknown: true, loaded: false, loading: false });
  localStorage.clear();
  useMessageStore.setState({ text: '', undoStack: [] });
  sessionStorage.removeItem(WEB_SIGNIN_DRAFT_KEY);
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
  it('keeps communication handoffs recoverable when identity cannot be checked offline', async () => {
    fetchProfileMock.mockResolvedValue({ email: 'first@example.invalid' });
    await useAuthStore.getState().refresh();
    useMessageStore.getState().setTextSilent('I need water');
    clearNativeDraftMock.mockClear();
    fetchProfileMock.mockRejectedValue(new Error('Network unavailable'));
    await useAuthStore.getState().refresh();
    expect(clearNativeDraftMock).not.toHaveBeenCalled();
    expect(rememberWebSignInDraft()).toBe(true);
    useMessageStore.getState().setTextSilent('');
    recoverWebSignInDraft();
    expect(useMessageStore.getState().text).toBe('I need water');
  });
  it.each([null, { email: 'other@example.invalid' }])('revokes the old handoff after unknown identity becomes a confirmed sign-out or different account: %j', async confirmed => {
    fetchProfileMock.mockResolvedValue({ email: 'first@example.invalid' });
    await useAuthStore.getState().refresh();
    useMessageStore.getState().setTextSilent('I need water');
    rememberWebSignInDraft('billing');
    fetchProfileMock.mockResolvedValue(undefined);
    await useAuthStore.getState().refresh();
    expect(clearNativeDraftMock).not.toHaveBeenCalled();
    expect(useAuthStore.getState().profile).toBeNull();
    expect(sessionStorage.getItem(WEB_SIGNIN_DRAFT_KEY)).not.toBeNull();
    fetchProfileMock.mockResolvedValue(confirmed);
    await useAuthStore.getState().refresh();
    expect(clearNativeDraftMock).toHaveBeenCalledOnce();
    rememberWebSignInDraft();
    expect(sessionStorage.getItem(WEB_SIGNIN_DRAFT_KEY)).toBeNull();
    expect(useMessageStore.getState().text).toBe('I need water');
  });
  it('preserves the protected handoff when an unavailable check later confirms the same account', async () => {
    const profile = { email: 'first@example.invalid' };
    fetchProfileMock.mockResolvedValue(profile);
    await useAuthStore.getState().refresh();
    useMessageStore.getState().setTextSilent('I need water');
    rememberWebSignInDraft('billing');
    fetchProfileMock.mockResolvedValue(undefined);
    await useAuthStore.getState().refresh();
    fetchProfileMock.mockResolvedValue(profile);
    await useAuthStore.getState().refresh();
    expect(clearNativeDraftMock).not.toHaveBeenCalled();
    expect(sessionStorage.getItem(WEB_SIGNIN_DRAFT_KEY)).not.toBeNull();
  });
  it('preserves a restart draft during initial identity hydration and clears it on account replacement or sign-out', async () => {
    fetchProfileMock.mockResolvedValue({ email: 'first@example.invalid' });
    await useAuthStore.getState().refresh();
    expect(clearNativeDraftMock).not.toHaveBeenCalled();
    fetchProfileMock.mockResolvedValue({ email: 'next@example.invalid' });
    await useAuthStore.getState().refresh();
    expect(clearNativeDraftMock).toHaveBeenCalledTimes(1);
    useAuthStore.getState().clear();
    expect(clearNativeDraftMock).toHaveBeenCalledTimes(2);
  });
  it('a pending profile fetch cannot sign the user back in after clear', async () => {
    let finish!: (value: unknown) => void;
    fetchProfileMock.mockReturnValue(new Promise((resolve) => { finish = resolve; }));
    const pending = useAuthStore.getState().refresh();
    useAuthStore.getState().clear();
    const generation = useAuthStore.getState().identityGeneration;
    finish({ tier: 'free', email: 'former@example.com' });
    await pending;
    expect(useAuthStore.getState().profile).toBeNull();
    expect(useAuthStore.getState().identityGeneration).toBe(generation);
    expect(useAuthStore.getState().loading).toBe(false);
  });

  it('identity generations distinguish signing out and returning to the same account', async () => {
    fetchProfileMock.mockResolvedValue({ tier: 'free', email: 'same@example.com' });
    await useAuthStore.getState().refresh();
    const first = useAuthStore.getState().identityGeneration;
    await useAuthStore.getState().refresh();
    expect(useAuthStore.getState().identityGeneration).toBe(first);
    useAuthStore.getState().clear();
    expect(useAuthStore.getState().identityGeneration).toBeGreaterThan(first);
    const signedOut = useAuthStore.getState().identityGeneration;
    await useAuthStore.getState().refresh();
    expect(useAuthStore.getState().identityGeneration).toBeGreaterThan(signedOut);
  });
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
    resolveFetch({ tier: 'free', email: 'guard@example.invalid' });
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
  it('removes the tab handoff at sign-out without deleting current communication or recreating it on pagehide', () => {
    useMessageStore.setState({ text: 'Private handoff' }); rememberWebSignInDraft('billing');
    useAuthStore.getState().clear(); rememberWebSignInDraft();
    expect(sessionStorage.getItem(WEB_SIGNIN_DRAFT_KEY)).toBeNull();
    expect(useMessageStore.getState().text).toBe('Private handoff');
  });
  it('sets profile to null', async () => {
    fetchProfileMock.mockResolvedValue({ tier: 'pro', email: 'clear@example.invalid' });
    await useAuthStore.getState().refresh();
    useAuthStore.getState().clear();
    expect(useAuthStore.getState().profile).toBeNull();
  });

  it('removes the offline paid-plan lease, so the next person cannot use it', () => {
    localStorage.setItem('prism-aac-entitlement-lease', JSON.stringify({ lease: 'a.b.c', account: 'clear@example.invalid' }));
    useAuthStore.getState().clear();
    expect(localStorage.getItem('prism-aac-entitlement-lease')).toBeNull();
  });

  it('an account switch without a sign-out also drops the previous account\'s lease', async () => {
    fetchProfileMock.mockResolvedValue({ tier: 'pro', email: 'first@example.invalid' });
    await useAuthStore.getState().refresh();
    localStorage.setItem('prism-aac-entitlement-lease', JSON.stringify({ lease: 'a.b.c', account: 'first@example.invalid' }));
    fetchProfileMock.mockResolvedValue({ tier: 'free', email: 'second@example.invalid' });
    await useAuthStore.getState().refresh();
    expect(localStorage.getItem('prism-aac-entitlement-lease')).toBeNull();
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
