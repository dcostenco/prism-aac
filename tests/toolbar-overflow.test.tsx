/**
 * Toolbar overflow contract — pins the May 2026 "screens overlapping"
 * regression. User installed marketplace apps and the toolbar's
 * `flex-wrap` broke buttons onto a second row, doubling the toolbar
 * height and pushing every panel below DOWN.
 *
 * Fix: single-row strip with horizontal overflow scroll. The button
 * container must NOT be flex-wrap so the toolbar height is invariant
 * to installed-app count.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import Toolbar from '@/components/Toolbar';
import { useSettingsStore } from '@/store/settingsStore';
import { useUIStore } from '@/store/uiStore';

vi.mock('@/engine/useT', () => ({
  useT: () => ({ t: (k: string) => k, ttsCode: 'en-US', rtl: false, ready: true }),
}));
vi.mock('@/services/feedback', () => ({ tapFeedback: vi.fn(), keyFeedback: vi.fn(), alertFeedback: vi.fn(), speakFeedback: vi.fn() }));
vi.mock('@/lib/marketplace/registry', () => ({
  getHandler: () => undefined,
}));
vi.mock('@/store/marketplaceStore', () => ({
  useMarketplaceStore: { getState: () => ({ findBySlug: () => null }) },
}));

beforeEach(() => {
  useSettingsStore.setState({ installedApps: [] });
  useUIStore.setState({ sidePanel: 'none' });
});

describe('Toolbar overflow contract', () => {
  it('renders the button strip as a single non-wrapping row', () => {
    const { container } = render(<Toolbar />);
    const strip = container.querySelector('[data-testid="aac-toolbar-strip"]');
    expect(strip).toBeInTheDocument();
    const cls = strip?.getAttribute('class') || '';
    // Must be flex-nowrap, NOT flex-wrap. Pins the regression: any
    // future refactor that re-introduces flex-wrap will break the
    // CategoryPanel layout because the wrapped second row pushes
    // everything below it down.
    expect(cls).not.toMatch(/\bflex-wrap\b/);
    expect(cls).toMatch(/\bflex-nowrap\b/);
    // Horizontal scroll is how the user reaches buttons that overflow.
    expect(cls).toMatch(/overflow-x-auto/);
  });

  it('strip class does NOT change when many marketplace apps are installed', () => {
    // Simulate 20 installed marketplace apps — the worst-case scenario
    // that originally triggered the wrap-to-2-rows regression.
    const installedApps = Array.from({ length: 20 }, (_, i) => `app-${i}`);
    useSettingsStore.setState({ installedApps });
    const { container } = render(<Toolbar />);
    const strip = container.querySelector('[data-testid="aac-toolbar-strip"]');
    const cls = strip?.getAttribute('class') || '';
    // The class must NOT include flex-wrap regardless of installed count
    expect(cls).not.toMatch(/\bflex-wrap\b/);
    expect(cls).toMatch(/\bflex-nowrap\b/);
  });
});
