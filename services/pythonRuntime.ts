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

/** Single trace event captured during a debug run. */
export interface TraceStep {
  /** 1-based line number in the user's source. */
  line: number;
  /** Trace event kind — 'line' is the common one (about to execute). */
  event: 'call' | 'line' | 'return' | 'exception';
  /** Local variables snapshotted at this step. Values are repr-strings. */
  locals: Record<string, string>;
}

export interface TraceSuccess {
  ok: true;
  steps: TraceStep[];
  stdout: string;
  /** Last expression value (Python repr). */
  value: string;
}

export interface TraceFailure {
  ok: false;
  error: string;
  steps: TraceStep[];
  stdout: string;
}

export type TraceResult = TraceSuccess | TraceFailure;

/** Run user code under sys.settrace and capture per-line locals.
 *
 * The trace runs on the main thread (Pyodide doesn't yet have a
 * worker mode wired here), so a long-running loop will freeze the
 * UI. The MVP scope is school-coding tasks (≤ ~50 lines) — fine for
 * step-debug. Bigger programs will need a worker.
 *
 * Locals are captured by reading the current frame's f_locals AFTER
 * each step's bytecode runs (Python's settrace fires BEFORE for
 * 'line', so the previous line's effect is visible at the NEXT step).
 * To keep UI rendering simple, every value is repr()'d to a string
 * and capped at 80 chars.
 */
export async function debugPython(userCode: string): Promise<TraceResult> {
  if (!userCode.trim()) {
    return { ok: false, error: 'No Python code to debug yet.', steps: [], stdout: '' };
  }
  let py: PyInterp;
  try {
    py = await loadInterp();
  } catch (e) {
    const raw = e instanceof Error ? e.message : String(e);
    return { ok: false, error: 'Could not load the Python runtime — check your internet connection.', steps: [], stdout: raw };
  }

  let stdoutBuf = '';
  py.setStdout({ batched: (s: string) => { stdoutBuf += s; } });
  py.setStderr({ batched: () => {} });

  // The runner installs settrace, exec()s the user code in a fresh
  // namespace (so prior cells don't leak in), and serializes the
  // captured steps as JSON. We pull the JSON back via Pyodide's
  // proxy → JS bridge.
  const wrapper = `
import json, sys, traceback as _tb
__user_src = ${JSON.stringify(userCode)}
__steps = []
__user_filename = '<aac-user>'
__user_globals = {'__name__': '__main__', '__builtins__': __builtins__}

def __aac_trace(frame, event, arg):
    if frame.f_code.co_filename != __user_filename:
        return __aac_trace
    if event == 'line':
        try:
            snap = {}
            for k, v in frame.f_locals.items():
                if k.startswith('__'):
                    continue
                try:
                    rs = repr(v)
                except Exception:
                    rs = '<unrepr>'
                if len(rs) > 80:
                    rs = rs[:77] + '...'
                snap[k] = rs
            __steps.append({'line': frame.f_lineno, 'event': 'line', 'locals': snap})
        except Exception:
            pass
    return __aac_trace

__compiled = compile(__user_src, __user_filename, 'exec')
__last_value = None
__error = None
sys.settrace(__aac_trace)
try:
    exec(__compiled, __user_globals)
    if __steps:
        __last_value = ''
except Exception:
    __error = _tb.format_exc()
finally:
    sys.settrace(None)
__result = {'steps': __steps, 'value': '' if __last_value is None else repr(__last_value), 'error': __error}
__result_json = json.dumps(__result)
__result_json
`;

  try {
    const raw = py.runPython(wrapper);
    const jsonStr = typeof raw === 'string'
      ? raw
      : (raw as { toString: () => string }).toString();
    const parsed = JSON.parse(jsonStr) as { steps: TraceStep[]; value: string; error: string | null };
    if (parsed.error) {
      return {
        ok: false,
        error: childFriendlyPyError(parsed.error),
        steps: parsed.steps,
        stdout: stdoutBuf,
      };
    }
    return {
      ok: true,
      steps: parsed.steps,
      stdout: stdoutBuf,
      value: parsed.value,
    };
  } catch (e) {
    const raw = e instanceof Error ? e.message : String(e);
    return { ok: false, error: childFriendlyPyError(raw), steps: [], stdout: stdoutBuf };
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
