'use client';
/**
 * AI Service — Synalux API with local offline fallback
 *
 * ONLINE: Routes through Synalux /api/v1/chat
 *   - Same backend as portal — tier-based model routing server-side
 *   - All Synalux modules available (web search, etc.)
 *   - Free: Gemini 2.5 Flash | Standard/Advanced: Claude Sonnet 4 | Enterprise: Claude Opus 4
 *
 * OFFLINE: Falls back to prism-coder:7b via local Ollama
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

const SYNALUX_API = process.env.NEXT_PUBLIC_SYNALUX_API || 'https://synalux.ai/api/v1';
const LOCAL_OLLAMA_URL = process.env.NEXT_PUBLIC_LOCAL_OLLAMA_URL || 'http://localhost:11434/api';
const LOCAL_MODEL = 'prism-coder:7b';

// ── Auth ──

const TOKEN_KEY = 'prism-aac-auth-token';
const TOKEN_EXP_KEY = 'prism-aac-auth-token-exp';
const TOKEN_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

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

async function callSynalux(
  messages: Array<{ role: string; content: string }>,
  options?: { webSearch?: boolean; onChunk?: (delta: string) => void; intent?: 'chat' | 'translate' },
): Promise<string> {
  const token = getAuthToken();
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (token) headers['Authorization'] = `Bearer ${token}`;

  const t = timeoutSignal(30000);
  let res: Response;
  try {
    // Route via /api/v1/prism-aac/chat — the dedicated AAC chat
    // endpoint (synalux-private commits 8607d33c → 05ef1d57).
    // Public route — no session cookie required (AAC must work for every child, including those without a caregiver account). Rate-limited per IP on the server.
    // Tier-routed to local prism-coder:7b → 14b → Claude Sonnet / Gemini.
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
        stream: false,
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
      signal: t.signal,
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
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        received += value.byteLength;
        if (received > STREAM_CAP_BYTES) {
          try { await reader.cancel(); } catch { /* */ }
          break;
        }
        const chunk = decoder.decode(value, { stream: true });
        for (const line of chunk.split('\n')) {
          if (!line.startsWith('data: ')) continue;
          try {
            const parsed = JSON.parse(line.slice(6));
            const delta = parsed?.choices?.[0]?.delta?.content || '';
            if (delta) { fullText += delta; options?.onChunk?.(delta); }
          } catch { /* incomplete chunk */ }
        }
      }
    } finally {
      t.cancel();
    }
    return fullText;
  }

  try {
    const data = await res.json();
    return data?.choices?.[0]?.message?.content || data?.content || '';
  } finally {
    t.cancel();
  }
}

// ── Local Ollama (offline fallback) ──

async function callLocal(prompt: string): Promise<string> {
  // Skip on HTTPS pages: browsers block http://localhost as mixed content
  // and the failed fetch surfaces in the console as a security error. The
  // local-Ollama path is only reachable when prism-aac itself is served
  // over http (dev / local standalone).
  if (typeof window !== 'undefined' && window.location.protocol === 'https:') {
    throw new Error('Local AI unavailable — HTTPS page cannot reach http://localhost');
  }
  const t = timeoutSignal(10000);
  try {
    const res = await fetch(`${LOCAL_OLLAMA_URL}/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: LOCAL_MODEL,
        prompt,
        stream: false,
        options: { num_predict: 300, temperature: 0.3 },
      }),
      signal: t.signal,
    });
    if (!res.ok) throw new Error('Local model unavailable');
    const data = await res.json();
    return data?.response ?? '';
  } catch (e) {
    // Mixed content (HTTPS→HTTP) or CORS will throw TypeError: Failed to fetch
    const msg = e instanceof TypeError
      ? 'Local AI unavailable — requires running the app locally (not HTTPS) or configuring Ollama CORS'
      : 'Local AI unavailable';
    throw new Error(msg);
  } finally {
    t.cancel();
  }
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
  return out.trim();
}

// ── Routing: Synalux → local fallback ──

async function route(
  prompt: string,
  options?: { webSearch?: boolean; system?: string; onChunk?: (delta: string) => void; intent?: 'chat' | 'translate' },
): Promise<string> {
  const messages: Array<{ role: string; content: string }> = [];
  if (options?.system) messages.push({ role: 'system', content: options.system });
  messages.push({ role: 'user', content: prompt });

  // Try Synalux first (online, full features)
  try {
    const raw = await callSynalux(messages, { webSearch: options?.webSearch, onChunk: options?.onChunk, intent: options?.intent });
    return stripModelControlTokens(raw);
  } catch (err) {
    const msg = err instanceof Error ? err.message : '';
    // Auth/rate errors should not fall back — surface to user
    if (msg.includes('expired') || msg.includes('Rate limit')) throw err;
  }

  // Offline fallback: prism-coder:7b
  try {
    const fullPrompt = options?.system ? `${options.system}\n\n${prompt}` : prompt;
    const raw = await callLocal(fullPrompt);
    return stripModelControlTokens(raw);
  } catch {
    throw new Error('No AI available — check internet connection or start local Ollama');
  }
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

export async function translateAI(
  text: string,
  fromLang: string,
  toLang: string,
  onChunk?: (delta: string) => void,
): Promise<string> {
  // H7: Sanitize language params through the LANG_NAMES allowlist before interpolation
  const safeFrom = _safeLang(fromLang);
  const safeTo = _safeLang(toLang);
  const system = `You are a translator. Translate the input from ${safeFrom} to ${safeTo}. Return ONLY the translation — no explanations, no quotes, no extra text.`;
  return route(text, { system, onChunk, intent: 'translate' });
}

export async function askAI(
  question: string,
  context?: string,
  onChunk?: (delta: string) => void,
  language: string = 'en',
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
  const needsSearch = /what|who|where|when|why|how|explain|tell me about/i.test(cappedQuestion);
  const text = await route(cappedQuestion, { system, webSearch: needsSearch, onChunk });
  const lines = text.split(/\n+/).filter((l) => l.trim());
  return { text, lines };
}

export async function parseCaregiverNote(rawNoteText: string): Promise<ParsedNoteResult> {
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

  const raw = await route(prompt);

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
        if (typeof p.categoryId === 'string') p.categoryId = p.categoryId.slice(0, 80);
        if (typeof p.word === 'string') p.word = p.word.slice(0, 100);
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
