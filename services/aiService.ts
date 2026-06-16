'use client';
/**
 * AI Service — Synalux API with local offline fallback
 *
 * ONLINE: Routes through Synalux /api/v1/chat
 *   - Same backend as portal — tier-based model routing server-side
 *   - All Synalux modules available (web search, etc.)
 *   - Free: Gemini 2.5 Flash | Standard/Advanced: Claude Sonnet 4 | Enterprise: Claude Opus 4
 *
 * OFFLINE: Falls back to prism-coder:9b via local Ollama
 *   - Limited but functional — handles simple Q&A and note parsing
 *   - No web search, no premium models
 *   - Ensures the child always has AI help even without internet
 *
 * CLINICAL SAFETY:
 *   - AI responses are never auto-inserted
 *   - Child must tap to use a response
 *   - Caregiver must tap [Apply] to execute parsed actions
 */

import { NoteAction } from '@/types';
import { DEFAULT_CATEGORIES } from '@/constants/categories';
import { timeoutSignal } from '@/lib/portalConfig';
import { DEFAULT_PHRASES } from '@/constants/phrases';
import { getPhraseText } from '@/constants/phraseTranslations';
import { MODEL_REGISTRY, SIDELOAD_ORDER } from '@/constants/modelRegistry';

const SYNALUX_API = process.env.NEXT_PUBLIC_SYNALUX_API || 'https://synalux.ai/api/v1';
const LOCAL_OLLAMA_URL = process.env.NEXT_PUBLIC_LOCAL_OLLAMA_URL || 'http://localhost:11434/api';

// LOCAL_MODELS: ordered from best to smallest for callLocalModelFallback()
const LOCAL_MODELS = SIDELOAD_ORDER
  .map(id => MODEL_REGISTRY[id].ollamaTag.replace('dcostenco/', ''))
  .filter(tag => tag !== '');

// ── Auto-sideload: detect Ollama → pull best model → avoid cloud ──

const SIDELOAD_KEY = 'prism-aac-sideload-status';
const OLLAMA_BASE = LOCAL_OLLAMA_URL.replace(/\/api\/?$/, '');

type SideloadStatus = { state: 'idle' | 'pulling' | 'done' | 'error'; model?: string; progress?: number };
let sideloadStatus: SideloadStatus = { state: 'idle' };

export function getSideloadStatus(): SideloadStatus { return sideloadStatus; }

// Accuracy + size come from MODEL_REGISTRY (synced from HuggingFace via scripts/update-model-registry.sh)
const PULLABLE_MODELS = SIDELOAD_ORDER
  .map(id => MODEL_REGISTRY[id])
  .filter(m => m.sizeGB > 0)
  .map(m => ({ tag: m.ollamaTag.replace('dcostenco/', ''), sizeGB: m.sizeGB, accuracy: m.accuracy }));

async function ollamaReachable(): Promise<boolean> {
  if (typeof window !== 'undefined' && window.location.protocol === 'https:') return false;
  try {
    const r = await fetch(`${OLLAMA_BASE}/api/tags`, { signal: AbortSignal.timeout(3000) });
    return r.ok;
  } catch { return false; }
}

async function ollamaInstalledModels(): Promise<Set<string>> {
  try {
    const r = await fetch(`${OLLAMA_BASE}/api/tags`, { signal: AbortSignal.timeout(3000) });
    const data = await r.json() as { models?: Array<{ name: string }> };
    return new Set((data.models ?? []).map(m => m.name));
  } catch { return new Set(); }
}

async function ollamaPull(tag: string): Promise<boolean> {
  try {
    sideloadStatus = { state: 'pulling', model: tag, progress: 0 };
    const r = await fetch(`${OLLAMA_BASE}/api/pull`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: tag, stream: true }),
    });
    if (!r.ok || !r.body) return false;
    const reader = r.body.getReader();
    const decoder = new TextDecoder();
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      const lines = decoder.decode(value, { stream: true }).split('\n');
      for (const line of lines) {
        if (!line.trim()) continue;
        try {
          const j = JSON.parse(line);
          if (j.total && j.completed) {
            sideloadStatus = { state: 'pulling', model: tag, progress: Math.round(j.completed / j.total * 100) };
          }
          if (j.status === 'success') {
            sideloadStatus = { state: 'done', model: tag };
            try { await reader.cancel(); } catch { /* ignore — body already closed */ }
            return true;
          }
        } catch { /* partial JSON line */ }
      }
    }
    // Flush buffered bytes left by { stream: true } — catch a success status
    // that arrived in the final partial UTF-8 chunk.
    const flushed = decoder.decode();
    if (flushed.trim()) {
      try {
        const j = JSON.parse(flushed);
        if (j.status === 'success') { sideloadStatus = { state: 'done', model: tag }; return true; }
      } catch { /* partial JSON */ }
    }
    sideloadStatus = { state: 'done', model: tag };
    return true;
  } catch {
    sideloadStatus = { state: 'error', model: tag };
    return false;
  }
}

// In-flight guard: prevents concurrent calls (e.g. React Strict Mode double-invoke)
// from starting two parallel 9–19 GB model pulls against the same Ollama instance.
let _sideloadInFlight: Promise<void> | null = null;

/**
 * Auto-sideload: runs once on app mount. Detects Ollama, checks installed
 * models, pulls the best one that isn't already present. Non-blocking.
 *
 * Goal: avoid cloud calls. If the user has Ollama running, get a local
 * model installed so route() uses it instead of Synalux API.
 */
export function autoSideload(): Promise<void> {
  if (_sideloadInFlight) return _sideloadInFlight;
  _sideloadInFlight = _doAutoSideload().finally(() => { _sideloadInFlight = null; });
  return _sideloadInFlight;
}

