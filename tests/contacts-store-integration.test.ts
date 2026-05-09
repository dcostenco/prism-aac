/**
 * contactsStore.mergeFromIntegrations + contactsIntegrationService.syncContactsOnce
 *
 * Covers:
 *   - merge identity is composite (provider, recipientId)
 *   - caregiver-edited fields are preserved on re-sync
 *   - sync sanitizes bad payloads (invalid provider, missing fields)
 *   - sync gracefully no-ops on 404 / network error
 *   - lastSyncedAt is bumped on successful sync (even with empty payload)
 */
import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { useContactsStore } from '@/store/contactsStore';
import { useAuthStore } from '@/store/authStore';
import { syncContactsOnce } from '@/services/contactsIntegrationService';

const fetchMock = vi.fn();
beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date('2026-05-07T12:00:00Z'));
  globalThis.fetch = fetchMock as unknown as typeof fetch;
  fetchMock.mockReset();
  useContactsStore.setState({ contacts: [], lastSyncedAt: 0 });
  // Contacts sync now requires an authed profile (server-cookie endpoint).
  useAuthStore.setState({
    profile: { email: 't@t', name: 'T', plan: 'standard', isPlatformAdmin: false },
    loaded: true, loading: false,
  });
});
afterEach(() => {
  vi.useRealTimers();
});

describe('contactsStore.mergeFromIntegrations', () => {
  it('appends new contacts and bumps lastSyncedAt', () => {
    const res = useContactsStore.getState().mergeFromIntegrations([
      { name: 'Mom', provider: 'telegram', recipientId: '111' },
      { name: 'Dad', provider: 'whatsapp', recipientId: '+15551234567' },
    ]);
    expect(res).toEqual(expect.objectContaining({ added: 2, updated: 0 }));
    const list = useContactsStore.getState().contacts;
    expect(list).toHaveLength(2);
    expect(useContactsStore.getState().lastSyncedAt).toBe(Date.parse('2026-05-07T12:00:00Z'));
  });

  it('addContact rejects an exact (provider, recipientId) duplicate', () => {
    const a = useContactsStore.getState().addContact({ name: 'Mom', provider: 'telegram', recipientId: '111' });
    const b = useContactsStore.getState().addContact({ name: 'Mom (dup)', provider: 'telegram', recipientId: '111' });
    expect(a).not.toBeNull();
    expect(b).toBeNull();
    expect(useContactsStore.getState().contacts).toHaveLength(1);
  });

  it('addContact rejects when MAX_CONTACTS already reached (atomic check)', () => {
    // Pre-fill to cap.
    const seed = Array.from({ length: 200 }, (_, i) => ({
      name: `n${i}`, provider: 'telegram' as const, recipientId: `${1000 + i}`,
    }));
    useContactsStore.getState().mergeFromIntegrations(seed);
    expect(useContactsStore.getState().contacts).toHaveLength(200);
    // Now try to add one more directly — must be rejected.
    const id = useContactsStore.getState().addContact({ name: 'extra', provider: 'mail', recipientId: 'x@y.zz' });
    expect(id).toBeNull();
    expect(useContactsStore.getState().contacts).toHaveLength(200);
  });

  it('updateContact rejects a recipientId that fails the new provider format', () => {
    useContactsStore.getState().addContact({ name: 'Mom', provider: 'mail', recipientId: 'm@example.com' });
    const c = useContactsStore.getState().contacts[0];
    // "abc" is not a valid email — update should leave recipientId untouched.
    useContactsStore.getState().updateContact(c.id, { recipientId: 'abc' });
    expect(useContactsStore.getState().contacts[0].recipientId).toBe('m@example.com');
    // A valid replacement DOES land.
    useContactsStore.getState().updateContact(c.id, { recipientId: 'mama@example.com' });
    expect(useContactsStore.getState().contacts[0].recipientId).toBe('mama@example.com');
  });

  it('caps merged contacts at MAX_CONTACTS — drops new entries past the limit', () => {
    // Pre-fill to one short of the cap so we can deterministically observe
    // the boundary behavior.
    const seed = Array.from({ length: 199 }, (_, i) => ({
      name: `Person ${i}`, provider: 'telegram' as const, recipientId: `${1000 + i}`,
    }));
    useContactsStore.getState().mergeFromIntegrations(seed);
    expect(useContactsStore.getState().contacts).toHaveLength(199);
    // Push 5 more; only 1 should land (slot 200), the other 4 dropped.
    const more = Array.from({ length: 5 }, (_, i) => ({
      name: `Extra ${i}`, provider: 'telegram' as const, recipientId: `${9000 + i}`,
    }));
    const res = useContactsStore.getState().mergeFromIntegrations(more);
    expect(res.added).toBe(1);
    expect(useContactsStore.getState().contacts).toHaveLength(200);
  });

  it('updates by composite (provider, recipientId) without duplicating', () => {
    useContactsStore.getState().addContact({ name: 'Mom', provider: 'telegram', recipientId: '111' });
    const res = useContactsStore.getState().mergeFromIntegrations([
      { name: 'Mom (server)', provider: 'telegram', recipientId: '111', lastMessagePreview: 'pickup at 3' },
    ]);
    expect(res).toEqual(expect.objectContaining({ added: 0, updated: 1 }));
    const list = useContactsStore.getState().contacts;
    expect(list).toHaveLength(1);
    // Caregiver name override is preserved
    expect(list[0].name).toBe('Mom');
    // Server-sourced preview is refreshed
    expect(list[0].lastMessagePreview).toBe('pickup at 3');
  });

  it('treats same recipientId on a different provider as a separate person', () => {
    useContactsStore.getState().addContact({ name: 'Mom TG', provider: 'telegram', recipientId: '111' });
    useContactsStore.getState().mergeFromIntegrations([
      { name: 'Mom WA', provider: 'whatsapp', recipientId: '111' },
    ]);
    expect(useContactsStore.getState().contacts).toHaveLength(2);
  });
});

