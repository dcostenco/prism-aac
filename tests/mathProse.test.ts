/**
 * mathTextToProse — pins the May 2026 OCR-result speak quality fix.
 *
 * User report (Image #22): tapped Speak on the OCR'd algebra
 * worksheet ("0. x+15<12 / g.r. 9 / x<12-15") and TTS quality was
 * unintelligible — engine read each operator literally with no
 * phrasing between them. mathTextToProse rewrites the math notation
 * into spoken English BEFORE the text reaches TTS.
 */
import { describe, it, expect } from 'vitest';
import { mathTextToProse, chunkForTts } from '@/services/mathProse';

describe('mathTextToProse', () => {
  it('handles the user-reported algebra worksheet OCR', () => {
    const ocr = '0. x+15<12\ng.r. 9\nx<12-15';
    const out = mathTextToProse(ocr);
    expect(out).toContain('Problem 0');
    expect(out).toContain(' plus ');
    expect(out).toContain(' is less than ');
    expect(out).toContain(' minus ');
    expect(out).toContain('Grade');
    // No raw `<` or `+` remain in the final spoken string
    expect(out).not.toMatch(/[<+]/);
    expect(out).not.toMatch(/g\.r\./);
  });

  it('rewrites comparison operators in priority order (compound before single)', () => {
    expect(mathTextToProse('a <= b')).toContain('is less than or equal to');
    expect(mathTextToProse('a >= b')).toContain('is greater than or equal to');
    expect(mathTextToProse('a != b')).toContain('not equal to');
    expect(mathTextToProse('a ≈ b')).toContain('approximately');
    expect(mathTextToProse('a ≤ b')).toContain('is less than or equal to');
    expect(mathTextToProse('a ≥ b')).toContain('is greater than or equal to');
    expect(mathTextToProse('a ≠ b')).toContain('not equal to');
    // Plain < / > don't accidentally pick up "or equal to"
    expect(mathTextToProse('a < b')).toContain('is less than');
    expect(mathTextToProse('a < b')).not.toContain('or equal');
  });

  it('rewrites arithmetic operators', () => {
    expect(mathTextToProse('5+3')).toContain('plus');
    expect(mathTextToProse('5×3')).toContain('times');
    expect(mathTextToProse('5÷3')).toContain('divided by');
    expect(mathTextToProse('10/2')).toContain('divided by');
    expect(mathTextToProse('5=3')).toContain('equals');
    expect(mathTextToProse('5²')).toContain('squared');
    expect(mathTextToProse('5³')).toContain('cubed');
  });

  it('distinguishes binary subtraction from unary negation', () => {
    // Binary: digit on the left
    expect(mathTextToProse('10-3')).toMatch(/10\s+minus\s+3/);
    // Unary at start
    expect(mathTextToProse('-3')).toContain('negative 3');
    // Unary after operator
    expect(mathTextToProse('5+-3')).toContain('negative 3');
  });

  it('handles area / volume superscript shortcuts', () => {
    expect(mathTextToProse('200 ft²')).toContain('square feet');
    expect(mathTextToProse('5 m²')).toContain('square meters');
    expect(mathTextToProse('10 m³')).toContain('cubic meters');
  });

  it('numbers problems on multi-problem worksheets', () => {
    const out = mathTextToProse('1. x+1=2\n2. y-3=4');
    expect(out).toContain('Problem 1');
    expect(out).toContain('Problem 2');
  });

  it('preserves empty / whitespace input', () => {
    expect(mathTextToProse('')).toBe('');
    expect(mathTextToProse('   ')).toBe('   ');
  });

  it('passes through plain text untouched', () => {
    const plain = 'Hello world.';
    expect(mathTextToProse(plain)).toBe('Hello world.');
  });

  it('joins multi-line input with sentence breaks for TTS phrasing', () => {
    const out = mathTextToProse('0. x+15<12\ng.r. 9\nx<12-15');
    // Each transformation ends with a period+space so TTS pauses
    // between problems instead of running them together.
    expect(out.split(/\.\s/).length).toBeGreaterThan(2);
  });
});

describe('chunkForTts', () => {
  it('returns the input as a single chunk when under maxChars', () => {
    expect(chunkForTts('Short text.', 250)).toEqual(['Short text.']);
  });

  it('returns empty array for empty/whitespace input', () => {
    expect(chunkForTts('', 250)).toEqual([]);
    expect(chunkForTts('   ', 250)).toEqual([]);
  });

  it('splits on sentence boundaries first', () => {
    const text = 'First sentence here. Second sentence here. Third sentence here.';
    const chunks = chunkForTts(text, 30);
    // Each chunk is sentence-bounded — no chunk starts mid-sentence.
    chunks.forEach((c) => {
      expect(c.length).toBeLessThanOrEqual(30);
      // Each chunk should start with capitalized "First"/"Second"/"Third"
      expect(c[0]).toMatch(/[A-Z]/);
    });
    expect(chunks.join(' ')).toContain('First sentence');
    expect(chunks.join(' ')).toContain('Third sentence');
  });

  it('keeps every chunk under maxChars (worksheet OCR sample)', () => {
    // Realistic length — mirrors what mathTextToProse outputs for the
    // user's algebra worksheet (~459 chars in trace evidence).
    const prose =
      'Problem 0. x plus 15 is less than 12. Grade 9. x is less than 12 minus 15. ' +
      'Problem 1. y plus 7 is greater than 3. y is greater than 3 minus 7. ' +
      'Problem 2. 2 times z minus 4 equals 10. z equals 7. ' +
      'Problem 3. negative 3 plus a is less than or equal to 8. a is less than or equal to 11. ' +
      'Problem 4. 5 squared plus 3 cubed equals 52.';
    const chunks = chunkForTts(prose, 250);
    chunks.forEach((c) => expect(c.length).toBeLessThanOrEqual(250));
    expect(chunks.length).toBeGreaterThan(1);
    // Round-trip: joining the chunks reconstructs the input content
    // (whitespace may differ — we just need every "Problem N." preserved).
    const joined = chunks.join(' ');
    for (let n = 0; n <= 4; n++) {
      expect(joined).toContain(`Problem ${n}.`);
    }
  });

  it('falls back to comma split when a sentence exceeds maxChars', () => {
    const longSent = 'a' + ', b'.repeat(60) + '.';
    // longSent is one sentence ~243 chars; with maxChars=80 it must
    // split on commas, never hard-cut mid-clause.
    const chunks = chunkForTts(longSent, 80);
    chunks.forEach((c) => expect(c.length).toBeLessThanOrEqual(80));
    // Reassembled text should still contain all the b's
    expect(chunks.join(' ').match(/b/g)?.length).toBe(60);
  });

  it('falls back to word boundary when a comma-split clause still exceeds maxChars', () => {
    const longWord = 'word '.repeat(50).trim() + '.';
    // 50 words * 5 chars = 250 chars in one comma-less sentence.
    const chunks = chunkForTts(longWord, 40);
    chunks.forEach((c) => {
      expect(c.length).toBeLessThanOrEqual(40);
      // Never split mid-word — every chunk must consist of whole words.
      expect(c).toMatch(/^(\w+\.?)( \w+\.?)*$/);
    });
  });
});
