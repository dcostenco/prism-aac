/**
 * Phase 3 of the picture-coverage work: pictures for abstract meanings that the big-list
 * languages' prediction bars are full of (result, system, goal, economy, politics, media ...). Each is a symbol built from
 * concrete parts, checked before shipping; the words whose first reading stayed
 * another word after two redraws stay words. A few words reuse the picture of a close English word. The other languages
 * reach these pictures through their word tables (tests/picture-words.test.ts).
 */
import { describe, expect, it } from 'vitest';
import { builtInVocabularySymbol } from '@/lib/builtInSymbols';

const url = (word: string) => builtInVocabularySymbol(word, 'en')?.url ?? null;

describe('abstract English word pictures', () => {
  it.each([
    'result', 'system', 'analysis', 'language', 'information', 'politics', 'development', 'goal', 'event', 'economy',
    'real', 'service', 'official', 'series', 'member', 'effort', 'diet', 'pressure', 'advice', 'announce', 'freedom',
    'media', 'setting', 'review', 'increase', 'report', 'presentation', 'solve', 'unique', 'career', 'majority', 'control',
    'reach', 'lead', 'activity', 'organization',
  ])('shows its own symbol for "%s"', (word) => {
    expect(url(word)).toBe(`/prism-aac/symbols/w-${word}.png`);
  });
});

describe('abstract words that reuse the picture of a close word', () => {
  it.each([
    ['state', 'government'], ['national', 'country'], ['public', 'group'], ['population', 'group'], ['society', 'group'],
    ['mind', 'brain'], ['committee', 'meeting'], ['council', 'meeting'], ['article', 'newspaper'], ['production', 'industry'],
    ['possible', 'maybe'], ['succeed', 'win'], ['growth', 'grow'], ['purpose', 'goal'], ['suggestion', 'advice'],
    ['crisis', 'emergency'], ['scene', 'stage'], ['difference', 'different'],
  ])('"%s" shows the picture of "%s"', (word, base) => {
    expect(url(base)).not.toBeNull();
    expect(url(word)).toBe(url(base));
  });
});

describe('abstract words the judge rejected', () => {
  // Two or three redraws each still read as another word first (main as a network or a road, moment as an hourglass or a
  // clock, culture as art, period as a week, level as half a battery, cause as dice, value as a diamond, reason as an
  // idea ...): the word stays a word rather than ship a picture that says something else.
  it.each([
    'main', 'moment', 'culture', 'period', 'cause', 'level', 'method', 'reason', 'effect', 'opinion', 'example', 'model',
    'opportunity', 'relationship', 'structure', 'local', 'strategy', 'value', 'clear', 'challenge', 'contribution', 'essay',
    'popular', 'foreign', 'adventure', 'cooperation', 'product', 'course',
  ])('"%s" has no picture', (word) => {
    expect(url(word)).toBeNull();
  });
});
