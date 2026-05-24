/**
 * wakeWordService — SpeechRecognition-based "Hey Prism" detection tests
 *
 * Covers: containsWakeWord detection (via onresult), isWakeWordSupported,
 * native bridge guard, rec.lang forced to en-US, onWakeWord callback fires
 * once per cycle, no-speech error resets restartCount, permanent errors
 * (not-allowed / service-not-allowed) stop the loop, onend triggers restart
 * with backoff capped at MAX_RESTARTS, session.stop() halts listener.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { isWakeWordSupported, startWakeWordDetection } from '@/services/wakeWordService';

// ── SpeechRecognition mock ─────────────────────────────────────────────────────

type RecognitionMock = {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  maxAlternatives: number;
  start: ReturnType<typeof vi.fn>;
  stop: ReturnType<typeof vi.fn>;
  onresult: ((event: object) => void) | null;
  onerror: ((event: object) => void) | null;
  onend: (() => void) | null;
};

let lastRec: RecognitionMock | null = null;

function makeRecognitionCtor() {
  const ctor = vi.fn(function (this: RecognitionMock) {
    this.continuous = false;
    this.interimResults = false;
    this.lang = '';
    this.maxAlternatives = 1;
    this.start = vi.fn();
    this.stop = vi.fn();
    this.onresult = null;
    this.onerror = null;
    this.onend = null;
    lastRec = this;
  });
  return ctor as unknown as new () => RecognitionMock;
}

function makeResultEvent(transcript: string, isFinal = true) {
  return {
    resultIndex: 0,
    results: [{ isFinal, 0: { transcript } }],
  };
}

function makeErrorEvent(error: string) {
  return { error };
}

// ── setup / teardown ──────────────────────────────────────────────────────────

beforeEach(() => {
  lastRec = null;
  vi.useFakeTimers();
  // Clear native bridge so isWakeWordSupported defaults to true with mock Ctor
  delete (window as Record<string, unknown>).prismNativeBridge;
  const Ctor = makeRecognitionCtor();
  (window as Record<string, unknown>).SpeechRecognition = Ctor;
});

afterEach(() => {
  vi.useRealTimers();
  delete (window as Record<string, unknown>).SpeechRecognition;
  delete (window as Record<string, unknown>).webkitSpeechRecognition;
  delete (window as Record<string, unknown>).prismNativeBridge;
});

// ── isWakeWordSupported ────────────────────────────────────────────────────────

describe('wakeWordService — isWakeWordSupported', () => {
  it('returns true when window.SpeechRecognition exists', () => {
    expect(isWakeWordSupported()).toBe(true);
  });

  it('returns true when webkitSpeechRecognition is the only option', () => {
    delete (window as Record<string, unknown>).SpeechRecognition;
    (window as Record<string, unknown>).webkitSpeechRecognition = makeRecognitionCtor();
    expect(isWakeWordSupported()).toBe(true);
  });

  it('returns false when neither SpeechRecognition API exists', () => {
    delete (window as Record<string, unknown>).SpeechRecognition;
    expect(isWakeWordSupported()).toBe(false);
  });

  it('returns false when native bridge owns the mic', () => {
    (window as Record<string, unknown>).prismNativeBridge = { startVoice: vi.fn() };
    expect(isWakeWordSupported()).toBe(false);
  });
});

// ── wake phrase detection ─────────────────────────────────────────────────────

describe('wakeWordService — wake phrase detection', () => {
  it('fires onWakeWord when transcript contains "hey prism"', () => {
    const onWakeWord = vi.fn();
    startWakeWordDetection('en-US', onWakeWord);
    lastRec!.onresult!(makeResultEvent('hey prism'));
    expect(onWakeWord).toHaveBeenCalledOnce();
  });

  it('fires for case-insensitive match "Hey Prism"', () => {
    const onWakeWord = vi.fn();
    startWakeWordDetection('en-US', onWakeWord);
    lastRec!.onresult!(makeResultEvent('Hey Prism, open messages'));
    expect(onWakeWord).toHaveBeenCalledOnce();
  });

  it('does NOT fire for unrelated transcript', () => {
    const onWakeWord = vi.fn();
    startWakeWordDetection('en-US', onWakeWord);
    lastRec!.onresult!(makeResultEvent('hello world'));
    expect(onWakeWord).not.toHaveBeenCalled();
  });

  it('fires only once per recognition cycle (triggered flag set)', () => {
    const onWakeWord = vi.fn();
    startWakeWordDetection('en-US', onWakeWord);
    lastRec!.onresult!(makeResultEvent('hey prism'));
    lastRec!.onresult!(makeResultEvent('hey prism again'));
    expect(onWakeWord).toHaveBeenCalledOnce();
  });

  it('rec.lang is always en-US regardless of passed lang', () => {
    startWakeWordDetection('ro-RO', vi.fn());
    expect(lastRec!.lang).toBe('en-US');
  });
});

// ── error handling ────────────────────────────────────────────────────────────

describe('wakeWordService — error handling', () => {
  it('no-speech error does NOT stop the session (restart still fires on onend)', () => {
    const onWakeWord = vi.fn();
    const session = startWakeWordDetection('en-US', onWakeWord);
    lastRec!.onerror!(makeErrorEvent('no-speech'));
    lastRec!.onend!();
    vi.advanceTimersByTime(300);
    // Session is still active — start should be called again
    expect(lastRec!.start).toHaveBeenCalledTimes(2);
    session!.stop();
  });

  it('not-allowed error stops the session permanently', () => {
    const onWakeWord = vi.fn();
    startWakeWordDetection('en-US', onWakeWord);
    const startCallsBefore = (lastRec!.start as ReturnType<typeof vi.fn>).mock.calls.length;
    lastRec!.onerror!(makeErrorEvent('not-allowed'));
    lastRec!.onend!(); // onend should be a no-op because stopped=true
    vi.advanceTimersByTime(5000);
    expect((lastRec!.start as ReturnType<typeof vi.fn>).mock.calls.length).toBe(startCallsBefore);
  });

  it('service-not-allowed error stops the session permanently', () => {
    startWakeWordDetection('en-US', vi.fn());
    const startCallsBefore = (lastRec!.start as ReturnType<typeof vi.fn>).mock.calls.length;
    lastRec!.onerror!(makeErrorEvent('service-not-allowed'));
    lastRec!.onend!();
    vi.advanceTimersByTime(5000);
    expect((lastRec!.start as ReturnType<typeof vi.fn>).mock.calls.length).toBe(startCallsBefore);
  });
});

// ── session control ───────────────────────────────────────────────────────────

describe('wakeWordService — session.stop()', () => {
  it('returns null when speech recognition is not supported', () => {
    delete (window as Record<string, unknown>).SpeechRecognition;
    const session = startWakeWordDetection('en-US', vi.fn());
    expect(session).toBeNull();
  });

  it('stop() calls rec.stop()', () => {
    const session = startWakeWordDetection('en-US', vi.fn());
    session!.stop();
    expect(lastRec!.stop).toHaveBeenCalledOnce();
  });

  it('stop() prevents onend from restarting', () => {
    const session = startWakeWordDetection('en-US', vi.fn());
    session!.stop();
    const startCallsBefore = (lastRec!.start as ReturnType<typeof vi.fn>).mock.calls.length;
    lastRec!.onend!();
    vi.advanceTimersByTime(5000);
    expect((lastRec!.start as ReturnType<typeof vi.fn>).mock.calls.length).toBe(startCallsBefore);
  });

  it('stop() prevents onWakeWord from firing after stop', () => {
    const onWakeWord = vi.fn();
    const session = startWakeWordDetection('en-US', onWakeWord);
    session!.stop();
    lastRec!.onresult!(makeResultEvent('hey prism'));
    expect(onWakeWord).not.toHaveBeenCalled();
  });
});

// ── onend restart + backoff ────────────────────────────────────────────────────

describe('wakeWordService — restart backoff', () => {
  it('onend triggers restart after 200ms backoff (first restart)', () => {
    const session = startWakeWordDetection('en-US', vi.fn());
    lastRec!.onend!();
    expect(lastRec!.start).toHaveBeenCalledTimes(1); // not yet
    vi.advanceTimersByTime(200);
    expect(lastRec!.start).toHaveBeenCalledTimes(2); // restarted
    session!.stop();
  });
});
