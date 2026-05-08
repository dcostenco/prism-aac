/**
 * extractLastSentence — same suite as the main app, kept here so the
 * extension can ship without depending on the prism-aac/ directory.
 */
import { describe, it, expect } from 'vitest';
import { extractLastSentence } from '../src/extractLastSentence';

describe('extractLastSentence (chrome-extension)', () => {
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

  it('strips trailing whitespace before evaluation', () => {
    expect(extractLastSentence('Hello. World.   ')).toBe('World.');
  });

  it('over-triggers on abbreviations (documented MVP cost)', () => {
    expect(extractLastSentence('Mr. Smith said hello.')).toBe('Smith said hello.');
  });
});
