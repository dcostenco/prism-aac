/**
 * Behavioral test for confidence gate + filler rejection.
 * Drives the real startVoiceInput through a mock SpeechRecognition.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

type SR = {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  maxAlternatives: number;
  onresult: ((e: { resultIndex: number; results: ArrayLike<{ isFinal: boolean; 0: { transcript: string; confidence: number } }> }) => void) | null;
  onerror: ((e: { error: string }) => void) | null;
  onend: (() => void) | null;
  onspeechend: (() => void) | null;
  start: () => void;
  stop: () => void;
  abort: () => void;
};

let lastInstance: SR | null = null;

function fireResult(transcript: string, confidence: number, isFinal = true) {
  lastInstance!.onresult!({
    resultIndex: 0,
    results: { length: 1, 0: { isFinal, 0: { transcript, confidence } } },
  });
}

describe('voiceInputService — confidence gate (behavioral)', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    lastInstance = null;
    class MockSR implements SR {
      continuous = false;
      interimResults = true;
      lang = 'en-US';
      maxAlternatives = 1;
      onresult: SR['onresult'] = null;
      onerror: SR['onerror'] = null;
      onend: SR['onend'] = null;
      onspeechend: SR['onspeechend'] = null;
      start() { lastInstance = this; }
      stop() {}
      abort() {}
    }
    (window as unknown as { SpeechRecognition: typeof MockSR }).SpeechRecognition = MockSR;
  });

  afterEach(() => {
    vi.useRealTimers();
    delete (window as unknown as { SpeechRecognition?: unknown }).SpeechRecognition;
  });

  it('drops final result with confidence < 0.6', async () => {
    const { startVoiceInput } = await import('@/services/voiceInputService');
    const onFinal = vi.fn();
    startVoiceInput({ lang: 'en', onInterim: () => {}, onFinal });
    expect(lastInstance).not.toBeNull();
    fireResult('garbled noise', 0.3, true);
    expect(onFinal).not.toHaveBeenCalled();
  });

  it('passes final result with confidence >= 0.6', async () => {
    const { startVoiceInput } = await import('@/services/voiceInputService');
    const onFinal = vi.fn();
    startVoiceInput({ lang: 'en', onInterim: () => {}, onFinal });
    fireResult('hello world', 0.9, true);
    expect(onFinal).toHaveBeenCalledWith('hello world');
  });

  it('passes final result with confidence === 0 (browser unsupported)', async () => {
    const { startVoiceInput } = await import('@/services/voiceInputService');
    const onFinal = vi.fn();
    startVoiceInput({ lang: 'en', onInterim: () => {}, onFinal });
    fireResult('hello', 0, true);
    expect(onFinal).toHaveBeenCalledWith('hello');
  });

  it('drops filler-only final ("uh")', async () => {
    const { startVoiceInput } = await import('@/services/voiceInputService');
    const onFinal = vi.fn();
    startVoiceInput({ lang: 'en', onInterim: () => {}, onFinal });
    fireResult('uh', 0.9, true);
    expect(onFinal).not.toHaveBeenCalled();
  });

  it('passes valid single-word utterance "yeah" (not a filler)', async () => {
    const { startVoiceInput } = await import('@/services/voiceInputService');
    const onFinal = vi.fn();
    startVoiceInput({ lang: 'en', onInterim: () => {}, onFinal });
    fireResult('yeah', 0.9, true);
    expect(onFinal).toHaveBeenCalledWith('yeah');
  });

  it('passes valid single-word "no" in Polish (not a filler)', async () => {
    const { startVoiceInput } = await import('@/services/voiceInputService');
    const onFinal = vi.fn();
    startVoiceInput({ lang: 'pl', onInterim: () => {}, onFinal });
    fireResult('no', 0.9, true);
    expect(onFinal).toHaveBeenCalledWith('no');
  });

  it('drops Bulgarian filler "ъм" but passes "да"', async () => {
    const { startVoiceInput } = await import('@/services/voiceInputService');
    const onFinal = vi.fn();
    startVoiceInput({ lang: 'bg', onInterim: () => {}, onFinal });
    fireResult('ъм', 0.9, true);
    expect(onFinal).not.toHaveBeenCalled();
    fireResult('да', 0.9, true);
    expect(onFinal).toHaveBeenCalledWith('да');
  });

  it('interims always pass through regardless of confidence', async () => {
    const { startVoiceInput } = await import('@/services/voiceInputService');
    const onInterim = vi.fn();
    startVoiceInput({ lang: 'en', onInterim, onFinal: () => {} });
    fireResult('garb', 0.2, false);
    expect(onInterim).toHaveBeenCalledWith('garb');
  });
});
