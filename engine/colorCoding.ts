/**
 * Modified Fitzgerald Key — Color Coding Engine
 *
 * Maps words to grammatical categories with associated colors.
 * Based on Goossens', Crain, & Elder (1992) and Bryan (1997) Colourful Semantics.
 *
 * COLOR ASSIGNMENTS:
 *   Yellow (#FFD54F)  — Pronouns / People: I, you, he, she, we, they, Mom, Dad
 *   Green  (#66BB6A)  — Verbs / Actions:   want, go, eat, help, need, play, make
 *   Blue   (#42A5F5)  — Adjectives:        big, little, happy, more, hot, cold
 *   Orange (#FFA726)  — Nouns / Things:     pizza, water, school, car, book
 *   Pink   (#F48FB1)  — Social words:       please, thank you, hi, yes, no, sorry
 *   White  (#BDBDBD)  — Misc / Grammar:    the, and, to, is, a, of, in
 *   Purple (#CE93D8)  — Places:            home, school, park, mall, store
 *
 * The classifier uses a lookup table for known words and falls back
 * to heuristics (suffixes, position) for unknown words.
 */

export type WordCategory =
  | 'pronoun'    // yellow
  | 'verb'       // green
  | 'adjective'  // blue
  | 'noun'       // orange
  | 'social'     // pink
  | 'grammar'    // white/gray
  | 'place'      // purple
  | 'unknown';   // default text color

export const CATEGORY_COLORS: Record<WordCategory, string> = {
  pronoun:   '#FFD54F',
  verb:      '#66BB6A',
  adjective: '#42A5F5',
  noun:      '#FFA726',
  social:    '#F48FB1',
  grammar:   '#9E9E9E',
  place:     '#CE93D8',
  unknown:   '#e0e0e0',
};

const PRONOUNS = new Set([
  'i', 'me', 'my', 'mine', 'myself',
  'you', 'your', 'yours', 'yourself',
  'he', 'him', 'his', 'himself',
  'she', 'her', 'hers', 'herself',
  'it', 'its', 'itself',
  'we', 'us', 'our', 'ours', 'ourselves',
  'they', 'them', 'their', 'theirs', 'themselves',
  'who', 'whom', 'whose', 'what', 'which',
  'mom', 'dad', 'teacher', 'friend', 'brother', 'sister', 'family', 'doctor',
]);

const VERBS = new Set([
  'want', 'need', 'help', 'go', 'come', 'get', 'give', 'take', 'make',
  'eat', 'drink', 'play', 'see', 'look', 'hear', 'listen', 'feel',
  'like', 'love', 'have', 'do', 'say', 'tell', 'ask', 'know', 'think',
  'can', 'will', 'would', 'could', 'should', 'may', 'might', 'must',
  'am', 'is', 'are', 'was', 'were', 'be', 'been', 'being',
  'wait', 'stop', 'start', 'try', 'put', 'open', 'close', 'read', 'write',
  'understand', 'walk', 'run', 'sit', 'stand', 'finished',
]);

const ADJECTIVES = new Set([
  'good', 'bad', 'big', 'little', 'small', 'large', 'long', 'short',
  'happy', 'sad', 'hungry', 'thirsty', 'tired', 'sick', 'hurt',
  'hot', 'cold', 'warm', 'cool', 'more', 'less', 'all', 'done',
  'new', 'old', 'fast', 'slow', 'hard', 'easy', 'nice', 'great',
  'ready', 'different', 'same', 'other', 'every', 'some', 'many', 'few',
]);

const SOCIAL = new Set([
  'hello', 'hi', 'hey', 'goodbye', 'bye',
  'please', 'thanks', 'sorry', 'excuse',
  'yes', 'no', 'ok', 'okay', 'sure',
]);

const GRAMMAR = new Set([
  'the', 'a', 'an', 'and', 'or', 'but', 'if', 'then', 'so',
  'to', 'for', 'of', 'in', 'on', 'at', 'by', 'with', 'from',
  'not', "don't", "doesn't", "didn't", "can't", "won't",
  'this', 'that', 'these', 'those', 'there', 'here',
  'very', 'really', 'just', 'also', 'too', 'already',
]);

const PLACES = new Set([
  'home', 'house', 'school', 'class', 'classroom', 'park', 'mall',
  'store', 'grocery', 'restaurant', 'library', 'pool', 'lake',
  'bathroom', 'kitchen', 'bedroom', 'outside', 'inside',
  'car', 'bus', 'hospital', 'office', 'church',
]);

export function classifyWord(word: string, lang: string = 'en'): WordCategory {
  const w = word.toLowerCase().replace(/’/g, "'").replace(/[^a-z'À-ɏЀ-ӿ؀-ۿ　-鿿가-힯]/g, '');
  if (!w) return 'unknown';
  // Dictionary lookups work for any language (English word lists)
  if (PRONOUNS.has(w)) return 'pronoun';
  if (SOCIAL.has(w)) return 'social';
  if (GRAMMAR.has(w)) return 'grammar';
  if (VERBS.has(w)) return 'verb';
  if (ADJECTIVES.has(w)) return 'adjective';
  if (PLACES.has(w)) return 'place';
  // Heuristic fallbacks — English only (other languages default to noun)
  if (lang === 'en') {
    if (w.endsWith('ing') || w.endsWith('ed')) return 'verb';
    if (w.endsWith('ly') && !w.endsWith('ally')) return 'grammar';
    if ((w.endsWith('er') && w.length > 5) || w.endsWith('est')) return 'adjective';
  }
  return 'noun';
}

export function classifyPhrase(text: string, lang: string = 'en'): Array<{ word: string; category: WordCategory; color: string }> {
  return text.split(/(\s+)/).map((token) => {
    if (/^\s+$/.test(token)) return { word: token, category: 'unknown' as WordCategory, color: 'transparent' };
    const category = classifyWord(token, lang);
    return { word: token, category, color: CATEGORY_COLORS[category] };
  });
}

export const CATEGORY_LEGEND: Array<{ category: WordCategory; label: string; color: string }> = [
  { category: 'pronoun', label: 'People', color: CATEGORY_COLORS.pronoun },
  { category: 'verb', label: 'Actions', color: CATEGORY_COLORS.verb },
  { category: 'adjective', label: 'Describing', color: CATEGORY_COLORS.adjective },
  { category: 'noun', label: 'Things', color: CATEGORY_COLORS.noun },
  { category: 'social', label: 'Social', color: CATEGORY_COLORS.social },
  { category: 'place', label: 'Places', color: CATEGORY_COLORS.place },
  { category: 'grammar', label: 'Connecting', color: CATEGORY_COLORS.grammar },
];
