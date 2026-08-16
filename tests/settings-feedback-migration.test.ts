/**
 * Upgrade continuity for auditory feedback.
 *
 * Message speech moved behind Speak and selection feedback became a separate
 * setting, off for new installs. An existing user who had audio during
 * composition — scanning and low-literacy users depend on hearing a selection
 * land — must not be upgraded into silence.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { useSettingsStore } from '@/store/settingsStore';

/** Mirrors the persisted shape the settings store migrates from. */
function runMigrate(persistedSettings: Record<string, unknown>, fromVersion: number) {
  const migrate = (useSettingsStore as unknown as {
    persist: { getOptions: () => { migrate?: (s: unknown, v: number) => unknown } };
  }).persist.getOptions().migrate;
  if (!migrate) throw new Error('settings store has no migrate function');
  return migrate(persistedSettings, fromVersion) as Record<string, unknown>;
}

describe('v21 — auditory feedback continuity', () => {
  beforeEach(() => { localStorage.clear(); });

  it('turns feedback ON for an existing user who had audio', () => {
    localStorage.setItem('prism-aac-message', JSON.stringify({
      state: { autoSpeak: true, soundEnabled: true }, version: 2,
    }));
    const out = runMigrate({ language: 'en' }, 19);
    expect(out.speakSelectionFeedback).toBe(true);
  });

  it('treats an absent message blob as the old default (audio on)', () => {
    const out = runMigrate({ language: 'en' }, 19);
    expect(out.speakSelectionFeedback).toBe(true);
  });

  it('leaves feedback OFF for a user who deliberately muted', () => {
    localStorage.setItem('prism-aac-message', JSON.stringify({
      state: { autoSpeak: true, soundEnabled: false }, version: 2,
    }));
    const out = runMigrate({ language: 'en' }, 19);
    expect(out.speakSelectionFeedback).toBe(false);
  });

  it('leaves feedback OFF for a user who turned auto-speak off', () => {
    localStorage.setItem('prism-aac-message', JSON.stringify({
      state: { autoSpeak: false, soundEnabled: true }, version: 2,
    }));
    const out = runMigrate({ language: 'en' }, 19);
    expect(out.speakSelectionFeedback).toBe(false);
  });

  it('never overrides a value the user has already set', () => {
    localStorage.setItem('prism-aac-message', JSON.stringify({
      state: { autoSpeak: true, soundEnabled: true }, version: 2,
    }));
    const out = runMigrate({ language: 'en', speakSelectionFeedback: false }, 19);
    expect(out.speakSelectionFeedback).toBe(false);
  });

  it('survives an unreadable message blob', () => {
    localStorage.setItem('prism-aac-message', 'not json{{');
    const out = runMigrate({ language: 'en' }, 19);
    expect(out.speakSelectionFeedback).toBe(true);
  });
});

/**
 * v22 — nobody is upgraded into an unasked-for broadcast.
 *
 * `speakOnSentenceEnd` once defaulted ON. The change that made the message
 * speak only on Speak removed its call site but never cleared the flag, so an
 * unknown number of installs still carry `true` while behaving as though it is
 * off. Re-attaching a call site to that flag — which is what the three-mode
 * Echo control does — would drop those users straight into Sentence mode and
 * start broadcasting their sentences again without them choosing it.
 *
 * This is the mirror of the upgrade-into-silence bug and strictly worse:
 * silence is private, an unasked-for utterance is not.
 */
describe('v22 — no upgrade into unasked-for sentence speech', () => {
  beforeEach(() => { localStorage.clear(); });

  it('clears a stale speakOnSentenceEnd=true carried from before the removal', () => {
    const out = runMigrate({ language: 'en', speakOnSentenceEnd: true }, 21);
    expect(out.speakOnSentenceEnd).toBe(false);
  });

  it('leaves speakOnSentenceEnd off when it was already off', () => {
    const out = runMigrate({ language: 'en', speakOnSentenceEnd: false }, 21);
    expect(out.speakOnSentenceEnd).toBe(false);
  });

  it('clears it for a much older install too, not just v21', () => {
    const out = runMigrate({ language: 'en', speakOnSentenceEnd: true }, 3);
    expect(out.speakOnSentenceEnd).toBe(false);
  });

  it('does not let the clear resurrect as Sentence mode via the mode helper', async () => {
    const { getSpeechFeedbackMode } = await import('@/store/settingsStore');
    const out = runMigrate({ language: 'en', speakOnSentenceEnd: true }, 21);
    expect(getSpeechFeedbackMode({
      speakSelectionFeedback: out.speakSelectionFeedback as boolean,
      speakOnSentenceEnd: out.speakOnSentenceEnd as boolean,
    })).not.toBe('sentence');
  });
});
