/**
 * bedsideCards — loadCards / saveCards / createCard pure service functions.
 *
 * These are AAC hospital bedside quick-tap cards. The service layer (pure
 * localStorage + validation logic) had zero unit coverage — only the React
 * overlay component had shallow rendering tests. This file covers the data
 * path: load/save round-trips, validation filtering, MAX_CARDS cap, and the
 * createCard factory.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import {
  loadCards,
  saveCards,
  createCard,
  DEFAULT_BEDSIDE_CARDS,
  type BedsideCard,
} from '@/services/bedsideCards';

const STORAGE_KEY = 'prism_bedside_cards_v1';

beforeEach(() => {
  localStorage.clear();
});

// ── DEFAULT_BEDSIDE_CARDS ─────────────────────────────────────────────────────

describe('DEFAULT_BEDSIDE_CARDS', () => {
  it('is a non-empty array', () => {
    expect(Array.isArray(DEFAULT_BEDSIDE_CARDS)).toBe(true);
    expect(DEFAULT_BEDSIDE_CARDS.length).toBeGreaterThan(0);
  });

  it('contains 15 built-in cards', () => {
    expect(DEFAULT_BEDSIDE_CARDS).toHaveLength(15);
  });

  it('all cards have required string fields (id, text, icon)', () => {
    for (const card of DEFAULT_BEDSIDE_CARDS) {
      expect(typeof card.id).toBe('string');
      expect(typeof card.text).toBe('string');
      expect(typeof card.icon).toBe('string');
      expect(card.id.length).toBeGreaterThan(0);
      expect(card.text.length).toBeGreaterThan(0);
      expect(card.icon.length).toBeGreaterThan(0);
    }
  });

  it('all built-in cards have createdAt = 0 (sentinel for built-in)', () => {
    for (const card of DEFAULT_BEDSIDE_CARDS) {
      expect(card.createdAt).toBe(0);
    }
  });

  it('includes the emergency SOS card', () => {
    const sos = DEFAULT_BEDSIDE_CARDS.find((c) => c.id === 'builtin-sos');
    expect(sos).toBeDefined();
  });

  it('has unique IDs', () => {
    const ids = DEFAULT_BEDSIDE_CARDS.map((c) => c.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});

// ── loadCards ─────────────────────────────────────────────────────────────────

describe('loadCards', () => {
  it('returns DEFAULT_BEDSIDE_CARDS when localStorage is empty', () => {
    const cards = loadCards();
    expect(cards).toBe(DEFAULT_BEDSIDE_CARDS);
  });

  it('returns DEFAULT_BEDSIDE_CARDS when stored JSON is corrupt', () => {
    localStorage.setItem(STORAGE_KEY, '{not valid json{{');
    expect(loadCards()).toBe(DEFAULT_BEDSIDE_CARDS);
  });

  it('returns DEFAULT_BEDSIDE_CARDS when stored value is not an array', () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ id: 'oops' }));
    expect(loadCards()).toBe(DEFAULT_BEDSIDE_CARDS);
  });

  it('returns DEFAULT_BEDSIDE_CARDS when stored array is empty after filtering', () => {
    // All entries are invalid objects
    localStorage.setItem(STORAGE_KEY, JSON.stringify([{ bad: true }, null, 42]));
    expect(loadCards()).toBe(DEFAULT_BEDSIDE_CARDS);
  });

  it('returns stored cards when all entries are valid', () => {
    const custom: BedsideCard[] = [
      { id: 'c1', text: 'Water', icon: '💧', createdAt: 1000 },
      { id: 'c2', text: 'Help',  icon: '🆘', createdAt: 2000 },
    ];
    localStorage.setItem(STORAGE_KEY, JSON.stringify(custom));
    const loaded = loadCards();
    expect(loaded).toHaveLength(2);
    expect(loaded[0].id).toBe('c1');
    expect(loaded[1].id).toBe('c2');
  });

  it('filters out invalid entries (missing required fields)', () => {
    const mixed = [
      { id: 'good', text: 'OK', icon: '✅', createdAt: 1 },
      { id: '',     text: 'bad id — empty string', icon: '!', createdAt: 1 },
      { text: 'missing id', icon: '!', createdAt: 1 },
      { id: 'no-text', icon: '!', createdAt: 1 },
    ];
    localStorage.setItem(STORAGE_KEY, JSON.stringify(mixed));
    const loaded = loadCards();
    expect(loaded).toHaveLength(1);
    expect(loaded[0].id).toBe('good');
  });

  it('caps at MAX_CARDS (50) even when more are stored', () => {
    const many: BedsideCard[] = Array.from({ length: 60 }, (_, i) => ({
      id: `card-${i}`,
      text: `Card ${i}`,
      icon: '📄',
      createdAt: i,
    }));
    localStorage.setItem(STORAGE_KEY, JSON.stringify(many));
    expect(loadCards()).toHaveLength(50);
  });

  it('returns DEFAULT_BEDSIDE_CARDS when stored text exceeds 200 chars (invalid)', () => {
    const bad: BedsideCard[] = [
      { id: 'x', text: 'x'.repeat(201), icon: '!', createdAt: 1 },
    ];
    localStorage.setItem(STORAGE_KEY, JSON.stringify(bad));
    expect(loadCards()).toBe(DEFAULT_BEDSIDE_CARDS);
  });
});

// ── saveCards ─────────────────────────────────────────────────────────────────

describe('saveCards', () => {
  it('persists cards to localStorage under the correct key', () => {
    const cards: BedsideCard[] = [
      { id: 'c1', text: 'Hello', icon: '👋', createdAt: 123 },
    ];
    saveCards(cards);
    const raw = localStorage.getItem(STORAGE_KEY);
    expect(raw).not.toBeNull();
    const parsed = JSON.parse(raw!);
    expect(parsed).toHaveLength(1);
    expect(parsed[0].id).toBe('c1');
  });

  it('round-trips with loadCards', () => {
    const cards: BedsideCard[] = [
      { id: 'rt-1', text: 'Round trip', icon: '🔄', createdAt: 999 },
      { id: 'rt-2', text: 'Second',     icon: '2️⃣',  createdAt: 1000 },
    ];
    saveCards(cards);
    const loaded = loadCards();
    expect(loaded).toHaveLength(2);
    expect(loaded[0].id).toBe('rt-1');
    expect(loaded[1].id).toBe('rt-2');
  });

  it('caps stored array at MAX_CARDS (50)', () => {
    const many: BedsideCard[] = Array.from({ length: 60 }, (_, i) => ({
      id: `s-${i}`, text: `Item ${i}`, icon: '📌', createdAt: i,
    }));
    saveCards(many);
    const raw = JSON.parse(localStorage.getItem(STORAGE_KEY)!);
    expect(raw).toHaveLength(50);
  });

  it('does not throw on empty array', () => {
    expect(() => saveCards([])).not.toThrow();
  });

  it('overwrites previously saved cards', () => {
    saveCards([{ id: 'old', text: 'Old', icon: '⬛', createdAt: 1 }]);
    saveCards([{ id: 'new', text: 'New', icon: '⬜', createdAt: 2 }]);
    const loaded = loadCards();
    expect(loaded).toHaveLength(1);
    expect(loaded[0].id).toBe('new');
  });
});

// ── createCard ────────────────────────────────────────────────────────────────

describe('createCard', () => {
  it('returns a BedsideCard with the given text (trimmed)', () => {
    const card = createCard('  Water please  ', '💧');
    expect(card.text).toBe('Water please');
  });

  it('returns a BedsideCard with the given icon', () => {
    const card = createCard('Help', '🆘');
    expect(card.icon).toBe('🆘');
  });

  it('falls back to 💬 when icon is empty string', () => {
    const card = createCard('Hello', '');
    expect(card.icon).toBe('💬');
  });

  it('falls back to 💬 when icon is whitespace only', () => {
    const card = createCard('Hello', '   ');
    expect(card.icon).toBe('💬');
  });

  it('caps text at 200 characters', () => {
    const long = 'a'.repeat(250);
    const card = createCard(long, '📝');
    expect(card.text.length).toBeLessThanOrEqual(200);
  });

  it('caps icon at 10 characters', () => {
    const longIcon = '😀'.repeat(20);
    const card = createCard('test', longIcon);
    expect([...card.icon].join('').length).toBeLessThanOrEqual(10);
  });

  it('has a non-empty unique id', () => {
    const a = createCard('A', '🅰️');
    const b = createCard('B', '🅱️');
    expect(a.id.length).toBeGreaterThan(0);
    expect(b.id.length).toBeGreaterThan(0);
    expect(a.id).not.toBe(b.id);
  });

  it('sets createdAt to a recent timestamp', () => {
    const before = Date.now();
    const card = createCard('Now', '⏰');
    const after = Date.now();
    expect(card.createdAt).toBeGreaterThanOrEqual(before);
    expect(card.createdAt).toBeLessThanOrEqual(after);
  });

  it('created card is valid for round-trip through saveCards/loadCards', () => {
    const card = createCard('Valid card', '✅');
    saveCards([card]);
    const loaded = loadCards();
    expect(loaded).toHaveLength(1);
    expect(loaded[0].id).toBe(card.id);
    expect(loaded[0].text).toBe('Valid card');
  });
});
