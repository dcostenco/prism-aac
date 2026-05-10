/**
 * AIChatPanel — single-state layout invariant (2026-05-10 redesign).
 *
 * Previous design had 3 states (unmount / slim / expanded).
 * New design: panel always renders when sidePanel==='ai-chat'.
 * All space belongs to the chat. No separate "Ask AI" button.
 * Speak key sends via aiChatBridge. MessageBar stays visible above
 * (user sees what they're typing there).
 *
 * Pinned invariants:
 *   1. Panel renders whenever sidePanel==='ai-chat', regardless of text.
 *   2. Panel does NOT render when sidePanel !== 'ai-chat'.
 *   3. No "Ask AI" button in the panel (Speak key is the send action).
 *   4. No "Question:" label (redundant — MessageBar shows typed text).
 *   5. data-state is always "expanded".
 *   6. Panel has flex-1 (takes all available space).
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import AIChatPanel from '@/components/AIChatPanel';
import { useUIStore } from '@/store/uiStore';
import { useMessageStore } from '@/store/messageStore';
import { useAuthStore } from '@/store/authStore';

vi.mock('@/engine/useT', () => ({
  useT: () => ({ t: (k: string) => k, ttsCode: 'en-US', rtl: false, ready: true }),
}));
vi.mock('@/services/feedback', () => ({ tapFeedback: vi.fn() }));
vi.mock('@/services/aiService', () => ({ askAI: vi.fn() }));
vi.mock('@/services/aacSpeak', () => ({ aacSpeak: vi.fn() }));
vi.mock('@/services/aiChatBridge', () => ({
  registerAISubmit: vi.fn(),
  clearAISubmit: vi.fn(),
}));
vi.mock('@/services/voiceInputService', () => ({
  isVoiceInputSupported: () => false,
  startVoiceInput: () => null,
}));
vi.mock('@/services/textCorrectService', () => ({ correctText: vi.fn(async (t: string) => t) }));
vi.mock('@/services/ttsHighlightBus', () => ({ subscribeTtsHighlight: () => () => {} }));

beforeEach(() => {
  // jsdom doesn't implement scrollTo — stub it so useEffect doesn't throw.
  Element.prototype.scrollTo = vi.fn();
  useUIStore.setState({ sidePanel: 'ai-chat' });
  useMessageStore.setState({ text: '' });
  useAuthStore.setState({
    profile: { email: 't@t', name: 'T', plan: 'standard', isPlatformAdmin: false },
    loaded: true,
    loading: false,
  });
});

describe('AIChatPanel — single-state layout', () => {
  it('renders whenever sidePanel==="ai-chat", even with no text and no messages', () => {
    const { container } = render(<AIChatPanel />);
    expect(container.querySelector('[data-testid="ai-chat-panel"]')).not.toBeNull();
  });

  it('always has data-state="expanded" (no slim mode)', () => {
    render(<AIChatPanel />);
    expect(screen.getByTestId('ai-chat-panel')).toHaveAttribute('data-state', 'expanded');
  });

  it('also has data-state="expanded" when text is typed', () => {
    useMessageStore.setState({ text: 'How do I make pasta' });
    render(<AIChatPanel />);
    expect(screen.getByTestId('ai-chat-panel')).toHaveAttribute('data-state', 'expanded');
  });

  it('does NOT render when sidePanel !== "ai-chat"', () => {
    useUIStore.setState({ sidePanel: 'none' });
    useMessageStore.setState({ text: 'has text' });
    const { container } = render(<AIChatPanel />);
    expect(container.querySelector('[data-testid="ai-chat-panel"]')).toBeNull();
  });

  it('has no "Ask AI" button — Speak key is the send action', () => {
    render(<AIChatPanel />);
    const panel = screen.getByTestId('ai-chat-panel');
    const text = panel.textContent ?? '';
    // Neither the old data-testid nor the label text should appear.
    expect(panel.querySelector('[data-testid="ai-ask-slim"]')).toBeNull();
    expect(text).not.toMatch(/Ask AI|ask_ai/);
  });

  it('has no "Question:" label — MessageBar shows the typed text', () => {
    useMessageStore.setState({ text: 'test question' });
    render(<AIChatPanel />);
    const text = screen.getByTestId('ai-chat-panel').textContent ?? '';
    expect(text).not.toMatch(/Question:|question_label/);
  });

  it('panel className includes flex-1 (takes all available space)', () => {
    render(<AIChatPanel />);
    const panel = screen.getByTestId('ai-chat-panel');
    expect(panel.className).toMatch(/flex-1/);
  });

  it('shows empty-state placeholder when no messages', () => {
    render(<AIChatPanel />);
    const text = screen.getByTestId('ai-chat-panel').textContent ?? '';
    // Should mention Speak as the send action.
    expect(text.toLowerCase()).toMatch(/speak/);
  });
});
