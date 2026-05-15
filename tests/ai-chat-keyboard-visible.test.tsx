/**
 * Regression for the AI-chat keyboard-hidden bug.
 *
 * Before fix: PrismApp suppresses <MessageBar /> when sidePanel === 'ai-chat',
 * so anything the global Keyboard typed into useMessageStore.text was invisible
 * — keys worked, the user just couldn't see what they typed.
 *
 * After fix: AIChatPanel renders an in-panel typed-input preview strip bound
 * to useMessageStore.text. Strip updates reactively as keys land.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, act } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';

vi.mock('@/services/aacSpeak', () => ({ aacSpeak: vi.fn() }));
vi.mock('@/services/aiService', () => ({ askAI: vi.fn() }));
vi.mock('@/services/textCorrectService', () => ({
  correctText: vi.fn(async (t: string) => t),
}));
vi.mock('@/services/voiceInputService', () => ({
  isVoiceInputSupported: () => false,
  startVoiceInput: vi.fn(),
}));
vi.mock('@/services/feedback', () => ({ tapFeedback: vi.fn() }));
vi.mock('@/services/crisisSafetyFilter', () => ({
  checkCrisisSafety: () => ({ safe: true }),
}));
vi.mock('@/services/ttsHighlightBus', () => ({
  estimateSpeechDurationMs: () => 200,
}));

Element.prototype.scrollIntoView = vi.fn();

import AIChatPanel from '@/components/AIChatPanel';
import { useUIStore } from '@/store/uiStore';
import { useMessageStore } from '@/store/messageStore';

describe('AIChatPanel — typed-input preview is visible', () => {
  beforeEach(() => {
    useUIStore.setState({ sidePanel: 'ai-chat' });
    useMessageStore.setState({ text: '', soundEnabled: true, autoSpeak: true } as never);
  });

  it('renders the input preview strip', () => {
    render(<AIChatPanel />);
    expect(screen.getByTestId('ai-chat-input-preview')).toBeInTheDocument();
  });

  it('shows the placeholder hint when text is empty', () => {
    render(<AIChatPanel />);
    const strip = screen.getByTestId('ai-chat-input-preview');
    // Placeholder hint is italic-muted; text is whatever t('type_or_speak') resolves to
    expect(strip.textContent?.trim().length).toBeGreaterThan(0);
  });

  it('updates the strip live as messageStore.text changes', async () => {
    render(<AIChatPanel />);
    const strip = screen.getByTestId('ai-chat-input-preview');
    expect(strip.textContent ?? '').not.toContain('hello world');
    await act(async () => {
      useMessageStore.setState({ text: 'hello world' } as never);
    });
    expect(strip.textContent ?? '').toContain('hello world');
  });

  it('shows a cursor pip only when text is present', async () => {
    render(<AIChatPanel />);
    const strip = screen.getByTestId('ai-chat-input-preview');
    // Empty: no ▎
    expect(strip.textContent ?? '').not.toContain('▎');
    await act(async () => {
      useMessageStore.setState({ text: 'abc' } as never);
    });
    expect(strip.textContent ?? '').toContain('▎');
  });
});
