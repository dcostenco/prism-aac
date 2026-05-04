'use client';

import { isLocalModelAvailable, LOCAL_OLLAMA_URL, LOCAL_MODEL } from '@/services/localModel';
import { canonicalizeLang } from '@/engine/i18n';

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

const LOCAL_SYSTEM_CORRECT = `You are a fast text-cleanup engine for an AAC (augmentative and alternative communication) app used by users with motor impairments. Your only job: take possibly-malformed input and return the most likely intended utterance.

Rules:
- Fix obvious typos, missing spaces, dropped letters, transposed letters.
- Fix voice-transcript word-boundary errors (e.g. "bowlof rice" -> "bowl of rice", "i wantto eat" -> "i want to eat").
- Fix spurious commas/punctuation that came from hurried typing.
- Capitalize "I" and the first word.
- DO NOT rewrite the user's voice — keep their words and tone.
- DO NOT add new content the user did not say.
- DO NOT remove content the user did say.
- DO NOT translate.
- If the input is already well-formed, return it unchanged.
- Return ONLY the corrected text, no quotes, no explanation, no preamble.`;

const LOCAL_SYSTEM_COMPLETE = `You are a fast text-completion engine for an AAC (augmentative and alternative communication) app used by users with motor impairments. The input ends with an UNFINISHED WORD — the user is mid-typing and a likely completion will save them many keystrokes.

Rules:
- The LAST word of the input is incomplete — predict the most likely full word that starts with those letters in context.
- Replace ONLY the last word with its completion; keep all earlier words exactly as written.
- You MAY also extend the utterance by 1-3 short words after the completion if the context strongly suggests them (e.g. "у лукоморья дуб" -> "у лукоморья дуб зелёный"). Otherwise stop after completing the last word.
- Fix obvious typos in earlier words while you're at it.
- Capitalize "I" and the first word; preserve user's case otherwise.
- DO NOT translate.
- DO NOT explain — return ONLY the predicted text, no quotes, no preamble.
- If you cannot meaningfully complete the last word (e.g. it could be 50 different words), return the input unchanged.`;

const MAX_CACHE = 500;
const memoryCache = new Map<string, string>();
const inFlight = new Map<string, Promise<string>>();

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
    const corrected = (data?.corrected || '') as string;
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
    const res = await fetch(LOCAL_OLLAMA_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: LOCAL_MODEL,
        system: mode === 'complete' ? LOCAL_SYSTEM_COMPLETE : LOCAL_SYSTEM_CORRECT,
        prompt: `Language: ${lang}. Input: "${text}"`,
        stream: false,
        options: { temperature: 0.0, num_predict: 80 },
      }),
      signal: t.signal,
    });
    if (!res.ok) return null;
    const data = await res.json();
    const raw = (data?.response || '').toString().trim();
    const cleaned = raw.replace(/^["']|["']$/g, '').split('\n')[0].trim();
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
  if (!trimmed || trimmed.length < 3) return text;

  // Canonicalize so synalux portal + local model both receive BCP-47 codes.
  // Critical for Chinese routing: zh-CN vs zh-TW vs zh-HK take different paths.
  lang = canonicalizeLang(lang);
  const cacheKey = `${mode}|${lang}|${trimmed}`;
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
      const hasLocal = await isLocalModelAvailable();
      if (hasLocal) {
        const fromLocal = await correctViaLocal(trimmed, lang, mode);
        if (fromLocal) {
          memoryCache.set(cacheKey, fromLocal);
          trimCorrectCache();
          return fromLocal;
        }
        // Local probe said yes but the call failed — fall through to
        // portal as a backup rather than fail.
      }
      const fromPortal = await correctViaPortal(trimmed, lang, mode);
      if (fromPortal) {
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
