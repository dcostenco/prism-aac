'use client';
/**
 * pythonRuntime — Pyodide running inside a dedicated Web Worker so a
 * runaway loop in user code can't freeze the main UI thread.
 *
 * Architecture:
 *   • The actual CPython-WASM lives in services/python-worker.ts.
 *   • This module is the main-thread wrapper: it spawns the worker
 *     lazily on first use, multiplexes messages by request id, and
 *     enforces a hard timeout per call. On timeout it terminates the
 *     worker (killing any infinite loop) and respawns a fresh one;
 *     the next eval will pay the ~5-15 s init cost again.
 *
 * The Math tutor uses this when the user is in the programming-python
 * chip and taps 🧮 Eval or 🐛 Debug. First call shows
 * "Loading Python…" while the worker boots Pyodide; subsequent calls
 * are instant unless a timeout forced a respawn.
 */

const TIMEOUT_MS = 10_000;

export interface PyEvalSuccess {
  ok: true;
  stdout: string;
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

export interface TraceStep {
  line: number;
  event: 'call' | 'line' | 'return' | 'exception';
  locals: Record<string, string>;
}

export interface TraceSuccess {
  ok: true;
  steps: TraceStep[];
  stdout: string;
  value: string;
}

export interface TraceFailure {
  ok: false;
  error: string;
  steps: TraceStep[];
  stdout: string;
}

export type TraceResult = TraceSuccess | TraceFailure;

let worker: Worker | null = null;
let workerReady = false;
let nextId = 0;

function hasWorker(): boolean {
  return typeof Worker !== 'undefined';
}

function spawnWorker(): Worker | null {
  if (!hasWorker()) return null;
  const w = new Worker(new URL('./python-worker.ts', import.meta.url), { type: 'module' });
  workerReady = false;
  return w;
}

function getWorker(): Worker | null {
  if (worker) return worker;
  worker = spawnWorker();
  return worker;
}

function killWorker() {
  if (worker) {
    try { worker.terminate(); } catch { /* already gone */ }
  }
  worker = null;
  workerReady = false;
}

export function isPythonReady(): boolean {
  return workerReady;
}

/** Best-effort warm-up. Spawns the worker so the first user-facing
 *  call doesn't pay the ~5-15 s Pyodide init. Errors are swallowed —
 *  the worker re-tries on the first real request. */
export async function prewarmPython(): Promise<void> {
  const w = getWorker();
  if (!w) return;
  // Send a no-op eval to force Pyodide to load. We don't await its
  // response; the worker init promise resolves before it processes.
  try {
    await runOnWorker({ kind: 'eval', code: 'None' });
  } catch { /* prewarm is best-effort */ }
}

interface OutgoingEval { kind: 'eval'; code: string; }
interface OutgoingDebug { kind: 'debug'; code: string; }
type Outgoing = OutgoingEval | OutgoingDebug;

interface WorkerResponse {
  id: number;
  ok: boolean;
  kind?: 'eval' | 'debug';
  stdout?: string;
  stderr?: string;
  value?: string;
  steps?: TraceStep[];
  traceback?: string;
  error?: string;
  detail?: string;
}

function runOnWorker(msg: Outgoing): Promise<WorkerResponse> {
  const w = getWorker();
  if (!w) {
    return Promise.resolve({
      id: -1, ok: false,
      error: 'Python runtime not available in this environment (Web Workers required).',
    });
  }
  const id = ++nextId;
  return new Promise<WorkerResponse>((resolve) => {
    const timer = setTimeout(() => {
      w.removeEventListener('message', onMsg);
      // Termination is the ONLY way to interrupt a runaway Python
      // loop — settrace can't help once the loop holds the GIL.
      killWorker();
      resolve({
        id, ok: false,
        error: 'Python execution took too long (10 s timeout). The worker was terminated; the next run will start a fresh interpreter.',
      });
    }, TIMEOUT_MS);
    const onMsg = (ev: MessageEvent<WorkerResponse>) => {
      if (ev.data.id !== id) return;
      clearTimeout(timer);
      w.removeEventListener('message', onMsg);
      workerReady = true;
      resolve(ev.data);
    };
    w.addEventListener('message', onMsg);
    w.postMessage({ id, ...msg });
  });
}

export async function evaluatePython(code: string): Promise<PyEvalResult> {
  if (!code.trim()) {
    return { ok: false, error: 'No Python code to run yet.' };
  }
  const r = await runOnWorker({ kind: 'eval', code });
  if (r.ok) {
    return {
      ok: true,
      stdout: r.stdout ?? '',
      stderr: r.stderr ?? '',
      value: r.value ?? '',
    };
  }
  return {
    ok: false,
    error: r.error ?? childFriendlyPyError(r.traceback ?? ''),
    traceback: r.traceback,
    stdout: r.stdout,
  };
}

export async function debugPython(code: string): Promise<TraceResult> {
  if (!code.trim()) {
    return { ok: false, error: 'No Python code to debug yet.', steps: [], stdout: '' };
  }
  const r = await runOnWorker({ kind: 'debug', code });
  if (r.ok) {
    return {
      ok: true,
      steps: r.steps ?? [],
      stdout: r.stdout ?? '',
      value: r.value ?? '',
    };
  }
  return {
    ok: false,
    error: r.error ?? childFriendlyPyError(r.traceback ?? ''),
    steps: r.steps ?? [],
    stdout: r.stdout ?? '',
  };
}

function childFriendlyPyError(traceback: string): string {
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
