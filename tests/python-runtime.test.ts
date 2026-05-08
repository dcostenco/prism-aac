/**
 * pythonRuntime — wrapper-level contract tests.
 *
 * The Pyodide-WASM execution itself runs in a Worker that we don't
 * spin up here (the CDN load is ~10 MB and unsuitable for unit
 * runs). What we DO lock down:
 *
 *   • childFriendlyPyError — pure traceback → one-sentence summary
 *     map. This is what the AAC user actually reads when their code
 *     throws, so the wording / matching rules need a regression net.
 *   • evaluatePython / debugPython empty-input contract — both must
 *     short-circuit before touching the Worker on empty input.
 *
 * We intentionally do NOT exercise the Worker postMessage path here:
 *   - vitest's jsdom env doesn't load the './python-worker.ts' module
 *     URL the same way the browser does, so spawnWorker either
 *     returns null (graceful degrade path) or throws.
 *   - The browser-level integration is verified by e2e/math-eval-
 *     debug.spec.ts visibility cases + manual browser pass.
 */
import { describe, it, expect } from 'vitest';
import {
  childFriendlyPyError,
  evaluatePython,
  debugPython,
} from '@/services/pythonRuntime';

describe('childFriendlyPyError — traceback → child-readable summary', () => {
  it('translates SyntaxError to "typo"', () => {
    const tb = `  File "<exec>", line 1
    print("hello"
                ^
SyntaxError: '(' was never closed`;
    expect(childFriendlyPyError(tb)).toMatch(/typo/i);
  });

  it('extracts the offending name on NameError', () => {
    const tb = `Traceback (most recent call last):
  File "<exec>", line 1, in <module>
NameError: name 'banana' is not defined`;
    expect(childFriendlyPyError(tb)).toBe('"banana" hasn\'t been defined yet.');
  });

  it('falls back to a generic NameError message when name is unparseable', () => {
    const tb = 'NameError: something went wrong';
    expect(childFriendlyPyError(tb)).toBe("A name in the code isn't defined yet.");
  });

  it('translates IndentationError', () => {
    const tb = `  File "<exec>", line 2
    return x
    ^
IndentationError: unexpected indent`;
    expect(childFriendlyPyError(tb)).toMatch(/indentation/i);
  });

  it('translates ZeroDivisionError to plain English', () => {
    const tb = `Traceback (most recent call last):
  File "<exec>", line 1, in <module>
ZeroDivisionError: division by zero`;
    expect(childFriendlyPyError(tb)).toBe("Can't divide by zero.");
  });

  it('passes through TypeError with a normalized prefix', () => {
    const tb = "TypeError: unsupported operand type(s) for +: 'int' and 'str'";
    const out = childFriendlyPyError(tb);
    expect(out.startsWith('TypeError: ')).toBe(true);
    expect(out).toContain('unsupported operand');
  });

  it('passes through ValueError with a normalized prefix', () => {
    const tb = "ValueError: invalid literal for int() with base 10: 'foo'";
    const out = childFriendlyPyError(tb);
    expect(out.startsWith('ValueError: ')).toBe(true);
    expect(out).toContain("invalid literal");
  });

  it('truncates extremely long unrecognized errors with an ellipsis', () => {
    const tb = 'CustomError: ' + 'x'.repeat(500);
    const out = childFriendlyPyError(tb);
    expect(out.length).toBeLessThanOrEqual(98);
    expect(out.endsWith('…')).toBe(true);
  });

  it('returns the last non-empty traceback line for unknown errors', () => {
    const tb = `Traceback (most recent call last):
  File "<exec>", line 1, in <module>
RuntimeError: something specific went wrong`;
    expect(childFriendlyPyError(tb)).toBe('RuntimeError: something specific went wrong');
  });

  it('returns empty string for empty traceback (no error to render)', () => {
    expect(childFriendlyPyError('')).toBe('');
  });
});

describe('evaluatePython — empty-input contract', () => {
  it('rejects empty code without spinning up the Worker', async () => {
    const r = await evaluatePython('');
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.error).toBe('No Python code to run yet.');
    }
  });

  it('rejects whitespace-only code', async () => {
    const r = await evaluatePython('   \n\t  ');
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.error).toBe('No Python code to run yet.');
    }
  });
});

describe('debugPython — empty-input contract', () => {
  it('rejects empty code with the trace-specific message', async () => {
    const r = await debugPython('');
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.error).toBe('No Python code to debug yet.');
      expect(r.steps).toEqual([]);
      expect(r.stdout).toBe('');
    }
  });

  it('rejects whitespace-only code', async () => {
    const r = await debugPython('   \n');
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.steps).toEqual([]);
    }
  });
});
