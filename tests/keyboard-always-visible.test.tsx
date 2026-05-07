/**
 * HARD INVARIANT: The AAC keyboard must be on screen no matter which
 * panel is open. This is the user's only input method — hiding it for
 * "more space" trades the user's voice for a UI win nobody asked for.
 *
 * If a future change starts gating <Keyboard /> on sidePanel state, this
 * suite breaks loudly.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import PrismApp from '@/components/PrismApp';
import { useUIStore } from '@/store/uiStore';
import { useAuthStore } from '@/store/authStore';
import { useSettingsStore } from '@/store/settingsStore';
import type { SidePanelView } from '@/types';

// Big mock surface: PrismApp wires many services we don't care about for
// this invariant. We only care that the keyboard shell renders for every
// sidePanel value.
vi.mock('@/services/feedback', () => ({
  tapFeedback: vi.fn(), keyFeedback: vi.fn(), deleteFeedback: vi.fn(),
  playTimerRing: vi.fn(), startAudioWarmup: vi.fn(), stopAudioWarmup: vi.fn(),
}));
vi.mock('@/services/aacSpeak', () => ({ aacSpeak: vi.fn() }));
vi.mock('@/services/panicService', () => ({ registerPanicListeners: () => () => {} }));
vi.mock('@/services/kokoroTTS', () => ({ preloadKokoro: vi.fn() }));
vi.mock('@/services/inboxService', () => ({ startInboxPolling: () => () => {} }));
vi.mock('@/services/contactsIntegrationService', () => ({ startContactsSync: () => () => {} }));
vi.mock('@/engine/useT', () => ({
  useT: () => ({ t: (k: string) => k, ttsCode: 'en-US', rtl: false, ready: true }),
}));
vi.mock('@/components/SyncProvider', () => ({
  default: ({ children }: { children: React.ReactNode }) => children,
  useSyncStatus: () => 'idle',
}));
vi.mock('@/components/Keyboard', () => ({
  default: () => <div data-testid="aac-keyboard-mock">[keyboard]</div>,
}));
// Stub every panel/overlay PrismApp imports — we only care that the
// keyboard shell renders for every sidePanel value. vi.mock factories
// are hoisted, so each one is inlined (no top-level helper).
vi.mock('@/components/Toolbar', () => ({ default: () => <div data-testid="panel-toolbar" /> }));
vi.mock('@/components/MessageBar', () => ({ default: () => <div data-testid="panel-message-bar" /> }));
vi.mock('@/components/PredictionBar', () => ({ default: () => <div data-testid="panel-prediction-bar" /> }));
vi.mock('@/components/CategoryPanel', () => ({ default: () => <div data-testid="panel-categories" /> }));
vi.mock('@/components/CaregiverPanel', () => ({ default: () => <div data-testid="panel-caregiver" /> }));
vi.mock('@/components/AIChatPanel', () => ({ default: () => <div data-testid="panel-ai-chat" /> }));
vi.mock('@/components/AACChatPanel', () => ({ default: () => <div data-testid="panel-aac-chat" /> }));
vi.mock('@/components/SchedulePanel', () => ({ default: () => <div data-testid="panel-schedule" /> }));
vi.mock('@/components/GamesPanel', () => ({ default: () => <div data-testid="panel-games" /> }));
vi.mock('@/components/MarketplacePanel', () => ({ default: () => <div data-testid="panel-marketplace" /> }));
vi.mock('@/components/marketplace/panels/PictureEditorPanel', () => ({ default: () => <div data-testid="panel-picture-editor" /> }));
vi.mock('@/components/marketplace/panels/MusicComposerPanel', () => ({ default: () => <div data-testid="panel-music-composer" /> }));
vi.mock('@/components/MathPanel', () => ({ default: () => <div data-testid="panel-math" /> }));
vi.mock('@/components/HistoryModal', () => ({ default: () => <div data-testid="panel-history" /> }));
vi.mock('@/components/SettingsModal', () => ({ default: () => <div data-testid="panel-settings" /> }));
vi.mock('@/components/AlertOverlay', () => ({ default: () => <div data-testid="panel-alert" /> }));
vi.mock('@/components/HeadTrackingOverlay', () => ({ default: () => <div data-testid="panel-head-tracking" /> }));
vi.mock('@/components/TrackingDebugOverlay', () => ({ default: () => <div data-testid="panel-tracking-debug" /> }));
vi.mock('@/components/TtsDebugOverlay', () => ({ default: () => <div data-testid="panel-tts-debug" /> }));
vi.mock('@/components/CameraInputOverlay', () => ({ default: () => <div data-testid="panel-camera-input" /> }));
vi.mock('@/components/GreetingBanner', () => ({ default: () => <div data-testid="panel-greeting" /> }));

beforeEach(() => {
  useAuthStore.setState({ profile: null, loaded: true, loading: false });
  useSettingsStore.setState({ theme: 'light', highContrast: false } as Partial<ReturnType<typeof useSettingsStore.getState>>);
});

const PANELS: SidePanelView[] = [
  'none',
  'categories',
  'category-detail',
  'ordering',
  'math',
  'caregiver',
  'ai-chat',
  'aac-chat',
  'schedule',
  'games',
  'marketplace',
  'picture-editor',
  'music-composer',
  'video-composer',
  'aac-designer',
];

describe('Keyboard always-on-screen invariant', () => {
  for (const panel of PANELS) {
    it(`keyboard renders when sidePanel = "${panel}"`, async () => {
      useUIStore.setState({ sidePanel: panel });
      const { findByTestId } = render(<PrismApp />);
      // findByTestId waits for the post-hydration render
      const kb = await findByTestId('aac-keyboard-mock');
      expect(kb).toBeInTheDocument();
      const shell = await findByTestId('keyboard-shell');
      expect(shell).toBeInTheDocument();
    });
  }
});
