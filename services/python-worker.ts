/// <reference lib="webworker" />
/**
 * python-worker — Pyodide running inside a dedicated Web Worker so a
 * runaway loop in user code can't freeze the main UI thread.
 *
 * Protocol (postMessage):
 *   IN:  { id, kind: 'eval'  | 'debug', code: string }
 *   OUT: { id, ok, ...result }   (result shape matches the in-process
 *                                  PyEvalResult / TraceResult types)
 *
 * The wrapper in pythonRuntime.ts owns the timeout policy. If user
 * code doesn't return inside the limit, the wrapper calls
 * worker.terminate() and respawns a fresh worker — Pyodide will
 * re-init on next request (~5-15 s the first time, then cached).
 */

const ctx: DedicatedWorkerGlobalScope = self as unknown as DedicatedWorkerGlobalScope;

type PyInterp = {
  runPython: (code: string) => unknown;
  setStdout: (opts: { batched?: (s: string) => void }) => void;
  setStderr: (opts: { batched?: (s: string) => void }) => void;
};

let interp: PyInterp | null = null;
let initPromise: Promise<PyInterp> | null = null;

const PYODIDE_INDEX_URL = 'https://cdn.jsdelivr.net/pyodide/v0.29.4/full/';

async function loadInterp(): Promise<PyInterp> {
  if (interp) return interp;
  if (initPromise) return initPromise;
  initPromise = (async () => {
    const mod = await import('pyodide');
    const py = (await mod.loadPyodide({ indexURL: PYODIDE_INDEX_URL })) as unknown as PyInterp;
    interp = py;
    return py;
  })();
  return initPromise;
}

interface MsgEval {
  id: number;
  kind: 'eval';
  code: string;
}

interface MsgDebug {
  id: number;
  kind: 'debug';
  code: string;
}

type IncomingMsg = MsgEval | MsgDebug;

ctx.onmessage = async (ev: MessageEvent<IncomingMsg>) => {
  const { id, kind, code } = ev.data;
  let py: PyInterp;
  try {
    py = await loadInterp();
  } catch (e) {
    ctx.postMessage({
      id, ok: false,
      error: 'Could not load the Python runtime — check your internet connection.',
      detail: e instanceof Error ? e.message : String(e),
    });
    return;
  }

  let stdoutBuf = '';
  let stderrBuf = '';
  py.setStdout({ batched: (s: string) => { stdoutBuf += s; } });
  py.setStderr({ batched: (s: string) => { stderrBuf += s; } });

  if (kind === 'eval') {
    try {
      const value = py.runPython(code);
      const printable = value === undefined || value === null
        ? ''
        : (typeof value === 'object' && 'toString' in value
            ? (value as { toString: () => string }).toString()
            : String(value));
      ctx.postMessage({
        id, ok: true, kind: 'eval',
        stdout: stdoutBuf, stderr: stderrBuf, value: printable,
      });
    } catch (e) {
      ctx.postMessage({
        id, ok: false, kind: 'eval',
        traceback: e instanceof Error ? e.message : String(e),
        stdout: stdoutBuf,
      });
    }
    return;
  }

  if (kind === 'debug') {
    const wrapper = `
import json, sys, traceback as _tb
__user_src = ${JSON.stringify(code)}
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
      const parsed = JSON.parse(jsonStr) as {
        steps: Array<{ line: number; event: string; locals: Record<string, string> }>;
        value: string;
        error: string | null;
      };
      ctx.postMessage({
        id, ok: parsed.error === null, kind: 'debug',
        steps: parsed.steps,
        stdout: stdoutBuf,
        value: parsed.value,
        traceback: parsed.error ?? undefined,
      });
    } catch (e) {
      ctx.postMessage({
        id, ok: false, kind: 'debug',
        traceback: e instanceof Error ? e.message : String(e),
        stdout: stdoutBuf,
        steps: [],
      });
    }
    return;
  }

  ctx.postMessage({ id, ok: false, error: `Unknown message kind: ${(ev.data as { kind: string }).kind}` });
};
