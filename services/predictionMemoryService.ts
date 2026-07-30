/**
 * Advisory Prism AAC prediction memory.
 *
 * The message buffer remains the user's source of truth. This service only
 * returns candidate words for PredictionBar and persists phrases after an
 * explicit user confirmation (Speak or accepting a correction).
 */
import { ensureLangCorpusLoaded, isAllowedInLang } from '@/lib/langAllowlist';
import { portalFetch } from '@/services/portalClient';

const MAX_PREDICTIONS = 5;
const MAX_WORD_LENGTH = 64;
const MAX_CONFIRMED_PHRASE_LENGTH = 500;
const CACHE_TTL_MS = 5 * 60_000;
const MAX_CACHE_ENTRIES = 100;
const CLOUD_BUDGET_WINDOW_MS = 60_000;
const MAX_CLOUD_REQUESTS_PER_WINDOW = 6;
const SINGLE_WORD = /^[\p{L}\p{M}\p{N}'’\-]+$/u;
const ANONYMOUS_SCOPE_KEY = 'prism-aac-prediction-tab-scope';
let anonymousScopeFallback: string | null = null;

interface PredictionCacheEntry {
  expiresAt: number;
  words: string[];
}

const predictionCache = new Map<string, PredictionCacheEntry>();
const inFlight = new Map<string, Promise<string[]>>();
const cloudRequestTimes = new Map<string, number[]>();
let cacheEpoch = 0;

function createAnonymousScope(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return `anon:${crypto.randomUUID()}`;
  }
  return `anon:${Date.now().toString(36)}:${Math.random().toString(36).slice(2)}`;
}

export function getPredictionSessionScope(email?: string | null): string {
  if (email?.trim()) return `user:${email.trim().toLowerCase()}`;
  if (typeof sessionStorage !== 'undefined') {
    try {
      const saved = sessionStorage.getItem(ANONYMOUS_SCOPE_KEY);
      if (saved?.startsWith('anon:') && saved.length <= 128) return saved;
      const created = createAnonymousScope();
      sessionStorage.setItem(ANONYMOUS_SCOPE_KEY, created);
      anonymousScopeFallback = created;
      return created;
    } catch { /* private storage or quota failure — use tab-module fallback */ }
  }
  if (!anonymousScopeFallback) anonymousScopeFallback = createAnonymousScope();
  return anonymousScopeFallback;
}

export function rotateAnonymousPredictionSessionScope(): string {
  const created = createAnonymousScope();
  anonymousScopeFallback = created;
  if (typeof sessionStorage !== 'undefined') {
    try {
      sessionStorage.setItem(ANONYMOUS_SCOPE_KEY, created);
    } catch { /* private storage or quota failure — module fallback is enough */ }
  }
  return created;
}

export interface MemoryPredictionOptions {
  /**
   * Opaque account/tab scope. Personalized results must never be cached across
   * this boundary on shared AAC devices.
   */
  sessionScope: string;
  signal?: AbortSignal;
}

function contextKey(text: string, language: string, sessionScope: string): string {
  return `${sessionScope}\u0000${language.toLowerCase()}\u0000${text.replace(/\s+/g, ' ').trim().toLowerCase()}`;
}

function rememberCacheEntry(key: string, words: string[]): void {
  predictionCache.delete(key);
  predictionCache.set(key, {
    expiresAt: Date.now() + CACHE_TTL_MS,
    words: [...words],
  });
  while (predictionCache.size > MAX_CACHE_ENTRIES) {
    const oldest = predictionCache.keys().next().value;
    if (typeof oldest !== 'string') break;
    predictionCache.delete(oldest);
  }
}

function consumeCloudBudget(sessionScope: string): boolean {
  const now = Date.now();
  const active = (cloudRequestTimes.get(sessionScope) ?? [])
    .filter((timestamp) => now - timestamp < CLOUD_BUDGET_WINDOW_MS);
  if (active.length >= MAX_CLOUD_REQUESTS_PER_WINDOW) {
    cloudRequestTimes.set(sessionScope, active);
    return false;
  }
  active.push(now);
  cloudRequestTimes.set(sessionScope, active);
  return true;
}

