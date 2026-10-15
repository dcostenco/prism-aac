/**
 * When the cloud voice is unavailable and the device voice errors (no voice
 * installed for the language, a synthesis failure), the last-resort tier must
 * still be tried (the offline engine when present, otherwise attention tones):
 * a composed message may never end in silence.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { speak, speakWord, stopSpeech } from '@/services/speechService';
import { speakAzure } from '@/services/azureTTS';
import { initWasmTTS, isWasmTTSReady, speakWasm, stopWasmSpeech } from '@/services/wasmTTS';
import { subscribeTtsHealth, type TtsHealthEvent } from '@/services/ttsHealthBus';
import { useMessageStore } from '@/store/messageStore';

vi.mock('@/services/azureTTS', () => ({
  speakAzure: vi.fn(async () => ({ success: false })),
  stopAzureAudio: vi.fn(),
}));
vi.mock('@/services/wasmTTS', () => ({
  speakWasm: vi.fn(async () => true),
  isWasmTTSReady: vi.fn(() => true),
  initWasmTTS: vi.fn(async () => {}),
  stopWasmSpeech: vi.fn(),
}));

type Utterance = { onend?: (() => void) | null; onerror?: ((ev: { error: string }) => void) | null };
const deviceVoice = window.speechSynthesis.speak as ReturnType<typeof vi.fn>;

beforeEach(() => {
  vi.clearAllMocks();
  (speakWasm as ReturnType<typeof vi.fn>).mockImplementation(async () => true);
  (isWasmTTSReady as ReturnType<typeof vi.fn>).mockImplementation(() => true);
  (speakAzure as ReturnType<typeof vi.fn>).mockImplementation(async () => ({ success: false }));
  useMessageStore.setState({ soundEnabled: true });
});

describe('speak — device voice failure', () => {
  it('falls through to the last-resort tier when the device voice errors', async () => {
    deviceVoice.mockImplementation((u: Utterance) => queueMicrotask(() => u.onerror?.({ error: 'language-unavailable' })));

    await speak('I need my medicine now.', 0.5, 1, 'am-ET');

    expect(deviceVoice).toHaveBeenCalledOnce();
    expect(speakWasm).toHaveBeenCalledWith('I need my medicine now.', 'am-ET', 0.5, 1);
  });

  it('does not repeat the message in the bundled voice when the device voice spoke it', async () => {
    deviceVoice.mockImplementation((u: Utterance) => queueMicrotask(() => u.onend?.()));

    await speak('I am thirsty.', 0.5, 1, 'en-US');

    expect(deviceVoice).toHaveBeenCalledOnce();
    expect(speakWasm).not.toHaveBeenCalled();
  });

  it('stays silent after Stop, even if the stopped device voice reports an error', async () => {
    let fail!: () => void;
    deviceVoice.mockImplementation((u: Utterance) => { fail = () => u.onerror?.({ error: 'interrupted' }); });

    const pending = speak('This was stopped.', 0.5, 1, 'en-US');
    await vi.waitFor(() => expect(deviceVoice).toHaveBeenCalledOnce());
    stopSpeech();
    fail();
    await pending;

    expect(speakAzure).toHaveBeenCalledOnce();
    expect(speakWasm).not.toHaveBeenCalled();
  });

  // 'interrupted' means something else took over the audio: a newer phrase, the
  // emergency speaker, panic stop, or the system (a phone call). Re-speaking the
  // text would talk over it; going quiet without a trace would hide the loss.
  it('reports an interrupted device voice, and never re-speaks it over what interrupted it', async () => {
    deviceVoice.mockImplementation((u: Utterance) => queueMicrotask(() => u.onerror?.({ error: 'interrupted' })));
    const events: TtsHealthEvent[] = [];
    const unsubscribe = subscribeTtsHealth(e => events.push(e));

    await speak('An older phrase.', 0.5, 1, 'en-US');
    unsubscribe();

    expect(speakWasm).not.toHaveBeenCalled();
    expect(events).toContainEqual(expect.objectContaining({ type: 'tts-give-up', reason: 'device voice interrupted' }));
  });

  it('keeps the stale text silent when a newer phrase starts while the fallback warms up', async () => {
    let ready!: () => void;
    (isWasmTTSReady as ReturnType<typeof vi.fn>).mockImplementation(() => false);
    (initWasmTTS as ReturnType<typeof vi.fn>).mockImplementationOnce(() => new Promise<void>(r => { ready = r; }));
    deviceVoice.mockImplementation((u: Utterance) => queueMicrotask(() => u.onerror?.({ error: 'synthesis-failed' })));

    const older = speak('The older phrase.', 0.5, 1, 'en-US');
    await vi.waitFor(() => expect(initWasmTTS).toHaveBeenCalledOnce());
    (speakAzure as ReturnType<typeof vi.fn>).mockImplementationOnce(async () => ({ success: true }));
    await speak('HELP', 0.5, 1, 'en-US', 'auto', true);
    ready();
    await older;

    expect(speakWasm).not.toHaveBeenCalled();
  });

  it('reports giving up, not success, when the last-resort tier could not play anything', async () => {
    deviceVoice.mockImplementation((u: Utterance) => queueMicrotask(() => u.onerror?.({ error: 'synthesis-failed' })));
    (speakWasm as ReturnType<typeof vi.fn>).mockImplementation(async () => false);
    const events: TtsHealthEvent[] = [];
    const unsubscribe = subscribeTtsHealth(e => events.push(e));

    await speak('Nothing can play this.', 0.5, 1, 'en-US');
    unsubscribe();

    expect(events.some(e => e.type === 'tts-success' && e.tier === 'native-ios')).toBe(false);
    expect(events.some(e => e.type === 'tts-give-up' && e.lastTier === 'native-ios')).toBe(true);
  });

  // Tap feedback takes the local shortcut without going through speak(); it must
  // still take over, or the older message's fallback starts over the new word.
  it('keeps an older message silent once a tapped word takes over during its fallback warm-up', async () => {
    let ready!: () => void;
    (isWasmTTSReady as ReturnType<typeof vi.fn>).mockImplementation(() => false);
    (initWasmTTS as ReturnType<typeof vi.fn>).mockImplementationOnce(() => new Promise<void>(r => { ready = r; }));
    (window.speechSynthesis.getVoices as ReturnType<typeof vi.fn>).mockReturnValue([
      { lang: 'en-US', name: 'Samantha', default: true, localService: true, voiceURI: 'Samantha' },
    ]);
    deviceVoice.mockImplementationOnce((u: Utterance) => queueMicrotask(() => u.onerror?.({ error: 'synthesis-failed' })))
      .mockImplementation((u: Utterance) => queueMicrotask(() => u.onend?.()));

    const older = speak('The older phrase.', 0.5, 1, 'en-US');
    await vi.waitFor(() => expect(initWasmTTS).toHaveBeenCalledOnce());
    speakWord('HELP', 0.5, 1, 'en-US');
    ready();
    await older;

    expect(speakWasm).not.toHaveBeenCalled();
  });

  // A phrase that does not interrupt still replaces the older one once it reaches
  // the device voice, which cancels whatever device speech there is.
  it('keeps an older message silent once a newer phrase reaches the device voice', async () => {
    let ready!: () => void;
    (isWasmTTSReady as ReturnType<typeof vi.fn>).mockImplementation(() => false);
    (initWasmTTS as ReturnType<typeof vi.fn>).mockImplementationOnce(() => new Promise<void>(r => { ready = r; }));
    deviceVoice.mockImplementationOnce((u: Utterance) => queueMicrotask(() => u.onerror?.({ error: 'synthesis-failed' })))
      .mockImplementation((u: Utterance) => queueMicrotask(() => u.onend?.()));

    const older = speak('The older phrase.', 0.5, 1, 'en-US');
    await vi.waitFor(() => expect(initWasmTTS).toHaveBeenCalledOnce());
    await speak('A newer phrase.', 0.5, 1, 'en-US');
    ready();
    await older;

    expect(speakWasm).not.toHaveBeenCalled();
  });

  it('stops last-resort audio still playing when an interrupting phrase starts', async () => {
    deviceVoice.mockImplementation((u: Utterance) => queueMicrotask(() => u.onerror?.({ error: 'synthesis-failed' })));
    (speakWasm as ReturnType<typeof vi.fn>).mockImplementationOnce(() => new Promise<boolean>(() => {}));

    void speak('Tones for the older phrase.', 0.5, 1, 'en-US');
    await vi.waitFor(() => expect(speakWasm).toHaveBeenCalledOnce());
    (stopWasmSpeech as ReturnType<typeof vi.fn>).mockClear();
    (speakAzure as ReturnType<typeof vi.fn>).mockImplementationOnce(async () => ({ success: true, onEnded: Promise.resolve('ended') }));
    await speak('HELP', 0.5, 1, 'en-US', 'auto', true);

    expect(stopWasmSpeech).toHaveBeenCalled();
  });
});
