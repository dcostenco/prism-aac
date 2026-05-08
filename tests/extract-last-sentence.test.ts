/**
 * extractLastSentence — locks the heuristic that powers
 * speak-on-sentence-end (the Read&Write parity feature shipped for
 * users with reading/memory disabilities).
 */
import { describe, it, expect } from 'vitest';
import { __testing } from '@/components/Keyboard';

const { extractLastSentence } = __testing;

describe('extractLastSentence', () => {
  it('returns "" for empty / whitespace input', () => {
    expect(extractLastSentence('')).toBe('');
    expect(extractLastSentence('   \n  ')).toBe('');
  });

  it('returns the only sentence when no prior terminator exists', () => {
    expect(extractLastSentence('Just one.')).toBe('Just one.');
    expect(extractLastSentence('Hello world!')).toBe('Hello world!');
  });

  it('returns the last sentence when prior terminator exists', () => {
    expect(extractLastSentence('Hello. World.')).toBe('World.');
    expect(extractLastSentence('First! Second?')).toBe('Second?');
  });

  it('handles repeated terminators ("Wait!!")', () => {
    expect(extractLastSentence('Wait!!')).toBe('Wait!!');
    expect(extractLastSentence('Stop. Wait!!')).toBe('Wait!!');
  });

  it('handles trailing whitespace before evaluation', () => {
    expect(extractLastSentence('Hello. World.   ')).toBe('World.');
  });

  it('preserves the exact terminator character', () => {
    expect(extractLastSentence('A. B?')).toBe('B?');
    expect(extractLastSentence('A. B!')).toBe('B!');
  });

  it('skips internal whitespace cleanly', () => {
    expect(extractLastSentence('First.   Second.')).toBe('Second.');
  });

  it('over-triggers on abbreviations (known MVP cost — documented)', () => {
    // "Mr. Smith said hello." → after typing the second '.', the
    // previous '.' from "Mr." is treated as a sentence boundary, so
    // we speak "Smith said hello." instead of the full "Mr. Smith
    // said hello.". Acceptable for MVP — abbreviation detection is a
    // future improvement.
    expect(extractLastSentence('Mr. Smith said hello.')).toBe('Smith said hello.');
  });
});
