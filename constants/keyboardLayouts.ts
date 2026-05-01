import { SupportedLanguage } from '@/engine/i18n';

export const LETTERS_ROWS = [
  ['Q', 'W', 'E', 'R', 'T', 'Y', 'U', 'I', 'O', 'P'],
  ['A', 'S', 'D', 'F', 'G', 'H', 'J', 'K', 'L'],
  ['Z', 'X', 'C', 'V', 'B', 'N', 'M'],
];

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

const PREDICTIONS_BY_LANG: Record<SupportedLanguage, string[]> = {
  en: ['I', 'We', 'Can', 'Help', 'All done'],
  es: ['Yo', 'Quiero', 'Ayuda', 'Sí', 'No'],
  fr: ['Je', 'Veux', 'Aide', 'Oui', 'Non'],
  pt: ['Eu', 'Quero', 'Ajuda', 'Sim', 'Não'],
  ro: ['Eu', 'Vreau', 'Ajutor', 'Da', 'Nu'],
  uk: ['Я', 'Хочу', 'Допомога', 'Так', 'Ні'],
  ru: ['Я', 'Хочу', 'Помощь', 'Да', 'Нет'],
  de: ['Ich', 'Hilfe', 'Ja', 'Nein', 'Bitte'],
  ja: ['はい', 'いいえ', 'ありがとう', '助けて', 'おわり'],
  ko: ['네', '아니요', '도와주세요', '감사합니다', '끝'],
  zh: ['我', '要', '帮助', '是', '不'],
  ar: ['أنا', 'أريد', 'مساعدة', 'نعم', 'لا'],
};

export const DEFAULT_PREDICTIONS = PREDICTIONS_BY_LANG.en;

export function getPredictionsForLanguage(lang: SupportedLanguage): string[] {
  return PREDICTIONS_BY_LANG[lang] ?? PREDICTIONS_BY_LANG.en;
}
