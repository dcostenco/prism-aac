/**
 * Persist hydration guards — defends against tampered localStorage
 * (browser extension, sibling tab on a shared device, manual devtools
 * edit) injecting arbitrary objects into zustand-persisted stores.
 *
 * These tests target the `merge` callback we wired into both
 * contactsStore and scheduleStore. They construct a hostile persisted
 * payload and verify the store rehydrates only the well-formed entries.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { useContactsStore } from '@/store/contactsStore';
import { useScheduleStore } from '@/store/scheduleStore';

beforeEach(() => {
  if (typeof window !== 'undefined') window.localStorage.clear();
});

describe('contactsStore — merge hydration validator', () => {
  it('drops malformed persisted contacts', () => {
    // Stuff a hostile payload into localStorage with the same key the
    // persist middleware uses, then trigger rehydrate.
    window.localStorage.setItem('prism-aac-contacts', JSON.stringify({
      state: {
        contacts: [
          { id: 'good', name: 'Mom', provider: 'telegram', recipientId: '12345', order: 0 },
          { id: '', name: 'NoId', provider: 'telegram', recipientId: '111', order: 1 },          // bad: empty id
          { id: 'noprov', name: 'X', provider: 'pigeon', recipientId: '222', order: 2 },         // bad: invalid provider
          'string-not-object',                                                                    // bad: not object
          { id: 'bad-order', name: 'Y', provider: 'mail', recipientId: 'a@b.com', order: -5 },   // bad: negative order
          { id: 'huge-name', name: 'a'.repeat(500), provider: 'mail', recipientId: 'a@b.com', order: 3 }, // bad: name overflow
        ],
        lastSyncedAt: 12345,
      },
      version: 0,
    }));
    // Trigger rehydrate by calling the persist API.
    void useContactsStore.persist.rehydrate();
    const list = useContactsStore.getState().contacts;
    expect(list.map((c) => c.id)).toEqual(['good']);
    expect(useContactsStore.getState().lastSyncedAt).toBe(12345);
  });

  it('caps hydrated contacts at MAX_CONTACTS even if persisted state has more', () => {
    const huge = Array.from({ length: 500 }, (_, i) => ({
      id: `c${i}`, name: `n${i}`, provider: 'telegram', recipientId: `${100 + i}`, order: i,
    }));
    window.localStorage.setItem('prism-aac-contacts', JSON.stringify({
      state: { contacts: huge, lastSyncedAt: 0 },
      version: 0,
    }));
    void useContactsStore.persist.rehydrate();
    expect(useContactsStore.getState().contacts.length).toBe(200);
  });

  it('resets bogus lastSyncedAt to 0', () => {
    window.localStorage.setItem('prism-aac-contacts', JSON.stringify({
      state: { contacts: [], lastSyncedAt: 'haha' },
      version: 0,
    }));
    void useContactsStore.persist.rehydrate();
    expect(useContactsStore.getState().lastSyncedAt).toBe(0);
  });

  it('accepts Google source metadata and legacy rows but rejects unknown sources', () => {
    window.localStorage.setItem('prism-aac-contacts', JSON.stringify({
      state: {
        contacts: [
          { id: 'google', name: 'Google', provider: 'mail', recipientId: 'g@example.com', order: 0, sourceProvider: 'google' },
          { id: 'legacy', name: 'Legacy manual', provider: 'mail', recipientId: 'm@example.com', order: 1 },
          { id: 'bad-source', name: 'Bad', provider: 'mail', recipientId: 'b@example.com', order: 2, sourceProvider: 'attacker' },
        ],
        lastSyncedAt: 0,
      },
      version: 0,
    }));

    void useContactsStore.persist.rehydrate();

    expect(useContactsStore.getState().contacts.map((c) => c.id)).toEqual(['google', 'legacy']);
    expect(useContactsStore.getState().contacts[0].sourceProvider).toBe('google');
  });
});

describe('scheduleStore — merge hydration validator', () => {
  it('drops malformed task entries on rehydrate', () => {
    window.localStorage.setItem('prism-schedule', JSON.stringify({
      state: {
        tasks: [
          { id: 'good', text: 'OK', icon: '✅', done: false, order: 0 },
          { id: '', text: 'no id', icon: '❌', done: false, order: 1 },                  // bad: empty id
          { id: 'huge-text', text: 't'.repeat(5000), icon: '✅', done: false, order: 2 }, // bad: text overflow
          { id: 'bad-kind', text: 'x', icon: '✅', done: false, order: 3, kind: 'spam' },// bad: kind
          'not-object',
          { id: 'msg', text: 'Mom: hi', icon: '💬', done: false, order: 4, kind: 'message', sender: 'Mom', receivedAt: Date.now() },
        ],
        rewards: 5,
        timerSeconds: 300,
        timerEndMs: 0,
      },
      version: 0,
    }));
    void useScheduleStore.persist.rehydrate();
    const ids = useScheduleStore.getState().tasks.map((t) => t.id);
    expect(ids).toContain('good');
    expect(ids).toContain('msg');
    expect(ids).not.toContain('huge-text');
    expect(ids).not.toContain('bad-kind');
    expect(ids).not.toContain('');
  });

  it('clamps absurd rewards/timerSeconds to safe defaults', () => {
    window.localStorage.setItem('prism-schedule', JSON.stringify({
      state: {
        tasks: [{ id: 't', text: 'a', icon: '✅', done: false, order: 0 }],
        rewards: 999_999_999,
        timerSeconds: 99_999_999,
        timerEndMs: 0,
      },
      version: 0,
    }));
    void useScheduleStore.persist.rehydrate();
    expect(useScheduleStore.getState().rewards).toBeLessThanOrEqual(999);
    expect(useScheduleStore.getState().timerSeconds).toBeLessThanOrEqual(60 * 60);
  });
});