/**
 * Fail-closed validation for model output. The portal prompt asks for single
 * words, but the client still rejects phrases, oversized tokens, duplicates,
 * and words that do not belong to the active language.
 */
export function validateMemoryPredictionWords(
  value: unknown,
  language: string,
): string[] {
  if (!Array.isArray(value)) return [];

  const seen = new Set<string>();
  const words: string[] = [];
  for (const candidate of value) {
    if (typeof candidate !== 'string') continue;
    const word = candidate.trim();
    const normalized = word.toLocaleLowerCase();
    if (
      !word
      || word.length > MAX_WORD_LENGTH
      || !SINGLE_WORD.test(word)
      || seen.has(normalized)
      || !isAllowedInLang(word, language)
    ) {
      continue;
    }
    seen.add(normalized);
    words.push(word);
    if (words.length === MAX_PREDICTIONS) break;
  }
  return words;
}

export async function fetchMemoryPredictions(
  text: string,
  language: string,
  options: MemoryPredictionOptions,
): Promise<string[]> {
  const normalizedText = text.replace(/\s+/g, ' ').trim();
  if (!normalizedText || !options.sessionScope || options.signal?.aborted) return [];

  const requestEpoch = cacheEpoch;
  try {
    // Model output must not use isAllowedInLang's boot-time fail-open path.
    // Keep deterministic cards visible until the active-language corpus is
    // ready, then validate every remote word against it.
    await ensureLangCorpusLoaded(language);
  } catch {
    return [];
  }
  if (requestEpoch !== cacheEpoch || options.signal?.aborted) return [];

  const key = contextKey(normalizedText, language, options.sessionScope);
  const cached = predictionCache.get(key);
  if (cached && cached.expiresAt > Date.now()) {
    return [...cached.words];
  }
  if (cached) predictionCache.delete(key);

  // Calls with their own AbortSignal are latest-only component requests; do
  // not share them because aborting one subscriber must not cancel another.
  // Signal-free duplicate calls are safe to coalesce within the same
  // account+language+context.
  if (!options.signal) {
    const pending = inFlight.get(key);
    if (pending) return pending;
  }
  if (!consumeCloudBudget(options.sessionScope)) return [];

  const request: Promise<string[]> = portalFetch<{ words?: unknown }>({
    path: '/prism-aac/predict',
    method: 'POST',
    body: {
      text: normalizedText.slice(0, MAX_CONFIRMED_PHRASE_LENGTH),
      lang: language,
    },
    timeoutMs: 6_000,
    signal: options.signal,
  }).then((result) => {
    if (!result.ok || options.signal?.aborted || requestEpoch !== cacheEpoch) return [];
    const words = validateMemoryPredictionWords(result.data?.words, language);
    // Empty/invalid model output is commonly transient. Do not pin it in the
    // five-minute cache and hide a later recovery.
    if (words.length > 0) {
      rememberCacheEntry(key, words);
    }
    return [...words];
  }).finally(() => {
    if (inFlight.get(key) === request) inFlight.delete(key);
  });

  if (!options.signal) inFlight.set(key, request);
  return request;
}

/**
 * Save only an explicitly confirmed utterance. Anonymous/free users receive a
 * normal 401 from the portal memory endpoint and continue with local learning;
 * prediction and speech are never blocked on this best-effort write.
 */
export async function rememberConfirmedPhrase(
  phrase: string,
  language: string,
): Promise<boolean> {
  const content = phrase.replace(/\s+/g, ' ').trim();
  if (
    content.length > MAX_CONFIRMED_PHRASE_LENGTH
    || content.split(/\s+/).filter(Boolean).length < 2
  ) {
    return false;
  }

  const result = await portalFetch({
    path: '/prism-aac/memory',
    method: 'POST',
    body: {
      type: 'phrase',
      content,
      metadata: {
        language,
        confirmation: 'explicit',
      },
    },
    timeoutMs: 5_000,
  });
  return result.ok;
}

export function clearPredictionMemoryCache(): void {
  cacheEpoch += 1;
  predictionCache.clear();
  inFlight.clear();
  cloudRequestTimes.clear();
}
