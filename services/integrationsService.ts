'use client';
/**
 * Integrations service — lets the AAC user (or caregiver) connect
 * messaging + mail providers DIRECTLY from PrismAAC settings, instead
 * of bouncing them to synalux.ai/chat. The OAuth round-trip still has
 * to land on synalux.ai (that's where the redirect URIs are
 * registered), but we open it in a popup so the user never browses
 * the portal UI.
 *
 * Flow:
 *   1. listIntegrations()       — GET /api/v1/chat/providers (chat)
 *                                 + a synthetic mail-provider list
 *                                 (Gmail, Outlook). Server resolves
 *                                 chat status; mail status comes from
 *                                 the user_oauth_grants table the
 *                                 portal already maintains.
 *   2. connectProvider(p)       — opens window.open(connectUrl) on
 *                                 synalux.ai. We poll window.closed,
 *                                 then re-fetch status + sync contacts.
 *                                 On success we emit a same-origin
 *                                 BroadcastChannel event so other
 *                                 synalux app tabs (mail, calendar,
 *                                 chat) refresh immediately.
 *   3. disconnectProvider(p)    — POST /api/v1/oauth/disconnect on
 *                                 the portal (when wired); local
 *                                 fallback otherwise.
 *
 * Cross-origin caveat: BroadcastChannel only spans tabs of the SAME
 * origin. PrismAAC at synalux.ai/prism-aac is same-origin with the
 * portal and gets the broadcast for free. The Vercel deploy at
 * prism-aac.vercel.app is a different origin and won't bridge — that
 * needs a server-side SSE channel which is out of this round's scope.
 */
import { portalFetch } from '@/services/portalClient';
import { SYNALUX_PORTAL_ORIGIN } from '@/lib/portalConfig';

// OAuth connect URLs live at the canonical portal root, not under the
// preview-safe API proxy used by data requests.
const SYNALUX_BASE = SYNALUX_PORTAL_ORIGIN;
import { syncContactsOnce } from '@/services/contactsIntegrationService';
import { playTimerRing } from '@/services/feedback';

export type IntegrationKind = 'chat' | 'mail';
export type IntegrationStatus = 'connected' | 'available' | 'planned';
export type IntegrationAuth = 'oauth2' | 'login-widget' | 'phone-otp' | 'business-api';

export interface IntegrationProvider {
  id: string;
  label: string;
  icon: string;
  color?: string;
  kind: IntegrationKind;
  status: IntegrationStatus;
  auth: IntegrationAuth;
  /** Absolute URL on synalux.ai that starts the OAuth dance. */
  connectUrl?: string;
  /** Why it isn't shipped yet, when status === 'planned'. */
  plannedNote?: string;
}

const BROADCAST_CHANNEL_NAME = 'synalux-integrations';
/** Same-origin broadcast — used so other open synalux app tabs (mail,
 *  calendar, chat) refresh their integration status the instant a
 *  PrismAAC user finishes a connect popup. Cross-origin tabs (e.g.
 *  prism-aac.vercel.app) won't see this; they need SSE follow-up. */
function getBroadcastChannel(): BroadcastChannel | null {
  if (typeof BroadcastChannel === 'undefined') return null;
  try {
    return new BroadcastChannel(BROADCAST_CHANNEL_NAME);
  } catch {
    return null;
  }
}

let broadcastChannelSingleton: BroadcastChannel | null = null;
function bc(): BroadcastChannel | null {
  if (broadcastChannelSingleton === null) broadcastChannelSingleton = getBroadcastChannel();
  return broadcastChannelSingleton;
}

interface BroadcastEvent {
  type: 'provider-connected' | 'provider-disconnected' | 'provider-refreshed';
  provider: string;
  scope?: string;
  at: number;
}

export function broadcastIntegrationEvent(ev: BroadcastEvent): void {
  const ch = bc();
  if (!ch) return;
  try { ch.postMessage(ev); } catch { /* */ }
}

export function subscribeToIntegrationEvents(
  handler: (ev: BroadcastEvent) => void,
): () => void {
  const ch = bc();
  if (!ch) return () => {};
  const VALID_BC_TYPES = new Set(['provider-connected', 'provider-disconnected', 'provider-refreshed']);
  const listener = (e: MessageEvent) => {
    if (!e?.data || typeof e.data.type !== 'string' || !VALID_BC_TYPES.has(e.data.type)) return;
    if (typeof e.data.provider !== 'string' || e.data.provider.length > 100 || !e.data.provider) return;
    handler(e.data as BroadcastEvent);
  };
  ch.addEventListener('message', listener);
  return () => ch.removeEventListener('message', listener);
}

// ── Provider list ─────────────────────────────────────────────────

interface RawChatProvider {
  id: string;
  label: string;
  icon: string;
  color?: string;
  status: IntegrationStatus;
  auth: IntegrationAuth;
  connectUrl?: string;
  plannedNote?: string;
}

/** Mail providers — synthetic. Status starts 'available'; the
 *  loader below overlays 'connected' from /api/v1/integrations/grants
 *  so the row matches what's actually in user_oauth_grants. Without
 *  this overlay the Connect button stays visible forever even after
 *  the OAuth callback successfully persisted the grant. */
