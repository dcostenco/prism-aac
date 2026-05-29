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

let _hologram: any = null;
let _ready = false;
let _initPromise: Promise<boolean> | null = null;

const STORAGE_KEY = 'prism-aac-hrr-hologram';
const DIM = 1024;
const MIN_PHRASE_WORDS = 2;
const MAX_PHRASE_LEN = 500;

export async function initAacHrr(): Promise<boolean> {
    if (_ready) return true;
    if (_initPromise) return _initPromise;
    _initPromise = _doInit();
    return _initPromise;
}

async function _doInit(): Promise<boolean> {
    try {
        const { HrrHologram } = await import('synalux-hrr');
        _hologram = new HrrHologram(DIM);

        try {
            const saved = localStorage.getItem(STORAGE_KEY);
            if (saved) {
                const arr = JSON.parse(saved);
                if (validateHologram(arr)) {
                    _hologram.import_hologram(arr);
                } else {
                    try { localStorage.removeItem(STORAGE_KEY); } catch {}
                }
            }
        } catch { /* localStorage unavailable (Safari Private) — run without persistence */ }

        _ready = true;
        return true;
    } catch {
        _initPromise = null;
        return false;
    }
}

function validateHologram(data: unknown): data is number[] {
    if (!Array.isArray(data)) return false;
    if (data.length !== DIM) return false;
    for (let i = 0; i < Math.min(data.length, 20); i++) {
        if (typeof data[i] !== 'number' || !isFinite(data[i])) return false;
    }
    return true;
}

export function destroyAacHrr(): void {
    if (_persistTimer) { clearTimeout(_persistTimer); _persistTimer = null; }
    flushPersist();
    _hologram = null;
    _ready = false;
    _initPromise = null;
    if (typeof window !== 'undefined') {
        window.removeEventListener('beforeunload', flushPersist);
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
}): void {
    if (!_hologram || !_ready) return;
    const trimmed = phrase.trim();
    if (!trimmed || trimmed.length > MAX_PHRASE_LEN) return;

    const words = trimmed.split(/\s+/).filter(Boolean);

    const ctxSuffix = [
        context?.category ? `cat:${context.category}` : '',
        context?.timeOfDay ? `time:${context.timeOfDay}` : '',
        context?.tone ? `tone:${context.tone}` : '',
    ].filter(Boolean).join('|');

    const phraseKey = ctxSuffix ? `${trimmed}|${ctxSuffix}` : trimmed;
    _hologram.encode(phraseKey, trimmed);

    // Skip n-gram encoding for single words — no bigram signal
    if (words.length < MIN_PHRASE_WORDS) return;

    for (let i = 0; i < words.length - 1; i++) {
        const w = words[i].toLowerCase();
        _hologram.encode(`w:${w}`, words[i + 1]);

        if (i < words.length - 2) {
            _hologram.encode(`w:${w} ${words[i + 1].toLowerCase()}`, words[i + 2]);
        }
    }

    schedulePersist();
}

export function getContextualSuggestions(
    currentText: string,
    context?: { category?: string; timeOfDay?: string },
    topK = 5,
): Array<{ phrase: string; relevance: number }> {
    if (!_hologram || !_ready || !currentText.trim()) return [];

    const queryParts = [currentText];
    if (context?.category) queryParts.push(`cat:${context.category}`);
    if (context?.timeOfDay) queryParts.push(`time:${context.timeOfDay}`);

    const results = _hologram.probe(queryParts.join(' '), topK);
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
): Array<{ word: string; relevance: number }> {
    if (!_hologram || !_ready || !currentText.trim()) return [];

    const words = currentText.trim().split(/\s+/).filter(Boolean);
    if (words.length === 0) return [];

    const seen = new Set<string>();
    const out: Array<{ word: string; relevance: number }> = [];

    function collect(results: any[]) {
        for (const r of results) {
            if (r.similarity < 0.02) continue;
            // WASM probe returns the concept KEY (e.g. "w:want"), not the value.
            // Use get_summary() to retrieve the actual next word.
            const word = _hologram.get_summary?.(r.concept) ?? r.concept;
            if (typeof word !== 'string' || !word || seen.has(word.toLowerCase())) continue;
            seen.add(word.toLowerCase());
            out.push({ word, relevance: r.similarity });
            if (out.length >= topK) return;
        }
    }

    if (words.length >= 2) {
        const triKey = `w:${words[words.length - 2].toLowerCase()} ${words[words.length - 1].toLowerCase()}`;
        collect(_hologram.probe(triKey, topK));
    }

    if (out.length < topK) {
        const biKey = `w:${words[words.length - 1].toLowerCase()}`;
        collect(_hologram.probe(biKey, topK - out.length));
    }

    return out;
}

export function isAacHrrReady(): boolean {
    return _ready;
}

// ─── Persistence ─────────────────────────────────────────────

let _persistTimer: ReturnType<typeof setTimeout> | null = null;

function flushPersist(): void {
    if (!_hologram) return;
    try {
        const data = _hologram.export_hologram();
        localStorage.setItem(STORAGE_KEY, JSON.stringify(Array.from(data)));
    } catch { /* localStorage full or unavailable — non-fatal */ }
}

function schedulePersist(): void {
    if (_persistTimer) return;
    _persistTimer = setTimeout(() => {
        _persistTimer = null;
        flushPersist();
    }, 5_000);
}

if (typeof window !== 'undefined') {
    window.addEventListener('beforeunload', flushPersist);
}
