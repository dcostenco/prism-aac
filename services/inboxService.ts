/**
 * AAC Inbox poller — surfaces incoming messages from connected providers
 * (Telegram / WhatsApp / Viber / SMS / Messenger / Instagram / Mail) onto
 * the AAC user's calendar/schedule, formatted as "Mom: hi what's up".
 *
 * Why polling and not SSE/websockets:
 *   - AAC tablets are often on flaky school/clinic Wi-Fi where long-lived
 *     connections are dropped silently. Short polls survive that better
 *     and don't strand the UI in a "connected but no traffic" limbo.
 *   - Providers webhook into the Synalux portal; the portal queues per
 *     account. The AAC client just needs to drain its queue when online.
 *
 * Endpoint contract (synalux-private side, TBD if not yet shipped):
 *   GET /api/v1/prism-aac/inbox/poll?since=<ms>
 *   →   { messages: Array<{ id: string; sender: string; text: string;
 *                           provider: string; receivedAt: number }>,
 *         serverTime: number }
 *
 * Behavior on missing/erroring endpoint:
 *   - 404 / network error: silently no-op (endpoint not shipped yet, or
 *     offline). The user is unaffected; we retry on next tick.
 *   - 401: stop polling until reauth (handled upstream by authStore).
 */
import { useScheduleStore } from '@/store/scheduleStore';
import { useAuthStore } from '@/store/authStore';
import { useSettingsStore } from '@/store/settingsStore';
import { portalFetch } from '@/services/portalClient';
import { sanitizeString, SAFE_LIMITS } from '@/lib/safeStrings';
import { reportSwallowedError } from '@/lib/devLog';
import { playTimerRing } from '@/services/feedback';

const reportPollerError = reportSwallowedError('inboxService.pollOnce');

const LAST_SEEN_KEY = 'prism-aac-inbox-last-seen-ms';
const POLL_INTERVAL_MS = 30_000;
const POLL_TIMEOUT_MS = 8_000;
// Path is portal-relative; portalFetch prepends the SYNALUX_API base.
// Note: the leading /api/v1 is part of the base, not this path.
const ENDPOINT = '/prism-aac/inbox/poll';
/** Hard cap per poll — if the portal queue ballooned to thousands, drain
 *  in batches rather than locking up the UI dispatching them all at once.
 *  Older messages will roll forward via lastSeenMs on subsequent polls. */
const MAX_MESSAGES_PER_POLL = 50;
/** Reject `since` values from localStorage that are obviously bogus
 *  (negative, NaN, > now+1d). Stops a tampered key from sending huge
 *  numeric strings up to the portal. */
const MAX_SINCE_MS = () => Date.now() + 24 * 60 * 60 * 1000;

export interface IncomingMessage {
  id: string;
  sender: string;
  text: string;
  provider?: string;
  receivedAt?: number;
}

/** Apply one incoming message to the schedule. Exposed so future
 *  webhook/SSE listeners can route through the same dedupe + format
 *  path the poller uses. Safe to call from anywhere on the client. */
export function deliverIncomingMessage(msg: IncomingMessage): string | null {
  const sender = sanitizeString(msg?.sender, SAFE_LIMITS.name);
  const text = sanitizeString(msg?.text, SAFE_LIMITS.messageText);
  if (!sender || !text) return null;
  const rawId = sanitizeString(msg?.id, SAFE_LIMITS.externalId);
  const id = rawId.length > 0 ? rawId : undefined;
  return useScheduleStore.getState().addIncomingMessage(sender, text, id);
}

function getLastSeenMs(): number {
  if (typeof window === 'undefined') return 0;
  const raw = window.localStorage.getItem(LAST_SEEN_KEY);
  const n = raw ? parseInt(raw, 10) : 0;
  if (!Number.isFinite(n) || n < 0 || n > MAX_SINCE_MS()) return 0;
  return n;
}

function setLastSeenMs(ms: number) {
  if (typeof window === 'undefined') return;
  if (!Number.isFinite(ms) || ms < 0 || ms > MAX_SINCE_MS()) return;
  window.localStorage.setItem(LAST_SEEN_KEY, String(ms));
}

let pollInFlight = false;

