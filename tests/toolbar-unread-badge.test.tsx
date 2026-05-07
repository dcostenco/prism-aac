/**
 * Toolbar — unread incoming-message badge on the AAC chat button.
 * Verifies the count increments when scheduleStore.addIncomingMessage
 * runs, decrements when the message task is checked off, and disappears
 * at zero.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import Toolbar from '@/components/Toolbar';
import { useScheduleStore } from '@/store/scheduleStore';
import { useSettingsStore, DEFAULT_TOOLBAR_ORDER } from '@/store/settingsStore';
import { useMessageStore } from '@/store/messageStore';
import { useAuthStore } from '@/store/authStore';

vi.mock('@/engine/useT', () => ({
  useT: () => ({ t: (k: string) => k, ttsCode: 'en-US', rtl: false, ready: true }),
}));
vi.mock('@/services/feedback', () => ({ tapFeedback: vi.fn() }));
vi.mock('@/services/voiceInputService', () => ({
  isVoiceInputSupported: () => false,
  startVoiceInput: vi.fn(),
}));
vi.mock('@/services/textCorrectService', () => ({ correctText: async (s: string) => s }));
vi.mock('@/components/SyncProvider', () => ({ useSyncStatus: () => 'idle' }));

beforeEach(() => {
  useAuthStore.setState({ profile: null, loaded: true, loading: false });
  useScheduleStore.setState({ tasks: [], rewards: 0, timerSeconds: 300, timerEndMs: 0 });
  useSettingsStore.setState({
    installedApps: [],
    toolbarConfig: {
      order: [...DEFAULT_TOOLBAR_ORDER],
      enabled: Object.fromEntries(DEFAULT_TOOLBAR_ORDER.map((id) => [id, true])),
    },
  } as Partial<ReturnType<typeof useSettingsStore.getState>>);
  useMessageStore.setState({ text: '', soundEnabled: true });
});

describe('Toolbar — unread badge on aac_chat', () => {
  it('renders no badge when there are no unread messages', () => {
    render(<Toolbar />);
    expect(screen.queryByTestId('toolbar-badge-aac_chat')).toBeNull();
  });

  it('renders the count when an incoming message is unread', () => {
    useScheduleStore.getState().addIncomingMessage('Mom', 'hi whats up');
    render(<Toolbar />);
    const badge = screen.getByTestId('toolbar-badge-aac_chat');
    expect(badge).toBeInTheDocument();
    expect(badge).toHaveTextContent('1');
  });

  it('counts each unread message and clamps the display at 99+', () => {
    for (let i = 0; i < 105; i++) {
      useScheduleStore.getState().addIncomingMessage('Sender', `m ${i}`, `id-${i}`);
    }
    render(<Toolbar />);
    expect(screen.getByTestId('toolbar-badge-aac_chat')).toHaveTextContent('99+');
  });

  it('disappears once the message task is checked off', () => {
    const id = useScheduleStore.getState().addIncomingMessage('Mom', 'hi');
    expect(id).not.toBeNull();
    useScheduleStore.getState().toggleDone(id!);
    render(<Toolbar />);
    expect(screen.queryByTestId('toolbar-badge-aac_chat')).toBeNull();
  });
});