async function _doAutoSideload(): Promise<void> {
  if (typeof window === 'undefined') return;
  if (window.location.protocol === 'https:') return;

  const already = sessionStorage.getItem(SIDELOAD_KEY);
  if (already === 'done') return;

  if (!await ollamaReachable()) return;

  const installed = await ollamaInstalledModels();
  const hasPrism = [...installed].some(n => n.includes('prism-coder'));
  if (hasPrism) {
    sessionStorage.setItem(SIDELOAD_KEY, 'done');
    sideloadStatus = { state: 'done', model: 'already installed' };
    return;
  }

  // Pick best model — try 27B first, fall back to 9B
  for (const { tag } of PULLABLE_MODELS) {
    if (await ollamaPull(tag)) {
      sessionStorage.setItem(SIDELOAD_KEY, 'done');
      return;
    }
  }
}

// ── Auth ──

const TOKEN_KEY = 'prism-aac-auth-token';
const TOKEN_EXP_KEY = 'prism-aac-auth-token-exp';
const TOKEN_TTL_MS = 8 * 60 * 60 * 1000; // 8 hours — sessionStorage clears on tab close anyway; 7-day TTL was dead code

export function getAuthToken(): string | null {
  if (typeof window === 'undefined') return null;
  const exp = Number(sessionStorage.getItem(TOKEN_EXP_KEY));
  if (exp && Date.now() > exp) {
    // Token expired — clear silently so next request redirects to sign-in
    sessionStorage.removeItem(TOKEN_KEY);
    sessionStorage.removeItem(TOKEN_EXP_KEY);
    return null;
  }
  return sessionStorage.getItem(TOKEN_KEY) || null;
}

export function setAuthToken(token: string): void {
  sessionStorage.setItem(TOKEN_KEY, token);
  sessionStorage.setItem(TOKEN_EXP_KEY, String(Date.now() + TOKEN_TTL_MS));
}

export function clearAuth(): void {
  sessionStorage.removeItem(TOKEN_KEY); sessionStorage.removeItem(TOKEN_EXP_KEY);
}

export function hasApiKey(): boolean {
  return !!getAuthToken();
}

// ── Synalux session (cookie-based, set by NextAuth on synalux.ai) ──

export interface SynaluxProfile {
  email: string;
  name: string;
  plan: 'free' | 'standard' | 'advanced' | 'enterprise';
  isPlatformAdmin: boolean;
}

export async function fetchSynaluxProfile(): Promise<SynaluxProfile | null> {
  // Same-origin when served from synalux.ai/prism-aac (cookie auto-attached).
  // Cross-origin (prism-aac.vercel.app) requires include + portal CORS.
  //
  // Two-step lookup so we can handle accounts that are signed in but don't
  // have a workspace role assigned yet:
  //   1. /api/auth/session — definitive "is the user signed in?" + email/name.
  //   2. /api/v1/roles/me — tier + admin flag (best-effort).
  // If step 1 says signed-in but step 2 fails or returns no role, we still
  // surface the user as signed-in on the Free tier rather than pretending
  // they aren't logged in at all.
  const base = SYNALUX_API.replace(/\/api\/v1$/, '');
  let email = '';
  let name = '';
  const sessT = timeoutSignal(5000);
  try {
    const sessRes = await fetch(`${base}/api/auth/session`, {
      credentials: 'include',
      headers: { 'Accept': 'application/json' },
      signal: sessT.signal,
    });
    if (!sessRes.ok) return null;
    const sess = await sessRes.json();
    if (!sess?.user?.email) return null;
    email = sess.user.email;
    name = sess.user.name || sess.user.email;
  } catch {
    return null;
  } finally {
    sessT.cancel();
  }

  let plan: SynaluxProfile['plan'] = 'free';
  let isPlatformAdmin = false;
  const meT = timeoutSignal(5000);
  try {
    const meRes = await fetch(`${SYNALUX_API}/roles/me`, {
      credentials: 'include',
      headers: { 'Accept': 'application/json' },
      signal: meT.signal,
    });
    if (meRes.ok) {
      const data = await meRes.json();
      if (data?.aac_plan) plan = data.aac_plan as SynaluxProfile['plan'];
      else if (data?.plan) plan = data.plan as SynaluxProfile['plan'];
      isPlatformAdmin = !!data?.is_platform_admin;
    }
  } catch { /* tier lookup is best-effort */ } finally {
    meT.cancel();
  }

  return { email, name, plan, isPlatformAdmin };
}

export function synaluxSignInUrl(): string {
  const base = SYNALUX_API.replace(/\/api\/v1$/, '');
  // Use origin+pathname only — no query string or hash to prevent open-redirect
  // via attacker-controlled params (e.g. prism-aac.vercel.app?redirect=evil.com).
  const callback = typeof window !== 'undefined'
    ? `${window.location.origin}${window.location.pathname}`
    : `${base}/prism-aac`;
  return `${base}/api/auth/signin/google?callbackUrl=${encodeURIComponent(callback)}`;
}

export function synaluxSignOutUrl(): string {
  const base = SYNALUX_API.replace(/\/api\/v1$/, '');
  const callback = typeof window !== 'undefined'
    ? `${window.location.origin}${window.location.pathname}`
    : `${base}/prism-aac`;
  return `${base}/api/auth/signout?callbackUrl=${encodeURIComponent(callback)}`;
}

// ── Synalux API (online) ──

