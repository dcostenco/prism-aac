/** stopSpeech is the panic stop behind master mute and must cover every tier. */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { speak, stopSpeech } from '@/services/speechService';
import { speakAzure, stopAzureAudio } from '@/services/azureTTS';
import { stopWasmSpeech } from '@/services/wasmTTS';
import { useMessageStore } from '@/store/messageStore';

vi.mock('@/services/azureTTS', () => ({
  speakAzure: vi.fn(),
  stopAzureAudio: vi.fn(),
}));
vi.mock('@/services/wasmTTS', () => ({
  stopWasmSpeech: vi.fn(),
}));

beforeEach(() => {
  vi.clearAllMocks();
  useMessageStore.setState({ soundEnabled: true });
});

describe('stopSpeech — all active audio backends', () => {
  it('stops cloud/WebAudio, browser speech, and WASM speech', () => {
    stopSpeech();

    expect(stopAzureAudio).toHaveBeenCalledOnce();
    expect(window.speechSynthesis.cancel).toHaveBeenCalledOnce();
    expect(stopWasmSpeech).toHaveBeenCalledOnce();
  });

  it('invalidates a pending fallback chain so a late cloud failure cannot restart browser speech', async () => {
    let finishCloud!: (value: { success: false }) => void;
    (speakAzure as ReturnType<typeof vi.fn>).mockReturnValueOnce(
      new Promise((resolve) => { finishCloud = resolve; }),
    );
    (window.speechSynthesis.speak as ReturnType<typeof vi.fn>).mockImplementation(
      (utterance: { onend?: (() => void) | null }) => queueMicrotask(() => utterance.onend?.()),
    );

    const pendingSpeech = speak('A delayed hint.', 0.5, 1, 'en-US');
    await Promise.resolve();
    stopSpeech();
    finishCloud({ success: false });
    await pendingSpeech;

    expect(window.speechSynthesis.speak).not.toHaveBeenCalled();
  });

  it('suppresses direct lower-level speech calls while master mute is active', async () => {
    useMessageStore.setState({ soundEnabled: false });

    await speak('Voice previews must respect Sound Off.', 0.5, 1, 'en-US');

    expect(speakAzure).not.toHaveBeenCalled();
    expect(window.speechSynthesis.speak).not.toHaveBeenCalled();
  });
});
