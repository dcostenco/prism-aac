// Build AAC core word lists per language by extracting Universal Core 36
// keys from Cboard's translation JSONs. This generates frozen, committed
// TypeScript files at constants/aacCore/<lang>.ts — no runtime fetch.
//
// Source data:
//   github.com/cboard-org/cboard/src/translations/<locale>.json (GPLv3)
//   Pull a snapshot to /tmp/cboard/<locale>.json before running this script.
//
// Universal Core 36 (Geist, Erickson et al., ATIA 2021):
//   like, want, get, make, good, more, not, go, look, turn, help, different,
//   I, he, open, do, put, same, you, she, that, up, all, some, it, here,
//   in, on, can, finished, where, what, why, who, when, stop
//
// Of these, Cboard ships symbol translations for 28 (the 8 missing —
// all/finished/stop/not/here/like/do/can — are not in Cboard's symbol set
// and are omitted from the output). The output list is enough for the
// prediction-bar fallback (5-10 entries needed; we have 28).

import fs from 'node:fs';
import path from 'node:path';

const SRC_DIR = '/tmp/cboard';
const OUT_DIR = path.resolve(import.meta.dirname, '..', 'constants', 'aacCore');

// Map our app's lang code → Cboard locale file
const LOCALE_MAP = {
  en: 'en-US.json',
  es: 'es-ES.json',
  fr: 'fr-FR.json',
  pt: 'pt-BR.json',
  de: 'de-DE.json',
  ro: 'ro-RO.json',
  ru: 'ru-RU.json',
  uk: 'uk-UA.json',
  ar: 'ar-SA.json',
  ja: 'ja-JP.json',
  ko: 'ko-KR.json',
  'zh-Hans': 'zh-CN.json',
  'zh-Hant': 'zh-TW.json',
  'zh-HK': 'zh-HK.json',
};

// Universal Core 36 → Cboard symbol key candidates (in priority order).
// Order in this object reflects AAC priority for prediction-bar fallback:
// pronouns and high-frequency requesters first, modifiers/questions later.
const CORE36_KEYS = [
  ['I', ['symbol.pronouns.I']],
  ['you', ['symbol.pronouns.you']],
  ['more', ['symbol.descriptiveQuantity.more']],
  ['want', ['symbol.peopleActions.toWant']],
  ['help', ['symbol.peopleActions.toHelp']],
  ['go', ['symbol.peopleActions.toGo']],
  ['look', ['symbol.peopleActions.toLook']],
  ['make', ['symbol.peopleActions.toMake']],
  ['get', ['symbol.peopleActions.toGet']],
  ['put', ['symbol.peopleActions.toPut']],
  ['turn', ['symbol.peopleActions.toTurn']],
  ['good', ['symbol.descriptiveState.good']],
  ['same', ['symbol.descriptiveQuantity.same']],
  ['different', ['symbol.descriptiveQuantity.different']],
  ['some', ['symbol.descriptiveQuantity.some']],
  ['open', ['symbol.descriptiveState.open']],
  ['up', ['symbol.descriptiveDirection.up']],
  ['in', ['symbol.descriptivePosition.in']],
  ['on', ['symbol.descriptivePosition.on']],
  ['he', ['symbol.pronouns.he']],
  ['she', ['symbol.pronouns.she']],
  ['it', ['symbol.pronouns.it']],
  ['that', ['symbol.pronouns.that']],
  ['who', ['symbol.pronouns.who', 'symbol.question.who']],
  ['what', ['symbol.question.what']],
  ['when', ['symbol.question.when']],
  ['where', ['symbol.question.where']],
  ['why', ['symbol.question.why']],
];

// Strip Cboard's "to <verb>" prefix in any language. The key signals an
// action; the prediction bar shows the verb stem, not the infinitive marker.
const TO_PREFIXES = [
  /^to\s+/i,           // English
  /^a\s+/i,            // Spanish/Italian (a hablar) — careful, may over-strip; we only apply when value matches a known toX key
  /^[àaä]\s+/i,        // French (à parler)
  /^für\s+/i,          // German (rare)
  /^para\s+/i,         // Portuguese
  /^pentru\s+a\s+/i,   // Romanian
];

