/**
 * Regression for the streaming-TTS-silent bug.
 *
 * Before fix: AIChatPanel's drainQueue called aacSpeak(sentence, rate, vol)
 * with no interrupt flag. PROTECT_PLAY_MS in azureTTS dropped every 2nd+
 * streamed sentence because activeSources from the previous sentence
 * lingered <600ms. Chat text streamed on screen but audio was silent.
 *
 * After fix: drainQueue calls aacSpeak(..., undefined, true) so each
 * sentence interrupts its predecessor cleanly. Each sentence is gated
 * behind its own duration timer so we WANT interrupt semantics here.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, act } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';

vi.mock('@/services/aacSpeak', () => ({
  aacSpeak: vi.fn(),
}));
vi.mock('@/services/aiService', () => ({
  askAI: vi.fn(),
}));
vi.mock('@/services/textCorrectService', () => ({
  correctText: vi.fn(async (t: string) => t),
}));
vi.mock('@/services/voiceInputService', () => ({
  isVoiceInputSupported: () => false,
  startVoiceInput: vi.fn(),
}));
vi.mock('@/services/feedback', () => ({
  tapFeedback: vi.fn(),
}));
vi.mock('@/services/crisisSafetyFilter', () => ({
  checkCrisisSafety: () => ({ safe: true }),
  checkModelOutputSafety: () => ({ safe: true }),
}));
vi.mock('@/services/ttsHighlightBus', () => ({
  estimateSpeechDurationMs: () => 200,
}));

import AIChatPanel from '@/components/AIChatPanel';
import { aacSpeak } from '@/services/aacSpeak';
import { askAI } from '@/services/aiService';
import { useUIStore } from '@/store/uiStore';
import { useMessageStore } from '@/store/messageStore';

// jsdom doesn't implement scrollIntoView — AIChatPanel calls it in a scroll effect
Element.prototype.scrollIntoView = vi.fn();

describe('AIChatPanel — streaming TTS uses interrupt=true', () => {
  beforeEach(() => {
    (aacSpeak as ReturnType<typeof vi.fn>).mockClear();
    useUIStore.setState({ sidePanel: 'ai-chat' });
    useMessageStore.setState({ text: 'why is the sky blue', soundEnabled: true, autoSpeak: true } as never);
  });

  it('passes interrupt=true to aacSpeak for each streamed sentence', async () => {
    // askAI streams 2 sentences. The 5th positional arg of aacSpeak is `interrupt`.
    (askAI as ReturnType<typeof vi.fn>).mockImplementationOnce(
      async (_q: string, _abort: unknown, onDelta: (d: string) => void) => {
        onDelta('Hello there. ');
        onDelta('Sky is blue because of Rayleigh scattering. ');
      },
    );
    render(<AIChatPanel />);

    // The Speak-button intercept registered by AIChatPanel triggers handleAsk
    // via the aiChatBridge. Easier path: directly call triggerAISubmit.
    const { triggerAISubmit } = await import('@/services/aiChatBridge');
    await act(async () => {
      triggerAISubmit();
      // Flush microtasks for the async askAI mock
      await Promise.resolve();
      await Promise.resolve();
      await Promise.resolve();
    });

    const calls = (aacSpeak as ReturnType<typeof vi.fn>).mock.calls;
    expect(calls.length).toBeGreaterThanOrEqual(1);
    // Each call: aacSpeak(sentence, rate, volume, tone, interrupt, spokenLang?)
    for (const c of calls) {
      expect(c[4]).toBe(true);
    }
  });
});
