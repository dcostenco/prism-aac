import { SYNALUX_API, timeoutSignal } from '@/lib/portalConfig';
import { usePaidPlanStore } from '@/store/paidPlanStore';

/** The server's paid-plan entitlement for the signed-in account. It is sent
 *  only while the paid-plan policy is in force, so it is optional. */
export interface AacEntitlement {
  state: 'included' | 'beta' | 'paid' | 'grace' | 'pre_cutover_free' | 'expired' | 'none';
  /** Grace end, cutover time or period end; null when permanent or unknown. */
  accessUntil: string | null;
  policyVersion: string;
}

export interface WebAccess {
  state: 'disabled' | 'signed_in' | 'preview' | 'sign_in_required';
  remainingMs: number;
  entitlement?: AacEntitlement;
  /** Offline lease (compact JWS), verified by services/aacLease before use. */
  lease?: string;
  /** The server's paid-only policy is in force (sent signed in or not). */
  paidPlan?: boolean;
  /** The server sent an entitlement this build cannot read (a newer state,
   *  say). The lock fails open on it rather than locking a paying account. */
  entitlementUnreadable?: boolean;
}

const ENTITLEMENT_STATES = new Set(['included', 'beta', 'paid', 'grace', 'pre_cutover_free', 'expired', 'none']);

/** A well-formed entitlement, or undefined: a malformed one is ignored, never trusted. */
function readEntitlement(value: unknown): AacEntitlement | undefined {
  if (!value || typeof value !== 'object') return undefined;
  const { state, accessUntil, policyVersion } = value as Record<string, unknown>;
  if (typeof state !== 'string' || !ENTITLEMENT_STATES.has(state) || typeof policyVersion !== 'string') return undefined;
  if (accessUntil !== null && (typeof accessUntil !== 'string' || !Number.isFinite(Date.parse(accessUntil)))) return undefined;
  return { state: state as AacEntitlement['state'], accessUntil, policyVersion };
}
const ACCESS_STATES = new Set(['disabled', 'signed_in', 'preview', 'sign_in_required']);
const ACCESS_ERROR = 'Sign-in status could not be checked. Please reconnect and try again.';
// Validation bound for the public response contract, never Cloud authorization.
const MAX_PREVIEW_MS = 10 * 60_000;
export const LOCAL_ACCESS_KEY = 'prism-aac-verified-local-access';
export const LOCAL_ACCESS_CLEARED = 'prismAacLocalAccessCleared';
let verifiedInMemory = false;

/** Local communication continuity only. Never an authentication/cloud credential. */
export function hasVerifiedLocalAccess(): boolean {
  try { return verifiedInMemory || localStorage.getItem(LOCAL_ACCESS_KEY) === '1'; }
  catch { return verifiedInMemory; }
}

export function rememberVerifiedLocalAccess() {
  verifiedInMemory = true;
  try { localStorage.setItem(LOCAL_ACCESS_KEY, '1'); } catch { /* Keep this session usable if storage is unavailable. */ }
}

export function clearVerifiedLocalAccess(notify = true) {
  verifiedInMemory = false;
  try { localStorage.removeItem(LOCAL_ACCESS_KEY); } catch { /* Memory continuity has also been revoked. */ }
  if (notify && typeof window !== 'undefined') window.dispatchEvent(new Event(LOCAL_ACCESS_CLEARED));
}

let inFlight: Promise<WebAccess> | null = null;

/** One request at a time: the sign-in gate and the paid-plan notice both check
 *  on focus and every five minutes, and same-tick calls share one answer.
 *  `fresh` never reuses a request that started earlier: after a purchase, an
 *  answer asked for before it landed would be stale. */
export function fetchWebAccess(options: { fresh?: boolean } = {}): Promise<WebAccess> {
  if (options.fresh && inFlight) return inFlight.then(() => undefined, () => undefined).then(() => fetchWebAccess());
  inFlight ??= requestWebAccess().finally(() => { inFlight = null; });
  return inFlight;
}

async function requestWebAccess(): Promise<WebAccess> {
  const timeout = timeoutSignal(10_000);
  const started = performance.now();
  try {
    const response = await fetch(`${SYNALUX_API}/prism-aac/access`, {
      credentials: 'include', cache: 'no-store', signal: timeout.signal,
    });
    if (!response.ok) throw new Error(ACCESS_ERROR);
    const value = await response.json();
    if (!ACCESS_STATES.has(value?.state) || !Number.isFinite(value.remainingMs)
      || value.remainingMs < 0 || value.remainingMs > MAX_PREVIEW_MS) throw new Error(ACCESS_ERROR);
    const entitlement = readEntitlement(value.entitlement);
    usePaidPlanStore.getState().setActive(value.paidPlan === true);
    const lease = entitlement && typeof value.lease === 'string' && /^[\w-]+\.[\w-]+\.[\w-]+$/.test(value.lease)
      ? value.lease : undefined;
    const unreadable = !entitlement && value.entitlement !== undefined && value.entitlement !== null;
    return { state: value.state, remainingMs: Math.max(0, value.remainingMs - (performance.now() - started)),
      ...(entitlement ? { entitlement } : {}), ...(lease ? { lease } : {}), ...(value.paidPlan === true ? { paidPlan: true } : {}),
      ...(unreadable ? { entitlementUnreadable: true } : {}) };
  } finally { timeout.cancel(); }
}
