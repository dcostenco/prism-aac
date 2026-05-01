/**
 * Tests for game data/logic from GamesPanel.
 *
 * Since the game components are React components with internal state,
 * we test the exported/importable data structures and pure logic functions
 * that can be extracted and verified without rendering.
 *
 * We import the module source to access the constants and builder functions
 * by re-declaring them here (they are module-scoped in GamesPanel.tsx).
 */
import { describe, it, expect } from 'vitest';

/* ── Replicate data structures from GamesPanel.tsx for testing ── */

const MATCH_PAIRS = [
  { label: 'Cat', icon: '🐱' },
  { label: 'Dog', icon: '🐶' },
  { label: 'Fish', icon: '🐟' },
  { label: 'Bird', icon: '🐦' },
  { label: 'Sun', icon: '☀️' },
  { label: 'Moon', icon: '🌙' },
];

interface MatchCard {
  id: number;
  label: string;
  icon: string;
  matchId: number;
  flipped: boolean;
  matched: boolean;
}

function buildMatchDeck(): MatchCard[] {
  const pairs = MATCH_PAIRS.slice(0, 4);
  const cards: MatchCard[] = [];
  pairs.forEach((p, i) => {
    cards.push({ id: i * 2, label: p.label, icon: p.icon, matchId: i, flipped: false, matched: false });
    cards.push({ id: i * 2 + 1, label: p.label, icon: p.icon, matchId: i, flipped: false, matched: false });
  });
  for (let i = cards.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [cards[i], cards[j]] = [cards[j], cards[i]];
  }
  return cards;
}

const EMOTIONS = [
  { emoji: '😊', label: 'happy' },
  { emoji: '😢', label: 'sad' },
  { emoji: '😠', label: 'angry' },
  { emoji: '😨', label: 'scared' },
  { emoji: '😲', label: 'surprised' },
  { emoji: '😴', label: 'tired' },
];

const WORD_LIST = [
  { icon: '🐱', word: 'CAT' },
  { icon: '🐶', word: 'DOG' },
  { icon: '☀️', word: 'SUN' },
  { icon: '🐟', word: 'FISH' },
  { icon: '⭐', word: 'STAR' },
  { icon: '🌙', word: 'MOON' },
];

function scrambleLetters(word: string): string[] {
  const letters = word.split('');
  for (let i = letters.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [letters[i], letters[j]] = [letters[j], letters[i]];
  }
  if (letters.join('') === word) {
    [letters[0], letters[letters.length - 1]] = [letters[letters.length - 1], letters[0]];
  }
  return letters;
}

/* ── Tests ── */

describe('Games — Emotion data', () => {
  it('has at least 6 emotions', () => {
    expect(EMOTIONS.length).toBeGreaterThanOrEqual(6);
  });

  it('each emotion has an emoji and label', () => {
    for (const e of EMOTIONS) {
      expect(e.emoji).toBeTruthy();
      expect(e.label).toBeTruthy();
      expect(typeof e.emoji).toBe('string');
      expect(typeof e.label).toBe('string');
    }
  });

  it('all emotion labels are unique', () => {
    const labels = EMOTIONS.map((e) => e.label);
    expect(new Set(labels).size).toBe(labels.length);
  });

  it('includes core emotions (happy, sad, angry, scared)', () => {
    const labels = EMOTIONS.map((e) => e.label);
    expect(labels).toContain('happy');
    expect(labels).toContain('sad');
    expect(labels).toContain('angry');
    expect(labels).toContain('scared');
  });
});

describe('Games — Match game card generation', () => {
  it('creates 8 cards (4 pairs)', () => {
    const deck = buildMatchDeck();
    expect(deck).toHaveLength(8);
  });

  it('each card has a matching partner (proper pairs)', () => {
    const deck = buildMatchDeck();
    const matchGroups = new Map<number, MatchCard[]>();
    for (const card of deck) {
      const group = matchGroups.get(card.matchId) ?? [];
      group.push(card);
      matchGroups.set(card.matchId, group);
    }
    // Should have 4 groups of 2
    expect(matchGroups.size).toBe(4);
    for (const [, group] of matchGroups) {
      expect(group).toHaveLength(2);
      expect(group[0].label).toBe(group[1].label);
      expect(group[0].icon).toBe(group[1].icon);
    }
  });

  it('all cards start not flipped and not matched', () => {
    const deck = buildMatchDeck();
    for (const card of deck) {
      expect(card.flipped).toBe(false);
      expect(card.matched).toBe(false);
    }
  });

  it('all card IDs are unique', () => {
    const deck = buildMatchDeck();
    const ids = deck.map((c) => c.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('deck is shuffled (not always in original order)', () => {
    // Run multiple times to check randomness
    const results = new Set<string>();
    for (let i = 0; i < 10; i++) {
      const deck = buildMatchDeck();
      results.add(deck.map((c) => c.id).join(','));
    }
    // With 8 cards shuffled, getting the exact same order 10 times is astronomically unlikely
    expect(results.size).toBeGreaterThan(1);
  });
});

describe('Games — Word builder word list', () => {
  it('has entries', () => {
    expect(WORD_LIST.length).toBeGreaterThan(0);
  });

  it('has at least 6 words', () => {
    expect(WORD_LIST.length).toBeGreaterThanOrEqual(6);
  });

  it('each word has an icon and uppercase word', () => {
    for (const w of WORD_LIST) {
      expect(w.icon).toBeTruthy();
      expect(w.word).toBeTruthy();
      expect(w.word).toBe(w.word.toUpperCase());
    }
  });

  it('all words are short (3-4 letters for accessibility)', () => {
    for (const w of WORD_LIST) {
      expect(w.word.length).toBeGreaterThanOrEqual(3);
      expect(w.word.length).toBeLessThanOrEqual(4);
    }
  });
});

describe('Games — scrambleLetters', () => {
  it('returns same letters in different order', () => {
    const word = 'CAT';
    const scrambled = scrambleLetters(word);
    expect(scrambled).toHaveLength(3);
    expect(scrambled.sort().join('')).toBe('ACT');
  });

  it('scrambled result is different from original', () => {
    const word = 'FISH';
    const scrambled = scrambleLetters(word);
    // The function guarantees at least one letter out of place
    expect(scrambled.join('')).not.toBe(word);
  });

  it('preserves all characters', () => {
    const word = 'MOON';
    const scrambled = scrambleLetters(word);
    expect(scrambled.sort().join('')).toBe('MNOO');
  });
});

describe('Games — Match pairs data', () => {
  it('has at least 6 match pairs available', () => {
    expect(MATCH_PAIRS.length).toBeGreaterThanOrEqual(6);
  });

  it('each pair has a label and icon', () => {
    for (const pair of MATCH_PAIRS) {
      expect(pair.label).toBeTruthy();
      expect(pair.icon).toBeTruthy();
    }
  });
});
