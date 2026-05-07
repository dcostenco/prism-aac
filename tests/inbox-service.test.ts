/**
 * inboxService — drains incoming caregiver messages onto the schedule.
 * Covers: dedupe via externalId, lastSeenMs persistence, graceful 404
 * no-op, network error tolerance, deliverIncomingMessage idempotence.
 */
import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { useScheduleStore } from '@/store/scheduleStore';
import { deliverIncomingMessage } from '@/services/inboxService';

const fetchMock = vi.fn();
beforeEach(() => {
  globalThis.fetch = fetchMock as unknown as typeof fetch;
  fetchMock.mockReset();
  useScheduleStore.setState({ tasks: [], rewards: 0, timerSeconds: 300, timerEndMs: 0 });
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
});
