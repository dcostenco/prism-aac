/**
 * Quota-safe localStorage adapter for zustand `persist`.
 *
 * Default `createJSONStorage(() => localStorage)` lets `setItem`
 * throw a `QuotaExceededError` (5-10 MB cap, shared with other apps
 * on the origin). When that fires, zustand silently fails the persist
 * write — the user's edits live in memory only, lost on reload. For
 * an AAC user who can't articulate "my data isn't saving", that's a
 * silent data-loss class.
 *
 * This wrapper:
 *   1. Catches QuotaExceededError on setItem.
 *   2. Calls a per-store onQuotaExceeded(state) callback so the store
 *      can shed disposable data (oldest read messages, stale previews)
 *      and let the caller retry.
 *   3. Logs once per store instead of per-write to avoid console spam.
 *   4. SSR/test-safe — falls back to a no-op storage when window is
 *      undefined.
 */
import type { StateStorage } from 'zustand/middleware';

export interface SafeStorageOptions {
  /** Storage key prefix used by the persist middleware (for diagnostics). */
  name: string;
  /** Called on first QuotaExceededError per store. May synchronously
   *  trim state (e.g. drop oldest messages); zustand will re-attempt
   *  the write on the next state mutation, so trimming alone is enough
   *  to recover. */
  onQuotaExceeded?: () => void;
}

function isQuotaError(e: unknown): boolean {
  if (!(e instanceof DOMException)) return false;
  // Spec name + Firefox legacy code 1014 + Safari/Chrome legacy code 22.
  return e.name === 'QuotaExceededError'
    || e.name === 'NS_ERROR_DOM_QUOTA_REACHED'
    || ('code' in e && (e.code === 22 || e.code === 1014));
}

export function safeJSONStorage(opts: SafeStorageOptions): StateStorage {
  const noop: StateStorage = {
    getItem: () => null,
    setItem: () => undefined,
    removeItem: () => undefined,
  };
  if (typeof window === 'undefined') return noop;
  let warned = false;
  return {
    getItem: (name) => {
      try {
        return window.localStorage.getItem(name);
      } catch {
        // SecurityError (Safari private mode), DOMException, etc.
        return null;
      }
    },
    setItem: (name, value) => {
      try {
        window.localStorage.setItem(name, value);
      } catch (e) {
        if (isQuotaError(e)) {
          if (!warned) {
            warned = true;
            // eslint-disable-next-line no-console
            console.warn(`[safeStorage] localStorage quota exceeded for "${opts.name}" — shedding data`);
          }
          opts.onQuotaExceeded?.();
          // Retry once after the trim callback. For transient quota errors
          // (another store freed space), this succeeds immediately.
          // If this store itself is oversized, the retry fails silently —
          // recovery then happens on the next Zustand state mutation which
          // will write the newly trimmed state.
          try { window.localStorage.setItem(name, value); } catch { /* */ }
          return;
        }
        // Non-quota errors (private mode SecurityError etc.) — swallow,
        // same behavior as the legacy try/catch in predictionStore.
      }
    },
    removeItem: (name) => {
      try { window.localStorage.removeItem(name); } catch { /* */ }
    },
  };
}
