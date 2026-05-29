/**
 * Mock synalux-hrr WASM package for testing.
 * Matches real WASM behavior: probe() returns concept KEYS,
 * get_summary() looks up the stored summary for a key.
 */

export class HrrHologram {
    dim: number;
    private concepts: Map<string, string>;
    private hologram: number[];

    constructor(dim: number) {
        this.dim = dim;
        this.concepts = new Map();
        this.hologram = new Array(dim).fill(0);
    }

    encode(concept: string, summary: string) {
        this.concepts.set(concept, summary);
    }

    probe(query: string, topK: number) {
        const results: Array<{ concept: string; similarity: number }> = [];

        for (const [concept] of this.concepts) {
            if (concept === query) {
                results.push({ concept, similarity: 0.72 });
            }
        }

        return results.slice(0, topK);
    }

    get_summary(concept: string): string | null {
        return this.concepts.get(concept) || null;
    }

    export_hologram() {
        return this.hologram;
    }

    import_hologram(data: number[]) {
        this.hologram = [...data];
    }

    clear() {
        this.concepts.clear();
    }
}
