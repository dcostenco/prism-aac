/**
 * Regression for the "AI streaming dialog stays empty" bug.
 *
 * Before fix: AIChatPanel.handleAsk relied entirely on the onChunk callback
 * to populate the buffer. The local Ollama path in aiService.ts uses
 * stream:false and never invokes onChunk — it returns the full text in the
 * AIResponse return value, which AIChatPanel was discarding. Result: AI
 * bubble rendered empty even when Ollama returned a valid response.
 *
 * After fix: when the buffer is empty after askAI resolves, fall back to
 * response.text (the askAI return value). Treats the full text as one
 * end-of-stream chunk.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, act } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';

vi.mock('@/services/aacSpeak', () => ({ aacSpeak: vi.fn() }));
vi.mock('@/services/aiService', () => ({ askAI: vi.fn() }));
vi.mock('@/services/textCorrectService', () => ({ correctText: vi.fn(async (t: string) => t) }));
vi.mock('@/services/voiceInputService', () => ({
  isVoiceInputSupported: () => false,
  startVoiceInput: vi.fn(),
}));
vi.mock('@/services/feedback', () => ({ tapFeedback: vi.fn() }));
vi.mock('@/services/crisisSafetyFilter', () => ({ checkCrisisSafety: () => ({ safe: true }) }));
vi.mock('@/services/ttsHighlightBus', () => ({ estimateSpeechDurationMs: () => 200 }));

Element.prototype.scrollIntoView = vi.fn();

import AIChatPanel from '@/components/AIChatPanel';
import { askAI } from '@/services/aiService';
import { useUIStore } from '@/store/uiStore';
import { useMessageStore } from '@/store/messageStore';

describe('AIChatPanel — empty-bubble fallback when onChunk never fires', () => {
  beforeEach(() => {
    (askAI as ReturnType<typeof vi.fn>).mockClear();
    useUIStore.setState({ sidePanel: 'ai-chat' });
    useMessageStore.setState({ text: 'hi', soundEnabled: true, autoSpeak: true } as never);
  });

  it('renders AI text from response.text when onChunk was never called', async () => {
    // Simulate the local-Ollama path: askAI returns text but never invokes onChunk.
    (askAI as ReturnType<typeof vi.fn>).mockImplementationOnce(
      async (_q: string, _ctx: unknown, _onChunk: unknown) => {
        // intentionally do NOT call _onChunk
        return { text: 'Hello there!', lines: ['Hello there!'] };
      },
    );

    render(<AIChatPanel />);
    const { triggerAISubmit } = await import('@/services/aiChatBridge');
    await act(async () => {
      triggerAISubmit();
      await Promise.resolve();
      await Promise.resolve();
      await Promise.resolve();
    });

    // The AI bubble should contain the response text from the return value.
    const panel = screen.getByTestId('ai-chat-panel');
    expect(panel.textContent ?? '').toContain('Hello there!');
  });

  it('still uses onChunk deltas when the provider DOES stream', async () => {
    (askAI as ReturnType<typeof vi.fn>).mockImplementationOnce(
      async (_q: string, _ctx: unknown, onChunk: (d: string) => void) => {
        onChunk('Streaming ');
        onChunk('reply.');
        return { text: 'Streaming reply.', lines: ['Streaming reply.'] };
      },
    );

    render(<AIChatPanel />);
    const { triggerAISubmit } = await import('@/services/aiChatBridge');
    await act(async () => {
      triggerAISubmit();
      await Promise.resolve();
      await Promise.resolve();
      await Promise.resolve();
    });

    const panel = screen.getByTestId('ai-chat-panel');
    expect(panel.textContent ?? '').toContain('Streaming reply.');
  });
});
