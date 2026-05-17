import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  DEFAULT_BEDSIDE_CARDS,
  loadCards,
  saveCards,
  createCard,
  type BedsideCard,
} from './bedsideCards';

// ── localStorage stub ──────────────────────────────────────────────────────

const store: Record<string, string> = {};
const localStorageMock = {
  getItem: (k: string) => store[k] ?? null,
  setItem: (k: string, v: string) => { store[k] = v; },
  removeItem: (k: string) => { delete store[k]; },
  clear: () => { Object.keys(store).forEach(k => delete store[k]); },
};

beforeEach(() => {
  Object.defineProperty(globalThis, 'localStorage', { value: localStorageMock, writable: true });
  Object.defineProperty(globalThis, 'window', { value: globalThis, writable: true });
  localStorageMock.clear();
});

afterEach(() => {
  vi.restoreAllMocks();
});

// ── DEFAULT_BEDSIDE_CARDS ─────────────────────────────────────────────────

describe('DEFAULT_BEDSIDE_CARDS', () => {
  it('contains at least 10 entries', () => {
    expect(DEFAULT_BEDSIDE_CARDS.length).toBeGreaterThanOrEqual(10);
  });

  it('every default card has a non-empty text and emoji icon', () => {
    for (const card of DEFAULT_BEDSIDE_CARDS) {
      expect(card.text.length).toBeGreaterThan(0);
      expect(card.icon.length).toBeGreaterThan(0);
      // icon should start with a non-ASCII character (emoji)
      expect(card.icon.codePointAt(0)!).toBeGreaterThan(127);
    }
  });

  it('all default IDs start with "builtin-"', () => {
    for (const card of DEFAULT_BEDSIDE_CARDS) {
      expect(card.id.startsWith('builtin-')).toBe(true);
    }
  });

  it('includes critical emergency cards (HELP, pain, nurse)', () => {
    const texts = DEFAULT_BEDSIDE_CARDS.map(c => c.text.toLowerCase());
    expect(texts.some(t => t.includes('emergency') || t.includes('help'))).toBe(true);
    expect(texts.some(t => t.includes('pain'))).toBe(true);
    expect(texts.some(t => t.includes('nurse'))).toBe(true);
  });

  it('includes yes and no cards', () => {
    const texts = DEFAULT_BEDSIDE_CARDS.map(c => c.text.toLowerCase());
    expect(texts.includes('yes')).toBe(true);
    expect(texts.includes('no')).toBe(true);
  });
});

// ── loadCards ─────────────────────────────────────────────────────────────

describe('loadCards', () => {
  it('returns DEFAULT_BEDSIDE_CARDS when localStorage is empty', () => {
    expect(loadCards()).toEqual(DEFAULT_BEDSIDE_CARDS);
  });

  it('round-trips saved cards correctly', () => {
    const cards: BedsideCard[] = [
      { id: 'c-1', text: 'Water', icon: '💧', createdAt: 1000 },
      { id: 'c-2', text: 'Yes',   icon: '✅', createdAt: 2000 },
    ];
    saveCards(cards);
    expect(loadCards()).toEqual(cards);
  });

  it('falls back to defaults when stored value is malformed JSON', () => {
    store['prism_bedside_cards_v1'] = 'not-json{{{';
    expect(loadCards()).toEqual(DEFAULT_BEDSIDE_CARDS);
  });

  it('falls back to defaults when stored value is not an array', () => {
    store['prism_bedside_cards_v1'] = JSON.stringify({ id: 'x' });
    expect(loadCards()).toEqual(DEFAULT_BEDSIDE_CARDS);
  });

  it('filters out invalid cards (missing required fields)', () => {
    const mixed = [
      { id: 'valid', text: 'Hello', icon: '👋', createdAt: 1 },
      { id: '', text: 'no id', icon: '👋', createdAt: 1 },       // empty id
      { id: 'no-text', text: '', icon: '👋', createdAt: 1 },     // empty text
      { id: 'no-icon', text: 'hi', icon: '', createdAt: 1 },     // empty icon
      { id: 'bad-date', text: 'hi', icon: '👋', createdAt: 'x' }, // bad date
      null,
      42,
    ];
    store['prism_bedside_cards_v1'] = JSON.stringify(mixed);
    const result = loadCards();
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('valid');
  });

  it('falls back to defaults when all stored cards are invalid', () => {
    store['prism_bedside_cards_v1'] = JSON.stringify([{ id: '', text: '', icon: '', createdAt: 0 }]);
    expect(loadCards()).toEqual(DEFAULT_BEDSIDE_CARDS);
  });

  it('caps at 50 cards', () => {
    const many: BedsideCard[] = Array.from({ length: 60 }, (_, i) => ({
      id: `c-${i}`, text: `Card ${i}`, icon: '💬', createdAt: i,
    }));
    saveCards(many);          // saveCards caps at 50 too
    const result = loadCards();
    expect(result.length).toBeLessThanOrEqual(50);
  });
});

// ── saveCards ─────────────────────────────────────────────────────────────

describe('saveCards', () => {
  it('persists to localStorage', () => {
    const cards: BedsideCard[] = [{ id: 'c-1', text: 'Pain', icon: '😢', createdAt: 1 }];
    saveCards(cards);
    expect(store['prism_bedside_cards_v1']).toBeDefined();
    expect(JSON.parse(store['prism_bedside_cards_v1'])).toEqual(cards);
  });

  it('caps stored array at 50 cards', () => {
    const many: BedsideCard[] = Array.from({ length: 60 }, (_, i) => ({
      id: `c-${i}`, text: `Card ${i}`, icon: '💬', createdAt: i,
    }));
    saveCards(many);
    const stored = JSON.parse(store['prism_bedside_cards_v1']);
    expect(stored).toHaveLength(50);
  });

  it('does not throw when localStorage throws (e.g. quota exceeded)', () => {
    vi.spyOn(localStorageMock, 'setItem').mockImplementation(() => { throw new Error('QuotaExceededError'); });
    expect(() => saveCards([{ id: 'c-1', text: 'Test', icon: '💬', createdAt: 1 }])).not.toThrow();
  });
});

// ── createCard ────────────────────────────────────────────────────────────

describe('createCard', () => {
  it('generates a unique id on each call', () => {
    const a = createCard('Hello', '👋');
    const b = createCard('Hello', '👋');
    expect(a.id).not.toBe(b.id);
  });

  it('trims text whitespace', () => {
    const card = createCard('  Water  ', '💧');
    expect(card.text).toBe('Water');
  });

  it('caps text at 200 chars', () => {
    const long = 'x'.repeat(300);
    const card = createCard(long, '💬');
    expect(card.text.length).toBe(200);
  });

  it('falls back icon to 💬 when empty string passed', () => {
    const card = createCard('Test', '');
    expect(card.icon).toBe('💬');
  });

  it('caps icon at 10 chars', () => {
    const card = createCard('Test', '👋'.repeat(20));
    expect(card.icon.length).toBeLessThanOrEqual(10);
  });

  it('sets createdAt to a positive timestamp', () => {
    const before = Date.now();
    const card = createCard('Test', '💬');
    expect(card.createdAt).toBeGreaterThanOrEqual(before);
  });

  it('id starts with "card-"', () => {
    const card = createCard('Test', '💬');
    expect(card.id.startsWith('card-')).toBe(true);
  });
});
