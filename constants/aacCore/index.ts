/**
 * AAC core vocabulary — sourced from the single i18n matrix at
 * `i18n/translations.json` via keys `qc_1` ... `qc_28`. Reference list
 * is Universal Core 36 (Geist, Erickson et al., ATIA 2021); the matrix
 * holds per-locale translations curated from Cboard (GPLv3) plus a
 * native-translator pass for stub locales.
 *
 * Reads the matrix STATICALLY (synchronous import) so callers like the
 * prediction-bar fallback and unit tests don't need to await locale
 * loading. The matrix is the single source of truth — adding a locale
 * means editing `i18n/translations.json` and re-running
 * `scripts/build-i18n.mjs`. CI test enforces every shipped locale has
 * all 28 qc_* keys.
 */
import translations from '@/i18n/translations.json';
import { canonicalizeLang, type SupportedLanguage } from '@/engine/i18n';

/** Number of qc_* keys in the matrix. Adding a new entry means bumping
 *  this AND adding `qc_<N+1>` to the matrix for every locale. The
 *  strict CI test catches drift. */
export const QC_COUNT = 28;

const matrix = translations as Record<string, Record<string, string>>;

/**
 * Returns AAC core vocabulary for a language, ranked by communicative
 * priority (pronouns, requesters, verbs, modifiers, questions). Used as
 * the prediction-bar fallback when the engine can't fill all slots.
 */
export function getAacCoreFor(lang: SupportedLanguage): string[] {
  const canonical = canonicalizeLang(lang);
  const out: string[] = [];
  for (let i = 1; i <= QC_COUNT; i++) {
    const row = matrix[`qc_${i}`];
    if (!row) continue;
    // Prefer the requested language, fall back to canonical, then English.
    const v = row[canonical] ?? row[lang] ?? row.en;
    if (v) out.push(v);
  }
  return out;
}
