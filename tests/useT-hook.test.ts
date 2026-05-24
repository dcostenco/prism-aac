/**
 * useT — i18n hook: language binding, ready state, TTS codes, RTL flag.
 *
 * useT is the single source of truth for translated strings, TTS language
 * codes, and text direction inside every UI component.  A broken hook
 * (wrong ttsCode, wrong RTL flag, stale ready state) would cause Azure
 * TTS to speak in the wrong language — life-safety for non-verbal AAC
 * users who depend on voice output as their primary communication channel.
 *
 * Test strategy: mock useSettingsStore to control language/outputLanguage;
 * use real i18n functions (English is pre-bundled, always loaded).
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';

// ── store mock ────────────────────────────────────────────────────────────────

let mockLanguage = 'en';
let mockOutputLanguage = 'en';

vi.mock('@/store/settingsStore', () => ({
  useSettingsStore: (sel: (s: { language: string; outputLanguage: string }) => unknown) =>
    sel({ language: mockLanguage, outputLanguage: mockOutputLanguage }),
}));

import { useT } from '@/engine/useT';

beforeEach(() => {
  vi.clearAllMocks();
  mockLanguage = 'en';
  mockOutputLanguage = 'en';
});

// ── lang passthrough ──────────────────────────────────────────────────────────

describe('useT — lang passthrough', () => {
  it('returns lang matching the store language', () => {
    mockLanguage = 'en';
    const { result } = renderHook(() => useT());
    expect(result.current.lang).toBe('en');
  });

  it('reflects Spanish when store language is es', async () => {
    mockLanguage = 'es';
    const { result } = renderHook(() => useT());
    expect(result.current.lang).toBe('es');
  });
});

// ── ready state ───────────────────────────────────────────────────────────────

describe('useT — ready state', () => {
  it('is true immediately for pre-loaded English', () => {
    mockLanguage = 'en';
    const { result } = renderHook(() => useT());
    expect(result.current.ready).toBe(true);
  });
});

// ── TTS codes ─────────────────────────────────────────────────────────────────

describe('useT — TTS codes', () => {
  it('ttsCode for English is en-US', () => {
    mockLanguage = 'en';
    const { result } = renderHook(() => useT());
    expect(result.current.ttsCode).toBe('en-US');
  });

  it('ttsCode for Spanish is es-ES', () => {
    mockLanguage = 'es';
    const { result } = renderHook(() => useT());
    expect(result.current.ttsCode).toBe('es-ES');
  });

  it('ttsCode for Japanese is ja-JP', () => {
    mockLanguage = 'ja';
    const { result } = renderHook(() => useT());
    expect(result.current.ttsCode).toBe('ja-JP');
  });

  it('outputTtsCode reflects outputLanguage independently of lang', () => {
    mockLanguage = 'en';
    mockOutputLanguage = 'es';
    const { result } = renderHook(() => useT());
    expect(result.current.ttsCode).toBe('en-US');
    expect(result.current.outputTtsCode).toBe('es-ES');
  });

  it('outputTtsCode for Arabic is ar-SA', () => {
    mockOutputLanguage = 'ar';
    const { result } = renderHook(() => useT());
    expect(result.current.outputTtsCode).toBe('ar-SA');
  });
});

// ── RTL flag ──────────────────────────────────────────────────────────────────

describe('useT — RTL flag', () => {
  it('rtl is false for English', () => {
    mockLanguage = 'en';
    const { result } = renderHook(() => useT());
    expect(result.current.rtl).toBe(false);
  });

  it('rtl is true for Arabic', () => {
    mockLanguage = 'ar';
    const { result } = renderHook(() => useT());
    expect(result.current.rtl).toBe(true);
  });

  it('rtl is false for Spanish', () => {
    mockLanguage = 'es';
    const { result } = renderHook(() => useT());
    expect(result.current.rtl).toBe(false);
  });
});

// ── t() translation function ──────────────────────────────────────────────────

describe('useT — t() translation function', () => {
  it('t() returns a string for a known key', () => {
    mockLanguage = 'en';
    const { result } = renderHook(() => useT());
    expect(typeof result.current.t('speak')).toBe('string');
    expect(result.current.t('speak').length).toBeGreaterThan(0);
  });

  it('t() returns English for unknown key (key passthrough)', () => {
    mockLanguage = 'en';
    const { result } = renderHook(() => useT());
    expect(result.current.t('__totally_unknown_xyz__')).toBe('__totally_unknown_xyz__');
  });

  it('t() is memoized — same function reference across re-renders for same language', () => {
    mockLanguage = 'en';
    const { result, rerender } = renderHook(() => useT());
    const first = result.current.t;
    rerender();
    expect(result.current.t).toBe(first);
  });
});
