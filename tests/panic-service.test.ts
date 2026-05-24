/**
 * panicService — Universal Emergency Stop tests
 *
 * Covers: emergencyStop() calls all sub-service stops, Escape×3 within
 * 1s triggers stop, Escape×2 does NOT, stale Escapes outside 1s window
 * do NOT accumulate, registerPanicListeners idempotency, disposer clears
 * state, 5-finger touch held 2s triggers stop, release before 2s cancels,
 * isPanicServiceActive tracks registration lifecycle.
 *
 * Uses vi.resetModules() per test to avoid module-level `escapeTimestamps`
 * state leaking between tests.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

// ── jsdom Touch polyfill ───────────────────────────────────────────────────────

// jsdom doesn't define the Touch constructor; create a minimal stand-in.
if (typeof Touch === 'undefined') {
  // @ts-expect-error — jsdom polyfill
  global.Touch = class MockTouch {
    identifier: number;
    target: EventTarget;
    constructor(init: { identifier: number; target: EventTarget }) {
      this.identifier = init.identifier;
      this.target = init.target;
    }
  };
}

// ── mock factories (re-applied after each resetModules()) ─────────────────────

const stopSpeechMock = vi.fn();
const stopWasmSpeechMock = vi.fn();
const stopScanMock = vi.fn();
const stopAlarmMock = vi.fn();
const stopFlashMock = vi.fn();
const stopEmergencySpeakerMock = vi.fn();

vi.mock('@/services/speechService', () => ({ stopSpeech: (...a: unknown[]) => stopSpeechMock(...a) }));
vi.mock('@/services/wasmTTS', () => ({ stopWasmSpeech: (...a: unknown[]) => stopWasmSpeechMock(...a) }));
vi.mock('@/services/switchScanService', () => ({ stopScan: (...a: unknown[]) => stopScanMock(...a) }));
vi.mock('@/services/emergencyService', () => ({
  stopAlarm: (...a: unknown[]) => stopAlarmMock(...a),
  stopFlash: (...a: unknown[]) => stopFlashMock(...a),
  stopEmergencySpeaker: (...a: unknown[]) => stopEmergencySpeakerMock(...a),
}));

// ── per-test fresh module (resets escapeTimestamps + panicListenersActive) ────

type PanicMod = typeof import('@/services/panicService');
let mod: PanicMod;
let dispose: (() => void) | null = null;

beforeEach(async () => {
  vi.resetModules();
  vi.clearAllMocks();
  vi.useFakeTimers();
  mod = await import('@/services/panicService');
});

afterEach(() => {
  vi.useRealTimers();
  if (dispose) { dispose(); dispose = null; }
});

// ── helpers ────────────────────────────────────────────────────────────────────

function pressEscape(): void {
  window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
}

function pressTimes(n: number): void {
  for (let i = 0; i < n; i++) pressEscape();
}

function makeTouchEvent(type: string, count: number): TouchEvent {
  const touches = Array.from({ length: count }, (_, i) =>
    new Touch({ identifier: i, target: document.body }),
  );
  return new TouchEvent(type, { touches, bubbles: true });
}

// ── emergencyStop ─────────────────────────────────────────────────────────────

describe('panicService — emergencyStop()', () => {
  it('calls stopSpeech', () => {
    mod.emergencyStop();
    expect(stopSpeechMock).toHaveBeenCalledOnce();
  });

  it('calls stopWasmSpeech', () => {
    mod.emergencyStop();
    expect(stopWasmSpeechMock).toHaveBeenCalledOnce();
  });

  it('calls stopScan', () => {
    mod.emergencyStop();
    expect(stopScanMock).toHaveBeenCalledOnce();
  });

  it('calls stopAlarm', () => {
    mod.emergencyStop();
    expect(stopAlarmMock).toHaveBeenCalledOnce();
  });

  it('calls stopFlash', () => {
    mod.emergencyStop();
    expect(stopFlashMock).toHaveBeenCalledOnce();
  });

  it('calls stopEmergencySpeaker', () => {
    mod.emergencyStop();
    expect(stopEmergencySpeakerMock).toHaveBeenCalledOnce();
  });

  it('does not throw if a sub-service throws', () => {
    stopSpeechMock.mockImplementationOnce(() => { throw new Error('tts down'); });
    expect(() => mod.emergencyStop()).not.toThrow();
    expect(stopScanMock).toHaveBeenCalledOnce();
  });
});

// ── Escape key triple-tap ─────────────────────────────────────────────────────

describe('panicService — Escape × 3 trigger', () => {
  beforeEach(() => { dispose = mod.registerPanicListeners(); });

  it('Escape × 3 within 1s calls emergencyStop (stopScan called)', () => {
    pressTimes(3);
    expect(stopScanMock).toHaveBeenCalled();
  });

  it('Escape × 2 does NOT trigger emergency stop', () => {
    pressTimes(2);
    expect(stopScanMock).not.toHaveBeenCalled();
  });

  it('stale Escapes (> 1s apart) do NOT accumulate', () => {
    pressEscape();
    vi.advanceTimersByTime(1001); // fake Date.now() now at 1001
    pressEscape();
    pressEscape();
    // First press is now 1001ms old → filtered; only 2 recent → no trigger
    expect(stopScanMock).not.toHaveBeenCalled();
  });

  it('Escape × 4 still triggers (≥ 3 in window)', () => {
    pressTimes(4);
    expect(stopScanMock).toHaveBeenCalled();
  });

  it('triple-tap resets queue so 4th press alone does NOT re-trigger', () => {
    pressTimes(3); // triggers + resets queue
    vi.clearAllMocks();
    pressEscape(); // only 1 in queue now
    expect(stopScanMock).not.toHaveBeenCalled();
  });

  it('non-Escape key is ignored', () => {
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
    window.dispatchEvent(new KeyboardEvent('keydown', { key: ' ', bubbles: true }));
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    expect(stopScanMock).not.toHaveBeenCalled();
  });
});

// ── 5-finger touch ────────────────────────────────────────────────────────────

describe('panicService — 5-finger hold trigger', () => {
  beforeEach(() => { dispose = mod.registerPanicListeners(); });

  it('5-finger hold for 2 s calls emergencyStop', () => {
    window.dispatchEvent(makeTouchEvent('touchstart', 5));
    vi.advanceTimersByTime(2000);
    expect(stopScanMock).toHaveBeenCalled();
  });

  it('5-finger release before 2 s does NOT trigger', () => {
    window.dispatchEvent(makeTouchEvent('touchstart', 5));
    vi.advanceTimersByTime(1500);
    window.dispatchEvent(makeTouchEvent('touchend', 2)); // fewer than 5 → cancel
    vi.advanceTimersByTime(1000);
    expect(stopScanMock).not.toHaveBeenCalled();
  });

  it('4 fingers does NOT trigger even after 2s', () => {
    window.dispatchEvent(makeTouchEvent('touchstart', 4));
    vi.advanceTimersByTime(2000);
    expect(stopScanMock).not.toHaveBeenCalled();
  });

  it('touchcancel also cancels the timer', () => {
    window.dispatchEvent(makeTouchEvent('touchstart', 5));
    vi.advanceTimersByTime(1500);
    window.dispatchEvent(makeTouchEvent('touchcancel', 0));
    vi.advanceTimersByTime(1000);
    expect(stopScanMock).not.toHaveBeenCalled();
  });
});

// ── registration lifecycle ────────────────────────────────────────────────────

describe('panicService — registration lifecycle', () => {
  it('isPanicServiceActive is true after registerPanicListeners', () => {
    dispose = mod.registerPanicListeners();
    expect(mod.isPanicServiceActive()).toBe(true);
  });

  it('isPanicServiceActive is false after disposer called', () => {
    const d = mod.registerPanicListeners();
    d();
    expect(mod.isPanicServiceActive()).toBe(false);
    dispose = null;
  });

  it('calling register while already active is idempotent', () => {
    dispose = mod.registerPanicListeners();
    const d2 = mod.registerPanicListeners(); // noop
    d2();
    expect(mod.isPanicServiceActive()).toBe(true);
  });

  it('after dispose, Escape × 3 does NOT trigger', () => {
    const d = mod.registerPanicListeners();
    d();
    dispose = null;
    pressTimes(3);
    expect(stopScanMock).not.toHaveBeenCalled();
  });
});