const MAIL_PROVIDERS: IntegrationProvider[] = [
  {
    id: 'google-gmail',
    label: 'Gmail',
    icon: '✉️',
    color: '#EA4335',
    kind: 'mail',
    status: 'available',
    auth: 'oauth2',
    connectUrl: '/api/auth/connect/google?scope=gmail',
  },
  {
    id: 'microsoft-mail',
    label: 'Outlook',
    icon: '📧',
    color: '#0078D4',
    kind: 'mail',
    status: 'available',
    auth: 'oauth2',
    connectUrl: '/api/auth/connect/microsoft?scope=mail',
  },
];

interface GrantRow {
  provider: string;
  scope: string;
  expired: boolean;
}

/**
 * Map a (provider, scope-string) grant onto a MAIL_PROVIDERS id.
 * The OAuth callback stores the raw scope returned by the provider
 * (e.g. Google returns
 * 'https://www.googleapis.com/auth/gmail.modify openid email …'),
 * so we substring-match on the canonical scope token rather than
 * comparing against the resolved scopes.gmail string verbatim
 * (Google reorders + adds openid scopes server-side).
 */
function grantMatchesMailProvider(grant: GrantRow, mailProviderId: string): boolean {
  if (grant.expired) return false;
  if (mailProviderId === 'google-gmail') {
    return grant.provider === 'google' && /gmail\./i.test(grant.scope);
  }
  if (mailProviderId === 'microsoft-mail') {
    return grant.provider === 'microsoft' && /\bMail\./i.test(grant.scope);
  }
  return false;
}

export async function listIntegrations(): Promise<IntegrationProvider[]> {
  const out: IntegrationProvider[] = [];

  // Chat providers — server-resolved status.
  const res = await portalFetch<{ providers?: RawChatProvider[] }>({
    path: '/chat/providers',
    timeoutMs: 6000,
  });
  if (res.ok && res.data && Array.isArray(res.data.providers)) {
    for (const p of res.data.providers) {
      out.push({
        id: p.id,
        label: p.label,
        icon: p.icon,
        color: p.color,
        kind: 'chat',
        status: p.status,
        auth: p.auth,
        connectUrl: absolutize(p.connectUrl),
        plannedNote: p.plannedNote,
      });
    }
  }

  // Mail providers — overlay 'connected' from the user's grant matrix.
  // /api/v1/integrations/grants returns one row per (provider, scope)
  // the user has authorized; we map those to MAIL_PROVIDERS ids via
  // grantMatchesMailProvider. The endpoint is metadata-only (no tokens),
  // so calling it on every settings open is cheap and safe.
  let grants: GrantRow[] = [];
  const grantsRes = await portalFetch<{ grants?: GrantRow[] }>({
    path: '/integrations/grants',
    timeoutMs: 6000,
  });
  if (grantsRes.ok && grantsRes.data && Array.isArray(grantsRes.data.grants)) {
    grants = grantsRes.data.grants;
  }

  for (const m of MAIL_PROVIDERS) {
    const isConnected = grants.some((g) => grantMatchesMailProvider(g, m.id));
    out.push({
      ...m,
      status: isConnected ? 'connected' : 'available',
      connectUrl: absolutize(m.connectUrl),
    });
  }

  return out;
}

