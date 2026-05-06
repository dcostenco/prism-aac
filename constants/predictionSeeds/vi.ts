// Skeleton seed for locale 'vi'. Minimal AAC-relevant top vocabulary.
// Full corpus-derived seed will land via training/build_prediction_seeds.py.
import { WordFreqEntry } from '@/types';

const WORD_FREQ: Record<string, WordFreqEntry> = {
  "tôi": { count: 1500, lastUsed: 0 },
  "bạn": { count: 1100, lastUsed: 0 },
  "không": { count: 1000, lastUsed: 0 },
  "có": { count: 950, lastUsed: 0 },
  "là": { count: 900, lastUsed: 0 },
  "và": { count: 850, lastUsed: 0 },
  "của": { count: 800, lastUsed: 0 },
  "được": { count: 750, lastUsed: 0 },
  "ở": { count: 700, lastUsed: 0 },
  "đi": { count: 650, lastUsed: 0 },
  "vâng": { count: 600, lastUsed: 0 },
  "xin": { count: 580, lastUsed: 0 },
  "cảm-ơn": { count: 560, lastUsed: 0 },
  "muốn": { count: 540, lastUsed: 0 },
  "cần": { count: 520, lastUsed: 0 },
  "thích": { count: 500, lastUsed: 0 },
  "biết": { count: 480, lastUsed: 0 },
  "làm": { count: 460, lastUsed: 0 },
  "ăn": { count: 440, lastUsed: 0 },
  "uống": { count: 420, lastUsed: 0 },
  "nước": { count: 400, lastUsed: 0 },
  "nhà": { count: 380, lastUsed: 0 },
  "đau": { count: 360, lastUsed: 0 },
  "đói": { count: 340, lastUsed: 0 },
  "khát": { count: 320, lastUsed: 0 },
  "mệt": { count: 300, lastUsed: 0 },
  "vui": { count: 280, lastUsed: 0 },
  "buồn": { count: 260, lastUsed: 0 },
  "lạnh": { count: 240, lastUsed: 0 },
  "nóng": { count: 220, lastUsed: 0 },
  "tốt": { count: 200, lastUsed: 0 },
  "xấu": { count: 180, lastUsed: 0 },
  "rất": { count: 170, lastUsed: 0 },
  "giúp": { count: 160, lastUsed: 0 },
  "đâu": { count: 150, lastUsed: 0 },
  "khi-nào": { count: 140, lastUsed: 0 },
  "tại-sao": { count: 130, lastUsed: 0 },
  "thế-nào": { count: 120, lastUsed: 0 },
  "ai": { count: 115, lastUsed: 0 },
  "gì": { count: 110, lastUsed: 0 },
  "bây-giờ": { count: 105, lastUsed: 0 },
  "sau": { count: 100, lastUsed: 0 },
  "trước": { count: 95, lastUsed: 0 },
  "đến": { count: 90, lastUsed: 0 },
  "thấy": { count: 85, lastUsed: 0 },
  "nói": { count: 80, lastUsed: 0 },
  "nghe": { count: 75, lastUsed: 0 },
  "dừng": { count: 70, lastUsed: 0 },
};

const BIGRAMS: Record<string, WordFreqEntry> = {};
const TRIGRAMS: Record<string, WordFreqEntry> = {};

export default { wordFreq: WORD_FREQ, bigrams: BIGRAMS, trigrams: TRIGRAMS };
