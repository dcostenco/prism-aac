/**
 * exprEval — local numeric/symbolic evaluator for the math cell-grid.
 *
 * The grid serializer (`MathTutorTool.serializeAsExpression`) joins
 * one-glyph-per-cell with single spaces ("2 5 + 3 7" for 25 + 37),
 * and rows with " | ". Before passing to mathjs we have to:
 *   1. drop the row separator (treat all rows as one expression)
 *   2. coalesce consecutive digit / dot cells into a single number
 *   3. coalesce consecutive ASCII letters into a single identifier
 *   4. translate unicode math symbols (×, ÷, π, √, ², ³, ·) to mathjs
 *
 * Returns either a printable result or a friendly error reason — the
 * tutor surface displays it as text. The `🧮 Eval` button is the
 * fastest, lowest-cost feedback path: no AI roundtrip, instant.
 */
import { create, all, type MathScope } from 'mathjs';

// Restricted mathjs instance. Block all dynamic code loading and
// recursive evaluation paths that could be used to escape the sandbox.
const _math = create(all, {});
const _sandbox_deny = () => { throw new Error('not allowed in AAC math'); };
_math.import({
  import: _sandbox_deny,      // blocks dynamic code loading
  createUnit: _sandbox_deny,  // blocks new unit injection
  reviver: _sandbox_deny,     // blocks custom deserialization
  // Note: parse and evaluate cannot be blocked — they are used internally
  // by mjsEvaluate itself. The expression length cap (500 chars) and
  // scope freeze are the primary defences against abuse.
}, { override: true });
const { evaluate: mjsEvaluate } = _math;

export interface EvalSuccess {
  ok: true;
  /** Printable representation: "42", "5.7 m / s", "2/3", etc. */
  value: string;
  /** The cleaned-up expression we actually fed to mathjs (debug). */
  cleaned: string;
}

export interface EvalFailure {
  ok: false;
  /** Short, child-readable reason. */
  error: string;
  /** Raw thrown message (debug). */
  raw?: string;
  /** The cleaned-up expression we attempted (debug). */
  cleaned?: string;
}

export type EvalResult = EvalSuccess | EvalFailure;

const UNICODE_OPS: Record<string, string> = {
  '×': '*',
  '⋅': '*',
  '·': '*',
  '÷': '/',
  '−': '-',
  '–': '-',
  '—': '-',
  '²': '^2',
  '³': '^3',
  '⁴': '^4',
  '⁵': '^5',
  '⁶': '^6',
  '⁷': '^7',
  '⁸': '^8',
  '⁹': '^9',
  '√': 'sqrt',
  '∛': 'cbrt',
  'π': 'pi',
  '∞': 'Infinity',
  '≈': '==',
  '≤': '<=',
  '≥': '>=',
  '≠': '!=',
};

const UNICODE_DIGITS: Record<string, string> = {
  '⁰': '0', '¹': '1',
  '₀': '0', '₁': '1', '₂': '2', '₃': '3', '₄': '4',
  '₅': '5', '₆': '6', '₇': '7', '₈': '8', '₉': '9',
};

const TOKEN_DIGIT = /[0-9.]/;
const TOKEN_LETTER = /[A-Za-z_]/;

/**
 * Take the row-and-cell-spaced serialized expression and produce a
 * mathjs-friendly string. Visible for unit testing.
 */
