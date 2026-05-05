import { describe, it, expect } from 'vitest';
import { expressionToLatex } from '@/services/mathLatex';

describe('expressionToLatex — operator symbols', () => {
    it('maps × to \\times', () => {
        expect(expressionToLatex('5 × 6')).toContain('\\times');
    });
    it('maps ÷ to \\div', () => {
        expect(expressionToLatex('10 ÷ 2')).toContain('\\div');
    });
    it('maps ≠ ≈ ≤ ≥ ± · in one pass', () => {
        const out = expressionToLatex('a ≠ b ≈ c ≤ d ≥ e ± f · g');
        expect(out).toContain('\\ne');
        expect(out).toContain('\\approx');
        expect(out).toContain('\\le');
        expect(out).toContain('\\ge');
        expect(out).toContain('\\pm');
        expect(out).toContain('\\cdot');
    });
});

describe('expressionToLatex — Greek letters', () => {
    it('maps π to \\pi', () => {
        expect(expressionToLatex('2π')).toContain('\\pi');
    });
    it('maps a representative set of Greek letters', () => {
        const out = expressionToLatex('α β γ δ θ λ μ σ ω');
        for (const cmd of ['\\alpha', '\\beta', '\\gamma', '\\delta', '\\theta', '\\lambda', '\\mu', '\\sigma', '\\omega']) {
            expect(out).toContain(cmd);
        }
    });
});

describe('expressionToLatex — sets and logic', () => {
    it('maps ∈ ∉ ⊂ ⊆ ∪ ∩ ∅ ∀ ∃', () => {
        const out = expressionToLatex('x ∈ A ⊂ B ∪ C ∩ ∅ ∀ ∃');
        for (const cmd of ['\\in', '\\subset', '\\cup', '\\cap', '\\emptyset', '\\forall', '\\exists']) {
            expect(out).toContain(cmd);
        }
    });
    it('maps logic connectives', () => {
        const out = expressionToLatex('p ∧ q ∨ ¬r → s');
        expect(out).toContain('\\land');
        expect(out).toContain('\\lor');
        expect(out).toContain('\\neg');
        expect(out).toContain('\\to');
    });
});

describe('expressionToLatex — calculus and templates', () => {
    it('maps ∑ ∏ ∫ ∂ √', () => {
        const out = expressionToLatex('∑ ∏ ∫ ∂ √');
        for (const cmd of ['\\sum', '\\prod', '\\int', '\\partial', '\\sqrt']) {
            expect(out).toContain(cmd);
        }
    });
    it('maps degree symbol to ^{\\circ}', () => {
        expect(expressionToLatex('90°')).toContain('^{\\circ}');
    });
    it('maps unicode super/subscripts', () => {
        expect(expressionToLatex('x²')).toContain('^{2}');
        expect(expressionToLatex('x³')).toContain('^{3}');
    });
    it('maps unicode fractions', () => {
        expect(expressionToLatex('½ + ¼')).toContain('\\frac{1}{2}');
        expect(expressionToLatex('½ + ¼')).toContain('\\frac{1}{4}');
    });
});

describe('expressionToLatex — LaTeX passthrough', () => {
    it('preserves \\frac{1}{2} typed by template inserter', () => {
        expect(expressionToLatex('\\frac{1}{2}')).toBe('\\frac{1}{2}');
    });
    it('preserves nested braces', () => {
        const input = '\\frac{a^{2}}{b+1}';
        expect(expressionToLatex(input)).toBe(input);
    });
    it('preserves \\sqrt[3]{x}', () => {
        const input = '\\sqrt[3]{x}';
        expect(expressionToLatex(input)).toContain('\\sqrt[3]{x}');
    });
    it('preserves \\sum_{i=1}^{n} alongside symbols', () => {
        const input = '\\sum_{i=1}^{n} i × 2';
        const out = expressionToLatex(input);
        expect(out).toContain('\\sum_{i=1}^{n}');
        expect(out).toContain('\\times');
    });
    it('handles consecutive LaTeX commands without merging them', () => {
        const out = expressionToLatex('\\alpha\\beta');
        expect(out).toContain('\\alpha');
        expect(out).toContain('\\beta');
    });
    it('leaves plain ASCII alone', () => {
        expect(expressionToLatex('5x + 7y = 12')).toBe('5x + 7y = 12');
    });
});

describe('expressionToLatex — edge cases', () => {
    it('returns empty string for empty input', () => {
        expect(expressionToLatex('')).toBe('');
    });
    it('handles trailing backslash without crashing', () => {
        expect(() => expressionToLatex('a + \\')).not.toThrow();
    });
    it('handles unmatched braces without crashing', () => {
        expect(() => expressionToLatex('\\frac{1}')).not.toThrow();
    });
});
