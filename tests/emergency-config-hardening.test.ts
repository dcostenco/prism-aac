/**
 * emergencyService — config hydration validator. THIS IS LIFE-SAFETY
 * CODE. The emergency config is read from localStorage on every send;
 * a tampered persist entry could otherwise:
 *   - inject malicious synaluxApiUrl that redirects 911 POSTs to an
 *     attacker, exfiltrating GPS + medical profile + message
 *   - inject attacker phone/email into contacts so emergency alerts
 *     route to the attacker rather than the caregiver
 *   - inject NaN/negative/huge countdownSeconds disabling the cancel
 *     window
 *   - flip enabled to false to silently turn off the whole system
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { validateEmergencyConfig, getConfig, DEFAULT_CONFIG } from '@/services/emergencyService';

const CONFIG_KEY = 'prism-aac-emergency-config';

beforeEach(() => {
  if (typeof window !== 'undefined') window.localStorage.clear();
});

describe('validateEmergencyConfig — synaluxApiUrl safety', () => {
  it('drops attacker URL on a non-allowlisted host', () => {
    const cfg = validateEmergencyConfig({ synaluxApiUrl: 'https://attacker.com/exfil' });
    expect(cfg.synaluxApiUrl).toBeUndefined();
  });

  it('drops javascript: scheme', () => {
    const cfg = validateEmergencyConfig({ synaluxApiUrl: 'javascript:alert(1)' });
    expect(cfg.synaluxApiUrl).toBeUndefined();
  });

  it('drops data: scheme', () => {
    const cfg = validateEmergencyConfig({ synaluxApiUrl: 'data:text/html,<script>' });
    expect(cfg.synaluxApiUrl).toBeUndefined();
  });

  it('drops oversized URL', () => {
    const cfg = validateEmergencyConfig({ synaluxApiUrl: 'https://synalux.ai/' + 'a'.repeat(300) });
    expect(cfg.synaluxApiUrl).toBeUndefined();
  });

  it('accepts allowlisted synalux.ai URL', () => {
    const cfg = validateEmergencyConfig({ synaluxApiUrl: 'https://synalux.ai/api/v1/prism-aac/emergency' });
    expect(cfg.synaluxApiUrl).toBe('https://synalux.ai/api/v1/prism-aac/emergency');
  });
});

describe('validateEmergencyConfig — countdownSeconds bounds', () => {
  it('clamps NaN to default', () => {
    const cfg = validateEmergencyConfig({ countdownSeconds: NaN });
    expect(cfg.countdownSeconds).toBe(DEFAULT_CONFIG.countdownSeconds);
  });

  it('rejects negative', () => {
    const cfg = validateEmergencyConfig({ countdownSeconds: -5 });
    expect(cfg.countdownSeconds).toBe(DEFAULT_CONFIG.countdownSeconds);
  });

  it('rejects huge value (would block cancel forever)', () => {
    const cfg = validateEmergencyConfig({ countdownSeconds: 9999 });
    expect(cfg.countdownSeconds).toBe(DEFAULT_CONFIG.countdownSeconds);
  });

  it('rejects non-number', () => {
    const cfg = validateEmergencyConfig({ countdownSeconds: '10' });
    expect(cfg.countdownSeconds).toBe(DEFAULT_CONFIG.countdownSeconds);
  });

  it('accepts valid 0..60', () => {
    expect(validateEmergencyConfig({ countdownSeconds: 0 }).countdownSeconds).toBe(0);
    expect(validateEmergencyConfig({ countdownSeconds: 60 }).countdownSeconds).toBe(60);
    expect(validateEmergencyConfig({ countdownSeconds: 7 }).countdownSeconds).toBe(7);
  });
});

describe('validateEmergencyConfig — contacts shape', () => {
  it('drops contacts missing name OR relationship', () => {
    const cfg = validateEmergencyConfig({
      contacts: [
        { name: '', relationship: 'Mom', phone: '5551234' },     // bad: empty name
        { name: 'Mom', relationship: '', phone: '5551234' },     // bad: empty relationship
        { name: 'Mom', relationship: 'Mother', phone: '5551234' }, // good
      ],
    });
    expect(cfg.contacts).toHaveLength(1);
    expect(cfg.contacts[0].name).toBe('Mom');
  });

  it('drops contacts with no phone AND no email (unreachable)', () => {
    const cfg = validateEmergencyConfig({
      contacts: [{ name: 'Mom', relationship: 'Mother' }],
    });
    expect(cfg.contacts).toHaveLength(0);
  });

  it('caps contacts list at MAX_CONTACTS', () => {
    const huge = Array.from({ length: 100 }, (_, i) => ({
      name: `c${i}`, relationship: 'Friend', phone: '5551234',
    }));
    const cfg = validateEmergencyConfig({ contacts: huge });
    expect(cfg.contacts.length).toBeLessThanOrEqual(20);
  });

  it('strips control chars from contact names', () => {
    const evil = 'Mom\u0000Evil';
    const cfg = validateEmergencyConfig({
      contacts: [{ name: evil, relationship: 'Mother', phone: '5551234' }],
    });
    expect(cfg.contacts[0].name).toBe('MomEvil');
  });

  it('clamps oversized contact name', () => {
    const cfg = validateEmergencyConfig({
      contacts: [{ name: 'a'.repeat(500), relationship: 'Friend', phone: '5551234' }],
    });
    expect(cfg.contacts[0].name.length).toBeLessThanOrEqual(80);
  });
});

describe('validateEmergencyConfig — profile shape', () => {
  it('rejects negative age', () => {
    const cfg = validateEmergencyConfig({ profile: { name: 'Kid', age: -1 } });
    expect(cfg.profile.age).toBeUndefined();
  });

  it('rejects huge age', () => {
    const cfg = validateEmergencyConfig({ profile: { name: 'Kid', age: 999 } });
    expect(cfg.profile.age).toBeUndefined();
  });

  it('caps conditions list', () => {
    const huge = Array.from({ length: 100 }, (_, i) => `cond${i}`);
    const cfg = validateEmergencyConfig({ profile: { name: 'Kid', conditions: huge } });
    expect(cfg.profile.conditions!.length).toBeLessThanOrEqual(30);
  });
});

describe('validateEmergencyConfig — enabled boolean', () => {
  it('rejects non-boolean enabled (defaults to true)', () => {
    expect(validateEmergencyConfig({ enabled: 'false' }).enabled).toBe(true);
    expect(validateEmergencyConfig({ enabled: 0 }).enabled).toBe(true);
  });

  it('respects explicit boolean', () => {
    expect(validateEmergencyConfig({ enabled: false }).enabled).toBe(false);
    expect(validateEmergencyConfig({ enabled: true }).enabled).toBe(true);
  });
});

describe('getConfig — localStorage tampering', () => {
  it('returns DEFAULT_CONFIG when localStorage entry is malformed JSON', () => {
    window.localStorage.setItem(CONFIG_KEY, '{not-valid-json');
    const cfg = getConfig();
    expect(cfg).toEqual(DEFAULT_CONFIG);
  });

  it('strips attacker synaluxApiUrl from persisted config', () => {
    window.localStorage.setItem(CONFIG_KEY, JSON.stringify({
      enabled: true,
      countdownSeconds: 10,
      autoCall911: false,
      contacts: [],
      profile: { name: 'Kid' },
      synaluxApiUrl: 'https://attacker.com/exfil',
    }));
    const cfg = getConfig();
    expect(cfg.synaluxApiUrl).toBeUndefined();
    expect(cfg.profile.name).toBe('Kid');
  });
});
