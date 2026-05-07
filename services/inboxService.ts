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
import { portalFetch } from '@/services/portalClient';

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
/** Hard caps on payload fields — defense against a compromised portal or
 *  developer mistake injecting absurdly long strings into the schedule
 *  task list (which is rendered as plain text by React, but would still
 *  destroy the layout / blow up persistence). */
const MAX_SENDER_LEN = 80;
const MAX_TEXT_LEN = 2000;
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

function sanitizeStr(s: unknown, maxLen: number): string {
  if (typeof s !== 'string') return '';
  // Strip ASCII control chars that could break the schedule row's
  // single-line rendering. Trim then clamp.
  // eslint-disable-next-line no-control-regex
  const clean = s.replace(/[\u0000-\u001f\u007f]/g, ' ').trim();
  return clean.length > maxLen ? clean.slice(0, maxLen) : clean;
}

/** Apply one incoming message to the schedule. Exposed so future
 *  webhook/SSE listeners can route through the same dedupe + format
 *  path the poller uses. Safe to call from anywhere on the client. */
export function deliverIncomingMessage(msg: IncomingMessage): string | null {
  const sender = sanitizeStr(msg?.sender, MAX_SENDER_LEN);
  const text = sanitizeStr(msg?.text, MAX_TEXT_LEN);
  if (!sender || !text) return null;
  const id = typeof msg?.id === 'string' && msg.id.length > 0 && msg.id.length <= 128
    ? msg.id
    : undefined;
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
    for (const m of rawMessages) {
      if (!m || typeof m !== 'object') continue;
      const msg = m as IncomingMessage;
      deliverIncomingMessage(msg);
      const r = msg.receivedAt;
      if (typeof r === 'number' && Number.isFinite(r) && r > maxSeen && r <= MAX_SINCE_MS()) maxSeen = r;
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

/** Start the inbox poller. Idempotent — calling twice is a no-op.
 *  Returns a stop function for use as a useEffect cleanup. */
export function startInboxPolling(): () => void {
  if (typeof window === 'undefined') return () => {};
  if (intervalId !== null) return stopInboxPolling;
  // Drain once on start so the user sees any backlog without a 30s wait.
  void pollOnce();
  intervalId = setInterval(() => { void pollOnce(); }, POLL_INTERVAL_MS);
  // When the device comes back online, drain immediately rather than
  // waiting up to 30s for the next interval — the most common case for
  // AAC users (tablet woke from sleep on the school bus).
  onlineHandler = () => { void pollOnce(); };
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
  if (typeof window !== 'undefined' && process.env.NODE_ENV !== 'production') {
    delete (window as unknown as { __prismDeliverIncoming?: unknown }).__prismDeliverIncoming;
  }
}
