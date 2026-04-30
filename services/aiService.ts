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
  try {
    const res = await fetch(`${SYNALUX_API}/roles/me`, {
      credentials: 'include',
      headers: { 'Accept': 'application/json' },
    });
    if (res.status === 401 || res.status === 403) return null;
    if (!res.ok) return null;
    const data = await res.json();
    if (!data?.user_name && !data?.role_key) return null;
    return {
      email: data.user_name || '',
      name: data.user_name || '',
      plan: (data.plan || 'free') as SynaluxProfile['plan'],
      isPlatformAdmin: !!data.is_platform_admin,
    };
  } catch {
    return null;
  }
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
    return await callSynalux(messages, { webSearch: options?.webSearch, onChunk: options?.onChunk });
  } catch (err) {
    const msg = err instanceof Error ? err.message : '';
    // Auth/rate errors should not fall back — surface to user
    if (msg.includes('expired') || msg.includes('Rate limit')) throw err;
  }

  // Offline fallback: prism-coder:7b
  try {
    const fullPrompt = options?.system ? `${options.system}\n\n${prompt}` : prompt;
    return await callLocal(fullPrompt);
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
