import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import MarketplaceCard from '@/components/marketplace/MarketplaceCard';
import MarketplaceTabs, { type MarketplaceTab } from '@/components/marketplace/MarketplaceTabs';
import MarketplaceSearch from '@/components/marketplace/MarketplaceSearch';
import MarketplaceEmptyState from '@/components/marketplace/MarketplaceEmptyState';
import MarketplaceDetail from '@/components/marketplace/MarketplaceDetail';
import type { ModuleManifest } from '@/lib/marketplace/types';

// Stub useT to identity translation so test assertions are stable.
vi.mock('@/engine/useT', () => ({
  useT: () => ({
    t: (key: string) => key,
    ttsCode: 'en-US',
  }),
}));

// Stub feedback so haptic vibrations don't crash jsdom.
vi.mock('@/services/feedback', () => ({
  tapFeedback: vi.fn(),
}));

const VOCAB_FREE: ModuleManifest = {
  slug: 'vocab-my-core',
  version: '1.0.0',
  kind: 'vocab-set',
  tier: 'free',
  category: 'vocab',
  nameKey: 'vs_my_core',
  descKey: 'vs_my_core_desc',
  icon: '⚡',
  status: 'available',
  handlerPayload: { vocabSetId: 'my-core' },
};

const PANEL_LOCKED: ModuleManifest = {
  slug: 'aac-designer',
  version: '0.0.0',
  kind: 'panel',
  tier: 'advanced',
  category: 'tools',
  nameKey: 'mp_aac_designer',
  descKey: 'mp_aac_designer_desc',
  icon: '🎨',
  status: 'coming_soon',
  handlerPayload: { panelId: 'aac-designer' },
};

describe('MarketplaceCard', () => {
  it('renders name and icon', () => {
    render(
      <MarketplaceCard
        manifest={VOCAB_FREE}
        userTier="free"
        active={false}
        onInstall={vi.fn()}
        onLocked={vi.fn()}
      />,
    );
    expect(screen.getByText('vs_my_core')).toBeInTheDocument();
    expect(screen.getByText('⚡')).toBeInTheDocument();
  });

  it('shows install badge for available + tier-OK', () => {
    render(
      <MarketplaceCard
        manifest={VOCAB_FREE}
        userTier="free"
        active={false}
        onInstall={vi.fn()}
        onLocked={vi.fn()}
      />,
    );
    expect(screen.getByText('mp_tap_install')).toBeInTheDocument();
  });

  it('shows active badge when active', () => {
    render(
      <MarketplaceCard
        manifest={VOCAB_FREE}
        userTier="free"
        active={true}
        onInstall={vi.fn()}
        onLocked={vi.fn()}
      />,
    );
    expect(screen.getByText('mp_active')).toBeInTheDocument();
  });

  it('shows coming_soon badge for coming_soon items', () => {
    render(
      <MarketplaceCard
        manifest={PANEL_LOCKED}
        userTier="advanced"
        active={false}
        onInstall={vi.fn()}
        onLocked={vi.fn()}
      />,
    );
    expect(screen.getByText('coming_soon')).toBeInTheDocument();
  });

  it('shows update badge when hasUpdate=true', () => {
    render(
      <MarketplaceCard
        manifest={VOCAB_FREE}
        userTier="free"
        active={true}
        hasUpdate={true}
        onInstall={vi.fn()}
        onLocked={vi.fn()}
      />,
    );
    expect(screen.getByTestId('mp-update-badge-vocab-my-core')).toBeInTheDocument();
  });

  it('calls onInstall when tier OK + available', () => {
    const onInstall = vi.fn();
    const onLocked = vi.fn();
    render(
      <MarketplaceCard
        manifest={VOCAB_FREE}
        userTier="free"
        active={false}
        onInstall={onInstall}
        onLocked={onLocked}
      />,
    );
    fireEvent.click(screen.getByTestId('mp-card-vocab-my-core'));
    expect(onInstall).toHaveBeenCalledWith(VOCAB_FREE);
    expect(onLocked).not.toHaveBeenCalled();
  });

  it('calls onLocked when tier insufficient', () => {
    const onInstall = vi.fn();
    const onLocked = vi.fn();
    render(
      <MarketplaceCard
        manifest={PANEL_LOCKED}
        userTier="free"
        active={false}
        onInstall={onInstall}
        onLocked={onLocked}
      />,
    );
    fireEvent.click(screen.getByTestId('mp-card-aac-designer'));
    expect(onLocked).toHaveBeenCalledWith(PANEL_LOCKED);
    expect(onInstall).not.toHaveBeenCalled();
  });

  it('calls onLocked for coming_soon even with tier access', () => {
    const onInstall = vi.fn();
    const onLocked = vi.fn();
    render(
      <MarketplaceCard
        manifest={PANEL_LOCKED}
        userTier="advanced"
        active={false}
        onInstall={onInstall}
        onLocked={onLocked}
      />,
    );
    fireEvent.click(screen.getByTestId('mp-card-aac-designer'));
    expect(onLocked).toHaveBeenCalled();
  });
});

