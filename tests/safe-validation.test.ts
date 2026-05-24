/**
 * safeValidation — clampNumber, clampInt, isHttpsAllowedUrl,
 * safeMailtoRecipient, safePhoneForUri, isSafeCssColor,
 * isValidCornerCalibration
 *
 * Life-safety: isHttpsAllowedUrl gates emergency GPS/PII POST targets.
 * Any regression allows attacker-controlled URL to receive caregiver
 * contacts, GPS coordinates, and medical profile data.
 */
import { describe, it, expect } from 'vitest';
import {
  clampNumber,
  clampInt,
  isHttpsAllowedUrl,
  safeMailtoRecipient,
  safePhoneForUri,
  isSafeCssColor,
  isValidCornerCalibration,
} from '@/lib/safeValidation';

// ── clampNumber ────────────────────────────────────────────────────────────────

describe('clampNumber', () => {
  it('returns value when within range [min, max]', () => {
    expect(clampNumber(5, 0, 10, 99)).toBe(5);
  });

  it('returns value at lower boundary', () => {
    expect(clampNumber(0, 0, 10, 99)).toBe(0);
  });

  it('returns value at upper boundary', () => {
    expect(clampNumber(10, 0, 10, 99)).toBe(10);
  });

  it('returns fallback when value below min', () => {
    expect(clampNumber(-1, 0, 10, 99)).toBe(99);
  });

  it('returns fallback when value above max', () => {
    expect(clampNumber(11, 0, 10, 99)).toBe(99);
  });

  it('returns fallback for NaN', () => {
    expect(clampNumber(NaN, 0, 10, 99)).toBe(99);
  });

  it('returns fallback for Infinity', () => {
    expect(clampNumber(Infinity, 0, 10, 99)).toBe(99);
  });

  it('returns fallback for string input', () => {
    expect(clampNumber('5', 0, 10, 99)).toBe(99);
  });

  it('returns fallback for null', () => {
    expect(clampNumber(null, 0, 10, 99)).toBe(99);
  });
});

// ── clampInt ──────────────────────────────────────────────────────────────────

describe('clampInt', () => {
  it('floors a float within range', () => {
    expect(clampInt(5.9, 0, 10, 99)).toBe(5);
  });

  it('returns integer at min boundary', () => {
    expect(clampInt(0, 0, 10, 99)).toBe(0);
  });

  it('returns fallback for out-of-range value', () => {
    expect(clampInt(11, 0, 10, 99)).toBe(99);
  });

  it('returns fallback for NaN', () => {
    expect(clampInt(NaN, 0, 10, 99)).toBe(99);
  });

  it('returns fallback for string', () => {
    expect(clampInt('3', 0, 10, 99)).toBe(99);
  });
});

// ── isHttpsAllowedUrl (LIFE-SAFETY) ──────────────────────────────────────────

const ALLOWED = new Set(['api.prism.app', 'portal.example.com']);

describe('isHttpsAllowedUrl — valid cases', () => {
  it('accepts https URL on allowed host', () => {
    expect(isHttpsAllowedUrl('https://api.prism.app/alerts', ALLOWED)).toBe(true);
  });

  it('accepts https with path and query params', () => {
    expect(isHttpsAllowedUrl('https://portal.example.com/v1/sos?id=1', ALLOWED)).toBe(true);
  });
});

