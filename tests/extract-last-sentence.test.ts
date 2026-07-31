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

  it('recognizes the Arabic question mark as a sentence boundary', () => {
    expect(extractLastSentence('أنا بخير. كيف حالك؟')).toBe('كيف حالك؟');
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

  it('does not split on abbreviation boundaries', () => {
    // "Mr." is in the ABBREVIATIONS set — the "." after it must not be
    // treated as a sentence boundary. The full sentence should be returned.
    expect(extractLastSentence('Mr. Smith said hello.')).toBe('Mr. Smith said hello.');
    expect(extractLastSentence('Dr. Jones arrived.')).toBe('Dr. Jones arrived.');
    expect(extractLastSentence('Call me at 5. Dr. Smith will see you.')).toBe('Dr. Smith will see you.');
  });
});
