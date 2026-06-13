/**
 * Language Grammar Rules — Per-language phrase composition rules for PrismAAC.
 *
 * Two layers:
 *   1. LANGUAGE_RULES — static table: word order, particles, script info for all 24 languages
 *   2. applyGrammarRules() — runtime post-processor applied after offline word-by-word translation
 *
 * The post-processor currently handles:
 *   • Mid-sentence lowercase for Slavic (ru, uk, pl) and certain others
 *   • Infinitive particle substitution / deletion
 *   • RTL Unicode isolate wrapping (ar, he)
 *   • Verb-final reordering hint for SOV languages (ja, ko, tr, hi)
 *
 * Extensions: add new post-processing steps here; translateService.ts calls
 * applyGrammarRules(joined, toLang) after the word-loop completes.
 */
import { SupportedLanguage } from '@/engine/i18n';

// ─────────────────────────────────────────────────────────────────────────────
// Static rule table
// ─────────────────────────────────────────────────────────────────────────────

export type WordOrder = 'SVO' | 'SOV' | 'VSO' | 'VOS' | 'flex';

export interface LanguageRule {
  code: SupportedLanguage;
  name: string;
  nativeName: string;
  wordOrder: WordOrder;
  rtl: boolean;
  hasGender: boolean;
  /** Number of grammatical cases (0 = analytical/no cases) */
  cases: number;
  /**
   * Infinitive particle to use before verb stems.
   *   ''     = drop the English "to" entirely  (Russian, Ukrainian, Japanese, Korean, Turkish, Hindi, Polish)
   *   string = replace English "to" with this  (Romanian "să", German "zu", French "de", Spanish "de/a")
   *   null   = keep as-is / no rule            (Vietnamese, Indonesian, Tagalog)
   */
  infinitiveParticle: string | null;
  verbFinal: boolean;
  /** 'before'=prepended article | 'after'=suffix article (Romanian, Bulgarian) | 'none'=no article */
  articlePosition: 'before' | 'after' | 'none';
  lowercaseMidSentence: boolean;
  /** Polite/formal sentence-ending particle (empty = none) */
  sentenceFinalPolite: string;
  /** Script family — used for looksLikeTargetLang validation */
  scriptFamily: 'Latin' | 'Cyrillic' | 'Arabic' | 'Hebrew' | 'Devanagari' | 'Han' | 'Hiragana' | 'Hangul' | 'Thai' | 'Mixed';
  notes: string;
}