describe('isHttpsAllowedUrl — rejection cases (life-safety)', () => {
  it('rejects http by default (SECURE-BY-DEFAULT)', () => {
    expect(isHttpsAllowedUrl('http://api.prism.app/alerts', ALLOWED)).toBe(false);
  });

  it('allows http when allowHttp=true (explicit opt-in for localhost)', () => {
    const local = new Set(['localhost']);
    expect(isHttpsAllowedUrl('http://localhost:3000/test', local, { allowHttp: true })).toBe(true);
  });

  it('rejects host not in allowlist', () => {
    expect(isHttpsAllowedUrl('https://evil.com/steal', ALLOWED)).toBe(false);
  });

  it('rejects javascript: protocol', () => {
    expect(isHttpsAllowedUrl('javascript:alert(1)', ALLOWED)).toBe(false);
  });

  it('rejects data: URL', () => {
    expect(isHttpsAllowedUrl('data:text/html,<h1>xss</h1>', ALLOWED)).toBe(false);
  });

  it('rejects empty string', () => {
    expect(isHttpsAllowedUrl('', ALLOWED)).toBe(false);
  });

  it('rejects non-string', () => {
    expect(isHttpsAllowedUrl(42, ALLOWED)).toBe(false);
    expect(isHttpsAllowedUrl(null, ALLOWED)).toBe(false);
  });

  it('rejects URL exceeding maxLen', () => {
    const long = 'https://api.prism.app/' + 'a'.repeat(300);
    expect(isHttpsAllowedUrl(long, ALLOWED)).toBe(false);
  });

  it('rejects URL that looks like allowed host but has a subdomain exploit', () => {
    // evil.api.prism.app is NOT in the allowed set
    expect(isHttpsAllowedUrl('https://evil.api.prism.app/steal', ALLOWED)).toBe(false);
  });

  it('rejects URL where allowed host appears only in path', () => {
    // attacker redirects: hostname is evil.com, path contains api.prism.app
    expect(isHttpsAllowedUrl('https://evil.com/https://api.prism.app', ALLOWED)).toBe(false);
  });

  it('rejects invalid URL syntax', () => {
    expect(isHttpsAllowedUrl('not-a-url', ALLOWED)).toBe(false);
  });
});

// ── safeMailtoRecipient ───────────────────────────────────────────────────────

describe('safeMailtoRecipient', () => {
  it('returns encoded recipient for valid email', () => {
    const result = safeMailtoRecipient('user@example.com');
    expect(result).toBe(encodeURIComponent('user@example.com'));
  });

  it('accepts + alias suffix (user+tag@example.com)', () => {
    expect(safeMailtoRecipient('user+tag@example.com')).not.toBeNull();
  });

  it('trims whitespace before validation', () => {
    expect(safeMailtoRecipient('  user@example.com  ')).toBe(encodeURIComponent('user@example.com'));
  });

  it('returns null for non-string', () => {
    expect(safeMailtoRecipient(42)).toBeNull();
    expect(safeMailtoRecipient(null)).toBeNull();
  });

  it('returns null for empty string', () => {
    expect(safeMailtoRecipient('')).toBeNull();
  });

  it('returns null for header-injection attempt with ? query param', () => {
    expect(safeMailtoRecipient('a@b.com?cc=evil@evil.com')).toBeNull();
  });

  it('returns null for string > 254 chars', () => {
    const long = 'a'.repeat(250) + '@b.co';
    expect(safeMailtoRecipient(long)).toBeNull();
  });

  it('returns null for address without domain TLD', () => {
    expect(safeMailtoRecipient('user@nodot')).toBeNull();
  });

  it('returns null for address without @', () => {
    expect(safeMailtoRecipient('notanemail')).toBeNull();
  });
});

// ── safePhoneForUri ───────────────────────────────────────────────────────────

describe('safePhoneForUri', () => {
  it('strips non-dial chars from phone number', () => {
    expect(safePhoneForUri('+1 (555) 123-4567')).toBe('+15551234567');
  });

  it('preserves *, # (dial chars)', () => {
    expect(safePhoneForUri('*67#5551234')).toBe('*67#5551234');
  });

  it('strips injection attempt query params', () => {
    expect(safePhoneForUri('5551234?from=evil&body=inject')).toBe('5551234');
  });

  it('returns null for non-string', () => {
    expect(safePhoneForUri(123)).toBeNull();
    expect(safePhoneForUri(null)).toBeNull();
  });

  it('returns null when nothing usable remains after stripping', () => {
    expect(safePhoneForUri('   ---   ')).toBeNull();
  });

  it('clamps to 32 chars', () => {
    const long = '1'.repeat(40);
    expect(safePhoneForUri(long)!.length).toBe(32);
  });
});

// ── isSafeCssColor ────────────────────────────────────────────────────────────

