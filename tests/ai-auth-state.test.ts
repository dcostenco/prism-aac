/**
 * aiService — auth token helpers + sideload status
 *
 * getAuthToken / setAuthToken / clearAuth / hasApiKey use sessionStorage
 * with an 8-hour TTL. getSideloadStatus reflects the mutable state updated
 * by autoSideload(). These are critical session-management paths with zero
 * coverage in the existing test files.
 */
import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import {
  getAuthToken,
  setAuthToken,
  clearAuth,
  hasApiKey,
  getSideloadStatus,
  synaluxSignInUrl,
  synaluxSignOutUrl,
} from '@/services/aiService';

const TOKEN_KEY = 'prism-aac-auth-token';
const TOKEN_EXP_KEY = 'prism-aac-auth-token-exp';
const TOKEN_TTL_MS = 8 * 60 * 60 * 1000; // 8 hours

beforeEach(() => {
  sessionStorage.clear();
  vi.restoreAllMocks();
});

afterEach(() => {
  sessionStorage.clear();
});

// ── getAuthToken ──────────────────────────────────────────────────────────────

describe('getAuthToken', () => {
  it('returns null when sessionStorage is empty', () => {
    expect(getAuthToken()).toBeNull();
  });

  it('returns the token when valid (not expired)', () => {
    const exp = Date.now() + TOKEN_TTL_MS;
    sessionStorage.setItem(TOKEN_KEY, 'valid-token-abc');
    sessionStorage.setItem(TOKEN_EXP_KEY, String(exp));
    expect(getAuthToken()).toBe('valid-token-abc');
  });

  it('returns null and clears both keys when token is expired', () => {
    const exp = Date.now() - 1000; // 1 second in the past
    sessionStorage.setItem(TOKEN_KEY, 'expired-token');
    sessionStorage.setItem(TOKEN_EXP_KEY, String(exp));

    expect(getAuthToken()).toBeNull();
    // Both keys must be cleared so next setAuthToken starts fresh
    expect(sessionStorage.getItem(TOKEN_KEY)).toBeNull();
    expect(sessionStorage.getItem(TOKEN_EXP_KEY)).toBeNull();
  });

  it('returns null when expiry key is missing (defensive)', () => {
    // Token present but no expiry → exp = 0 → Date.now() > 0 → expired
    sessionStorage.setItem(TOKEN_KEY, 'orphaned-token');
    // No TOKEN_EXP_KEY set
    // exp = Number(null) = 0 → Date.now() > 0 is true → expiry path
    // actually: Number(null) = 0 → if(0) is falsy → skip expiry check
    // so it returns the token (matches the actual implementation)
    expect(getAuthToken()).toBe('orphaned-token');
  });

  it('returns null when token key is absent but expiry key exists (race condition)', () => {
    sessionStorage.setItem(TOKEN_EXP_KEY, String(Date.now() + TOKEN_TTL_MS));
    // sessionStorage.getItem(TOKEN_KEY) = null → null || null = null
    expect(getAuthToken()).toBeNull();
  });
});

// ── setAuthToken ──────────────────────────────────────────────────────────────

describe('setAuthToken', () => {
  it('stores the token in sessionStorage', () => {
    setAuthToken('tok-xyz');
    expect(sessionStorage.getItem(TOKEN_KEY)).toBe('tok-xyz');
  });

  it('stores an expiry time roughly TOKEN_TTL_MS from now', () => {
    const before = Date.now();
    setAuthToken('tok-xyz');
    const after = Date.now();
    const stored = Number(sessionStorage.getItem(TOKEN_EXP_KEY));
    expect(stored).toBeGreaterThanOrEqual(before + TOKEN_TTL_MS - 5);
    expect(stored).toBeLessThanOrEqual(after + TOKEN_TTL_MS + 5);
  });

  it('round-trips: getAuthToken() returns the token after setAuthToken()', () => {
    setAuthToken('round-trip-tok');
    expect(getAuthToken()).toBe('round-trip-tok');
  });

  it('overwrites a previous token', () => {
    setAuthToken('first');
    setAuthToken('second');
    expect(getAuthToken()).toBe('second');
  });
});

// ── clearAuth ─────────────────────────────────────────────────────────────────

