import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/services/azureTTS', () => ({
  speakAzure: vi.fn().mockResolvedValue({ success: false }),
  stopAzureAudio: vi.fn(),
}));
vi.mock('@/lib/datadog', () => ({ ddAction: vi.fn() }));

import { speak, speakWord } from '@/services/speechService';
import { speakAzure } from '@/services/azureTTS';
import { useSettingsStore } from '@/store/settingsStore';
import { isBuiltInPhraseText } from '@/lib/builtInPhraseText';

// speakAzure(text, lang, tone, rate, volume, token, voiceId, interrupt, cacheOnly, timeoutMs, telemetry)
const TELEMETRY_ARG = 10;
const lastTelemetry = () => vi.mocked(speakAzure).mock.calls.at(-1)?.[TELEMETRY_ARG];

describe('isBuiltInPhraseText', () => {
  it('matches a built-in phrase as the board shows it in that language', () => {
    expect(isBuiltInPhraseText('I', 'en')).toBe(true);
    expect(isBuiltInPhraseText('eu', 'ro')).toBe(true);
    expect(isBuiltInPhraseText('Yo', 'es')).toBe(true);
  });

  it('ignores case, surrounding space and closing punctuation', () => {
    expect(isBuiltInPhraseText('  i. ', 'en')).toBe(true);
    expect(isBuiltInPhraseText('EU!', 'ro')).toBe(true);
  });

  it('does not count composed or typed text, or another language’s phrase', () => {
    expect(isBuiltInPhraseText('I you he she it zebra', 'en')).toBe(false);
    expect(isBuiltInPhraseText('eu', 'en')).toBe(false);
    expect(isBuiltInPhraseText('', 'en')).toBe(false);
    expect(isBuiltInPhraseText('...', 'en')).toBe(false);
  });

  it('never counts blank speech, even where a phrase is deliberately blank (ru has no "to")', () => {
    expect(isBuiltInPhraseText('', 'ru')).toBe(false);
    expect(isBuiltInPhraseText(' . ', 'ru')).toBe(false);
  });
});

describe('what cloud speech tells the cache telemetry', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useSettingsStore.setState({ language: 'en' } as never);
    (window.speechSynthesis.speak as ReturnType<typeof vi.fn>).mockImplementation((u: { onend?: (() => void) | null }) => {
      if (u && typeof u.onend === 'function') u.onend();
    });
  });

  it('marks a spoken message, and whether it is a built-in phrase in the app language', async () => {
    await speak('I', 0.5, 1.0, 'en-US');
    expect(lastTelemetry()).toEqual({ surface: 'message', builtIn: true });
    await speak('I you he she it zebra', 0.5, 1.0, 'en-US');
    expect(lastTelemetry()).toEqual({ surface: 'message', builtIn: false });
  });

  it('uses the app language for the built-in check', async () => {
    useSettingsStore.setState({ language: 'es' } as never);
    await speak('Yo', 0.5, 1.0, 'es-ES');
    expect(lastTelemetry()).toEqual({ surface: 'message', builtIn: true });
  });

  it('marks tap feedback that goes to the cloud voice as feedback', async () => {
    // No device voice for the language sends tap feedback to the cloud voice.
    (window.speechSynthesis.getVoices as ReturnType<typeof vi.fn>).mockReturnValue([]);
    speakWord('I', 0.5, 1.0, 'en-US');
    await vi.waitFor(() => expect(speakAzure).toHaveBeenCalled());
    expect(vi.mocked(speakAzure).mock.calls.at(-1)?.[0]).toBe('I.');
    expect(lastTelemetry()).toEqual({ surface: 'feedback', builtIn: true });
  });
});
