import { describe, it, expect, beforeEach, vi } from 'vitest';
import { useContactsStore, type AacContact } from '@/store/contactsStore';

// Mock the underlying sendToContact so tests don't hit the portal.
vi.mock('@/services/sendToContact', async () => {
  return {
    sendToContact: vi.fn().mockResolvedValue({ ok: true, truncated: false }),
  };
});

import {
  resolvePrimaryCaregiver,
  sendAlertToCaregiver,
} from '@/services/sendAlertToCaregiver';
import { sendToContact } from '@/services/sendToContact';

function makeContact(over: Partial<AacContact> = {}): AacContact {
  return {
    id: over.id ?? `c-${Math.random().toString(36).slice(2, 8)}`,
    name: over.name ?? 'Mom',
    provider: over.provider ?? 'sms',
    recipientId: over.recipientId ?? '+15551234567',
    order: over.order ?? 0,
    sendCount: over.sendCount,
    lastUsedAt: over.lastUsedAt,
    avatar: over.avatar,
  };
}

describe('sendAlertToCaregiver — primary caregiver resolution', () => {
  beforeEach(() => {
    useContactsStore.setState({ contacts: [], lastSyncedAt: 0 });
    (sendToContact as ReturnType<typeof vi.fn>).mockClear();
  });

  it('returns null when no contacts exist', () => {
    expect(resolvePrimaryCaregiver()).toBeNull();
  });

  it('prefers SMS over other providers regardless of order', () => {
    useContactsStore.setState({
      contacts: [
        makeContact({ id: 'a', name: 'Dad-WA', provider: 'whatsapp', order: 0 }),
        makeContact({ id: 'b', name: 'Mom-SMS', provider: 'sms', order: 9 }),
      ],
      lastSyncedAt: 0,
    });
    expect(resolvePrimaryCaregiver()?.id).toBe('b');
  });

  it('within a provider, picks the lowest order', () => {
    useContactsStore.setState({
      contacts: [
        makeContact({ id: 'a', provider: 'sms', order: 3 }),
        makeContact({ id: 'b', provider: 'sms', order: 1 }),
        makeContact({ id: 'c', provider: 'sms', order: 2 }),
      ],
      lastSyncedAt: 0,
    });
    expect(resolvePrimaryCaregiver()?.id).toBe('b');
  });

  it('falls back to whatsapp when no sms contact exists', () => {
    useContactsStore.setState({
      contacts: [makeContact({ provider: 'whatsapp' })],
      lastSyncedAt: 0,
    });
    expect(resolvePrimaryCaregiver()?.provider).toBe('whatsapp');
  });
});

describe('sendAlertToCaregiver — dispatch', () => {
  beforeEach(() => {
    useContactsStore.setState({ contacts: [], lastSyncedAt: 0 });
    (sendToContact as ReturnType<typeof vi.fn>).mockClear();
    (sendToContact as ReturnType<typeof vi.fn>).mockResolvedValue({ ok: true, truncated: false });
  });

  it('returns no_caregiver when contacts list is empty', async () => {
    const res = await sendAlertToCaregiver();
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.error).toBe('no_caregiver');
    expect(sendToContact).not.toHaveBeenCalled();
  });

  it('calls sendToContact with the resolved primary and a default body', async () => {
    useContactsStore.setState({
      contacts: [makeContact({ id: 'p', name: 'Mom' })],
      lastSyncedAt: 0,
    });
    const res = await sendAlertToCaregiver();
    expect(res.ok).toBe(true);
    const call = (sendToContact as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(call[0].id).toBe('p');
    // Default body must include the alert glyph + check-in phrasing
    expect(String(call[1])).toMatch(/needs check-in/i);
  });

  it('uses the explicit body when provided', async () => {
    useContactsStore.setState({
      contacts: [makeContact({ id: 'p' })],
      lastSyncedAt: 0,
    });
    await sendAlertToCaregiver('custom body');
    expect((sendToContact as ReturnType<typeof vi.fn>).mock.calls[0][1]).toBe('custom body');
  });

  it('surfaces send_failed when sendToContact rejects', async () => {
    useContactsStore.setState({
      contacts: [makeContact({ id: 'p' })],
      lastSyncedAt: 0,
    });
    (sendToContact as ReturnType<typeof vi.fn>).mockResolvedValueOnce({ ok: false, error: 'portal_500' });
    const res = await sendAlertToCaregiver();
    expect(res.ok).toBe(false);
    if (!res.ok) {
      expect(res.error).toBe('send_failed');
      expect(res.detail).toBe('portal_500');
    }
  });
});
