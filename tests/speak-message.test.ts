import { beforeEach, describe, expect, it, vi } from 'vitest';

// speakComposedMessage speaks a composed message the way the keyboard's Speak
// key does. When the output language differs it waits for the translation
// first; a Stop pressed during that wait must not be followed by speech.

const mocks = vi.hoisted(() => ({ aacSpeak: vi.fn(async () => {}), translateForSpeech: vi.fn() }));
vi.mock('@/services/aacSpeak', () => ({ aacSpeak: mocks.aacSpeak }));
vi.mock('@/services/translateService', () => ({ translateForSpeech: mocks.translateForSpeech }));
// Stand-in stores: the real message store pulls in modules that keep loading
// after the test environment is gone.
vi.mock('@/store/messageStore', () => ({
  useMessageStore: { getState: () => ({ addToHistory: vi.fn(), activeTone: 'auto' }) },
  getLatestTranslated: () => '',
  setLatestTranslated: vi.fn(),
}));
vi.mock('@/store/settingsStore', () => ({
  useSettingsStore: { getState: () => ({ speechRate: 1, speechVolume: 1, language: 'en', outputLanguage: 'es' }) },
}));

import { speakComposedMessage } from '@/services/speakMessage';

beforeEach(() => {
  mocks.aacSpeak.mockClear();
  mocks.translateForSpeech.mockReset();
});

describe('speaking a message in another language', () => {
  it('speaks the translation when it comes back', async () => {
    mocks.translateForSpeech.mockResolvedValue('quiero jugo');
    await speakComposedMessage('I want juice', undefined, () => true);
    expect(mocks.aacSpeak).toHaveBeenCalledTimes(1);
    expect(mocks.aacSpeak.mock.calls[0][0]).toBe('quiero jugo');
  });

  it('says nothing when Stop was pressed while the translation was loading', async () => {
    let wanted = true;
    let finish!: (v: string) => void;
    mocks.translateForSpeech.mockReturnValue(new Promise<string>((r) => { finish = r; }));
    const done = speakComposedMessage('I want juice', undefined, () => wanted);
    wanted = false;
    finish('quiero jugo');
    await done;
    expect(mocks.aacSpeak).not.toHaveBeenCalled();
  });
});
