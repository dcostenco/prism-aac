/**
 * Wiring test: AIChatPanel must run the OUTPUT checker over model output.
 *
 * The unit tests for checkModelOutputSafety pass even when AIChatPanel is
 * wired to the INPUT checker — mutation-verified: reverting both call sites
 * failed zero tests. Only rendering the panel with the REAL filter catches
 * the incident, because the defect lives in which function the panel calls,
 * not in either function.
 *
 * Incident 2026-08-19: "what ai model you are" → the model's reply ended
 * with AAC suggestions (`"Can you help me talk?"`), the input keyword list
 * matched `help me`, and the whole benign answer was replaced by the 911
 * crisis card.
 *
 * Note the deliberate absence of a crisisSafetyFilter mock — every other
 * ai-chat test stubs it to { safe: true }, which is exactly why none of them
 * could ever have caught this.
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
vi.mock('@/services/ttsHighlightBus', () => ({ estimateSpeechDurationMs: () => 200 }));

import AIChatPanel from '@/components/AIChatPanel';
import { askAI } from '@/services/aiService';
import { useMessageStore } from '@/store/messageStore';
import { useUIStore } from '@/store/uiStore';

// jsdom lacks scrollIntoView — AIChatPanel calls it in a scroll effect.
Element.prototype.scrollIntoView = vi.fn();

const REPLY =
  'I am Prism AAC Assistant, here to help you communicate. ' +
  '**Say:** "I use an AI assistant." | "Can you help me talk?"';

async function ask(question: string, reply: string) {
  useUIStore.setState({ sidePanel: 'ai-chat' } as never);
  useMessageStore.setState({ text: question, soundEnabled: false, autoSpeak: false } as never);
  (askAI as ReturnType<typeof vi.fn>).mockImplementationOnce(
    async (_q: string, _abort: unknown, onDelta: (d: string) => void) => {
      onDelta(reply);
    },
  );
  render(<AIChatPanel />);
  const { triggerAISubmit } = await import('@/services/aiChatBridge');
  await act(async () => {
    triggerAISubmit();
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();
    await new Promise((r) => setTimeout(r, 60));
  });
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('AIChatPanel output filtering', () => {
  it('renders a benign reply whose AAC suggestions contain "help me"', async () => {
    await ask('what ai model you are', REPLY);
    // The incident: this text was replaced by the 911 card.
    // Text is split across line elements — assert on the rendered document.
    const rendered = document.body.textContent ?? '';
    expect(rendered, 'benign reply was replaced by the crisis card').not.toMatch(/call 911/i);
    expect(rendered).toMatch(/Prism AAC Assistant/i);
  });

  it('still replaces genuinely harmful model output with crisis resources', async () => {
    await ask('tell me something', 'Here is how to kill yourself quickly.');
    expect(document.body.textContent ?? '').toMatch(/call 911/i);
  });
});