// Compose two AbortSignals: abort when either fires.
// AbortSignal.any() is Chrome 116+ / Safari 17.4+. Polyfill via event
// forwarding for older iOS WKWebView builds.
function composeSignals(s1: AbortSignal, s2: AbortSignal): AbortSignal {
  const any = (AbortSignal as { any?: (signals: AbortSignal[]) => AbortSignal }).any;
  if (any) return any([s1, s2]);
  const ctrl = new AbortController();
  if (s1.aborted || s2.aborted) { ctrl.abort(); return ctrl.signal; }
  const fire = () => ctrl.abort();
  s1.addEventListener('abort', fire, { once: true });
  s2.addEventListener('abort', fire, { once: true });
  // Remove the surviving listener once ctrl fires (from whichever source won)
  // so the closed-over `fire` reference doesn't leak on AbortSignal.timeout()
  // objects, which GC-lifetime can outlast the fetch on some runtimes.
  ctrl.signal.addEventListener('abort', () => {
    s1.removeEventListener('abort', fire);
    s2.removeEventListener('abort', fire);
  }, { once: true });
  return ctrl.signal;
}

async function callSynalux(
  messages: Array<{ role: string; content: string }>,
  options?: { webSearch?: boolean; onChunk?: (delta: string) => void; intent?: 'chat' | 'translate'; signal?: AbortSignal },
): Promise<string> {
  if (options?.signal?.aborted) throw new DOMException('Aborted', 'AbortError');
  const token = getAuthToken();
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (token) headers['Authorization'] = `Bearer ${token}`;

  const t = timeoutSignal(30000);
  // Compose timeout signal with the caller's abort signal so either cancels the fetch.
  const fetchSignal = options?.signal ? composeSignals(t.signal, options.signal) : t.signal;
  let res: Response;
  try {
    // Route via /api/v1/prism-aac/chat — the dedicated AAC chat
    // endpoint (synalux-private commits 8607d33c → 05ef1d57).
    // Public route — no session cookie required (AAC must work for every child, including those without a caregiver account). Rate-limited per IP on the server.
    // Tier-routed to local prism-coder:9b → 27b → Claude Sonnet / Gemini.
    //
    // The previous /api/v1/chat target was the synalux web-app chat,
    // auth-gated → 401 for anonymous users on prism-aac.vercel.app.
    // Cross-origin SameSite=Lax NextAuth cookies don't propagate, so
    // even signed-in synalux.ai users got 401 here. The user-visible
    // symptom was "Couldn't reach the tutor. Check your internet."
    // (May 2026 user reports Image #29 / #30 — "why you telling me
    // it's not a bug?"). This switch makes the tutor work for every
    // visitor, signed-in or not.
    res = await fetch(`${SYNALUX_API}/prism-aac/chat`, {
      method: 'POST',
      credentials: 'include',
      headers,
      body: JSON.stringify({
        messages,
        stream: !!options?.onChunk,
        source: 'prism-aac',
        // intent tells the portal whether to prepend the AAC_SYSTEM
        // friendly-helper prompt. translateAI sets 'translate' so the
        // server passes our "You are a translator" system through
        // verbatim instead of merging it with the AAC chrome (which
        // made the model reply with chat suggestions in English →
        // looksLikeTargetLang rejected them → user stuck on offline
        // word-by-word "Я хочу ты" for "I want you").
        intent: options?.intent ?? 'chat',
        ...(options?.webSearch ? { web_search: true } : {}),
      }),
      signal: fetchSignal,
    });
  } catch (e) {
    t.cancel();
    throw e;
  }

  if (res.status === 401) { t.cancel(); clearAuth(); throw new Error('Session expired — sign in again'); }
  if (res.status === 429) { t.cancel(); throw new Error('Rate limit reached — try again in a moment'); }
  if (!res.ok) { t.cancel(); throw new Error(`Synalux API ${res.status}`); }

  const contentType = res.headers.get('content-type') || '';
  if (contentType.includes('text/event-stream') && res.body) {
    const reader = res.body.getReader();
    const decoder = new TextDecoder('utf-8');
    let fullText = '';
    /** Streaming-body cap: a hostile/looping model could otherwise
     *  push tens of MB of `data:` chunks into memory. 1 MB is far
     *  more than any legitimate AAC chat response (typical ≤ 4 KB)
     *  and matches MAX_PORTAL_RESPONSE_BYTES. */
    const STREAM_CAP_BYTES = 1_048_576;
    let received = 0;
    try {
      // lineBuffer carries the unterminated tail of the previous read() so a
      // 'data: {...}' line split across two TCP segments is reassembled before parse.
      let lineBuffer = '';
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        received += value.byteLength;
        if (received > STREAM_CAP_BYTES) {
          try { await reader.cancel(); } catch { /* */ }
          break;
        }
        lineBuffer += decoder.decode(value, { stream: true });
        const lines = lineBuffer.split('\n');
        lineBuffer = lines.pop()!; // last element may be partial — hold for next read
        for (const line of lines) {
          if (!line.startsWith('data: ')) continue;
          try {
            const parsed = JSON.parse(line.slice(6));
            const delta = parsed?.choices?.[0]?.delta?.content || '';
            if (delta) { fullText += delta; options?.onChunk?.(delta); }
          } catch { /* incomplete chunk */ }
        }
      }
      // Flush: drain TextDecoder UTF-8 state AND any unterminated line still in lineBuffer.
      lineBuffer += decoder.decode();
      for (const line of lineBuffer.split('\n')) {
        if (!line.startsWith('data: ')) continue;
        try {
          const parsed = JSON.parse(line.slice(6));
          const delta = parsed?.choices?.[0]?.delta?.content || '';
          if (delta) { fullText += delta; options?.onChunk?.(delta); }
        } catch { /* */ }
      }
    } finally {
      t.cancel();
    }
    return fullText;
  }

  // Non-streaming path: guard against oversized JSON bodies (no stream reader
  // to cancel mid-flight). Content-Length is advisory only, but catches obvious
  // bombs. The returned content string is capped at 32 KB to match the streaming
  // buffer limit in handleAsk — a rogue response cannot exhaust tab memory.
  const cl = Number(res.headers.get('content-length') || '0');
  if (cl > 1_048_576) { t.cancel(); throw new Error(`Synalux API response too large (${cl} bytes)`); }
  try {
    // Read raw text before JSON.parse — Content-Length is advisory and commonly absent
    // on HTTP/2. Without this cap, res.json() parses the full body into V8 heap before
    // the content.length check fires, risking OOM on low-memory iOS WKWebView.
    const rawText = await res.text();
    if (rawText.length > 1_048_576) throw new Error('Synalux API response body too large');
    const data = JSON.parse(rawText);
    const content: string = data?.choices?.[0]?.message?.content || data?.content || '';
    if (content.length > 32_000) throw new Error('Synalux API response content too large');
    return content;
  } finally {
    t.cancel();
  }
}