export const LANGUAGE_RULES: Record<SupportedLanguage, LanguageRule> = {
  en: {
    code: 'en', name: 'English', nativeName: 'English',
    wordOrder: 'SVO', rtl: false, hasGender: false, cases: 0,
    infinitiveParticle: 'to', verbFinal: false, articlePosition: 'before',
    lowercaseMidSentence: false, sentenceFinalPolite: '',
    scriptFamily: 'Latin',
    notes: 'Baseline SVO. No post-processing needed.',
  },
  es: {
    code: 'es', name: 'Spanish', nativeName: 'Español',
    wordOrder: 'SVO', rtl: false, hasGender: true, cases: 0,
    infinitiveParticle: 'de', verbFinal: false, articlePosition: 'before',
    lowercaseMidSentence: false, sentenceFinalPolite: '',
    scriptFamily: 'Latin',
    notes: 'Gender agreement on adjectives/articles. Adjective usually follows noun. Negation: no + verb.',
  },
  fr: {
    code: 'fr', name: 'French', nativeName: 'Français',
    wordOrder: 'SVO', rtl: false, hasGender: true, cases: 0,
    infinitiveParticle: 'de', verbFinal: false, articlePosition: 'before',
    lowercaseMidSentence: false, sentenceFinalPolite: '',
    scriptFamily: 'Latin',
    notes: 'Gender agreement. Adjective follows noun for most descriptors. ne…pas negation.',
  },
  pt: {
    code: 'pt', name: 'Portuguese', nativeName: 'Português',
    wordOrder: 'SVO', rtl: false, hasGender: true, cases: 0,
    infinitiveParticle: 'de', verbFinal: false, articlePosition: 'before',
    lowercaseMidSentence: false, sentenceFinalPolite: '',
    scriptFamily: 'Latin',
    notes: 'Similar to Spanish. Personal infinitive unique to Portuguese (conjugated infinitive).',
  },
  ro: {
    code: 'ro', name: 'Romanian', nativeName: 'Română',
    wordOrder: 'SVO', rtl: false, hasGender: true, cases: 2,
    infinitiveParticle: 'să', verbFinal: false, articlePosition: 'after',
    lowercaseMidSentence: false, sentenceFinalPolite: '',
    scriptFamily: 'Latin',
    notes: 'Post-fixed definite article (casă → casa). Subjunctive particle "să" before verbs. ' +
      '2 cases (nominative-accusative / genitive-dative). Neuter gender (behaves masc sg, fem pl).',
  },
  ru: {
    code: 'ru', name: 'Russian', nativeName: 'Русский',
    wordOrder: 'flex', rtl: false, hasGender: true, cases: 6,
    infinitiveParticle: '', verbFinal: false, articlePosition: 'none',
    lowercaseMidSentence: true, sentenceFinalPolite: '',
    scriptFamily: 'Cyrillic',
    notes: 'Drop infinitive "to" — Russian uses bare infinitive. No articles. 6 cases. ' +
      'Flexible word order. Lowercase mid-sentence to prevent ALL-CAPS artifact from dict entries.',
  },
  uk: {
    code: 'uk', name: 'Ukrainian', nativeName: 'Українська',
    wordOrder: 'flex', rtl: false, hasGender: true, cases: 7,
    infinitiveParticle: '', verbFinal: false, articlePosition: 'none',
    lowercaseMidSentence: true, sentenceFinalPolite: '',
    scriptFamily: 'Cyrillic',
    notes: 'Same as Russian for offline translation purposes. 7 cases. No articles.',
  },
  de: {
    code: 'de', name: 'German', nativeName: 'Deutsch',
    wordOrder: 'SVO', rtl: false, hasGender: true, cases: 4,
    infinitiveParticle: 'zu', verbFinal: true, articlePosition: 'before',
    lowercaseMidSentence: false, sentenceFinalPolite: '',
    scriptFamily: 'Latin',
    notes: 'V2 word order: verb is always second constituent in main clause. ' +
      'Subordinate clauses are verb-final. 4 cases (Nominativ, Akkusativ, Dativ, Genitiv). ' +
      'All nouns capitalized. 3 genders (der/die/das). Separable verbs.',
  },
  ja: {
    code: 'ja', name: 'Japanese', nativeName: '日本語',
    wordOrder: 'SOV', rtl: false, hasGender: false, cases: 0,
    infinitiveParticle: '', verbFinal: true, articlePosition: 'none',
    lowercaseMidSentence: false, sentenceFinalPolite: 'ます',
    scriptFamily: 'Hiragana',
    notes: 'SOV. Verb at clause end. Drop infinitive "to". Postpositions (particles): ' +
      'は/が subject, を object, に location/direction, で means/location, から from, まで until. ' +
      'Polite register: verb-ます, question: か. No spaces between words in running text.',
  },
  ko: {
    code: 'ko', name: 'Korean', nativeName: '한국어',
    wordOrder: 'SOV', rtl: false, hasGender: false, cases: 0,
    infinitiveParticle: '', verbFinal: true, articlePosition: 'none',
    lowercaseMidSentence: false, sentenceFinalPolite: '요',
    scriptFamily: 'Hangul',
    notes: 'SOV. Verb at end. Particles: 은/는 topic, 이/가 subject, 을/를 object, 에 location. ' +
      'Polite speech: 요 suffix. Honorifics affect verb forms. Question: ㅂ니까/요.',
  },
  zh: {
    code: 'zh', name: 'Chinese (Simplified)', nativeName: '中文(简体)',
    wordOrder: 'SVO', rtl: false, hasGender: false, cases: 0,
    infinitiveParticle: '', verbFinal: false, articlePosition: 'none',
    lowercaseMidSentence: false, sentenceFinalPolite: '',
    scriptFamily: 'Han',
    notes: 'SVO. No articles, no conjugation, no morphological cases. ' +
      'Aspect markers: 了(perfective), 过(experiential), 着(progressive). ' +
      'Measure words required between numerals and nouns. No spaces between characters.',
  },
  'zh-Hans': {
    code: 'zh-Hans', name: 'Chinese Simplified (Mainland)', nativeName: '中文(简体)',
    wordOrder: 'SVO', rtl: false, hasGender: false, cases: 0,
    infinitiveParticle: '', verbFinal: false, articlePosition: 'none',
    lowercaseMidSentence: false, sentenceFinalPolite: '',
    scriptFamily: 'Han',
    notes: 'Alias for zh. Simplified characters. Standard Mandarin (Putonghua).',
  },
  'zh-Hant': {
    code: 'zh-Hant', name: 'Chinese Traditional (Taiwan)', nativeName: '中文(繁體)',
    wordOrder: 'SVO', rtl: false, hasGender: false, cases: 0,
    infinitiveParticle: '', verbFinal: false, articlePosition: 'none',
    lowercaseMidSentence: false, sentenceFinalPolite: '',
    scriptFamily: 'Han',
    notes: 'Traditional characters. Same grammar as Simplified. ' +
      'Some vocabulary differs (e.g., 捷運 vs 地铁 for subway).',
  },
  'zh-HK': {
    code: 'zh-HK', name: 'Cantonese (Hong Kong)', nativeName: '廣東話(香港)',
    wordOrder: 'SVO', rtl: false, hasGender: false, cases: 0,
    infinitiveParticle: '', verbFinal: false, articlePosition: 'none',
    lowercaseMidSentence: false, sentenceFinalPolite: '',
    scriptFamily: 'Han',
    notes: 'Traditional characters, Cantonese phonology and vocabulary. ' +
      'Sentence-final particles: 喎(hearsay), 囉(assertion), 咋(only), 囉(dismissal). ' +
      'Some function words differ from Mandarin: 係(be), 喺(at/in), 嘅(possessive).',
  },
  ar: {
    code: 'ar', name: 'Arabic', nativeName: 'العربية',
    wordOrder: 'VSO', rtl: true, hasGender: true, cases: 3,
    infinitiveParticle: 'أن', verbFinal: false, articlePosition: 'before',
    lowercaseMidSentence: false, sentenceFinalPolite: '',
    scriptFamily: 'Arabic',
    notes: 'VSO default, SVO common in modern colloquial Arabic. RTL script. ' +
      'Definite article prefix: ال (al-, assimilated to sun letters). ' +
      'Grammatical gender (masc/fem). Dual form. Broken plurals. ' +
      'Root-pattern morphology. 3 cases (nominative, accusative, genitive). ' +
      'MSA (Modern Standard Arabic) used for formal writing.',
  },
  hi: {
    code: 'hi', name: 'Hindi', nativeName: 'हिन्दी',
    wordOrder: 'SOV', rtl: false, hasGender: true, cases: 0,
    infinitiveParticle: '', verbFinal: true, articlePosition: 'none',
    lowercaseMidSentence: false, sentenceFinalPolite: '',
    scriptFamily: 'Devanagari',
    notes: 'SOV. Postpositions follow nouns. No articles. Gender: masculine/feminine. ' +
      'Ergative-absolutive in perfective. Verb forms change for gender/number. ' +
      'Devanagari script. Polite: आप (aap) pronoun.',
  },
  it: {
    code: 'it', name: 'Italian', nativeName: 'Italiano',
    wordOrder: 'SVO', rtl: false, hasGender: true, cases: 0,
    infinitiveParticle: 'di', verbFinal: false, articlePosition: 'before',
    lowercaseMidSentence: false, sentenceFinalPolite: '',
    scriptFamily: 'Latin',
    notes: 'Subject pronouns usually dropped (pro-drop). Clitic pronouns attach to infinitives. ' +
      '2 genders (masc/fem). Adjective agrees with noun in gender and number.',
  },
  pl: {
    code: 'pl', name: 'Polish', nativeName: 'Polski',
    wordOrder: 'flex', rtl: false, hasGender: true, cases: 7,
    infinitiveParticle: '', verbFinal: false, articlePosition: 'none',
    lowercaseMidSentence: false, sentenceFinalPolite: '',
    scriptFamily: 'Latin',
    notes: '7 grammatical cases. Flexible word order (case-marked nouns). No articles. ' +
      'Drop infinitive particle. Aspect pairs (perfective/imperfective verbs). ' +
      '3 genders (masculine, feminine, neuter). Palatalization in declension.',
  },
  he: {
    code: 'he', name: 'Hebrew', nativeName: 'עברית',
    wordOrder: 'SVO', rtl: true, hasGender: true, cases: 0,
    infinitiveParticle: 'ל', verbFinal: false, articlePosition: 'before',
    lowercaseMidSentence: false, sentenceFinalPolite: '',
    scriptFamily: 'Hebrew',
    notes: 'RTL text. Definite article prefix: ה (ha-). Gender: masculine/feminine. ' +
      'Verb conjugates for gender, number, person. Root-and-pattern morphology (שורש). ' +
      'Modern Hebrew is predominantly SVO. Binyan verb patterns.',
  },
  nl: {
    code: 'nl', name: 'Dutch', nativeName: 'Nederlands',
    wordOrder: 'SVO', rtl: false, hasGender: true, cases: 0,
    infinitiveParticle: 'te', verbFinal: true, articlePosition: 'before',
    lowercaseMidSentence: false, sentenceFinalPolite: '',
    scriptFamily: 'Latin',
    notes: 'V2 word order (like German). Subordinate clauses: verb-final. ' +
      'Two genders: common (de) and neuter (het). Separable verbs. ' +
      'Diminutives with -je suffix common in speech.',
  },
  vi: {
    code: 'vi', name: 'Vietnamese', nativeName: 'Tiếng Việt',
    wordOrder: 'SVO', rtl: false, hasGender: false, cases: 0,
    infinitiveParticle: null, verbFinal: false, articlePosition: 'none',
    lowercaseMidSentence: false, sentenceFinalPolite: '',
    scriptFamily: 'Latin',
    notes: 'SVO. Tonal language (6 tones written with diacritics). No conjugation, no articles. ' +
      'Aspect: đã(past), đang(ongoing), sẽ(future) as pre-verbal markers. ' +
      'Classifiers required between numeral and noun. Personal pronouns indicate social relationship.',
  },
  tl: {
    code: 'tl', name: 'Filipino / Tagalog', nativeName: 'Filipino',
    wordOrder: 'VOS', rtl: false, hasGender: false, cases: 0,
    infinitiveParticle: null, verbFinal: false, articlePosition: 'none',
    lowercaseMidSentence: false, sentenceFinalPolite: '',
    scriptFamily: 'Latin',
    notes: 'Focus system: verb affixes encode which argument is "in focus" (actor, object, locative, benefactive). ' +
      'Common affixes: mag-/um- (actor focus), -in (patient focus), -an (locative focus), i- (benefactive focus). ' +
      'Linker: na/ng connects modifier to head. VOS is default but VSO and SVO also common. ' +
      'Ang = nominative marker. Ng = genitive/accusative marker. Sa = oblique marker.',
  },
  tr: {
    code: 'tr', name: 'Turkish', nativeName: 'Türkçe',
    wordOrder: 'SOV', rtl: false, hasGender: false, cases: 6,
    infinitiveParticle: '', verbFinal: true, articlePosition: 'none',
    lowercaseMidSentence: false, sentenceFinalPolite: '',
    scriptFamily: 'Latin',
    notes: 'Agglutinative SOV. Verb always at end. No grammatical gender. 6 cases. ' +
      'Vowel harmony governs suffixes. Drop infinitive particle. ' +
      'Negation: -me/-ma infix in verb. Question: mı/mi/mu/mü particle after verb.',
  },
  id: {
    code: 'id', name: 'Indonesian', nativeName: 'Bahasa Indonesia',
    wordOrder: 'SVO', rtl: false, hasGender: false, cases: 0,
    infinitiveParticle: null, verbFinal: false, articlePosition: 'none',
    lowercaseMidSentence: false, sentenceFinalPolite: '',
    scriptFamily: 'Latin',
    notes: 'SVO. Highly analytical — no articles, no tense inflection, no grammatical gender. ' +
      'Aspect: sudah/telah (completed), sedang (ongoing), akan (future) as pre-verbal markers. ' +
      'Derivation via prefixes (me-, di-, ber-) and suffixes (-kan, -an, -i). ' +
      'Most structurally similar to English among supported languages.',
  },
  bg: {
    code: 'bg', name: 'Bulgarian', nativeName: 'Български',
    wordOrder: 'SVO', rtl: false, hasGender: true, cases: 0,
    infinitiveParticle: 'да', verbFinal: false, articlePosition: 'after',
    lowercaseMidSentence: true, sentenceFinalPolite: '',
    scriptFamily: 'Cyrillic',
    notes: 'SVO. No case system (unique among Slavic languages). ' +
      'Definite article is a suffix (-ът/-та/-то/-те) appended to the first NP constituent. ' +
      'Three grammatical genders (m/f/n). Clitic doubling common (на мен ми). ' +
      'No infinitive — uses да + present tense (да ядем = to eat). ' +
      'Renarrative mood for reported speech.',
  },
};

