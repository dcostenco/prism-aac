/**
 * Music keyboard — every rendered glyph MUST be BMP-only.
 *
 * User report May 2026 (Image #17/#18): the Music tab rendered most
 * tiles as ☒ tofu — whole/half/sixteenth notes, all rests, double-
 * sharp / double-flat. Root cause: those symbols come from the Unicode
 * SMP "Musical Symbols" block (U+1D100–U+1D1FF), which stock fonts on
 * iOS / Android / Linux don't ship glyphs for. BMP music codepoints
 * (U+2660–U+266F: ♩ ♪ ♫ ♬ ♭ ♮ ♯) render universally.
 *
 * This test renders the actual MathMusicKeyboard component and asserts
 * that every visible glyph (not the label, the on-tile character) is
 * either:
 *   • a BMP codepoint (≤ U+FFFF), or
 *   • a plain ASCII fallback ("W", "H", "WR", "##", etc.).
 *
 * If a future change re-introduces an SMP music codepoint (any char
 * with charCodeAt ≥ 0xD800 — surrogate pair), this test fails with the
 * specific tile + glyph that broke.
 */
import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { useMathGridStore } from '@/store/mathGridStore';
import { vi, beforeEach } from 'vitest';
import MathKeyboardRegion from '@/components/math/MathKeyboardRegion';

vi.mock('@/engine/useT', () => ({
  useT: () => ({ t: (k: string) => k, ttsCode: 'en-US', rtl: false, ready: true }),
}));
vi.mock('@/services/feedback', () => ({ tapFeedback: vi.fn(), keyFeedback: vi.fn() }));

beforeEach(() => {
  useMathGridStore.setState({ activeMathCategory: 'music' });
});

/** Returns true if the string contains any non-BMP (surrogate-pair)
 *  codepoint — i.e. anything that fonts without SMP coverage will
 *  render as ☒ tofu on the AAC user's device. */
function isNonBMP(s: string): boolean {
  for (let i = 0; i < s.length; i++) {
    const code = s.charCodeAt(i);
    if (code >= 0xD800 && code <= 0xDFFF) return true;
  }
  return false;
}

describe('Music keyboard — glyph BMP-only invariant', () => {
  it('every rendered tile glyph is BMP-only (no SMP tofu on stock fonts)', () => {
    const { container } = render(<MathKeyboardRegion />);
    // Each music glyph tile is rendered as a button with data-glyph-key.
    // We check both the button text content (the visible glyph) and
    // the data-glyph attribute used by tap commits.
    const tiles = container.querySelectorAll('[data-glyph]');
    expect(tiles.length).toBeGreaterThan(0);
    const offenders: string[] = [];
    for (const tile of Array.from(tiles)) {
      const visibleGlyph = tile.textContent?.trim() ?? '';
      const dataGlyph = tile.getAttribute('data-glyph') ?? '';
      const testid = tile.getAttribute('data-testid') ?? '';
      // We only enforce the BMP rule on MUSIC tiles. Other keyboards
      // (chemistry, statistics, history) intentionally use SMP / emoji
      // codepoints that DO have font coverage on most platforms.
      if (!testid.includes('music')) continue;
      if (isNonBMP(visibleGlyph)) {
        offenders.push(`${testid} visible="${visibleGlyph}" (codepoints: ${[...visibleGlyph].map(c => 'U+' + c.codePointAt(0)?.toString(16).padStart(4, '0').toUpperCase()).join(' ')})`);
      }
      if (dataGlyph && isNonBMP(dataGlyph)) {
        offenders.push(`${testid} data-glyph="${dataGlyph}" (codepoints: ${[...dataGlyph].map(c => 'U+' + c.codePointAt(0)?.toString(16).padStart(4, '0').toUpperCase()).join(' ')})`);
      }
    }
    expect(offenders, `SMP-block music glyphs render as ☒ tofu on iOS/Android/Linux stock fonts:\n  ${offenders.join('\n  ')}`).toEqual([]);
  });
});
