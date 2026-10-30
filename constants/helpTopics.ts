/**
 * In-app Help topics (owner decision 2026-10-30): caregiver-facing help that
 * works offline and in the user's language, opened from the Settings header.
 * Each topic's title and body are UI strings (help_<id>_title, help_<id>_body
 * in i18n/translations.json); bodies use one line per paragraph or step.
 *
 * `settingsSections` lists the Settings sections a topic names, by the
 * i18n key of their title (or the literal title where Settings has no key);
 * tests/settings-modal.test.tsx renders Settings and fails when one no longer
 * exists, so Help cannot drift from the app the way the web guide did.
 */
export interface HelpTopic {
  id: string;
  settingsSections?: readonly string[];
}

export const HELP_TOPICS: readonly HelpTopic[] = [
  { id: 'getting_started', settingsSections: ['Categories', 'grid_size', 'theme', 'voice', 'accessibility'] },
  { id: 'message' },
  { id: 'categories', settingsSections: ['Categories', 'grid_size'] },
  { id: 'predictions' },
  { id: 'languages', settingsSections: ['language'] },
  { id: 'access', settingsSections: ['accessibility'] },
  { id: 'alert' },
  { id: 'offline' },
  { id: 'privacy', settingsSections: ['accessibility'] },
];

export const helpTitleKey = (id: string) => `help_${id}_title`;
export const helpBodyKey = (id: string) => `help_${id}_body`;

export const SUPPORT_EMAIL = 'support@synalux.ai';
