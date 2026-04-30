import { describe, it, expect } from 'vitest';
import { classifyWord, classifyPhrase, CATEGORY_COLORS, CATEGORY_LEGEND } from '@/engine/colorCoding';

describe('ColorCoding — Modified Fitzgerald Key word classification', () => {
  // Yellow: Pronouns / People
  it('classifies pronouns as pronoun (yellow)', () => {
    expect(classifyWord('I')).toBe('pronoun');
    expect(classifyWord('you')).toBe('pronoun');
    expect(classifyWord('we')).toBe('pronoun');
    expect(classifyWord('they')).toBe('pronoun');
    expect(classifyWord('Mom')).toBe('pronoun');
    expect(classifyWord('Dad')).toBe('pronoun');
  });

  // Green: Verbs / Actions
  it('classifies verbs as verb (green)', () => {
    expect(classifyWord('want')).toBe('verb');
    expect(classifyWord('go')).toBe('verb');
    expect(classifyWord('eat')).toBe('verb');
    expect(classifyWord('help')).toBe('verb');
    expect(classifyWord('need')).toBe('verb');
    expect(classifyWord('can')).toBe('verb');
  });

  // Blue: Adjectives / Descriptors
  it('classifies adjectives as adjective (blue)', () => {
    expect(classifyWord('hungry')).toBe('adjective');
    expect(classifyWord('thirsty')).toBe('adjective');
    expect(classifyWord('happy')).toBe('adjective');
    expect(classifyWord('more')).toBe('adjective');
    expect(classifyWord('done')).toBe('adjective');
  });

  // Orange: Nouns / Things
  it('classifies common nouns as noun (orange)', () => {
    expect(classifyWord('pizza')).toBe('noun');
    expect(classifyWord('water')).toBe('noun');
    expect(classifyWord('sandwich')).toBe('noun');
    expect(classifyWord('book')).toBe('noun');
  });

  // Pink: Social words
  it('classifies social words as social (pink)', () => {
    expect(classifyWord('hello')).toBe('social');
    expect(classifyWord('goodbye')).toBe('social');
    expect(classifyWord('please')).toBe('social');
    expect(classifyWord('sorry')).toBe('social');
    expect(classifyWord('yes')).toBe('social');
    expect(classifyWord('no')).toBe('social');
  });

  // White: Grammar / Misc
  it('classifies grammar words as grammar (gray)', () => {
    expect(classifyWord('the')).toBe('grammar');
    expect(classifyWord('and')).toBe('grammar');
    expect(classifyWord('to')).toBe('grammar');
    expect(classifyWord('in')).toBe('grammar');
  });

  // Purple: Places
  it('classifies places as place (purple)', () => {
    expect(classifyWord('home')).toBe('place');
    expect(classifyWord('school')).toBe('place');
    expect(classifyWord('park')).toBe('place');
    expect(classifyWord('bathroom')).toBe('place');
    expect(classifyWord('mall')).toBe('place');
  });

  it('is case-insensitive', () => {
    expect(classifyWord('HELLO')).toBe('social');
    expect(classifyWord('Pizza')).toBe('noun');
    expect(classifyWord('I')).toBe('pronoun');
  });

  it('handles punctuation in words', () => {
    expect(classifyWord("don't")).toBe('grammar');
    expect(classifyWord('hello!')).toBe('social');
  });

  // Heuristic fallbacks
  it('classifies -ing words as verbs (heuristic)', () => {
    expect(classifyWord('walking')).toBe('verb');
    expect(classifyWord('running')).toBe('verb');
  });

  it('classifies unknown words as noun (safe default)', () => {
    expect(classifyWord('Chipotle')).toBe('noun');
    expect(classifyWord('quesadilla')).toBe('noun');
  });
});

describe('ColorCoding — Phrase classification', () => {
  it('classifies each word in "I want pizza"', () => {
    const result = classifyPhrase('I want pizza');
    const words = result.filter(t => t.word.trim());
    expect(words[0]).toMatchObject({ word: 'I', category: 'pronoun' });
    expect(words[1]).toMatchObject({ word: 'want', category: 'verb' });
    expect(words[2]).toMatchObject({ word: 'pizza', category: 'noun' });
  });

  it('preserves spaces as transparent tokens', () => {
    const result = classifyPhrase('I want');
    expect(result[1].word).toBe(' ');
    expect(result[1].color).toBe('transparent');
  });

  it('classifies Help page phrase "I need help"', () => {
    const result = classifyPhrase('I need help');
    const words = result.filter(t => t.word.trim());
    expect(words[0].color).toBe(CATEGORY_COLORS.pronoun);   // I = yellow
    expect(words[1].color).toBe(CATEGORY_COLORS.verb);       // need = green
    expect(words[2].color).toBe(CATEGORY_COLORS.verb);       // help = green
  });
});

describe('ColorCoding — Legend completeness', () => {
  it('legend covers all 7 visible categories', () => {
    expect(CATEGORY_LEGEND).toHaveLength(7);
  });

  it('each legend entry has color matching CATEGORY_COLORS', () => {
    for (const entry of CATEGORY_LEGEND) {
      expect(entry.color).toBe(CATEGORY_COLORS[entry.category]);
    }
  });
});

describe('ColorCoding — Consistency with AAC default phrases', () => {
  it('"All done" → adjective (done = adjective)', () => {
    const result = classifyPhrase('All done');
    const words = result.filter(t => t.word.trim());
    expect(words[0].category).toBe('adjective'); // all
    expect(words[1].category).toBe('adjective'); // done
  });

  it('"Bathroom" → place', () => {
    expect(classifyWord('Bathroom')).toBe('place');
  });

  it('"Thank you" → social + pronoun', () => {
    const result = classifyPhrase('Thank you');
    const words = result.filter(t => t.word.trim());
    // "thank" is not in social set (only "thanks" is), but "you" is pronoun
    expect(words[1].category).toBe('pronoun');
  });
});
