/**
 * Master mute is a last-line safety contract: even a caller that forgets to
 * check soundEnabled must not start TTS while the AAC board is muted.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { aacSpeak } from '@/services/aacSpeak';
import { speak } from '@/services/speechService';
import { useMessageStore } from '@/store/messageStore';
import { useSettingsStore } from '@/store/settingsStore';

vi.mock('@/services/speechService', () => ({ speak: vi.fn() }));

beforeEach(() => {
  vi.clearAllMocks();
  useMessageStore.setState({ soundEnabled: true, toneMode: 'auto' });
  useSettingsStore.setState({ language: 'en', outputLanguage: 'en', speechRate: 0.5, speechVolume: 1 });
});

describe('aacSpeak — master mute', () => {
  it('does not enter any speech backend while sound is off', async () => {
    useMessageStore.setState({ soundEnabled: false });

    await aacSpeak('This hint must stay silent.', 0.5, 1);

    expect(speak).not.toHaveBeenCalled();
  });

  it('still speaks normally after sound is turned back on', async () => {
    await aacSpeak('Speech restored.', 0.5, 1);

    expect(speak).toHaveBeenCalledOnce();
  });
});
