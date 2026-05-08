/**
 * translate — text → target-language string via Google Translate's
 * free `translate_a/single` endpoint (no API key required).
 *
 * The endpoint has been used by browser extensions like Mate Translate
 * and ImTranslator for years; it's stable but technically unofficial,
 * so failures are common and the caller MUST handle them. This module
 * never throws — it returns the source text on any failure so the
 * speak path always has SOMETHING to say.
 *
 * Privacy: this is the ONLY network call the extension makes. The
 * source text is sent to translate.googleapis.com over HTTPS. Users
 * who want a fully-offline workflow leave targetLanguage='' (default)
 * and the translator never runs.
 */

const ENDPOINT = 'https://translate.googleapis.com/translate_a/single';
const TIMEOUT_MS = 4_000;

const cache = new Map<string, string>();
const MAX_CACHE = 500;

function cacheKey(text: string, source: string, target: string): string {
  return `${source}::${target}::${text}`;
}

/**
 * Translate `text` from `source` (or 'auto') to `target`. Returns the
 * translated string on success, the original text on any failure.
 *
 * `target` should be a BCP-47 lang code Google understands ('es', 'fr',
 * 'ro', 'zh-CN', 'pt-BR', etc.). Empty target = no-op (returns text).
 */
export async function translate(text: string, source: string, target: string): Promise<string> {
  if (!target || !text.trim()) return text;
  const key = cacheKey(text, source || 'auto', target);
  const cached = cache.get(key);
  if (cached !== undefined) return cached;

  const url = new URL(ENDPOINT);
  url.searchParams.set('client', 'gtx');
  url.searchParams.set('sl', source || 'auto');
  url.searchParams.set('tl', target);
  url.searchParams.set('dt', 't');
  url.searchParams.set('q', text);

  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  try {
    const resp = await fetch(url.toString(), { signal: ctrl.signal });
    clearTimeout(timer);
    if (!resp.ok) return text;
    const data = await resp.json();
    // Response shape: [[[<chunk-text>, <source-chunk>, ...], ...], ...]
    if (!Array.isArray(data) || !Array.isArray(data[0])) return text;
    const out = data[0]
      .map((chunk: unknown) => Array.isArray(chunk) && typeof chunk[0] === 'string' ? chunk[0] : '')
      .join('');
    if (!out.trim()) return text;
    if (cache.size >= MAX_CACHE) {
      const first = cache.keys().next().value;
      if (first !== undefined) cache.delete(first);
    }
    cache.set(key, out);
    return out;
  } catch {
    clearTimeout(timer);
    return text;
  }
}

/** Pick the best Web Speech voice for a target BCP-47 lang code.
 *  Prefer exact match, then base-lang match, then OS default voice
 *  for that locale, then null (caller falls back to user-picked
 *  voiceURI or OS default). */
export function pickVoiceForLang(targetLang: string): SpeechSynthesisVoice | null {
  if (!targetLang || typeof window === 'undefined' || !window.speechSynthesis) return null;
  const voices = window.speechSynthesis.getVoices();
  if (voices.length === 0) return null;
  const target = targetLang.toLowerCase();
  const exact = voices.find((v) => v.lang.toLowerCase() === target);
  if (exact) return exact;
  const base = target.split(/[-_]/)[0];
  const baseMatch = voices.find((v) => v.lang.toLowerCase().split(/[-_]/)[0] === base);
  if (baseMatch) return baseMatch;
  return null;
}

/** Test-only access. */
export function __resetCache(): void {
  cache.clear();
}
