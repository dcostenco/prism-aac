/**
 * AIChatPanel — single-state layout invariant + translator mode routing.
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
 *
 * Translator mode invariants (regression: 821e321 broke TTS for all modes):
 *   7. language !== outputLanguage → translateAI called, askAI NOT called.
 *   8. language === outputLanguage → askAI called, translateAI NOT called.
 *   9. Translator mode: speak() called once with output-lang TTS code.
 *  10. Regular mode: speak() NOT called (user taps lines to speak).
 *  11. Translator header shows 🔄 and the language pair.
 *  12. Regular header shows ai_chat_title.
 */
import { describe, it, expect, beforeEach, vi, type Mock } from 'vitest';
import { render, screen, act } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import AIChatPanel from '@/components/AIChatPanel';
import { useUIStore } from '@/store/uiStore';
import { useMessageStore } from '@/store/messageStore';
import { useSettingsStore } from '@/store/settingsStore';
import { useAuthStore } from '@/store/authStore';

const { registerAISubmitMock } = vi.hoisted(() => ({
  registerAISubmitMock: vi.fn(),
}));

vi.mock('@/engine/useT', () => ({
  useT: () => ({ t: (k: string) => k, ttsCode: 'en-US', rtl: false, ready: true }),
}));
vi.mock('@/services/feedback', () => ({ tapFeedback: vi.fn() }));
vi.mock('@/services/aiService', () => ({
  // Production server always streams — mocks simulate onChunk calls so buffer is populated.
  askAI: vi.fn(async (_q: string, _ctx: unknown, onChunk?: (d: string) => void) => {
    onChunk?.('reply');
    return { text: 'reply', lines: ['reply'] };
  }),
  translateAI: vi.fn(async (_t: string, _f: string, _to: string, onChunk?: (d: string) => void) => {
    onChunk?.('traduction');
    return 'traduction';
  }),
}));
vi.mock('@/services/speechService', () => ({ speak: vi.fn(async () => {}) }));
vi.mock('@/engine/i18n', () => ({
  getTTSCode: (lang: string) => `${lang}-XX`,
  canonicalizeLang: (lang: string) => lang,
  isRTL: () => false,
  SupportedLanguage: {},
}));
vi.mock('@/services/aacSpeak', () => ({ aacSpeak: vi.fn() }));
vi.mock('@/services/aiChatBridge', () => ({
  registerAISubmit: registerAISubmitMock,
  clearAISubmit: vi.fn(),
}));
vi.mock('@/services/voiceInputService', () => ({
  isVoiceInputSupported: () => false,
  startVoiceInput: () => null,
}));
vi.mock('@/services/textCorrectService', () => ({ correctText: vi.fn(async (t: string) => t) }));
vi.mock('@/services/ttsHighlightBus', () => ({ subscribeTtsHighlight: () => () => {} }));

beforeEach(() => {
  // jsdom doesn't implement scroll APIs — stub them so useEffect doesn't throw.
  Element.prototype.scrollTo = vi.fn();
  Element.prototype.scrollIntoView = vi.fn();
  useUIStore.setState({ sidePanel: 'ai-chat' });
  useMessageStore.setState({ text: '', soundEnabled: true });
  useSettingsStore.setState({ language: 'en', outputLanguage: 'en' });
  useAuthStore.setState({
    profile: { email: 't@t', name: 'T', plan: 'standard', isPlatformAdmin: false },
    loaded: true,
    loading: false,
  });
  registerAISubmitMock.mockClear();
  vi.clearAllMocks();
  registerAISubmitMock.mockClear();
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

// ── Translator mode (regression: 821e321 broke TTS for all modes) ──────────
// Behavioural tests below are the SPEC for the upcoming translator mode
// reimplementation. They are skipped while AIChatPanel is at v1.5.0
// baseline (no translator mode). Un-skip when translator mode is
// reimplemented and confirmed working with a live Vercel build verify.
describe('AIChatPanel — translator mode', () => {
  it.skip('shows 🔄 header and language pair when language !== outputLanguage', () => {
    useSettingsStore.setState({ language: 'en', outputLanguage: 'ru' });
    render(<AIChatPanel />);
    const text = screen.getByTestId('ai-chat-panel').textContent ?? '';
    expect(text).toMatch(/🔄/);
    expect(text).toMatch(/EN.*RU|en.*ru/i);
  });

  it('shows ✨ ai_chat_title header when language === outputLanguage', () => {
    useSettingsStore.setState({ language: 'en', outputLanguage: 'en' });
    render(<AIChatPanel />);
    const text = screen.getByTestId('ai-chat-panel').textContent ?? '';
    expect(text).toMatch(/ai_chat_title/);
    expect(text).not.toMatch(/🔄/);
  });

  it.skip('translator mode: translateAI called, askAI NOT called on submit', async () => {
    const { askAI, translateAI } = await import('@/services/aiService');
    const { speak } = await import('@/services/speechService');
    useSettingsStore.setState({ language: 'en', outputLanguage: 'ru' });
    useMessageStore.setState({ text: 'hello', soundEnabled: true });

    render(<AIChatPanel />);
    // handleAsk is registered via registerAISubmit — capture it and invoke.
    const handleAsk = registerAISubmitMock.mock.calls[0]?.[0] as (() => Promise<void>) | undefined;
    expect(handleAsk).toBeDefined();

    await act(async () => { await handleAsk?.(); });

    expect(translateAI).toHaveBeenCalledOnce();
    expect(translateAI).toHaveBeenCalledWith('hello', 'en', 'ru', expect.any(Function));
    expect(askAI).not.toHaveBeenCalled();
    // speak() must be called with output-lang TTS code (not aacSpeak, which re-translates)
    expect(speak).toHaveBeenCalledOnce();
    expect((speak as Mock).mock.calls[0][3]).toBe('ru-XX');
  });

  it('regular mode: askAI called, translateAI NOT called, speak NOT auto-called', async () => {
    const { askAI, translateAI } = await import('@/services/aiService');
    const { speak } = await import('@/services/speechService');
    useSettingsStore.setState({ language: 'en', outputLanguage: 'en' });
    useMessageStore.setState({ text: 'what is rain', soundEnabled: true });

    render(<AIChatPanel />);
    const handleAsk = registerAISubmitMock.mock.calls[0]?.[0] as (() => Promise<void>) | undefined;
    expect(handleAsk).toBeDefined();

    await act(async () => { await handleAsk?.(); });

    expect(askAI).toHaveBeenCalledOnce();
    expect(translateAI).not.toHaveBeenCalled();
    expect(speak).not.toHaveBeenCalled();
  });

  it('translator mode: speak NOT called when soundEnabled is false', async () => {
    const { speak } = await import('@/services/speechService');
    useSettingsStore.setState({ language: 'en', outputLanguage: 'ru' });
    useMessageStore.setState({ text: 'hello', soundEnabled: false });

    render(<AIChatPanel />);
    const handleAsk = registerAISubmitMock.mock.calls[0]?.[0] as (() => Promise<void>) | undefined;

    await act(async () => { await handleAsk?.(); });

    expect(speak).not.toHaveBeenCalled();
  });
});
