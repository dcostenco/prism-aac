import { SupportedLanguage } from '@/engine/i18n';
import { DEFAULT_PHRASES } from '@/constants/phrases';
import { getPhraseText } from '@/constants/phraseTranslations';
import { getClinicalDict } from '@/constants/clinicalVocabulary';
import { applyGrammarRules } from '@/constants/languageRules';
import { AAC_VOCABULARY } from '@/constants/languageVocabulary';
import { OFFLINE_DICT_1 } from '@/constants/offlineDictionary';
import { AAC_FIRST_PERSON_MARKER } from '@/constants/translationMarkers';

// Display names sent to translateAI as system-prompt context. Includes
// regional Chinese variants so the AI translator picks the correct form.
const LANG_NAMES: Record<string, string> = {
  en: 'English', es: 'Spanish', fr: 'French', pt: 'Portuguese',
  ro: 'Romanian', uk: 'Ukrainian', ru: 'Russian', de: 'German',
  ja: 'Japanese', ko: 'Korean',
  zh: 'Chinese (Simplified, Mandarin)',
  'zh-Hans': 'Chinese (Simplified, Mandarin)',
  'zh-Hant': 'Chinese (Traditional, Taiwanese Mandarin)',
  'zh-HK': 'Cantonese (Traditional script, Hong Kong)',
  ar: 'Arabic',
  // Latin-script European langs that need an explicit name so the
  // translator's system prompt says "translate to Italian" instead of
  // "translate to it" (May 2026: RU→IT regression where the AI saw
  // "to it" and produced English-Italian-Russian mush).
  it: 'Italian', nl: 'Dutch', pl: 'Polish', tr: 'Turkish',
  sv: 'Swedish', no: 'Norwegian', da: 'Danish', fi: 'Finnish',
  cs: 'Czech', el: 'Greek', hu: 'Hungarian', he: 'Hebrew',
  hi: 'Hindi', vi: 'Vietnamese', th: 'Thai', id: 'Indonesian',
  tl: 'Tagalog', bg: 'Bulgarian',
};

const MAX_CACHE = 500;
const cache = new Map<string, string>();
const EXPLICIT_FIRST_PERSON_CONCEPT = DEFAULT_PHRASES.find((phrase) => phrase.id === 'cw-i');
const ATTACHED_GRAMMAR_SCRIPT =
  /[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}\p{Script=Hangul}]/u;