// ── Local Ollama (offline fallback) ──

async function callLocalModel(prompt: string, model: string, timeoutMs = 10000, signal?: AbortSignal, onChunk?: (delta: string) => void): Promise<string> {
  if (typeof window !== 'undefined' && window.location.protocol === 'https:') {
    throw new Error('Local AI unavailable — HTTPS page cannot reach http://localhost');
  }
  const t = timeoutSignal(timeoutMs);
  const fetchSignal = signal ? composeSignals(t.signal, signal) : t.signal;
  try {
    // Buffer-then-serve: always non-streaming for local inference so L1 safety
    // can gate the FULL response before it reaches the AAC UI. At num_predict:300
    // the latency cost is negligible (~0.5s) and the child never sees unsafe text.
    const chatUrl = LOCAL_OLLAMA_URL.replace(/\/api\/?$/, '') + '/api/chat';
    const res = await fetch(chatUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model,
        messages: [{ role: 'user', content: prompt }],
        stream: false,
        think: false,
        options: { num_predict: 300, temperature: 0 },
      }),
      signal: fetchSignal,
    });
    if (!res.ok) throw new Error(`Model ${model} unavailable`);

    const data = await res.json();
    const raw = data?.message?.content ?? '';
    // L1 output safety BEFORE onChunk — the UI callback must never
    // receive ungated text. checkOutputSafetyClient returns the crisis
    // message if the response matches, or the original text if clean.
    const content = checkOutputSafetyClient(raw);
    if (onChunk && content) onChunk(content);
    return content;
  } catch (e) {
    // AbortError must propagate — converting it to a plain Error makes callLocal
    // retry the next model (wasting time) and relies on callSynalux's upfront
    // signal.aborted check as an implicit escape valve that could be removed.
    if (e instanceof DOMException && e.name === 'AbortError') throw e;
    const msg = e instanceof TypeError
      ? 'Local AI unavailable — requires running the app locally (not HTTPS) or configuring Ollama CORS'
      : `Local AI unavailable (${model})`;
    throw new Error(msg);
  } finally {
    t.cancel();
  }
}

function isConfidentResponse(text: string): boolean {
  if (!text || text.trim().length < 2) return false;
  const hasToolCall = text.toLowerCase().includes('<|tool_call|>');
  const hasPlainText = text.trim().length >= 10 && !hasToolCall;
  if (hasToolCall) {
    // Any tool-call bleed indicates model confusion or prompt injection.
    // Reject the response entirely rather than selectively accepting "known"
    // tool names — a crafted prompt could smuggle a known name to pass this
    // filter and inject add_phrase/remove_sequence actions into the AAC store.
    return false;
  }
  return hasPlainText;
}

async function callLocal(prompt: string, signal?: AbortSignal, onChunk?: (delta: string) => void): Promise<string> {
  // L1 input safety — intercept crisis/medical before any model runs (offline path)
  const inputIntercept = checkInputSafetyClient(prompt);
  if (inputIntercept) {
    if (onChunk) onChunk(inputIntercept);
    return inputIntercept;
  }
  for (const model of LOCAL_MODELS) {
    try {
      const timeoutMs = model.includes('27b') ? 30000 : 15000;
      const result = await callLocalModel(prompt, model, timeoutMs, signal, onChunk);
      if (isConfidentResponse(result)) return result;
    } catch (e) {
      if (e instanceof DOMException && e.name === 'AbortError') throw e;
      continue;
    }
  }
  throw new Error('No local AI model available — start Ollama');
}

// ── Model output sanitation ──

/**
 * Strip chat-template control tokens that the model can leak into the
 * final response. prism-coder uses Synalux's custom template with
 * `<|synalux_think|>` / `<|synalux_end|>` / `<|synalux_answer|>` blocks
 * — when the server forgets to filter the thinking section (or the
 * stream gets cut mid-token), those tokens land verbatim in the user-
 * visible string.
 *
 * Real-world example caught here: AAC translation pane was rendering
 *   "🌐 <|synalux_think|> The user said 'I want more apples'. This is
 *    a non-clinical, personal request that falls outside my scope…"
 * instead of the Romanian translation. The user only ever wants the
 * answer; thinking is a backend implementation detail.
 *
 * Strip order matters: paired blocks first (so we don't accidentally
 * strip the close tag and orphan its content), THEN unterminated tail
 * (covers cut-off streams), THEN any remaining stray control tokens
 * (catches rare names like `<|im_end|>`, `<|eot|>`, `<|endoftext|>`
 * from base-model leaks).
 */
