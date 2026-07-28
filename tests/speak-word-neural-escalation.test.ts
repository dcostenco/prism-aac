import { describe, it, expect, vi, beforeEach } from 'vitest';
/**
 * speakWord carries the composition path — Keyboard, MessageBar,
 * PredictionBar and CategoryPanel all replay the cumulative phrase through
 * it — so for an auto-speak user it is most of their spoken output. It runs
 * local-first to keep cloud cost off that high-frequency path, which is only
 * safe while local failure escalates instead of going silent.
 *
 * Covered here:
 *   1. No local voice for the language  → neural, before a wrong-language
 *      voice can read the text aloud.
 *   2. Runtime Web Speech failure       → neural.
 *   3. Superseded by a newer phrase     → NOT neural (no double-speak, no
 *      re-spend of the tokens the local route saves).
 *   4. Healthy local voice              → stays local, no cloud call.
 */
import { speakWord } from '@/services/speechService';
import { speakAzure } from '@/services/azureTTS';

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
  mockGetVoices().mockReturnValue([]);
});

describe('speakWord — neural escalation when local cannot deliver', () => {
  it('goes straight to neural when no voice exists for the language', async () => {
    mockGetVoices().mockReturnValue([voice('en-US', 'Samantha')]);
    mockSpeak().mockImplementation((u: { onend?: (() => void) | null }) => {
      if (u && typeof u.onend === 'function') u.onend();
    });

    speakWord('eu caut', 0.5, 1.0, 'ro-RO');
    await flush();

    expect(mockAzure).toHaveBeenCalledOnce();
    // The wrong-language local voice must never have been given the text.
    expect(mockSpeak()).not.toHaveBeenCalled();
  });

  it('escalates to neural when Web Speech reports a runtime failure', async () => {
    mockGetVoices().mockReturnValue([voice('ro-RO', 'Ioana')]);
    mockSpeak().mockImplementation((u: { onerror?: ((e: unknown) => void) | null }) => {
      if (u && typeof u.onerror === 'function') u.onerror({ error: 'synthesis-failed' });
    });

    speakWord('eu caut', 0.5, 1.0, 'ro-RO');
    await flush();

    expect(mockSpeak()).toHaveBeenCalled();
    expect(mockAzure).toHaveBeenCalledOnce();
  });

  it('does NOT escalate when a newer phrase supersedes the current one', async () => {
    mockGetVoices().mockReturnValue([voice('en-US', 'Samantha')]);
    // Never fires onend/onerror: the first utterance is still pending when the
    // second call retires it, which is the real latest-wins sequence.
    mockSpeak().mockImplementation(() => {});

    speakWord('I need', 0.5, 1.0, 'en-US');
    speakWord('I need help', 0.5, 1.0, 'en-US');
    await flush();

    expect(mockSpeak()).toHaveBeenCalledTimes(2);
    expect(mockAzure).not.toHaveBeenCalled();
  });

  it('stays local when the language has a healthy voice', async () => {
    mockGetVoices().mockReturnValue([voice('en-US', 'Samantha')]);
    mockSpeak().mockImplementation((u: { onend?: (() => void) | null }) => {
      if (u && typeof u.onend === 'function') u.onend();
    });

    speakWord('I need help', 0.5, 1.0, 'en-US');
    await flush();

    expect(mockSpeak()).toHaveBeenCalledOnce();
    expect(mockAzure).not.toHaveBeenCalled();
  });
});