describe('contactsIntegrationService.syncContactsOnce', () => {
  it('returns null on network error and leaves store untouched', async () => {
    fetchMock.mockRejectedValueOnce(new Error('offline'));
    const res = await syncContactsOnce();
    expect(res).toBeNull();
    expect(useContactsStore.getState().contacts).toHaveLength(0);
    expect(useContactsStore.getState().lastSyncedAt).toBe(0);
  });

  it('returns null on 404 (endpoint not yet shipped)', async () => {
    fetchMock.mockResolvedValueOnce(new Response(null, { status: 404 }));
    const res = await syncContactsOnce();
    expect(res).toBeNull();
    expect(useContactsStore.getState().lastSyncedAt).toBe(0);
  });

  it('drops malformed entries (invalid provider, missing fields)', async () => {
    fetchMock.mockResolvedValueOnce(
      new Response(JSON.stringify({
        contacts: [
          { name: 'Mom', provider: 'telegram', recipientId: '111' },
          { name: 'Bad', provider: 'pigeon', recipientId: '222' },   // bogus provider
          { name: 'Missing id', provider: 'whatsapp' },              // no recipientId
          { name: '', provider: 'mail', recipientId: 'a@b.c' },      // empty name
        ],
      }), { status: 200 }),
    );
    const res = await syncContactsOnce();
    expect(res).toEqual(expect.objectContaining({ added: 1, updated: 0 }));
    const list = useContactsStore.getState().contacts;
    expect(list).toHaveLength(1);
    expect(list[0].name).toBe('Mom');
  });

  it('bumps lastSyncedAt on a successful empty response', async () => {
    fetchMock.mockResolvedValueOnce(new Response(JSON.stringify({ contacts: [] }), { status: 200 }));
    const res = await syncContactsOnce();
    expect(res).toEqual(expect.objectContaining({ added: 0, updated: 0 }));
    expect(useContactsStore.getState().lastSyncedAt).toBeGreaterThan(0);
  });

  it('hits the contacts endpoint with credentials included', async () => {
    fetchMock.mockResolvedValueOnce(new Response(JSON.stringify({ contacts: [] }), { status: 200 }));
    await syncContactsOnce();
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toContain('/api/v1/prism-aac/contacts');
    expect((init as RequestInit).credentials).toBe('include');
  });
});
