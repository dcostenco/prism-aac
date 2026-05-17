'use client';

export interface BedsideCard {
  id: string;
  text: string;
  icon: string;       // single emoji grapheme
  createdAt: number;  // 0 = built-in default
}

const STORAGE_KEY = 'prism_bedside_cards_v1';
const MAX_CARDS = 50;

// ── Default templates — cover the critical AAC hospital bedside use cases ──
// Grouped: urgent → physical needs → communication → emotional
export const DEFAULT_BEDSIDE_CARDS: BedsideCard[] = [
  // Urgent
  { id: 'builtin-sos',     text: 'HELP — EMERGENCY',    icon: '🆘', createdAt: 0 },
  { id: 'builtin-pain',    text: "I'm in pain",          icon: '😢', createdAt: 0 },
  { id: 'builtin-breath',  text: "I can't breathe",      icon: '🫁', createdAt: 0 },
  { id: 'builtin-nurse',   text: 'Call the nurse',       icon: '🔔', createdAt: 0 },
  // Physical needs
  { id: 'builtin-water',   text: 'Water please',         icon: '💧', createdAt: 0 },
  { id: 'builtin-hot',     text: 'I am too hot',         icon: '🔥', createdAt: 0 },
  { id: 'builtin-cold',    text: 'I am too cold',        icon: '🥶', createdAt: 0 },
  { id: 'builtin-turn',    text: 'Please reposition me', icon: '↔️', createdAt: 0 },
  { id: 'builtin-meds',    text: 'I need my medication', icon: '💊', createdAt: 0 },
  // Communication
  { id: 'builtin-yes',     text: 'Yes',                  icon: '✅', createdAt: 0 },
  { id: 'builtin-no',      text: 'No',                   icon: '❌', createdAt: 0 },
  { id: 'builtin-wait',    text: 'Please wait',          icon: '⏳', createdAt: 0 },
  // Emotional
  { id: 'builtin-love',    text: 'I love you',           icon: '❤️', createdAt: 0 },
  { id: 'builtin-thanks',  text: 'Thank you',            icon: '🙏', createdAt: 0 },
  { id: 'builtin-scared',  text: "I'm scared",           icon: '😨', createdAt: 0 },
];

function isValidCard(c: unknown): c is BedsideCard {
  if (!c || typeof c !== 'object') return false;
  const o = c as Record<string, unknown>;
  return (
    typeof o.id === 'string'       && o.id.length > 0    && o.id.length <= 80  &&
    typeof o.text === 'string'     && o.text.length > 0  && o.text.length <= 200 &&
    typeof o.icon === 'string'     && o.icon.length > 0  && o.icon.length <= 10 &&
    typeof o.createdAt === 'number'
  );
}

export function loadCards(): BedsideCard[] {
  if (typeof window === 'undefined') return DEFAULT_BEDSIDE_CARDS;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_BEDSIDE_CARDS;
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return DEFAULT_BEDSIDE_CARDS;
    const valid = parsed.filter(isValidCard).slice(0, MAX_CARDS);
    return valid.length > 0 ? valid : DEFAULT_BEDSIDE_CARDS;
  } catch {
    return DEFAULT_BEDSIDE_CARDS;
  }
}

export function saveCards(cards: BedsideCard[]): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(cards.slice(0, MAX_CARDS)));
  } catch { /* storage quota exceeded — silently skip */ }
}

export function createCard(text: string, icon: string): BedsideCard {
  return {
    id: `card-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    text: text.trim().slice(0, 200),
    icon: (icon.trim() || '💬').slice(0, 10),
    createdAt: Date.now(),
  };
}
