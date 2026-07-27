/**
 * aacSpeak — spokenLang path + empty-text guard
 *
 * The existing aac-speak-voice-selection.test.ts covers the translating/
 * monolingual branches. Two paths remained untested:
 *
 *   1. spokenLang parameter (6th arg): MessageBar passes AI-translated
 *      Romanian text with spokenLang='ro' so aacSpeak skips re-translation
 *      and uses the explicit language's TTS code.
 *
 *   2. Empty / falsy text guard: aacSpeak must return early without calling
 *      speak() when text is empty string, whitespace-only, null, or undefined.
 *
 *   3. Sentence context: translated text is sentence-cased and terminated
 *      for natural target-language pronunciation, while monolingual
 *      multi-word text remains untouched.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/services/speechService', () => ({ speak: vi.fn() }));
vi.mock('@/services/translateService', () => ({
  translateTextSync: vi.fn((t: string) => t),
  looksLikeTargetLang: vi.fn(() => false),
}));
vi.mock('@/services/ttsHighlightBus', () => ({
  emitTtsHighlight: vi.fn(),
  estimateSpeechDurationMs: vi.fn(() => 500),
}));
vi.mock('@/store/messageStore', () => ({
  useMessageStore: { getState: vi.fn(() => ({ toneMode: 'auto', activeTone: 'friendly' })) },
}));
vi.mock('@/store/settingsStore', () => ({
  useSettingsStore: { getState: vi.fn(() => ({ language: 'en', outputLanguage: 'en', speechRate: 0.5 })) },
}));
vi.mock('@/engine/i18n', () => ({
  getTTSCode: vi.fn((lang: string) => `${lang}-TTS`),
}));

import { aacSpeak } from '@/services/aacSpeak';
import { speak } from '@/services/speechService';
import { getTTSCode } from '@/engine/i18n';
import type { SupportedLanguage } from '@/engine/i18n';
import { translateTextSync } from '@/services/translateService';

const mockSpeak = speak as ReturnType<typeof vi.fn>;
const mockGetTTSCode = getTTSCode as ReturnType<typeof vi.fn>;
const mockTranslate = translateTextSync as ReturnType<typeof vi.fn>;

const SUPPORTED_TARGET_UTTERANCES: Array<[SupportedLanguage, string, string]> = [
  ['en', 'i need help', 'I need help.'],
  ['es', 'yo busco', 'Yo busco.'],
  ['fr', 'je cherche', 'Je cherche.'],
  ['pt', 'eu procuro', 'Eu procuro.'],
  ['ro', 'eu caut', 'Eu caut.'],
  ['uk', 'я шукаю', 'Я шукаю.'],
  ['ru', 'я ищу', 'Я ищу.'],
  ['de', 'ich suche', 'Ich suche.'],
  ['ja', '探しています', '探しています.'],
  ['ko', '찾고 있습니다', '찾고 있습니다.'],
  ['zh', '我在找', '我在找.'],
  ['zh-Hans', '我在找', '我在找.'],
  ['zh-Hant', '我在找', '我在找.'],
  ['zh-HK', '我搵緊', '我搵緊.'],
  ['ar', 'أنا أبحث', 'أنا أبحث.'],
  ['hi', 'मैं खोज रहा हूँ', 'मैं खोज रहा हूँ.'],
  ['it', 'io cerco', 'Io cerco.'],
  ['pl', 'ja szukam', 'Ja szukam.'],
  ['he', 'אני מחפש', 'אני מחפש.'],
  ['nl', 'ik zoek', 'Ik zoek.'],
  ['vi', 'tôi đang tìm', 'Tôi đang tìm.'],
  ['tl', 'naghahanap ako', 'Naghahanap ako.'],
  ['tr', 'istiyorum', 'İstiyorum.'],
  ['id', 'saya mencari', 'Saya mencari.'],
  ['bg', 'аз търся', 'Аз търся.'],
];

beforeEach(() => {
  vi.clearAllMocks();
  mockGetTTSCode.mockImplementation((lang: string) => `${lang}-TTS`);
});

// ── empty/falsy text guard ────────────────────────────────────────────────────

describe('aacSpeak — empty text guard', () => {
  it('does not call speak() for empty string', () => {
    aacSpeak('', 0.5, 1.0);
    expect(mockSpeak).not.toHaveBeenCalled();
  });

  it('does not call speak() for whitespace-only string', () => {
    aacSpeak('   ', 0.5, 1.0);
    expect(mockSpeak).not.toHaveBeenCalled();
  });

  it('does not call speak() for null (cast)', () => {
    aacSpeak(null as unknown as string, 0.5, 1.0);
    expect(mockSpeak).not.toHaveBeenCalled();
  });

  it('does not call speak() for undefined (cast)', () => {
    aacSpeak(undefined as unknown as string, 0.5, 1.0);
    expect(mockSpeak).not.toHaveBeenCalled();
  });
});

// ── spokenLang path ───────────────────────────────────────────────────────────

describe('aacSpeak — explicit spokenLang parameter', () => {
  it('uses spokenLang TTS code, not the settings language', () => {
    // Settings say en→en but caller passes spokenLang='ro'
    // (e.g. MessageBar firing aacSpeak with already-translated Romanian text)
    aacSpeak('bine', 0.5, 1.0, undefined, false, 'ro');
    expect(mockGetTTSCode).toHaveBeenCalledWith('ro');
    expect(mockSpeak).toHaveBeenCalledWith(
      'Bine.',
      0.5, 1.0,
      'ro-TTS',
      expect.anything(),
      false,
    );
  });

  it('does NOT call translateTextSync when spokenLang is provided', () => {
    aacSpeak('Привет', 0.5, 1.0, undefined, false, 'ru');
    expect(mockTranslate).not.toHaveBeenCalled();
  });

  it('passes interrupt=true through when spokenLang is set', () => {
    aacSpeak('test', 0.5, 1.0, undefined, true, 'fr');
    expect(mockSpeak).toHaveBeenCalledWith(
      expect.anything(), 0.5, 1.0, 'fr-TTS', expect.anything(), true,
    );
  });

  it('sends Romanian target text as a complete sentence without changing display state', () => {
    aacSpeak('eu caut', 0.5, 1.0, undefined, true, 'ro');
    expect(mockSpeak).toHaveBeenCalledWith(
      'Eu caut.',
      0.5, 1.0,
      'ro-TTS',
      expect.anything(),
      true,
    );
  });

  it.each(SUPPORTED_TARGET_UTTERANCES)(
    'prepares %s target speech without changing its language',
    (lang, source, expected) => {
      aacSpeak(source, 0.5, 1.0, undefined, false, lang);
      expect(mockGetTTSCode).toHaveBeenCalledWith(lang);
      expect(mockSpeak).toHaveBeenCalledWith(
        expected,
        0.5, 1.0,
        `${lang}-TTS`,
        expect.anything(),
        false,
      );
    },
  );
});

// ── single-character padding ──────────────────────────────────────────────────

describe('aacSpeak — single-character padding', () => {
  it('appends . to a single-char input (spokenLang path)', () => {
    aacSpeak('A', 0.5, 1.0, undefined, false, 'en');
    const [spokenText] = mockSpeak.mock.calls[0];
    expect(spokenText).toBe('A.');
  });

  it('appends . to a single-char input (monolingual path)', () => {
    aacSpeak('B', 0.5, 1.0);
    const [spokenText] = mockSpeak.mock.calls[0];
    expect(spokenText).toBe('B.');
  });

  it('does not alter multi-char monolingual input', () => {
    aacSpeak('hello', 0.5, 1.0);
    const [spokenText] = mockSpeak.mock.calls[0];
    expect(spokenText).toBe('hello');
  });
});
