/**
 * safeStrings — sanitizeString + SAFE_LIMITS boundary tests
 *
 * Security-critical: used at every external-input boundary to strip
 * C0 control chars, trim, and clamp length. Any regression here allows
 * terminal-injection / schedule-row corruption.
 */
import { describe, it, expect } from 'vitest';
import { sanitizeString, SAFE_LIMITS } from '@/lib/safeStrings';

// ── sanitizeString ─────────────────────────────────────────────────────────────

describe('sanitizeString — type guard', () => {
  it('returns "" for number input', () => {
    expect(sanitizeString(42, 80)).toBe('');
  });

  it('returns "" for null input', () => {
    expect(sanitizeString(null, 80)).toBe('');
  });

  it('returns "" for undefined input', () => {
    expect(sanitizeString(undefined, 80)).toBe('');
  });

  it('returns "" for object input', () => {
    expect(sanitizeString({}, 80)).toBe('');
  });

  it('returns "" for array input', () => {
    expect(sanitizeString(['hello'], 80)).toBe('');
  });
});

describe('sanitizeString — control character stripping', () => {
  it('strips NUL (\\x00)', () => {
    // Replace → space, trim → empty
    expect(sanitizeString('\x00', 80)).toBe('');
  });

  it('strips embedded NUL in a word', () => {
    const result = sanitizeString('hel\x00lo', 80);
    // NUL replaced with space, trimmed outer whitespace
    expect(result).toBe('hel lo');
  });

  it('strips C0 control char \\x1f (US)', () => {
    expect(sanitizeString('\x1f', 80)).toBe('');
  });

  it('strips DEL (\\x7f)', () => {
    expect(sanitizeString('\x7f', 80)).toBe('');
  });

  it('strips tab (\\x09 is C0 control)', () => {
    // \x09 is within 0x00-0x1F range
    expect(sanitizeString('\x09hello\x09', 80)).toBe('hello');
  });

  it('strips CRLF (\\r\\n are C0 controls)', () => {
    expect(sanitizeString('line1\r\nline2', 80)).toBe('line1  line2');
  });

  it('preserves normal printable ASCII', () => {
    expect(sanitizeString('Hello, World! 123', 80)).toBe('Hello, World! 123');
  });

  it('preserves Unicode non-control characters', () => {
    expect(sanitizeString('Héllo wörld 日本語', 80)).toBe('Héllo wörld 日本語');
  });
});

describe('sanitizeString — trim behavior', () => {
  it('trims leading and trailing spaces', () => {
    expect(sanitizeString('  hello  ', 80)).toBe('hello');
  });

  it('does not trim internal spaces', () => {
    expect(sanitizeString('  hello   world  ', 80)).toBe('hello   world');
  });
});

describe('sanitizeString — length clamping', () => {
  it('returns full string when length <= maxLen', () => {
    expect(sanitizeString('hello', 10)).toBe('hello');
  });

  it('returns full string when length === maxLen exactly', () => {
    expect(sanitizeString('hello', 5)).toBe('hello');
  });

  it('clamps to maxLen when string exceeds it', () => {
    expect(sanitizeString('hello world', 5)).toBe('hello');
  });

  it('clamping is applied after stripping and trimming', () => {
    // After stripping '\x00' → spaces, trim → 'helo', slice(0,3) → 'hel'
    const result = sanitizeString('hel\x00o', 3);
    expect(result.length).toBeLessThanOrEqual(3);
  });

  it('maxLen=0 returns empty string', () => {
    expect(sanitizeString('hello', 0)).toBe('');
  });
});

// ── SAFE_LIMITS ────────────────────────────────────────────────────────────────

describe('SAFE_LIMITS constants', () => {
  it('name limit is 80', () => { expect(SAFE_LIMITS.name).toBe(80); });
  it('recipientId limit is 254 (RFC-5321 email max)', () => { expect(SAFE_LIMITS.recipientId).toBe(254); });
  it('avatar limit is 16', () => { expect(SAFE_LIMITS.avatar).toBe(16); });
  it('preview limit is 200', () => { expect(SAFE_LIMITS.preview).toBe(200); });
  it('messageText limit is 2000', () => { expect(SAFE_LIMITS.messageText).toBe(2000); });
  it('externalId limit is 128', () => { expect(SAFE_LIMITS.externalId).toBe(128); });
  it('providerCode limit is 32', () => { expect(SAFE_LIMITS.providerCode).toBe(32); });

  it('sanitizeString at SAFE_LIMITS.name passes boundary', () => {
    const s = 'a'.repeat(80);
    expect(sanitizeString(s, SAFE_LIMITS.name)).toBe(s);
  });

  it('sanitizeString over SAFE_LIMITS.name is clamped', () => {
    const s = 'a'.repeat(81);
    expect(sanitizeString(s, SAFE_LIMITS.name).length).toBe(80);
  });
});
