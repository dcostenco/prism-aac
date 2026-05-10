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
 * Class 4 — Fallback default (NaN/0/negative stored rate → SSML 1.00)
 *   Bad localStorage values must not produce silence or chipmunk.
 *
 * These tests run headlessly in CI. They cannot verify that audio PLAYS
 * through the speaker — that requires tts-live-diag-rate.mjs + human ear
 * on prod. But they catch every regression BEFORE it ships.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { buildSSML } from '@/services/azureTTS';

// ── Class 1: SSML rate scale ──────────────────────────────────────────────────

describe('Class 1 — SSML rate scale (RO/RU slow + EN chipmunk prevention)', () => {

  const cases: Array<{ stored: number; expectedSSML: number; label: string }> = [
    // The persisted default. MUST be 1.00 (normal speed).
    // Regression: was 0.50 → RO/RU played at half speed.
    { stored: 0.50, expectedSSML: 1.00, label: 'default 0.5 → normal speed 1.00' },

    // Slowest slider position — SSML floor at 0.50.
    { stored: 0.25, expectedSSML: 0.50, label: 'slowest 0.25 → SSML 0.50' },

    // Mid range.
    { stored: 0.40, expectedSSML: 0.80, label: '0.40 → 0.80' },

    // Fast but below chipmunk threshold.
    { stored: 0.60, expectedSSML: 1.20, label: '0.60 → 1.20' },

    // At the cap boundary.
    { stored: 0.70, expectedSSML: 1.40, label: '0.70 → 1.40 (cap)' },

    // Slider at 1.0 — user who cranked it to fight slow speech.
    // Regression: rate*2 uncapped → SSML 2.00 = chipmunk.
    // Must be ≤ 1.40.
    { stored: 1.00, expectedSSML: 1.40, label: 'slider max 1.0 → 1.40 NOT chipmunk' },

    // Way above cap — still 1.40.
    { stored: 4.00, expectedSSML: 1.40, label: 'absurd 4.0 → capped 1.40' },
    { stored: 10.0, expectedSSML: 1.40, label: 'absurd 10.0 → capped 1.40' },
  ];

  for (const { stored, expectedSSML, label } of cases) {
    it(label, () => {
      const ssml = buildSSML('test', 'ro-RO', 'friendly', stored, 1.0);
      const m = ssml.match(/rate="([\d.]+)"/);
      expect(m, `no rate= in SSML: ${ssml.slice(0, 200)}`).not.toBeNull();
      const actual = Number(m![1]);
      expect(actual).toBeCloseTo(expectedSSML, 2);
    });
  }

  it('chipmunk gate: stored 1.0 → SSML strictly < 1.5 (tts-live-diag-rate threshold)', () => {
    const ssml = buildSSML('test', 'ro-RO', 'friendly', 1.0, 1.0);
    const m = ssml.match(/rate="([\d.]+)"/);
    const rate = Number(m![1]);
    expect(rate).toBeLessThan(1.5);
  });

  it('applies same formula to ALL Azure languages, not just RO', () => {
    const langs = ['ro-RO', 'ru-RU', 'uk-UA', 'de-DE', 'ja-JP', 'ko-KR', 'ar-SA'];
    for (const lang of langs) {
      const ssml = buildSSML('test', lang, 'friendly', 0.5, 1.0);
      const m = ssml.match(/rate="([\d.]+)"/);
      expect(Number(m![1]), `${lang} default rate wrong`).toBeCloseTo(1.0, 2);
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

describe('Class 4 — bad stored rate values fall back to SSML 1.00', () => {
  const badValues: Array<{ value: number; label: string }> = [
    { value: NaN,      label: 'NaN' },
    { value: 0,        label: 'zero' },
    { value: -1,       label: 'negative' },
    { value: -0.5,     label: 'negative fraction' },
    { value: Infinity, label: 'Infinity' },
  ];

  for (const { value, label } of badValues) {
    it(`${label} → SSML 1.00 (normal speed, not silence)`, () => {
      const ssml = buildSSML('test', 'ro-RO', 'friendly', value, 1.0);
      const m = ssml.match(/rate="([\d.]+)"/);
      expect(m, `no rate= in SSML for input ${value}`).not.toBeNull();
      expect(Number(m![1])).toBeCloseTo(1.0, 2);
    });
  }
});

// ── Class 5: SSML format — no percent regression ─────────────────────────────

describe('Class 5 — SSML wire format (no percent = no chipmunk)', () => {
  it('emits decimal multiplier, never unsigned percent string', () => {
    for (const rate of [0.25, 0.5, 0.75, 1.0]) {
      const ssml = buildSSML('test', 'ro-RO', 'friendly', rate, 1.0);
      expect(ssml, `rate=${rate} emitted percent`).not.toMatch(/rate="\d+%"/);
      expect(ssml, `rate=${rate} missing decimal rate`).toMatch(/rate="[\d.]+"/);
    }
  });

  it('never emits pitch attribute (parser-fragile across Azure implementations)', () => {
    const ssml = buildSSML('test', 'ro-RO', 'friendly', 0.5, 1.0);
    expect(ssml).not.toMatch(/\bpitch=/);
  });
});
