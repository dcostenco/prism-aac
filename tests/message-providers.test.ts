/**
 * messageProviders — isProviderAvailable, clampToProviderLimit, validateRecipientId
 *
 * Security-relevant: validateRecipientId catches obvious caregiver typos
 * and blocks injection attempts in the contacts editor. clampToProviderLimit
 * prevents over-limit portal sends.
 */
import { describe, it, expect } from 'vitest';
import { PROVIDERS, isProviderAvailable, clampToProviderLimit } from '@/lib/messageProviders';
import type { PlanTier } from '@/lib/messageProviders';

// ── isProviderAvailable ───────────────────────────────────────────────────────

describe('isProviderAvailable', () => {
  it('mail is available on free tier', () => {
    expect(isProviderAvailable('mail', 'free')).toBe(true);
  });

  it('telegram requires standard — free is rejected', () => {
    expect(isProviderAvailable('telegram', 'free')).toBe(false);
  });

  it('telegram is available on standard tier', () => {
    expect(isProviderAvailable('telegram', 'standard')).toBe(true);
  });

  it('messenger requires advanced — standard is rejected', () => {
    expect(isProviderAvailable('messenger', 'standard')).toBe(false);
  });

  it('messenger is available on advanced tier', () => {
    expect(isProviderAvailable('messenger', 'advanced')).toBe(true);
  });

  it('enterprise qualifies for all providers', () => {
    const providers = Object.keys(PROVIDERS) as Array<keyof typeof PROVIDERS>;
    for (const p of providers) {
      expect(isProviderAvailable(p, 'enterprise')).toBe(true);
    }
  });

  it('returns false for unknown provider', () => {
    expect(isProviderAvailable('unknown_provider' as never, 'enterprise')).toBe(false);
  });

  it('treats null plan as free tier', () => {
    expect(isProviderAvailable('telegram', null)).toBe(false);
    expect(isProviderAvailable('mail', null)).toBe(true);
  });

  it('treats undefined plan as free tier', () => {
    expect(isProviderAvailable('mail', undefined)).toBe(true);
  });
});

// ── clampToProviderLimit ──────────────────────────────────────────────────────

describe('clampToProviderLimit', () => {
  it('returns text unchanged when within limit', () => {
    const text = 'Hello caregiver!';
    expect(clampToProviderLimit('telegram', text)).toBe(text);
  });

  it('trims surrounding whitespace', () => {
    expect(clampToProviderLimit('telegram', '  hello  ')).toBe('hello');
  });

  it('truncates and appends ellipsis when over limit', () => {
    const longText = 'a'.repeat(4001);
    const result = clampToProviderLimit('telegram', longText);
    expect(result.length).toBe(4000); // maxTextLength for telegram
    expect(result.endsWith('…')).toBe(true);
  });

  it('WhatsApp capped at 1024 chars', () => {
    const longText = 'x'.repeat(1100);
    const result = clampToProviderLimit('whatsapp', longText);
    expect(result.length).toBe(1024);
    expect(result.endsWith('…')).toBe(true);
  });

  it('SMS capped at 1500 chars', () => {
    const longText = 'x'.repeat(1600);
    const result = clampToProviderLimit('sms', longText);
    expect(result.length).toBe(1500);
  });

  it('returns trimmed text unchanged for unknown provider', () => {
    expect(clampToProviderLimit('unknown_provider' as never, '  hello  ')).toBe('hello');
  });

  it('exactly at limit is NOT truncated (no ellipsis)', () => {
    const cfg = PROVIDERS.telegram;
    const text = 'x'.repeat(cfg.maxTextLength);
    const result = clampToProviderLimit('telegram', text);
    expect(result).toBe(text);
    expect(result.endsWith('…')).toBe(false);
  });
});

// ── validateRecipientId per provider ─────────────────────────────────────────

describe('PROVIDERS.telegram.validateRecipientId', () => {
  const { validateRecipientId } = PROVIDERS.telegram;
  it('accepts digits-only id', () => { expect(validateRecipientId('123456')).toBe(true); });
  it('rejects email (not digits)', () => { expect(validateRecipientId('user@example.com')).toBe(false); });
  it('rejects empty string', () => { expect(validateRecipientId('')).toBe(false); });
});

describe('PROVIDERS.sms.validateRecipientId', () => {
  const { validateRecipientId } = PROVIDERS.sms;
  it('accepts E.164 with + prefix', () => { expect(validateRecipientId('+15551234567')).toBe(true); });
  it('accepts number without + prefix', () => { expect(validateRecipientId('15551234567')).toBe(true); });
  it('rejects non-phone string', () => { expect(validateRecipientId('not a phone')).toBe(false); });
  it('rejects too-short number (< 7 digits after country code)', () => { expect(validateRecipientId('+12345')).toBe(false); });
});

describe('PROVIDERS.whatsapp.validateRecipientId', () => {
  const { validateRecipientId } = PROVIDERS.whatsapp;
  it('accepts E.164 number', () => { expect(validateRecipientId('+447911123456')).toBe(true); });
  it('rejects email format', () => { expect(validateRecipientId('user@mail.com')).toBe(false); });
});

describe('PROVIDERS.mail.validateRecipientId', () => {
  const { validateRecipientId } = PROVIDERS.mail;
  it('accepts valid email', () => { expect(validateRecipientId('user@example.com')).toBe(true); });
  it('accepts email with + alias', () => { expect(validateRecipientId('user+tag@example.com')).toBe(true); });
  it('rejects no @', () => { expect(validateRecipientId('notanemail')).toBe(false); });
  it('rejects over 254 chars', () => { expect(validateRecipientId('a'.repeat(255) + '@b.co')).toBe(false); });
  it('rejects phone number as email', () => { expect(validateRecipientId('+15551234567')).toBe(false); });
});

describe('PROVIDERS.messenger.validateRecipientId', () => {
  const { validateRecipientId } = PROVIDERS.messenger;
  it('accepts valid opaque id', () => { expect(validateRecipientId('abcdef123456')).toBe(true); });
  it('rejects too-short id (< 6 chars)', () => { expect(validateRecipientId('abc')).toBe(false); });
  it('rejects email-like string', () => { expect(validateRecipientId('user@example.com')).toBe(false); });
});

// ── PROVIDERS table completeness ──────────────────────────────────────────────

describe('PROVIDERS table completeness', () => {
  const expectedProviders = ['telegram', 'whatsapp', 'viber', 'sms', 'messenger', 'instagram', 'mail'];

  for (const p of expectedProviders) {
    it(`${p} has all required config fields`, () => {
      const cfg = PROVIDERS[p as keyof typeof PROVIDERS];
      expect(cfg).toBeDefined();
      expect(typeof cfg.label).toBe('string');
      expect(typeof cfg.endpoint).toBe('string');
      expect(typeof cfg.buildBody).toBe('function');
      expect(typeof cfg.maxTextLength).toBe('number');
      expect(cfg.maxTextLength).toBeGreaterThan(0);
      expect(typeof cfg.validateRecipientId).toBe('function');
      expect(typeof cfg.minTier).toBe('string');
    });
  }
});
