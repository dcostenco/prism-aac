import { beforeEach, describe, expect, it, vi } from 'vitest';

// The browser's Say: one controller for the toolbar button, the keyboard key and
// Enter. Speak used to wait up to 8 s for the cloud voice with no sign of
// progress, and pressing again restarted the request (14 s to first speech).

const mocks = vi.hoisted(() => ({
  speakComposedMessage: vi.fn(),
  stopSpeech: vi.fn(),
}));
vi.mock('@/services/speakMessage', () => ({ speakComposedMessage: mocks.speakComposedMessage }));
vi.mock('@/services/speechService', () => ({ stopSpeech: mocks.stopSpeech }));
vi.mock('@/services/azureTTS', () => ({ warmupAzureAudio: vi.fn(async () => {}) }));

import { BROWSER_CLOUD_VOICE_BUDGET_MS, sayOrStop, stopBrowserSpeech, useBrowserSpeech } from '@/app/browser/browserSpeech';
import { useMessageStore } from '@/store/messageStore';

function deferred() {
  let resolve!: () => void;
  const promise = new Promise<void>((r) => { resolve = r; });
  return { promise, resolve };
}

beforeEach(() => {
  mocks.speakComposedMessage.mockReset();
  mocks.stopSpeech.mockReset();
  stopBrowserSpeech();
  mocks.stopSpeech.mockReset();
  useMessageStore.setState({ soundEnabled: true });
});

describe("the browser's Say", () => {
  it('speaks with a 1.5 s cloud-voice wait and shows speaking until speech ends', async () => {
    const speech = deferred();
    mocks.speakComposedMessage.mockReturnValue(speech.promise);
    sayOrStop('  I want juice ');
    expect(BROWSER_CLOUD_VOICE_BUDGET_MS).toBe(1500);
    expect(mocks.speakComposedMessage).toHaveBeenCalledWith('I want juice', { cloudTimeoutMs: 1500 }, expect.any(Function));
    expect(useBrowserSpeech.getState().speaking).toBe(true);
    speech.resolve();
    await speech.promise;
    await Promise.resolve();
    expect(useBrowserSpeech.getState().speaking).toBe(false);
  });

  it('tells a translation still loading that Stop was pressed', () => {
    mocks.speakComposedMessage.mockReturnValue(deferred().promise);
    sayOrStop('hola');
    const stillWanted = mocks.speakComposedMessage.mock.calls[0][2] as () => boolean;
    expect(stillWanted()).toBe(true);
    sayOrStop('hola');
    expect(stillWanted()).toBe(false);
  });

  it('stops on a second press instead of starting the request again', () => {
    mocks.speakComposedMessage.mockReturnValue(deferred().promise);
    sayOrStop('hello');
    sayOrStop('hello');
    expect(mocks.speakComposedMessage).toHaveBeenCalledTimes(1);
    expect(mocks.stopSpeech).toHaveBeenCalledTimes(1);
    expect(useBrowserSpeech.getState().speaking).toBe(false);
  });

  it('does not let an old utterance that ends late clear a newer one', async () => {
    const first = deferred();
    const second = deferred();
    mocks.speakComposedMessage.mockReturnValueOnce(first.promise).mockReturnValueOnce(second.promise);
    sayOrStop('one');
    sayOrStop('one'); // stop
    sayOrStop('two');
    first.resolve();
    await first.promise;
    await Promise.resolve();
    expect(useBrowserSpeech.getState().speaking).toBe(true);
    second.resolve();
    await second.promise;
    await Promise.resolve();
    expect(useBrowserSpeech.getState().speaking).toBe(false);
  });

  it('says nothing for an empty message or with sound off', () => {
    sayOrStop('   ');
    useMessageStore.setState({ soundEnabled: false });
    sayOrStop('hello');
    expect(mocks.speakComposedMessage).not.toHaveBeenCalled();
    expect(useBrowserSpeech.getState().speaking).toBe(false);
  });
});
