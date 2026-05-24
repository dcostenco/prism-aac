/**
 * emergencyService — startAlarm/stopAlarm/startFlash/stopFlash/registerCancelGesture
 *
 * These life-safety audio/visual functions had zero unit coverage. The
 * panic-service suite mocks them — this file tests the real implementations
 * in a jsdom environment. Tests verify:
 *   - No throw in standard jsdom env (AudioContext + DOM available)
 *   - stop* functions are idempotent (safe to call multiple times / from cold state)
 *   - registerCancelGesture returns a callable cleanup function
 *   - startFlash appends an overlay element; stopFlash removes it
 */
import { describe, it, expect, beforeEach } from 'vitest';
import {
  startAlarm,
  stopAlarm,
  startFlash,
  stopFlash,
  registerCancelGesture,
} from '@/services/emergencyService';

// jsdom does not implement window.matchMedia — stub it so startFlash can
// check prefers-reduced-motion without crashing.
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: (query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: () => {},
    removeListener: () => {},
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => false,
  }),
});

beforeEach(() => {
  // Ensure clean DOM before each test
  document.getElementById('prism-emergency-flash')?.remove();
  stopAlarm();
  stopFlash();
});

// ── stopAlarm — cold-state idempotency ────────────────────────────────────────

describe('stopAlarm', () => {
  it('does not throw when called with no active alarm', () => {
    expect(() => stopAlarm()).not.toThrow();
  });

  it('is idempotent — calling twice does not throw', () => {
    expect(() => { stopAlarm(); stopAlarm(); }).not.toThrow();
  });

  it('does not throw after startAlarm → stopAlarm cycle', () => {
    startAlarm();
    expect(() => stopAlarm()).not.toThrow();
  });
});

// ── startAlarm ────────────────────────────────────────────────────────────────

describe('startAlarm', () => {
  it('does not throw', () => {
    expect(() => startAlarm()).not.toThrow();
  });

  it('calling twice does not throw (stopAlarm called internally)', () => {
    expect(() => { startAlarm(); startAlarm(); }).not.toThrow();
  });
});

// ── stopFlash — cold-state idempotency ────────────────────────────────────────

describe('stopFlash', () => {
  it('does not throw when called with no active flash', () => {
    expect(() => stopFlash()).not.toThrow();
  });

  it('is idempotent — calling twice does not throw', () => {
    expect(() => { stopFlash(); stopFlash(); }).not.toThrow();
  });
});

// ── startFlash ────────────────────────────────────────────────────────────────

describe('startFlash', () => {
  it('does not throw', () => {
    expect(() => startFlash()).not.toThrow();
  });

  it('appends a flash overlay element to document.body', () => {
    startFlash();
    const overlay = document.getElementById('prism-emergency-flash');
    expect(overlay).not.toBeNull();
  });

  it('stopFlash removes the overlay element', () => {
    startFlash();
    stopFlash();
    const overlay = document.getElementById('prism-emergency-flash');
    expect(overlay).toBeNull();
  });

  it('calling startFlash twice does not create duplicate overlays', () => {
    startFlash();
    startFlash(); // second call calls stopFlash internally first
    const overlays = document.querySelectorAll('#prism-emergency-flash');
    expect(overlays.length).toBeLessThanOrEqual(1);
  });
});

// ── registerCancelGesture ─────────────────────────────────────────────────────

describe('registerCancelGesture', () => {
  it('returns a function (cleanup/unregister)', () => {
    const cleanup = registerCancelGesture(vi.fn());
    expect(typeof cleanup).toBe('function');
    cleanup();
  });

  it('cleanup does not throw', () => {
    const cleanup = registerCancelGesture(vi.fn());
    expect(() => cleanup()).not.toThrow();
  });

  it('cleanup is idempotent — calling twice does not throw', () => {
    const cleanup = registerCancelGesture(vi.fn());
    cleanup();
    expect(() => cleanup()).not.toThrow();
  });

  it('accepts any callback without throwing', () => {
    expect(() => registerCancelGesture(() => {})).not.toThrow();
    const cleanup = registerCancelGesture(vi.fn());
    cleanup();
  });
});
