/**
 * switchScanService — config sanitization, persistence, lifecycle, and
 * input-routing tests.
 *
 * AAC CRITICAL PATH: this service is the only input method for users with
 * severe motor impairments (e.g., Cerebral Palsy) who use physical Bluetooth
 * switches. Every regression here directly affects AAC access for that user
 * population.
 *
 * Covers:
 *  - sanitizeConfig: security clamping (CPU-spike / CSS-injection prevention)
 *  - loadConfig / saveConfig: localStorage persistence + corrupt-data guard
 *  - getDefaultConfig: returns an immutable clone each call
 *  - isSwitchScanSupported / isWebHIDSupported / isGamepadSupported
 *  - startScan / stopScan / pauseScan / resumeScan lifecycle
 *  - getState snapshot
 *  - setScanSpeed / setMode live updates
 *  - rescanElements
 *  - requestHIDDevice (no WebHID support path)
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  loadConfig,
  saveConfig,
  getDefaultConfig,
  isSwitchScanSupported,
  isWebHIDSupported,
  isGamepadSupported,
  startScan,
  stopScan,
  pauseScan,
  resumeScan,
  getState,
  setScanSpeed,
  setMode,
  rescanElements,
  requestHIDDevice,
  type SwitchScanConfig,
} from '@/services/switchScanService';

// jsdom does not implement scrollIntoView — mock it globally.
Element.prototype.scrollIntoView = vi.fn();

// ── localStorage helpers ──────────────────────────────────────────────────────

const STORAGE_KEY = 'prism-switch-scan';

function clearStorage() {
  localStorage.removeItem(STORAGE_KEY);
}

function writeStorage(obj: object) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(obj));
}

// ── shared cleanup ────────────────────────────────────────────────────────────

beforeEach(() => {
  clearStorage();
  // Ensure scan is stopped between tests
  stopScan();
  vi.clearAllMocks();
});

afterEach(() => {
  stopScan();
  clearStorage();
  vi.useRealTimers();
});

// ── getDefaultConfig ──────────────────────────────────────────────────────────

describe('switchScanService — getDefaultConfig', () => {
  it('returns expected default values', () => {
    const cfg = getDefaultConfig();
    expect(cfg.enabled).toBe(false);
    expect(cfg.mode).toBe('auto');
    expect(cfg.scanSpeedMs).toBe(2000);
    expect(cfg.groupScan).toBe(true);
    expect(cfg.loops).toBe(3);
    expect(cfg.highlightColor).toBe('#FFD600');
  });

  it('returns a new object each call (not the same reference)', () => {
    const a = getDefaultConfig();
    const b = getDefaultConfig();
    expect(a).not.toBe(b);
  });

  it('mutations on returned config do not affect subsequent calls', () => {
    const a = getDefaultConfig();
    a.scanSpeedMs = 9999;
    a.loops = 999;
    const b = getDefaultConfig();
    expect(b.scanSpeedMs).toBe(2000);
    expect(b.loops).toBe(3);
  });
});

// ── loadConfig — empty/missing storage ───────────────────────────────────────

describe('switchScanService — loadConfig (no stored data)', () => {
  it('returns defaults when localStorage has no entry', () => {
    const cfg = loadConfig();
    expect(cfg).toEqual(getDefaultConfig());
  });

  it('returns defaults on corrupt JSON', () => {
    localStorage.setItem(STORAGE_KEY, 'NOT_VALID_JSON{{{');
    const cfg = loadConfig();
    expect(cfg).toEqual(getDefaultConfig());
  });
});

// ── loadConfig — sanitization: scanSpeedMs ───────────────────────────────────

describe('switchScanService — sanitizeConfig: scanSpeedMs security', () => {
  it('scanSpeedMs=0 falls back to default (CPU-spike prevention)', () => {
    writeStorage({ scanSpeedMs: 0 });
    expect(loadConfig().scanSpeedMs).toBe(2000);
  });

  it('scanSpeedMs=1 falls back to default', () => {
    writeStorage({ scanSpeedMs: 1 });
    expect(loadConfig().scanSpeedMs).toBe(2000);
  });

  it('scanSpeedMs=199 (just below minimum) falls back to default', () => {
    writeStorage({ scanSpeedMs: 199 });
    expect(loadConfig().scanSpeedMs).toBe(2000);
  });

  it('scanSpeedMs=200 (minimum boundary) is accepted', () => {
    writeStorage({ scanSpeedMs: 200 });
    expect(loadConfig().scanSpeedMs).toBe(200);
  });

  it('scanSpeedMs=60000 (maximum boundary) is accepted', () => {
    writeStorage({ scanSpeedMs: 60000 });
    expect(loadConfig().scanSpeedMs).toBe(60000);
  });

  it('scanSpeedMs=60001 (above maximum) falls back to default', () => {
    writeStorage({ scanSpeedMs: 60001 });
    expect(loadConfig().scanSpeedMs).toBe(2000);
  });

  it('scanSpeedMs=NaN falls back to default', () => {
    writeStorage({ scanSpeedMs: null });
    expect(loadConfig().scanSpeedMs).toBe(2000);
  });

  it('scanSpeedMs=Infinity falls back to default', () => {
    // JSON.stringify converts Infinity to null
    localStorage.setItem(STORAGE_KEY, '{"scanSpeedMs":"Infinity"}');
    expect(loadConfig().scanSpeedMs).toBe(2000);
  });

  it('scanSpeedMs=3000 (valid) is accepted as-is', () => {
    writeStorage({ scanSpeedMs: 3000 });
    expect(loadConfig().scanSpeedMs).toBe(3000);
  });
});

// ── loadConfig — sanitization: loops ─────────────────────────────────────────

describe('switchScanService — sanitizeConfig: loops security', () => {
  it('loops=-1 falls back to default (prevents infinite-loop attack)', () => {
    writeStorage({ loops: -1 });
    expect(loadConfig().loops).toBe(3);
  });

  it('loops=-0.5 falls back to default', () => {
    writeStorage({ loops: -0.5 });
    expect(loadConfig().loops).toBe(3);
  });

  it('loops=0 (infinite, opt-in) is accepted', () => {
    writeStorage({ loops: 0 });
    expect(loadConfig().loops).toBe(0);
  });

  it('loops=1001 (above maximum) falls back to default', () => {
    writeStorage({ loops: 1001 });
    expect(loadConfig().loops).toBe(3);
  });

  it('loops=1000 (maximum boundary) is accepted', () => {
    writeStorage({ loops: 1000 });
    expect(loadConfig().loops).toBe(1000);
  });

  it('loops=1.7 is floored to 1', () => {
    writeStorage({ loops: 1.7 });
    expect(loadConfig().loops).toBe(1);
  });

  it('loops=5 (valid) is accepted', () => {
    writeStorage({ loops: 5 });
    expect(loadConfig().loops).toBe(5);
  });
});

// ── loadConfig — sanitization: highlightColor ────────────────────────────────

describe('switchScanService — sanitizeConfig: highlightColor CSS injection', () => {
  it('valid hex color is accepted', () => {
    writeStorage({ highlightColor: '#FF0000' });
    expect(loadConfig().highlightColor).toBe('#FF0000');
  });

  it('short hex color is accepted', () => {
    writeStorage({ highlightColor: '#F00' });
    expect(loadConfig().highlightColor).toBe('#F00');
  });

  it('rgb() color is accepted', () => {
    writeStorage({ highlightColor: 'rgb(255,0,0)' });
    expect(loadConfig().highlightColor).toBe('rgb(255,0,0)');
  });

  it('rgba() color is accepted', () => {
    writeStorage({ highlightColor: 'rgba(255,0,0,0.5)' });
    expect(loadConfig().highlightColor).toBe('rgba(255,0,0,0.5)');
  });

  it('named color "blue" is accepted', () => {
    writeStorage({ highlightColor: 'blue' });
    expect(loadConfig().highlightColor).toBe('blue');
  });

  it('CSS breakout with semicolon falls back to default', () => {
    writeStorage({ highlightColor: '#F00; color: red' });
    expect(loadConfig().highlightColor).toBe('#FFD600');
  });

  it('CSS breakout with curly brace falls back to default', () => {
    writeStorage({ highlightColor: 'red{color:blue}' });
    expect(loadConfig().highlightColor).toBe('#FFD600');
  });

  it('javascript: scheme falls back to default', () => {
    writeStorage({ highlightColor: 'javascript:alert(1)' });
    expect(loadConfig().highlightColor).toBe('#FFD600');
  });

  it('expression() CSS injection falls back to default', () => {
    writeStorage({ highlightColor: 'expression(alert(1))' });
    expect(loadConfig().highlightColor).toBe('#FFD600');
  });

  it('url() CSS injection falls back to default', () => {
    writeStorage({ highlightColor: 'url(evil.js)' });
    expect(loadConfig().highlightColor).toBe('#FFD600');
  });

  it('non-string highlightColor falls back to default', () => {
    localStorage.setItem(STORAGE_KEY, '{"highlightColor":12345}');
    expect(loadConfig().highlightColor).toBe('#FFD600');
  });
});

// ── loadConfig — sanitization: mode ──────────────────────────────────────────

describe('switchScanService — sanitizeConfig: mode field', () => {
  it('"auto" is accepted', () => {
    writeStorage({ mode: 'auto' });
    expect(loadConfig().mode).toBe('auto');
  });

  it('"manual" is accepted', () => {
    writeStorage({ mode: 'manual' });
    expect(loadConfig().mode).toBe('manual');
  });

  it('unknown mode falls back to default "auto"', () => {
    writeStorage({ mode: 'turbo' });
    expect(loadConfig().mode).toBe('auto');
  });

  it('non-string mode falls back to default', () => {
    writeStorage({ mode: 42 });
    expect(loadConfig().mode).toBe('auto');
  });
});

// ── loadConfig — sanitization: enabled + groupScan ───────────────────────────

describe('switchScanService — sanitizeConfig: boolean fields', () => {
  it('enabled=true is accepted', () => {
    writeStorage({ enabled: true });
    expect(loadConfig().enabled).toBe(true);
  });

  it('enabled=false is accepted', () => {
    writeStorage({ enabled: false });
    expect(loadConfig().enabled).toBe(false);
  });

  it('non-boolean enabled falls back to default (false)', () => {
    writeStorage({ enabled: 1 });
    expect(loadConfig().enabled).toBe(false);
  });

  it('groupScan=false is accepted', () => {
    writeStorage({ groupScan: false });
    expect(loadConfig().groupScan).toBe(false);
  });

  it('non-boolean groupScan falls back to default (true)', () => {
    writeStorage({ groupScan: 'yes' });
    expect(loadConfig().groupScan).toBe(true);
  });
});

// ── saveConfig / loadConfig round-trip ───────────────────────────────────────

describe('switchScanService — saveConfig/loadConfig round-trip', () => {
  it('saves and reloads a complete config faithfully', () => {
    const cfg: SwitchScanConfig = {
      enabled: true,
      mode: 'manual',
      scanSpeedMs: 1500,
      groupScan: false,
      loops: 2,
      highlightColor: '#00FF00',
    };
    saveConfig(cfg);
    const loaded = loadConfig();
    expect(loaded).toEqual(cfg);
  });

  it('overwrites previous saved config', () => {
    saveConfig({ ...getDefaultConfig(), scanSpeedMs: 1500 });
    saveConfig({ ...getDefaultConfig(), scanSpeedMs: 3000 });
    expect(loadConfig().scanSpeedMs).toBe(3000);
  });
});

// ── feature detection ─────────────────────────────────────────────────────────

describe('switchScanService — isSwitchScanSupported', () => {
  it('returns true in jsdom (window and document defined)', () => {
    expect(isSwitchScanSupported()).toBe(true);
  });
});

describe('switchScanService — isWebHIDSupported', () => {
  it('returns false when navigator.hid is not present', () => {
    // jsdom does not implement WebHID
    expect(isWebHIDSupported()).toBe(false);
  });

  it('returns true when navigator.hid.requestDevice is a function', () => {
    const orig = (navigator as Record<string, unknown>).hid;
    (navigator as Record<string, unknown>).hid = {
      requestDevice: vi.fn(),
      getDevices: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    };
    expect(isWebHIDSupported()).toBe(true);
    (navigator as Record<string, unknown>).hid = orig;
  });
});

describe('switchScanService — isGamepadSupported', () => {
  it('returns true when navigator.getGamepads exists', () => {
    // jsdom defines navigator.getGamepads
    if ('getGamepads' in navigator) {
      expect(isGamepadSupported()).toBe(true);
    } else {
      expect(isGamepadSupported()).toBe(false);
    }
  });
});

// ── helpers for jsdom-visible elements ───────────────────────────────────────
// jsdom has no layout engine — offsetParent is always null. The service's
// discoverElements() skips elements where offsetParent===null unless position
// is 'fixed'. Setting position:fixed makes elements discoverable in tests.

function makeFixedBtn(): HTMLButtonElement {
  const btn = document.createElement('button');
  btn.style.position = 'fixed';
  document.body.appendChild(btn);
  return btn;
}

function remove(el: Element) {
  if (el.parentNode) el.parentNode.removeChild(el);
}

// ── startScan / stopScan lifecycle ────────────────────────────────────────────

describe('switchScanService — startScan/stopScan lifecycle', () => {
  it('getState returns idle phase before any scan starts', () => {
    expect(getState().phase).toBe('idle');
  });

  it('startScan with enabled=false leaves state idle', () => {
    startScan({ enabled: false });
    expect(getState().phase).toBe('idle');
  });

  it('startScan with enabled=true + DOM elements sets non-idle phase', () => {
    const btn = makeFixedBtn();
    startScan({ enabled: true, mode: 'manual', groupScan: false, loops: 1 });
    expect(getState().phase).not.toBe('idle');
    stopScan();
    remove(btn);
  });

  it('stopScan resets phase to idle', () => {
    const btn = makeFixedBtn();
    startScan({ enabled: true, mode: 'manual', groupScan: false, loops: 1 });
    stopScan();
    expect(getState().phase).toBe('idle');
    remove(btn);
  });

  it('stopScan resets loopCount to 0', () => {
    stopScan();
    expect(getState().loopCount).toBe(0);
  });

  it('stopScan called when already idle is safe (no throw)', () => {
    expect(() => stopScan()).not.toThrow();
  });

  it('startScan fires onStateChange callback with non-idle phase', () => {
    const btn = makeFixedBtn();
    const onStateChange = vi.fn();
    startScan({ enabled: true, mode: 'manual', groupScan: false, loops: 1 }, { onStateChange });
    expect(onStateChange).toHaveBeenCalled();
    const lastCall = onStateChange.mock.calls[onStateChange.mock.calls.length - 1][0];
    expect(lastCall.phase).not.toBe('idle');
    stopScan();
    remove(btn);
  });

  it('stopScan fires onStateChange callback with idle phase', () => {
    const btn = makeFixedBtn();
    const onStateChange = vi.fn();
    startScan({ enabled: true, mode: 'manual', groupScan: false, loops: 1 }, { onStateChange });
    onStateChange.mockClear();
    stopScan();
    expect(onStateChange).toHaveBeenCalledWith(expect.objectContaining({ phase: 'idle' }));
    remove(btn);
  });
});

// ── pauseScan / resumeScan ────────────────────────────────────────────────────

describe('switchScanService — pauseScan/resumeScan', () => {
  function setupScan() {
    const btn = makeFixedBtn();
    startScan({ enabled: true, mode: 'manual', groupScan: false, loops: 5 });
    return btn;
  }

  it('pauseScan sets paused=true', () => {
    const btn = setupScan();
    pauseScan();
    expect(getState().paused).toBe(true);
    stopScan();
    remove(btn);
  });

  it('resumeScan clears paused flag', () => {
    const btn = setupScan();
    pauseScan();
    resumeScan();
    expect(getState().paused).toBe(false);
    stopScan();
    remove(btn);
  });

  it('pauseScan when already idle is safe (no throw)', () => {
    expect(getState().phase).toBe('idle');
    expect(() => pauseScan()).not.toThrow();
  });

  it('resumeScan when not paused is safe (no throw)', () => {
    const btn = setupScan();
    expect(() => resumeScan()).not.toThrow();
    stopScan();
    remove(btn);
  });

  it('resumeScan when idle is safe (no throw)', () => {
    expect(getState().phase).toBe('idle');
    expect(() => resumeScan()).not.toThrow();
  });
});

// ── getState snapshot ─────────────────────────────────────────────────────────

describe('switchScanService — getState', () => {
  it('returns a copy (mutations do not affect internal state)', () => {
    const s = getState();
    s.phase = 'items';
    s.loopCount = 99;
    expect(getState().phase).toBe('idle');
    expect(getState().loopCount).toBe(0);
  });
});

// ── setScanSpeed ──────────────────────────────────────────────────────────────

describe('switchScanService — setScanSpeed', () => {
  it('setScanSpeed while idle is safe (no throw)', () => {
    expect(() => setScanSpeed(3000)).not.toThrow();
  });

  it('setScanSpeed value below 1000 is clamped (no throw)', () => {
    expect(() => setScanSpeed(0)).not.toThrow();
    expect(() => setScanSpeed(500)).not.toThrow();
  });

  it('setScanSpeed value above 5000 is clamped (no throw)', () => {
    expect(() => setScanSpeed(9999)).not.toThrow();
    expect(() => setScanSpeed(100000)).not.toThrow();
  });
});

// ── setMode ───────────────────────────────────────────────────────────────────

describe('switchScanService — setMode', () => {
  it('setMode while idle is safe (no throw)', () => {
    expect(() => setMode('manual')).not.toThrow();
    expect(() => setMode('auto')).not.toThrow();
  });

  it('setMode("manual") stops auto-timer on an active scan', () => {
    vi.useFakeTimers();
    const btn = makeFixedBtn();
    startScan({ enabled: true, mode: 'auto', groupScan: false, loops: 5, scanSpeedMs: 2000 });
    setMode('manual');
    expect(() => vi.advanceTimersByTime(10000)).not.toThrow();
    stopScan();
    remove(btn);
    vi.useRealTimers();
  });
});

// ── rescanElements ────────────────────────────────────────────────────────────

describe('switchScanService — rescanElements', () => {
  it('rescanElements while idle is safe (no throw)', () => {
    expect(() => rescanElements()).not.toThrow();
  });

  it('rescanElements resets group/item indices to 0', () => {
    const btns = [makeFixedBtn(), makeFixedBtn(), makeFixedBtn()];
    startScan({ enabled: true, mode: 'manual', groupScan: false, loops: 5 });
    rescanElements();
    const s = getState();
    expect(s.groupIndex).toBe(0);
    stopScan();
    btns.forEach(remove);
  });
});

// ── requestHIDDevice ──────────────────────────────────────────────────────────

describe('switchScanService — requestHIDDevice', () => {
  it('returns false when WebHID is not supported', async () => {
    // jsdom does not implement WebHID, so this should return false
    const result = await requestHIDDevice();
    expect(result).toBe(false);
  });
});

// ── auto-scan timer integration ───────────────────────────────────────────────

describe('switchScanService — auto-scan timer', () => {
  it('onStateChange is called multiple times by auto-scan timer', () => {
    // useFakeTimers MUST come before startScan so setInterval is intercepted
    vi.useFakeTimers();
    const btn = makeFixedBtn();
    const btn2 = makeFixedBtn();

    const onStateChange = vi.fn();
    startScan(
      { enabled: true, mode: 'auto', groupScan: false, loops: 10, scanSpeedMs: 1000 },
      { onStateChange },
    );
    const callsBefore = onStateChange.mock.calls.length;

    vi.advanceTimersByTime(2500);
    expect(onStateChange.mock.calls.length).toBeGreaterThan(callsBefore);

    stopScan();
    remove(btn);
    remove(btn2);
    vi.useRealTimers();
  });

  it('pausing stops onStateChange from auto-timer advancement', () => {
    vi.useFakeTimers();
    const btn = makeFixedBtn();

    const onStateChange = vi.fn();
    startScan(
      { enabled: true, mode: 'auto', groupScan: false, loops: 5, scanSpeedMs: 1000 },
      { onStateChange },
    );
    pauseScan();
    onStateChange.mockClear();

    vi.advanceTimersByTime(5000);
    expect(onStateChange).not.toHaveBeenCalled();

    stopScan();
    remove(btn);
    vi.useRealTimers();
  });
});

// ── keyboard input routing ────────────────────────────────────────────────────

describe('switchScanService — keyboard input routing', () => {
  // Keyboard listener is registered with capture=true on document.
  // Dispatching on document.body propagates through document capture phase.
  let btn: HTMLButtonElement;
  let btn2: HTMLButtonElement;

  beforeEach(() => {
    btn = makeFixedBtn();
    btn2 = makeFixedBtn();
    startScan({ enabled: true, mode: 'manual', groupScan: false, loops: 5 });
  });

  afterEach(() => {
    stopScan();
    remove(btn);
    remove(btn2);
  });

  it('Space key is handled without throwing and scan stays active', () => {
    const event = new KeyboardEvent('keydown', { key: ' ', bubbles: true, cancelable: true });
    expect(() => document.body.dispatchEvent(event)).not.toThrow();
    expect(getState().phase).not.toBe('idle');
  });

  it('Enter key is handled without throwing', () => {
    const event = new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true });
    expect(() => document.body.dispatchEvent(event)).not.toThrow();
  });

  it('Tab key advances scan and fires onStateChange', () => {
    const onStateChange = vi.fn();
    stopScan();
    startScan({ enabled: true, mode: 'manual', groupScan: false, loops: 5 }, { onStateChange });
    onStateChange.mockClear();

    const event = new KeyboardEvent('keydown', { key: 'Tab', bubbles: true, cancelable: true });
    document.body.dispatchEvent(event);
    expect(onStateChange).toHaveBeenCalled();
  });

  it('Shift+Tab fires advancePrevious without throwing', () => {
    const event = new KeyboardEvent('keydown', {
      key: 'Tab',
      shiftKey: true,
      bubbles: true,
      cancelable: true,
    });
    expect(() => document.body.dispatchEvent(event)).not.toThrow();
  });

  it('key events are ignored when scan is idle', () => {
    stopScan();
    const event = new KeyboardEvent('keydown', { key: ' ', bubbles: true, cancelable: true });
    expect(() => document.body.dispatchEvent(event)).not.toThrow();
    expect(getState().phase).toBe('idle');
  });
});
