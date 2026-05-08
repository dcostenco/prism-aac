/**
 * Math panel header — persistent ⌫ backspace button.
 *
 * User report May 2026 (Image #17): "where is backspace? how am i
 * suppose to edit any word?". Backspace used to live ONLY on the
 * Main 0–9 keyboard; switching to Music / Java / Python / Letters
 * etc. left the user with no way to delete a typed cell.
 *
 * The fix (commit 6de91fa) hoisted ⌫ into the persistent panel
 * header next to Done / ✕. This test pins the contract:
 *   1. Button is present in the math panel header on every chip
 *      (we verify it via the data-testid which is stable across
 *      tab switches).
 *   2. Disabled when cells.size === 0 (no-op — visual feedback
 *      that there's nothing to delete).
 *   3. Enabled when cells exist; clicking it invokes
 *      backspaceAtCursor.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom/vitest';
import MathPanel from '@/components/MathPanel';
import { useUIStore } from '@/store/uiStore';
import { useMathGridStore } from '@/store/mathGridStore';
import { useMessageStore } from '@/store/messageStore';

vi.mock('@/engine/useT', () => ({
  useT: () => ({ t: (k: string) => k, ttsCode: 'en-US', rtl: false, ready: true }),
}));
vi.mock('@/services/feedback', () => ({ tapFeedback: vi.fn(), keyFeedback: vi.fn() }));
vi.mock('@/services/aacSpeak', () => ({ aacSpeak: vi.fn() }));
vi.mock('@/services/aiService', () => ({ askAI: vi.fn() }));

beforeEach(() => {
  useUIStore.setState({ sidePanel: 'math' });
  useMathGridStore.getState().reset();
  useMessageStore.setState({ text: '' });
});

describe('Math panel — persistent ⌫ in header', () => {
  it('renders the backspace button in the panel header', () => {
    render(<MathPanel />);
    const btn = screen.getByTestId('math-panel-backspace');
    expect(btn).toBeInTheDocument();
    expect(btn).toHaveAttribute('aria-label', 'Backspace');
  });

  it('is DISABLED when the cell grid is empty (no-op affordance)', () => {
    render(<MathPanel />);
    const btn = screen.getByTestId('math-panel-backspace') as HTMLButtonElement;
    expect(btn).toBeDisabled();
  });

  it('is ENABLED after a cell has been typed', () => {
    // Commit a cell into the grid by calling the store action the
    // keyboards use. We bypass the click flow and just put a glyph at
    // (0,0) so the button predicate (cells.size > 0) is satisfied.
    const { commitGlyph } = useMathGridStore.getState();
    commitGlyph('5');
    render(<MathPanel />);
    const btn = screen.getByTestId('math-panel-backspace') as HTMLButtonElement;
    expect(btn).not.toBeDisabled();
  });

  it('clicking ⌫ deletes the last cell (drives backspaceAtCursor)', async () => {
    const user = userEvent.setup();
    const { commitGlyph } = useMathGridStore.getState();
    commitGlyph('5');
    expect(useMathGridStore.getState().cells.size).toBe(1);
    render(<MathPanel />);
    await user.click(screen.getByTestId('math-panel-backspace'));
    expect(useMathGridStore.getState().cells.size).toBe(0);
  });

  it('does NOT render when sidePanel !== math', () => {
    useUIStore.setState({ sidePanel: 'none' });
    const { container } = render(<MathPanel />);
    expect(container.querySelector('[data-testid="math-panel-backspace"]')).toBeNull();
  });
});
