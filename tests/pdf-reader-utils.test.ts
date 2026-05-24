/**
 * pdfReader — isUnreadable and PDF_UNREADABLE_PREFIX pure utility
 *
 * isUnreadable determines which pages are excluded from speak-all and
 * the character count total. A broken check would either:
 *   - Include sentinel error pages in the "read aloud" flow (user hears
 *     "⛔ Page 3 — could not be read" spoken at normal TTS speed), or
 *   - Mark valid short pages as unreadable and silently skip them
 *     (user notices content is missing).
 *
 * The sentinel prefix distinguishes true extraction failures from
 * legitimate empty pages (image-only PDFs). The length < 200 guard
 * prevents a real PDF that happens to start with ⛔ from being
 * misclassified as an error page.
 */
import { describe, it, expect } from 'vitest';
import { isUnreadable, PDF_UNREADABLE_PREFIX } from '@/services/pdfReader';
import type { PdfPage } from '@/services/pdfReader';

function makePage(text: string, pageNumber = 1): PdfPage {
  return { pageNumber, text };
}

// ── PDF_UNREADABLE_PREFIX ─────────────────────────────────────────────────────

describe('PDF_UNREADABLE_PREFIX', () => {
  it('is a non-empty string', () => {
    expect(typeof PDF_UNREADABLE_PREFIX).toBe('string');
    expect(PDF_UNREADABLE_PREFIX.length).toBeGreaterThan(0);
  });
});

// ── isUnreadable ──────────────────────────────────────────────────────────────

describe('isUnreadable', () => {
  it('returns true for a short error-prefixed page', () => {
    const page = makePage(`${PDF_UNREADABLE_PREFIX}Page 2 — getPage failed: timeout`);
    expect(isUnreadable(page)).toBe(true);
  });

  it('returns false for a page with normal text', () => {
    const page = makePage('Annual report for 2025. Revenue grew 12% year over year.');
    expect(isUnreadable(page)).toBe(false);
  });

  it('returns false for an empty page (image-only, no text layer)', () => {
    expect(isUnreadable(makePage(''))).toBe(false);
  });

  it('returns false when text starts with prefix but is ≥200 chars (real content)', () => {
    // A real PDF where the first line happens to start with ⛔ emoji but has lots of content
    const longContent = `${PDF_UNREADABLE_PREFIX}${'x'.repeat(250)}`;
    const page = makePage(longContent);
    expect(isUnreadable(page)).toBe(false);
  });

  it('returns true at the 199-char boundary (still < 200)', () => {
    const text = `${PDF_UNREADABLE_PREFIX}${'e'.repeat(199 - PDF_UNREADABLE_PREFIX.length)}`;
    expect(text.length).toBeLessThan(200);
    expect(isUnreadable(makePage(text))).toBe(true);
  });

  it('returns false at exactly 200 chars (length guard: < 200)', () => {
    const pad = 200 - PDF_UNREADABLE_PREFIX.length;
    const text = `${PDF_UNREADABLE_PREFIX}${'e'.repeat(pad)}`;
    expect(text.length).toBe(200);
    expect(isUnreadable(makePage(text))).toBe(false);
  });

  it('returns false when prefix is absent (normal extraction failure message without sentinel)', () => {
    expect(isUnreadable(makePage('Page 2 — could not be read: unknown'))).toBe(false);
  });
});