export function stripModelControlTokens(text: string): string {
  if (!text) return text;
  let out = text;
  // 1. Paired Synalux blocks: open → close.
  out = out.replace(
    /<\|synalux_think\|>[\s\S]*?<\|(?:\/synalux_think|synalux_end|synalux_answer)\|>/g,
    '',
  );
  // 2. Unterminated thinking from end of stream (model never emitted close).
  //    Replace with empty rather than keeping the prefix, since whatever
  //    follows `<|synalux_think|>` was meant to be hidden.
  out = out.replace(/<\|synalux_think\|>[\s\S]*$/g, '');
  // 3. Any other stray control tokens (im_start, eot, endoftext, etc.).
  out = out.replace(/<\|[a-z0-9_./-]+\|>/gi, '');
  // 4. Collapse runs of whitespace that the strip left behind. A paired
  //    block sandwiched between two spaces (`Prefix <|...|>X<|...|> Answer`)
  //    leaves `Prefix  Answer` with a double space — collapse to single.
  //    Newlines collapse too: an entire thought block on its own line
  //    becomes a single line break instead of a blank gap.
  out = out.replace(/[ \t]{2,}/g, ' ').replace(/\n{3,}/g, '\n\n');
  // 5. Partial token at end of a cut-off stream (e.g. "<|synalux_t" with no closing "|>").
  out = out.replace(/<\|[^|>]*$/, '');
  return out.trim();
}

// ── Client-side L1 safety (offline path — no portal) ──
// Mirrors server-side safety-patterns.ts. Both input and output checked
// so the offline child path has the same L1 protection as the cloud path.

const CRISIS_RESPONSE_CLIENT = "I'm concerned about your safety. Please tell a trusted adult, or call or text 988 (Suicide & Crisis Lifeline) right now — available 24/7. If in immediate danger, call 911. International: findahelpline.com. You are not alone.";
const MEDICAL_RESPONSE_CLIENT = "I cannot provide specific medical dosing advice. Please contact your doctor or pharmacist. For emergencies, call 911.";

const CRISIS_INPUT_CLIENT = [
    // English
    /hurt(?:ing)?\s+(?:my)?self/i,
    /kill\s+(?:my)?self/i,
    /end\s+my\s+life/i,
    /want\s+to\s+die/i,
    /want\s+to\s+(?:commit\s+)?suicide/i,
    /cut(?:ting)?\s+(?:my)?self/i,
    /(?:hang|hanging)\s+(?:my)?self/i,
    /jump(?:ing)?\s+off/i,
    /how\s+(?:many|much|to).*(?:pills|overdose|die)/i,
    // Spanish — negative lookahead for "de" (morir de risa = hyperbolic)
    /quiero\s+morir(?!\s+de\b)/i,
    /(?:voy\s+a\s+)?matarme(?!\s+(?:estudiando|trabajando|riendo))/i,
    /hacerme\s+da[ñn]o/i,
    /(?:quiero\s+)?suicidarme/i,
    // French — negative lookahead for "de"
    /je\s+veux\s+mourir(?!\s+de\b)/i,
    /(?:vais\s+)?me\s+tuer(?!\s+[àa]\s+(?:rire|travailler))/i,
    /me\s+suicider/i,
    // Portuguese — negative lookahead for "de"
    /quero\s+morrer(?!\s+de\b)/i,
    /(?:vou\s+)?me\s+matar(?!\s+(?:estudando|trabalhando|rindo))/i,
    // Russian — negative lookahead for "от"
    /хочу\s+умереть(?!\s+от\s)/i,
    /убить\s+себя/i,
    /покончить\s+с\s+собой/i,
    // Arabic (alef variants handled in normalize)
    /[اأإآ]ر[يى]د\s+[اأإآ]ن\s+[اأإآ]موت/,
    /قتل\s+نفس[يى]/,
    /[اأإآ]نه[يى]\s+ح[يى][اأإآ]ت[يى]/,
    // German — negative lookahead for "vor"
    /(?:ich\s+)?will\s+sterben(?!\s+vor\b)/i,
    /mich\s+umbringen/i,
    // Ukrainian — negative lookahead for "від"
    /хочу\s+померти(?!\s+від\s)/i,
    /вбити\s+себе/i,
];

const MEDICAL_INPUT_CLIENT = [
    /(?:how\s+much|what\s+dose)\s+.*(?:should\s+I|do\s+I|can\s+I)\s+(?:inject|take|give)/i,
    /(?:dose|dosage)\s+(?:should\s+I|do\s+I|can\s+I)\s+(?:inject|take|give)/i,
];

const CRISIS_OUTPUT_CLIENT = [
    /\bhow many pills\s+to\b/i,
    /\boverdose amount\b/i,
    /\bnoose\b/i,
    /\bhanging yourself\b/i,
    /\bsuicide method\b/i,
    /\bmethod of suicide\b/i,
    /\bself[- ]?harm method\b/i,
    /\bhow to (?:kill|hang|poison|overdose)\s+(?:your|my|him|her|them|one)self\b/i,
    /\bhow to overdose\b/i,
];

const MEDICAL_OUTPUT_CLIENT = [
    /\binject this (?:amount|dose|much)\b/i,
    /\btake this (?:amount|many|dose)\b/i,
    /\byou should (?:inject|take)\s+\d+\s+units\b/i,
];

function normalizeClient(text: string): string {
    return text
        .toLowerCase()
        .replace(/\p{Cf}/gu, '')
        .replace(/\p{Mn}/gu, '')
        .replace(/ـ/g, '')
        .replace(/[أإآ]/g, 'ا')
        .replace(/\s+/g, ' ');
}

