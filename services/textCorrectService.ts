'use client';

import { isLocalModelAvailable, LOCAL_OLLAMA_URL, LOCAL_MODEL } from '@/services/localModel';
import { canonicalizeLang, getLanguageName } from '@/engine/i18n';
import { stripModelControlTokens } from '@/services/aiService';

/**
 * Text auto-correction — fixes hurried / motor-impaired input.
 *
 * Local-first routing. AAC users on slow / flaky / school-locked
 * connections can't afford a portal round-trip on every keystroke.
 * Strategy:
 *
 *   1. Probe local prism-coder:7b once at boot.
 *   2. If local is reachable → use ONLY local for the rest of the
 *      session. ~200-400ms on consumer hardware, free, private,
 *      offline-capable. No portal cost, no network dependency.
 *   3. If local is unreachable → use portal (Gemini 2.5 Flash) with a
 *      hard 1.5s timeout. After that, return the original text rather
 *      than block the user's communication.
 *   4. Never throw, never block, never reject. The contract is
 *      "best-effort correction, original text on any failure".
 *
 * In-memory cache + in-flight dedup so identical inputs only round-trip
 * once per session.
 */

const SYNALUX_API = (typeof process !== 'undefined' && process.env?.NEXT_PUBLIC_SYNALUX_API)
  ? process.env.NEXT_PUBLIC_SYNALUX_API
  : 'https://synalux.ai/api/v1';

// Hard ceiling per backend. AAC users with motor / cognitive disabilities
// can't be left waiting; the slow path keeps running in the background
// for the cache, but the foreground call resolves with the original text.
const BACKEND_TIMEOUT_MS = 1500;

const LOCAL_SYSTEM_CORRECT = `You are a fast text-cleanup engine for an AAC (augmentative and alternative communication) app used by users with motor impairments. Your only job: take possibly-malformed input and return the most likely intended utterance in the specified language.

Rules:
- Fix obvious typos, missing spaces, dropped letters, transposed letters.
- Fix voice-transcript word-boundary errors.
- Fix spurious commas/punctuation that came from hurried typing.
- Capitalize the first word (and language-specific pronouns if applicable).
- DO NOT rewrite the user's voice — keep their words and tone.
- DO NOT add new content the user did not say.
- DO NOT remove content the user did say.
- DO NOT translate. Keep the output in the same language as the input.
- If the input is already well-formed, return it unchanged.
- Return ONLY the corrected text, no quotes, no explanation, no preamble.`;

const LOCAL_SYSTEM_COMPLETE = `You are a fast text-completion engine for an AAC (augmentative and alternative communication) app used by users with motor impairments. The input ends with an UNFINISHED WORD — the user is mid-typing and a likely completion will save them many keystrokes.

Rules:
- The LAST word of the input is incomplete — predict the most likely full word that starts with those letters in context.
- Replace ONLY the last word with its completion; keep all earlier words exactly as written.
- You MAY also extend the utterance by 1-3 short words after the completion if the context strongly suggests them. Otherwise stop after completing the last word.
- Fix obvious typos in earlier words while you're at it.
- Capitalize the first word (and language-specific pronouns if applicable); preserve user's case otherwise.
- DO NOT translate. Keep the output in the same language as the input.
- DO NOT explain — return ONLY the predicted text, no quotes, no preamble.
- If you cannot meaningfully complete the last word (e.g. it could be many different words), return the input unchanged.`;

const MAX_CACHE = 500;
const memoryCache = new Map<string, string>();
const inFlight = new Map<string, Promise<string>>();

/**
 * Script-aware language disambiguation.
 *
 * AAC users frequently leave their portal language set to "en" but type
 * in their native script (Russian/Ukrainian Cyrillic, Hebrew, Arabic,
 * Greek, etc.). When that happens the model receives "Language: English"
 * + Cyrillic text → confusion → returns the input unchanged → user sees
 * NO suggestion at all and concludes "autocorrect doesn't work".
 *
 * This helper picks a better language hint for the correction prompt
 * when the dominant script of the input clearly disagrees with the
 * caller-supplied lang. Returns the caller's lang unchanged when:
 *   - script and lang agree (no override needed)
 *   - input is mixed / no clear dominant script (don't guess)
 */
