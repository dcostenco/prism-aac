/**
 * @vitest-environment node
 *
 * In-app Help is written for caregivers in their own language. A machine
 * translation once came back romanized (Bulgarian in Latin letters) and
 * passed every completeness check, so this pins each non-Latin locale's Help
 * strings to its own script. On-screen labels the app shows in English
 * ("AI Autocorrect", "Synalux") stay Latin, so the bar is a share of the
 * letters, not all of them.
 */
import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';

const matrix: Record<string, Record<string, string>> = JSON.parse(
  fs.readFileSync(path.resolve(__dirname, '..', 'i18n', 'translations.json'), 'utf8'),
);

const SCRIPTS: Record<string, RegExp> = {
  bg: /\p{Script=Cyrillic}/u,
  ru: /\p{Script=Cyrillic}/u,
  uk: /\p{Script=Cyrillic}/u,
  ar: /\p{Script=Arabic}/u,
  he: /\p{Script=Hebrew}/u,
  hi: /\p{Script=Devanagari}/u,
  bn: /\p{Script=Bengali}/u,
  am: /\p{Script=Ethiopic}/u,
  ko: /\p{Script=Hangul}/u,
  ja: /[\p{Script=Hiragana}\p{Script=Katakana}\p{Script=Han}]/u,
  zh: /\p{Script=Han}/u,
  'zh-Hans': /\p{Script=Han}/u,
  'zh-Hant': /\p{Script=Han}/u,
  'zh-HK': /\p{Script=Han}/u,
};

// The lowest real share today is 0.33 (a short Chinese title naming an
// English label); a romanized string scores 0.
const MIN_NATIVE_SHARE = 0.25;

const HELP_KEYS = Object.keys(matrix).filter(
  key => key === 'user_guide' || (key.startsWith('help_') && key !== 'help_needs'),
);

describe('Help translations are in each language\'s own script', () => {
  it('covers the Help strings', () => {
    expect(HELP_KEYS.length).toBeGreaterThanOrEqual(25);
  });

  it.each(Object.keys(SCRIPTS))('%s', lang => {
    const script = SCRIPTS[lang];
    const romanized = HELP_KEYS.filter(key => {
      const letters = [...(matrix[key][lang] ?? '')].filter(ch => /\p{L}/u.test(ch));
      const native = letters.filter(ch => script.test(ch)).length;
      return letters.length === 0 || native / letters.length < MIN_NATIVE_SHARE;
    });
    expect(romanized).toEqual([]);
  });
});
