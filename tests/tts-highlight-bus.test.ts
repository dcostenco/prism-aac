/**
 * ttsHighlightBus — pub/sub + duration estimator tests.
 *
 * The bus is the contract layer between aacSpeak (publishes) and
 * MessageBar (subscribes). The estimator is the heuristic that
 * drives word-by-word highlight pacing.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  subscribeTtsHighlight,
  emitTtsHighlight,
  estimateSpeechDurationMs,
  type TtsHighlightEvent,
} from '@/services/ttsHighlightBus';

describe('ttsHighlightBus pub/sub', () => {
  beforeEach(() => {
    // The bus uses a module-level Set so prior tests can leave
    // listeners in. Subscribe + immediately unsubscribe to flush
    // by no-op (we can't introspect the Set). Each test below uses
    // the unsubscribe return value to clean its own listener.
  });

  it('delivers start events to subscribers', () => {
    const calls: TtsHighlightEvent[] = [];
    const off = subscribeTtsHighlight((e) => calls.push(e));
    emitTtsHighlight({
      type: 'tts-highlight-start',
      text: 'Hello world.',
      estimatedDurationMs: 700,
      timestamp: 12345,
    });
    expect(calls).toHaveLength(1);
    expect(calls[0].type).toBe('tts-highlight-start');
    if (calls[0].type === 'tts-highlight-start') {
      expect(calls[0].text).toBe('Hello world.');
      expect(calls[0].estimatedDurationMs).toBe(700);
    }
    off();
  });

  it('delivers end events to subscribers', () => {
    const calls: TtsHighlightEvent[] = [];
    const off = subscribeTtsHighlight((e) => calls.push(e));
    emitTtsHighlight({ type: 'tts-highlight-end', timestamp: 999 });
    expect(calls).toHaveLength(1);
    expect(calls[0].type).toBe('tts-highlight-end');
    off();
  });

  it('unsubscribe stops further delivery', () => {
    const calls: TtsHighlightEvent[] = [];
    const off = subscribeTtsHighlight((e) => calls.push(e));
    emitTtsHighlight({ type: 'tts-highlight-end', timestamp: 1 });
    off();
    emitTtsHighlight({ type: 'tts-highlight-end', timestamp: 2 });
    expect(calls).toHaveLength(1);
  });

  it('survives a throwing listener (one bad sub does not break others)', () => {
    const good: TtsHighlightEvent[] = [];
    const offBad = subscribeTtsHighlight(() => { throw new Error('boom'); });
    const offGood = subscribeTtsHighlight((e) => good.push(e));
    expect(() => {
      emitTtsHighlight({ type: 'tts-highlight-end', timestamp: 1 });
    }).not.toThrow();
    expect(good).toHaveLength(1);
    offBad(); offGood();
  });
});

describe('estimateSpeechDurationMs', () => {
  it('scales linearly with text length at default rate', () => {
    const a = estimateSpeechDurationMs('Hello.', 0.5);
    const b = estimateSpeechDurationMs('Hello hello hello.', 0.5);
    expect(b).toBeGreaterThan(a);
    // 18 chars vs 6 chars → 3× duration roughly
    expect(b / a).toBeGreaterThan(2.5);
    expect(b / a).toBeLessThan(3.5);
  });

  it('halves duration at double rate', () => {
    const slow = estimateSpeechDurationMs('Hello world.', 0.5);
    const fast = estimateSpeechDurationMs('Hello world.', 1.0);
    // rate=1.0 → multiplier=0.5 → half the duration.
    expect(Math.abs(fast / slow - 0.5)).toBeLessThan(0.05);
  });

  it('floors at 300 ms (avoids zero-length intervals on short input)', () => {
    expect(estimateSpeechDurationMs('a', 1)).toBeGreaterThanOrEqual(300);
    expect(estimateSpeechDurationMs('', 0.5)).toBeGreaterThanOrEqual(300);
  });

  it('clamps absurd rates to a sane range', () => {
    // rate=10 → would be 0.05 multiplier without clamp; clamps at 2.
    const r10 = estimateSpeechDurationMs('Hello world.', 10);
    const r2  = estimateSpeechDurationMs('Hello world.', 2);
    expect(r10).toBe(r2);
  });
});
