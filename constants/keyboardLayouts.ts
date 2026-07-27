import { SupportedLanguage } from '@/engine/i18n';

const QWERTY: string[][] = [
  ['Q', 'W', 'E', 'R', 'T', 'Y', 'U', 'I', 'O', 'P'],
  ['A', 'S', 'D', 'F', 'G', 'H', 'J', 'K', 'L'],
  ['Z', 'X', 'C', 'V', 'B', 'N', 'M'],
];

const LAYOUTS_BY_LANG: Partial<Record<SupportedLanguage, string[][]>> = {
  ro: [
    ['Q', 'W', 'E', 'R', 'T', 'Y', 'U', 'I', 'O', 'P'],
    ['A', 'S', 'D', 'F', 'G', 'H', 'J', 'K', 'L'],
    ['Z', 'X', 'C', 'V', 'B', 'N', 'M', 'Ă', 'Â', 'Î', 'Ș', 'Ț'],
  ],
  de: [
    ['Q', 'W', 'E', 'R', 'T', 'Z', 'U', 'I', 'O', 'P', 'Ü'],
    ['A', 'S', 'D', 'F', 'G', 'H', 'J', 'K', 'L', 'Ö', 'Ä'],
    ['Y', 'X', 'C', 'V', 'B', 'N', 'M', 'ß'],
  ],
  fr: [
    ['A', 'Z', 'E', 'R', 'T', 'Y', 'U', 'I', 'O', 'P'],
    ['Q', 'S', 'D', 'F', 'G', 'H', 'J', 'K', 'L', 'M'],
    ['W', 'X', 'C', 'V', 'B', 'N', 'É', 'È', 'Ê', 'Ç'],
  ],
  es: [
    ['Q', 'W', 'E', 'R', 'T', 'Y', 'U', 'I', 'O', 'P'],
    ['A', 'S', 'D', 'F', 'G', 'H', 'J', 'K', 'L', 'Ñ'],
    ['Z', 'X', 'C', 'V', 'B', 'N', 'M'],
  ],
  pt: [
    ['Q', 'W', 'E', 'R', 'T', 'Y', 'U', 'I', 'O', 'P'],
    ['A', 'S', 'D', 'F', 'G', 'H', 'J', 'K', 'L', 'Ç'],
    ['Z', 'X', 'C', 'V', 'B', 'N', 'M', 'Ã', 'Õ'],
  ],
  it: [
    ['Q', 'W', 'E', 'R', 'T', 'Y', 'U', 'I', 'O', 'P'],
    ['A', 'S', 'D', 'F', 'G', 'H', 'J', 'K', 'L'],
    ['Z', 'X', 'C', 'V', 'B', 'N', 'M', 'À', 'È', 'É', 'Ì', 'Ò', 'Ù'],
  ],
  // Polish — full diacritic set in extra row 4 so AAC users don't need
  // long-press combos. Order matches Polish keyboard convention.
  pl: [
    ['Q', 'W', 'E', 'R', 'T', 'Y', 'U', 'I', 'O', 'P'],
    ['A', 'S', 'D', 'F', 'G', 'H', 'J', 'K', 'L'],
    ['Z', 'X', 'C', 'V', 'B', 'N', 'M'],
    ['Ą', 'Ć', 'Ę', 'Ł', 'Ń', 'Ó', 'Ś', 'Ź', 'Ż'],
  ],
  nl: [
    ['Q', 'W', 'E', 'R', 'T', 'Y', 'U', 'I', 'O', 'P'],
    ['A', 'S', 'D', 'F', 'G', 'H', 'J', 'K', 'L'],
    ['Z', 'X', 'C', 'V', 'B', 'N', 'M', 'IJ'],
  ],
  tr: [
    ['Q', 'W', 'E', 'R', 'T', 'Y', 'U', 'I', 'O', 'P', 'Ğ', 'Ü'],
    ['A', 'S', 'D', 'F', 'G', 'H', 'J', 'K', 'L', 'Ş', 'İ'],
    ['Z', 'X', 'C', 'V', 'B', 'N', 'M', 'Ö', 'Ç'],
  ],
  vi: [
    ['Q', 'W', 'E', 'R', 'T', 'Y', 'U', 'I', 'O', 'P'],
    ['A', 'S', 'D', 'F', 'G', 'H', 'J', 'K', 'L'],
    ['Z', 'X', 'C', 'V', 'B', 'N', 'M'],
    ['Ă', 'Â', 'Đ', 'Ê', 'Ô', 'Ơ', 'Ư'],
  ],
  hi: [
    ['ौ', 'ै', 'ा', 'ी', 'ू', 'ब', 'ह', 'ग', 'द', 'ज', 'ड'],
    ['ो', 'े', '्', 'ि', 'ु', 'प', 'र', 'क', 'त', 'च', 'ट'],
    ['ं', 'म', 'न', 'व', 'ल', 'स', 'य'],
  ],
  he: [
    ['ק', 'ר', 'א', 'ט', 'ו', 'ן', 'ם', 'פ'],
    ['ש', 'ד', 'ג', 'כ', 'ע', 'י', 'ח', 'ל', 'ך', 'ף'],
    ['ז', 'ס', 'ב', 'ה', 'נ', 'מ', 'צ', 'ת', 'ץ'],
  ],
  // Filipino/Tagalog uses standard QWERTY (Latin alphabet, no extra
  // diacritics in modern usage). Indonesian likewise.
  tl: [
    ['Q', 'W', 'E', 'R', 'T', 'Y', 'U', 'I', 'O', 'P'],
    ['A', 'S', 'D', 'F', 'G', 'H', 'J', 'K', 'L'],
    ['Z', 'X', 'C', 'V', 'B', 'N', 'M'],
  ],
  id: [
    ['Q', 'W', 'E', 'R', 'T', 'Y', 'U', 'I', 'O', 'P'],
    ['A', 'S', 'D', 'F', 'G', 'H', 'J', 'K', 'L'],
    ['Z', 'X', 'C', 'V', 'B', 'N', 'M'],
  ],
  bg: [
    ['Я', 'В', 'Е', 'Р', 'Т', 'Ъ', 'У', 'И', 'О', 'П', 'Ш', 'Щ'],
    ['А', 'С', 'Д', 'Ф', 'Г', 'Х', 'Й', 'К', 'Л', 'Ю'],
    ['З', 'Ь', 'Ц', 'Ж', 'Б', 'Н', 'М', 'Ч'],
  ],
  ru: [
    ['Й', 'Ц', 'У', 'К', 'Е', 'Н', 'Г', 'Ш', 'Щ', 'З', 'Х'],
    ['Ф', 'Ы', 'В', 'А', 'П', 'Р', 'О', 'Л', 'Д', 'Ж', 'Э'],
    ['Я', 'Ч', 'С', 'М', 'И', 'Т', 'Ь', 'Б', 'Ю'],
  ],
  uk: [
    ['Й', 'Ц', 'У', 'К', 'Е', 'Н', 'Г', 'Ш', 'Щ', 'З', 'Х'],
    ['Ф', 'І', 'В', 'А', 'П', 'Р', 'О', 'Л', 'Д', 'Ж', 'Є'],
    ['Я', 'Ч', 'С', 'М', 'И', 'Т', 'Ь', 'Б', 'Ю', 'Ї', 'Ґ'],
  ],
  ar: [
    ['ض', 'ص', 'ث', 'ق', 'ف', 'غ', 'ع', 'ه', 'خ', 'ح', 'ج'],
    ['ش', 'س', 'ي', 'ب', 'ل', 'ا', 'ت', 'ن', 'م', 'ك', 'ة'],
    ['ئ', 'ء', 'ؤ', 'ر', 'ى', 'و', 'ز', 'ظ', 'ط', 'ذ', 'د'],
  ],
  // Full 46-kana gojūon. This stopped at は行 until 2026-07-27, leaving ま行,
  // や行, ら行, わ行 and ん unreachable — a Japanese user could not write
  // わたし, ありがとう or any word ending in ん, which is most of them.
  // Two gojūon rows per keyboard row keeps the table readable; や行 and わ行
  // have three kana each, so the last two rows are short by design.
  ja: [
    ['あ', 'い', 'う', 'え', 'お', 'か', 'き', 'く', 'け', 'こ'],
    ['さ', 'し', 'す', 'せ', 'そ', 'た', 'ち', 'つ', 'て', 'と'],
    ['な', 'に', 'ぬ', 'ね', 'の', 'は', 'ひ', 'ふ', 'へ', 'ほ'],
    ['ま', 'み', 'む', 'め', 'も', 'や', 'ゆ', 'よ'],
    ['ら', 'り', 'る', 'れ', 'ろ', 'わ', 'を', 'ん'],
    // Modifiers, not characters — they transform the kana already typed.
    ['゛', '゜', '小'],
  ],
  ko: [
    ['ㅂ', 'ㅈ', 'ㄷ', 'ㄱ', 'ㅅ', 'ㅛ', 'ㅕ', 'ㅑ', 'ㅐ', 'ㅔ'],
    ['ㅁ', 'ㄴ', 'ㅇ', 'ㄹ', 'ㅎ', 'ㅗ', 'ㅓ', 'ㅏ', 'ㅣ'],
    ['ㅋ', 'ㅌ', 'ㅊ', 'ㅍ', 'ㅠ', 'ㅜ', 'ㅡ'],
  ],
  zh: [
    ['Q', 'W', 'E', 'R', 'T', 'Y', 'U', 'I', 'O', 'P'],
    ['A', 'S', 'D', 'F', 'G', 'H', 'J', 'K', 'L'],
    ['Z', 'X', 'C', 'V', 'B', 'N', 'M'],
  ],
  'zh-Hans': [
    ['Q', 'W', 'E', 'R', 'T', 'Y', 'U', 'I', 'O', 'P'],
    ['A', 'S', 'D', 'F', 'G', 'H', 'J', 'K', 'L'],
    ['Z', 'X', 'C', 'V', 'B', 'N', 'M'],
  ],
  'zh-Hant': [
    ['Q', 'W', 'E', 'R', 'T', 'Y', 'U', 'I', 'O', 'P'],
    ['A', 'S', 'D', 'F', 'G', 'H', 'J', 'K', 'L'],
    ['Z', 'X', 'C', 'V', 'B', 'N', 'M'],
  ],
  'zh-HK': [
    ['Q', 'W', 'E', 'R', 'T', 'Y', 'U', 'I', 'O', 'P'],
    ['A', 'S', 'D', 'F', 'G', 'H', 'J', 'K', 'L'],
    ['Z', 'X', 'C', 'V', 'B', 'N', 'M'],
  ],
};