export function prepareExpression(serialized: string): string {
  // Tokenise WITHOUT stripping the row separator — we need it as an
  // explicit flush boundary so digits / letters from different rows
  // don't fuse into one token (e.g. row1 ends "2", row2 starts "3"
  // must not become "23").
  const cells = serialized.split(/\s+/).filter(Boolean);
  if (cells.length === 0) return '';

  const out: string[] = [];
  let buf: string[] = [];
  let bufKind: 'digit' | 'letter' | null = null;

  const flush = () => {
    if (buf.length === 0) return;
    out.push(buf.join(''));
    buf = [];
    bufKind = null;
  };

  for (const raw of cells) {
    if (raw === '|') {
      flush();
      continue;
    }

    let cell = raw;
    if (UNICODE_DIGITS[cell]) cell = UNICODE_DIGITS[cell];

    // Multi-char unit tokens (mL, kg, m/s) commit as a single cell — pass through.
    const isDigitCell = cell.length === 1 && TOKEN_DIGIT.test(cell);
    const isLetterCell = cell.length === 1 && TOKEN_LETTER.test(cell);

    if (isDigitCell) {
      if (bufKind === 'letter') flush();
      bufKind = 'digit';
      buf.push(cell);
      continue;
    }
    if (isLetterCell) {
      if (bufKind === 'digit') flush();
      bufKind = 'letter';
      buf.push(cell);
      continue;
    }

    flush();

    if (UNICODE_OPS[cell]) {
      const mapped = UNICODE_OPS[cell];
      // Translate sqrt-glyph followed by parenthesised argument:
      // "√ ( 9 )" → "sqrt(9)". A bare "√" preceding a digit/letter
      // becomes "sqrt(...)" later; for now emit the function name.
      out.push(mapped);
      continue;
    }

    // Unknown multi-char glyph (e.g. "kg", "Cl", "mol") — pass through
    // so mathjs can resolve it as a unit or a free variable.
    out.push(cell);
  }
  flush();

  // mathjs uses juxtaposition for implicit multiplication when sane
  // (e.g. "2pi"), but "5 kg / 2" needs explicit operators. We join
  // tokens with spaces; mathjs accepts that.
  return out.join(' ').trim();
}

/**
 * Evaluate a serialized cell-grid expression. `scope` lets the caller
 * inject variable bindings (currently unused but threaded for future
 * "x =" hint flow).
 */
export function evaluateExpression(
  serialized: string,
  scope?: MathScope,
): EvalResult {
  const cleaned = prepareExpression(serialized);
  if (!cleaned) {
    return { ok: false, error: 'Nothing to evaluate yet — tap some math first.' };
  }
  if (cleaned.length > 500) {
    return { ok: false, error: 'Expression too complex — simplify and try again.', cleaned };
  }
  try {
    // No callers currently pass scope. Normal object (not Object.create(null))
    // is required — mathjs needs Object.prototype for isComplex checks.
    const safeScope = scope ? Object.assign({}, scope) : {};
    Object.freeze(safeScope);
    const result = mjsEvaluate(cleaned, safeScope);
    if (result === undefined || result === null) {
      return { ok: false, error: 'No result.', cleaned };
    }
    let printable: string;
    if (typeof result === 'number') {
      printable = formatNumber(result);
    } else if (typeof result === 'string' || typeof result === 'boolean') {
      printable = String(result);
    } else if (typeof (result as { toString?: () => string }).toString === 'function') {
      printable = (result as { toString: () => string }).toString();
    } else {
      printable = JSON.stringify(result);
    }
    return { ok: true, value: printable, cleaned };
  } catch (e) {
    const raw = e instanceof Error ? e.message : String(e);
    return { ok: false, error: friendly(raw), raw, cleaned };
  }
}

function formatNumber(n: number): string {
  if (!Number.isFinite(n)) return String(n);
  if (Number.isInteger(n)) return n.toString();
  // 6 significant digits is plenty for school-math; trim trailing zeros.
  return parseFloat(n.toPrecision(6)).toString();
}

function friendly(raw: string): string {
  if (/Undefined symbol/i.test(raw)) {
    const m = raw.match(/Undefined symbol\s+(\S+)/i);
    return m ? `Don't know what "${m[1]}" means yet.` : "I don't recognize that symbol.";
  }
  if (/Unexpected (end of expression|operator|character|part)/i.test(raw)) {
    return 'The expression seems incomplete — finish typing it first.';
  }
  if (/Value expected/i.test(raw)) {
    return 'Looks like a number is missing somewhere.';
  }
  if (/Division by zero|Infinity/i.test(raw)) {
    return "Can't divide by zero.";
  }
  return raw.length > 80 ? raw.slice(0, 77) + '…' : raw;
}