const SCRIPT_RANGES: Array<{ regex: RegExp; lang: string }> = [
    // Ordered so the first match wins. Cyrillic is the most common AAC
    // mismatch (per our user reports), so it leads. Each regex matches
    // a SINGLE codepoint in the Unicode range.
    { regex: /[Ѐ-ӿ]/, lang: 'ru' },   // Cyrillic
    { regex: /[֐-׿]/, lang: 'he' },   // Hebrew
    { regex: /[؀-ۿ]/, lang: 'ar' },   // Arabic
    { regex: /[Ͱ-Ͽ]/, lang: 'el' },   // Greek
    { regex: /[฀-๿]/, lang: 'th' },   // Thai
    { regex: /[぀-ゟ]/, lang: 'ja' },   // Hiragana
    { regex: /[゠-ヿ]/, lang: 'ja' },   // Katakana
    { regex: /[가-힯]/, lang: 'ko' },   // Hangul
    // CJK is intentionally omitted — Chinese/Japanese share too many
    // codepoints; let the caller's lang win there.
];

export function disambiguateLangByScript(text: string, callerLang: string): string {
    const callerBase = (callerLang || '').split(/[-_]/)[0].toLowerCase();
    const counts: Record<string, number> = {};
    let scripted = 0;
    let total = 0;
    for (const ch of text) {
        // Skip whitespace, digits, common ASCII punctuation
        if (/[\s0-9!-/:-@\[-`{-~]/.test(ch)) continue;
        total++;
        for (const { regex, lang } of SCRIPT_RANGES) {
            if (regex.test(ch)) {
                counts[lang] = (counts[lang] || 0) + 1;
                scripted++;
                break;
            }
        }
    }
    if (scripted === 0 || total === 0) return callerLang;
    // Need at least 70% of letters in a single non-Latin script before
    // overriding — avoids flipping on a single emoji or stray character.
    const [bestLang, bestCount] = Object.entries(counts).sort((a, b) => b[1] - a[1])[0];
    if (bestCount / total < 0.7) return callerLang;
    if (bestLang === callerBase) return callerLang;
    return bestLang;
}

function trimCorrectCache() {
  while (memoryCache.size > MAX_CACHE) {
    const oldest = memoryCache.keys().next().value;
    if (oldest !== undefined) memoryCache.delete(oldest);
    else break;
  }
}

function withTimeout(ms: number): { signal: AbortSignal; cancel: () => void } {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), ms);
  return { signal: ctrl.signal, cancel: () => clearTimeout(timer) };
}

type CorrectMode = 'correct' | 'complete';

async function correctViaPortal(text: string, lang: string, mode: CorrectMode): Promise<string | null> {
  const t = withTimeout(BACKEND_TIMEOUT_MS);
  try {
    const res = await fetch(`${SYNALUX_API}/text/correct`, {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text, lang, mode }),
      signal: t.signal,
    });
    if (!res.ok) return null;
    const data = await res.json();
    const raw = (data?.corrected || '') as string;
    // Defense-in-depth — server SHOULD strip these but if a model leak
    // sneaks through to the client we don't want `<|synalux_think|>…`
    // appearing as the suggestion in MessageBar.
    const corrected = stripModelControlTokens(raw);
    return corrected || null;
  } catch {
    return null;
  } finally {
    t.cancel();
  }
}

async function correctViaLocal(text: string, lang: string, mode: CorrectMode): Promise<string | null> {
  const t = withTimeout(BACKEND_TIMEOUT_MS);
  try {
    const langName = getLanguageName(lang);
    const res = await fetch(LOCAL_OLLAMA_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: LOCAL_MODEL,
        system: mode === 'complete' ? LOCAL_SYSTEM_COMPLETE : LOCAL_SYSTEM_CORRECT,
        prompt: `Language: ${langName} (${lang}). Input: "${text}"`,
        stream: false,
        options: { temperature: 0.0, num_predict: 80 },
      }),
      signal: t.signal,
    });
    if (!res.ok) return null;
    const data = await res.json();
    const raw = (data?.response || '').toString().trim();
    // Strip Synalux thinking tokens BEFORE the per-line / quote cleanup —
    // otherwise an unterminated `<|synalux_think|>` block can take the
    // whole first line and leave the suggestion empty.
    const stripped = stripModelControlTokens(raw);
    const cleaned = stripped.replace(/^["']|["']$/g, '').split('\n')[0].trim();
    return cleaned || null;
  } catch {
    return null;
  } finally {
    t.cancel();
  }
}

export async function correctText(
  text: string,
  lang = 'en',
  mode: CorrectMode = 'correct',
): Promise<string> {
  const trimmed = text.trim();
  // Match the MessageBar threshold (2 chars) — pin so a future bump
  // here doesn't silently kill 2-char autocomplete (e.g. "hw" → "how").
  if (!trimmed || trimmed.length < 2) return text;

  // Canonicalize so synalux portal + local model both receive BCP-47 codes.
  // Critical for Chinese routing: zh-CN vs zh-TW vs zh-HK take different paths.
  lang = canonicalizeLang(lang);

  // Script-aware override — if the user's settings say lang=en but they
  // typed all-Cyrillic / Hebrew / Arabic / Greek / Thai / Japanese / Korean,
  // override the prompt's language hint to the script's natural language.
  // Without this, the model gets "Language: English" + Cyrillic text,
  // returns the input unchanged, and the user sees NO autocorrect suggestion.
  // See disambiguateLangByScript() for the heuristic (≥70% non-Latin script
  // before override).
  const effectiveLang = disambiguateLangByScript(trimmed, lang);
  const cacheKey = `${mode}|${effectiveLang}|${trimmed}`;
  const cached = memoryCache.get(cacheKey);
  if (cached !== undefined) return cached;

  const pending = inFlight.get(cacheKey);
  if (pending) return pending;

  const promise = (async () => {
    try {
      // Local-first. If the user has prism-coder:7b running on their
      // device, we ALWAYS prefer it for correction — it's free, fast,
      // private, and works on slow connections. The portal is a
      // network-dependent fallback only.
      // NORMALIZED echo detection. A previous version compared
      // strict-equal (`fromLocal === trimmed`), which let case- or
      // whitespace-only changes from the local model slip through as
      // "valid" results — but MessageBar then dropped them via its
      // own norm-equal check, leaving the user with NO suggestion bar
      // even though the portal would have produced one. Now both
      // boundaries (here AND MessageBar) use the same normalized
      // comparison so a case-only echo correctly falls through.
      const norm = (s: string | null) =>
        (s ?? '').toLowerCase().replace(/\s+/g, ' ').trim();
      const trimmedNorm = norm(trimmed);

      const hasLocal = await isLocalModelAvailable();
      if (hasLocal) {
        let fromLocal = await correctViaLocal(trimmed, effectiveLang, mode);
        if (mode === 'complete' && norm(fromLocal) === trimmedNorm) {
          fromLocal = await correctViaLocal(trimmed, effectiveLang, 'correct');
        }
        if (fromLocal && norm(fromLocal) !== trimmedNorm) {
          memoryCache.set(cacheKey, fromLocal);
          trimCorrectCache();
          return fromLocal;
        }
        // Local was useless (null OR norm-echo) — fall through to portal.
      }
      let fromPortal = await correctViaPortal(trimmed, effectiveLang, mode);
      if (mode === 'complete' && norm(fromPortal) === trimmedNorm) {
        fromPortal = await correctViaPortal(trimmed, effectiveLang, 'correct');
      }
      if (fromPortal && norm(fromPortal) !== trimmedNorm) {
        memoryCache.set(cacheKey, fromPortal);
        trimCorrectCache();
        return fromPortal;
      }
      // Last resort — original text. Never block speech on a correction
      // failure or a slow connection.
      return text;
    } finally {
      inFlight.delete(cacheKey);
    }
  })();

  inFlight.set(cacheKey, promise);
  return promise;
}