// Per-locale "to X" prefix patterns. Cboard's verb keys store the
// infinitive marker as part of the value. We strip the language-appropriate
// marker so the prediction bar shows clean root forms (parler → parler is
// fine; to want → want; querer is fine; нет инфинитивных маркеров in ru/uk).
const VERB_PREFIX_BY_LANG = {
  en: /^to\s+/i,
  es: null,           // Spanish infinitive ends in -ar/-er/-ir; no prefix marker
  fr: null,           // French infinitive form is itself the lemma
  pt: null,
  de: null,
  ro: null,           // Romanian "a + verb" sometimes used; Cboard stores plain verb
  ru: null,
  uk: null,
  ar: null,
  ja: null,
  ko: null,
  'zh-Hans': null,
  'zh-Hant': null,
  'zh-HK': null,
};

function stripVerbPrefix(value, lang) {
  const re = VERB_PREFIX_BY_LANG[lang];
  if (re) return value.replace(re, '').trim();
  return value.trim();
}

// Capitalize first letter for cased scripts. No-op for uncased
// (Arabic, CJK). For Korean, sentence-cap is also a no-op (no case).
function sentenceCap(word) {
  if (!word) return word;
  const first = word.charAt(0);
  const upper = first.toLocaleUpperCase();
  if (first === upper) return word; // already cased or uncased script
  return upper + word.slice(1);
}

