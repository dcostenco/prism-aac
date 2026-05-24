/**
 * wasmTTS — config persistence, clamping, and lifecycle state.
 *
 * Life-safety: wasmTTS is the Tier 4 last-resort TTS fallback for AAC users
 * whose ONLY communication channel is this app.  A corrupted config (volume=NaN,
 * rate=Infinity, rate=0.1) causes division-by-zero in the AudioContext beep
 * scheduler, producing inaudible output or an unhandled exception that locks
 * the child out of communication entirely.
 *
 * These tests verify:
 *   - getWasmTTSConfig: default values, localStorage persistence, clamping of
 *     out-of-range values, and graceful recovery from corrupt JSON
 *   - setWasmTTSConfig: partial-merge semantics, bidirectional clamping
 *   - isWasmTTSReady: false before any successful WASM load
 *   - stopWasmSpeech / destroyWasmTTS: safe when nothing is playing (null state)
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  getWasmTTSConfig,
  setWasmTTSConfig,
  isWasmTTSReady,
  stopWasmSpeech,
  destroyWasmTTS,
} from '@/services/wasmTTS';

const STORAGE_KEY = 'prism-wasm-tts';

beforeEach(() => {
  vi.clearAllMocks();
  localStorage.clear();
});

// ── getWasmTTSConfig — defaults ────────────────────────────────────────────────

describe('getWasmTTSConfig — defaults', () => {
  it('returns defaults when localStorage has no entry', () => {
    const cfg = getWasmTTSConfig();
    expect(cfg.enabled).toBe(true);
    expect(cfg.volume).toBe(1.0);
    expect(cfg.rate).toBe(1.0);
  });

  it('returns object with enabled, volume, rate fields', () => {
    const cfg = getWasmTTSConfig();
    expect(cfg).toHaveProperty('enabled');
    expect(cfg).toHaveProperty('volume');
    expect(cfg).toHaveProperty('rate');
  });

  it('returns defaults on corrupt JSON', () => {
    localStorage.setItem(STORAGE_KEY, '{not valid{{');
    const cfg = getWasmTTSConfig();
    expect(cfg.enabled).toBe(true);
    expect(cfg.volume).toBe(1.0);
    expect(cfg.rate).toBe(1.0);
  });

  it('returns defaults on empty stored string', () => {
    localStorage.setItem(STORAGE_KEY, '');
    const cfg = getWasmTTSConfig();
    expect(cfg.enabled).toBe(true);
  });
});

// ── getWasmTTSConfig — stored values ──────────────────────────────────────────

describe('getWasmTTSConfig — stored values', () => {
  it('returns stored enabled/volume/rate', () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ enabled: false, volume: 0.5, rate: 1.5 }));
    const cfg = getWasmTTSConfig();
    expect(cfg.enabled).toBe(false);
    expect(cfg.volume).toBe(0.5);
    expect(cfg.rate).toBe(1.5);
  });

  it('fills missing volume with default when absent from stored JSON', () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ enabled: false }));
    const cfg = getWasmTTSConfig();
    expect(cfg.volume).toBe(1.0);
    expect(cfg.rate).toBe(1.0);
  });

  it('preserves enabled: false', () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ enabled: false, volume: 0.8, rate: 1.0 }));
    expect(getWasmTTSConfig().enabled).toBe(false);
  });

  it('returns exact stored volume and rate within valid range', () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ enabled: true, volume: 0.25, rate: 0.75 }));
    const cfg = getWasmTTSConfig();
    expect(cfg.volume).toBe(0.25);
    expect(cfg.rate).toBe(0.75);
  });
});

// ── getWasmTTSConfig — clamping ───────────────────────────────────────────────

describe('getWasmTTSConfig — clamping (life-safety: prevents AudioContext errors)', () => {
  it('clamps volume above 1 to 1', () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ enabled: true, volume: 2.5, rate: 1.0 }));
    expect(getWasmTTSConfig().volume).toBe(1);
  });

  it('clamps volume below 0 to 0', () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ enabled: true, volume: -0.5, rate: 1.0 }));
    expect(getWasmTTSConfig().volume).toBe(0);
  });

  it('clamps rate above 2.0 to 2.0', () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ enabled: true, volume: 1.0, rate: 5.0 }));
    expect(getWasmTTSConfig().rate).toBe(2.0);
  });

  it('clamps rate below 0.5 to 0.5', () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ enabled: true, volume: 1.0, rate: 0.1 }));
    expect(getWasmTTSConfig().rate).toBe(0.5);
  });

  it('accepts volume exactly at 0', () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ enabled: true, volume: 0, rate: 1.0 }));
    expect(getWasmTTSConfig().volume).toBe(0);
  });

  it('accepts volume exactly at 1', () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ enabled: true, volume: 1, rate: 1.0 }));
    expect(getWasmTTSConfig().volume).toBe(1);
  });

  it('accepts rate exactly at 0.5', () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ enabled: true, volume: 1.0, rate: 0.5 }));
    expect(getWasmTTSConfig().rate).toBe(0.5);
  });

  it('accepts rate exactly at 2.0', () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ enabled: true, volume: 1.0, rate: 2.0 }));
    expect(getWasmTTSConfig().rate).toBe(2.0);
  });
});

// ── setWasmTTSConfig — persistence ────────────────────────────────────────────

describe('setWasmTTSConfig — persistence', () => {
  it('writes config to localStorage', () => {
    setWasmTTSConfig({ enabled: false, volume: 0.7, rate: 1.5 });
    const raw = localStorage.getItem(STORAGE_KEY);
    expect(raw).not.toBeNull();
    const stored = JSON.parse(raw!);
    expect(stored.enabled).toBe(false);
    expect(stored.volume).toBe(0.7);
    expect(stored.rate).toBe(1.5);
  });

  it('partial update preserves unchanged fields', () => {
    setWasmTTSConfig({ enabled: true, volume: 0.5, rate: 1.0 });
    setWasmTTSConfig({ volume: 0.3 }); // only change volume
    const cfg = getWasmTTSConfig();
    expect(cfg.volume).toBe(0.3);
    expect(cfg.enabled).toBe(true);
    expect(cfg.rate).toBe(1.0);
  });

  it('toggling enabled persists', () => {
    setWasmTTSConfig({ enabled: false });
    expect(getWasmTTSConfig().enabled).toBe(false);
    setWasmTTSConfig({ enabled: true });
    expect(getWasmTTSConfig().enabled).toBe(true);
  });

  it('clamps over-range volume when writing', () => {
    setWasmTTSConfig({ volume: 99 });
    expect(getWasmTTSConfig().volume).toBe(1);
  });

  it('clamps under-range rate when writing', () => {
    setWasmTTSConfig({ rate: 0.1 });
    expect(getWasmTTSConfig().rate).toBe(0.5);
  });

  it('clamps over-range rate when writing', () => {
    setWasmTTSConfig({ rate: 10 });
    expect(getWasmTTSConfig().rate).toBe(2.0);
  });
});

// ── isWasmTTSReady ─────────────────────────────────────────────────────────────

describe('isWasmTTSReady', () => {
  it('returns false before initWasmTTS is called', () => {
    expect(isWasmTTSReady()).toBe(false);
  });
});

// ── stopWasmSpeech — lifecycle safety ─────────────────────────────────────────

describe('stopWasmSpeech — lifecycle safety', () => {
  it('does not throw when no audio is playing', () => {
    expect(() => stopWasmSpeech()).not.toThrow();
  });

  it('is idempotent — safe to call multiple times', () => {
    expect(() => {
      stopWasmSpeech();
      stopWasmSpeech();
      stopWasmSpeech();
    }).not.toThrow();
  });
});

// ── destroyWasmTTS — lifecycle ────────────────────────────────────────────────

describe('destroyWasmTTS — lifecycle', () => {
  it('does not throw when called with no active audio', () => {
    expect(() => destroyWasmTTS()).not.toThrow();
  });

  it('isWasmTTSReady returns false after destroyWasmTTS', () => {
    destroyWasmTTS();
    expect(isWasmTTSReady()).toBe(false);
  });

  it('is idempotent — second call does not throw', () => {
    expect(() => {
      destroyWasmTTS();
      destroyWasmTTS();
    }).not.toThrow();
  });
});
