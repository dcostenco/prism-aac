/**
 * GreetingBanner — speech consent tests
 *
 * AAC rule: the device must not speak unless the user asked it to. The greeting
 * is device-initiated — nobody pressed Speak — so it follows the same
 * `speakSelectionFeedback` consent flag as the other auditory-feedback paths and
 * is silent by default.
 *
 * Two regressions are locked down here:
 *   1. The greeting used to speak whenever the master mute was off, ignoring the
 *      feedback flag entirely.
 *   2. It re-spoke on every remount. The banner remounts whenever a side panel
 *      closes or the board toggles, and `prism-greeting-dismissed` is written
 *      only by the ✕ button — so a user who never dismissed it heard the
 *      greeting again on every navigation back to the home screen.
 *
 * Visibility is deliberately NOT gated: a silent greeting must still render.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import GreetingBanner from '@/components/GreetingBanner';

// ── vi.hoisted ────────────────────────────────────────────────────────────────

const mocks = vi.hoisted(() => ({
  aacSpeak: vi.fn(),
  messageState: { soundEnabled: true },
  settingsState: {
    speechRate: 1,
    speechVolume: 1,
    speakSelectionFeedback: false,
    speakOnSentenceEnd: false,
  },
}));

vi.mock('@/services/aacSpeak', () => ({ aacSpeak: mocks.aacSpeak }));

vi.mock('@/store/messageStore', () => ({
  useMessageStore: { getState: () => mocks.messageState },
}));

vi.mock('@/store/settingsStore', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/store/settingsStore')>()),
  useSettingsStore: { getState: () => mocks.settingsState },
}));

const scheduleState = { tasks: [] as unknown[] };

vi.mock('@/store/scheduleStore', () => ({
  useScheduleStore: (sel?: (s: typeof scheduleState) => unknown) =>
    sel ? sel(scheduleState) : scheduleState,
}));

vi.mock('@/engine/useT', () => ({
  useT: () => ({ t: (k: string) => k, ttsCode: 'en-US', rtl: false, ready: true }),
}));

beforeEach(() => {
  sessionStorage.removeItem('prism-greeting-dismissed');
  sessionStorage.removeItem('prism-greeting-spoken');
  mocks.aacSpeak.mockClear();
  mocks.messageState.soundEnabled = true;
  mocks.settingsState.speakSelectionFeedback = false;
  mocks.settingsState.speakOnSentenceEnd = false;
});

// ── consent gate ──────────────────────────────────────────────────────────────

describe('GreetingBanner — speech consent', () => {
  it('stays silent by default, even with the master mute off', async () => {
    render(<GreetingBanner />);
    await waitFor(() => screen.getByRole('button', { name: /dismiss greeting/i }));
    expect(mocks.aacSpeak).not.toHaveBeenCalled();
  });

  it('still renders the banner while silent — silence must not cost the visual greeting', async () => {
    render(<GreetingBanner />);
    await waitFor(() => {
      expect(screen.getByText(/good_(morning|afternoon|evening|night)/i)).toBeInTheDocument();
    });
    expect(mocks.aacSpeak).not.toHaveBeenCalled();
  });

  it('speaks when the caregiver has opted into selection feedback', async () => {
    mocks.settingsState.speakSelectionFeedback = true;
    render(<GreetingBanner />);
    await waitFor(() => expect(mocks.aacSpeak).toHaveBeenCalledTimes(1));
    expect(mocks.aacSpeak.mock.calls[0][0]).toMatch(/good_(morning|afternoon|evening|night)/i);
  });

  it('respects the master mute even when feedback is opted in', async () => {
    mocks.settingsState.speakSelectionFeedback = true;
    mocks.messageState.soundEnabled = false;
    render(<GreetingBanner />);
    await waitFor(() => screen.getByRole('button', { name: /dismiss greeting/i }));
    expect(mocks.aacSpeak).not.toHaveBeenCalled();
  });
});

// ── remount ───────────────────────────────────────────────────────────────────

describe('GreetingBanner — speaks at most once per session', () => {
  it('does not re-speak when remounted without being dismissed', async () => {
    mocks.settingsState.speakSelectionFeedback = true;

    const first = render(<GreetingBanner />);
    await waitFor(() => expect(mocks.aacSpeak).toHaveBeenCalledTimes(1));
    first.unmount();

    // Simulates closing a side panel / toggling the board back to the home screen.
    // `prism-greeting-dismissed` is still unset, so the old code spoke again here.
    const second = render(<GreetingBanner />);
    await waitFor(() => screen.getByRole('button', { name: /dismiss greeting/i }));
    expect(mocks.aacSpeak).toHaveBeenCalledTimes(1);
    second.unmount();
  });

  it('still shows the banner on remount even though it no longer speaks', async () => {
    mocks.settingsState.speakSelectionFeedback = true;
    render(<GreetingBanner />).unmount();
    mocks.aacSpeak.mockClear();

    render(<GreetingBanner />);
    await waitFor(() => {
      expect(screen.getByText(/good_(morning|afternoon|evening|night)/i)).toBeInTheDocument();
    });
    expect(mocks.aacSpeak).not.toHaveBeenCalled();
  });
});
