/**
 * MathKeyboardRegion — all category tabs render real content.
 *
 * Pins that NONE of the 18 categories show a placeholder or
 * "coming soon" message. Each tab must render at least one button
 * with a data-glyph attribute (indicating real keyboard content).
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import MathKeyboardRegion from '@/components/math/MathKeyboardRegion';
import { useMathGridStore, type MathCategoryId } from '@/store/mathGridStore';
import { useSettingsStore } from '@/store/settingsStore';

vi.mock('@/services/feedback', () => ({ tapFeedback: vi.fn(), keyFeedback: vi.fn() }));
vi.mock('@/engine/historyRegions', () => ({ eventsForRegion: () => [] }));

const ALL_CATEGORIES: MathCategoryId[] = [
  'main', 'adv-math', 'letters', 'misc-math',
  'time-distance', 'weight', 'volume', 'geom', 'money',
  'chemistry', 'physics', 'programming-python', 'programming-java',
  'biology', 'statistics', 'music', 'earth-science',
  'history', 'language-arts',
];

describe('MathKeyboardRegion — all categories show real content', () => {
  beforeEach(() => {
    useSettingsStore.setState({ language: 'en', historyRegion: undefined });
  });

  for (const cat of ALL_CATEGORIES) {
    it(`${cat} renders at least one key with a glyph (no placeholder)`, () => {
      useMathGridStore.setState({ activeMathCategory: cat });
      const { container } = render(<MathKeyboardRegion />);
      const panel = container.querySelector('[data-testid="math-keyboard-panel"]');
      expect(panel).not.toBeNull();
      // Must have at least one button with data-glyph (real keyboard key)
      const keys = panel!.querySelectorAll('button[data-glyph]');
      expect(keys.length, `${cat}: expected real keys, got 0`).toBeGreaterThan(0);
      // Must NOT contain any placeholder text
      const text = panel!.textContent || '';
      expect(text).not.toMatch(/coming in 2C/i);
      expect(text).not.toMatch(/coming soon/i);
      expect(text).not.toMatch(/placeholder/i);
    });
  }
});