describe('MarketplaceTabs', () => {
  it('renders all 7 tabs (all + installed + 5 categories)', () => {
    render(<MarketplaceTabs active="all" installedCount={3} onChange={vi.fn()} />);
    expect(screen.getByTestId('mp-tab-all')).toBeInTheDocument();
    expect(screen.getByTestId('mp-tab-installed')).toBeInTheDocument();
    expect(screen.getByTestId('mp-tab-vocab')).toBeInTheDocument();
    expect(screen.getByTestId('mp-tab-games')).toBeInTheDocument();
    expect(screen.getByTestId('mp-tab-voices')).toBeInTheDocument();
    expect(screen.getByTestId('mp-tab-symbols')).toBeInTheDocument();
    expect(screen.getByTestId('mp-tab-tools')).toBeInTheDocument();
  });

  it('shows installed count in installed tab label', () => {
    render(<MarketplaceTabs active="all" installedCount={5} onChange={vi.fn()} />);
    expect(screen.getByTestId('mp-tab-installed').textContent).toContain('(5)');
  });

  it('marks the active tab via aria-selected', () => {
    render(<MarketplaceTabs active="games" installedCount={0} onChange={vi.fn()} />);
    expect(screen.getByTestId('mp-tab-games').getAttribute('aria-selected')).toBe('true');
    expect(screen.getByTestId('mp-tab-all').getAttribute('aria-selected')).toBe('false');
  });

  it('calls onChange when a tab is clicked', () => {
    const onChange = vi.fn();
    render(<MarketplaceTabs active="all" installedCount={0} onChange={onChange} />);
    fireEvent.click(screen.getByTestId('mp-tab-tools'));
    expect(onChange).toHaveBeenCalledWith('tools' as MarketplaceTab);
  });
});

describe('MarketplaceSearch', () => {
  it('shows the placeholder', () => {
    render(<MarketplaceSearch value="" onChange={vi.fn()} />);
    expect(screen.getByPlaceholderText('mp_search_placeholder')).toBeInTheDocument();
  });

  it('emits onChange when typing', () => {
    const onChange = vi.fn();
    render(<MarketplaceSearch value="" onChange={onChange} />);
    fireEvent.change(screen.getByTestId('mp-search'), { target: { value: 'core' } });
    expect(onChange).toHaveBeenCalledWith('core');
  });

  it('shows clear button only when value is non-empty', () => {
    const { rerender } = render(<MarketplaceSearch value="" onChange={vi.fn()} />);
    expect(screen.queryByTestId('mp-search-clear')).toBeNull();
    rerender(<MarketplaceSearch value="foo" onChange={vi.fn()} />);
    expect(screen.getByTestId('mp-search-clear')).toBeInTheDocument();
  });

  it('clear button emits empty string', () => {
    const onChange = vi.fn();
    render(<MarketplaceSearch value="foo" onChange={onChange} />);
    fireEvent.click(screen.getByTestId('mp-search-clear'));
    expect(onChange).toHaveBeenCalledWith('');
  });
});

describe('MarketplaceEmptyState', () => {
  it('renders no-results variant', () => {
    render(<MarketplaceEmptyState variant="no-results" />);
    expect(screen.getByTestId('mp-empty-no-results')).toBeInTheDocument();
    expect(screen.getByText('mp_no_results')).toBeInTheDocument();
  });

  it('renders no-installed variant', () => {
    render(<MarketplaceEmptyState variant="no-installed" />);
    expect(screen.getByTestId('mp-empty-no-installed')).toBeInTheDocument();
  });

  it('renders error variant with message', () => {
    render(<MarketplaceEmptyState variant="error" message="boom" />);
    expect(screen.getByText('boom')).toBeInTheDocument();
  });

  it('renders loading variant', () => {
    render(<MarketplaceEmptyState variant="loading" />);
    expect(screen.getByTestId('mp-empty-loading')).toBeInTheDocument();
  });
});