function trimCache() {
  while (cache.size > MAX_CACHE) {
    const oldest = cache.keys().next().value;
    if (oldest !== undefined) cache.delete(oldest);
    else break;
  }
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function standaloneConceptPattern(concept: string): RegExp {
  const escaped = concept
    .trim()
    .split(/\s+/u)
    .map(escapeRegExp)
    .join('\\s+');
  return new RegExp(`(^|[^\\p{L}\\p{N}])(${escaped})(?=$|[^\\p{L}\\p{N}])`, 'iu');
}

function containsConcept(text: string, concept: string): boolean {
  const normalizedText = text.normalize('NFKC');
  const normalizedConcept = concept.normalize('NFKC').trim();
  if (!normalizedConcept) return false;
  if (ATTACHED_GRAMMAR_SCRIPT.test(normalizedConcept)) {
    return normalizedText.toLocaleLowerCase().includes(normalizedConcept.toLocaleLowerCase());
  }
  return standaloneConceptPattern(normalizedConcept).test(normalizedText);
}

function canonicalizeConcept(text: string, concept: string): string {
  const normalizedConcept = concept.normalize('NFKC').trim();
  if (ATTACHED_GRAMMAR_SCRIPT.test(normalizedConcept)) {
    return text.replace(new RegExp(escapeRegExp(normalizedConcept), 'iu'), normalizedConcept);
  }
  return text.replace(
    standaloneConceptPattern(normalizedConcept),
    (_match, prefix: string) => `${prefix}${normalizedConcept}`,
  );
}

interface ExplicitFirstPersonContext {
  sourceConcept: string;
  targetConcept: string;
  sourceIsLeading: boolean;
  targetUsesAttachedGrammar: boolean;
}

function explicitFirstPersonContext(
  source: string,
  fromLang: SupportedLanguage,
  toLang: SupportedLanguage,
): ExplicitFirstPersonContext | null {
  if (!EXPLICIT_FIRST_PERSON_CONCEPT) return null;

  const sourceConcept = getPhraseText(
    EXPLICIT_FIRST_PERSON_CONCEPT.id,
    fromLang,
    EXPLICIT_FIRST_PERSON_CONCEPT.text,
  );
  if (!containsConcept(source, sourceConcept)) return null;

  const targetConcept = getPhraseText(
    EXPLICIT_FIRST_PERSON_CONCEPT.id,
    toLang,
    EXPLICIT_FIRST_PERSON_CONCEPT.text,
  );
  const trimmedSource = source.normalize('NFKC').trimStart();
  const sourceIsLeading = ATTACHED_GRAMMAR_SCRIPT.test(sourceConcept)
    ? trimmedSource.toLocaleLowerCase().startsWith(sourceConcept.toLocaleLowerCase())
    : new RegExp(
      `^${escapeRegExp(sourceConcept)}(?=$|[^\\p{L}\\p{N}])`,
      'iu',
    ).test(trimmedSource);

  return {
    sourceConcept,
    targetConcept,
    sourceIsLeading,
    targetUsesAttachedGrammar: ATTACHED_GRAMMAR_SCRIPT.test(targetConcept),
  };
}

function lowercaseSentenceInitial(text: string, lang: SupportedLanguage): string {
  return text.replace(/\p{L}/u, (character) => character.toLocaleLowerCase(lang));
}

function markExplicitFirstPerson(source: string, sourceConcept: string): string {
  if (ATTACHED_GRAMMAR_SCRIPT.test(sourceConcept)) {
    return source.replace(
      new RegExp(escapeRegExp(sourceConcept), 'iu'),
      AAC_FIRST_PERSON_MARKER,
    );
  }
  return source.replace(
    standaloneConceptPattern(sourceConcept),
    (_match, prefix: string) => `${prefix}${AAC_FIRST_PERSON_MARKER}`,
  );
}

function restoreMarkedFirstPerson(candidate: string, targetConcept: string): string | null {
  const markerCount = candidate.split(AAC_FIRST_PERSON_MARKER).length - 1;
  if (markerCount !== 1) return null;
  return candidate.replace(AAC_FIRST_PERSON_MARKER, targetConcept);
}

/**
 * AAC selections express the speaker's intent, not merely optional grammar.
 * A translation model may naturalize pro-drop languages by erasing an explicit
 * first-person pronoun. Keep the canonical concept from phrase data in every
 * target language and normalize its spelling/case before display or TTS.
 *
 * The rule only applies when the source pronoun actually CARRIES that intent.
 * We can only observe the composed text, not which tiles produced it, so the
 * one honest signal is position: a telegraphic AAC utterance leads with the
 * selected concept ("I looking", "I want more"). A pronoun sitting mid-sentence
 * inside ordinary prose ("How are you? Now I can") is obligatory grammar in a
 * non-pro-drop source language like English — the user could not have left it
 * out, so its presence says nothing about emphasis, and forcing it into the
 * target overrides the translator with a worse sentence.
 *
 * Measured 2026-08-15 against gemini-3.6-flash, en->ro, "How are you? Now I can":
 *   model output                    "Ce mai faci? Acum pot"      (idiomatic)
 *   after forcing the pronoun       "Ce mai faci? Acum eu pot"   (shipped, marked/wrong)
 * The offline dictionary independently produces "Ce mai faci? Acum pot" too, so
 * the forcing step was making a correct translation worse.
 */
function preserveExplicitFirstPerson(
  source: string,
  candidate: string,
  fromLang: SupportedLanguage,
  toLang: SupportedLanguage,
): string | null {
  const context = explicitFirstPersonContext(source, fromLang, toLang);
  if (!context) return candidate;
  // Mid-sentence pronoun — grammar, not selection. Trust the translator.
  if (!context.sourceIsLeading) return candidate;
  if (containsConcept(candidate, context.targetConcept)) {
    return canonicalizeConcept(candidate, context.targetConcept);
  }
  if (candidate.trim() && !context.targetUsesAttachedGrammar) {
    return `${context.targetConcept} ${lowercaseSentenceInitial(candidate, toLang)}`.trim();
  }
  return null;
}

type TranslateAIFunction = (
  text: string,
  fromLang: string,
  toLang: string,
  onChunk?: (delta: string) => void,
  signal?: AbortSignal,
) => Promise<string>;

function cleanTranslation(value: string): string {
  return value.trim().replace(/^["']|["']$/g, '');
}

async function requestPreservedTranslation(
  translateAI: TranslateAIFunction,
  text: string,
  fromLang: SupportedLanguage,
  toLang: SupportedLanguage,
  signal?: AbortSignal,
): Promise<string> {
  const fromName = LANG_NAMES[fromLang] ?? fromLang;
  const toName = LANG_NAMES[toLang] ?? toLang;
  const initial = cleanTranslation(
    await translateAI(text, fromName, toName, undefined, signal),
  );
  const preserved = preserveExplicitFirstPerson(text, initial, fromLang, toLang);
  if (preserved !== null) return preserved;

  const context = explicitFirstPersonContext(text, fromLang, toLang);
  if (!context) return initial;

  const markedSource = markExplicitFirstPerson(text, context.sourceConcept);
  const markedResult = cleanTranslation(
    await translateAI(markedSource, fromName, toName, undefined, signal),
  );
  const restored = restoreMarkedFirstPerson(markedResult, context.targetConcept);
  if (restored === null) {
    // Reject rather than serve a translation that dropped an explicitly
    // SELECTED first-person concept. Reaching here now means the user led the
    // utterance with the "I" tile and the target attaches grammar to the
    // pronoun (ja 私は, ko 나는), so we cannot repair it by prefixing. Falling
    // back to the offline dictionary is the lesser harm; showing a sentence
    // that silently deletes the speaker from their own statement is not.
    //
    // This path is deliberately narrow. Before 2026-08-15 it also caught every
    // ordinary mid-sentence "I", which is where it did damage — see
    // preserveExplicitFirstPerson above.
    console.warn(
      '[translate] AI omitted an immutable AAC first-person marker; rejecting:',
      markedResult.slice(0, 60),
    );
    return '';
  }
  return canonicalizeConcept(restored, context.targetConcept);
}

type WordDict = Map<string, string>;
const dictCache = new Map<string, WordDict>();
const MAX_DICT_CACHE = 20;

function getWordDict(fromLang: SupportedLanguage, toLang: SupportedLanguage): WordDict {
  const key = `${fromLang}:${toLang}`;
  if (dictCache.has(key)) return dictCache.get(key)!;

  const dict: WordDict = new Map();

  for (const phrase of DEFAULT_PHRASES) {
    const fromRaw = getPhraseText(phrase.id, fromLang, phrase.text);
    const toRaw = getPhraseText(phrase.id, toLang, phrase.text);
    // Skip when getPhraseText returned the English fallback for a
    // non-English target — that means the target language has no real
    // translation for this phrase and we'd otherwise pollute the dict
    // with English words (May 2026 RU→IT bug: "хочу" → "Want" because
    // Italian entries were missing in T and "Want" was the fallback).
    if (toLang !== 'en' && toRaw === phrase.text) continue;
    if (fromLang !== 'en' && fromRaw === phrase.text) continue;
    const fromText = fromRaw.toLowerCase();
    const toText = toRaw;
    dict.set(fromText, toText);

    const fromWords = fromText.split(/\s+/);
    const toWords = toText.split(/\s+/);
    if (fromWords.length === 1 && toWords.length === 1) {
      dict.set(fromWords[0], toWords[0]);
    }
  }

  const fromVocab = AAC_VOCABULARY[fromLang] ?? [];
  const toVocab = AAC_VOCABULARY[toLang] ?? [];
  const minLen = Math.min(fromVocab.length, toVocab.length);
  for (let i = 0; i < minLen; i++) {
    const fw = fromVocab[i].toLowerCase();
    if (!dict.has(fw)) dict.set(fw, toVocab[i]);
  }

  const fromDict1 = OFFLINE_DICT_1[fromLang] ?? [];
  const toDict1 = OFFLINE_DICT_1[toLang] ?? [];
  const dict1Len = Math.min(fromDict1.length, toDict1.length);
  for (let i = 0; i < dict1Len; i++) {
    const fw = fromDict1[i].toLowerCase();
    if (!dict.has(fw)) dict.set(fw, toDict1[i]);
  }

  // Dictionary-based clinical vocab lookup — no positional misalignment.
  // getClinicalDict uses English as the pivot: each VocabEntry maps one
  // concept across all languages, so ro["vreau să"] → ru["хочу"] is exact.
  const clinicalDict = getClinicalDict(fromLang, toLang);
  for (const [from, to] of clinicalDict) {
    if (!dict.has(from)) dict.set(from, to);
  }

  if (dictCache.size >= MAX_DICT_CACHE) {
    const oldest = dictCache.keys().next().value;
    if (oldest !== undefined) dictCache.delete(oldest);
  }
  dictCache.set(key, dict);
  return dict;
}

function offlineTranslate(text: string, fromLang: SupportedLanguage, toLang: SupportedLanguage): string {
  const dict = getWordDict(fromLang, toLang);
  const lower = text.trim().toLowerCase();

  const exact = dict.get(lower);
  if (exact) return exact;

  const words = lower.split(/\s+/);
  const result: string[] = [];
  let i = 0;

  while (i < words.length) {
    let matched = false;
    for (let len = Math.min(words.length - i, 5); len > 1; len--) {
      const phrase = words.slice(i, i + len).join(' ');
      const lookup = dict.get(phrase);
      if (lookup) {
        result.push(lookup);
        i += len;
        matched = true;
        break;
      }
    }
    if (!matched) {
      const lookup = dict.get(words[i]);
      // Skip empty-string translations (e.g. ru/uk infinitive "to" → '')
      const token = lookup ?? text.trim().split(/\s+/)[i] ?? words[i];
      if (token !== '') result.push(token);
      i++;
    }
  }

  const joined = result.join(' ').trim();

  return applyGrammarRules(joined, toLang);
}

export function translateTextSync(
  text: string,
  fromLang: SupportedLanguage,
  toLang: SupportedLanguage,
): string {
  if (fromLang === toLang || !text.trim()) return text;

  const cacheKey = `${fromLang}:${toLang}:${text.trim().toLowerCase()}`;
  if (cache.has(cacheKey)) return cache.get(cacheKey)!;

  const result = offlineTranslate(text, fromLang, toLang);
  if (result.toLowerCase() !== text.trim().toLowerCase()) {
    cache.set(cacheKey, result);
    trimCache();
  }
  return result;
}

/**
 * The single in-flight refine. There is at most one, and it is owned by its
 * PHRASE rather than by whichever call site asked most recently.
 *
 * Three call sites request refines of the same phrase — MessageBar's
 * translation effect (display), MessageBar's composition timer, and the
 * keyboard's Speak / sentence-end handlers (speech). The previous design kept
 * a bare timer + controller and cancelled unconditionally on entry, so the
 * second caller killed the first caller's request even when both wanted the
 * identical phrase. Observed on "I want water." (en->ro): the keyboard
 * scheduled a forced refine on the keypress, MessageBar's effect scheduled the
 * same phrase a tick later and cancelled it, and the user saw "eu vreau apă."
 * while hearing the offline dictionary's "Vreau water.".
 *
 * `lastAiText` could not prevent that: it was assigned inside the 200ms timer,
 * long after both callers had passed the dedupe check. `pending.phrase` is
 * assigned synchronously at schedule time, which is the whole point.
 */
interface PendingRefine {
  phrase: string;
  timer: ReturnType<typeof setTimeout>;
  controller: AbortController;
  /** Display-side callbacks; every joiner gets the result. */
  subscribers: Array<(translated: string) => void>;
  /** Speech-side waiters; resolved with the refinement or null on failure. */
  waiters: Array<(v: string | null) => void>;
}

let pending: PendingRefine | null = null;

/**
 * Phrases whose refinement already landed, keyed `from:to:phrase`.
 *
 * `cache` alone cannot answer "is this the good translation or the offline
 * one?" — translateTextSync writes offline results into the same map. Without
 * this set, any caller arriving AFTER a refine completed found `pending` null
 * and scheduled a fresh request for a phrase that was already translated.
 * Measured on "I want water.": two identical cloud calls two seconds apart,
 * the second from the composition timer at COMPOSITION_SILENCE_MS. Repeated
 * Play presses on one phrase had the same effect.
 */
const refinedKeys = new Set<string>();

/**
 * Bounded like `cache`. A Set preserves insertion order, so evicting from the
 * front drops the least-recently-added phrase. Left unbounded this grows for
 * the life of the tab — an AAC device is left running all day, and the users
 * who need it most are on the oldest hardware.
 */
function trimRefinedKeys(): void {
  while (refinedKeys.size > MAX_CACHE) {
    const oldest = refinedKeys.values().next().value;
    if (oldest === undefined) break;
    refinedKeys.delete(oldest);
  }
}

function refinedKey(fromLang: string, toLang: string, phrase: string): string {
  return `${fromLang}:${toLang}:${phrase.toLowerCase()}`;
}

function finishPending(value: string | null): void {
  const p = pending;
  if (!p) return;
  pending = null;
  clearTimeout(p.timer);
  if (value) for (const fn of [...p.subscribers]) fn(value);
  for (const fn of [...p.waiters]) fn(value);
}

function cancelPending(): void {
  const p = pending;
  if (!p) return;
  pending = null;
  clearTimeout(p.timer);
  p.controller.abort();
  for (const fn of [...p.waiters]) fn(null);
}

/** Cancel any in-flight AI translation (timer + fetch). Safe to call at any time. */
export function abortTranslation(): void {
  cancelPending();
}

/**
 * Script families per language. Used to sanity-check AI translation output:
 * if the model returns text whose dominant script doesn't match the target
 * language's expected script, we reject the "translation". This catches the
 * frequent local-LLM regression where prism-coder ignores the translate
 * system prompt and replies as the AAC chat assistant in the source
 * language (e.g. translating "Я иду" to English came back as the Russian
 * greeting "Я здесь, чтобы помочь…", which is clearly not English).
 */
const SCRIPT_FOR_LANG: Record<string, RegExp> = {
  // Latin-script targets — reject Cyrillic/CJK/Hebrew/Arabic responses.
  en: /\p{Script=Latin}/u, es: /\p{Script=Latin}/u, fr: /\p{Script=Latin}/u,
  pt: /\p{Script=Latin}/u, ro: /\p{Script=Latin}/u, de: /\p{Script=Latin}/u,
  it: /\p{Script=Latin}/u, nl: /\p{Script=Latin}/u, pl: /\p{Script=Latin}/u,
  tr: /\p{Script=Latin}/u, sv: /\p{Script=Latin}/u, no: /\p{Script=Latin}/u,
  da: /\p{Script=Latin}/u, fi: /\p{Script=Latin}/u, cs: /\p{Script=Latin}/u,
  hu: /\p{Script=Latin}/u, vi: /\p{Script=Latin}/u, id: /\p{Script=Latin}/u,
  tl: /\p{Script=Latin}/u,
  // Cyrillic
  ru: /\p{Script=Cyrillic}/u, uk: /\p{Script=Cyrillic}/u, bg: /\p{Script=Cyrillic}/u,
  // CJK
  ja: /[\p{Script=Hiragana}\p{Script=Katakana}\p{Script=Han}]/u,
  ko: /\p{Script=Hangul}/u,
  zh: /\p{Script=Han}/u, 'zh-Hans': /\p{Script=Han}/u,
  'zh-Hant': /\p{Script=Han}/u, 'zh-HK': /\p{Script=Han}/u,
  // Other scripts
  ar: /\p{Script=Arabic}/u, he: /\p{Script=Hebrew}/u,
  el: /\p{Script=Greek}/u,
  hi: /\p{Script=Devanagari}/u,
  th: /\p{Script=Thai}/u,
};

/**
 * Returns true if the response looks like a plausible translation in
 * targetLang (i.e. its dominant script matches the target). Returns true
 * for short responses where script detection is unreliable.
 * Exported so MessageBar can gate the instant-offline display — prevents
 * showing garbage like "Я хочу К быть - best player" when the offline
 * dict only translates some words (script mismatch on the untranslated ones).
 */
export function looksLikeTargetLang(response: string, targetLang: string): boolean {
  const trimmed = response.trim();
  if (trimmed.length < 3) return true;
  const expected = SCRIPT_FOR_LANG[targetLang];
  if (!expected) return true; // unknown target, can't verify, accept
  // Count letters by script. If at least 60% of letter chars match the
  // expected script, accept; otherwise reject.
  const letters = trimmed.match(/\p{L}/gu) || [];
  if (letters.length === 0) return true;
  const matching = letters.filter((c) => expected.test(c)).length;
  return matching / letters.length >= 0.6;
}

/** Sentence-final punctuation across the scripts we support. */
const PHRASE_END = /[.!?…。！？؟։۔]["'”’»）)\]]*$/u;

/**
 * Is this text a finished thought worth spending a cloud translation on?
 *
 * The 200 ms debounce alone does not bound anything for our users: switch
 * scanning, head tracking and eye gaze all place selections FURTHER apart than
 * 200 ms, so the timer matures between every keystroke and each one ships a
 * half-written phrase to the model. Measured on "How are you? Now I can walk."
 * at 450 ms/keystroke: 11 of the requests ended mid-word ("How a", "How ar",
 * "How are y", ...). Those translations are wrong by construction — the model
 * has not been shown the end of the sentence — and they are what the user sees
 * flickering in the blue line while composing.
 *
 * A phrase boundary is sentence-final punctuation. Everything else waits for
 * the user to say they are done (Speak / Play → `force`).
 */
export function isPhraseBoundary(text: string): boolean {
  return PHRASE_END.test(text.trim());
}

export interface RefineOptions {
  /** Explicit user action (Speak / Play). Bypasses the phrase-boundary gate. */
  force?: boolean;
}

/**
 * Did the offline dictionary leave source-language words in its output?
 *
 * Mid-composition there is no cloud refinement to speak — that is reserved for
 * a phrase boundary — so the only candidate is the offline dictionary, and on
 * an unfinished utterance it commonly translates some words and passes others
 * through untouched. Measured en->ro while typing "I am here. I want water.":
 * "Eu am here. eu.", "Eu am here. Vreau.", "Vreau water.". Spoken aloud that
 * is not a partial translation, it is two languages at once, and an AAC user
 * has no way to tell it apart from a finished utterance.
 *
 * `looksLikeTargetLang` cannot catch this for same-script pairs — Romanian and
 * English are both Latin — so compare tokens instead: a token that survives
 * verbatim from the source is untranslated residue.
 *
 * Deliberately conservative. A word spelled identically in both languages
 * (proper nouns, "hotel") reads as residue and suppresses the utterance. Being
 * quiet for one word is a far smaller harm than voicing a mixed-language
 * sentence, and the phrase-boundary path still speaks the refined translation.
 */
export function hasUntranslatedResidue(source: string, translated: string): boolean {
  const tokens = (v: string) =>
    v.toLowerCase().split(/[^\p{L}\p{N}']+/u).filter((t) => t.length > 1);
  const src = new Set(tokens(source));
  if (src.size === 0) return false;
  return tokens(translated).some((t) => src.has(t));
}

export function translateWithAIRefine(
  text: string,
  fromLang: SupportedLanguage,
  toLang: SupportedLanguage,
  onRefined: (translated: string) => void,
  options?: RefineOptions,
): string {
  const instant = translateTextSync(text, fromLang, toLang);
  const trimmed = text.trim();
  if (trimmed.split(/\s+/).length < 2) return instant;

  // Already refined once: `instant` is that refinement, read back out of the
  // cache by translateTextSync. Nothing to request.
  if (refinedKeys.has(refinedKey(fromLang, toLang, trimmed))) return instant;

  // Already refining THIS phrase: join it. Do not cancel and do not re-request
  // — that is what made the display's refine kill the speaker's.
  if (pending && pending.phrase === trimmed) {
    pending.subscribers.push(onRefined);
    return instant;
  }

  // Cloud refine only at a phrase boundary or on an explicit user action. The
  // offline dictionary still renders `instant` on every keystroke, so the user
  // keeps live feedback — it just stops being a per-character cloud request.
  if (!options?.force && !isPhraseBoundary(trimmed)) return instant;

  // A genuinely different phrase supersedes the old one.
  cancelPending();

  const controller = new AbortController();
  const currentSignal = controller.signal;
  const timer = setTimeout(async () => {
    try {
      if (currentSignal.aborted) { finishPending(null); return; }
      const { translateAI } = await import('./aiService');
      const resultRace = await Promise.race([
        requestPreservedTranslation(translateAI, trimmed, fromLang, toLang, currentSignal),
        new Promise<never>((_, reject) => {
          const t = setTimeout(() => reject(new Error('AI translate timeout')), 15000);
          currentSignal.addEventListener('abort', () => { clearTimeout(t); reject(new Error('aborted')); }, { once: true });
        }),
      ]);
      if (currentSignal.aborted) { finishPending(null); return; }
      const refined = resultRace;
      if (
        refined &&
        refined.toLowerCase() !== trimmed.toLowerCase() &&
        looksLikeTargetLang(refined, toLang)
      ) {
        cache.set(`${fromLang}:${toLang}:${trimmed.toLowerCase()}`, refined);
        trimCache();
        refinedKeys.add(refinedKey(fromLang, toLang, trimmed));
        trimRefinedKeys();
        finishPending(refined);
      } else if (refined && !looksLikeTargetLang(refined, toLang)) {
        // The model returned text in the wrong script (e.g. AAC chat
        // assistant reply in source language). Stay on the offline
        // result rather than confuse the user with garbage.
        console.warn(
          `[translate] AI returned ${toLang} translation in wrong script; rejecting:`,
          refined.slice(0, 60),
        );
        finishPending(null);
      } else {
        finishPending(null);
      }
    } catch (e) {
      // Was silently swallowing — leaving users stuck on the partial offline
      // translate result (e.g. "Привет, How are you?" instead of "Hi, how
      // are you?"). Log so failures are visible in DevTools.
      console.warn('[translate] AI refine failed; staying on offline result:', e instanceof Error ? e.message : e);
      finishPending(null);
    }
    // The 200ms debounce exists to coalesce keystrokes. An explicit action —
    // Play, the Speak key, a typed sentence terminator — is not a keystroke to
    // coalesce, and every millisecond here is silence an AAC user waits
    // through before their sentence is voiced. Start those immediately.
  }, options?.force ? 0 : 200);

  pending = { phrase: trimmed, timer, controller, subscribers: [onRefined], waiters: [] };
  return instant;
}

/**
 * Best translation available for an utterance the user has just committed to
 * speaking, within a bounded wait.
 *
 * The budget covers the model round-trip, measured at 640-1080ms against
 * production. 1200ms was tried first and was too tight: it expired before the
 * refine landed and the sentence-end path voiced the offline dictionary's
 * "Vreau water." while the bar showed "Eu vreau apă.". Forced refines now skip
 * the 200ms debounce, so this ceiling is only reached on a slow network — and
 * once a phrase has been refined it is memoised, so a repeat Play is instant.
 *
 * BOTH Speak controls must use this. They are separate components — the
 * keyboard's green Speak key and MessageBar's ▶ — and they carry the SAME
 * `aria-label="Speak"`, which is how a `.first()` selector in an e2e test hid
 * the fact that only one of them translated. Measured on the keyboard key with
 * "I want water" (no closing punctuation): zero cloud requests, and the voice
 * got the offline dictionary's output instead of the model's. Pressing Speak is
 * the explicit "I am done" that the phrase-boundary gate defers to, so it must
 * force the refine.
 *
 * The budget is deliberately short: speaking a slightly worse translation on
 * time beats making an AAC user wait on the network.
 */
export const SPEECH_TRANSLATE_BUDGET_MS = 2500;

export function translateForSpeech(
  text: string,
  fromLang: SupportedLanguage,
  toLang: SupportedLanguage,
  onRefined?: (translated: string) => void,
  budgetMs: number = SPEECH_TRANSLATE_BUDGET_MS,
): Promise<string | null> {
  const phrase = text.trim();
  if (!phrase || fromLang === toLang) return Promise.resolve(null);

  // Schedule a refine if nothing is refining this phrase yet; join it if
  // something already is. Either way `pending` ends up owning this phrase.
  const instant = translateWithAIRefine(phrase, fromLang, toLang, (refined) => {
    onRefined?.(refined);
  }, { force: true });

  const offline = instant && looksLikeTargetLang(instant, toLang)
    && instant.toLowerCase() !== phrase.toLowerCase()
    ? instant
    : null;

  const owned = pending;
  if (!owned || owned.phrase !== phrase) return Promise.resolve(offline);

  return new Promise<string | null>((resolve) => {
    let settled = false;
    const finish = (v: string | null) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      resolve(v ?? offline);
    };
    // Speaking a slightly worse translation on time beats making an AAC user
    // wait on the network, so the join is bounded.
    const timer = setTimeout(() => finish(null), budgetMs);
    owned.waiters.push(finish);
  });
}

export function clearTranslationCache(): void {
  cache.clear();
  refinedKeys.clear();
  dictCache.clear();
}

export async function translateText(
  text: string,
  fromLang: SupportedLanguage,
  toLang: SupportedLanguage,
): Promise<string> {
  if (fromLang === toLang || !text.trim()) return text;

  const cacheKey = `${fromLang}:${toLang}:${text.trim().toLowerCase()}`;
  if (cache.has(cacheKey)) return cache.get(cacheKey)!;

  const offline = offlineTranslate(text, fromLang, toLang);

  try {
    const { translateAI } = await import('./aiService');
    const translated = await requestPreservedTranslation(
      translateAI,
      text,
      fromLang,
      toLang,
    );
    if (
      translated &&
      translated.toLowerCase() !== text.trim().toLowerCase() &&
      looksLikeTargetLang(translated, toLang)
    ) {
      cache.set(cacheKey, translated);
      trimCache();
      return translated;
    }
  } catch {}

  if (offline.toLowerCase() !== text.trim().toLowerCase()) {
    cache.set(cacheKey, offline);
    trimCache();
  }
  return offline;
}
