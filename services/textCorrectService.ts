'use client';

/**
 * Text auto-correction — fixes hurried / motor-impaired input.
 *
 * Three-stage routing:
 *   1. Synalux portal /api/v1/text/correct — Gemini 2.5 Flash, ~600ms,
 *      platform-cached so common inputs only hit the LLM once globally.
 *   2. Local Ollama prism-coder:7b — runs on-device when the portal
 *      can't be reached (offline, network drop, regional outage).
 *      Critical for AAC users who travel between networks or use the
 *      app on locked-down school WiFi.
 *   3. Original text — last-resort passthrough so we never block the
 *      user's communication on a correction failure.
 *
 * Used in two places in the client:
 *   • MessageBar — auto-applied on Speak so what the user hears matches
 *     what they meant, not what they typed.
 *   • Voice input — every final transcript passes through correction
 *     before being committed to the message bar (Web Speech API
 *     mis-segments fast speech, e.g. "bowlofrice").
 *
 * In-memory cache + in-flight dedup on top of the routing so identical
 * inputs only round-trip once per session.
 */

const SYNALUX_API = (typeof process !== 'undefined' && process.env?.NEXT_PUBLIC_SYNALUX_API)
  ? process.env.NEXT_PUBLIC_SYNALUX_API
  : 'https://synalux.ai/api/v1';

const LOCAL_OLLAMA_URL = 'http://localhost:11434/api/generate';
const LOCAL_MODEL = 'prism-coder:7b';

const LOCAL_SYSTEM = `You are a fast text-cleanup engine for an AAC (augmentative and alternative communication) app used by users with motor impairments. Your only job: take possibly-malformed input and return the most likely intended utterance.

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

const memoryCache = new Map<string, string>();
const inFlight = new Map<string, Promise<string>>();

async function correctViaPortal(text: string, lang: string): Promise<string | null> {
  try {
    const res = await fetch(`${SYNALUX_API}/text/correct`, {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text, lang }),
    });
    if (!res.ok) return null;
    const data = await res.json();
    const corrected = (data?.corrected || '') as string;
    return corrected || null;
  } catch {
    return null;
  }
}

async function correctViaLocal(text: string, lang: string): Promise<string | null> {
  try {
    const res = await fetch(LOCAL_OLLAMA_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: LOCAL_MODEL,
        system: LOCAL_SYSTEM,
        prompt: `Language: ${lang}. Input: "${text}"`,
        stream: false,
        options: { temperature: 0.0, num_predict: 80 },
      }),
    });
    if (!res.ok) return null;
    const data = await res.json();
    const raw = (data?.response || '').toString().trim();
    const cleaned = raw.replace(/^["']|["']$/g, '').split('\n')[0].trim();
    return cleaned || null;
  } catch {
    return null;
  }
}

export async function correctText(text: string, lang = 'en'): Promise<string> {
  const trimmed = text.trim();
  if (!trimmed || trimmed.length < 3) return text;

  const cacheKey = `${lang}|${trimmed}`;
  const cached = memoryCache.get(cacheKey);
  if (cached !== undefined) return cached;

  const pending = inFlight.get(cacheKey);
  if (pending) return pending;

  const promise = (async () => {
    try {
      // Online — portal first.
      const fromPortal = await correctViaPortal(trimmed, lang);
      if (fromPortal) {
        memoryCache.set(cacheKey, fromPortal);
        return fromPortal;
      }
      // Offline — local Ollama if available. Fails silently when the
      // user isn't running prism-coder.
      const fromLocal = await correctViaLocal(trimmed, lang);
      if (fromLocal) {
        memoryCache.set(cacheKey, fromLocal);
        return fromLocal;
      }
      // Last resort — original text. Never block speech on a correction
      // failure.
      return text;
    } finally {
      inFlight.delete(cacheKey);
    }
  })();

  inFlight.set(cacheKey, promise);
  return promise;
}
