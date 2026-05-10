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
const speakWithKokoroMock = vi.fn();
const isKokoroSupportedMock = vi.fn();
const getKokoroVoiceMock = vi.fn();

vi.mock('@/services/azureTTS', () => ({
  speakAzure: (...args: unknown[]) => speakAzureMock(...args),
  stopAzureAudio: vi.fn(),
}));
vi.mock('@/services/kokoroTTS', () => ({
  speakWithKokoro: (...args: unknown[]) => speakWithKokoroMock(...args),
  isKokoroSupported: () => isKokoroSupportedMock(),
  demoteKokoroForSession: vi.fn(),
  getKokoroVoice: (lang: string) => getKokoroVoiceMock(lang),
  preloadKokoro: vi.fn(),
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
});

describe('speak() → bus integration', () => {
  it('Tier 1 success: emits attempt(inworld) → success(inworld), no fallback', async () => {
    speakAzureMock.mockResolvedValueOnce(true);
    const events = recordEvents();

    await speak('hello', 0.5, 1.0, 'en-US', 'friendly');

    expect(events.map((e) => e.type)).toEqual(['tts-attempt', 'tts-success']);
    expect(events[0]).toMatchObject({ type: 'tts-attempt', tier: 'inworld' });
    expect(events[1]).toMatchObject({ type: 'tts-success', tier: 'inworld' });
  });

  it('Tier 1 fail → Tier 3: emits attempt → fallback → web-speech attempt', async () => {
    speakAzureMock.mockResolvedValueOnce(false);
    isKokoroSupportedMock.mockReturnValue(false);
    getKokoroVoiceMock.mockReturnValue(null);
    const events = recordEvents();

    await speak('test', 0.5, 1.0, 'en-US', 'friendly');

    const types = events.map((e) => e.type);
    expect(types).toContain('tts-attempt');
    expect(types).toContain('tts-fallback');
    // First event = portal attempt
    expect(events[0]).toMatchObject({ type: 'tts-attempt', tier: 'inworld' });
    // Should fall back to web-speech (kokoro disabled in this test)
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

  it('Tier 1 fail when Kokoro available: kokoroEnabled=false bypasses Kokoro → web-speech', async () => {
    // kokoroEnabled is hardcoded false in speechService — Kokoro is never reached
    // even when isKokoroSupported() and getKokoroVoice() both return truthy values.
    // This pins the direct inworld→web-speech path that is currently active.
    speakAzureMock.mockResolvedValueOnce(false);
    isKokoroSupportedMock.mockReturnValue(true);
    getKokoroVoiceMock.mockReturnValue({ name: 'af_sky' });
    speakWithKokoroMock.mockResolvedValueOnce(undefined);
    const events = recordEvents();

    await speak('hi', 0.5, 1.0, 'en-US', 'friendly');

    const fallback = events.find((e) => e.type === 'tts-fallback');
    expect(fallback).toMatchObject({
      type: 'tts-fallback',
      fromTier: 'inworld',
      toTier: 'web-speech',
    });
    // Kokoro must NOT appear on the bus
    expect(events.find((e) => ('tier' in e && e.tier === 'kokoro') || ('fromTier' in e && e.fromTier === 'kokoro') || ('toTier' in e && e.toTier === 'kokoro'))).toBeUndefined();
  });

  it('Tier 1 fail + Kokoro fail: kokoroEnabled=false → single fallback inworld→web-speech only', async () => {
    // When kokoroEnabled=false the double-fallback chain (inworld→kokoro→web-speech)
    // cannot fire. Kokoro is skipped entirely regardless of isKokoroSupported().
    // This test documents that single-fallback is the correct observable behaviour.
    speakAzureMock.mockResolvedValueOnce(false);
    isKokoroSupportedMock.mockReturnValue(true);
    getKokoroVoiceMock.mockReturnValue({ name: 'af_sky' });
    speakWithKokoroMock.mockRejectedValueOnce(new Error('model load failed'));
    const events = recordEvents();

    await speak('test', 0.5, 1.0, 'en-US', 'friendly');

    const fallbacks = events.filter((e) => e.type === 'tts-fallback');
    expect(fallbacks).toHaveLength(1);
    expect(fallbacks[0]).toMatchObject({ fromTier: 'inworld', toTier: 'web-speech' });
    expect(events.find((e) => ('tier' in e && e.tier === 'kokoro') || ('fromTier' in e && e.fromTier === 'kokoro') || ('toTier' in e && e.toTier === 'kokoro'))).toBeUndefined();
  });

  it('attempt event includes lang + first 80 chars of text', async () => {
    speakAzureMock.mockResolvedValueOnce(true);
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
    speakAzureMock.mockResolvedValueOnce(true);
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
