import { DEFAULT_PHRASES } from '@/constants/phrases';
import { getPhraseText } from '@/constants/phraseTranslations';
import { getAacCorePairs } from '@/constants/aacCore';
import type { SupportedLanguage } from '@/engine/i18n';

/**
 * Map a localized word back to the English it was translated from.
 *
 * Why this exists
 * ---------------
 * ARASAAC's pictogram search is only offered in some locales. It answers HTTP
 * 400 for `ja hi vi tl id am sw bn` — eight of the languages this app ships.
 * The pictogram images themselves are language-neutral; only the SEARCH TERM
 * is localized. So the way to get a picture in an unsupported locale is to
 * search in English and show the image.
 *
 * PhraseTile already does this: it is handed `englishPhrase` alongside the
 * localized text and searches with the English one. PredictionBar had no
 * equivalent, because a predicted word arrives as bare localized text with no
 * English source attached — so it searched the localized word in a locale the
 * API rejects, and every prediction tile rendered a blank white box. For a
 * symbol-reliant AAC user that is not cosmetic: it makes the prediction bar
 * unreadable in those eight languages.
 *
 * Recovering the English by reverse lookup is possible because predictions are
 * drawn from the same vocabulary the tiles use, so the localized surface form
 * is usually one this table already knows.
 *
 * Best-effort by design. A predicted word that is not vocabulary (an inflected
 * form, a user's own word) will not resolve, and the caller falls back to its
 * previous behaviour rather than showing nothing.
 */

const caches = new Map<string, Map<string, string>>();

/** Case-fold and trim. A no-op for unicased scripts like Ge'ez and Bengali. */
const norm = (s: string) => s.trim().toLowerCase();

function tableFor(lang: SupportedLanguage): Map<string, string> {
  const hit = caches.get(lang);
  if (hit) return hit;

  const table = new Map<string, string>();

  // AAC core first. The prediction bar pads empty slots from this list, not
  // from the phrase table, and the two disagree on wording — Amharic "Help" is
  // እርዳታ in the core matrix and ርዳኝ in the phrase table. Seeding core first
  // means the words most likely to appear as predictions resolve, and to the
  // shorter, more searchable term ("Help" rather than "I need help").
  for (const [localized, english] of getAacCorePairs(lang)) {
    const key = norm(localized);
    if (!key || key === norm(english)) continue;
    if (!table.has(key)) table.set(key, english);
  }

  for (const p of DEFAULT_PHRASES) {
    const localized = norm(getPhraseText(p.id, lang, p.text));
    if (!localized) continue;
    // An untranslated phrase falls back to its English text. Mapping that to
    // itself is harmless but pointless, and it would let an untranslated entry
    // shadow a genuine translation that happens to collide.
    if (localized === norm(p.text)) continue;
    // First writer wins: several English phrases can share one localized form
    // (Foot/Leg collapse to a single word in a number of languages). Any of
    // them retrieves a sensible picture, and stable iteration order keeps the
    // choice deterministic.
    if (!table.has(localized)) table.set(localized, p.text);
  }
  caches.set(lang, table);
  return table;
}

/** English source for a localized word, or null when it is not vocabulary. */
export function englishSourceFor(text: string, lang: SupportedLanguage): string | null {
  if (!text || lang === 'en') return null;
  return tableFor(lang).get(norm(text)) ?? null;
}
