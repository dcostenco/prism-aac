/**
 * TTS bus integration — confirms that speak() emits the right
 * sequence of attempt/success/fallback/give-up events through the
 * fallback chain. Pairs with services/ttsHealthBus.test.ts which
 * tests the bus in isolation.
 *
 * These tests deliberately mock the lower tiers so we can drive the
 * exact path we want and assert what shows up on the bus. The bus
 * itself is real — we subscribe to it like a debug overlay would.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { speak } from '@/services/speechService';
import {
  subscribeTtsHealth,
  _resetForTests,
  type TtsHealthEvent,
} from '@/services/ttsHealthBus';

const speakAzureMock = vi.fn();

vi.mock('@/services/azureTTS', () => ({
  speakAzure: (...args: unknown[]) => speakAzureMock(...args),
  stopAzureAudio: vi.fn(),
}));

function recordEvents(): TtsHealthEvent[] {
  const events: TtsHealthEvent[] = [];
  subscribeTtsHealth((e) => events.push(e));
  return events;
}

beforeEach(() => {
  _resetForTests();
  vi.clearAllMocks();
  // jsdom navigator.onLine defaults to true

  // speakLocal wraps speechSynthesis.speak in a Promise that resolves on
  // utterance.onend. The global setup mock never fires onend → timeout.
  // Patch speak to trigger onend so Tier 2 fallback resolves.
  (window.speechSynthesis.speak as ReturnType<typeof vi.fn>).mockImplementation((u: { onend?: (() => void) | null }) => {
    if (u && typeof u.onend === 'function') u.onend();
  });
});

describe('speak() → bus integration', () => {
  it('Tier 1 success: emits attempt(inworld) → success(inworld), no fallback', async () => {
    speakAzureMock.mockResolvedValueOnce({ success: true });
    const events = recordEvents();

    await speak('hello', 0.5, 1.0, 'en-US', 'friendly');

    expect(events.map((e) => e.type)).toEqual(['tts-attempt', 'tts-success']);
    expect(events[0]).toMatchObject({ type: 'tts-attempt', tier: 'inworld' });
    expect(events[1]).toMatchObject({ type: 'tts-success', tier: 'inworld' });
  });

  it('Tier 1 fail → Tier 2: emits attempt → fallback → web-speech attempt', async () => {
    speakAzureMock.mockResolvedValueOnce({ success: false });
    const events = recordEvents();

    await speak('test', 0.5, 1.0, 'en-US', 'friendly');

    const types = events.map((e) => e.type);
    expect(types).toContain('tts-attempt');
    expect(types).toContain('tts-fallback');
    // First event = portal attempt
    expect(events[0]).toMatchObject({ type: 'tts-attempt', tier: 'inworld' });
    // Falls back directly to web-speech
    const fallback = events.find((e) => e.type === 'tts-fallback');
    expect(fallback).toMatchObject({
      type: 'tts-fallback',
      fromTier: 'inworld',
      toTier: 'web-speech',
    });
    // Web Speech attempt fires from speakLocal
    const webAttempt = events.find(
      (e) => e.type === 'tts-attempt' && e.tier === 'web-speech',
    );
    expect(webAttempt).toBeDefined();
  });

  it('attempt event includes lang + first 80 chars of text', async () => {
    speakAzureMock.mockResolvedValueOnce({ success: true });
    const events = recordEvents();
    const longText = 'x'.repeat(200);

    await speak(longText, 0.5, 1.0, 'ru-RU', 'friendly');

    const attempt = events[0] as Extract<TtsHealthEvent, { type: 'tts-attempt' }>;
    expect(attempt.type).toBe('tts-attempt');
    expect(attempt.tier).toBe('inworld');
    expect(attempt.lang).toBe('ru-RU');
    expect(attempt.text.length).toBe(80);
  });

  it('success event has non-negative latency and a numeric timestamp', async () => {
    speakAzureMock.mockResolvedValueOnce({ success: true });
    const events = recordEvents();

    await speak('hi', 0.5, 1.0, 'en-US', 'friendly');

    const success = events.find((e) => e.type === 'tts-success');
    expect(success).toBeDefined();
    if (success?.type === 'tts-success') {
      expect(success.latencyMs).toBeGreaterThanOrEqual(0);
      expect(typeof success.timestamp).toBe('number');
    }
  });
});
