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
import { syncContactsOnce } from '@/services/contactsIntegrationService';

const fetchMock = vi.fn();
beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date('2026-05-07T12:00:00Z'));
  globalThis.fetch = fetchMock as unknown as typeof fetch;
  fetchMock.mockReset();
  useContactsStore.setState({ contacts: [], lastSyncedAt: 0 });
});
afterEach(() => {
  vi.useRealTimers();
});

describe('contactsStore.mergeFromIntegrations', () => {
  it('appends new contacts and bumps lastSyncedAt', () => {
    const res = useContactsStore.getState().mergeFromIntegrations([
      { name: 'Mom', provider: 'telegram', recipientId: '111' },
      { name: 'Dad', provider: 'whatsapp', recipientId: '+1555' },
    ]);
    expect(res).toEqual({ added: 2, updated: 0 });
    const list = useContactsStore.getState().contacts;
    expect(list).toHaveLength(2);
    expect(useContactsStore.getState().lastSyncedAt).toBe(Date.parse('2026-05-07T12:00:00Z'));
  });

  it('updates by composite (provider, recipientId) without duplicating', () => {
    useContactsStore.getState().addContact({ name: 'Mom', provider: 'telegram', recipientId: '111' });
    const res = useContactsStore.getState().mergeFromIntegrations([
      { name: 'Mom (server)', provider: 'telegram', recipientId: '111', lastMessagePreview: 'pickup at 3' },
    ]);
    expect(res).toEqual({ added: 0, updated: 1 });
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
    expect(res).toEqual({ added: 1, updated: 0 });
    const list = useContactsStore.getState().contacts;
    expect(list).toHaveLength(1);
    expect(list[0].name).toBe('Mom');
  });

  it('bumps lastSyncedAt on a successful empty response', async () => {
    fetchMock.mockResolvedValueOnce(new Response(JSON.stringify({ contacts: [] }), { status: 200 }));
    const res = await syncContactsOnce();
    expect(res).toEqual({ added: 0, updated: 0 });
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
