/**
 * HRR Context — Zero-Search Contextual Retrieval for AAC
 *
 * Uses the synalux-hrr WASM package to encode the user's communication
 * patterns into a holographic memory. Enables instant (~0.2ms) retrieval
 * of relevant vocabulary, phrases, and context — works offline.
 *
 * This is ADDITIVE — the existing prediction engine continues to work.
 * HRR adds a fast contextual layer on top.
 */

const STORAGE_KEY = 'prism-aac-hrr-hologram';
const DEFAULT_SCOPE = 'legacy';
const DIM = 1024;
const MIN_PHRASE_WORDS = 2;
const MAX_PHRASE_LEN = 500;

interface HrrScopeState {
    hologram: any;
    persistTimer: ReturnType<typeof setTimeout> | null;
}

const _scopeStates = new Map<string, HrrScopeState>();
const _initPromises = new Map<string, Promise<boolean>>();
const _scopeGenerations = new Map<string, number>();

function normalizeScope(scope?: string): string {
    const normalized = scope?.trim().toLowerCase();
    return normalized ? normalized.slice(0, 320) : DEFAULT_SCOPE;
}

function storageKeyForScope(scope: string): string | null {
    if (scope === DEFAULT_SCOPE) return STORAGE_KEY;
    // Signed-in profiles may persist personalization across sessions. Anonymous
    // scopes are intentionally tab-ephemeral so a later shared-device user
    // cannot inherit another anonymous user's communication history.
    if (!scope.startsWith('user:')) return null;
    return `${STORAGE_KEY}:${encodeURIComponent(scope)}`;
}

export async function initAacHrr(scope?: string): Promise<boolean> {
    const normalizedScope = normalizeScope(scope);
    if (_scopeStates.has(normalizedScope)) return true;
    const existing = _initPromises.get(normalizedScope);
    if (existing) return existing;

    const generation = _scopeGenerations.get(normalizedScope) ?? 0;
    const pending: Promise<boolean> = _doInit(normalizedScope, generation).finally(() => {
        if (_initPromises.get(normalizedScope) === pending) {
            _initPromises.delete(normalizedScope);
        }
    });
    _initPromises.set(normalizedScope, pending);
    return pending;
}

async function _doInit(scope: string, generation: number): Promise<boolean> {
    try {
        const { HrrHologram } = await import('synalux-hrr');
        const hologram: any = new HrrHologram(DIM);
        const storageKey = storageKeyForScope(scope);

        if (storageKey) {
            try {
                const saved = localStorage.getItem(storageKey);
                if (saved) {
                    const arr = JSON.parse(saved);
                    if (validateHologram(arr)) {
                        hologram.import_hologram(arr);
                    } else {
                        try { localStorage.removeItem(storageKey); } catch {}
                    }
                }
            } catch { /* localStorage unavailable (Safari Private) — run without persistence */ }
        }

        // An auth transition may invalidate this scope while the WASM import
        // or localStorage restore is still pending. Never resurrect that
        // previous user's in-memory personalization after it was destroyed.
        if ((_scopeGenerations.get(scope) ?? 0) !== generation) return false;
        _scopeStates.set(scope, { hologram, persistTimer: null });
        return true;
    } catch (err) {
        if (typeof window !== 'undefined') {
            console.warn('[HRR] WASM init failed — predictions will use n-gram engine only:', err);
        }
        return false;
    }
}

function validateHologram(data: unknown): data is number[] {
    if (!Array.isArray(data)) return false;
    if (data.length !== DIM) return false;
    for (let i = 0; i < data.length; i++) {
        if (typeof data[i] !== 'number' || !isFinite(data[i])) return false;
    }
    return true;
}

export function destroyAacHrr(scope?: string): void {
    const scopes = scope
        ? [normalizeScope(scope)]
        : [...new Set([..._scopeStates.keys(), ..._initPromises.keys()])];
    for (const scopeKey of scopes) {
        _scopeGenerations.set(
            scopeKey,
            (_scopeGenerations.get(scopeKey) ?? 0) + 1,
        );
        _initPromises.delete(scopeKey);
        const state = _scopeStates.get(scopeKey);
        if (!state) continue;
        if (state.persistTimer) {
            clearTimeout(state.persistTimer);
            state.persistTimer = null;
        }
        flushPersist(scopeKey);
        _scopeStates.delete(scopeKey);
    }
}

/**
 * Record a spoken phrase. Encodes bigrams + trigrams for next-word prediction.
 * Requires at least 2 words — single words provide no n-gram signal.
 */
