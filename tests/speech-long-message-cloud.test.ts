/**
 * A long message is spoken in full by the cloud voice, chunk by chunk. If a
 * chunk fails, the device voice says the rest — never the part already heard,
 * and never nothing.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { speak, stopSpeech } from '@/services/speechService';
import { speakAzure } from '@/services/azureTTS';
import { useMessageStore } from '@/store/messageStore';
import { subscribeTtsHealth, type TtsHealthEvent } from '@/services/ttsHealthBus';

vi.mock('@/services/azureTTS', () => ({
  speakAzure: vi.fn(async () => ({ success: true, onEnded: Promise.resolve('ended') })),
  stopAzureAudio: vi.fn(),
}));
vi.mock('@/services/wasmTTS', () => ({
  speakWasm: vi.fn(async () => {}),
  isWasmTTSReady: vi.fn(() => true),
  initWasmTTS: vi.fn(async () => {}),
  stopWasmSpeech: vi.fn(),
}));

type Utterance = { text?: string; onend?: (() => void) | null };
const cloud = speakAzure as ReturnType<typeof vi.fn>;
const deviceVoice = window.speechSynthesis.speak as ReturnType<typeof vi.fn>;
const message = Array.from({ length: 30 }, (_, i) => `Line ${i}: please read this to the doctor. `).join('')
  + 'Allergic to penicillin.';
const spokenByCloud = () => cloud.mock.calls.map(c => c[0] as string);

beforeEach(() => {
  vi.clearAllMocks();
  cloud.mockImplementation(async () => ({ success: true, onEnded: Promise.resolve('ended') }));
  deviceVoice.mockImplementation((u: Utterance) => queueMicrotask(() => u.onend?.()));
  useMessageStore.setState({ soundEnabled: true });
});

describe('speak — long messages and the cloud voice', () => {
  it('speaks the whole message, in order, within the per-request limit', async () => {
    expect(message.length).toBeGreaterThan(1000);
    const events: TtsHealthEvent[] = [];
    const unsubscribe = subscribeTtsHealth(e => events.push(e));

    await speak(message, 0.5, 1, 'en-US');
    unsubscribe();

    expect(spokenByCloud().length).toBeGreaterThan(2);
    expect(spokenByCloud().join('')).toBe(message);
    for (const chunk of spokenByCloud()) expect(chunk.length).toBeLessThanOrEqual(500);
    expect(spokenByCloud().at(-1)).toContain('Allergic to penicillin.');
    expect(deviceVoice).not.toHaveBeenCalled();
    // A message the cloud voice finished is not reported as a cloud failure.
    expect(events.filter(e => e.type === 'tts-fallback')).toEqual([]);
  });

  it('hands only the unspoken rest to the device voice when a later chunk fails', async () => {
    cloud.mockImplementationOnce(async () => ({ success: true, onEnded: Promise.resolve('ended') }))
      .mockImplementationOnce(async () => ({ success: false }));

    await speak(message, 0.5, 1, 'en-US');

    const [first, second] = spokenByCloud();
    expect(deviceVoice).toHaveBeenCalledOnce();
    const rest = (deviceVoice.mock.calls[0][0] as Utterance).text ?? '';
    expect(rest.startsWith(second)).toBe(true);
    expect(rest).not.toContain(first.trim());
    expect(first + rest).toBe(message);
  });

  it('sends no blank request for trailing spaces left after the last cut', async () => {
    const text = `${'a'.repeat(499)}.${' '.repeat(10)}`;

    await speak(text, 0.5, 1, 'en-US');

    expect(spokenByCloud()).toEqual([`${'a'.repeat(499)}.`]);
    expect(deviceVoice).not.toHaveBeenCalled();
  });

  it('ends the long message when a newer phrase cuts off the part being played', async () => {
    cloud.mockImplementationOnce(async () => ({ success: true, onEnded: Promise.resolve('stopped') }));

    await speak(message, 0.5, 1, 'en-US');

    expect(cloud).toHaveBeenCalledOnce();
    expect(deviceVoice).not.toHaveBeenCalled();
  });

  it('does not cut off a newer phrase with the rest of an older long message', async () => {
    let endFirst!: (how: 'ended') => void;
    cloud.mockImplementationOnce(async () => ({ success: true, onEnded: new Promise(r => { endFirst = r; }) }));

    const older = speak(message, 0.5, 1, 'en-US');
    await vi.waitFor(() => expect(cloud).toHaveBeenCalledOnce());
    const newer = speak('HELP NOW', 0.5, 1, 'en-US', 'auto', true);
    await vi.waitFor(() => expect(cloud).toHaveBeenCalledTimes(2));
    endFirst('ended');
    await Promise.all([older, newer]);

    expect(spokenByCloud()).toEqual([spokenByCloud()[0], 'HELP NOW']);
    expect(deviceVoice).not.toHaveBeenCalled();
  });

  it('stops between chunks when Stop is pressed', async () => {
    let finishFirst!: () => void;
    cloud.mockImplementationOnce(async () => ({ success: true, onEnded: new Promise<void>(r => { finishFirst = r; }) }));

    const pending = speak(message, 0.5, 1, 'en-US');
    await vi.waitFor(() => expect(cloud).toHaveBeenCalledOnce());
    stopSpeech();
    finishFirst();
    await pending;

    expect(cloud).toHaveBeenCalledOnce();
    expect(deviceVoice).not.toHaveBeenCalled();
  });

  // A duplicate of what is already playing, or a request dropped to protect a
  // phrase that just started, is acknowledged without a clip. It was not heard
  // from this call, so it must not count as spoken and move on to the next part.
  it('yields to what is playing when a part is acknowledged without a clip', async () => {
    cloud.mockImplementationOnce(async () => ({ success: true }));

    await speak(message, 0.5, 1, 'en-US');

    expect(cloud).toHaveBeenCalledOnce();
    expect(deviceVoice).not.toHaveBeenCalled();
  });

  // A non-interrupting phrase the player drops does not cut the message short.
  it('keeps speaking a long message when a non-interrupting phrase is dropped', async () => {
    let endFirst!: (how: 'ended') => void;
    cloud.mockImplementationOnce(async () => ({ success: true, onEnded: new Promise(r => { endFirst = r; }) }))
      .mockImplementationOnce(async () => ({ success: true }));

    const older = speak(message, 0.5, 1, 'en-US');
    await vi.waitFor(() => expect(cloud).toHaveBeenCalledOnce());
    await speak('a quiet note', 0.5, 1, 'en-US');
    endFirst('ended');
    await older;

    const olderParts = spokenByCloud().filter(t => t !== 'a quiet note');
    expect(olderParts.join('')).toBe(message);
  });

  // A later part must not cancel device speech that started meanwhile, such as
  // the emergency announcement: only the first part carries the interrupt.
  it('sends only the first part of an interrupting message as interrupting', async () => {
    await speak(message, 0.5, 1, 'en-US', 'auto', true);

    const interrupts = cloud.mock.calls.map(c => c[7]);
    expect(interrupts.length).toBeGreaterThan(2);
    expect(interrupts[0]).toBe(true);
    expect(interrupts.slice(1).every(i => i === false)).toBe(true);
  });

  it('reports finished when it spoke the message, and halted when something else took over', async () => {
    await expect(speak(message, 0.5, 1, 'en-US')).resolves.toBe('finished');
    cloud.mockImplementationOnce(async () => ({ success: true, onEnded: Promise.resolve('stopped') }));
    await expect(speak(message, 0.5, 1, 'en-US')).resolves.toBe('halted');
  });
});
