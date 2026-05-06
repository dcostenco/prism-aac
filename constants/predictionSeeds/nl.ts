// Skeleton seed for locale 'nl'. Minimal AAC-relevant top vocabulary.
// Full corpus-derived seed will land via training/build_prediction_seeds.py.
import { WordFreqEntry } from '@/types';

const WORD_FREQ: Record<string, WordFreqEntry> = {
  "ik": { count: 1500, lastUsed: 0 },
  "je": { count: 1100, lastUsed: 0 },
  "is": { count: 1000, lastUsed: 0 },
  "niet": { count: 950, lastUsed: 0 },
  "het": { count: 900, lastUsed: 0 },
  "de": { count: 850, lastUsed: 0 },
  "een": { count: 800, lastUsed: 0 },
  "en": { count: 750, lastUsed: 0 },
  "ja": { count: 700, lastUsed: 0 },
  "nee": { count: 650, lastUsed: 0 },
  "wat": { count: 600, lastUsed: 0 },
  "ben": { count: 580, lastUsed: 0 },
  "heb": { count: 560, lastUsed: 0 },
  "wil": { count: 540, lastUsed: 0 },
  "kan": { count: 520, lastUsed: 0 },
  "moet": { count: 500, lastUsed: 0 },
  "alstublieft": { count: 480, lastUsed: 0 },
  "dank": { count: 460, lastUsed: 0 },
  "hallo": { count: 440, lastUsed: 0 },
  "waar": { count: 420, lastUsed: 0 },
  "hoe": { count: 400, lastUsed: 0 },
  "waarom": { count: 380, lastUsed: 0 },
  "wanneer": { count: 360, lastUsed: 0 },
  "nu": { count: 340, lastUsed: 0 },
  "later": { count: 320, lastUsed: 0 },
  "goed": { count: 300, lastUsed: 0 },
  "slecht": { count: 280, lastUsed: 0 },
  "veel": { count: 260, lastUsed: 0 },
  "hulp": { count: 240, lastUsed: 0 },
  "pijn": { count: 220, lastUsed: 0 },
  "honger": { count: 200, lastUsed: 0 },
  "dorst": { count: 180, lastUsed: 0 },
  "moe": { count: 170, lastUsed: 0 },
  "blij": { count: 160, lastUsed: 0 },
  "verdrietig": { count: 150, lastUsed: 0 },
  "koud": { count: 140, lastUsed: 0 },
  "warm": { count: 130, lastUsed: 0 },
  "huis": { count: 120, lastUsed: 0 },
  "eten": { count: 115, lastUsed: 0 },
  "drinken": { count: 110, lastUsed: 0 },
  "water": { count: 105, lastUsed: 0 },
  "gaan": { count: 100, lastUsed: 0 },
  "komen": { count: 95, lastUsed: 0 },
  "doen": { count: 90, lastUsed: 0 },
  "zien": { count: 85, lastUsed: 0 },
  "praten": { count: 80, lastUsed: 0 },
  "luisteren": { count: 75, lastUsed: 0 },
  "stop": { count: 70, lastUsed: 0 },
};

const BIGRAMS: Record<string, WordFreqEntry> = {};
const TRIGRAMS: Record<string, WordFreqEntry> = {};

export default { wordFreq: WORD_FREQ, bigrams: BIGRAMS, trigrams: TRIGRAMS };
