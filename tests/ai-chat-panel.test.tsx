/**
 * AIChatPanel — three-state layout invariant.
 *
 * User report 2026-05-07 (Image #19): "ai chat layout is broken..
 * keyboard should be full without ai chat lines". Earlier, the panel
 * had a single state — render a flex-[3] full panel any time the user
 * had typed anything, with an empty scroll area + footer. That
 * compressed the qwerty to two cramped rows the moment text appeared.
 *
 * Three states pinned here:
 *   1. No messages + no typed text → panel unmounted entirely.
 *   2. No messages + has text     → SLIM mode (data-state="slim"):
 *      shrink-0 footer-only (Question label + mic + Ask AI + ✕),
 *      no flex-[3], no empty scroll area, no header strip eating
 *      vertical space.
 *   3. Has messages or loading    → EXPANDED (data-state="expanded"):
 *      full panel with header + scroll area + footer.
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
vi.mock('@/services/aiService', () => ({
  askAI: vi.fn(),
}));
vi.mock('@/services/aacSpeak', () => ({ aacSpeak: vi.fn() }));
vi.mock('@/services/voiceInputService', () => ({
  isVoiceInputSupported: () => false,
  createVoiceInputSession: () => null,
}));
vi.mock('@/services/ttsHighlightBus', () => ({
  subscribeTtsHighlight: () => () => {},
}));

beforeEach(() => {
  useUIStore.setState({ sidePanel: 'ai-chat' });
  useMessageStore.setState({ text: '' });
  useAuthStore.setState({
    profile: { email: 't@t', name: 'T', plan: 'standard', isPlatformAdmin: false },
    loaded: true,
    loading: false,
  });
});

describe('AIChatPanel — layout state machine', () => {
  it('unmounts entirely when no messages and no typed text', () => {
    const { container } = render(<AIChatPanel />);
    expect(container.querySelector('[data-testid="ai-chat-panel"]')).toBeNull();
  });

  it('renders slim footer mode when text is typed but no messages exist yet', () => {
    useMessageStore.setState({ text: 'How do I make pasta' });
    render(<AIChatPanel />);
    const panel = screen.getByTestId('ai-chat-panel');
    expect(panel).toBeInTheDocument();
    expect(panel).toHaveAttribute('data-state', 'slim');
    // Slim mode must have the Ask AI button reachable.
    expect(screen.getByTestId('ai-ask-slim')).toBeInTheDocument();
    // Slim mode must NOT have a flex-[3] class (that's the cramped-
    // keyboard-trap layout). shrink-0 is the right choice — the panel
    // takes only the height it needs, rest goes to the qwerty.
    expect(panel.className).not.toMatch(/flex-\[3\]/);
    expect(panel.className).toMatch(/shrink-0/);
  });

  it('does NOT render when sidePanel !== ai-chat', () => {
    useUIStore.setState({ sidePanel: 'none' });
    useMessageStore.setState({ text: 'still has text' });
    const { container } = render(<AIChatPanel />);
    expect(container.querySelector('[data-testid="ai-chat-panel"]')).toBeNull();
  });

  it('slim mode is a single-row strip — no extraneous Question label or large py-3 button', () => {
    // The earlier slim mode rendered a Question: "..." label row PLUS
    // a py-3 (12px each side + ~30px line-height) Ask AI button = ~110px
    // of footer overlapping the keyboard top row visibly (user
    // Image #22). The fix collapses to a single h-10 (40px) row with
    // px-2 py-1.5 padding ≈ 52px total.
    useMessageStore.setState({ text: 'How do I' });
    const { container } = render(<AIChatPanel />);
    const panel = container.querySelector('[data-testid="ai-chat-panel"]') as HTMLElement;
    expect(panel).not.toBeNull();
    // Critical: slim mode must NOT contain a "Question:" label section
    // (that earlier sat above the button row, eating ~30px). The slim
    // strip's ONLY child div is the [mic, Ask AI, ✕] flex row.
    expect(panel.textContent).not.toMatch(/^.*Question.*Ask AI.*$/s);
    // Ask AI button must use h-10 (40px) not py-3/py-4 (which produce
    // ~60-80px buttons that overlap the qwerty top row).
    const ask = container.querySelector('[data-testid="ai-ask-slim"]') as HTMLElement;
    expect(ask).not.toBeNull();
    const cls = ask.className;
    expect(cls).toMatch(/h-10/);
    expect(cls).not.toMatch(/py-3|py-4/);
  });
});