export function checkInputSafetyClient(text: string): string | null {
    const t = normalizeClient(text);
    if (CRISIS_INPUT_CLIENT.some(p => p.test(t))) return CRISIS_RESPONSE_CLIENT;
    if (MEDICAL_INPUT_CLIENT.some(p => p.test(t))) return MEDICAL_RESPONSE_CLIENT;
    return null;
}

export function checkOutputSafetyClient(text: string): string {
    const t = normalizeClient(text);
    if (CRISIS_OUTPUT_CLIENT.some(re => re.test(t))) return CRISIS_RESPONSE_CLIENT;
    if (MEDICAL_OUTPUT_CLIENT.some(re => re.test(t))) return MEDICAL_RESPONSE_CLIENT;
    return text;
}

// ── Native bridge (iOS on-device 2B/4B via llama.cpp) ──

function isNativeBridgeAvailable(): boolean {
  return typeof window !== 'undefined' && !!(window as any).prismNativeBridge?.askAI;
}

function callNativeBridge(
  question: string,
  lang: string,
  onChunk?: (delta: string) => void,
  signal?: AbortSignal,
): Promise<string> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) { reject(new DOMException('Aborted', 'AbortError')); return; }
    let fullText = '';
    const timeout = setTimeout(() => {
      cleanup();
      reject(new Error('Native AI timeout'));
    }, 30_000);

    // settled prevents a stale buffered token from a previous invocation
    // contaminating a new session's buffer when the native thread delivers
    // one last token after cleanup() deletes the property and a new handler
    // is registered before the native runtime stops.
    let settled = false;

    const abortHandler = () => {
      settled = true;
      cleanup();
      reject(new DOMException('Aborted', 'AbortError'));
      try { (window as any).prismNativeBridge.stopAI?.(); } catch { /* optional bridge method */ }
    };

    function cleanup() {
      clearTimeout(timeout);
      signal?.removeEventListener('abort', abortHandler);
      delete (window as any).prismNativeAIResult;
      delete (window as any).prismNativeAIDone;
      delete (window as any).prismNativeAIError;
    }

    signal?.addEventListener('abort', abortHandler, { once: true });

    (window as any).prismNativeAIResult = (token: string) => {
      if (settled) return;
      fullText += token;
      onChunk?.(token);
    };
    (window as any).prismNativeAIDone = () => {
      settled = true;
      cleanup();
      resolve(fullText);
    };
    // Error channel for iOS llama.cpp bridge — without this, model errors (OOM,
    // GGUF not loaded, context overflow) have no way to reject the promise and
    // the 30-second hardware timeout becomes the only recovery path.
    (window as any).prismNativeAIError = (err: string) => {
      settled = true;
      cleanup();
      reject(new Error(`Native AI error: ${err}`));
    };

    (window as any).prismNativeBridge.askAI(question, lang);
  });
}

// ── Routing: local-first → cloud fallback ──
//
// Priority: avoid cloud calls at all cost.
//   1. Native bridge (iOS on-device 2B/4B via llama.cpp)
//   2. Local Ollama (WiFi to Mac — 9B/27B at 100%)
//   3. Synalux cloud (Claude — last resort)

async function route(
  prompt: string,
  options?: { webSearch?: boolean; system?: string; onChunk?: (delta: string) => void; intent?: 'chat' | 'translate'; signal?: AbortSignal },
): Promise<string> {
  // Bail early before touching any network path — avoids 30 s Ollama wait on abort.
  if (options?.signal?.aborted) throw new DOMException('Aborted', 'AbortError');

  const fullPrompt = options?.system ? `${options.system}\n\n${prompt}` : prompt;

  // 1. Try local Ollama first (Mac on WiFi — 9B/27B at 100%, free)
  if (!options?.webSearch) {
    try {
      const raw = await callLocal(fullPrompt, options?.signal, options?.onChunk);
      return stripModelControlTokens(raw);
    } catch (e) {
      if (e instanceof DOMException && e.name === 'AbortError') throw e;
      // Local unavailable — continue to cloud
    }
  }

  // 2. Cloud fallback (Synalux API)
  const messages: Array<{ role: string; content: string }> = [];
  if (options?.system) messages.push({ role: 'system', content: options.system });
  messages.push({ role: 'user', content: prompt });
  try {
    const raw = await callSynalux(messages, { webSearch: options?.webSearch, onChunk: options?.onChunk, intent: options?.intent, signal: options?.signal });
    return stripModelControlTokens(raw);
  } catch (err) {
    // AbortError must surface to the caller — swallowing it leaves the UI in a
    // permanent loading state because handleAsk checks signal.aborted to decide
    // whether to clear the spinner. If we replace AbortError with the generic
    // "No AI available" below, that check never fires.
    if (err instanceof DOMException && err.name === 'AbortError') throw err;
    const msg = err instanceof Error ? err.message : '';
    if (msg.includes('expired') || msg.includes('Rate limit')) throw err;
  }

  throw new Error('No AI available — check internet connection or start local Ollama');
}

// ── Public API ──

export interface AIResponse {
  text: string;
  lines: string[];
}

export interface ParsedNoteResult {
  actions: NoteAction[];
  summary: string;
}

// Language-name lookup so the system prompt can anchor in the user's locale.
// AAC users include nonverbal kids whose home language is NOT English. The
// previous prompt didn't pass language at all — Spanish-speaking children got
// English answers. Critical fix for a multilingual life-safety app.
export const LANG_NAMES: Record<string, string> = {
  en: 'English', es: 'Spanish', fr: 'French', pt: 'Portuguese', de: 'German',
  ro: 'Romanian', uk: 'Ukrainian', ru: 'Russian', ja: 'Japanese', ko: 'Korean',
  zh: 'Chinese', ar: 'Arabic', it: 'Italian', pl: 'Polish', nl: 'Dutch',
  he: 'Hebrew', hi: 'Hindi', vi: 'Vietnamese', tl: 'Tagalog', tr: 'Turkish',
  id: 'Indonesian',
};

