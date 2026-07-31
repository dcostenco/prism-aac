/**
 * AAC core vocabulary keyed by stable communication concepts.
 *
 * Do not rebuild this list by zipping locale arrays. A missing item in one
 * locale shifts every later meaning, which can make a child select one word
 * and see or hear another. Phrase translations are keyed by the same IDs used
 * by the vocabulary tiles, so the selected concept remains invariant.
 */
import {
  getPhraseText,
  hasPhraseTranslation,
} from '@/constants/phraseTranslations';
import { DEFAULT_PHRASES } from '@/constants/phrases';
import type { SupportedLanguage } from '@/engine/i18n';

interface CoreConcept {
  phraseId: string;
  english: string;
}

/** Ranked Universal Core concepts derived from the canonical phrase records. */
export const AAC_CORE_CONCEPTS: readonly CoreConcept[] = Object.freeze(
  DEFAULT_PHRASES
    .filter((phrase) => phrase.aacCoreRank !== undefined)
    .sort((a, b) => (a.aacCoreRank ?? 0) - (b.aacCoreRank ?? 0))
    .map(({ id, text }) => Object.freeze({ phraseId: id, english: text })),
);

/** Retained for callers that use the historical quick-card count. */
export const QC_COUNT = AAC_CORE_CONCEPTS.length;

/**
 * Localized/English pairs for pictogram lookup and language filtering.
 * A missing translation is omitted instead of being mislabeled as localized.
 */
export function getAacCorePairs(lang: SupportedLanguage): Array<[string, string]> {
  return AAC_CORE_CONCEPTS.flatMap(({ phraseId, english }) => {
    if (!hasPhraseTranslation(phraseId, lang)) return [];
    return [[getPhraseText(phraseId, lang, english), english] as [string, string]];
  });
}

/**
 * Returns AAC core words in communicative-priority order. Missing locale text
 * falls back to the correct English concept without changing later slots.
 */
export function getAacCoreFor(lang: SupportedLanguage): string[] {
  return AAC_CORE_CONCEPTS.map(({ phraseId, english }) =>
    getPhraseText(phraseId, lang, english),
  );
}
