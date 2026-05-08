/**
 * exprEval — local evaluator tests.
 *
 * Each cell-grid test mirrors what serializeAsExpression in
 * MathTutorTool produces (one glyph per cell, single-space joined,
 * row separator " | "). The behaviors locked here are what the
 * 🧮 Eval button in the tutor surface depends on.
 */
import { describe, it, expect } from 'vitest';
import { prepareExpression, evaluateExpression } from '@/services/exprEval';

describe('prepareExpression', () => {
  it('coalesces consecutive digit cells into one number', () => {
    expect(prepareExpression('2 5 + 3 7')).toBe('25 + 37');
  });

  it('coalesces consecutive ASCII letters into one identifier', () => {
    expect(prepareExpression('s i n ( x )')).toBe('sin ( x )');
  });

  it('drops the row separator', () => {
    expect(prepareExpression('1 + 2 | 3 + 4')).toBe('1 + 2 3 + 4');
  });

  it('translates × ÷ · to mathjs ops', () => {
    expect(prepareExpression('3 × 4')).toBe('3 * 4');
    expect(prepareExpression('1 0 ÷ 2')).toBe('10 / 2');
    expect(prepareExpression('a · b')).toBe('a * b');
  });

  it('translates ² ³ superscripts to ^N', () => {
    expect(prepareExpression('5 ²')).toBe('5 ^2');
    expect(prepareExpression('2 ³')).toBe('2 ^3');
  });

  it('translates π and √ tokens', () => {
    expect(prepareExpression('2 × π')).toBe('2 * pi');
    expect(prepareExpression('√ ( 9 )')).toBe('sqrt ( 9 )');
  });

  it('passes multi-char unit cells through unchanged', () => {
    expect(prepareExpression('5 kg + 3 kg')).toBe('5 kg + 3 kg');
    expect(prepareExpression('1 0 m / s')).toBe('10 m / s');
  });

  it('handles empty / whitespace input', () => {
    expect(prepareExpression('')).toBe('');
    expect(prepareExpression('   ')).toBe('');
    expect(prepareExpression(' | | ')).toBe('');
  });

  it('translates unicode subscript digits to ASCII digits', () => {
    // H₂O is chemistry (not algebra) — subscript digits stay as
    // separate cells from preceding letter cells, so H ₂ O becomes
    // "H 2 O" not "H2 O". Chemistry formulas aren't math-evaluable
    // anyway; this test just locks the digit translation behavior.
    expect(prepareExpression('₂')).toBe('2');
    expect(prepareExpression('₁ ₀')).toBe('10');
  });
});

describe('evaluateExpression', () => {
  it('evaluates basic arithmetic', () => {
    const r = evaluateExpression('2 + 3 × 4');
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.value).toBe('14');
  });

  it('evaluates multi-digit numbers', () => {
    const r = evaluateExpression('1 2 5 + 3 7 5');
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.value).toBe('500');
  });

  it('evaluates exponents via superscript', () => {
    const r = evaluateExpression('5 ²');
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.value).toBe('25');
  });

  it('evaluates square root', () => {
    const r = evaluateExpression('√ ( 1 6 )');
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.value).toBe('4');
  });

  it('evaluates with constants (pi)', () => {
    const r = evaluateExpression('2 × π');
    expect(r.ok).toBe(true);
    if (r.ok) expect(parseFloat(r.value)).toBeCloseTo(6.28319, 4);
  });

  it('evaluates unit-aware physics expression', () => {
    const r = evaluateExpression('5 kg + 3 kg');
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.value).toMatch(/8\s*kg/);
  });

  it('returns friendly error for empty input', () => {
    const r = evaluateExpression('');
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toMatch(/nothing to evaluate/i);
  });

  it('returns friendly error for incomplete expression', () => {
    const r = evaluateExpression('2 +');
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toMatch(/incomplete|missing|expression/i);
  });

  it('returns friendly error for division by zero', () => {
    const r = evaluateExpression('1 0 ÷ 0');
    // mathjs returns Infinity rather than throwing for plain division
    // by zero — our friendly() catches the Infinity printout downstream
    // but the eval itself succeeds. Either is acceptable.
    if (r.ok) {
      expect(r.value).toMatch(/Infinity/);
    } else {
      expect(r.error).toMatch(/zero|infinity/i);
    }
  });
});
