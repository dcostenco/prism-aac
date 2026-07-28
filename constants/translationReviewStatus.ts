import { DEFAULT_PHRASES } from '@/constants/phrases';
import type { SupportedLanguage } from '@/engine/i18n';

/**
 * Which languages ship machine-translated vocabulary that no native speaker
 * has checked, and which phrases in those languages have been verified.
 *
 * The problem
 * -----------
 * Amharic, Swahili and Bengali were added with ~4,500 machine-translated
 * strings and no native reviewer available. Auditing found real harm in the
 * safety vocabulary: "I am thirsty" rendering as meaningless text, "Stop"
 * using the intransitive "stand still" rather than the refusal sense, body
 * parts naming the wrong limb. Those are fixed. But 4,500 strings cannot all
 * be verified, and the ones that were not are the low-frequency tail.
 *
 * The trade-off, stated plainly
 * -----------------------------
 * Hiding vocabulary from an AAC user is ITSELF a harm — a word they cannot
 * reach is a thing they cannot say. So this is not obviously the safe choice;
 * it is a judgement that on balance, for a language where the machine output
 * has already been shown to produce nonsense, a smaller trustworthy
 * vocabulary beats a larger unreliable one.
 *
 * Because reasonable people differ, a caregiver can turn it off:
 * `showUnreviewedVocabulary` in settings restores the full set.
 *
 * Removing a language from UNREVIEWED_LANGUAGES is a deliberate act that
 * should follow an actual native-speaker pass, not a clean tooling run.
 * `npm run i18n:review-status` reports what is outstanding.
 */
export const UNREVIEWED_LANGUAGES: ReadonlySet<string> = new Set(['am', 'sw', 'bn']);

/**
 * Categories forming the AAC core.
 *
 * Matches the `my-core` vocabulary set. Core vocabulary is a well-established
 * AAC concept — a small high-frequency set carries the large majority of real
 * utterances — and it is the set this audit could actually verify end to end.
 */
const VERIFIED_CATEGORIES: ReadonlySet<string> = new Set([
  'core-pronouns', 'core-verbs', 'core-descriptors', 'core-little-words',
  'help-needs', 'quick-talk', 'feelings', 'questions',
]);

/**
 * Phrase-id prefixes for the safety vocabulary — pain, body, help, feelings.
 * Verified because these are the strings where being wrong causes harm rather
 * than confusion, so they were audited whether or not they sit in a core
 * category.
 */
const VERIFIED_ID_PREFIXES = ['help-', 'hb-', 'hbp-', 'fe-'];

let cache: Set<string> | null = null;

/** Phrase ids audited by the multi-signal pass (back-translation + ASR + Wiktionary). */
export function verifiedPhraseIds(): ReadonlySet<string> {
  if (cache) return cache;
  cache = new Set(
    DEFAULT_PHRASES
      .filter((p) => VERIFIED_CATEGORIES.has(p.categoryId)
        || VERIFIED_ID_PREFIXES.some((pre) => p.id.startsWith(pre)))
      .map((p) => p.id),
  );
  return cache;
}

/**
 * Should this phrase be shown?
 *
 * Everything is shown for reviewed languages, for English, and whenever the
 * caregiver has opted into the full set. Custom phrases a caregiver authored
 * are never filtered — those are their own words, not machine output.
 */
export function isPhraseVisibleForLanguage(
  phraseId: string,
  lang: SupportedLanguage | string,
  showUnreviewed: boolean,
): boolean {
  if (showUnreviewed) return true;
  const base = String(lang).split('-')[0];
  if (!UNREVIEWED_LANGUAGES.has(base)) return true;
  return verifiedPhraseIds().has(phraseId);
}
