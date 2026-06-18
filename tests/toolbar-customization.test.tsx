/**
 * ToolbarCustomization — toolbar reorder/toggle/reset tests
 *
 * Covers: built-in rendering, enabled/disabled state, reset, move up/down,
 * toggle, settings lock, marketplace app uninstall.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import ToolbarCustomization from '@/components/ToolbarCustomization';
import type { ToolbarButtonId } from '@/store/settingsStore';

// ── store mock ────────────────────────────────────────────────────────────────

const toggleMock = vi.fn();
const moveMock = vi.fn();
const resetMock = vi.fn();
const uninstallAppMock = vi.fn();

const settingsState = {
  toolbarConfig: {
    order: ['categories', 'mic', 'alert', 'settings'] as ToolbarButtonId[],
    enabled: {} as Partial<Record<ToolbarButtonId, boolean>>,
  },
  installedApps: [] as string[],
  toolbarToggle: toggleMock,
  toolbarMove: moveMock,
  toolbarReset: resetMock,
  uninstallApp: uninstallAppMock,
};

vi.mock('@/store/settingsStore', () => ({
  useSettingsStore: (sel?: (s: typeof settingsState) => unknown) =>
    sel ? sel(settingsState) : settingsState,
  DEFAULT_TOOLBAR_ORDER: ['categories', 'mic', 'alert', 'settings'],
}));

vi.mock('@/services/feedback', () => ({ tapFeedback: vi.fn(), alertFeedback: vi.fn(), speakFeedback: vi.fn() }));

beforeEach(() => {
  vi.clearAllMocks();
  settingsState.toolbarConfig = {
    order: ['categories', 'mic', 'alert', 'settings'] as ToolbarButtonId[],
    enabled: {},
  };
  settingsState.installedApps = [];
});

// ── rendering ─────────────────────────────────────────────────────────────────

describe('ToolbarCustomization — rendering', () => {
  it('renders each button from toolbarConfig.order', () => {
    render(<ToolbarCustomization />);
    expect(screen.getByText('Categories')).toBeInTheDocument();
    expect(screen.getByText('Microphone')).toBeInTheDocument();
    expect(screen.getByText('Emergency Alert')).toBeInTheDocument();
    expect(screen.getByText('Settings')).toBeInTheDocument();
  });

  it('renders Reset button', () => {
    render(<ToolbarCustomization />);
    expect(screen.getByRole('button', { name: /reset toolbar/i })).toBeInTheDocument();
  });
});

// ── enabled / disabled state ──────────────────────────────────────────────────

describe('ToolbarCustomization — visibility state', () => {
  it('toggle button shows aria-pressed=true for enabled buttons', () => {
    render(<ToolbarCustomization />);
    // Categories is enabled by default (no explicit false in enabled map)
    const toggleBtn = screen.getByRole('button', { name: /Hide Categories/i });
    expect(toggleBtn).toHaveAttribute('aria-pressed', 'true');
  });

  it('toggle button shows aria-pressed=false for explicitly disabled buttons', () => {
    settingsState.toolbarConfig.enabled['categories' as ToolbarButtonId] = false;
    render(<ToolbarCustomization />);
    const toggleBtn = screen.getByRole('button', { name: /Show Categories/i });
    expect(toggleBtn).toHaveAttribute('aria-pressed', 'false');
  });

  it('shows "(hidden)" label for disabled buttons', () => {
    settingsState.toolbarConfig.enabled['mic' as ToolbarButtonId] = false;
    render(<ToolbarCustomization />);
    expect(screen.getByText('(hidden)')).toBeInTheDocument();
  });

  it('settings button shows lock icon instead of toggle', () => {
    render(<ToolbarCustomization />);
    // Settings row has a 🔒 span, not a toggle button
    expect(screen.queryByRole('button', { name: /Hide Settings/i })).toBeNull();
    expect(screen.queryByRole('button', { name: /Show Settings/i })).toBeNull();
  });
});

// ── reset ─────────────────────────────────────────────────────────────────────

describe('ToolbarCustomization — reset', () => {
  it('Reset button calls toolbarReset', () => {
    render(<ToolbarCustomization />);
    fireEvent.click(screen.getByRole('button', { name: /reset toolbar/i }));
    expect(resetMock).toHaveBeenCalledOnce();
  });
});

// ── move ──────────────────────────────────────────────────────────────────────

describe('ToolbarCustomization — move buttons', () => {
  it('Move up button calls toolbarMove(id, -1)', () => {
    render(<ToolbarCustomization />);
    // mic is index 1 — has both up and down available
    fireEvent.click(screen.getByRole('button', { name: /Move Microphone up/i }));
    expect(moveMock).toHaveBeenCalledWith('mic', -1);
  });

  it('Move down button calls toolbarMove(id, 1)', () => {
    render(<ToolbarCustomization />);
    fireEvent.click(screen.getByRole('button', { name: /Move Microphone down/i }));
    expect(moveMock).toHaveBeenCalledWith('mic', 1);
  });

  it('first item has Move up button disabled', () => {
    render(<ToolbarCustomization />);
    expect(screen.getByRole('button', { name: /Move Categories up/i })).toBeDisabled();
  });

  it('last item has Move down button disabled', () => {
    render(<ToolbarCustomization />);
    expect(screen.getByRole('button', { name: /Move Settings down/i })).toBeDisabled();
  });
});

// ── toggle ────────────────────────────────────────────────────────────────────

describe('ToolbarCustomization — toggle', () => {
  it('clicking toggle calls toolbarToggle with the button id', () => {
    render(<ToolbarCustomization />);
    fireEvent.click(screen.getByRole('button', { name: /Hide Categories/i }));
    expect(toggleMock).toHaveBeenCalledWith('categories');
  });
});

// ── marketplace apps ───────────────────────────────────────────────────────────

describe('ToolbarCustomization — marketplace apps', () => {
  it('renders installed app with (marketplace) label', () => {
    settingsState.installedApps = ['symbol-libraries'];
    render(<ToolbarCustomization />);
    expect(screen.getByText('(marketplace)')).toBeInTheDocument();
    expect(screen.getByText('Symbol Libraries')).toBeInTheDocument();
  });

  it('uninstall button calls uninstallApp with the app id', () => {
    settingsState.installedApps = ['symbol-libraries'];
    render(<ToolbarCustomization />);
    fireEvent.click(screen.getByRole('button', { name: /Uninstall Symbol Libraries/i }));
    expect(uninstallAppMock).toHaveBeenCalledWith('symbol-libraries');
  });
});