async function pollOnce(): Promise<void> {
  // Single-flight: a slow poll under flaky wifi must not stack with the
  // next interval tick (pile of in-flight requests + duplicate delivery
  // attempts after the dedupe window).
  if (pollInFlight) return;
  // Skip the round-trip when the user isn't signed in. The endpoint is
  // session-cookie gated — without a session it returns 401 every poll,
  // wasting battery + filling logs. Re-authentication elsewhere triggers
  // authStore.refresh which restores polling on next interval.
  if (!useAuthStore.getState().profile) return;
  pollInFlight = true;
  try {
    const since = getLastSeenMs();
    const res = await portalFetch<{ messages?: unknown; serverTime?: unknown }>({
      path: `${ENDPOINT}?since=${since}`,
      timeoutMs: POLL_TIMEOUT_MS,
    });
    if (!res.ok) return; // 404 (not shipped), 401 (reauth), timeout — bail quietly
    const b = res.data;
    if (!b || typeof b !== 'object') return;
    const rawMessages = Array.isArray(b.messages) ? b.messages.slice(0, MAX_MESSAGES_PER_POLL) : [];
    let maxSeen = since;
    let deliveredThisBatch = 0;
    for (const m of rawMessages) {
      if (!m || typeof m !== 'object') continue;
      const msg = m as IncomingMessage;
      const id = deliverIncomingMessage(msg);
      if (id !== null) deliveredThisBatch += 1;
      const r = msg.receivedAt;
      if (typeof r === 'number' && Number.isFinite(r) && r > maxSeen && r <= MAX_SINCE_MS()) maxSeen = r;
    }
    // Per-poll alarm chime (NOT per-message — a 50-message backlog
    // would otherwise spam the AAC user with 50 chimes). Gated on the
    // notificationsEnabled setting (default true) so caregivers can
    // mute alarms in quiet contexts (school, sleeping). User
    // requirement 2026-05-07: "each new message will produce alarm".
    if (deliveredThisBatch > 0) {
      const notificationsEnabled = useSettingsStore.getState().notificationsEnabled ?? true;
      if (notificationsEnabled) {
        playTimerRing().catch(() => { /* AudioContext may be suspended pre-gesture */ });
      }
    }
    // Prefer serverTime over client clock to avoid clock-skew gaps.
    if (typeof b.serverTime === 'number' && Number.isFinite(b.serverTime) && b.serverTime > maxSeen) {
      maxSeen = Math.min(b.serverTime, MAX_SINCE_MS());
    }
    if (maxSeen > since) setLastSeenMs(maxSeen);
  } finally {
    pollInFlight = false;
  }
}

let intervalId: ReturnType<typeof setInterval> | null = null;
let onlineHandler: (() => void) | null = null;
let unsubscribeAuth: (() => void) | null = null;
/** Last profile email observed — when this flips (sign-out / account
 *  switch), we reset the saved `lastSeenMs` so the next poll for the
 *  new user doesn't miss messages older than the prior user's window.
 *  Also keys the "should we even poll" decision so we don't accidentally
 *  drain a stale session-cookie request. */
let lastObservedAccountKey: string | null = null;

function accountKey(profile: { email?: string } | null): string | null {
  return profile?.email ? profile.email.toLowerCase() : null;
}

function resetLastSeen(): void {
  if (typeof window === 'undefined') return;
  window.localStorage.removeItem(LAST_SEEN_KEY);
}

/** Start the inbox poller. Idempotent — calling twice is a no-op.
 *  Returns a stop function for use as a useEffect cleanup. */
export function startInboxPolling(): () => void {
  if (typeof window === 'undefined') return () => {};
  if (intervalId !== null) return stopInboxPolling;
  // Subscribe FIRST, then snapshot the account key, then drain — in
  // that order so an auth change happening between snapshot and
  // subscribe can't slip through and cause user B to inherit user A's
  // lastSeenMs. Order matters: subscribe registers the listener; the
  // snapshot is what subsequent changes are compared against.
  unsubscribeAuth = useAuthStore.subscribe((state) => {
    const next = accountKey(state.profile);
    if (next !== lastObservedAccountKey) {
      resetLastSeen();
      lastObservedAccountKey = next;
    }
  });
  lastObservedAccountKey = accountKey(useAuthStore.getState().profile);
  // Drain once on start so the user sees any backlog without a 30s wait.
  // `.catch` swallows unhandled promise rejections — pollOnce currently
  // can't throw (try/finally + portalFetch never throws), but a future
  // refactor that introduces a throw above the try would otherwise log
  // "unhandled promise rejection" to every browser console.
  pollOnce().catch(reportPollerError);
  intervalId = setInterval(() => { pollOnce().catch(reportPollerError); }, POLL_INTERVAL_MS);
  // When the device comes back online, drain immediately rather than
  // waiting up to 30s for the next interval — the most common case for
  // AAC users (tablet woke from sleep on the school bus).
  onlineHandler = () => { pollOnce().catch(reportPollerError); };
  window.addEventListener('online', onlineHandler);
  // Dev/QA hook: lets manual testing simulate inbound messages without
  // a live portal endpoint. Gated behind NODE_ENV !== 'production' so
  // it doesn't ship as an attack surface for browser-extension tampering
  // in production builds.
  if (process.env.NODE_ENV !== 'production') {
    (window as unknown as { __prismDeliverIncoming?: typeof deliverIncomingMessage })
      .__prismDeliverIncoming = deliverIncomingMessage;
  }
  return stopInboxPolling;
}

export function stopInboxPolling(): void {
  if (intervalId !== null) {
    clearInterval(intervalId);
    intervalId = null;
  }
  if (typeof window !== 'undefined' && onlineHandler) {
    window.removeEventListener('online', onlineHandler);
    onlineHandler = null;
  }
  if (unsubscribeAuth) {
    unsubscribeAuth();
    unsubscribeAuth = null;
  }
  lastObservedAccountKey = null;
  if (typeof window !== 'undefined' && process.env.NODE_ENV !== 'production') {
    delete (window as unknown as { __prismDeliverIncoming?: unknown }).__prismDeliverIncoming;
  }
}
