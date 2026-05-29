/**
 * HRR Context — Zero-Search Contextual Retrieval for AAC
 *
 * Uses the @synalux/hrr WASM package to encode the user's communication
 * patterns into a holographic memory. Enables instant (~0.2ms) retrieval
 * of relevant vocabulary, phrases, and context — works offline.
 *
 * Integration points:
 *   1. Phrase prediction: encode recently spoken phrases → probe for context
 *   2. Symbol surfacing: encode category usage patterns → surface relevant symbols
 *   3. TTS voice: encode voice preference by context (e.g. serious for medical)
 *
 * This is ADDITIVE — the existing prediction engine continues to work.
 * HRR adds a fast contextual layer on top.
 */

let _hologram: any = null;
let _ready = false;

const STORAGE_KEY = 'prism-aac-hrr-hologram';
const CONCEPTS_KEY = 'prism-aac-hrr-concepts';
const DIM = 1024;

/**
 * Initialize HRR for AAC. Loads from localStorage if available.
 * Returns false if WASM not supported (graceful degradation).
 */
export async function initAacHrr(): Promise<boolean> {
    if (_ready) return true;
    try {
        // Dynamic import — only loads the 229KB WASM when called
        const { HrrHologram } = await import('@synalux/hrr');
        _hologram = new HrrHologram(DIM);

        // Restore from localStorage
        const saved = localStorage.getItem(STORAGE_KEY);
        if (saved) {
            try {
                const arr = JSON.parse(saved);
                _hologram.import_hologram(arr);
            } catch { /* corrupt data — start fresh */ }
        }

        _ready = true;
        return true;
    } catch {
        // WASM not available (old browser, restricted CSP)
        return false;
    }
}

/**
 * Record a spoken phrase for contextual learning.
 * Called after the user speaks via the AAC board.
 */
export function recordPhrase(phrase: string, context?: {
    category?: string;
    timeOfDay?: string;
    tone?: string;
}): void {
    if (!_hologram || !_ready) return;

    const conceptParts = [phrase];
    if (context?.category) conceptParts.push(`cat:${context.category}`);
    if (context?.timeOfDay) conceptParts.push(`time:${context.timeOfDay}`);
    if (context?.tone) conceptParts.push(`tone:${context.tone}`);

    const concept = conceptParts.join('|');
    _hologram.encode(concept, phrase);
    schedulePersist();
}

/**
 * Get contextually relevant phrases based on current state.
 * ~0.2ms — safe to call on every keystroke.
 */
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
            phrase: r.concept.split('|')[0], // Extract the phrase part
            relevance: r.similarity,
        }));
}

/**
 * Check if HRR is ready.
 */
export function isAacHrrReady(): boolean {
    return _ready;
}

// ─── Persistence (debounced to localStorage) ──────────────────

let _persistTimer: ReturnType<typeof setTimeout> | null = null;

function schedulePersist(): void {
    if (_persistTimer) return;
    _persistTimer = setTimeout(() => {
        _persistTimer = null;
        if (!_hologram) return;
        try {
            const data = _hologram.export_hologram();
            localStorage.setItem(STORAGE_KEY, JSON.stringify(Array.from(data)));
        } catch {
            // localStorage full or unavailable — non-fatal
        }
    }, 5_000);
}