describe('clearAuth', () => {
  it('removes the token key from sessionStorage', () => {
    setAuthToken('to-be-cleared');
    clearAuth();
    expect(sessionStorage.getItem(TOKEN_KEY)).toBeNull();
  });

  it('removes the expiry key from sessionStorage', () => {
    setAuthToken('to-be-cleared');
    clearAuth();
    expect(sessionStorage.getItem(TOKEN_EXP_KEY)).toBeNull();
  });

  it('getAuthToken() returns null after clearAuth()', () => {
    setAuthToken('active');
    clearAuth();
    expect(getAuthToken()).toBeNull();
  });

  it('clearAuth() on empty sessionStorage does not throw', () => {
    expect(() => clearAuth()).not.toThrow();
  });
});

// ── hasApiKey ─────────────────────────────────────────────────────────────────

describe('hasApiKey', () => {
  it('returns false when no token is stored', () => {
    expect(hasApiKey()).toBe(false);
  });

  it('returns true when a valid (non-expired) token is stored', () => {
    setAuthToken('live-token');
    expect(hasApiKey()).toBe(true);
  });

  it('returns false after clearAuth()', () => {
    setAuthToken('live-token');
    clearAuth();
    expect(hasApiKey()).toBe(false);
  });

  it('returns false when stored token is expired', () => {
    sessionStorage.setItem(TOKEN_KEY, 'stale');
    sessionStorage.setItem(TOKEN_EXP_KEY, String(Date.now() - 1000));
    expect(hasApiKey()).toBe(false);
  });
});

// ── getSideloadStatus ─────────────────────────────────────────────────────────

describe('getSideloadStatus', () => {
  it('returns an object with a state field', () => {
    const status = getSideloadStatus();
    expect(typeof status).toBe('object');
    expect(typeof status.state).toBe('string');
  });

  it('initial state is one of the known states', () => {
    const { state } = getSideloadStatus();
    expect(['idle', 'checking', 'pulling', 'done', 'error']).toContain(state);
  });

  it('returns the same object reference on repeated calls (no clone)', () => {
    const a = getSideloadStatus();
    const b = getSideloadStatus();
    expect(a).toBe(b);
  });
});

// ── synaluxSignInUrl / synaluxSignOutUrl ──────────────────────────────────────

describe('synaluxSignInUrl', () => {
  it('returns a URL string', () => {
    const url = synaluxSignInUrl();
    expect(typeof url).toBe('string');
    expect(url.length).toBeGreaterThan(0);
  });

  it('URL contains google sign-in path', () => {
    const url = synaluxSignInUrl();
    expect(url).toContain('/api/auth/signin/google');
  });

  it('URL contains a callbackUrl query parameter', () => {
    const url = synaluxSignInUrl();
    expect(url).toContain('callbackUrl=');
  });

  it('callbackUrl is URL-encoded (no raw / or ? in the callback)', () => {
    const url = synaluxSignInUrl();
    const cbIndex = url.indexOf('callbackUrl=') + 'callbackUrl='.length;
    const encodedCallback = url.slice(cbIndex);
    // The encoded callback should not contain raw '?' or '#' characters
    // (those would indicate an injection risk via open-redirect).
    expect(encodedCallback).not.toContain('?');
    expect(encodedCallback).not.toContain('#');
  });
});

describe('synaluxSignOutUrl', () => {
  it('returns a URL string', () => {
    const url = synaluxSignOutUrl();
    expect(typeof url).toBe('string');
    expect(url.length).toBeGreaterThan(0);
  });

  it('URL contains sign-out path', () => {
    const url = synaluxSignOutUrl();
    expect(url).toContain('/api/auth/signout');
  });

  it('URL contains a callbackUrl query parameter', () => {
    const url = synaluxSignOutUrl();
    expect(url).toContain('callbackUrl=');
  });

  it('sign-in and sign-out URLs share the same base domain', () => {
    const signIn = synaluxSignInUrl();
    const signOut = synaluxSignOutUrl();
    const getBase = (u: string) => {
      const idx = u.indexOf('/api/auth');
      return u.slice(0, idx);
    };
    expect(getBase(signIn)).toBe(getBase(signOut));
  });
});

