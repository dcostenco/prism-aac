/**
 * Prediction routing regression test (v0.2.1 — Prism Coder 7B/14B release).
 *
 * Coordinated with synalux-platform v0.14.4 which:
 *   1. Added tier-aware local routing in /api/v1/prism-aac/chat
 *      (free → 7B, standard+ → 7B simple / 14B medium, complex → cloud)
 *   2. Removed tier gate on /api/v1/tts so Azure Neural + auto-tone work
 *      for ALL authenticated tiers (not just paid).
 *
 * This test pins prediction behaviour that MUST remain stable across those
 * portal-side changes. If predictions regress because of tone/Azure changes
 * leaking into the prediction path, this test fails.
 */
import { describe, it, expect } from 'vitest';
import { getPredictions } from '@/engine/predictionEngine';
import type { WordFreqEntry } from '@/types';

const now = Date.now();

function freq(words: Record<string, number>): Record<string, WordFreqEntry> {
  const out: Record<string, WordFreqEntry> = {};
  for (const [w, count] of Object.entries(words)) {
    out[w] = { count, lastUsed: now };
  }
  return out;
}

describe('Prediction routing regression — v0.2.1 release safety net', () => {
  describe('Empty / cold-start state (Universal Core defaults)', () => {
    it('returns 5 predictions on empty input even with no learned data', () => {
      const preds = getPredictions('', {}, {});
      expect(preds).toHaveLength(5);
    });

    it('keeps "I" in defaults — high-priority pronoun for AAC users', () => {
      const preds = getPredictions('', {}, {});
      expect(preds).toContain('I');
    });
  });

  describe('Model-release-relevant: predictions stay independent of TTS routing', () => {
    // Prediction engine is pure data + n-gram math. It must NEVER depend on
    // /api/v1/tts response (tone/Azure) or on chat-route model selection.
    // This block asserts that contract by exercising prediction with various
    // contexts that span tone-relevant phrasing.

    it('prediction is consistent for emotional ("urgent") phrasing', () => {
      const wf = freq({ help: 10, please: 5, stop: 3 });
      const preds = getPredictions('I need ', wf, {});
      expect(preds.length).toBeGreaterThan(0);
      // Top prediction should be the highest-freq matching word.
      // No tone-style influence — pure frequency + recency.
      expect(preds[0]).toBe('help');
    });

    it('prediction is consistent for cheerful phrasing', () => {
      const wf = freq({ play: 12, fun: 8, friends: 3 });
      const preds = getPredictions('I want to ', wf, {});
      expect(preds[0]).toBe('play');
    });

    it('prediction is deterministic given identical inputs', () => {
      const wf = freq({ apple: 5, banana: 3, cherry: 1 });
      const a = getPredictions('I like ', wf, {});
      const b = getPredictions('I like ', wf, {});
      expect(a).toEqual(b);
    });
  });

  describe('Multi-language safety (translate route is on a different path)', () => {
    // Translate runs through /api/v1/prism-aac/chat, which is now tier-aware
    // (paid → 14B local, free → cloud). Predictions are LOCAL n-gram only and
    // must stay deterministic regardless of which translate backend is used.

    it('handles non-ASCII prediction context (Spanish)', () => {
      const wf = freq({ ayuda: 8, agua: 5, comida: 3 });
      const preds = getPredictions('Necesito ', wf, {});
      expect(preds[0]).toBe('ayuda');
    });

    it('handles RTL prediction context (Arabic) without crashing', () => {
      const wf = freq({ مساعدة: 5, ماء: 3 });
      // Smoke check: must not throw, must return an array.
      expect(() => getPredictions('أريد ', wf, {})).not.toThrow();
      const preds = getPredictions('أريد ', wf, {});
      expect(Array.isArray(preds)).toBe(true);
    });

    it('handles CJK prediction context (Mandarin) without crashing', () => {
      const wf = freq({ 帮助: 5, 水: 3, 食物: 2 });
      expect(() => getPredictions('我要 ', wf, {})).not.toThrow();
      const preds = getPredictions('我要 ', wf, {});
      expect(Array.isArray(preds)).toBe(true);
    });
  });

  describe('Capacity bounds (no slowdown when freq table grows)', () => {
    it('handles 1K-entry word frequency table without performance regression', () => {
      const wf: Record<string, WordFreqEntry> = {};
      for (let i = 0; i < 1000; i++) {
        wf[`word${i}`] = { count: 1000 - i, lastUsed: now - i };
      }
      const start = performance.now();
      const preds = getPredictions('', wf, {});
      const elapsed = performance.now() - start;
      expect(preds).toHaveLength(5);
      // Generous ceiling — the engine should be sub-millisecond for 1K rows
      // on any reasonable machine. Catches accidental O(n²) regressions.
      expect(elapsed).toBeLessThan(50);
    });
  });
});
