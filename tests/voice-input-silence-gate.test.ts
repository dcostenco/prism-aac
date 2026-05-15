/**
 * Regression for the "mic appears to stop immediately after tapping" bug.
 *
 * Before fix: startVoiceInput called checkSilence() immediately after
 * rec.start(), arming a 2-second timer. If the user tapped the mic and
 * didn't start speaking fast enough, onSilence fired and the consumer
 * (AIChatPanel.toggleVoice's onSilence handler) called .stop() — making
 * the mic appear non-functional.
 *
 * After fix: the silence timer is only armed after the engine produces
 * the first speech result (interim or final). A no-speech onerror event
 * is also ignored unless speech has actually started.
 */
import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';

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

describe('voiceInputService — silence gate', () => {
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

  it('does NOT fire onSilence before any speech result, even after silenceMs', async () => {
    const { startVoiceInput } = await import('@/services/voiceInputService');
    const onSilence = vi.fn();
    const session = startVoiceInput({
      lang: 'en-US',
      silenceMs: 100,
      onInterim: () => {},
      onFinal: () => {},
      onSilence,
    });
    expect(session).not.toBeNull();
    // Advance way past the silence threshold without any speech result.
    vi.advanceTimersByTime(500);
    expect(onSilence).not.toHaveBeenCalled();
  });

  it('ignores no-speech errors before speech has started', async () => {
    const { startVoiceInput } = await import('@/services/voiceInputService');
    const onSilence = vi.fn();
    const onError = vi.fn();
    startVoiceInput({
      lang: 'en-US',
      onInterim: () => {},
      onFinal: () => {},
      onSilence,
      onError,
    });
    expect(lastInstance).not.toBeNull();
    lastInstance!.onerror?.({ error: 'no-speech' });
    expect(onSilence).not.toHaveBeenCalled();
    expect(onError).not.toHaveBeenCalled();
  });

  it('fires onSilence after speech has started and silenceMs elapses', async () => {
    const { startVoiceInput } = await import('@/services/voiceInputService');
    const onSilence = vi.fn();
    startVoiceInput({
      lang: 'en-US',
      silenceMs: 100,
      onInterim: () => {},
      onFinal: () => {},
      onSilence,
    });
    expect(lastInstance).not.toBeNull();
    // Simulate a first interim result — this should arm the silence timer.
    lastInstance!.onresult?.({
      resultIndex: 0,
      results: [{ isFinal: false, 0: { transcript: 'hi', confidence: 0.9 } }] as never,
    });
    // Now advance past the silence threshold — onSilence should fire.
    vi.advanceTimersByTime(150);
    expect(onSilence).toHaveBeenCalledTimes(1);
  });

  it('no-speech AFTER speech started DOES fire onSilence', async () => {
    const { startVoiceInput } = await import('@/services/voiceInputService');
    const onSilence = vi.fn();
    startVoiceInput({
      lang: 'en-US',
      onInterim: () => {},
      onFinal: () => {},
      onSilence,
    });
    expect(lastInstance).not.toBeNull();
    // First, simulate a speech result so speechStarted=true.
    lastInstance!.onresult?.({
      resultIndex: 0,
      results: [{ isFinal: false, 0: { transcript: 'hi', confidence: 0.9 } }] as never,
    });
    // Then no-speech error should now route to onSilence.
    lastInstance!.onerror?.({ error: 'no-speech' });
    expect(onSilence).toHaveBeenCalledTimes(1);
  });
});
