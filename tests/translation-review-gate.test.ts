/**
 * Vocabulary gate for languages with no native-speaker review.
 *
 * Amharic, Swahili and Bengali ship machine translations that auditing showed
 * can produce nonsense — "I am thirsty" as meaningless text, "Stop" as the
 * intransitive "stand still", body parts naming the wrong limb. The audited
 * core + safety vocabulary is trustworthy; the low-frequency tail is not.
 *
 * This pins the behaviour in both directions, because BOTH failure modes are
 * real harm:
 *   - showing unverified strings can put wrong words in a user's mouth
 *   - hiding words removes things a user can say at all
 * Hence: restricted by default, caregiver-overridable, and never applied to
 * reviewed languages or to a caregiver's own custom phrases.
 */
import { describe, it, expect } from 'vitest';
import {
  UNREVIEWED_LANGUAGES,
  verifiedPhraseIds,
  isPhraseVisibleForLanguage,
} from '@/constants/translationReviewStatus';
import { DEFAULT_PHRASES } from '@/constants/phrases';

const anUnverifiedId = () => {
  const verified = verifiedPhraseIds();
  const hit = DEFAULT_PHRASES.find((p) => !verified.has(p.id));
  if (!hit) throw new Error('no unverified phrase exists — the gate is vacuous');
  return hit.id;
};

describe('translation review gate', () => {
  it('treats am/sw/bn as unreviewed', () => {
    expect([...UNREVIEWED_LANGUAGES].sort()).toEqual(['am', 'bn', 'sw']);
  });

  it('covers a real, non-trivial slice of the vocabulary', () => {
    const verified = verifiedPhraseIds();
    // Guards two ways of going vacuous: verifying nothing, or "verifying"
    // everything and silently gating nothing.
    expect(verified.size).toBeGreaterThan(400);
    expect(verified.size).toBeLessThan(DEFAULT_PHRASES.length);
  });

  it('shows everything for a reviewed language', () => {
    expect(isPhraseVisibleForLanguage(anUnverifiedId(), 'ro', false)).toBe(true);
    expect(isPhraseVisibleForLanguage(anUnverifiedId(), 'en', false)).toBe(true);
  });

  it('hides unverified phrases for an unreviewed language', () => {
    expect(isPhraseVisibleForLanguage(anUnverifiedId(), 'am', false)).toBe(false);
  });

  it('still shows verified phrases for an unreviewed language', () => {
    const verified = [...verifiedPhraseIds()][0];
    for (const lang of ['am', 'sw', 'bn']) {
      expect(isPhraseVisibleForLanguage(verified, lang, false)).toBe(true);
    }
  });

  it('lets a caregiver restore the full vocabulary', () => {
    // Hiding words from an AAC user is its own harm; this must stay reachable.
    for (const lang of ['am', 'sw', 'bn']) {
      expect(isPhraseVisibleForLanguage(anUnverifiedId(), lang, true)).toBe(true);
    }
  });

  it('applies to regional forms of an unreviewed language', () => {
    expect(isPhraseVisibleForLanguage(anUnverifiedId(), 'am-ET', false)).toBe(false);
    expect(isPhraseVisibleForLanguage(anUnverifiedId(), 'bn-BD', false)).toBe(false);
  });

  it('keeps the safety vocabulary reachable in every unreviewed language', () => {
    // The whole point: a user must always be able to report pain and refuse.
    // If a fix ever narrows the verified set, these must not fall out.
    const critical = ['help-stop', 'help-hurts', 'help-thirsty', 'help-i-am-sick',
      'help-need-help', 'hb-hurts'];
    const present = critical.filter((id) => DEFAULT_PHRASES.some((p) => p.id === id));
    expect(present.length, 'critical ids drifted — update this list').toBeGreaterThan(3);
    for (const id of present) {
      for (const lang of ['am', 'sw', 'bn']) {
        expect(
          isPhraseVisibleForLanguage(id, lang, false),
          `${id} must stay reachable in ${lang}`,
        ).toBe(true);
      }
    }
  });
});

/**
 * Store-level wiring.
 *
 * The tests above cover the pure predicate. This covers the thing actually
 * changed: that getPhrasesForCategory consults it, reading the CURRENT
 * language and caregiver override from the settings store. A correct
 * predicate that nothing calls would pass every test above and gate nothing —
 * a browser probe of the home screen could not tell the difference, because
 * the gated categories are not on the home screen.
 */
describe('gate is actually wired into the phrase lookup', () => {
  it('hides an unverified category phrase for am, and restores it on override', async () => {
    const { useSettingsStore } = await import('@/store/settingsStore');
    const { useCategoryStore } = await import('@/store/categoryStore');
    const { DEFAULT_PHRASES } = await import('@/constants/phrases');

    // 'actions' sits outside the audited core + safety set.
    const gated = DEFAULT_PHRASES.find(
      (p) => p.categoryId === 'actions' && !verifiedPhraseIds().has(p.id),
    );
    expect(gated, 'no gated phrase in actions — fixture drifted').toBeTruthy();

    const set = (language: string, showUnreviewedVocabulary: boolean) =>
      useSettingsStore.setState({
        ...useSettingsStore.getState(), language, showUnreviewedVocabulary,
      } as never);

    const idsFor = () => useCategoryStore.getState()
      .getPhrasesForCategory('actions').map((p) => p.id);

    set('ro', false);
    expect(idsFor(), 'reviewed language must be unaffected').toContain(gated!.id);

    set('am', false);
    expect(idsFor(), 'unverified phrase must be hidden for am').not.toContain(gated!.id);

    set('am', true);
    expect(idsFor(), 'caregiver override must restore it').toContain(gated!.id);

    set('en', false);
  });
});
