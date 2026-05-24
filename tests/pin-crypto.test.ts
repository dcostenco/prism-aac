/**
 * pinCrypto — SHA-256 + per-device-salt PIN hashing / verification
 *
 * Security-critical: caregiver PIN gate. Tests cover:
 * hashPin returns hex string, same PIN same salt → same hash,
 * verifyPin correct → true, incorrect → false,
 * constant-time compare handles length mismatch, salt persists in localStorage.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { hashPin, verifyPin } from '@/lib/pinCrypto';

// ── localStorage isolation ─────────────────────────────────────────────────────

// jsdom setup.ts already mocks localStorage but the mock store persists
// between tests. Clear before each test so salt is regenerated fresh.
beforeEach(() => {
  localStorage.clear();
  vi.clearAllMocks();
});

// ── hashPin ────────────────────────────────────────────────────────────────────

describe('pinCrypto — hashPin', () => {
  it('returns a 64-char hex string (SHA-256 output)', async () => {
    const hash = await hashPin('1234');
    expect(hash).toMatch(/^[0-9a-f]{64}$/);
  });

  it('same PIN + same salt → same hash (deterministic)', async () => {
    const h1 = await hashPin('1234');
    const h2 = await hashPin('1234');
    expect(h1).toBe(h2);
  });

  it('different PINs → different hashes', async () => {
    const h1 = await hashPin('1234');
    const h2 = await hashPin('5678');
    expect(h1).not.toBe(h2);
  });

  it('stores salt in localStorage under expected key', async () => {
    await hashPin('1234');
    expect(localStorage.getItem('prism-aac-pin-salt')).not.toBeNull();
  });

  it('salt has 32-char hex format (16 random bytes)', async () => {
    await hashPin('1234');
    const salt = localStorage.getItem('prism-aac-pin-salt');
    expect(salt).toMatch(/^[0-9a-f]{32}$/);
  });

  it('reuses existing salt — does not overwrite on second call', async () => {
    await hashPin('1234');
    const salt1 = localStorage.getItem('prism-aac-pin-salt');
    await hashPin('5678');
    const salt2 = localStorage.getItem('prism-aac-pin-salt');
    expect(salt1).toBe(salt2);
  });
});

// ── verifyPin ──────────────────────────────────────────────────────────────────

describe('pinCrypto — verifyPin', () => {
  it('returns true for the correct PIN', async () => {
    const stored = await hashPin('0000');
    expect(await verifyPin('0000', stored)).toBe(true);
  });

  it('returns false for an incorrect PIN', async () => {
    const stored = await hashPin('0000');
    expect(await verifyPin('9999', stored)).toBe(false);
  });

  it('returns false when stored hash is empty string', async () => {
    expect(await verifyPin('1234', '')).toBe(false);
  });

  it('returns false when stored hash has different length', async () => {
    // Shorter stored hash → length mismatch guard should return false
    expect(await verifyPin('1234', 'abc')).toBe(false);
  });

  it('constant-time compare: off-by-one digit still returns false', async () => {
    const stored = await hashPin('1234');
    // All digits same except last
    expect(await verifyPin('1235', stored)).toBe(false);
  });

  it('correct PIN after PIN change (salt re-use) still verifies', async () => {
    const h1 = await hashPin('1234');
    // Change PIN — new hash with same salt
    const h2 = await hashPin('9876');
    expect(await verifyPin('9876', h2)).toBe(true);
    // Old PIN no longer matches new hash
    expect(await verifyPin('1234', h2)).toBe(false);
  });
});
