import { generateKeyPairSync, sign, type KeyObject } from 'node:crypto';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { CLOCK_FLOOR_KEY, LEASE_STORAGE_KEY, clockNow, storeLease, storedLease, verifyLease } from '@/services/aacLease';

// Signed exactly as the server's issueAacLease does: compact JWS, ES256, IEEE-P1363 signature.
function issue(key: KeyObject, claims: Record<string, unknown>, kid = 'k1', alg = 'ES256'): string {
  const part = (value: unknown) => Buffer.from(JSON.stringify(value)).toString('base64url');
  const header = part({ alg, typ: 'JWT', kid });
  const payload = part(claims);
  const signature = sign('sha256', Buffer.from(`${header}.${payload}`), { key, dsaEncoding: 'ieee-p1363' });
  return `${header}.${payload}.${signature.toString('base64url')}`;
}

const NOW = Date.parse('2026-12-01T12:00:00Z');
const { privateKey, publicKey } = generateKeyPairSync('ec', { namedCurve: 'P-256' });
const claims = (exp = NOW / 1000 + 86_400) => ({ sub: 'user-1', st: 'paid', pv: '2026-10-27-v1', iat: NOW / 1000, exp });

beforeEach(() => {
  localStorage.clear();
  vi.stubEnv('NEXT_PUBLIC_AAC_LEASE_PUBLIC_KEYS', JSON.stringify({ k1: publicKey.export({ format: 'jwk' }) }));
});
afterEach(() => vi.unstubAllEnvs());

describe('offline paid-plan lease', () => {
  it('verifies a lease signed the way the server signs it', async () => {
    expect(await verifyLease(issue(privateKey, claims()), NOW)).toMatchObject({ sub: 'user-1', st: 'paid' });
  });

  it.each<[string, () => string]>([
    ['an expired lease', () => issue(privateKey, claims(NOW / 1000 - 1))],
    ['a tampered payload', () => {
      const [h, , s] = issue(privateKey, claims()).split('.');
      return `${h}.${Buffer.from(JSON.stringify(claims(NOW / 1000 + 365 * 86_400))).toString('base64url')}.${s}`;
    }],
    ['another key', () => issue(generateKeyPairSync('ec', { namedCurve: 'P-256' }).privateKey, claims())],
    ['an unknown key id', () => issue(privateKey, claims(), 'k9')],
    ['another algorithm in the header', () => issue(privateKey, claims(), 'k1', 'none')],
    ['garbage', () => 'not.a.lease'],
  ])('rejects %s', async (_name, lease) => {
    expect(await verifyLease(lease(), NOW)).toBeNull();
  });

  it('rejects everything when no public key is configured', async () => {
    vi.stubEnv('NEXT_PUBLIC_AAC_LEASE_PUBLIC_KEYS', '');
    expect(await verifyLease(issue(privateKey, claims()), NOW)).toBeNull();
  });

  it('is kept for the account that received it, and only that account', async () => {
    vi.useFakeTimers({ toFake: ['Date'] }); vi.setSystemTime(NOW);
    expect(await storeLease(issue(privateKey, claims()), 'family@example.com')).toBe(true);
    expect(await storedLease('family@example.com', NOW)).toMatchObject({ sub: 'user-1' });
    expect(await storedLease('other@example.com', NOW)).toBeNull();
    vi.useRealTimers();
  });

  it('with identity unknown (offline launch), the lease of the account that stored it counts', async () => {
    vi.useFakeTimers({ toFake: ['Date'] }); vi.setSystemTime(NOW);
    expect(await storeLease(issue(privateKey, claims()), 'family@example.com')).toBe(true);
    expect(await storedLease(null, NOW)).toMatchObject({ sub: 'user-1' });
    vi.useRealTimers();
  });

  it('never stores an invalid lease', async () => {
    expect(await storeLease('not.a.lease', 'family@example.com')).toBe(false);
    expect(localStorage.getItem(LEASE_STORAGE_KEY)).toBeNull();
  });

  it('turning the device clock back cannot revive an expired lease', async () => {
    const lease = issue(privateKey, claims(NOW / 1000 + 60));
    expect(clockNow(NOW + 120_000)).toBe(NOW + 120_000);
    // The clock is set back to before expiry; the floor keeps the later time.
    expect(clockNow(NOW)).toBe(NOW + 120_000);
    expect(await verifyLease(lease, clockNow(NOW))).toBeNull();
    expect(Number(localStorage.getItem(CLOCK_FLOOR_KEY))).toBe(NOW + 120_000);
  });
});