// ─────────────────────────────────────────────────────────────────────────────
// Runtime post-processors
// ─────────────────────────────────────────────────────────────────────────────

/**
 * RTL languages: wrap with Unicode First Strong Isolate so the OS/browser
 * renders the string correctly when embedded in an LTR context (e.g. inside
 * a React div that uses ltr direction).
 */
const RTL_LANGS = new Set<SupportedLanguage>(['ar', 'he']);
const FSI = '⁨'; // First Strong Isolate
const PDI = '⁩'; // Pop Directional Isolate

/**
 * Languages where the offline dict produces ALL-CAPS artifacts because
 * dictionary entries begin with a capital letter (Cyrillic dictionaries
 * capitalise each entry). Mid-sentence words should be lowercased.
 *
 * We exempt the FIRST token since it may legitimately be sentence-initial cap.
 */
const LOWERCASE_MID = new Set<SupportedLanguage>(['ru', 'uk', 'pl', 'bg']);

/**
 * SOV languages where a simple heuristic can improve word order.
 * Full SOV reordering is not attempted for offline translation — the AI
 * refine step handles it. This flag gates future SOV heuristics.
 */
export const SOV_LANGS = new Set<SupportedLanguage>(['ja', 'ko', 'tr', 'hi']);

/**
 * Languages that drop the English infinitive particle "to".
 * Expanding: ru, uk, pl, ja, ko, tr, hi, zh (all its variants).
 */