export function getLetterRows(lang: SupportedLanguage): string[][] {
  return LAYOUTS_BY_LANG[lang] ?? QWERTY;
}

export const LETTERS_ROWS = QWERTY;

/** Index of the letter row that also carries Shift and Backspace. */
export const UTIL_ROW_INDEX = 2;

/**
 * Only the util row reflows. It gives up roughly 80px to Shift and Backspace,
 * leaving ~300px on a 390px phone, so it is the row that actually overflows —
 * Romanian packs 12 keys into it (~25px each, clipped), Italian 13. The rows
 * above keep the full width and fit 12 at ~32px, which is why English portrait
 * has always been fine and should not be disturbed.
 *
 * Not a Romanian special case: ro/it/uk/ar all exceed the threshold.
 */
/**
 * 10 keys still fit the util row (~31px each) and must not wrap: Japanese
 * carries 10 kana there, and splitting a gojūon row would break a meaningful
 * ordering rather than merely rearranging letters. 11+ is where it clips.
 */
export const UTIL_ROW_OVERFLOW_KEYS = 10;
/** Base consonant row kept in place; the surplus wraps beneath it. */
export const UTIL_ROW_BASE_KEYS = 7;

export interface KeyboardRow {
  keys: string[];
  /** Renders Shift before the keys and Backspace after them. */
  util: boolean;
  /** A wrapped remainder — laid out at base key width instead of stretching. */
  continuation: boolean;
}

