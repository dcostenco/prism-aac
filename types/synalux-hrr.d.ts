declare module 'synalux-hrr' {
  export class HrrHologram {
    constructor(dim: number);
    encode(word: string): Float32Array;
    bind(a: Float32Array, b: Float32Array): Float32Array;
    bundle(vectors: Float32Array[]): Float32Array;
    probe(memory: Float32Array, query: Float32Array, topK?: number): Array<{ word: string; score: number }>;
    get_summary(): string;
    similarity(a: Float32Array, b: Float32Array): number;
  }
}
