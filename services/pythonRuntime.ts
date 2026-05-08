'use client';
/**
 * pythonRuntime — lazy-loaded Pyodide for in-browser Python execution.
 *
 * Pyodide is the CPython interpreter compiled to WASM. The npm package
 * is a thin loader (~50 KB); the actual ~10 MB runtime + stdlib payload
 * is fetched from the jsdelivr CDN on first use. We:
 *
 *   • dynamic-import pyodide so it isn't pulled into the main bundle
 *   • cache the loaded interpreter in a module-level singleton
 *   • dedupe concurrent first-load attempts via a shared init promise
 *   • redirect sys.stdout / sys.stderr to in-memory buffers per call
 *   • return both the captured stdout and the last-expression value
 *
 * The Math tutor uses this when the user is in the programming-python
 * chip and taps the 🧮 Eval button. First call shows "Loading Python…"
 * for ~5-15 s (network-bound); subsequent calls are instant.
 *
 * SAFETY: Pyodide runs in the main thread (no worker yet). Long-running
 * Python loops will freeze the UI. We don't bound execution time here —
 * the AAC user's school-coding tasks are small, and adding a watchdog
 * worker is a follow-up. If a kid pastes `while True: pass` they'll
 * have to refresh; the cost of guarding every path is not worth it for
 * the MVP.
 */

// Pyodide's TypeScript types use a global namespace. We don't import
// the type at module top because that would force the bundler to pull
// pyodide eagerly. Use `unknown` and narrow at call sites.
type PyInterp = {
  runPython: (code: string) => unknown;
  globals: {
    set: (k: string, v: unknown) => void;
    get: (k: string) => unknown;
  };
  setStdout: (opts: { batched?: (s: string) => void }) => void;
  setStderr: (opts: { batched?: (s: string) => void }) => void;
};

export interface PyEvalSuccess {
  ok: true;
  /** Captured stdout (may be empty). */
  stdout: string;
  /** Captured stderr (may be empty). */
  stderr: string;
  /** Last-expression value rendered as Python repr; '' if none. */
  value: string;
}

export interface PyEvalFailure {
  ok: false;
  /** Short, child-readable summary. */
  error: string;
  /** Full Python traceback (debug). */
  traceback?: string;
  /** stdout captured before the error (so a `print` before the crash is visible). */
  stdout?: string;
}

export type PyEvalResult = PyEvalSuccess | PyEvalFailure;

const PYODIDE_INDEX_URL = 'https://cdn.jsdelivr.net/pyodide/v0.29.4/full/';

let interp: PyInterp | null = null;
let initPromise: Promise<PyInterp> | null = null;

export function isPythonReady(): boolean {
  return interp !== null;
}

async function loadInterp(): Promise<PyInterp> {
  if (interp) return interp;
  if (initPromise) return initPromise;
  initPromise = (async () => {
    // Dynamic import keeps pyodide out of the main bundle. Next.js
    // emits it as a separate chunk, fetched on first use only.
    const mod = await import('pyodide');
    const py = (await mod.loadPyodide({ indexURL: PYODIDE_INDEX_URL })) as unknown as PyInterp;
    interp = py;
    return py;
  })();
  try {
    return await initPromise;
  } catch (e) {
    initPromise = null;
    throw e;
  }
}

/** Pre-warm Pyodide. Safe to call from a low-priority effect; rejects
 *  silently if the network is unavailable. The first eval call will
 *  retry the load if this prewarm failed. */
export async function prewarmPython(): Promise<void> {
  try { await loadInterp(); } catch { /* prewarm is best-effort */ }
}

export async function evaluatePython(code: string): Promise<PyEvalResult> {
  if (!code.trim()) {
    return { ok: false, error: 'No Python code to run yet.' };
  }
  let py: PyInterp;
  try {
    py = await loadInterp();
  } catch (e) {
    const raw = e instanceof Error ? e.message : String(e);
    return {
      ok: false,
      error: 'Could not load the Python runtime — check your internet connection.',
      traceback: raw,
    };
  }

  let stdoutBuf = '';
  let stderrBuf = '';
  py.setStdout({ batched: (s: string) => { stdoutBuf += s; } });
  py.setStderr({ batched: (s: string) => { stderrBuf += s; } });

  try {
    const value = py.runPython(code);
    let printable = '';
    if (value !== undefined && value !== null) {
      // PyProxy values have .toString() that calls Python repr.
      printable = typeof value === 'object' && value !== null && 'toString' in value
        ? (value as { toString: () => string }).toString()
        : String(value);
    }
    return {
      ok: true,
      stdout: stdoutBuf,
      stderr: stderrBuf,
      value: printable,
    };
  } catch (e) {
    const raw = e instanceof Error ? e.message : String(e);
    return {
      ok: false,
      error: childFriendlyPyError(raw),
      traceback: raw,
      stdout: stdoutBuf,
    };
  }
}

function childFriendlyPyError(traceback: string): string {
  // Pyodide bubbles the full Python traceback — pick the last line, which
  // is the actual exception type + message.
  const lines = traceback.split('\n').map((l) => l.trim()).filter(Boolean);
  const last = lines[lines.length - 1] ?? traceback;
  if (/SyntaxError/i.test(last)) return 'There is a typo in the code (SyntaxError).';
  if (/NameError/i.test(last)) {
    const m = last.match(/name '([^']+)' is not defined/);
    return m ? `"${m[1]}" hasn't been defined yet.` : "A name in the code isn't defined yet.";
  }
  if (/IndentationError/i.test(last)) return 'The indentation looks off (IndentationError).';
  if (/ZeroDivisionError/i.test(last)) return "Can't divide by zero.";
  if (/TypeError/i.test(last)) return last.replace(/^TypeError:\s*/, 'TypeError: ');
  if (/ValueError/i.test(last)) return last.replace(/^ValueError:\s*/, 'ValueError: ');
  return last.length > 100 ? last.slice(0, 97) + '…' : last;
}