/**
 * Wrap rows that cannot fit a narrow screen onto a continuation row beneath.
 *
 * The surplus moves down rather than every key shrinking to fit, because the
 * users who need this most have motor impairments and a 22px key is a mis-tap.
 * Shift and Backspace stay with the head of a split row, so muscle memory for
 * their position is unaffected.
 */
export function buildKeyboardRows(rows: string[][], narrow: boolean): KeyboardRow[] {
  return rows.flatMap((keys, index): KeyboardRow[] => {
    const util = index === UTIL_ROW_INDEX;
    if (!narrow || !util || keys.length <= UTIL_ROW_OVERFLOW_KEYS) {
      return [{ keys, util, continuation: false }];
    }
    return [
      { keys: keys.slice(0, UTIL_ROW_BASE_KEYS), util, continuation: false },
      { keys: keys.slice(UTIL_ROW_BASE_KEYS), util: false, continuation: true },
    ];
  });
}

export const NUMBERS_ROWS = [
  ['1', '2', '3', '4', '5', '6', '7', '8', '9', '0'],
  ['@', '#', '$', '&', '*', '(', ')', "'", '"'],
  ['-', '/', ':', ';', '!', '?'],
];

export const SYMBOLS_ROWS = [
  ['[', ']', '{', '}', '#', '%', '^', '*', '+', '='],
  ['_', '\\', '|', '~', '<', '>', '€', '£', '¥'],
  ['.', ',', '?', '!', "'"],
];

