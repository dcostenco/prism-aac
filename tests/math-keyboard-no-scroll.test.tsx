/**
 * Math keyboard — no-scroll invariant.
 *
 * History of fixes:
 *   2026-05-08: Programming chip paginated a-p/q-z and had overflow-y-auto
 *               hiding rows. Fixed with 14-col keyword packing + overflow-hidden
 *               + raised floor.
 *   2026-05-09: Letters row removed from Programming keyboards — the 'a a-z'
 *               chip covers identifiers. Digits + extras merged into one row
 *               (6→6 rows → fits 300px floor). Panel switched to overflow-y-auto
 *               as graceful fallback; floor reduced to 300px to give canvas more
 *               room (~120px more than before).
 *
 * This test pins the current invariants.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import MathKeyboardRegion from '@/components/math/MathKeyboardRegion';
import { useMathGridStore } from '@/store/mathGridStore';

vi.mock('@/engine/useT', () => ({
  useT: () => ({ t: (k: string) => k, ttsCode: 'en-US', rtl: false, ready: true }),
}));
vi.mock('@/services/feedback', () => ({ tapFeedback: vi.fn(), keyFeedback: vi.fn() }));

beforeEach(() => {
  useMathGridStore.setState({ activeMathCategory: 'letters' });
});

describe('Math keyboard — no-scroll panel container', () => {
  it('uses overflow-y-auto (graceful fallback) not overflow-hidden', () => {
    const { container } = render(<MathKeyboardRegion />);
    const panel = container.querySelector('[data-testid="math-keyboard-panel"]') as HTMLElement;
    expect(panel).not.toBeNull();
    expect(panel.className).toMatch(/overflow-y-auto/);
  });

  it('panel-height floor is ≥ 280 px and ≤ 320 px (canvas-proportionate)', () => {
    // Programming keyboard is now 6 rows (ops×2, keywords×2, builtins×1,
    // digits+extras×1) at ~50px each ≈ 300px. Floor must be ≥ 280px so
    // all rows fit without clipping, and ≤ 320px so the canvas keeps
    // at least 200px on a 700px viewport.
    const { container } = render(<MathKeyboardRegion />);
    const panel = container.querySelector('[data-testid="math-keyboard-panel"]') as HTMLElement;
    const m = panel.className.match(/clamp\((\d+)px/);
    expect(m, `expected clamp() with px floor in ${panel.className}`).not.toBeNull();
    const floorPx = m ? Number(m[1]) : 0;
    expect(floorPx).toBeGreaterThanOrEqual(280);
    expect(floorPx).toBeLessThanOrEqual(320);
  });
});

describe('Letters keyboard — full a-z, no pagination', () => {
  beforeEach(() => {
    useMathGridStore.setState({ activeMathCategory: 'letters' });
  });

  it('renders all 26 letters at once', () => {
    const { container } = render(<MathKeyboardRegion />);
    for (const ltr of 'abcdefghijklmnopqrstuvwxyz') {
      const tile = container.querySelector(`[data-testid="math-key-ltr-${ltr}"]`);
      expect(tile, `letter "${ltr}" missing from a-z keyboard`).not.toBeNull();
    }
  });

  it('does NOT render the q-z page toggle button', () => {
    const { container } = render(<MathKeyboardRegion />);
    expect(
      container.querySelector('[data-testid="math-letters-page-toggle"]'),
    ).toBeNull();
  });
});

describe('Programming keyboard — digits present, letters in a-z tab', () => {
  it('python: all 10 digits and underscore render', () => {
    useMathGridStore.setState({ activeMathCategory: 'programming-python' });
    const { container } = render(<MathKeyboardRegion />);
    for (const d of '0123456789') {
      const tile = container.querySelector(`[data-testid="math-python-digit-${d}"]`);
      expect(tile, `python keyboard missing digit "${d}"`).not.toBeNull();
    }
    expect(container.querySelector('[data-testid="math-python-underscore"]')).not.toBeNull();
  });

  it('java: all 10 digits render', () => {
    useMathGridStore.setState({ activeMathCategory: 'programming-java' });
    const { container } = render(<MathKeyboardRegion />);
    for (const d of '0123456789') {
      const tile = container.querySelector(`[data-testid="math-java-digit-${d}"]`);
      expect(tile, `java keyboard missing digit "${d}"`).not.toBeNull();
    }
  });

  it('python: letters NOT in programming tab (use a-z chip instead)', () => {
    useMathGridStore.setState({ activeMathCategory: 'programming-python' });
    const { container } = render(<MathKeyboardRegion />);
    // Letters row was removed — 'a a-z' chip covers identifier entry.
    // No letter buttons with data-testid="math-python-ltr-*" should exist.
    expect(container.querySelector('[data-testid="math-python-ltr-a"]')).toBeNull();
    expect(container.querySelector('[data-testid="math-python-letters-shift"]')).toBeNull();
  });

  it('python: keywords and builtins still present', () => {
    useMathGridStore.setState({ activeMathCategory: 'programming-python' });
    const { container } = render(<MathKeyboardRegion />);
    // Keywords (def, return, print are in PYTHON_KEYWORDS).
    expect(container.querySelector('[data-testid="math-python-kw-def"]')).not.toBeNull();
    expect(container.querySelector('[data-testid="math-python-kw-return"]')).not.toBeNull();
    // Builtins row (sum, max, min… — PYTHON_BUILTINS; print is in keywords not builtins).
    expect(container.querySelector('[data-testid="math-python-builtin-sum"]')).not.toBeNull();
  });
});
