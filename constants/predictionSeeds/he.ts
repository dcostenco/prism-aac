// Skeleton seed for locale 'he' (RTL). Minimal AAC-relevant top vocabulary.
// Full corpus-derived seed will land via training/build_prediction_seeds.py.
import { WordFreqEntry } from '@/types';

const WORD_FREQ: Record<string, WordFreqEntry> = {
  "אני": { count: 1500, lastUsed: 0 },
  "אתה": { count: 1100, lastUsed: 0 },
  "את": { count: 1050, lastUsed: 0 },
  "לא": { count: 1000, lastUsed: 0 },
  "כן": { count: 950, lastUsed: 0 },
  "ב": { count: 850, lastUsed: 0 },
  "של": { count: 800, lastUsed: 0 },
  "הוא": { count: 750, lastUsed: 0 },
  "היא": { count: 700, lastUsed: 0 },
  "מה": { count: 650, lastUsed: 0 },
  "איפה": { count: 600, lastUsed: 0 },
  "איך": { count: 580, lastUsed: 0 },
  "למה": { count: 560, lastUsed: 0 },
  "מתי": { count: 540, lastUsed: 0 },
  "עכשיו": { count: 520, lastUsed: 0 },
  "אחר-כך": { count: 500, lastUsed: 0 },
  "רוצה": { count: 480, lastUsed: 0 },
  "צריך": { count: 460, lastUsed: 0 },
  "יכול": { count: 440, lastUsed: 0 },
  "תודה": { count: 420, lastUsed: 0 },
  "בבקשה": { count: 400, lastUsed: 0 },
  "סליחה": { count: 380, lastUsed: 0 },
  "שלום": { count: 360, lastUsed: 0 },
  "טוב": { count: 340, lastUsed: 0 },
  "רע": { count: 320, lastUsed: 0 },
  "מאוד": { count: 300, lastUsed: 0 },
  "כואב": { count: 280, lastUsed: 0 },
  "רעב": { count: 260, lastUsed: 0 },
  "צמא": { count: 240, lastUsed: 0 },
  "עייף": { count: 220, lastUsed: 0 },
  "שמח": { count: 200, lastUsed: 0 },
  "עצוב": { count: 180, lastUsed: 0 },
  "קר": { count: 170, lastUsed: 0 },
  "חם": { count: 160, lastUsed: 0 },
  "בית": { count: 150, lastUsed: 0 },
  "אוכל": { count: 140, lastUsed: 0 },
  "מים": { count: 130, lastUsed: 0 },
  "ללכת": { count: 120, lastUsed: 0 },
  "לבוא": { count: 115, lastUsed: 0 },
  "לעשות": { count: 110, lastUsed: 0 },
  "לראות": { count: 105, lastUsed: 0 },
  "לדבר": { count: 100, lastUsed: 0 },
  "לשמוע": { count: 95, lastUsed: 0 },
  "לאכול": { count: 90, lastUsed: 0 },
  "לשתות": { count: 85, lastUsed: 0 },
  "עזרה": { count: 80, lastUsed: 0 },
  "עצור": { count: 75, lastUsed: 0 },
};

const BIGRAMS: Record<string, WordFreqEntry> = {};
const TRIGRAMS: Record<string, WordFreqEntry> = {};

export default { wordFreq: WORD_FREQ, bigrams: BIGRAMS, trigrams: TRIGRAMS };
