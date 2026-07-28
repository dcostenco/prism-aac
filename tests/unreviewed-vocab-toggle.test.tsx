/**
 * The vocabulary gate must be reversible from the UI.
 *
 * `showUnreviewedVocabulary` shipped in the store, in the gate predicate and
 * in unit tests — but in no component. 877 phrases were hidden in am/sw/bn
 * with no in-app way to get them back, while the source comment claimed "a
 * caregiver can turn it off ... in settings".
 *
 * Every existing test passed, because they all called the predicate with
 * `showUnreviewed: true` directly instead of asking whether anything in the
 * product could ever pass that argument.
 *
 * Hiding words from an AAC user is a real harm, accepted here only because it
 * is reversible. If the control disappears, the trade-off silently becomes
 * "these words no longer exist" — so this is a safety test, not a UI test.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, cleanup, fireEvent, act } from '@testing-library/react';
import SettingsModal from '@/components/SettingsModal';
import { useSettingsStore } from '@/store/settingsStore';
import { useUIStore } from '@/store/uiStore';
import { UNREVIEWED_LANGUAGES } from '@/constants/translationReviewStatus';

// jsdom has no canvas/media; SettingsModal pulls in calibration + local-model
// panels that touch both. None of that is under test here.
vi.mock('@/components/HeadTrackingSettings', () => ({ default: () => null }));
vi.mock('@/components/LocalAISettings', () => ({ default: () => null }));
vi.mock('@/components/CaregiverContactsSettings', () => ({ default: () => null }));
vi.mock('@/components/InputModesSettings', () => ({ default: () => null }));

const openSettingsIn = async (language: string) => {
  useSettingsStore.setState({ language, showUnreviewedVocabulary: false } as never);
  useUIStore.setState({ showSettings: true } as never);
  await act(async () => { render(<SettingsModal />); });

  // Settings sections are collapsed and render no children until opened, so a
  // caregiver has to expand Language first — do the same here rather than
  // reaching past the UI. Matched on the 🌐 icon because the section title is
  // itself translated into the language under test.
  const header = screen.getAllByRole('button')
    .find((b) => b.textContent?.includes('🌐'));
  expect(header, 'no Language section in settings').toBeTruthy();
  await act(async () => { fireEvent.click(header!); });
};

const toggle = () => screen.queryByLabelText('Show unreviewed words');

describe('unreviewed-vocabulary control', () => {
  beforeEach(() => {
    cleanup();
    if (typeof window !== 'undefined') window.localStorage.clear();
  });

  it('is reachable in every language the gate restricts', async () => {
    for (const lang of UNREVIEWED_LANGUAGES) {
      cleanup();
      await openSettingsIn(lang);
      expect(
        toggle(),
        `no way to restore hidden vocabulary in "${lang}"`,
      ).toBeTruthy();
    }
  });

  it('actually flips the stored setting', async () => {
    await openSettingsIn('am');
    expect(useSettingsStore.getState().showUnreviewedVocabulary).toBe(false);

    await act(async () => { fireEvent.click(toggle()!); });

    // A rendered control wired to nothing would still pass the test above.
    expect(useSettingsStore.getState().showUnreviewedVocabulary).toBe(true);
  });

  it('is hidden for a reviewed language, where it would do nothing', async () => {
    await openSettingsIn('ro');
    expect(toggle()).toBeNull();
  });
});