describe('MarketplaceDetail', () => {
  beforeEach(() => {
    // jsdom misses these — supply minimum stub to silence focus warnings.
    HTMLElement.prototype.scrollIntoView = vi.fn();
  });

  const RICH: ModuleManifest = {
    ...VOCAB_FREE,
    screenshots: ['https://cdn/a.png', 'https://cdn/b.png'],
    deps: ['symbol-libraries'],
    changelog: [{ version: '1.0.0', notes: 'Initial release.' }],
  };

  it('renders hero with name + version', () => {
    render(
      <MarketplaceDetail
        manifest={RICH}
        userTier="free"
        installed={false}
        active={false}
        hasUpdate={false}
        onClose={vi.fn()}
        onInstall={vi.fn()}
        onUninstall={vi.fn()}
      />,
    );
    expect(screen.getByText('vs_my_core')).toBeInTheDocument();
    // Version badge appears in hero AND in changelog — both are valid.
    expect(screen.getAllByText('v1.0.0').length).toBeGreaterThan(0);
  });

  it('shows screenshots when present', () => {
    render(
      <MarketplaceDetail
        manifest={RICH}
        userTier="free"
        installed={false}
        active={false}
        hasUpdate={false}
        onClose={vi.fn()}
        onInstall={vi.fn()}
        onUninstall={vi.fn()}
      />,
    );
    expect(screen.getByTestId('mp-screenshots')).toBeInTheDocument();
  });

  it('shows dependencies list', () => {
    render(
      <MarketplaceDetail
        manifest={RICH}
        userTier="free"
        installed={false}
        active={false}
        hasUpdate={false}
        onClose={vi.fn()}
        onInstall={vi.fn()}
        onUninstall={vi.fn()}
      />,
    );
    expect(screen.getByTestId('mp-deps')).toBeInTheDocument();
    expect(screen.getByText('symbol-libraries')).toBeInTheDocument();
  });

  it('shows changelog when present', () => {
    render(
      <MarketplaceDetail
        manifest={RICH}
        userTier="free"
        installed={false}
        active={false}
        hasUpdate={false}
        onClose={vi.fn()}
        onInstall={vi.fn()}
        onUninstall={vi.fn()}
      />,
    );
    expect(screen.getByTestId('mp-changelog')).toBeInTheDocument();
    // Changelog body is split across <span> + text node — use partial match.
    expect(screen.getByTestId('mp-changelog').textContent).toContain('Initial release.');
  });

  it('Install action calls onInstall once for not-installed module', () => {
    const onInstall = vi.fn();
    render(
      <MarketplaceDetail
        manifest={VOCAB_FREE}
        userTier="free"
        installed={false}
        active={false}
        hasUpdate={false}
        onClose={vi.fn()}
        onInstall={onInstall}
        onUninstall={vi.fn()}
      />,
    );
    fireEvent.click(screen.getByTestId('mp-detail-action'));
    expect(onInstall).toHaveBeenCalledWith(VOCAB_FREE);
  });

  it('Uninstall flow requires 2 taps to confirm', () => {
    const onUninstall = vi.fn();
    render(
      <MarketplaceDetail
        manifest={VOCAB_FREE}
        userTier="free"
        installed={true}
        active={true}
        hasUpdate={false}
        onClose={vi.fn()}
        onInstall={vi.fn()}
        onUninstall={onUninstall}
      />,
    );
    // First tap — moves to confirm state.
    fireEvent.click(screen.getByTestId('mp-detail-action'));
    expect(onUninstall).not.toHaveBeenCalled();
    expect(screen.getByText('mp_uninstall_confirm')).toBeInTheDocument();
    // Second tap — actually uninstalls.
    fireEvent.click(screen.getByTestId('mp-detail-action'));
    expect(onUninstall).toHaveBeenCalledWith(VOCAB_FREE);
  });

  it('Uninstall confirm can be cancelled', () => {
    const onUninstall = vi.fn();
    render(
      <MarketplaceDetail
        manifest={VOCAB_FREE}
        userTier="free"
        installed={true}
        active={true}
        hasUpdate={false}
        onClose={vi.fn()}
        onInstall={vi.fn()}
        onUninstall={onUninstall}
      />,
    );
    fireEvent.click(screen.getByTestId('mp-detail-action'));
    fireEvent.click(screen.getByTestId('mp-detail-cancel-uninstall'));
    expect(onUninstall).not.toHaveBeenCalled();
  });

  it('Action button is disabled for coming_soon', () => {
    render(
      <MarketplaceDetail
        manifest={PANEL_LOCKED}
        userTier="advanced"
        installed={false}
        active={false}
        hasUpdate={false}
        onClose={vi.fn()}
        onInstall={vi.fn()}
        onUninstall={vi.fn()}
      />,
    );
    expect(screen.getByTestId('mp-detail-action')).toBeDisabled();
  });

  it('Action button is disabled when tier insufficient', () => {
    render(
      <MarketplaceDetail
        manifest={PANEL_LOCKED}
        userTier="free"
        installed={false}
        active={false}
        hasUpdate={false}
        onClose={vi.fn()}
        onInstall={vi.fn()}
        onUninstall={vi.fn()}
      />,
    );
    expect(screen.getByTestId('mp-detail-action')).toBeDisabled();
  });

  it('Close button calls onClose', () => {
    const onClose = vi.fn();
    render(
      <MarketplaceDetail
        manifest={VOCAB_FREE}
        userTier="free"
        installed={false}
        active={false}
        hasUpdate={false}
        onClose={onClose}
        onInstall={vi.fn()}
        onUninstall={vi.fn()}
      />,
    );
    fireEvent.click(screen.getByTestId('mp-detail-close'));
    expect(onClose).toHaveBeenCalled();
  });
});
