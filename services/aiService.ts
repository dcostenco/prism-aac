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

const SYNALUX_API = process.env.NEXT_PUBLIC_SYNALUX_API || 'https://synalux.ai/api/v1';
const LOCAL_OLLAMA_URL = 'http://localhost:11434/api';
const LOCAL_MODEL = 'prism-coder:7b';

// ── Auth ──

function getAuthToken(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem('prism-aac-auth-token') || null;
}

export function setAuthToken(token: string): void {
  localStorage.setItem('prism-aac-auth-token', token);
}

export function clearAuth(): void {
  localStorage.removeItem('prism-aac-auth-token');
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
  try {
    const sessRes = await fetch(`${base}/api/auth/session`, {
      credentials: 'include',
      headers: { 'Accept': 'application/json' },
      signal: AbortSignal.timeout(5000),
    });
    if (!sessRes.ok) return null;
    const sess = await sessRes.json();
    if (!sess?.user?.email) return null;
    email = sess.user.email;
    name = sess.user.name || sess.user.email;
  } catch {
    return null;
  }

  let plan: SynaluxProfile['plan'] = 'free';
  let isPlatformAdmin = false;
  try {
    const meRes = await fetch(`${SYNALUX_API}/roles/me`, {
      credentials: 'include',
      headers: { 'Accept': 'application/json' },
      signal: AbortSignal.timeout(5000),
    });
    if (meRes.ok) {
      const data = await meRes.json();
      if (data?.aac_plan) plan = data.aac_plan as SynaluxProfile['plan'];
      else if (data?.plan) plan = data.plan as SynaluxProfile['plan'];
      isPlatformAdmin = !!data?.is_platform_admin;
    }
  } catch { /* tier lookup is best-effort */ }

  return { email, name, plan, isPlatformAdmin };
}

export function synaluxSignInUrl(): string {
  const base = SYNALUX_API.replace(/\/api\/v1$/, '');
  const callback = typeof window !== 'undefined'
    ? window.location.href
    : `${base}/prism-aac`;
  return `${base}/api/auth/signin/google?callbackUrl=${encodeURIComponent(callback)}`;
}

export function synaluxSignOutUrl(): string {
  const base = SYNALUX_API.replace(/\/api\/v1$/, '');
  const callback = typeof window !== 'undefined'
    ? window.location.href
    : `${base}/prism-aac`;
  return `${base}/api/auth/signout?callbackUrl=${encodeURIComponent(callback)}`;
}

// ── Synalux API (online) ──

async function callSynalux(
  messages: Array<{ role: string; content: string }>,
  options?: { webSearch?: boolean; onChunk?: (delta: string) => void },
): Promise<string> {
  const token = getAuthToken();
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (token) headers['Authorization'] = `Bearer ${token}`;

  const res = await fetch(`${SYNALUX_API}/chat`, {
    method: 'POST',
    credentials: 'include',
    headers,
    body: JSON.stringify({
      messages,
      stream: false,
      source: 'prism-aac',
      ...(options?.webSearch ? { web_search: true } : {}),
    }),
    signal: AbortSignal.timeout(30000),
  });

  if (res.status === 401) { clearAuth(); throw new Error('Session expired — sign in again'); }
  if (res.status === 429) throw new Error('Rate limit reached — try again in a moment');
  if (!res.ok) throw new Error(`Synalux API ${res.status}`);

  const contentType = res.headers.get('content-type') || '';
  if (contentType.includes('text/event-stream') && res.body) {
    const reader = res.body.getReader();
    const decoder = new TextDecoder('utf-8');
    let fullText = '';
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
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
    return fullText;
  }

  const data = await res.json();
  return data?.choices?.[0]?.message?.content || data?.content || '';
}

// ── Local Ollama (offline fallback) ──

async function callLocal(prompt: string): Promise<string> {
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
      signal: AbortSignal.timeout(10000),
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
  return out.trim();
}

// ── Routing: Synalux → local fallback ──

async function route(
  prompt: string,
  options?: { webSearch?: boolean; system?: string; onChunk?: (delta: string) => void },
): Promise<string> {
  const messages: Array<{ role: string; content: string }> = [];
  if (options?.system) messages.push({ role: 'system', content: options.system });
  messages.push({ role: 'user', content: prompt });

  // Try Synalux first (online, full features)
  try {
    const raw = await callSynalux(messages, { webSearch: options?.webSearch, onChunk: options?.onChunk });
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

export async function translateAI(
  text: string,
  fromLang: string,
  toLang: string,
  onChunk?: (delta: string) => void,
): Promise<string> {
  const system = `You are a translator. Translate the input from ${fromLang} to ${toLang}. Return ONLY the translation — no explanations, no quotes, no extra text.`;
  return route(text, { system, onChunk });
}

export async function askAI(
  question: string,
  context?: string,
  onChunk?: (delta: string) => void,
): Promise<AIResponse> {
  const system = [
    'You are a friendly helper for a child who uses an AAC (communication) device.',
    'The child may have limited vocabulary. Keep responses to 2-3 short sentences.',
    'Use simple words. Be encouraging and patient.',
    context ? `Context: The child is in the "${context}" section of their AAC app.` : '',
    'If it is a math or science question, include relevant symbols.',
    'If the child asks about a real-world topic, use web search results if available.',
  ].filter(Boolean).join('\n');

  const needsSearch = /what|who|where|when|why|how|explain|tell me about/i.test(question);

  const text = await route(question, { system, webSearch: needsSearch, onChunk });
  const lines = text.split(/\n+/).filter((l) => l.trim());
  return { text, lines };
}

export async function parseCaregiverNote(noteText: string): Promise<ParsedNoteResult> {
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
    `Caregiver says: "${noteText}"`,
    '',
    'Return JSON array like: [{"type":"add_phrase","description":"...","payload":{...}}]',
  ].join('\n');

  const raw = await route(prompt);

  try {
    const cleaned = raw.replace(/```json?\n?/g, '').replace(/```/g, '').trim();
    const actions = JSON.parse(cleaned) as NoteAction[];
    if (!Array.isArray(actions)) throw new Error('Not an array');
    const summary = actions.map((a) => a.description || a.type).join('; ');
    return { actions, summary };
  } catch {
    return {
      actions: [{ type: 'note_only', description: 'Saved as clinical note', payload: {} }],
      summary: 'Saved as note',
    };
  }
}
