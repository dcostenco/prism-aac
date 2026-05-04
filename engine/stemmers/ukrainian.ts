// Lightweight Ukrainian stemmer — suffix-stripping heuristic.
//
// Ukrainian has no high-quality browser-friendly morphological analyzer
// (pymorphy2 / lang-uk Python tools have no JS port; @nlpjs/lang-uk pulls
// in 180KB of dependencies for one rule-based stemmer). Russian Snowball
// is a poor proxy — UK and RU diverge in ~30% of common suffixes (UK -ї,
// -ою, -ій, -ються vs RU -ий, -ою, -ой, -ются).
//
// This implementation strips the most common UK inflectional endings in
// descending length order. It's intentionally conservative: when in doubt,
// leave the suffix on rather than over-stem (which would merge unrelated
// words). Quality target: group obvious inflections (думати/думав/думають
// → "дума") while never producing a stem shorter than 3 characters.
//
// References:
//  - Ukrainian morphology: Vasyl' Starko (2018), "Ukrainian morphological
//    annotation"
//  - Common suffixes from lang-uk dictionary, ranked by frequency

// Suffixes ordered longest-first so greedy match takes the most-specific.
// Grouped by part of speech for auditability.
const UK_SUFFIXES = [
  // Verbs: infinitive, reflexive, present/past, conditional
  'ються', 'ються', 'ються', 'ємось', 'ємося',
  'ються', 'ятимуть', 'имуть', 'утимуть',
  'ться', 'ться', 'тися', 'тимо', 'тиму', 'тимеш', 'тиме',
  'ємо', 'ете', 'ить', 'ать', 'ять', 'уть', 'ють',
  'ила', 'или', 'ило', 'ивши', 'учи', 'ючи',
  'ала', 'али', 'ало', 'явши',
  'еш', 'еш', 'ти', 'ть', 'тися', 'ться', 'в', 'ла', 'ло', 'ли',
  // Nouns/adjectives: case endings (genitive, dative, accusative, locative, instrumental)
  'ами', 'ями', 'ові', 'еві', 'ого', 'ому', 'ою', 'ій', 'ій',
  'ів', 'ям', 'ах', 'ях', 'их', 'ім', 'им',
  // Short endings (least specific — last in match order)
  'у', 'ю', 'а', 'я', 'о', 'е', 'и', 'і', 'ї', 'ь',
];

// Sort once at module load: longest first.
const UK_SUFFIXES_SORTED = [...new Set(UK_SUFFIXES)].sort((a, b) => b.length - a.length);

const MIN_STEM_LEN = 3;

export function ukStem(word: string): string {
  const lc = word.toLowerCase();
  for (const suf of UK_SUFFIXES_SORTED) {
    if (lc.length - suf.length >= MIN_STEM_LEN && lc.endsWith(suf)) {
      return lc.slice(0, lc.length - suf.length);
    }
  }
  return lc;
}