// Per-language script filter (matches characters valid in the language's
// script). Used to reject Cboard values that are clearly untranslated
// English bleed-through (e.g. ru-RU returning "I" for symbol.pronouns.I).
const SCRIPT_FILTER = {
  ru: /^[а-яё'\-\s]+$/i,
  uk: /^[а-яєіїґ'\-\s]+$/i,
  ar: /^[؀-ۿݐ-ݿ'\-\s]+$/,
  ja: /^[぀-ゟ゠-ヿ一-鿿'\-\s]+$/,
  ko: /^[가-힯ᄀ-ᇿ㄰-㆏'\-\s]+$/,
  'zh-Hans': /^[一-鿿'\-\s]+$/,
  'zh-Hant': /^[一-鿿'\-\s]+$/,
  'zh-HK': /^[一-鿿'\-\s]+$/,
  // Latin-script European langs: must contain at least one accented letter
  // OR differ from the English source (handled separately as untranslated check).
  // We don't enforce a positive script filter for these because the regex
  // would accept legit English bleed-through ("I" matches /^[a-z]+$/i).
  es: /^[a-zñáéíóúü'\-\s]+$/i,
  fr: /^[a-zàâäçéèêëîïôœùûüÿ'\-\s]+$/i,
  de: /^[a-zäöüß'\-\s]+$/i,
  pt: /^[a-záàâãçéêíóôõú'\-\s]+$/i,
  ro: /^[a-zăâîșțşţ'\-\s]+$/i,
  en: /^[a-z'\-\s]+$/i,
};

// Reject Cboard values that look untranslated (identical to English source)
// or off-script for the target language. Returns null when the value is
// unfit; trims+passes through otherwise.
function validate(value, coreEn, lang, enValue) {
  if (!value || !value.trim()) return null;
  const v = value.trim();
  // Identical to English source = translator left it untranslated.
  // For English itself, identical IS correct.
  if (lang !== 'en' && enValue && v.toLowerCase() === enValue.trim().toLowerCase()) {
    return null;
  }
  // Off-script: rejects e.g. "ص" (single Arabic letter) when our regex
  // requires multi-char, or "В" Cyrillic letter for ru when the value is
  // suspiciously short. We use a heuristic: <2 chars AND English is >=2
  // chars = likely a placeholder/typo.
  // CJK languages can have legitimate single-character core words
  // (我 = I, 너 = you, 더 = more). Latin/Cyrillic single-letter values are
  // suspect placeholders unless the English source is also single-letter.
  const isCjkOrKorean = ['zh-Hans', 'zh-Hant', 'zh-HK', 'ja', 'ko'].includes(lang);
  if (v.length < 2 && coreEn.length >= 2 && !isCjkOrKorean) {
    return null;
  }
  // Apply per-language script filter when defined.
  const re = SCRIPT_FILTER[lang];
  if (re && !re.test(v)) return null;
  return v;
}

// Load corrections overlay — fixes known-bad Cboard entries with cited
// authoritative sources (Wiktionary). Applied AFTER Cboard lookup but
// BEFORE validation, so corrections always win.
const CORRECTIONS = JSON.parse(
  fs.readFileSync(path.resolve(import.meta.dirname, 'aac_core_corrections.json'), 'utf8')
);

function buildForLang(lang, localeFile, enJson) {
  const srcPath = path.join(SRC_DIR, localeFile);
  if (!fs.existsSync(srcPath)) {
    console.warn(`[skip] ${lang}: ${localeFile} not found`);
    return null;
  }
  const raw = fs.readFileSync(srcPath, 'utf8');
  if (raw.length < 100) {
    console.warn(`[skip] ${lang}: ${localeFile} looks empty/404 (${raw.length} bytes)`);
    return null;
  }
  const j = JSON.parse(raw);
  const corrections = CORRECTIONS[lang] ?? {};

  const words = [];
  const rejects = [];
  const corrected = [];
  for (const [coreEn, keys] of CORE36_KEYS) {
    let value = null;
    let matchedKey = null;
    for (const k of keys) {
      // Apply correction if one exists for this key.
      if (corrections[k]) {
        value = corrections[k].value;
        matchedKey = k;
        corrected.push(`${coreEn}="${value}" (${corrections[k].source})`);
        break;
      }
      if (typeof j[k] === 'string' && j[k].trim()) {
        value = stripVerbPrefix(j[k], lang);
        matchedKey = k;
        break;
      }
    }
    if (!value) continue;
    // If we applied a correction, skip validation (it's the authoritative answer).
    if (corrections[matchedKey]) {
      if (!words.includes(value)) words.push(value);
      continue;
    }
    const enValue = matchedKey ? enJson[matchedKey] : null;
    const validated = validate(value, coreEn, lang, enValue);
    if (!validated) {
      rejects.push(`${coreEn}="${value}"`);
      continue;
    }
    if (!words.includes(validated)) words.push(validated);
  }
  if (corrected.length) {
    console.log(`  [${lang}] applied ${corrected.length} correction(s): ${corrected.join('; ')}`);
  }
  if (rejects.length) {
    console.warn(`  [${lang}] rejected ${rejects.length}: ${rejects.slice(0, 5).join(', ')}${rejects.length > 5 ? ', …' : ''}`);
  }
  return words.map(sentenceCap);
}

const indexLines = [
  '// Auto-generated by scripts/build_aac_core.mjs from Cboard translations.',
  '// Source: github.com/cboard-org/cboard (GPLv3) — symbol.* keys',
  '// Reference list: Universal Core 36 (Geist, Erickson et al., ATIA 2021)',
  '// Run: node scripts/build_aac_core.mjs',
  '',
  "import { SupportedLanguage } from '@/engine/i18n';",
  '',
];

// Load English JSON first so we can detect untranslated bleed-through
// (locales where a key was left identical to the English source).
const enJson = JSON.parse(fs.readFileSync(path.join(SRC_DIR, 'en-US.json'), 'utf8'));

const langExports = [];
const generated = {};
for (const [lang, locale] of Object.entries(LOCALE_MAP)) {
  const words = buildForLang(lang, locale, enJson);
  if (!words) continue;
  generated[lang] = words;
  langExports.push(`  '${lang}': ${JSON.stringify(words, null, 2).replace(/\n/g, '\n  ')},`);
  console.log(`[${lang}] ${words.length} core words: ${words.slice(0, 5).join(', ')}...`);
}

const outFile = path.join(OUT_DIR, 'index.ts');
const content = indexLines.join('\n') +
`export const AAC_CORE_BY_LANG: Partial<Record<SupportedLanguage, string[]>> = {
${langExports.join('\n')}
};

// Some lang codes alias to a canonical entry — e.g. 'zh' is a back-compat
// alias for 'zh-Hans' (Simplified Mandarin) and uses the same translations.
const ALIAS: Partial<Record<SupportedLanguage, SupportedLanguage>> = {
  zh: 'zh-Hans',
};

/**
 * Returns AAC core vocabulary for a language, ranked by communicative
 * priority (pronouns, requesters, verbs, modifiers, questions).
 *
 * Used as the prediction-bar fallback when the prediction engine produces
 * fewer than \`maxResults\` candidates (e.g. on first session, or when the
 * user has typed a partial that filters out most of the corpus).
 *
 * Falls back to the English list when the requested language has no
 * Universal Core 36 mapping. Returned list contains 20-28 words per
 * language; callers should slice to the slot count they need.
 */
export function getAacCoreFor(lang: SupportedLanguage): string[] {
  const resolved = ALIAS[lang] ?? lang;
  return AAC_CORE_BY_LANG[resolved] ?? AAC_CORE_BY_LANG.en ?? [];
}
`;

fs.writeFileSync(outFile, content);
console.log(`\nWrote ${outFile}`);
console.log(`Total languages: ${Object.keys(generated).length}`);
