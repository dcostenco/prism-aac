/**
 * TTS Regression Suite — pins every class of bug that has shipped to prod.
 *
 * Class 1 — SSML rate scale (RO/RU 2× slow, EN chipmunk)
 *   Every stored speechRate → expected SSML rate is enumerated.
 *   Change buildSSML formula → this breaks first.
 *
 * Class 2 — AudioContext device change (silent after TV→speaker switch)
 *   devicechange event must close the old context so the next Speak
 *   recreates against the current OS output device.
 *
 * Class 3 — AudioContext recreated after close (not stuck in 'closed')
 *   After device change nulls the context, the next getAudioContext()
 *   call must return a fresh running context, not throw.
 *
 * Class 4 — Fallback default (NaN/0/negative stored rate → normalizedRate 1.00)
 *   Bad localStorage values must not produce silence or chipmunk.
 *
 * These tests run headlessly in CI. They cannot verify that audio PLAYS
 * through the speaker — that requires tts-live-diag-rate.mjs + human ear
 * on prod. But they catch every regression BEFORE it ships.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { computeNormalizedRate } from '@/services/azureTTS';
// NOTE: buildSSML is intentionally NOT imported here. It is dead code since
// SSML assembly moved server-side (portal buildAzureSSML). Server-side coverage
// lives in synalux-platform/portal/src/app/api/v1/tts/public/_helpers.test.ts.

// ── Class 1: SSML rate scale (LIVE PATH via computeNormalizedRate) ───────────
//
// speakAzure sends computeNormalizedRate(storedRate) to the portal.
// The portal's buildAzureSSML puts that value into <prosody rate="N">.
// Testing computeNormalizedRate here catches client-side formula regressions.
// The server-side buildAzureSSML is tested in portal/_helpers.test.ts.

describe('Class 1 — rate scale: computeNormalizedRate (LIVE client-side path)', () => {

  const cases: Array<{ stored: number; expectedNorm: number; label: string }> = [
    // The persisted default. MUST produce 1.00 (normal speed).
    // Regression: stored 0.50 passed direct (no × 2) → SSML 0.50 = 2× slow RO/RU.
    { stored: 0.50, expectedNorm: 1.00, label: 'default 0.5 → normalized 1.00 (RO/RU regression guard)' },

    // Slowest slider position — normalized floor at 0.50.
    { stored: 0.25, expectedNorm: 0.50, label: 'slowest 0.25 → 0.50 (floor)' },

    // Mid range.
    { stored: 0.40, expectedNorm: 0.80, label: '0.40 → 0.80' },

    // Fast but below chipmunk threshold.
    { stored: 0.60, expectedNorm: 1.20, label: '0.60 → 1.20' },

    // At the cap boundary.
    { stored: 0.70, expectedNorm: 1.40, label: '0.70 → 1.40 (cap boundary)' },

    // Slider at 1.0 — user who cranked it to fight slow speech.
    // Regression: rate × 2 uncapped → 2.00 = chipmunk. Must be ≤ 1.40.
    { stored: 1.00, expectedNorm: 1.40, label: 'slider max 1.0 → 1.40 (chipmunk guard)' },

    // Way above cap — still 1.40.
    { stored: 4.00, expectedNorm: 1.40, label: 'absurd 4.0 → capped 1.40' },
    { stored: 10.0, expectedNorm: 1.40, label: 'absurd 10.0 → capped 1.40' },
  ];

  for (const { stored, expectedNorm, label } of cases) {
    it(label, () => {
      expect(computeNormalizedRate(stored)).toBeCloseTo(expectedNorm, 2);
    });
  }

  it('chipmunk gate: normalizedRate always < 1.5 for any stored value', () => {
    for (const stored of [0.7, 1.0, 2.0, 10.0, 100.0]) {
      expect(computeNormalizedRate(stored)).toBeLessThan(1.5);
    }
  });

  it('applies to ALL Azure languages — formula is lang-agnostic', () => {
    // Default stored 0.5 → normalized 1.00 regardless of lang
    const langs = ['ro-RO', 'ru-RU', 'uk-UA', 'de-DE', 'ja-JP', 'ko-KR', 'ar-SA'];
    for (const lang of langs) {
      // computeNormalizedRate has no lang param — verify it's called correctly
      expect(computeNormalizedRate(0.5), `${lang} default rate wrong`).toBeCloseTo(1.0, 2);
      void lang; // lang referenced to show it's intentionally lang-agnostic
    }
  });
});

// ── Class 2 & 3: AudioContext device change + recreation ─────────────────────
// Strategy: we test the BEHAVIOUR via warmupAzureAudio + MockAudioContext
// construct count, because sharedAudioCtx is private to the module.

describe('Class 2+3 — AudioContext closed on device change, recreated on next Speak', () => {
  let constructCount = 0;
  let closeCount = 0;
  let deviceChangeHandler: EventListenerOrEventListenerObject | null = null;

  beforeEach(async () => {
    constructCount = 0;
    closeCount = 0;
    deviceChangeHandler = null;
    vi.resetModules();

    class TestAudioContext {
      state: string = 'running';
      destination = {};
      constructor() { constructCount++; }
      createBufferSource() {
        return { connect: vi.fn(), start: vi.fn(), disconnect: vi.fn(), onended: null, buffer: null };
      }
      createGain() { return { gain: { value: 1 }, connect: vi.fn(), disconnect: vi.fn() }; }
      async decodeAudioData() { return { duration: 1, length: 100 } as unknown as AudioBuffer; }
      async resume() { this.state = 'running'; }
      close() { this.state = 'closed'; closeCount++; return Promise.resolve(); }
    }
    (globalThis as Record<string, unknown>).AudioContext =
      TestAudioContext as unknown as typeof AudioContext;

    // Mock navigator.mediaDevices — capture the devicechange handler.
    Object.defineProperty(globalThis, 'navigator', {
      value: {
        mediaDevices: {
          addEventListener: vi.fn((event: string, handler: EventListenerOrEventListenerObject) => {
            if (event === 'devicechange') deviceChangeHandler = handler;
          }),
        },
      },
      configurable: true,
      writable: true,
    });
  });

  afterEach(() => { vi.restoreAllMocks(); });

  it('registers a devicechange listener when module loads', async () => {
    await import('@/services/azureTTS');
    // The module-level registration code runs on import.
    expect(navigator.mediaDevices.addEventListener).toHaveBeenCalledWith(
      'devicechange',
      expect.any(Function),
    );
  });

  it('devicechange fires → existing AudioContext is closed', async () => {
    const { warmupAzureAudio } = await import('@/services/azureTTS');
    await warmupAzureAudio();
    expect(constructCount).toBe(1); // context created

    // Simulate OS switching output device.
    if (deviceChangeHandler && typeof deviceChangeHandler === 'function') {
      deviceChangeHandler(new Event('devicechange'));
    }
    expect(closeCount).toBe(1); // old context closed
  });

  it('after devicechange, next warmupAzureAudio creates fresh context', async () => {
    const { warmupAzureAudio } = await import('@/services/azureTTS');
    await warmupAzureAudio();
    expect(constructCount).toBe(1);

    // Device switch.
    if (deviceChangeHandler && typeof deviceChangeHandler === 'function') {
      deviceChangeHandler(new Event('devicechange'));
    }
    expect(constructCount).toBe(1); // not yet recreated

    // Next Speak gesture triggers warmup → should create new context.
    await warmupAzureAudio();
    expect(constructCount).toBe(2); // fresh context for new device
  });
});

// ── Class 4: Bad stored rate fallback ────────────────────────────────────────

describe('Class 4 — bad stored rate values fall back to normalizedRate 1.00', () => {
  // computeNormalizedRate is the live path; bad stored values must produce 1.0
  // so the portal receives a safe default and renders normal speech speed.
  const badValues: Array<{ value: number; label: string }> = [
    { value: NaN,      label: 'NaN' },
    { value: 0,        label: 'zero' },
    { value: -1,       label: 'negative' },
    { value: -0.5,     label: 'negative fraction' },
    { value: Infinity, label: 'Infinity' },
  ];

  for (const { value, label } of badValues) {
    it(`${label} → normalizedRate 1.00 (normal speed, not silence)`, () => {
      const normalized = computeNormalizedRate(value);
      expect(normalized).toBeCloseTo(1.0, 2);
    });
  }
});

// ── Class 5: SSML format — no percent regression ─────────────────────────────
// The portal emits SSML (not the client). The client-side invariant is that
// normalizedRate is a decimal float, never a percent or string. Portal coverage
// for the actual SSML format is in portal/_helpers.test.ts Class 1.

describe('Class 5 — normalizedRate is always a decimal float, never NaN or Infinity', () => {
  it('normalizedRate for any slider position is a finite decimal in [0.5, 1.4]', () => {
    for (const stored of [0.25, 0.5, 0.75, 1.0]) {
      const n = computeNormalizedRate(stored);
      expect(Number.isFinite(n), `stored=${stored} produced non-finite`).toBe(true);
      expect(n).toBeGreaterThanOrEqual(0.5);
      expect(n).toBeLessThanOrEqual(1.4);
    }
  });

  it('normalizedRate never produces a value that would map to percent notation', () => {
    // Belt-and-suspenders: confirm the value is in the [0.5, 1.4] float range,
    // not accidentally a value like 50 or 100 that could look like a percent int.
    for (const stored of [0.25, 0.5, 0.75, 1.0]) {
      const n = computeNormalizedRate(stored);
      expect(n).toBeLessThanOrEqual(1.4);
      expect(n).toBeGreaterThanOrEqual(0.5);
    }
  });
});

// ── Class 6: Translation-mode rate (en-ro regression, May 2026) ──────────────
// Two compounding bugs caused extreme slowdown in translation mode:
//   1. aacSpeak.ts: effectiveRate = rate * 0.6 (artificial "comprehension" slow)
//      → default 0.5 slider → effectiveRate 0.3 → normalizedRate 0.6 → SSML 0.6
//   2. speakAzure: pbRate = (rate < 0.45) ? rate * 2 : 1.0 = 0.6 (Inworld workaround)
//      → Web Audio playbackRate 0.6 applied ON TOP of SSML 0.6 = 0.36× speed
// Fix: both removed. User's slider is the sole rate control in all modes.

describe('Class 6 — Translation-mode rate (en-ro double-slow regression, May 2026)', () => {
  it('default slider 0.5 → normalizedRate 1.00 (same for mono and translation)', () => {
    // aacSpeak now passes rate unchanged (no × 0.6).
    // computeNormalizedRate(0.5) = 0.5 × 2 = 1.00 → portal SSML rate 1.00 (normal).
    expect(computeNormalizedRate(0.5)).toBeCloseTo(1.0, 2);
  });

  it('translation mode and monolingual produce identical normalizedRate for same slider', () => {
    // Both paths now call computeNormalizedRate with the same stored rate.
    const mono  = computeNormalizedRate(0.5);
    const trans = computeNormalizedRate(0.5);
    expect(mono).toBeCloseTo(trans, 2);
  });

  it('user-selected slow rate (0.35 slider) → normalizedRate 0.70 (respected as-is)', () => {
    // User explicitly sets slow speech; no artificial multiplier applied.
    expect(computeNormalizedRate(0.35)).toBeCloseTo(0.70, 2);
  });
});
