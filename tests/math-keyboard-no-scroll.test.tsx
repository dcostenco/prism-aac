/**
 * Math keyboard — no-pagination + no-scroll invariant.
 *
 * User report 2026-05-08 (Image #24, #25):
 *   • "scrollable keyboard is unacceptable when typing codes" — the
 *     Programming chip's identifier row paginated a-p / q-z and the
 *     panel had overflow-y-auto, hiding rows behind a scrollbar.
 *   • "a-z should be full a-z - fix it" — same pagination on the
 *     Letters chip forced an extra tap to reach q-z.
 *
 * The fix:
 *   1. MathLettersKeyboard renders all 26 letters in one grid.
 *   2. MathProgrammingKeyboard does the same (full a-z + Aa shift,
 *      no q-z toggle).
 *   3. The math-keyboard-panel container uses overflow-hidden, not
 *      overflow-y-auto, with a height bumped to clamp(280, 32svh,
 *      380px) so the taller programming layout fits.
 *
 * This test pins all three.
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
  it('uses overflow-hidden, not overflow-y-auto', () => {
    const { container } = render(<MathKeyboardRegion />);
    const panel = container.querySelector('[data-testid="math-keyboard-panel"]') as HTMLElement;
    expect(panel).not.toBeNull();
    expect(panel.className).toMatch(/overflow-hidden/);
    expect(panel.className).not.toMatch(/overflow-y-auto/);
  });

  it('panel-height floor is ≥ 380 px so Programming rows never get clipped', () => {
    // Earlier capture against the live deploy showed only 5 of the
    // Programming chip's 7 rows visible (ops × 2 + keywords × 3),
    // with letters + digits clipped. The fix bumped the lower bound
    // from 280 px → 380 px. Pin it so a future "tighten layout"
    // refactor can't drop it back below the 7-row threshold.
    const { container } = render(<MathKeyboardRegion />);
    const panel = container.querySelector('[data-testid="math-keyboard-panel"]') as HTMLElement;
    const m = panel.className.match(/clamp\((\d+)px/);
    expect(m, `expected clamp() with px floor in ${panel.className}`).not.toBeNull();
    const floorPx = m ? Number(m[1]) : 0;
    expect(floorPx).toBeGreaterThanOrEqual(380);
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

describe('Programming keyboard — full a-z + Aa shift, no q-z toggle', () => {
  it('python: all 26 letters render at once', () => {
    useMathGridStore.setState({ activeMathCategory: 'programming-python' });
    const { container } = render(<MathKeyboardRegion />);
    for (const ltr of 'abcdefghijklmnopqrstuvwxyz') {
      const tile = container.querySelector(`[data-testid="math-python-ltr-${ltr}"]`);
      expect(tile, `python keyboard missing letter "${ltr}"`).not.toBeNull();
    }
    // Aa shift remains.
    expect(
      container.querySelector('[data-testid="math-python-letters-shift"]'),
    ).not.toBeNull();
    // q-z page toggle is gone.
    expect(
      container.querySelector('[data-testid="math-python-letters-page-toggle"]'),
    ).toBeNull();
  });

  it('java: all 26 letters render at once', () => {
    useMathGridStore.setState({ activeMathCategory: 'programming-java' });
    const { container } = render(<MathKeyboardRegion />);
    for (const ltr of 'abcdefghijklmnopqrstuvwxyz') {
      const tile = container.querySelector(`[data-testid="math-java-ltr-${ltr}"]`);
      expect(tile, `java keyboard missing letter "${ltr}"`).not.toBeNull();
    }
    expect(
      container.querySelector('[data-testid="math-java-letters-page-toggle"]'),
    ).toBeNull();
  });
});