export function recordPhrase(phrase: string, context?: {
    category?: string;
    timeOfDay?: string;
    tone?: string;
    language?: string;
    scope?: string;
}): void {
    const scope = normalizeScope(context?.scope);
    const state = _scopeStates.get(scope);
    if (!state) return;
    const hologram = state.hologram;
    const trimmed = phrase.trim();
    if (!trimmed || trimmed.length > MAX_PHRASE_LEN) return;

    const words = trimmed.split(/\s+/).filter(Boolean);

    const ctxSuffix = [
        context?.language ? `lang:${context.language.trim().toLowerCase()}` : '',
        context?.category ? `cat:${context.category}` : '',
        context?.timeOfDay ? `time:${context.timeOfDay}` : '',
        context?.tone ? `tone:${context.tone}` : '',
    ].filter(Boolean).join('|');
    const ngramPrefix = context?.language
        ? `lang:${context.language.trim().toLowerCase()}|`
        : '';

    const phraseKey = ctxSuffix ? `${trimmed}|${ctxSuffix}` : trimmed;
    hologram.encode(phraseKey, trimmed);

    // Skip n-gram encoding for single words — no bigram signal
    if (words.length < MIN_PHRASE_WORDS) return;

    for (let i = 0; i < words.length - 1; i++) {
        const w = words[i].toLowerCase();
        hologram.encode(`${ngramPrefix}w:${w}`, words[i + 1]);

        if (i < words.length - 2) {
            hologram.encode(
                `${ngramPrefix}w:${w} ${words[i + 1].toLowerCase()}`,
                words[i + 2],
            );
        }
    }

    schedulePersist(scope);
}

export function getContextualSuggestions(
    currentText: string,
    context?: { category?: string; timeOfDay?: string; scope?: string },
    topK = 5,
): Array<{ phrase: string; relevance: number }> {
    const state = _scopeStates.get(normalizeScope(context?.scope));
    if (!state || !currentText.trim()) return [];

    const queryParts = [currentText];
    if (context?.category) queryParts.push(`cat:${context.category}`);
    if (context?.timeOfDay) queryParts.push(`time:${context.timeOfDay}`);

    const results = state.hologram.probe(queryParts.join(' '), topK);
    return results
        .filter((r: any) => r.similarity > 0.03)
        .map((r: any) => ({
            phrase: r.concept.split('|')[0],
            relevance: r.similarity,
        }));
}

/**
 * Next-word predictions via trigram → bigram cascade.
 * Returns individual words suitable for PredictionBar tiles.
 */
export function getNextWordSuggestions(
    currentText: string,
    topK = 5,
    language?: string,
    scope?: string,
): Array<{ word: string; relevance: number }> {
    const state = _scopeStates.get(normalizeScope(scope));
    if (!state || !currentText.trim()) return [];
    const hologram = state.hologram;

    const words = currentText.trim().split(/\s+/).filter(Boolean);
    if (words.length === 0) return [];

    const seen = new Set<string>();
    const out: Array<{ word: string; relevance: number }> = [];
    const ngramPrefix = language
        ? `lang:${language.trim().toLowerCase()}|`
        : '';

    function collect(results: any[]) {
        for (const r of results) {
            if (r.similarity < 0.02) continue;
            // WASM probe returns the concept KEY (e.g. "w:want"), not the value.
            // Use get_summary() to retrieve the actual next word.
            const word = hologram.get_summary?.(r.concept) ?? r.concept;
            if (typeof word !== 'string' || !word || seen.has(word.toLowerCase())) continue;
            seen.add(word.toLowerCase());
            out.push({ word, relevance: r.similarity });
            if (out.length >= topK) return;
        }
    }

    if (words.length >= 2) {
        const triKey = `${ngramPrefix}w:${words[words.length - 2].toLowerCase()} ${words[words.length - 1].toLowerCase()}`;
        collect(hologram.probe(triKey, topK));
    }

    if (out.length < topK) {
        const biKey = `${ngramPrefix}w:${words[words.length - 1].toLowerCase()}`;
        collect(hologram.probe(biKey, topK - out.length));
    }

    return out;
}

export function isAacHrrReady(scope?: string): boolean {
    return _scopeStates.has(normalizeScope(scope));
}

// ─── Persistence ─────────────────────────────────────────────

function flushPersist(scope: string): void {
    const storageKey = storageKeyForScope(scope);
    const state = _scopeStates.get(scope);
    if (!storageKey || !state) return;
    try {
        const data = state.hologram.export_hologram();
        localStorage.setItem(storageKey, JSON.stringify(Array.from(data)));
    } catch { /* localStorage full or unavailable — non-fatal */ }
}

function flushAllPersist(): void {
    for (const scope of _scopeStates.keys()) flushPersist(scope);
}

function schedulePersist(scope: string): void {
    const state = _scopeStates.get(scope);
    if (!state || !storageKeyForScope(scope) || state.persistTimer) return;
    state.persistTimer = setTimeout(() => {
        state.persistTimer = null;
        flushPersist(scope);
    }, 5_000);
}

if (typeof window !== 'undefined') {
    window.addEventListener('beforeunload', flushAllPersist);
    document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'hidden') flushAllPersist();
    });
}
