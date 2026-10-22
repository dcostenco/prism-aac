import { create } from 'zustand';
import { fetchSynaluxProfile, SynaluxProfile } from '@/services/aiService';
import { clearTranslationCache } from '@/services/translateService';
import { clearTextCorrectCache } from '@/services/textCorrectService';
import {
  clearPredictionMemoryCache,
  rotateAnonymousPredictionSessionScope,
} from '@/services/predictionMemoryService';
import { destroyAacHrr } from '@/services/hrrContext';
import { useSettingsStore } from '@/store/settingsStore';
import { clearVerifiedLocalAccess } from '@/services/webAccessService';
import { resetMonetizationTelemetry } from '@/services/monetizationTelemetry';
import { clearNativeBillingDraft } from '@/services/nativeBillingDraft';
import { clearWebSignInDraft } from '@/services/webSignInDraft';
import { speechAudioCache } from '@/services/speechAudioCache';

interface AuthState {
  profile: SynaluxProfile | null;
  loaded: boolean;
  loading: boolean;
  identityGeneration: number;
  lastConfirmedEmail: string | null;
  identityUnknown: boolean;
  refresh: () => Promise<void>;
  clear: () => void;
}

export const useAuthStore = create<AuthState>()((set, get) => ({
  profile: null,
  loaded: false,
  loading: false,
  identityGeneration: 0,
  lastConfirmedEmail: null,
  identityUnknown: true,

  refresh: async () => {
    if (get().loading) return;
    const generation = get().identityGeneration;
    set({ loading: true });
    let profile: SynaluxProfile | null | undefined;
    try { profile = await fetchSynaluxProfile(); }
    catch { /* An unavailable identity lookup is not a confirmed sign-out. */ }
    if (get().identityGeneration !== generation) return;
    const previousIdentity = get().profile?.email.toLowerCase() ?? get().lastConfirmedEmail;
    if (profile === undefined) {
      // Stop using unverified personalisation, but preserve communication
      // handoffs. Remember the last identity so A -> unknown -> B still clears
      // A's protected handoffs when B is actually confirmed.
      if (get().profile) {
        set({ identityGeneration: get().identityGeneration + 1 });
        clearPredictionMemoryCache();
        destroyAacHrr();
        rotateAnonymousPredictionSessionScope();
        useSettingsStore.getState().update({ cloudPredictionEnabled: false });
      }
      set({ profile: null, lastConfirmedEmail: previousIdentity, identityUnknown: true, loaded: true, loading: false });
      return;
    }
    const nextIdentity = profile?.email.toLowerCase() ?? null;
    if (previousIdentity !== nextIdentity) {
      if (previousIdentity) { clearNativeBillingDraft(); clearWebSignInDraft(); }
      set({ identityGeneration: get().identityGeneration + 1 });
      clearPredictionMemoryCache();
      destroyAacHrr();
      rotateAnonymousPredictionSessionScope();
      useSettingsStore.getState().update({ cloudPredictionEnabled: false });
    }
    const savedScope = nextIdentity ? speechAudioCache.rememberScope(nextIdentity) : speechAudioCache.forgetScope();
    set({ profile, lastConfirmedEmail: nextIdentity, identityUnknown: false, loaded: true, loading: false });
    await savedScope;
  },

  clear: () => {
    void speechAudioCache.forgetScope();
    clearNativeBillingDraft();
    clearWebSignInDraft();
    clearVerifiedLocalAccess();
    // The next person on a shared device is a new visitor, and nothing about
    // the last one should survive the sign-out.
    resetMonetizationTelemetry();
    clearTranslationCache();
    clearTextCorrectCache();
    clearPredictionMemoryCache();
    destroyAacHrr();
    rotateAnonymousPredictionSessionScope();
    useSettingsStore.getState().update({ cloudPredictionEnabled: false });
    set({ profile: null, lastConfirmedEmail: null, identityUnknown: false, loaded: true, loading: false, identityGeneration: get().identityGeneration + 1 });
  },
}));

// Re-validate auth every 30 minutes to catch expired tokens
let _authRefreshTimer: ReturnType<typeof setInterval> | null = null;
if (typeof window !== 'undefined' && !_authRefreshTimer) {
  _authRefreshTimer = setInterval(() => {
    if (useAuthStore.getState().profile) useAuthStore.getState().refresh();
  }, 30 * 60 * 1000);
}

/** Stop the periodic auth refresh. Call in test teardown or PWA shell cleanup. */
export function cleanupAuthStore(): void {
  if (_authRefreshTimer) { clearInterval(_authRefreshTimer); _authRefreshTimer = null; }
}
