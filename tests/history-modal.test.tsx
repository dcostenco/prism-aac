/**
 * HistoryModal — message history dialog tests
 *
 * Covers: render gating, empty state, history list, entry click (setText +
 * close), clear all, Escape key dismissal, outside-click dismissal.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import HistoryModal from '@/components/HistoryModal';

// ── store mocks ───────────────────────────────────────────────────────────────

const toggleHistoryMock = vi.fn();
const setTextMock = vi.fn();
const clearHistoryMock = vi.fn();

const uiState = {
  showHistory: false as boolean,
  toggleHistory: toggleHistoryMock,
};

const messageState = {
  history: [] as Array<{ text: string; timestamp: number }>,
  setText: setTextMock,
  clearHistory: clearHistoryMock,
};

vi.mock('@/store/uiStore', () => ({
  useUIStore: () => uiState,
}));

vi.mock('@/store/messageStore', () => ({
  useMessageStore: () => messageState,
}));

vi.mock('@/store/settingsStore', () => ({
  useSettingsStore: (sel?: (s: { language: string }) => unknown) =>
    sel ? sel({ language: 'en' }) : { language: 'en' },
}));

vi.mock('@/engine/useT', () => ({
  useT: () => ({
    t: (k: string) => k,
    ttsCode: 'en-US',
    rtl: false,
    ready: true,
  }),
}));

beforeEach(() => {
  vi.clearAllMocks();
  uiState.showHistory = false;
  messageState.history = [];
});

// ── render gating ─────────────────────────────────────────────────────────────

describe('HistoryModal — render gating', () => {
  it('renders nothing when showHistory=false', () => {
    const { container } = render(<HistoryModal />);
    expect(container.firstChild).toBeNull();
  });

  it('renders dialog when showHistory=true', () => {
    uiState.showHistory = true;
    render(<HistoryModal />);
    expect(screen.getByRole('dialog')).toBeInTheDocument();
  });
});

// ── empty state ───────────────────────────────────────────────────────────────

describe('HistoryModal — empty history', () => {
  beforeEach(() => { uiState.showHistory = true; });

  it('shows no_history message when history is empty', () => {
    render(<HistoryModal />);
    expect(screen.getByText('no_history')).toBeInTheDocument();
  });

  it('does not show Clear All button when history is empty', () => {
    render(<HistoryModal />);
    expect(screen.queryByText('clear_all')).toBeNull();
  });
});

// ── populated history ─────────────────────────────────────────────────────────

describe('HistoryModal — populated history', () => {
  const TS = 1716480000000; // 2026-05-23

  beforeEach(() => {
    uiState.showHistory = true;
    messageState.history = [
      { text: 'I need water', timestamp: TS },
      { text: 'Help me please', timestamp: TS + 60_000 },
    ];
  });

  it('renders each history entry text', () => {
    render(<HistoryModal />);
    expect(screen.getByText('I need water')).toBeInTheDocument();
    expect(screen.getByText('Help me please')).toBeInTheDocument();
  });

  it('shows Clear All button when history is non-empty', () => {
    render(<HistoryModal />);
    expect(screen.getByText('clear_all')).toBeInTheDocument();
  });

  it('clicking Clear All calls clearHistory', () => {
    render(<HistoryModal />);
    fireEvent.click(screen.getByText('clear_all'));
    expect(clearHistoryMock).toHaveBeenCalledOnce();
  });

  it('clicking a history entry calls setText with that entry text', () => {
    render(<HistoryModal />);
    fireEvent.click(screen.getByText('I need water'));
    expect(setTextMock).toHaveBeenCalledWith('I need water');
  });

  it('clicking a history entry calls toggleHistory to close', () => {
    render(<HistoryModal />);
    fireEvent.click(screen.getByText('I need water'));
    expect(toggleHistoryMock).toHaveBeenCalled();
  });
});

// ── dismissal ─────────────────────────────────────────────────────────────────

describe('HistoryModal — dismissal', () => {
  beforeEach(() => { uiState.showHistory = true; });

  it('close button calls toggleHistory', () => {
    render(<HistoryModal />);
    fireEvent.click(screen.getByRole('button', { name: /close_history/i }));
    expect(toggleHistoryMock).toHaveBeenCalledOnce();
  });

  it('Escape key calls toggleHistory', () => {
    render(<HistoryModal />);
    // onKeyDown is on the backdrop which carries role="dialog"
    fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Escape' });
    expect(toggleHistoryMock).toHaveBeenCalled();
  });

  it('clicking backdrop calls toggleHistory', () => {
    render(<HistoryModal />);
    // The backdrop is the outermost div (role=dialog's parent or the dialog itself)
    const backdrop = screen.getByRole('dialog').closest('[class*="modal-backdrop"]') ??
                     screen.getByRole('dialog').parentElement!;
    fireEvent.click(backdrop!);
    expect(toggleHistoryMock).toHaveBeenCalled();
  });
});
