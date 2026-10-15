/**
 * The speech epoch tells a caller pausing between the parts of something it
 * reads (the AI chat answer) whether someone else spoke or pressed Stop in the
 * meantime. It must move on every take-over and on Stop.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { currentSpeechEpoch, speak, stopSpeech } from '@/services/speechService';
import { useMessageStore } from '@/store/messageStore';

vi.mock('@/services/azureTTS', () => ({
  speakAzure: vi.fn(async () => ({ success: true, onEnded: Promise.resolve('ended') })),
  stopAzureAudio: vi.fn(),
}));
vi.mock('@/services/wasmTTS', () => ({
  speakWasm: vi.fn(async () => true),
  isWasmTTSReady: vi.fn(() => true),
  initWasmTTS: vi.fn(async () => {}),
  stopWasmSpeech: vi.fn(),
}));

beforeEach(() => {
  vi.clearAllMocks();
  useMessageStore.setState({ soundEnabled: true });
});

describe('currentSpeechEpoch', () => {
  it('moves when Stop is pressed', () => {
    const before = currentSpeechEpoch();
    stopSpeech();
    expect(currentSpeechEpoch()).not.toBe(before);
  });

  it('moves when an interrupting phrase takes over', async () => {
    const before = currentSpeechEpoch();
    await speak('Someone else speaks.', 0.5, 1, 'en-US', 'auto', true);
    expect(currentSpeechEpoch()).not.toBe(before);
  });

  // Voice Preview speaks without interrupting; once its clip plays, a paused AI
  // answer must see that someone else is speaking.
  it('moves when a non-interrupting phrase starts playing', async () => {
    const before = currentSpeechEpoch();
    await speak('A voice preview.', 0.5, 1, 'en-US');
    expect(currentSpeechEpoch()).not.toBe(before);
  });

  it('stays put while nothing takes over', () => {
    const before = currentSpeechEpoch();
    expect(currentSpeechEpoch()).toBe(before);
  });
});