describe('isSafeCssColor', () => {
  it('accepts 6-digit hex color', () => {
    expect(isSafeCssColor('#FFD600')).toBe(true);
  });

  it('accepts 3-digit hex color', () => {
    expect(isSafeCssColor('#F00')).toBe(true);
  });

  it('accepts 8-digit hex (with alpha)', () => {
    expect(isSafeCssColor('#FF000080')).toBe(true);
  });

  it('accepts rgb()', () => {
    expect(isSafeCssColor('rgb(255, 0, 0)')).toBe(true);
  });

  it('accepts rgba()', () => {
    expect(isSafeCssColor('rgba(0,0,0,0.5)')).toBe(true);
  });

  it('accepts hsl()', () => {
    expect(isSafeCssColor('hsl(120, 50%, 50%)')).toBe(true);
  });

  it('accepts named color', () => {
    expect(isSafeCssColor('red')).toBe(true);
  });

  it('rejects semicolon breakout attempt', () => {
    expect(isSafeCssColor('#F00; color: red')).toBe(false);
  });

  it('rejects curly brace breakout', () => {
    expect(isSafeCssColor('#F00} body {color:red')).toBe(false);
  });

  it('rejects url() injection', () => {
    expect(isSafeCssColor('url(http://evil.com/x.css)')).toBe(false);
  });

  it('rejects expression() (IE CSS execution)', () => {
    expect(isSafeCssColor('expression(alert(1))')).toBe(false);
  });

  it('rejects javascript: injection', () => {
    expect(isSafeCssColor('javascript:alert(1)')).toBe(false);
  });

  it('rejects empty string', () => {
    expect(isSafeCssColor('')).toBe(false);
  });

  it('rejects string > 64 chars', () => {
    expect(isSafeCssColor('#' + '0'.repeat(64))).toBe(false);
  });

  it('rejects non-string', () => {
    expect(isSafeCssColor(null)).toBe(false);
    expect(isSafeCssColor(42)).toBe(false);
  });
});

// ── isValidCornerCalibration ──────────────────────────────────────────────────

describe('isValidCornerCalibration', () => {
  const valid = { leftX: 0.1, rightX: 0.9, topY: 0.1, bottomY: 0.9 };

  it('accepts valid calibration', () => {
    expect(isValidCornerCalibration(valid)).toBe(true);
  });

  it('accepts values at boundary -1', () => {
    expect(isValidCornerCalibration({ ...valid, leftX: -1 })).toBe(true);
  });

  it('accepts values at boundary 2', () => {
    expect(isValidCornerCalibration({ ...valid, rightX: 2 })).toBe(true);
  });

  it('rejects leftX === rightX (division by zero in cursor mapping)', () => {
    expect(isValidCornerCalibration({ ...valid, leftX: 0.5, rightX: 0.5 })).toBe(false);
  });

  it('rejects topY === bottomY (division by zero in cursor mapping)', () => {
    expect(isValidCornerCalibration({ ...valid, topY: 0.5, bottomY: 0.5 })).toBe(false);
  });

  it('rejects NaN in any field', () => {
    expect(isValidCornerCalibration({ ...valid, leftX: NaN })).toBe(false);
    expect(isValidCornerCalibration({ ...valid, topY: NaN })).toBe(false);
  });

  it('rejects Infinity in any field', () => {
    expect(isValidCornerCalibration({ ...valid, rightX: Infinity })).toBe(false);
  });

  it('rejects value below -1', () => {
    expect(isValidCornerCalibration({ ...valid, leftX: -1.001 })).toBe(false);
  });

  it('rejects value above 2', () => {
    expect(isValidCornerCalibration({ ...valid, bottomY: 2.001 })).toBe(false);
  });

  it('rejects missing field', () => {
    const { rightX: _, ...incomplete } = valid;
    expect(isValidCornerCalibration(incomplete)).toBe(false);
  });

  it('rejects string fields', () => {
    expect(isValidCornerCalibration({ ...valid, leftX: '0.1' })).toBe(false);
  });

  it('rejects null', () => {
    expect(isValidCornerCalibration(null)).toBe(false);
  });

  it('rejects non-object', () => {
    expect(isValidCornerCalibration('calibration')).toBe(false);
    expect(isValidCornerCalibration(42)).toBe(false);
  });
});