function absolutize(path?: string): string | undefined {
  if (!path) return undefined;
  if (/^https?:\/\//i.test(path)) return path;
  // SYNALUX_BASE is the portal origin (e.g. https://synalux.ai). The
  // chat/providers endpoint returns site-relative paths.
  const base = SYNALUX_BASE.replace(/\/$/, '');
  return `${base}${path.startsWith('/') ? '' : '/'}${path}`;
}

// ── Connect flow (popup) ──────────────────────────────────────────

export interface ConnectResult {
  ok: boolean;
  reason?: 'popup-blocked' | 'popup-closed-without-success' | 'no-connect-url';
}

const POPUP_FEATURES = 'width=520,height=700,left=200,top=120,scrollbars=yes,resizable=yes';
/** How often we poll window.closed inside the popup loop. */
const POPUP_POLL_MS = 500;
/** Hard cap on the popup wait so we don't leak a timer if the user
 *  navigates away without closing the window. */
const POPUP_MAX_WAIT_MS = 10 * 60 * 1000; // 10 min

/**
 * Open the OAuth popup synchronously, the moment the user clicks.
 * Call this FIRST, in the same JS turn as the click event — Safari
 * (especially iOS Safari on iPad) revokes the user-gesture token
 * after any await/microtask, so opening the popup later returns
 * null silently. Returns the popup window or null if blocked.
 *
 * After this returns, pass the popup to connectProvider() which
 * will navigate it to the OAuth URL and poll for close.
 */
export function openConnectPopup(): Window | null {
  if (typeof window === 'undefined') return null;
  // Open about:blank synchronously — the actual auth URL gets
  // navigated below from connectProvider(). This split is the
  // standard popup-OAuth pattern that works across Safari/Chrome/
  // Firefox + iOS/iPadOS.
  const popup = window.open('about:blank', 'synalux-connect', POPUP_FEATURES);
  // Bring it to front. iPad Safari opens new tabs in the background
  // by default; without focus() the user often doesn't realize the
  // popup opened and reports "nothing happened".
  try { popup?.focus(); } catch { /* */ }
  return popup;
}

export async function connectProvider(
  provider: IntegrationProvider,
  preopenedPopup?: Window | null,
): Promise<ConnectResult> {
  if (typeof window === 'undefined') return { ok: false, reason: 'no-connect-url' };
  if (!provider.connectUrl) return { ok: false, reason: 'no-connect-url' };

  // Append a return marker so synalux's connect-callback can close
  // the popup by navigating to a "done" page that calls window.close().
  // Synalux's existing callback honors `?return=` and appends
  // ?connected=1&provider=&scope=.
  //
  // CRITICAL: send a RELATIVE path, not an absolute URL. Synalux's
  // sanitizeReturnTo() rejects anything not starting with '/' as a
  // security guard against open-redirect attacks (see
  // synalux-platform/portal/src/lib/oauth-providers.ts) — passing an
  // absolute URL like 'https://synalux.ai/...' silently falls back
  // to /dashboard, leaving the popup on the synalux dashboard
  // forever. The popup never calls window.close(), prism-aac waits
  // 10 min for window.closed, and every Connect button stays
  // disabled the whole time.
  const url = new URL(provider.connectUrl, SYNALUX_BASE || undefined);
  if (SYNALUX_BASE) {
    try {
      const expectedOrigin = new URL(SYNALUX_BASE).origin;
      if (url.origin !== expectedOrigin) {
        return { ok: false, reason: 'no-connect-url' };
      }
    } catch {
      return { ok: false, reason: 'no-connect-url' };
    }
  }
  if (!url.searchParams.has('return')) {
    url.searchParams.set('return', '/integrations/connect-done');
  }

  // If the caller pre-opened a popup synchronously (recommended on
  // iPad Safari to preserve user-gesture context), navigate it to
  // the auth URL. Otherwise open one now — works on most desktops
  // but blocked on iOS Safari when called after an await.
  let popup: Window | null;
  if (preopenedPopup && !preopenedPopup.closed) {
    try {
      preopenedPopup.location.href = url.toString();
      popup = preopenedPopup;
    } catch {
      // SecurityError if the about:blank already cross-origin'd somehow
      popup = window.open(url.toString(), 'synalux-connect', POPUP_FEATURES);
    }
  } else {
    popup = window.open(url.toString(), 'synalux-connect', POPUP_FEATURES);
  }
  if (!popup) return { ok: false, reason: 'popup-blocked' };
  try { popup.focus(); } catch { /* */ }

  // Poll for close. On close, re-fetch status + sync contacts. We
  // can't read the popup's URL across origins, so we infer success
  // by checking whether the user's connected-providers list grew.
  const before = await listIntegrations();
  const beforeConnected = new Set(before.filter(p => p.status === 'connected').map(p => p.id));

  const closedAt = await waitForWindowClose(popup);
  if (!closedAt) return { ok: false, reason: 'popup-closed-without-success' };

  const after = await listIntegrations();
  const nowConnected = after.find(
    (p) => p.status === 'connected' && !beforeConnected.has(p.id),
  );

  if (nowConnected) {
    // Notify all same-origin synalux tabs so mail/calendar/chat
    // surfaces refresh their connect cards.
    broadcastIntegrationEvent({
      type: 'provider-connected',
      provider: nowConnected.id,
      at: Date.now(),
    });
    // Pull the caregiver's contacts now that a new provider is wired.
    await syncContactsOnce().catch(() => null);
    // Audible chime so the caregiver knows the connect actually
    // succeeded — important on tablets where the popup might close
    // off-screen and the user is left wondering.
    playTimerRing().catch(() => { /* */ });
    return { ok: true };
  }
  return { ok: false, reason: 'popup-closed-without-success' };
}

function waitForWindowClose(popup: Window): Promise<number | null> {
  return new Promise((resolve) => {
    const start = Date.now();
    const tick = setInterval(() => {
      if (popup.closed) {
        clearInterval(tick);
        resolve(Date.now());
        return;
      }
      if (Date.now() - start > POPUP_MAX_WAIT_MS) {
        clearInterval(tick);
        try { popup.close(); } catch { /* */ }
        resolve(null);
      }
    }, POPUP_POLL_MS);
  });
}

// ── Disconnect ────────────────────────────────────────────────────

export async function disconnectProvider(provider: IntegrationProvider): Promise<boolean> {
  const res = await portalFetch<{ ok?: boolean }>({
    path: `/oauth/disconnect/${encodeURIComponent(provider.id)}`,
    method: 'POST',
    timeoutMs: 6000,
  });
  if (res.ok && res.data?.ok) {
    broadcastIntegrationEvent({
      type: 'provider-disconnected',
      provider: provider.id,
      at: Date.now(),
    });
    return true;
  }
  return false;
}
