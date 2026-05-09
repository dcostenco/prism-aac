/**
 * sendToContact + isProviderAvailable — provider dispatch, tier guard,
 * empty-text rejection, error mapping.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  sendToContact,
  isProviderAvailable,
  PROVIDER_MIN_TIER,
} from '@/services/sendToContact';
import type { AacContact } from '@/store/contactsStore';

const fetchMock = vi.fn();
beforeEach(() => {
  globalThis.fetch = fetchMock as unknown as typeof fetch;
  fetchMock.mockReset();
});

const baseContact = (overrides: Partial<AacContact> = {}): AacContact => ({
  id: 'c1', name: 'Mom', provider: 'telegram', recipientId: '111', order: 0, ...overrides,
});

describe('isProviderAvailable', () => {
  it('free plan can use mail only (SMS requires standard — Twilio has per-msg cost)', () => {
    expect(isProviderAvailable('mail', 'free')).toBe(true);
    expect(isProviderAvailable('sms', 'free')).toBe(false);   // standard required
    expect(isProviderAvailable('telegram', 'free')).toBe(false);
    expect(isProviderAvailable('whatsapp', 'free')).toBe(false);
    expect(isProviderAvailable('viber', 'free')).toBe(false);
    expect(isProviderAvailable('messenger', 'free')).toBe(false);
    expect(isProviderAvailable('instagram', 'free')).toBe(false);
  });

  it('standard plan unlocks sms + telegram/whatsapp/viber but not Meta Business', () => {
    expect(isProviderAvailable('sms', 'standard')).toBe(true);
    expect(isProviderAvailable('telegram', 'standard')).toBe(true);
    expect(isProviderAvailable('whatsapp', 'standard')).toBe(true);
    expect(isProviderAvailable('viber', 'standard')).toBe(true);
    expect(isProviderAvailable('messenger', 'standard')).toBe(false);
    expect(isProviderAvailable('instagram', 'standard')).toBe(false);
  });

  it('advanced plan unlocks everything', () => {
    expect(isProviderAvailable('messenger', 'advanced')).toBe(true);
    expect(isProviderAvailable('instagram', 'advanced')).toBe(true);
  });

  it('enterprise plan also unlocks everything', () => {
    expect(isProviderAvailable('messenger', 'enterprise')).toBe(true);
  });

  it('null plan is treated as free', () => {
    expect(isProviderAvailable('mail', null)).toBe(true);
    expect(isProviderAvailable('telegram', null)).toBe(false);
  });
});

describe('sendToContact — input validation', () => {
  it('rejects empty text without hitting the network', async () => {
    const res = await sendToContact(baseContact(), '   ', 'standard');
    expect(res).toEqual({ ok: false, error: 'empty' });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('blocks the request when the user plan cannot use the provider', async () => {
    const res = await sendToContact(baseContact({ provider: 'telegram' }), 'hi', 'free');
    expect(res.ok).toBe(false);
    if (!res.ok) {
      expect(res.error).toBe(`tier_required:${PROVIDER_MIN_TIER.telegram}`);
    }
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe('sendToContact — provider dispatch', () => {
  it('Telegram body uses recipientId + text', async () => {
    fetchMock.mockResolvedValueOnce(new Response(JSON.stringify({ ok: true }), { status: 200 }));
    await sendToContact(baseContact({ provider: 'telegram', recipientId: '12345' }), 'hi', 'standard');
    const [url, init] = fetchMock.mock.calls[0];
    expect(String(url)).toContain('/telegram/send');
    expect(JSON.parse((init as RequestInit).body as string)).toEqual({ recipientId: '12345', text: 'hi' });
  });

  it('WhatsApp body uses to + body', async () => {
    fetchMock.mockResolvedValueOnce(new Response(JSON.stringify({ ok: true }), { status: 200 }));
    await sendToContact(baseContact({ provider: 'whatsapp', recipientId: '+15551234567' }), 'hi', 'standard');
    const init = fetchMock.mock.calls[0][1] as RequestInit;
    expect(JSON.parse(init.body as string)).toEqual({ to: '+15551234567', body: 'hi' });
  });

  it('Mail body uses to + subject + body_text and truncates subject', async () => {
    fetchMock.mockResolvedValueOnce(new Response(JSON.stringify({ ok: true }), { status: 200 }));
    const long = 'a'.repeat(120);
    await sendToContact(baseContact({ provider: 'mail', recipientId: 'mom@example.com' }), long, 'free');
    const init = fetchMock.mock.calls[0][1] as RequestInit;
    const body = JSON.parse(init.body as string);
    expect(body.to).toBe('mom@example.com');
    expect(body.subject).toHaveLength(60);
    expect(body.body_text).toBe(long);
  });
});

describe('sendToContact — recipient-id validation', () => {
  it('rejects malformed phone numbers locally before hitting the network', async () => {
    const res = await sendToContact(baseContact({ provider: 'whatsapp', recipientId: 'not-a-phone' }), 'hi', 'standard');
    expect(res).toEqual({ ok: false, error: 'invalid_recipient_id' });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('rejects malformed emails locally', async () => {
    const res = await sendToContact(baseContact({ provider: 'mail', recipientId: 'not-an-email' }), 'hi', 'free');
    expect(res).toEqual({ ok: false, error: 'invalid_recipient_id' });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('rejects telegram chat_id that contains letters', async () => {
    const res = await sendToContact(baseContact({ provider: 'telegram', recipientId: '12abc34' }), 'hi', 'standard');
    expect(res).toEqual({ ok: false, error: 'invalid_recipient_id' });
  });
});

describe('sendToContact — length clamping', () => {
  it('truncates oversize text and reports truncation in the result', async () => {
    fetchMock.mockResolvedValueOnce(new Response(JSON.stringify({ ok: true }), { status: 200 }));
    // SMS cap is 1500 — feed 5000.
    const huge = 'a'.repeat(5000);
    const res = await sendToContact(baseContact({ provider: 'sms', recipientId: '+15551234567' }), huge, 'standard');
    expect(res).toEqual({ ok: true, truncated: true });
    const init = fetchMock.mock.calls[0][1] as RequestInit;
    const body = JSON.parse(init.body as string);
    expect((body.body as string).length).toBeLessThanOrEqual(1500);
    expect((body.body as string).endsWith('…')).toBe(true);
  });

  it('does not truncate when text fits under the provider cap', async () => {
    fetchMock.mockResolvedValueOnce(new Response(JSON.stringify({ ok: true }), { status: 200 }));
    const res = await sendToContact(baseContact({ provider: 'sms', recipientId: '+15551234567' }), 'hi mom', 'standard');
    expect(res).toEqual({ ok: true, truncated: false });
  });
});

describe('sendToContact — error mapping', () => {
  it('returns HTTP status when the portal responds non-2xx', async () => {
    fetchMock.mockResolvedValueOnce(new Response('rate limited', { status: 429 }));
    const res = await sendToContact(baseContact(), 'hi', 'standard');
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.error).toContain('HTTP 429');
  });

  it('returns the network error message instead of throwing', async () => {
    fetchMock.mockRejectedValueOnce(new Error('boom'));
    const res = await sendToContact(baseContact(), 'hi', 'standard');
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.error).toBe('boom');
  });
});