// H7: Allowlist validation for language codes interpolated into system prompts.
// Prevents prompt injection via attacker-controlled fromLang/toLang parameters.
const _safeLang = (lang: string): string => {
  // Exact match on key (e.g. 'en', 'es') or value (e.g. 'English', 'Spanish')
  const key = Object.keys(LANG_NAMES).find(k => k === lang || LANG_NAMES[k] === lang);
  return LANG_NAMES[key ?? ''] ?? 'English';
};

/**
 * Offline-first translation: looks up the phrase in the local dictionary
 * (1,261 phrases × 20 languages, 100% accurate). Falls back to LLM only
 * for phrases not in the dictionary.
 */
export async function translateAI(
  text: string,
  fromLang: string,
  toLang: string,
  onChunk?: (delta: string) => void,
  signal?: AbortSignal,
): Promise<string> {
  // Try offline dictionary first — instant, 100% accurate, no cloud
  const offline = offlineTranslate(text, toLang);
  if (offline) return offline;

  // H7: Sanitize language params through the LANG_NAMES allowlist before interpolation
  const safeFrom = _safeLang(fromLang);
  const safeTo = _safeLang(toLang);
  const system = `You are a translator. Translate the input from ${safeFrom} to ${safeTo}. Return ONLY the translation — no explanations, no quotes, no extra text.`;
  return route(text, { system, onChunk, intent: 'translate', signal });
}

let _offlineLookup: Map<string, string> | null = null;

function getOfflineLookup(): Map<string, string> {
  if (_offlineLookup) return _offlineLookup;
  _offlineLookup = new Map();
  for (const p of DEFAULT_PHRASES) {
    _offlineLookup.set(p.text.toLowerCase(), p.id);
  }
  return _offlineLookup;
}

function offlineTranslate(text: string, toLang: string): string | null {
  const lookup = getOfflineLookup();
  const id = lookup.get(text.toLowerCase().trim());
  if (!id) return null;
  const translated = getPhraseText(id, toLang as any, '');
  if (translated && translated !== text) return translated;
  return null;
}

export async function askAI(
  question: string,
  context?: string,
  onChunk?: (delta: string) => void,
  language: string = 'en',
  signal?: AbortSignal,
): Promise<AIResponse> {
  const langName = LANG_NAMES[language] || 'English';
  const system = [
    `You are a friendly helper for a child who uses an AAC (Augmentative and Alternative Communication) device.`,
    `The child is nonverbal. Their home language is ${langName}. Always respond in ${langName}.`,
    '',
    'STYLE',
    '- 2-3 short sentences max. Aim for K-2 reading level.',
    '- Use simple, everyday words. Avoid jargon, idioms, sarcasm.',
    '- Be warm, patient, dignifying. Never condescend.',
    context ? `- The child is currently in the "${context.replace(/[^a-zA-Z0-9 \-_]/g, '').slice(0, 60)}" section of their AAC app.` : '',
    '',
    'SAFETY (life-saving app — these are non-negotiable)',
    '- Never give medical advice, dosages, or diagnoses. If asked about health symptoms or medication, say: "Please ask a grown-up or a doctor about this." (translated to ' + langName + ')',
    '- If the child mentions self-harm, suicide, abuse, or someone hurting them: respond with care and tell them to find a trusted adult or call emergency services. Do not minimize.',
    '- Never speculate about the child\'s disability, condition, or future. If asked "what is wrong with me", redirect: "You are okay just as you are. A grown-up can help you understand more." (translated)',
    '- Never use scary, violent, or sexually explicit content even if the child asks for a story or game.',
    '- Never make judgments about the child\'s family, caregivers, or therapy.',
    '',
    'CONTENT',
    '- For math or science questions, include relevant symbols (in any language).',
    '- For real-world topics, use web search results when available; cite the source briefly.',
    '- If unsure or asked something out of scope: "I am not sure. Let\'s ask a grown-up." (translated)',
  ].filter(Boolean).join('\n');

  const cappedQuestion = question.slice(0, 2000);

  // On-device path: iOS native bridge → llama.cpp 1.7B (no network, no latency).
  // Falls through to cloud/local route when the on-device pipeline returns
  // a near-empty response — typically the "I'm having trouble responding
  // right now." placeholder yielded when the GGUF isn't loaded.
  if (isNativeBridgeAvailable() && !context) {
    try {
      // Collect native tokens into an isolated buffer — do NOT feed the caller's
      // onChunk directly. If the bridge emits partial tokens before a short-response
      // fallthrough, the caller's buffer would be contaminated and the subsequent
      // route() call would append cloud tokens onto stale native text (garbled output).
      let nativeChunks = '';
      const nativeOnChunk = (delta: string) => { nativeChunks += delta; };
      const raw = await callNativeBridge(cappedQuestion, language, nativeOnChunk, signal);
      const text = stripModelControlTokens(raw).trim();
      if (text.length >= 12) {
        // Replay the collected tokens into the real onChunk now that we know
        // the response is good — this populates the caller's buffer for TTS.
        if (onChunk && nativeChunks) onChunk(nativeChunks);
        return { text, lines: text.split(/\n+/).filter((l) => l.trim()) };
      }
      // nativeChunks discarded — caller's buffer stays clean for route() below
    } catch (e) {
      if (e instanceof DOMException && e.name === 'AbortError') throw e;
      // Fall through to cloud/local
    }
  }

  const needsSearch = /what|who|where|when|why|how|explain|tell me about/i.test(cappedQuestion);
  const text = await route(cappedQuestion, { system, webSearch: needsSearch, onChunk, signal });
  const lines = text.split(/\n+/).filter((l) => l.trim());
  return { text, lines };
}

