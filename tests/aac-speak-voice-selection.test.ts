/**
 * Regression tests for aacSpeak voice selection and speech rate.
 *
 * Root cause these pin:
 *   1. Voice selection: when aacSpeak receives already-translated text
 *      (e.g. Russian text called from MessageBar), it must not break EN→EN mode.
 *   2. Rate regression (commit 95e4168): applying rate * 0.6 unconditionally
 *      broke monolingual foreign users (RO/RU) — they got SSML 0.6 instead of
 *      1.0 = 2× slowdown. Rate reduction must ONLY apply when translating or
 *      when the caller explicitly passes spokenLang.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock dependencies before importing the module under test
vi.mock('@/services/speechService', () => ({ speak: vi.fn() }));
vi.mock('@/services/translateService', () => ({
  translateTextSync: vi.fn((t: string) => t),
  looksLikeTargetLang: vi.fn(() => false),
}));
vi.mock('@/services/ttsHighlightBus', () => ({
  emitTtsHighlight: vi.fn(),
  estimateSpeechDurationMs: vi.fn(() => 1000),
}));
vi.mock('@/store/messageStore', () => ({
  useMessageStore: { getState: vi.fn(() => ({ toneMode: 'auto', activeTone: 'friendly' })) },
}));
vi.mock('@/store/settingsStore', () => ({
  useSettingsStore: { getState: vi.fn(() => ({ language: 'en', outputLanguage: 'en', speechRate: 0.5 })) },
}));
vi.mock('@/engine/i18n', () => ({
  getTTSCode: vi.fn((lang: string) => `${lang}-code`),
}));

import { aacSpeak } from '@/services/aacSpeak';
import { speak } from '@/services/speechService';
import { translateTextSync } from '@/services/translateService';
import { useSettingsStore } from '@/store/settingsStore';
import { getTTSCode } from '@/engine/i18n';

const mockGetState = useSettingsStore.getState as ReturnType<typeof vi.fn>;
const mockTranslate = translateTextSync as ReturnType<typeof vi.fn>;
const mockGetTTSCode = getTTSCode as ReturnType<typeof vi.fn>;
const mockSpeak = speak as ReturnType<typeof vi.fn>;

describe('aacSpeak — voice selection', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetTTSCode.mockImplementation((lang: string) => `${lang}-TTS`);
  });

  it('EN→EN: uses English voice, text unchanged, rate NOT reduced', () => {
    mockGetState.mockReturnValue({ language: 'en', outputLanguage: 'en', speechRate: 0.5 });

    aacSpeak('hello world', 0.5, 1.0);

    expect(mockTranslate).not.toHaveBeenCalled();
    expect(mockSpeak).toHaveBeenCalledWith(
      'hello world',
      0.5, 1.0,  // monolingual — rate passes through unchanged
      'en-TTS',
      expect.anything(),
      false,
    );
  });

  it('EN→RU with successful translation: uses Russian voice', () => {
    mockGetState.mockReturnValue({ language: 'en', outputLanguage: 'ru', speechRate: 0.5 });
    mockTranslate.mockReturnValue('привет мир');

    aacSpeak('hello world', 0.5, 1.0);

    expect(mockSpeak).toHaveBeenCalledWith(
      'Привет мир.',
      0.5, 1.0,  // rate passes through unchanged (0.6× removed May 2026 — was compounding with pbRate)
      'ru-TTS',
      expect.anything(),
      false,
    );
  });

  it('EN→RU with untranslatable word: falls back to English voice', () => {
    mockGetState.mockReturnValue({ language: 'en', outputLanguage: 'ru', speechRate: 0.5 });
    mockTranslate.mockReturnValue('hello'); // same as input — not translated

    aacSpeak('hello', 0.5, 1.0);

    expect(mockSpeak).toHaveBeenCalledWith(
      'hello',
      0.5, 1.0,  // rate passes through unchanged
      'en-TTS', // source voice since translation didn't change text
      expect.anything(),
      false,
    );
  });

  it('REGRESSION: RO→RO (monolingual foreign) rate NOT reduced — fixes 2× slowdown', () => {
    // Pin: commit 95e4168 applied rate * 0.6 unconditionally.
    // A Romanian user with language=ro, outputLanguage=ro (translating=false)
    // got effectiveRate=0.3 → Azure SSML 0.6 instead of 1.0 = 2× slow.
    // The 0.6× multiplier must ONLY apply when translating or spokenLang is set.
    mockGetState.mockReturnValue({ language: 'ro', outputLanguage: 'ro', speechRate: 0.5 });

    aacSpeak('bună ziua', 0.5, 1.0);

    expect(mockSpeak).toHaveBeenCalledWith(
      'bună ziua',
      0.5, 1.0,  // no multiplier — monolingual Romanian same as English
      'ro-TTS',
      expect.anything(),
      false,
    );
  });

  it('REGRESSION: EN→RO translation rate NOT reduced — 0.6× removed (May 2026 fix)', () => {
    // Pin: 0.6× was removed because it compounded with pbRate in speakAzure
    // → 0.36× effective speed for translated users (en-ro). Rate control now
    // belongs entirely to the user's slider (effectiveRate = rate unchanged).
    mockGetState.mockReturnValue({ language: 'en', outputLanguage: 'ro', speechRate: 0.5 });
    mockTranslate.mockReturnValue('bună ziua');

    aacSpeak('good morning', 0.5, 1.0);

    expect(mockSpeak).toHaveBeenCalledWith(
      'Bună ziua.',
      0.5, 1.0,  // no multiplier — rate passes through unchanged
      'ro-TTS',
      expect.anything(),
      false,
    );
  });

  it('aacSpeak signature has NO extra overrideLang parameter (max 5 declared)', () => {
    // Guards against adding undocumented 6th+ parameters that create
    // hidden behavioral contracts between callers and aacSpeak.
    // ef19d2c added overrideLang as 6th param → broke EN sound.
    // Function.length = params before first default (interrupt=false stops count at 4).
    expect(aacSpeak.length).toBeLessThanOrEqual(4);
  });

  it('interrupt=true passes through to speak()', () => {
    mockGetState.mockReturnValue({ language: 'en', outputLanguage: 'en', speechRate: 0.5 });

    aacSpeak('help', 0.5, 1.0, undefined, true);

    expect(mockSpeak).toHaveBeenCalledWith(
      'help', 0.5, 1.0, 'en-TTS', expect.anything(), true,
    );
  });
});
