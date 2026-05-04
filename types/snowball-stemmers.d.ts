// Type declaration for `snowball-stemmers` (no upstream types).
// The package exports a single CJS factory: newStemmer(algorithm) → { stem }.
// See engine/stemmers/snowball.ts for the supported algorithm list.

declare module 'snowball-stemmers' {
  export interface Stemmer {
    stem(word: string): string;
  }
  export function newStemmer(algorithm: string): Stemmer;
  export function algorithms(): string[];
  const _default: { newStemmer: typeof newStemmer; algorithms: typeof algorithms };
  export default _default;
}
