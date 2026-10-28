/**
 * Offline paid-plan lease: a compact ES256 JWS the server issues with the
 * account's entitlement. Verified here with WebCrypto so editing local storage
 * cannot extend access; a modified client can still skip it, which the paid
 * plan accepts. Public keys come from NEXT_PUBLIC_AAC_LEASE_PUBLIC_KEYS, a JSON
 * object of key id to public JWK, so keys can rotate by id.
 */
import type { AacEntitlement } from '@/services/webAccessService';

export const LEASE_STORAGE_KEY = 'prism-aac-entitlement-lease';
export const CLOCK_FLOOR_KEY = 'prism-aac-entitlement-clock-floor';

export interface LeaseClaims {
  sub: string;
  st: AacEntitlement['state'];
  pv: string;
  iat: number;
  exp: number;
}

type PublicKeys = Record<string, JsonWebKey>;

function publicKeys(): PublicKeys {
  try {
    const value = JSON.parse(process.env.NEXT_PUBLIC_AAC_LEASE_PUBLIC_KEYS ?? '{}') as unknown;
    return value && typeof value === 'object' ? value as PublicKeys : {};
  } catch { return {}; }
}

function decode(part: string): unknown {
  const base64 = part.replace(/-/g, '+').replace(/_/g, '/');
  const padded = base64 + '='.repeat((4 - (base64.length % 4)) % 4);
  return JSON.parse(new TextDecoder().decode(Uint8Array.from(atob(padded), c => c.charCodeAt(0))));
}

function bytes(part: string): Uint8Array<ArrayBuffer> {
  const base64 = part.replace(/-/g, '+').replace(/_/g, '/');
  const binary = atob(base64 + '='.repeat((4 - (base64.length % 4)) % 4));
  const out = new Uint8Array(new ArrayBuffer(binary.length));
  for (let i = 0; i < binary.length; i++) out[i] = binary.charCodeAt(i);
  return out;
}

/** The latest time this device has seen, so turning the clock back cannot
 *  bring an expired lease back to life. */
export function clockNow(now = Date.now()): number {
  let floor = 0;
  try { floor = Number(localStorage.getItem(CLOCK_FLOOR_KEY)) || 0; } catch { /* memory only */ }
  const effective = Math.max(now, floor);
  try { if (effective > floor) localStorage.setItem(CLOCK_FLOOR_KEY, String(effective)); } catch { /* memory only */ }
  return effective;
}

/** The lease's claims when its signature, key id and expiry check out; otherwise null. */
export async function verifyLease(lease: string, now = clockNow()): Promise<LeaseClaims | null> {
  try {
    const [header, payload, signature, extra] = lease.split('.');
    if (!header || !payload || !signature || extra !== undefined) return null;
    const { alg, kid } = decode(header) as { alg?: string; kid?: string };
    const jwk = kid ? publicKeys()[kid] : undefined;
    if (alg !== 'ES256' || !jwk) return null;
    const key = await crypto.subtle.importKey('jwk', jwk, { name: 'ECDSA', namedCurve: 'P-256' }, false, ['verify']);
    const valid = await crypto.subtle.verify({ name: 'ECDSA', hash: 'SHA-256' }, key,
      bytes(signature), new TextEncoder().encode(`${header}.${payload}`));
    if (!valid) return null;
    const claims = decode(payload) as LeaseClaims;
    if (typeof claims.sub !== 'string' || typeof claims.exp !== 'number' || claims.exp * 1000 <= now) return null;
    return claims;
  } catch { return null; }
}

/** Keeps a verified lease for the account that received it. */
export async function storeLease(lease: string, account: string): Promise<boolean> {
  if (!await verifyLease(lease)) return false;
  try { localStorage.setItem(LEASE_STORAGE_KEY, JSON.stringify({ lease, account })); } catch { return false; }
  return true;
}

/** The stored lease's claims for this account, or null when absent, for
 *  another account, tampered or expired. A null account means identity cannot
 *  be confirmed right now (offline launch): the lease of the account that last
 *  stored one is used, since signing out removes it. */
export async function storedLease(account: string | null, now = clockNow()): Promise<LeaseClaims | null> {
  try {
    const value = JSON.parse(localStorage.getItem(LEASE_STORAGE_KEY) ?? 'null') as { lease?: string; account?: string } | null;
    if (!value?.lease || (account !== null && value.account !== account)) return null;
    return await verifyLease(value.lease, now);
  } catch { return null; }
}

/** The account a stored lease was kept for, or null when none is stored. */
export function storedLeaseAccount(): string | null {
  try {
    const value = JSON.parse(localStorage.getItem(LEASE_STORAGE_KEY) ?? 'null') as { account?: string } | null;
    return typeof value?.account === 'string' ? value.account : null;
  } catch { return null; }
}

export function clearLease(): void {
  try { localStorage.removeItem(LEASE_STORAGE_KEY); } catch { /* nothing stored */ }
}
