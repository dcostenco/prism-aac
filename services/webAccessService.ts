import { SYNALUX_API, timeoutSignal } from '@/lib/portalConfig';

export interface WebAccess {
  state: 'disabled' | 'signed_in' | 'preview' | 'sign_in_required';
  remainingMs: number;
}
const ACCESS_STATES = new Set(['disabled', 'signed_in', 'preview', 'sign_in_required']);
const ACCESS_ERROR = 'Sign-in status could not be checked. Please reconnect and try again.';
const MAX_PREVIEW_MS = 60_000;
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

export async function fetchWebAccess(): Promise<WebAccess> {
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
    return { state: value.state, remainingMs: Math.max(0, value.remainingMs - (performance.now() - started)) };
  } finally { timeout.cancel(); }
}
