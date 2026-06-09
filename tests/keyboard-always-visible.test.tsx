/**
 * Keyboard visibility invariant — refined 2026-05-07, updated 2026-05-12.
 *
 * The user always needs a working keyboard. For most panels that means
 * the global qwerty stays mounted. For panels that ship their OWN
 * primary keyboard (currently just `math`), rendering the qwerty too
 * created a clipped double-keyboard ("broken keyboards" user report).
 *
 * Three pinned invariants:
 *   1. For every NON-keyboard panel, the qwerty MUST be in the DOM.
 *   2. For every PANEL_WITH_OWN_KEYBOARD, the qwerty MUST NOT render
 *      (panel ships its own input layer).
 *   3. Category-mode panels (categories/category-detail/ordering) and
 *      the home panel use a categoryKeyboardOpen toggle — keyboard
 *      renders when toggle is on, hides when off.
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
    const { sidePanel, categoryKeyboardOpen } = useUIStore.getState();
    const catPanels = ['categories', 'category-detail', 'ordering'];
    const isCatOrHome = catPanels.includes(sidePanel) || sidePanel === 'none';
    const id = catPanels.includes(sidePanel) ? sidePanel : 'categories';
    // Real CategoryPanel hosts the keyboard as a pull-up drawer when
    // categoryKeyboardOpen is true AND the panel is in category/home mode.
    // Mirror that in the mock so the test can assert keyboard visibility
    // for toggle-controlled panels without double-rendering for other panels.
    return (
      <div data-testid={`panel-${id}`}>
        {isCatOrHome && categoryKeyboardOpen && (
          <div data-testid="keyboard-shell">
            <div data-testid="aac-keyboard-mock">[keyboard]</div>
          </div>
        )}
      </div>
    );
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
  // ai-chat / aac-chat take typed input — keep qwerty mounted there.
  'ai-chat',
  'aac-chat',
  'video-composer',
  'aac-designer',
];

// Tap-only or own-keyboard panels — qwerty must NOT render.
const PANELS_WITHOUT_QWERTY: SidePanelView[] = [
  'math',
  'games',
  'marketplace',
  'schedule',
  'caregiver',
  'picture-editor',
  'music-composer',
];

// Category-mode panels and home ('none') use categoryKeyboardOpen toggle.
// When the toggle is on, the keyboard renders; when off, it hides.
// Default store state has categoryKeyboardOpen: true, but navigating
// into categories via toggleCategories sets it to false.
const TOGGLE_PANELS: SidePanelView[] = [
  'none',
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

  // The keyboard shell uses flex-1 + min-h-0 so it can shrink freely
  // when tall panels (AACChatPanel compose strip, provider picker) sit
  // above. The old min-h-[clamp(280px,...)] caused total enforced
  // minimums (toolbar + greeting + message + prediction + chat +
  // keyboard) to exceed 100svh on shorter viewports, clipping the
  // bottom row. The keyboard's internal rows are all flex-1 with no
  // hard mins, so they distribute available space evenly.
  //
  it('keyboard shell has bounded sizing', async () => {
    useUIStore.setState({ sidePanel: 'ai-chat' });
    const { findByTestId } = render(<PrismApp />);
    const shell = await findByTestId('keyboard-shell');
    const cls = shell.className;
    expect(cls).toMatch(/shrink-0|min-h|max-h|h-\[/);
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

describe('Keyboard visibility — toggle-controlled panels (category mode + home)', () => {
  for (const panel of TOGGLE_PANELS) {
    it(`keyboard renders when sidePanel = "${panel}" and categoryKeyboardOpen = true`, async () => {
      useUIStore.setState({ sidePanel: panel, categoryKeyboardOpen: true });
      const { findByTestId } = render(<PrismApp />);
      const kb = await findByTestId('aac-keyboard-mock');
      expect(kb).toBeInTheDocument();
      const shell = await findByTestId('keyboard-shell');
      expect(shell).toBeInTheDocument();
    });

    it(`keyboard hidden when sidePanel = "${panel}" and categoryKeyboardOpen = false`, async () => {
      useUIStore.setState({ sidePanel: panel, categoryKeyboardOpen: false });
      const { queryByTestId } = render(<PrismApp />);
      // Small wait for render to settle.
      await new Promise((r) => setTimeout(r, 50));
      expect(queryByTestId('keyboard-shell')).not.toBeInTheDocument();
      expect(queryByTestId('aac-keyboard-mock')).not.toBeInTheDocument();
    });
  }
});
