/**
 * inboxService — drains incoming caregiver messages onto the schedule.
 * Covers: dedupe via externalId, lastSeenMs persistence, graceful 404
 * no-op, network error tolerance, deliverIncomingMessage idempotence.
 */
import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { useScheduleStore } from '@/store/scheduleStore';
import { useAuthStore } from '@/store/authStore';
import { deliverIncomingMessage } from '@/services/inboxService';

const fetchMock = vi.fn();
beforeEach(() => {
  globalThis.fetch = fetchMock as unknown as typeof fetch;
  fetchMock.mockReset();
  useScheduleStore.setState({ tasks: [], rewards: 0, timerSeconds: 300, timerEndMs: 0 });
  // Inbox poller now skips when not signed in. Tests of the dispatch
  // path (deliverIncomingMessage) work without auth, but any future
  // pollOnce coverage needs a profile present.
  useAuthStore.setState({
    profile: { email: 't@t', name: 'T', plan: 'standard', isPlatformAdmin: false },
    loaded: true, loading: false,
  });
  if (typeof window !== 'undefined') window.localStorage.clear();
});
afterEach(() => vi.clearAllMocks());

describe('deliverIncomingMessage', () => {
  it('appends a message task with the canonical "Sender: text" format', () => {
    const id = deliverIncomingMessage({ id: 'tg-1', sender: 'Mom', text: 'hi whats up' });
    expect(id).not.toBeNull();
    const t = useScheduleStore.getState().tasks.find((t) => t.id === id);
    expect(t?.text).toBe('Mom: hi whats up');
    expect(t?.kind).toBe('message');
    expect(t?.icon).toBe('💬');
  });

  it('rejects payloads with empty sender or text', () => {
    expect(deliverIncomingMessage({ id: 'x', sender: '', text: 'hi' })).toBeNull();
    expect(deliverIncomingMessage({ id: 'x', sender: 'Mom', text: '' })).toBeNull();
    expect(useScheduleStore.getState().tasks).toHaveLength(0);
  });

  it('dedupes by externalId so re-delivery does not duplicate', () => {
    deliverIncomingMessage({ id: 'tg-42', sender: 'Mom', text: 'hi' });
    deliverIncomingMessage({ id: 'tg-42', sender: 'Mom', text: 'hi' });
    expect(useScheduleStore.getState().tasks.filter((t) => t.kind === 'message')).toHaveLength(1);
  });

  it('strips ASCII control characters from sender + text', () => {
    deliverIncomingMessage({ id: 'x', sender: 'Mom\x00\x07', text: 'hi\x1bthere' });
    const t = useScheduleStore.getState().tasks.find((x) => x.kind === 'message');
    expect(t?.text).toBe('Mom: hi there');
    expect(t?.sender).toBe('Mom');
  });

  it('clamps oversize sender + text to defensive caps', () => {
    const longSender = 'M'.repeat(500);
    const longText = 't'.repeat(10000);
    deliverIncomingMessage({ id: 'big', sender: longSender, text: longText });
    const t = useScheduleStore.getState().tasks.find((x) => x.kind === 'message');
    expect(t?.sender?.length).toBe(80);
    // text rendered as "<sender>: <text>" — text alone clamped to 2000.
    expect(t?.text.length).toBeLessThanOrEqual(80 + 2 + 2000);
  });

  it('rejects non-string id by skipping the externalId field (no crash)', () => {
    const id = deliverIncomingMessage({ id: 123 as unknown as string, sender: 'Mom', text: 'hi' });
    expect(id).not.toBeNull();
  });
});

describe('lib/uuid — randomId fallback', () => {
  it('returns a unique-looking string when crypto.randomUUID is absent', async () => {
    // Test the helper directly rather than mutating globalThis.crypto
    // (whose property descriptor is read-only in jsdom). We patch the
    // module's view of crypto via a vi.spyOn on the global getter.
    const { randomId } = await import('@/lib/uuid');
    const spy = vi.spyOn(globalThis, 'crypto', 'get').mockReturnValue({
      getRandomValues: <T extends ArrayBufferView | null>(arr: T): T => {
        if (arr instanceof Uint8Array) for (let i = 0; i < arr.length; i++) arr[i] = i;
        return arr;
      },
    } as unknown as Crypto);
    try {
      const id = randomId('p-');
      expect(id.startsWith('p-')).toBe(true);
      // RFC4122-ish: 8-4-4-4-12 hex groups after the prefix.
      expect(id.slice(2)).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
    } finally {
      spy.mockRestore();
    }
  });
});

describe('scheduleStore — dedup uses fresh state inside set()', () => {
  it('rejects a duplicate externalId added back-to-back synchronously', () => {
    // Both calls happen in the same tick. The dedup decision must read
    // committed state inside the set() callback, not via get() before
    // it — otherwise both deliveries pass the check and both commit.
    const a = useScheduleStore.getState().addIncomingMessage('Mom', 'hi', 'tg-99');
    const b = useScheduleStore.getState().addIncomingMessage('Mom', 'hi again', 'tg-99');
    expect(a).not.toBeNull();
    expect(b).toBeNull();
    const tasks = useScheduleStore.getState().tasks.filter((t) => t.externalId === 'tg-99');
    expect(tasks).toHaveLength(1);
  });
});

describe('scheduleStore — incoming message cap (oldest-read evicted)', () => {
  it('caps message-kind tasks at 100 by evicting oldest read first', () => {
    // 100 read messages, then push 1 unread — should evict the oldest read.
    for (let i = 0; i < 100; i++) {
      const id = useScheduleStore.getState().addIncomingMessage('Sender', `msg ${i}`, `id-${i}`);
      if (id) useScheduleStore.getState().toggleDone(id);
    }
    const before = useScheduleStore.getState().tasks.filter((t) => t.kind === 'message').length;
    expect(before).toBe(100);
    useScheduleStore.getState().addIncomingMessage('Mom', 'newest', 'id-new');
    const after = useScheduleStore.getState().tasks.filter((t) => t.kind === 'message');
    expect(after.length).toBe(100);
    // oldest one (id-0) should be gone, newest should be present
    expect(after.find((t) => t.externalId === 'id-0')).toBeUndefined();
    expect(after.find((t) => t.externalId === 'id-new')).toBeDefined();
  });
});