export const DROP_INFINITIVE = new Set<SupportedLanguage>([
  'ru', 'uk', 'pl', 'ja', 'ko', 'tr', 'hi',
  'zh', 'zh-Hans', 'zh-Hant', 'zh-HK',
]);

/**
 * Languages that substitute a different infinitive particle for English "to".
 * Only used by getWordDict when building the "cw-to" mapping.
 */
export const INFINITIVE_SUBSTITUTION: Partial<Record<SupportedLanguage, string>> = {
  ro: 'Să',
  de: 'Zu',
  fr: 'De',
  es: 'De',
  pt: 'De',
  it: 'Di',
  nl: 'Te',
  he: 'ל',
  ar: 'أن',
};

/**
 * Apply all grammar post-processing rules for the target language.
 * Called by offlineTranslate() after the word-loop produces a joined string.
 *
 * Applies in order:
 *   1. Mid-sentence lowercase (Slavic/Polish)
 *   2. RTL isolation wrapper (Arabic, Hebrew)
 *
 * Future: SOV reordering, particle insertion, article agreement.
 */
export function applyGrammarRules(
  text: string,
  toLang: SupportedLanguage,
): string {
  let result = text;

  // 1. Mid-sentence lowercase — first token keeps dict cap, rest lowercase.
  if (LOWERCASE_MID.has(toLang)) {
    result = result.replace(
      /^(\S+)(\s+)(.+)$/,
      (_, first, space, rest) => first + space + rest.toLowerCase(),
    );
  }

  // 2. RTL directional isolate
  if (RTL_LANGS.has(toLang) && result.trim().length > 0) {
    result = `${FSI}${result.trim()}${PDI}`;
  }

  return result;
}

