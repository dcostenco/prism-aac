/**
 * Keyboard visibility invariant — refined 2026-05-07.
 *
 * The user always needs a working keyboard. For most panels that means
 * the global qwerty stays mounted. For panels that ship their OWN
 * primary keyboard (currently just `math`), rendering the qwerty too
 * created a clipped double-keyboard ("broken keyboards" user report).
 *
 * Two pinned invariants:
 *   1. For every NON-keyboard panel, the qwerty MUST be in the DOM.
 *   2. For every PANEL_WITH_OWN_KEYBOARD, the qwerty MUST NOT render
 *      (panel ships its own input layer).
 *
 * If a future change either (a) starts hiding the qwerty on a panel
 * that doesn't have its own keys, or (b) starts double-rendering for
 * a math-shaped panel, this suite breaks loudly.
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
vi.mock('@/components/CategoryPanel', () => ({
  default: () => {
    const { sidePanel } = useUIStore.getState();
    const catPanels = ['categories', 'category-detail', 'ordering'];
    const id = catPanels.includes(sidePanel) ? sidePanel : 'categories';
    return <div data-testid={`panel-${id}`} />;
  },
}));
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

const PANELS_WITH_QWERTY: SidePanelView[] = [
  'none',
  // ai-chat / aac-chat take typed input — keep qwerty mounted there.
  'ai-chat',
  'aac-chat',
  'video-composer',
  'aac-designer',
];

// Tap-only or own-keyboard panels — qwerty must NOT render.
// categories/category-detail/ordering added in commit 64b5ee3 (Image #28):
// big pictogram cards are tap-only, keyboard eats ~40% of screen for nothing.
const PANELS_WITHOUT_QWERTY: SidePanelView[] = [
  'math',
  'games',
  'marketplace',
  'schedule',
  'caregiver',
  'picture-editor',
  'music-composer',
  'categories',
  'category-detail',
  'ordering',
];

describe('Keyboard visibility — qwerty rendered for panels without own input', () => {
  for (const panel of PANELS_WITH_QWERTY) {
    it(`keyboard renders when sidePanel = "${panel}"`, async () => {
      useUIStore.setState({ sidePanel: panel });
      const { findByTestId } = render(<PrismApp />);
      const kb = await findByTestId('aac-keyboard-mock');
      expect(kb).toBeInTheDocument();
      const shell = await findByTestId('keyboard-shell');
      expect(shell).toBeInTheDocument();
    });
  }

  // Pin the min-height floor on the keyboard shell. The qwerty has 4
  // rows (3 letter rows + 1 utility row with mode/space/punctuation/
  // Speak); each row needs ≥ ~55px to be tappable. With a 180px floor
  // (the previous value) and a flex-[3] panel above, the bottom row
  // got clipped — Vorbește/Speak peeked at the viewport edge and the
  // mode-toggle / space / punctuation buttons ran off-screen
  // (May 2026 user-reported "keyboard is wrong" with screenshot of
  // ai-chat panel + clipped 4th row).
  //
  // Asserting the className floor (rather than a computed pixel
  // height) because jsdom doesn't run layout. A future change that
  // drops the min-h or lowers it below a 4-row-safe value will fail
  // this assertion.
  it('keyboard shell has a min-height floor large enough for 4 rows', async () => {
    useUIStore.setState({ sidePanel: 'ai-chat' });
    const { findByTestId } = render(<PrismApp />);
    const shell = await findByTestId('keyboard-shell');
    const cls = shell.className;
    // The floor must include a min-h utility AND its lower bound must
    // be ≥ 260px (4 rows × 60px + padding/gap headroom). Smaller
    // values produce visually cramped rows even when technically above
    // the 44px tap-target minimum (May 2026 #37/#38 screenshots).
    const m = cls.match(/min-h-\[(?:clamp\(\s*)?(\d+)px/);
    expect(m, `expected keyboard-shell min-h-[<floor>] in className "${cls}"`).not.toBeNull();
    const floorPx = m ? Number(m[1]) : 0;
    expect(floorPx).toBeGreaterThanOrEqual(260);
  });
});

describe('Keyboard visibility — qwerty hidden for panels with their own keyboard', () => {
  for (const panel of PANELS_WITHOUT_QWERTY) {
    it(`qwerty does NOT render when sidePanel = "${panel}" (panel owns input)`, async () => {
      useUIStore.setState({ sidePanel: panel });
      const { queryByTestId, findByTestId } = render(<PrismApp />);
      // Wait for the panel itself to mount before asserting absence.
      await findByTestId(`panel-${panel}`);
      expect(queryByTestId('keyboard-shell')).not.toBeInTheDocument();
      expect(queryByTestId('aac-keyboard-mock')).not.toBeInTheDocument();
    });
  }
});
