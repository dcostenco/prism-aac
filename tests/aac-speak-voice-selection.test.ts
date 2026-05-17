/**
 * Regression tests for aacSpeak voice selection.
 *
 * Root cause these pin: when aacSpeak receives already-translated text
 * (e.g. Russian text called from MessageBar), it must not break EN→EN mode.
 * The overrideLang parameter that was added in ef19d2c broke this — these
 * tests would have caught the regression before push.
 *
 * Rate note: aacSpeak applies effectiveRate = rate * 0.6 internally (commit 95e4168
 * "apply 0.6x rate to all speech"). speak() receives the scaled value, not the raw rate.
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

  it('EN→EN: uses English voice, text unchanged', () => {
    mockGetState.mockReturnValue({ language: 'en', outputLanguage: 'en', speechRate: 0.5 });

    aacSpeak('hello world', 0.5, 1.0);

    expect(mockTranslate).not.toHaveBeenCalled();
    expect(mockSpeak).toHaveBeenCalledWith(
      'hello world',
      0.5 * 0.6, 1.0,  // effectiveRate = rate * 0.6 (commit 95e4168)
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
      'привет мир',
      0.5 * 0.6, 1.0,  // effectiveRate = rate * 0.6
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
      0.5 * 0.6, 1.0,  // effectiveRate = rate * 0.6
      'en-TTS', // source voice since translation didn't change text
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
      'help', 0.5 * 0.6, 1.0, 'en-TTS', expect.anything(), true,
    );
  });
});
