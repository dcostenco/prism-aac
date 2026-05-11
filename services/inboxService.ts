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
import { useMessageStore } from '@/store/messageStore';
import { portalFetch } from '@/services/portalClient';
import { sanitizeString, SAFE_LIMITS } from '@/lib/safeStrings';
import { reportSwallowedError } from '@/lib/devLog';
import { playTimerRing } from '@/services/feedback';
import { aacSpeak } from '@/services/aacSpeak';

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

// Module-scoped flag — once we see a 404 from the polling endpoint
// (which is currently unshipped on the synalux portal), kill polling
// for the rest of this page session. The endpoint will start
// returning real data once shipped; until then, retrying every 30 s
// just floods the user's console with red 404 lines and produces
// nothing useful. (May 2026 user report: "it's freezing with same
// 400 errors" — 8x identical poll 404s in the console at once.)
let endpointKnown404 = false;

async function pollOnce(): Promise<void> {
  // Bail before any work if we've already learned this endpoint isn't
  // shipped — no fetch, no console noise.
  if (endpointKnown404) return;
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
    if (!res.ok) {
      // 404 → endpoint not shipped, kill the loop for this session so
      // we don't spam the user's console every 30 s. Other failures
      // (401 reauth, network timeout) are transient — keep polling.
      if (res.status === 404) {
        endpointKnown404 = true;
        if (intervalId !== null) {
          clearInterval(intervalId);
          intervalId = null;
        }
      }
      return;
    }
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
    // Per-poll announcement + chime. Gated on notificationsEnabled.
    // For ≤3 messages: speak each one ("New message from Mom: are you okay?")
    // For >3: speak a summary ("3 new messages") to avoid overwhelming the user.
    if (deliveredThisBatch > 0) {
      const { notificationsEnabled, speechRate, speechVolume } = useSettingsStore.getState();
      const { soundEnabled } = useMessageStore.getState();
      if (notificationsEnabled !== false && soundEnabled) {
        playTimerRing().catch(() => { /* AudioContext may be suspended pre-gesture */ });
        // Speak after a brief chime gap so TTS doesn't collide with the ring.
        const newMsgs = rawMessages
          .slice(0, deliveredThisBatch)
          .map((m) => m as IncomingMessage)
          .filter((m) => m.sender && m.text);
        // H10: Gate sender-name announcement on user preference (defaults to false for privacy)
        const announceSender = useSettingsStore.getState().announceSenderName ?? false;
        setTimeout(() => {
          let announcement: string;
          if (announceSender && newMsgs.length <= 3) {
            // Announce sender name only — body omitted for privacy (caregiver gate).
            // TODO(i18n): announcement string is hardcoded English — use a
            // translation lookup keyed on useSettingsStore.getState().language
            // once a t() helper is available in this service context.
            announcement = newMsgs
              .map((m) => {
                const sender = sanitizeString(m.sender, SAFE_LIMITS.name);
                // Speak first name only — limits social engineering via crafted sender names
                const firstName = (sender.split(/[\s,]/)[0] || sender).replace(/\d/g, '').slice(0, 20);
                return `New message from ${firstName}`;  // body removed for privacy; sanitizeString already handled escaping
              })
              .join('. ');
          } else if (newMsgs.length === 1) {
            // TODO(i18n): "new message received" string is hardcoded English.
            announcement = 'New message received';
          } else {
            // TODO(i18n): "new messages" string is hardcoded English.
            announcement = `${deliveredThisBatch} new messages`;
          }
          aacSpeak(announcement, speechRate, speechVolume);
        }, 800); // 800ms after chime
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