// AAC core vocabulary lookup — see constants/aacCore/index.ts.
// Replaces the old hand-curated 5-word PREDICTIONS_BY_LANG list with a
// research-grounded set: Universal Core 36 (Geist, Erickson et al., ATIA
// 2021) localized via Cboard's GPLv3 translation tables, with a small
// corrections overlay for known Cboard data-quality bugs (cited in
// scripts/aac_core_corrections.json).
import { getAacCoreFor } from '@/constants/aacCore';

// Number of fallback predictions surfaced when the engine can't fill all
// slots from the corpus + user history. Matches the prediction-bar slot
// count; the AAC core list per language has 24-28 entries so we always
// have headroom past the first 5.
const FALLBACK_SLOTS = 5;

export const DEFAULT_PREDICTIONS = getAacCoreFor('en').slice(0, FALLBACK_SLOTS);

export function getPredictionsForLanguage(lang: SupportedLanguage): string[] {
  return getAacCoreFor(lang).slice(0, FALLBACK_SLOTS);
}

/**
 * Kana modifiers. Japanese cannot be written with the 46 seion alone: です
 * needs で (て + dakuten), ありがとう needs が, and geminates need っ. Rather
 * than adding ~25 more keys — which at 390px would push key size back under
 * the threshold this file already works to protect — three modifier keys
 * transform the character already typed.
 */
export const KANA_DAKUTEN = '゛';
export const KANA_HANDAKUTEN = '゜';
export const KANA_SMALL = '小';
export const KANA_MODIFIERS = [KANA_DAKUTEN, KANA_HANDAKUTEN, KANA_SMALL] as const;

const DAKUTEN_MAP: Record<string, string> = {
  か: 'が', き: 'ぎ', く: 'ぐ', け: 'げ', こ: 'ご',
  さ: 'ざ', し: 'じ', す: 'ず', せ: 'ぜ', そ: 'ぞ',
  た: 'だ', ち: 'ぢ', つ: 'づ', て: 'で', と: 'ど',
  は: 'ば', ひ: 'び', ふ: 'ぶ', へ: 'べ', ほ: 'ぼ',
  う: 'ゔ',
};
const HANDAKUTEN_MAP: Record<string, string> = {
  は: 'ぱ', ひ: 'ぴ', ふ: 'ぷ', へ: 'ぺ', ほ: 'ぽ',
};
const SMALL_MAP: Record<string, string> = {
  あ: 'ぁ', い: 'ぃ', う: 'ぅ', え: 'ぇ', お: 'ぉ',
  つ: 'っ', や: 'ゃ', ゆ: 'ゅ', よ: 'ょ', わ: 'ゎ',
};

/**
 * Apply a modifier to the last character of `text`.
 *
 * Returns null when the modifier does not apply — an unmodifiable character,
 * empty text, or a character already carrying the mark. The caller then does
 * nothing, so a mis-tap never inserts a stray ゛ into the user's sentence.
 */
export function applyKanaModifier(text: string, modifier: string): string | null {
  const last = text.slice(-1);
  if (!last) return null;
  const map = modifier === KANA_DAKUTEN ? DAKUTEN_MAP
    : modifier === KANA_HANDAKUTEN ? HANDAKUTEN_MAP
    : modifier === KANA_SMALL ? SMALL_MAP
    : null;
  const replacement = map?.[last];
  return replacement ? text.slice(0, -1) + replacement : null;
}
