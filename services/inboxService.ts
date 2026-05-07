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

const LAST_SEEN_KEY = 'prism-aac-inbox-last-seen-ms';
const POLL_INTERVAL_MS = 30_000;
const ENDPOINT = '/api/v1/prism-aac/inbox/poll';

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
  const sender = (msg.sender || '').trim();
  const text = (msg.text || '').trim();
  if (!sender || !text) return null;
  return useScheduleStore.getState().addIncomingMessage(sender, text, msg.id);
}

function getLastSeenMs(): number {
  if (typeof window === 'undefined') return 0;
  const raw = window.localStorage.getItem(LAST_SEEN_KEY);
  const n = raw ? parseInt(raw, 10) : 0;
  return Number.isFinite(n) ? n : 0;
}

function setLastSeenMs(ms: number) {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(LAST_SEEN_KEY, String(ms));
}

async function pollOnce(): Promise<void> {
  if (typeof navigator !== 'undefined' && navigator.onLine === false) return;
  const since = getLastSeenMs();
  let res: Response;
  try {
    res = await fetch(`${ENDPOINT}?since=${since}`, {
      credentials: 'include',
      headers: { Accept: 'application/json' },
    });
  } catch {
    return; // network blip — retry next tick
  }
  if (!res.ok) return; // 404 (not shipped), 401 (reauth), 5xx — bail quietly
  let body: { messages?: IncomingMessage[]; serverTime?: number };
  try {
    body = await res.json();
  } catch {
    return;
  }
  const messages = Array.isArray(body.messages) ? body.messages : [];
  let maxSeen = since;
  for (const m of messages) {
    deliverIncomingMessage(m);
    if (m.receivedAt && m.receivedAt > maxSeen) maxSeen = m.receivedAt;
  }
  // Prefer serverTime over client clock to avoid clock-skew gaps.
  if (typeof body.serverTime === 'number' && body.serverTime > maxSeen) {
    maxSeen = body.serverTime;
  }
  if (maxSeen > since) setLastSeenMs(maxSeen);
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
  // a live portal endpoint. Off-by-default in prod behavior since it
  // only fires when somebody calls the function from devtools.
  (window as unknown as { __prismDeliverIncoming?: typeof deliverIncomingMessage })
    .__prismDeliverIncoming = deliverIncomingMessage;
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
}
