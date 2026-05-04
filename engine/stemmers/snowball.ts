// Snowball stemmer wrappers for languages where the upstream
// `snowball-stemmers` package ships a working algorithm. The package is a
// single ~84KB file containing all 24 Snowball algorithms, so importing one
// stemmer pulls the whole bundle. We accept that — split across language
// chunks the cost is amortized; alternative (vendoring per-lang JS files)
// would save ~50KB but at the cost of maintenance burden.
//
// Quality verified empirically (see tests/stemmers.test.ts):
//   ru: думать/думал/думают → дума ✓; дуб/дубль → дуб/дубл (distinct) ✓
//   en: running/runs → run ✓; ran → ran (irregular, not lemmatized — ok)
//   es: hablar/hablo/hablamos → habl ✓
//   fr: parler/parle/parlons → parl ✓
//   pt: falar/falo/falamos → fal ✓
//   de: sprechen/spreche → sprech ✓; sprach → sprach (no past→present) — ok
//   ro: REQUIRES Unicode pre-normalization (ș/ț → ş/ţ) due to a bug in the
//       JS-compiled Romanian algorithm; see normalizeRomanian below.
//   ar: strips ال definite article and common verb/noun affixes; quality is
//       coarser than full root-and-pattern morphology but adequate for
//       diversity grouping (e.g. الكتاب → كتاب).

import sb from 'snowball-stemmers';

// snowball-stemmers exports newStemmer + algorithms (CJS shape). Some bundlers
// expose the default, some the namespace — handle both.
type SnowballFactory = {
  newStemmer: (algo: string) => { stem: (word: string) => string };
};
const factory: SnowballFactory =
  ((sb as unknown as { default?: SnowballFactory }).default ??
    (sb as unknown as SnowballFactory));

const ALGO_BY_LANG: Record<string, string> = {
  en: 'english',
  es: 'spanish',
  fr: 'french',
  pt: 'portuguese',
  de: 'german',
  ro: 'romanian',
  ru: 'russian',
  ar: 'arabic',
};

// Cache instances — newStemmer() allocates an internal SnowballProgram each
// time, costing ~50µs. With caching, stem() is O(word length).
const cache = new Map<string, (w: string) => string>();

// Romanian Snowball expects legacy cedilla diacritics (ş U+015F, ţ U+0163)
// but modern Unicode text uses comma-below (ș U+0219, ț U+021B). The
// JS-compiled algorithm doesn't normalize internally, so vorbește (modern)
// stems to vorbeșt (broken) while vorbeşte (legacy) stems to vorb (correct).
// Pre-map modern → legacy before stemming.
function normalizeRomanian(word: string): string {
  return word.replace(/ș/g, 'ş').replace(/Ș/g, 'Ş')
             .replace(/ț/g, 'ţ').replace(/Ț/g, 'Ţ');
}

export function getSnowballStemmer(lang: string): ((w: string) => string) | null {
  const algo = ALGO_BY_LANG[lang];
  if (!algo) return null;
  let fn = cache.get(lang);
  if (fn) return fn;
  const inst = factory.newStemmer(algo);
  if (lang === 'ro') {
    fn = (w: string) => inst.stem(normalizeRomanian(w));
  } else {
    fn = (w: string) => inst.stem(w);
  }
  cache.set(lang, fn);
  return fn;
}
