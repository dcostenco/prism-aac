/**
 * A theme must never declare light text on light surfaces (or dark on dark).
 *
 * `@media (prefers-contrast: more)` pointed `:root` — the LIGHT theme — at a
 * dark palette: `--text-primary: #FFFFFF` over `--bg-surface: #0a0a0a`. That
 * reads fine in isolation, but the block overrides only custom properties,
 * and much of the board paints its surfaces with Tailwind utilities
 * (`bg-white` on the prediction tiles, the message bar). Those stayed white
 * while the text turned white with them.
 *
 * Result: switching on iOS Accessibility > Increase Contrast made the board
 * unreadable. Reported from an iPhone — prediction labels and message text
 * showing as pale grey on white. The setting exists to help exactly the users
 * it was hurting.
 *
 * This parses globals.css and checks each theme block's own text/background
 * pairs, so a future palette edit that reintroduces the inversion fails here
 * rather than on someone's device.
 */
import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

const CSS = fs.readFileSync(path.join(process.cwd(), 'app', 'globals.css'), 'utf-8');

const hexToRgb = (h: string) => {
  const s = h.replace('#', '');
  const f = s.length === 3 ? s.split('').map((c) => c + c).join('') : s;
  return [0, 2, 4].map((i) => parseInt(f.slice(i, i + 2), 16));
};
const lum = (hex: string) =>
  hexToRgb(hex)
    .map((v) => {
      const c = v / 255;
      return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
    })
    .reduce((a, c, i) => a + c * [0.2126, 0.7152, 0.0722][i], 0);
const ratio = (a: string, b: string) => {
  const [l1, l2] = [lum(a), lum(b)];
  return (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05);
};

/** Every `selector { ... }` block that declares BOTH a text and a bg colour. */
function themeBlocks() {
  const out: Array<{ sel: string; text?: string; surface?: string; app?: string }> = [];
  for (const m of CSS.matchAll(/([.:][\w-]+(?:\s*,\s*[.:][\w-]+)*)\s*\{([^}]*)\}/g)) {
    const body = m[2];
    const get = (name: string) => body.match(new RegExp(`--${name}:\\s*(#[0-9a-fA-F]{3,6})`))?.[1];
    const text = get('text-primary');
    if (!text) continue;
    out.push({ sel: m[1].trim(), text, surface: get('bg-surface'), app: get('bg-app') });
  }
  return out;
}

describe('theme contrast', () => {
  const blocks = themeBlocks();

  it('parses the theme blocks', () => {
    // If the CSS is restructured, fail loudly rather than assert nothing.
    expect(blocks.length, 'no theme blocks parsed — the regex has drifted').toBeGreaterThan(2);
  });

  it('every theme keeps its own text readable on its own surfaces', () => {
    const failures: string[] = [];
    for (const b of blocks) {
      for (const [name, bg] of [['bg-surface', b.surface], ['bg-app', b.app]] as const) {
        if (!bg) continue;
        const r = ratio(b.text!, bg);
        if (r < 4.5) failures.push(`${b.sel}: text ${b.text} on ${name} ${bg} = ${r.toFixed(2)}:1`);
      }
    }
    expect(failures, 'unreadable theme pairing').toEqual([]);
  });

  it('does not force a dark palette onto the light theme under prefers-contrast', () => {
    // The specific regression: :root inside the media query must not adopt a
    // light foreground, because the surfaces around it are Tailwind-painted
    // and stay light.
    const block = CSS.match(/@media \(prefers-contrast: more\)\s*\{([\s\S]*?)\n\}/)?.[1] ?? '';
    const rootBody = block.match(/:root\s*\{([^}]*)\}/)?.[1] ?? '';
    const text = rootBody.match(/--text-primary:\s*(#[0-9a-fA-F]{3,6})/)?.[1];
    expect(text, 'prefers-contrast :root sets no --text-primary').toBeTruthy();
    // Light theme surfaces are #ffffff / #f6f7fb.
    expect(
      ratio(text!, '#ffffff'),
      `--text-primary ${text} is unreadable on the light theme's white surfaces`,
    ).toBeGreaterThan(4.5);
  });
});
