/**
 * mathLatex — convert the plain-text math expression that the user builds
 * via taps into a LaTeX string KaTeX can render.
 *
 * The math keyboard inserts unicode glyphs ("×", "÷", "π") and template
 * shorthand ("\frac{}{}"). KaTeX wants LaTeX commands. This module owns
 * the mapping so MathPanel doesn't carry it inline. Templates from step 5
 * are emitted as raw LaTeX directly so they pass through unchanged.
 */

const SYMBOL_TO_LATEX: Record<string, string> = {
    '×': '\\times ',
    '÷': '\\div ',
    '≠': '\\ne ',
    '≈': '\\approx ',
    '≤': '\\le ',
    '≥': '\\ge ',
    '±': '\\pm ',
    '·': '\\cdot ',
    '∞': '\\infty ',
    '∑': '\\sum ',
    '∏': '\\prod ',
    '∫': '\\int ',
    '∂': '\\partial ',
    '√': '\\sqrt ',
    '∛': '\\sqrt[3] ',
    '∜': '\\sqrt[4] ',
    '∈': '\\in ',
    '∉': '\\notin ',
    '⊂': '\\subset ',
    '⊆': '\\subseteq ',
    '∪': '\\cup ',
    '∩': '\\cap ',
    '∅': '\\emptyset ',
    '∀': '\\forall ',
    '∃': '\\exists ',
    '¬': '\\neg ',
    '∧': '\\land ',
    '∨': '\\lor ',
    '→': '\\to ',
    '↔': '\\leftrightarrow ',
    '⇒': '\\Rightarrow ',
    '⇔': '\\Leftrightarrow ',
    'π': '\\pi ',
    'τ': '\\tau ',
    'φ': '\\varphi ',
    'α': '\\alpha ',
    'β': '\\beta ',
    'γ': '\\gamma ',
    'δ': '\\delta ',
    'ε': '\\varepsilon ',
    'θ': '\\theta ',
    'λ': '\\lambda ',
    'μ': '\\mu ',
    'ρ': '\\rho ',
    'σ': '\\sigma ',
    'ω': '\\omega ',
    '°': '^{\\circ}',
    '²': '^{2}',
    '³': '^{3}',
    '½': '\\frac{1}{2}',
    '⅓': '\\frac{1}{3}',
    '⅔': '\\frac{2}{3}',
    '¼': '\\frac{1}{4}',
    '¾': '\\frac{3}{4}',
};

/**
 * Convert the user-built expression string to a LaTeX body suitable for
 * KaTeX rendering. Pass-through for already-LaTeX templates: anything
 * starting with `\frac` / `\sqrt` / `^{` etc. is left untouched so
 * step-5 template inserters can emit raw LaTeX.
 */
export function expressionToLatex(expression: string): string {
    let out = '';
    let i = 0;
    while (i < expression.length) {
        const ch = expression[i];
        // Pass through LaTeX commands the keyboard might have inserted as-is.
        if (ch === '\\') {
            // Capture the command + its braced args greedily so KaTeX gets a
            // valid token. Stop at whitespace or the next non-identifier char.
            let j = i + 1;
            while (j < expression.length && /[a-zA-Z]/.test(expression[j])) j++;
            // Eat balanced {...} arg groups.
            while (j < expression.length && expression[j] === '{') {
                let depth = 1;
                j++;
                while (j < expression.length && depth > 0) {
                    if (expression[j] === '{') depth++;
                    else if (expression[j] === '}') depth--;
                    j++;
                }
            }
            out += expression.slice(i, j);
            i = j;
            continue;
        }
        const mapped = SYMBOL_TO_LATEX[ch];
        if (mapped) {
            out += mapped;
            i++;
            continue;
        }
        out += ch;
        i++;
    }
    return out;
}
