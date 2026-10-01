/** Master sound-off must stop audio already playing before it flips UI state. */
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom/vitest';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import Toolbar from '@/components/Toolbar';
import { useAuthStore } from '@/store/authStore';
import { useMessageStore } from '@/store/messageStore';
import { DEFAULT_TOOLBAR_ORDER, useSettingsStore } from '@/store/settingsStore';
import { stopSpeech } from '@/services/speechService';

vi.mock('@/engine/useT', () => ({
  useT: () => ({ t: (key: string) => key, ttsCode: 'en-US', rtl: false, ready: true }),
}));
vi.mock('@/services/feedback', () => ({ tapFeedback: vi.fn(), alertFeedback: vi.fn() }));
vi.mock('@/services/voiceInputService', () => ({ isVoiceInputSupported: () => false, startVoiceInput: vi.fn() }));
vi.mock('@/services/textCorrectService', () => ({ correctText: async (text: string) => text }));
vi.mock('@/components/SyncProvider', () => ({ useSyncStatus: () => 'idle' }));
vi.mock('@/services/speechService', () => ({ stopSpeech: vi.fn() }));

beforeEach(() => {
  vi.clearAllMocks();
  useAuthStore.setState({ profile: null, loaded: true, loading: false });
  useMessageStore.setState({ soundEnabled: true });
  useSettingsStore.setState({
    installedApps: [],
    toolbarConfig: {
      order: [...DEFAULT_TOOLBAR_ORDER],
      enabled: Object.fromEntries(DEFAULT_TOOLBAR_ORDER.map((id) => [id, true])),
    },
  } as Partial<ReturnType<typeof useSettingsStore.getState>>);
});

describe('Toolbar — master mute', () => {
  it('stops active speech when the sound button switches from on to off', async () => {
    const user = userEvent.setup();
    render(<Toolbar />);

    await user.click(screen.getAllByRole('button', { name: 'sound_on' })[0]);

    expect(stopSpeech).toHaveBeenCalledOnce();
    expect(useMessageStore.getState().soundEnabled).toBe(false);
  });

  it('does not issue a redundant stop when unmuting', async () => {
    useMessageStore.setState({ soundEnabled: false });
    const user = userEvent.setup();
    render(<Toolbar />);

    await user.click(screen.getAllByRole('button', { name: 'sound_off' })[0]);

    expect(stopSpeech).not.toHaveBeenCalled();
    expect(useMessageStore.getState().soundEnabled).toBe(true);
  });
});
