// Skeleton seed for locale 'id'. Minimal AAC-relevant top vocabulary.
// Full corpus-derived seed will land via training/build_prediction_seeds.py.
import { WordFreqEntry } from '@/types';

const WORD_FREQ: Record<string, WordFreqEntry> = {
  "saya": { count: 1500, lastUsed: 0 },
  "kamu": { count: 1100, lastUsed: 0 },
  "ya": { count: 950, lastUsed: 0 },
  "tidak": { count: 900, lastUsed: 0 },
  "yang": { count: 850, lastUsed: 0 },
  "di": { count: 800, lastUsed: 0 },
  "dan": { count: 750, lastUsed: 0 },
  "ini": { count: 700, lastUsed: 0 },
  "itu": { count: 650, lastUsed: 0 },
  "ke": { count: 600, lastUsed: 0 },
  "dari": { count: 580, lastUsed: 0 },
  "untuk": { count: 560, lastUsed: 0 },
  "ada": { count: 540, lastUsed: 0 },
  "mau": { count: 520, lastUsed: 0 },
  "bisa": { count: 500, lastUsed: 0 },
  "perlu": { count: 480, lastUsed: 0 },
  "tolong": { count: 460, lastUsed: 0 },
  "terima-kasih": { count: 440, lastUsed: 0 },
  "halo": { count: 420, lastUsed: 0 },
  "apa": { count: 400, lastUsed: 0 },
  "siapa": { count: 380, lastUsed: 0 },
  "dimana": { count: 360, lastUsed: 0 },
  "kapan": { count: 340, lastUsed: 0 },
  "mengapa": { count: 320, lastUsed: 0 },
  "bagaimana": { count: 300, lastUsed: 0 },
  "sekarang": { count: 280, lastUsed: 0 },
  "nanti": { count: 260, lastUsed: 0 },
  "bagus": { count: 240, lastUsed: 0 },
  "buruk": { count: 220, lastUsed: 0 },
  "sakit": { count: 200, lastUsed: 0 },
  "lapar": { count: 180, lastUsed: 0 },
  "haus": { count: 170, lastUsed: 0 },
  "lelah": { count: 160, lastUsed: 0 },
  "senang": { count: 150, lastUsed: 0 },
  "sedih": { count: 140, lastUsed: 0 },
  "dingin": { count: 130, lastUsed: 0 },
  "panas": { count: 120, lastUsed: 0 },
  "rumah": { count: 115, lastUsed: 0 },
  "makan": { count: 110, lastUsed: 0 },
  "minum": { count: 105, lastUsed: 0 },
  "air": { count: 100, lastUsed: 0 },
  "pergi": { count: 95, lastUsed: 0 },
  "datang": { count: 90, lastUsed: 0 },
  "lihat": { count: 85, lastUsed: 0 },
  "bicara": { count: 80, lastUsed: 0 },
  "dengar": { count: 75, lastUsed: 0 },
  "berhenti": { count: 70, lastUsed: 0 },
  "sangat": { count: 65, lastUsed: 0 },
};

const BIGRAMS: Record<string, WordFreqEntry> = {};
const TRIGRAMS: Record<string, WordFreqEntry> = {};

export default { wordFreq: WORD_FREQ, bigrams: BIGRAMS, trigrams: TRIGRAMS };