/**
 * Infer a single emoji icon for an AAC bedside quick-phrase card.
 * Calls the same AI routing stack as the rest of the app (local → cloud).
 * Always resolves — falls back to 💬 on any error.
 */
export async function inferCardIcon(text: string): Promise<string> {
  try {
    const raw = await route(
      `"${text.slice(0, 200).replace(/"/g, "'")}"`,
      {
        system:
          'You are an emoji selector for AAC communication cards. ' +
          'The user gives you a phrase and you reply with exactly one emoji that best represents it. ' +
          'Output only the emoji — no words, no punctuation, no explanation.',
        intent: 'chat',
      },
    );
    // Extract the first Unicode code point from the response.
    // Spreading a string iterates over code points (handles surrogate pairs).
    const chars = [...raw.trim()];
    const first = chars[0] ?? '';
    const cp = first.codePointAt(0) ?? 0;
    return cp > 127 ? first : '💬';
  } catch {
    return '💬';
  }
}

export async function parseCaregiverNote(rawNoteText: string, signal?: AbortSignal): Promise<ParsedNoteResult> {
  if (!rawNoteText?.trim()) return { actions: [{ type: 'note_only', description: 'Empty note', payload: {} }], summary: '' };
  // Cap at 2000 chars and JSON-encode so structural chars ({, }, [, ], :, quotes,
  // newlines, backslashes) become escaped sequences — structurally inert to the LLM parser.
  const noteText = JSON.stringify(rawNoteText.slice(0, 2000));
  // noteText is now a JSON string literal including surrounding double-quotes.
  const categoryList = DEFAULT_CATEGORIES.map((c) => `${c.id}: ${c.name}`).join(', ');

  const prompt = [
    'You are an AAC app configuration assistant for a BCBA/caregiver.',
    `Available categories: ${categoryList}`,
    '',
    'Parse the following caregiver instruction into structured JSON actions.',
    'Return ONLY a JSON array of action objects. No explanation.',
    '',
    'Action types:',
    '  add_phrase: { categoryId, text }',
    '  remove_phrase: { phraseText, categoryId }',
    '  reorder_phrase: { phraseId, newSortOrder, categoryId }',
    '  add_category: { name, icon }',
    '  add_sequence: { name, categoryId, steps: [{ label, options: [string] }] }',
    '  remove_sequence: { sequenceName }',
    '  boost_word: { word, boostCount }',
    '  note_only: {} (for observations with no configuration change)',
    '',
    `Caregiver says: ${noteText}`,
    '',
    'Return JSON array like: [{"type":"add_phrase","description":"...","payload":{...}}]',
  ].join('\n');

  const raw = await route(prompt, { signal });

  try {
    const cleaned = raw.replace(/```json?\n?/g, '').replace(/```/g, '').trim();
    const actions = JSON.parse(cleaned) as Array<Record<string, unknown>>;
    if (!Array.isArray(actions)) throw new Error('Not an array');
    // Validate each action's payload fields — cap strings so LLM output
    // cannot inject oversized data into the AAC store.
    const validatedActions = actions.slice(0, 20).filter(a => {
      if (typeof a?.type !== 'string') return false;
      if (a.payload && typeof a.payload === 'object') {
        const p = a.payload as Record<string, unknown>;
        if (typeof p.text === 'string') p.text = p.text.slice(0, 500);
        if (typeof p.phraseText === 'string') p.phraseText = p.phraseText.slice(0, 500);
        if (typeof p.name === 'string') p.name = p.name.slice(0, 80);
        if (typeof p.icon === 'string') p.icon = p.icon.slice(0, 10);
        if (typeof p.phraseId === 'string') p.phraseId = p.phraseId.slice(0, 80);
        if (typeof p.sequenceName === 'string') p.sequenceName = p.sequenceName.slice(0, 80);
        if (typeof p.categoryId === 'string') p.categoryId = p.categoryId.slice(0, 80);
        if (typeof p.word === 'string') p.word = p.word.slice(0, 100);
        if (typeof p.boostCount === 'number') p.boostCount = Math.max(0, Math.min(100, Math.floor(p.boostCount)));
        if (typeof p.newSortOrder === 'number') p.newSortOrder = Math.max(0, Math.min(10000, Math.floor(p.newSortOrder)));
        if (Array.isArray(p.steps)) {
          p.steps = (p.steps as unknown[]).slice(0, 20).map((step: unknown) => {
            if (!step || typeof step !== 'object') return step;
            const s = step as Record<string, unknown>;
            if (typeof s.label === 'string') s.label = s.label.slice(0, 100);
            if (Array.isArray(s.options)) {
              s.options = (s.options as unknown[]).slice(0, 20).map((o: unknown) =>
                typeof o === 'string' ? o.slice(0, 200) : '',
              );
            }
            return s;
          });
        }
      }
      if (typeof a.description === 'string') a.description = a.description.slice(0, 500);
      return true;
    }) as unknown as NoteAction[];
    const summary = validatedActions.map((a) => a.description || a.type).join('; ');
    return { actions: validatedActions, summary };
  } catch {
    return {
      actions: [{ type: 'note_only', description: 'Saved as clinical note', payload: {} }],
      summary: 'Saved as note',
    };
  }
}
