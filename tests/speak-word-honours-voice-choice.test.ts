import { describe, it, expect, vi, beforeEach } from 'vitest';
/**
 * Tapping a tile must use the voice the user chose.
 *
 * speakWord runs local-first to keep cloud cost off the highest-frequency
 * path, which is the right default. But only the NEURAL path reads
 * `voicePreferences` — so whenever any offline voice existed for the language,
 * a user who had explicitly picked a voice in settings got the browser voice
 * instead, with nothing to indicate why.
 *
 * Reported from a real device as "quick cards don't produce any sound".
 * Web Speech has no audible-success signal: `onend` fires identically whether
 * audio came out or not, so a present-but-mute system voice resolves 'ok' and
 * the escalate-on-failure branch in speak-word-neural-escalation.test.ts never
 * runs. The tile appends its word to the message bar and says nothing.
 *
 * Choosing a voice is now the reliable way off the local path. This asserts
 * the observable consequence — which backend actually spoke — not that the
 * setting was set.
 */
import { speakWord } from '@/services/speechService';
import { speakAzure } from '@/services/azureTTS';
import { useSettingsStore } from '@/store/settingsStore';

vi.mock('@/services/azureTTS', () => ({
  speakAzure: vi.fn().mockResolvedValue({ success: true }),
  stopAzureAudio: vi.fn(),
  warmupAzureAudio: vi.fn(),
}));

const mockAzure = speakAzure as ReturnType<typeof vi.fn>;
const mockSpeak = () => window.speechSynthesis.speak as ReturnType<typeof vi.fn>;
const mockGetVoices = () => window.speechSynthesis.getVoices as ReturnType<typeof vi.fn>;

/** Minimal SpeechSynthesisVoice stand-in — only lang/name are read. */
function voice(lang: string, name: string) {
  return { lang, name, default: false, localService: true, voiceURI: name };
}

const flush = () => new Promise((r) => setTimeout(r, 20));

beforeEach(() => {
  vi.clearAllMocks();
  // A healthy local voice exists for both languages: without the fix these
  // would all stay local.
  mockGetVoices().mockReturnValue([
    voice('en-US', 'System English'),
    voice('am-ET', 'System Amharic'),
  ]);
  useSettingsStore.setState({ language: 'en', voicePreferences: {} } as never);
});

describe('speakWord — an explicitly chosen voice wins over the local shortcut', () => {
  it('goes neural when the user picked a voice for that language', async () => {
    useSettingsStore.setState({
      language: 'am',
      voicePreferences: { am: 'am-ET-MekdesNeural' },
    } as never);

    speakWord('ሰላም', 1, 1, 'am-ET');
    await flush();

    expect(mockSpeak(), 'the chosen voice was ignored; the browser voice spoke').not.toHaveBeenCalled();
    expect(mockAzure, 'never reached the path that honours voicePreferences').toHaveBeenCalled();
  });

  it('stays local when no voice has been chosen', async () => {
    // The local fast path is a deliberate cost optimisation. This fix must
    // narrow it to users who expressed a preference, not remove it.
    speakWord('hello', 1, 1, 'en-US');
    await flush();

    expect(mockSpeak(), 'local fast path was lost for everyone').toHaveBeenCalled();
    expect(mockAzure).not.toHaveBeenCalled();
  });

  it('is scoped per language — an Amharic choice does not divert English', async () => {
    useSettingsStore.setState({
      language: 'en',
      voicePreferences: { am: 'am-ET-MekdesNeural' },
    } as never);

    speakWord('hello', 1, 1, 'en-US');
    await flush();

    expect(mockSpeak(), 'English was diverted by an unrelated preference').toHaveBeenCalled();
    expect(mockAzure).not.toHaveBeenCalled();
  });
});
