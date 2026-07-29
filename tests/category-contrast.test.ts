/**
 * Tile text must be legible against its tile.
 *
 * Reported from a real device: "I can't clearly see what is written on
 * predictions or quick cards, it's light gray." Measured in-browser, white
 * text on the mid-tone category backgrounds came out at 2.2-2.8:1 — well under
 * the WCAG AA minimum of 4.5:1 — and the quick-talk tiles render that at
 * 13.5px. Half the same map already used a dark foreground and measured
 * 9.7-11.3:1 on the identical palette, so the failing half was simply
 * inconsistent, not a considered trade-off.
 *
 * This is a communication device. A tile someone cannot read is a word they
 * cannot say, so this is an accessibility contract rather than styling taste.
 *
 * The ratios are computed here from Tailwind's published sRGB hex values.
 * Deliberately NOT read from a browser: resolving oklch() requires a canvas
 * round trip, and reading the computed value and treating it as RGB produces
 * confident nonsense — it inverted these numbers on the first measurement pass
 * and nearly had me "fix" the three categories that were already correct.
 */
import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

/** Tailwind v4 palette, sRGB hex. Only the shades this file uses. */
const PALETTE: Record<string, string> = {
  'pink-300': '#fda5d5', 'pink-400': '#fb64b6',
  'yellow-400': '#fdc700',
  'green-500': '#00c950',
  'orange-400': '#ff8904',
  'sky-400': '#00bcff',
  'purple-300': '#dab2ff', 'purple-400': '#c27aff',
  'gray-900': '#101828',
  'white': '#ffffff',
  'slate-500': '#62748e',
};

const srgb = (hex: string) => {
  const h = hex.replace('#', '');
  return [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16));
};
const lum = (hex: string) =>
  srgb(hex)
    .map((v) => {
      const c = v / 255;
      return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
    })
    .reduce((a, c, i) => a + c * [0.2126, 0.7152, 0.0722][i], 0);
const ratio = (a: string, b: string) => {
  const [l1, l2] = [lum(a), lum(b)];
  return (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05);
};

/** Pull every "bg-X text-Y" pairing out of the component, so the test reads
 *  the real source rather than a copy that can drift away from it. */
function pairsFromSource(): Array<{ bg: string; fg: string; line: string }> {
  const src = fs.readFileSync(
    path.join(process.cwd(), 'components', 'CategoryPanel.tsx'),
    'utf-8',
  );
  const out: Array<{ bg: string; fg: string; line: string }> = [];
  for (const m of src.matchAll(/bg-([a-z]+-\d{3})\s+text-([a-z]+-?\d*)/g)) {
    out.push({ bg: m[1], fg: m[2], line: m[0].replace(/\s+/g, ' ') });
  }
  return out;
}

describe('category tile contrast', () => {
  const pairs = pairsFromSource();

  it('finds the colour pairings in the component', () => {
    // Guards the regex: if the class strings are refactored, this test must
    // fail loudly rather than silently check nothing.
    expect(pairs.length, 'no bg/text pairings parsed — the regex has drifted').toBeGreaterThan(8);
  });

  it('every tile pairing meets WCAG AA (4.5:1)', () => {
    const failures = pairs
      .map((p) => ({ ...p, r: +ratio(PALETTE[p.bg] ?? '#808080', PALETTE[p.fg] ?? '#808080').toFixed(2) }))
      .filter((p) => PALETTE[p.bg] && PALETTE[p.fg] && p.r < 4.5);
    expect(
      failures.map((f) => `${f.line} = ${f.r}:1`),
      'unreadable tiles — a word the user cannot read is a word they cannot say',
    ).toEqual([]);
  });

  it('knows what failure looks like', () => {
    // The exact pairing that shipped: white on pink-400.
    expect(+ratio(PALETTE['pink-400'], PALETTE.white).toFixed(2)).toBeLessThan(4.5);
    // And the fix.
    expect(+ratio(PALETTE['pink-400'], PALETTE['gray-900']).toFixed(2)).toBeGreaterThan(4.5);
  });
});