// ─────────────────────────────────────────────────────────────────────────────
// Convenience helpers
// ─────────────────────────────────────────────────────────────────────────────

export function getInfinitiveParticle(lang: SupportedLanguage): string | null {
  return LANGUAGE_RULES[lang]?.infinitiveParticle ?? null;
}

export function isRTL(lang: SupportedLanguage): boolean {
  return LANGUAGE_RULES[lang]?.rtl ?? false;
}

export function isVerbFinal(lang: SupportedLanguage): boolean {
  return LANGUAGE_RULES[lang]?.verbFinal ?? false;
}

export function needsMidSentenceLowercase(lang: SupportedLanguage): boolean {
  return LANGUAGE_RULES[lang]?.lowercaseMidSentence ?? false;
}

/** Returns the polite sentence-final particle, or '' if none. */
export function getSentenceFinalPolite(lang: SupportedLanguage): string {
  return LANGUAGE_RULES[lang]?.sentenceFinalPolite ?? '';
}

/** Returns the grammatical word-order style for a language. */
export function getWordOrder(lang: SupportedLanguage): WordOrder {
  return LANGUAGE_RULES[lang]?.wordOrder ?? 'SVO';
}

/**
 * Per-language grammar summary table — useful for UI display and AI prompt
 * construction. Shows key facts about each language in 1-2 sentences.
 */
export function getGrammarSummary(lang: SupportedLanguage): string {
  const r = LANGUAGE_RULES[lang];
  if (!r) return '';
  const order = r.wordOrder;
  const particle = r.infinitiveParticle === '' ? 'drops "to"' : r.infinitiveParticle ? `uses "${r.infinitiveParticle}" for "to"` : 'keeps "to"';
  const rtlNote = r.rtl ? ' RTL script.' : '';
  const caseNote = r.cases > 0 ? ` ${r.cases} grammatical cases.` : '';
  return `${r.name} (${r.nativeName}): ${order} word order, ${particle}.${caseNote}${rtlNote}`;
}
