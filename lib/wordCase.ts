/** Locale-aware folding, including keys produced by earlier generic Turkish folding. */
export function foldPictureWordCase(word: string, lang: string): string {
  return lang === 'tr' ? word.toLocaleLowerCase('tr').replace(/i\u0307/g, 'i') : word.toLowerCase();
}
