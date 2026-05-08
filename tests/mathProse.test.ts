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
import { mathTextToProse } from '@/services/mathProse';

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
