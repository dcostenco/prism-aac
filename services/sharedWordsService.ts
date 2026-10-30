/**
 * Shared prediction vocabulary: contributes this user's new words and loads
 * the words other users made common (owner decision 2026-10-30).
 *
 * Contributing: after Speak, a signed-in user with AI autocorrect on (which
 * already sends the draft to Synalux) sends the words of the message that no
 * built-in dictionary has, at most once per word per session. The portal keeps
 * them only as keyed hashes until 5 different users have used a word, then an
 * AI check decides whether it joins the shared list.
 *
 * Loading: the shared list for the language is cached on the device for 6
 * hours, so a word pulled on the server leaves devices within that time.
 */
import { portalFetch } from '@/services/portalClient';
import { isAllowedInLang, isKnownWord } from '@/lib/langAllowlist';
import { getCachedPredictionSeed } from '@/constants/predictionSeeds';
import { containsBlockedSuggestion } from '@/engine/ageBlocklist';
import { setSharedWords, sharedWordKey, sharedWordsFor } from '@/lib/sharedWords';
import { useAuthStore } from '@/store/authStore';
import { useSettingsStore } from '@/store/settingsStore';

const WORDS_PER_REQUEST = 20;
const CACHE_TTL_MS = 6 * 60 * 60 * 1000;
const CACHE_PREFIX = 'prism-aac-shared-words:';
// One word: letters and combining marks, with inner apostrophes or hyphens.
const WORD = /^[\p{L}\p{M}]+(?:['-][\p{L}\p{M}]+)*$/u;
const isSharedWordShape = (word: string) => word.length >= 2 && word.length <= 40 && WORD.test(word);

const sentThisSession = new Set<string>();
const loading = new Map<string, Promise<boolean>>();

const signedIn = () => useAuthStore.getState().profile !== null;

/** The words of a message worth contributing: shaped like a word, in no dictionary, never blocked. */
export function newWordsIn(message: string, lang: string): string[] {
  // Without the language's own dictionary nothing can be judged new.
  if (!getCachedPredictionSeed(lang)) return [];
  const words = message.split(/\s+/u)
    .map(token => sharedWordKey(token.replace(/^[^\p{L}\p{M}]+|[^\p{L}\p{M}]+$/gu, '')))
    .filter(isSharedWordShape);
  return [...new Set(words)].filter(word =>
    // In no dictionary, written in this language's script, never blocked.
    !isKnownWord(word, lang) && isAllowedInLang(word, lang, { allowUnknown: true })
    && !containsBlockedSuggestion(word, lang));
}

/** Fire-and-forget after Speak; never throws or rejects (Speak must not depend on it). */
export async function contributeSharedWords(message: string, lang: string): Promise<void> {
  let words: string[] = [];
  try {
    if (!signedIn() || !useSettingsStore.getState().aiAutocorrectEnabled) return;
    words = newWordsIn(message, lang).filter(word => !sentThisSession.has(`${lang}|${word}`)).slice(0, WORDS_PER_REQUEST);
    if (words.length === 0) return;
    for (const word of words) sentThisSession.add(`${lang}|${word}`);
    const result = await portalFetch({ path: '/prism-aac/words', method: 'POST', body: { lang, words }, timeoutMs: 5_000 });
    // A failed send may be retried on a later message.
    if (!result.ok) for (const word of words) sentThisSession.delete(`${lang}|${word}`);
  } catch {
    for (const word of words) sentThisSession.delete(`${lang}|${word}`);
  }
}

function readCache(lang: string): { at: number; words: string[] } | null {
  try {
    const raw = localStorage.getItem(CACHE_PREFIX + lang);
    const parsed = raw ? JSON.parse(raw) as { at?: unknown; words?: unknown } : null;
    if (!parsed || typeof parsed.at !== 'number' || !Array.isArray(parsed.words)) return null;
    return { at: parsed.at, words: parsed.words.filter((word): word is string => typeof word === 'string' && isSharedWordShape(word)) };
  } catch {
    return null;
  }
}

/**
 * Loads the shared words for a language (device cache first). Resolves true
 * when the set changed, so the caller can refresh predictions.
 */
export function loadSharedWords(lang: string): Promise<boolean> {
  const pending = loading.get(lang);
  if (pending) return pending;
  const run = (async () => {
    const cached = readCache(lang);
    let changed = false;
    if (cached && sharedWordsFor(lang).size === 0 && cached.words.length > 0) {
      setSharedWords(lang, cached.words);
      changed = true;
    }
    if ((cached && Date.now() - cached.at < CACHE_TTL_MS) || !signedIn()) return changed;
    const result = await portalFetch<{ lang?: unknown; words?: unknown }>({
      path: `/prism-aac/words?lang=${encodeURIComponent(lang)}`, method: 'GET', timeoutMs: 8_000,
    });
    if (!result.ok || result.data.lang !== lang || !Array.isArray(result.data.words)) return changed;
    const words = result.data.words.filter((word): word is string => typeof word === 'string' && isSharedWordShape(word));
    try { localStorage.setItem(CACHE_PREFIX + lang, JSON.stringify({ at: Date.now(), words })); } catch { /* storage full: memory only */ }
    const before = sharedWordsFor(lang);
    setSharedWords(lang, words);
    const after = sharedWordsFor(lang);
    return changed || before.size !== after.size || [...after].some(word => !before.has(word));
  })().finally(() => loading.delete(lang));
  loading.set(lang, run);
  return run;
}

export function _resetSharedWordsServiceForTests(): void {
  sentThisSession.clear();
  loading.clear();
}
