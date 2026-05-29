/**
 * Mock @synalux/hrr WASM package for testing.
 */

interface EncodeEntry { summary: string }

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

        for (const [concept, summary] of this.concepts) {
            if (concept === query) {
                results.push({ concept: summary, similarity: 0.72 });
            }
        }

        return results.slice(0, topK);
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
