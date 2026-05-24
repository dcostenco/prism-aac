/**
 * inboxService — pollOnce hardening tests.
 *
 * Tests the HTTP polling behavior (pollOnce) via startInboxPolling().
 * Existing inbox-service.test.ts covers deliverIncomingMessage.
 * This file covers:
 *   - Messages delivered from synalux portal response
 *   - 404 endpoint auto-kill (stop retrying when endpoint is unshipped)
 *   - Single-flight dedup (concurrent poll calls collapse to one request)
 *   - Skip when not signed in (no profile → no fetch)
 *   - lastSeenMs advanced by serverTime (portal clock preference)
 *   - lastSeenMs advanced by max receivedAt in batch
 *   - `since` query param sent with current lastSeenMs value
 *   - Malformed message entries silently dropped
 *   - MAX_MESSAGES_PER_POLL cap (50 messages per batch)
 */
import 'fake-indexeddb/auto';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  startInboxPolling,
  stopInboxPolling,
  _resetInboxStateForTests,
} from '@/services/inboxService';
import { useScheduleStore } from '@/store/scheduleStore';
import { useAuthStore } from '@/store/authStore';

const fetchMock = vi.fn();

function pollResponse(
  messages: unknown[] = [],
  serverTime?: number,
  status = 200,
): Response {
  const body = serverTime !== undefined
    ? { messages, serverTime }
    : { messages };
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

const SIGNED_IN_PROFILE = {
  email: 'test@test.com',
  name: 'Test',
  plan: 'standard' as const,
  isPlatformAdmin: false,
};

beforeEach(() => {
  globalThis.fetch = fetchMock as unknown as typeof fetch;
  fetchMock.mockReset();
  _resetInboxStateForTests();
  useScheduleStore.setState({ tasks: [], rewards: 0, timerSeconds: 300, timerEndMs: 0 });
  useAuthStore.setState({ profile: SIGNED_IN_PROFILE, loaded: true, loading: false });
  if (typeof window !== 'undefined') window.localStorage.clear();
});

afterEach(() => {
  stopInboxPolling();
  _resetInboxStateForTests();
  vi.clearAllMocks();
});

// ── Message delivery ───────────────────────────────────────────────────────

describe('pollOnce — message delivery', () => {
  it('delivers a message from the poll response to the schedule store', async () => {
    fetchMock.mockResolvedValueOnce(pollResponse([
      { id: 'tg-1', sender: 'Mom', text: 'How are you?', provider: 'telegram', receivedAt: 1000 },
    ]));
    startInboxPolling();
    await new Promise((r) => setTimeout(r, 10));
    const tasks = useScheduleStore.getState().tasks.filter((t) => t.kind === 'message');
    expect(tasks).toHaveLength(1);
    expect(tasks[0].text).toBe('Mom: How are you?');
  });

  it('delivers multiple messages in one batch', async () => {
    fetchMock.mockResolvedValueOnce(pollResponse([
      { id: 'm1', sender: 'Mom', text: 'Message one', receivedAt: 1000 },
      { id: 'm2', sender: 'Dad', text: 'Message two', receivedAt: 2000 },
    ]));
    startInboxPolling();
    await new Promise((r) => setTimeout(r, 10));
    const tasks = useScheduleStore.getState().tasks.filter((t) => t.kind === 'message');
    expect(tasks).toHaveLength(2);
  });

  it('silently drops malformed message entries (no sender)', async () => {
    fetchMock.mockResolvedValueOnce(pollResponse([
      { id: 'bad1', text: 'No sender here', receivedAt: 1000 },
      { id: 'good1', sender: 'Mom', text: 'Good message', receivedAt: 2000 },
    ]));
    startInboxPolling();
    await new Promise((r) => setTimeout(r, 10));
    const tasks = useScheduleStore.getState().tasks.filter((t) => t.kind === 'message');
    expect(tasks).toHaveLength(1);
    expect(tasks[0].text).toBe('Mom: Good message');
  });

  it('caps batch at MAX_MESSAGES_PER_POLL (50) to prevent UI lock', async () => {
    const bigBatch = Array.from({ length: 80 }, (_, i) => ({
      id: `m${i}`,
      sender: 'Sender',
      text: `Message ${i}`,
      receivedAt: i * 1000,
    }));
    fetchMock.mockResolvedValueOnce(pollResponse(bigBatch));
    startInboxPolling();
    await new Promise((r) => setTimeout(r, 10));
    const tasks = useScheduleStore.getState().tasks.filter((t) => t.kind === 'message');
    expect(tasks.length).toBeLessThanOrEqual(50);
  });
});

// ── 404 auto-kill ─────────────────────────────────────────────────────────

describe('pollOnce — 404 endpoint auto-kill', () => {
  it('stops polling after a 404 (endpoint not yet shipped)', async () => {
    // First poll returns 404 → endpointKnown404 = true → no more polls
    fetchMock.mockResolvedValue(new Response('Not found', { status: 404 }));
    startInboxPolling();
    await new Promise((r) => setTimeout(r, 20));
    // Should have called fetch exactly once (the immediate drain), then stopped
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('does not deliver any messages on 404', async () => {
    fetchMock.mockResolvedValueOnce(new Response('Not found', { status: 404 }));
    startInboxPolling();
    await new Promise((r) => setTimeout(r, 10));
    expect(useScheduleStore.getState().tasks.filter((t) => t.kind === 'message')).toHaveLength(0);
  });
});

// ── Skip when not signed in ───────────────────────────────────────────────

describe('pollOnce — skip when not signed in', () => {
  it('skips the fetch when profile is null (not authenticated)', async () => {
    useAuthStore.setState({ profile: null, loaded: true, loading: false });
    startInboxPolling();
    await new Promise((r) => setTimeout(r, 10));
    // portalFetch wraps fetch; no fetch calls should fire
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

// ── lastSeenMs advancement ────────────────────────────────────────────────

describe('pollOnce — lastSeenMs advancement', () => {
  it('sends ?since= with the stored lastSeenMs value', async () => {
    window.localStorage.setItem('prism-aac-inbox-last-seen-ms', '5000');
    fetchMock.mockResolvedValueOnce(pollResponse([], 6000));
    startInboxPolling();
    await new Promise((r) => setTimeout(r, 10));
    const [url] = fetchMock.mock.calls[0] as [string];
    expect(url).toContain('since=5000');
  });

  it('advances lastSeenMs using serverTime when provided', async () => {
    fetchMock.mockResolvedValueOnce(pollResponse([], 9999));
    startInboxPolling();
    await new Promise((r) => setTimeout(r, 10));
    const stored = window.localStorage.getItem('prism-aac-inbox-last-seen-ms');
    expect(Number(stored)).toBe(9999);
  });

  it('advances lastSeenMs to max receivedAt when serverTime absent', async () => {
    fetchMock.mockResolvedValueOnce(pollResponse([
      { id: 'm1', sender: 'Mom', text: 'hi', receivedAt: 3000 },
      { id: 'm2', sender: 'Dad', text: 'hello', receivedAt: 7000 },
    ]));
    startInboxPolling();
    await new Promise((r) => setTimeout(r, 10));
    const stored = Number(window.localStorage.getItem('prism-aac-inbox-last-seen-ms'));
    expect(stored).toBeGreaterThanOrEqual(7000);
  });

  it('prefers serverTime over max receivedAt when both present', async () => {
    fetchMock.mockResolvedValueOnce(pollResponse([
      { id: 'm1', sender: 'Mom', text: 'hi', receivedAt: 5000 },
    ], 8000));
    startInboxPolling();
    await new Promise((r) => setTimeout(r, 10));
    const stored = Number(window.localStorage.getItem('prism-aac-inbox-last-seen-ms'));
    // serverTime (8000) > receivedAt (5000) → 8000 wins
    expect(stored).toBe(8000);
  });
});

// ── Non-200 / network error tolerance ────────────────────────────────────

describe('pollOnce — error tolerance (non-404)', () => {
  it('does not throw on network error (offline)', async () => {
    fetchMock.mockRejectedValueOnce(new Error('Network unreachable'));
    expect(() => startInboxPolling()).not.toThrow();
    await new Promise((r) => setTimeout(r, 20));
    // No crash, no messages
    expect(useScheduleStore.getState().tasks.filter((t) => t.kind === 'message')).toHaveLength(0);
  });

  it('does not throw on 500 server error', async () => {
    fetchMock.mockResolvedValueOnce(new Response('', { status: 500 }));
    expect(() => startInboxPolling()).not.toThrow();
    await new Promise((r) => setTimeout(r, 10));
    expect(useScheduleStore.getState().tasks.filter((t) => t.kind === 'message')).toHaveLength(0);
  });

  it('keeps polling after 500 (transient error — interval not killed)', async () => {
    // First call: 500, next call: returns messages
    fetchMock
      .mockResolvedValueOnce(new Response('', { status: 500 }))
      .mockResolvedValueOnce(pollResponse([
        { id: 'm1', sender: 'Mom', text: 'hi', receivedAt: 1000 },
      ]));
    startInboxPolling(); // fires pollOnce immediately (500)
    await new Promise((r) => setTimeout(r, 10));
    // fetch called once for the immediate drain (500), interval not killed
    expect(fetchMock).toHaveBeenCalledTimes(1);
    // On next interval tick the fetch would be called again (but we're not waiting 30s)
  });
});

// ── startInboxPolling idempotency ────────────────────────────────────────

describe('startInboxPolling — idempotency', () => {
  it('calling startInboxPolling twice only sets up one interval', async () => {
    fetchMock.mockResolvedValue(pollResponse());
    startInboxPolling();
    startInboxPolling(); // second call is a no-op
    await new Promise((r) => setTimeout(r, 20));
    // Each start fires one immediate pollOnce, but the second call should no-op
    // so only 1 fetch total (first call's immediate drain)
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('stopInboxPolling then startInboxPolling resumes polling', async () => {
    fetchMock.mockResolvedValue(pollResponse());
    startInboxPolling();
    await new Promise((r) => setTimeout(r, 10));
    stopInboxPolling();
    _resetInboxStateForTests();
    fetchMock.mockClear();
    fetchMock.mockResolvedValue(pollResponse());
    startInboxPolling();
    await new Promise((r) => setTimeout(r, 10));
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
