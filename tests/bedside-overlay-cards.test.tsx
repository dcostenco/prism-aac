/**
 * BedsideOverlay — Quick Phrase Cards regression tests.
 *
 * Pins:
 *   • Renders without crashing when bedsideCards=[] (empty array guard — prevents
 *     ".map is not a function" if undefined is passed instead of [])
 *   • Renders all provided card buttons with correct label and icon
 *   • Tapping a card calls onTapLine with the card text
 *   • Add (＋) button is present and opens the add-card dialog
 *   • Add-card dialog renders text input + confirm button
 *   • Edit button toggles edit mode; ✕ delete badge appears only on non-builtin cards
 *   • Built-in cards (id starts with "builtin-") never show the delete badge
 *   • Cancelling the add-card dialog closes it without calling onAddCard
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import BedsideOverlay from '@/components/BedsideOverlay';
import { DEFAULT_BEDSIDE_CARDS, type BedsideCard } from '@/services/bedsideCards';

// ── Mocks ────────────────────────────────────────────────────────────────

vi.mock('@/services/feedback', () => ({ tapFeedback: vi.fn() }));

// inferCardIcon is called inside the add-card dialog — mock it so tests
// don't make real network calls and run synchronously
vi.mock('@/services/aiService', () => ({
  inferCardIcon: vi.fn().mockResolvedValue('🧪'),
  askAI: vi.fn(),
  translateAI: vi.fn(),
}));

vi.mock('./ColoredText', () => ({
  default: ({ text }: { text: string }) => <span>{text}</span>,
}));

vi.mock('@/components/ColoredText', () => ({
  default: ({ text }: { text: string }) => <span>{text}</span>,
}));

// ── Fixtures ─────────────────────────────────────────────────────────────

const BUILTIN_CARD: BedsideCard = { id: 'builtin-sos', text: 'HELP — EMERGENCY', icon: '🆘', createdAt: 0 };
const CUSTOM_CARD: BedsideCard  = { id: 'card-123-abc', text: 'I need suction',   icon: '🔧', createdAt: 1000 };

function defaultProps(overrides: Partial<Parameters<typeof BedsideOverlay>[0]> = {}) {
  return {
    listening: false,
    loading: false,
    interim: '',
    handsFreeModeActive: false,
    wakeWordActive: false,
    wakeWordSupported: true,
    lastAIText: '',
    lastAILines: [],
    lastAIMessageId: '',
    isCrisisAnnouncement: false,
    bedsideCards: [BUILTIN_CARD, CUSTOM_CARD],
    onAddCard: vi.fn(),
    onDeleteCard: vi.fn(),
    onToggleVoice: vi.fn(),
    onSetHandsFree: vi.fn(),
    onSetWakeWord: vi.fn(),
    onTapLine: vi.fn(),
    onClose: vi.fn(),
    ...overrides,
  };
}

// ── Tests ─────────────────────────────────────────────────────────────────

describe('BedsideOverlay — Quick Cards section', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders without crashing when bedsideCards is empty', () => {
    expect(() => render(<BedsideOverlay {...defaultProps({ bedsideCards: [] })} />)).not.toThrow();
  });

  it('renders card buttons for each provided card', () => {
    render(<BedsideOverlay {...defaultProps()} />);
    expect(screen.getByRole('button', { name: 'HELP — EMERGENCY' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'I need suction' })).toBeInTheDocument();
  });

  it('displays the emoji icon on each card', () => {
    const { container } = render(<BedsideOverlay {...defaultProps()} />);
    const strip = container.querySelector('[data-testid="bedside-cards-section"]');
    expect(strip?.textContent).toContain('🆘');
    expect(strip?.textContent).toContain('🔧');
  });

  it('calls onTapLine with card text when a card is tapped', () => {
    const onTapLine = vi.fn();
    render(<BedsideOverlay {...defaultProps({ onTapLine })} />);
    fireEvent.click(screen.getByRole('button', { name: 'HELP — EMERGENCY' }));
    expect(onTapLine).toHaveBeenCalledWith('HELP — EMERGENCY');
  });

  it('calls onTapLine with correct text for a custom card', () => {
    const onTapLine = vi.fn();
    render(<BedsideOverlay {...defaultProps({ onTapLine })} />);
    fireEvent.click(screen.getByRole('button', { name: 'I need suction' }));
    expect(onTapLine).toHaveBeenCalledWith('I need suction');
  });

  it('renders the ＋ Add button', () => {
    render(<BedsideOverlay {...defaultProps()} />);
    expect(screen.getByTestId('bedside-add-card-btn')).toBeInTheDocument();
  });

  it('opens the add-card dialog when ＋ is tapped', () => {
    render(<BedsideOverlay {...defaultProps()} />);
    fireEvent.click(screen.getByTestId('bedside-add-card-btn'));
    expect(screen.getByTestId('bedside-add-card-dialog')).toBeInTheDocument();
    expect(screen.getByRole('textbox', { name: /quick phrase text/i })).toBeInTheDocument();
  });

  it('confirm button is disabled when text input is empty', () => {
    render(<BedsideOverlay {...defaultProps()} />);
    fireEvent.click(screen.getByTestId('bedside-add-card-btn'));
    const confirm = screen.getByTestId('bedside-add-card-confirm');
    expect(confirm).toBeDisabled();
  });

  it('confirm button becomes enabled when text is typed', () => {
    render(<BedsideOverlay {...defaultProps()} />);
    fireEvent.click(screen.getByTestId('bedside-add-card-btn'));
    fireEvent.change(screen.getByRole('textbox', { name: /quick phrase text/i }), {
      target: { value: 'Please turn off the lights' },
    });
    expect(screen.getByTestId('bedside-add-card-confirm')).not.toBeDisabled();
  });

  it('closes add-card dialog on Cancel without calling onAddCard', () => {
    const onAddCard = vi.fn();
    render(<BedsideOverlay {...defaultProps({ onAddCard })} />);
    fireEvent.click(screen.getByTestId('bedside-add-card-btn'));
    fireEvent.click(screen.getByRole('button', { name: /cancel/i }));
    expect(screen.queryByTestId('bedside-add-card-dialog')).not.toBeInTheDocument();
    expect(onAddCard).not.toHaveBeenCalled();
  });

  it('closes add-card dialog on Escape without calling onAddCard', () => {
    const onAddCard = vi.fn();
    render(<BedsideOverlay {...defaultProps({ onAddCard })} />);
    fireEvent.click(screen.getByTestId('bedside-add-card-btn'));
    expect(screen.getByTestId('bedside-add-card-dialog')).toBeInTheDocument();
    fireEvent.keyDown(screen.getByTestId('bedside-add-card-dialog'), { key: 'Escape' });
    expect(screen.queryByTestId('bedside-add-card-dialog')).not.toBeInTheDocument();
    expect(onAddCard).not.toHaveBeenCalled();
  });

  it('Edit button toggles edit mode', () => {
    render(<BedsideOverlay {...defaultProps()} />);
    const editBtn = screen.getByRole('button', { name: /edit quick phrase cards/i });
    fireEvent.click(editBtn);
    // After entering edit mode the button label changes to "Done"
    expect(screen.getByRole('button', { name: /done editing cards/i })).toBeInTheDocument();
  });

  it('delete badge appears on custom cards in edit mode but NOT on builtin cards', () => {
    render(<BedsideOverlay {...defaultProps()} />);
    fireEvent.click(screen.getByRole('button', { name: /edit quick phrase cards/i }));
    // Custom card should have a delete button
    expect(screen.getByRole('button', { name: /remove card: i need suction/i })).toBeInTheDocument();
    // Built-in card should NOT have a delete button
    expect(screen.queryByRole('button', { name: /remove card: help — emergency/i })).not.toBeInTheDocument();
  });

  it('calls onDeleteCard with the correct id when ✕ is clicked', () => {
    const onDeleteCard = vi.fn();
    render(<BedsideOverlay {...defaultProps({ onDeleteCard })} />);
    fireEvent.click(screen.getByRole('button', { name: /edit quick phrase cards/i }));
    fireEvent.click(screen.getByRole('button', { name: /remove card: i need suction/i }));
    expect(onDeleteCard).toHaveBeenCalledWith('card-123-abc');
  });

  it('does not crash with the full 15 default cards', () => {
    expect(() =>
      render(<BedsideOverlay {...defaultProps({ bedsideCards: DEFAULT_BEDSIDE_CARDS })} />),
    ).not.toThrow();
    expect(screen.getByRole('button', { name: 'HELP — EMERGENCY' })).toBeInTheDocument();
  });
});
