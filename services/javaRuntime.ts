'use client';
/**
 * javaRuntime — remote Java execution via the Piston public API.
 *
 * Piston (https://emkc.org/api/v2/piston) is a free public sandboxed
 * code runner. No API key, IP-rate-limited (~5 req/sec), supports a
 * dozen languages including Java 15+. We use it because there's no
 * good in-browser JVM that fits the AAC bundle budget.
 *
 * The endpoint is HTTPS-only and returns stdout / stderr / exit code.
 * Compilation errors come back in `compile.stderr`; runtime errors in
 * `run.stderr`. The wrapper below normalises both into a single
 * child-friendly error.
 *
 * If the AAC user typed partial Java (no class scaffolding), wrap their
 * snippet in a default Main class so school-style "print 1+1" works
 * without forcing them to type 5 lines of boilerplate.
 */

const PISTON_ENDPOINT = 'https://emkc.org/api/v2/piston/execute';
const PISTON_TIMEOUT_MS = 10_000;

export interface JavaEvalSuccess {
  ok: true;
  stdout: string;
  stderr: string;
  /** True if we wrapped the user's snippet in a generated Main class. */
  wrapped: boolean;
}

export interface JavaEvalFailure {
  ok: false;
  /** Short, child-readable summary. */
  error: string;
  /** Full compile / runtime stderr (debug). */
  detail?: string;
  /** stdout captured before the error, if any. */
  stdout?: string;
}

export type JavaEvalResult = JavaEvalSuccess | JavaEvalFailure;

const CLASS_DECL = /\bclass\s+\w+/;
const MAIN_METHOD = /\bpublic\s+static\s+void\s+main\s*\(/;

/** Wrap a bare snippet in a Main class so school-style one-liners run.
 *  If the user already declared a class (with or without main) we
 *  trust them and leave the source untouched. */
export function wrapJavaSnippet(source: string): { code: string; wrapped: boolean } {
  if (CLASS_DECL.test(source)) {
    return { code: source, wrapped: false };
  }
  const indented = source.split('\n').map((l) => '        ' + l).join('\n');
  return {
    code: `public class Main {\n    public static void main(String[] args) {\n${indented}\n    }\n}`,
    wrapped: true,
  };
}

interface PistonResponse {
  run?: { stdout?: string; stderr?: string; code?: number; output?: string };
  compile?: { stderr?: string; code?: number };
  message?: string;
}

export async function evaluateJava(userCode: string): Promise<JavaEvalResult> {
  if (!userCode.trim()) {
    return { ok: false, error: 'No Java code to run yet.' };
  }
  const { code, wrapped } = wrapJavaSnippet(userCode);

  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), PISTON_TIMEOUT_MS);

  let resp: Response;
  try {
    resp = await fetch(PISTON_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        language: 'java',
        version: '*',
        files: [{ name: 'Main.java', content: code }],
      }),
      signal: ctrl.signal,
    });
  } catch (e) {
    clearTimeout(timer);
    const raw = e instanceof Error ? e.message : String(e);
    if (/abort/i.test(raw)) {
      return { ok: false, error: 'Java execution took too long (10 s timeout).' };
    }
    return { ok: false, error: "Couldn't reach the Java runtime — check your internet.", detail: raw };
  }
  clearTimeout(timer);

  if (!resp.ok) {
    return { ok: false, error: `Java service returned HTTP ${resp.status}.`, detail: await resp.text() };
  }

  let body: PistonResponse;
  try {
    body = await resp.json() as PistonResponse;
  } catch (e) {
    return { ok: false, error: 'Java service returned malformed response.', detail: e instanceof Error ? e.message : String(e) };
  }

  // Compile error first.
  const compileErr = (body.compile?.stderr || '').trim();
  if (compileErr) {
    return { ok: false, error: childFriendlyJavaError(compileErr), detail: compileErr };
  }
  const runStderr = (body.run?.stderr || '').trim();
  const runStdout = (body.run?.stdout || '').replace(/\n+$/, '');
  if (runStderr) {
    return { ok: false, error: childFriendlyJavaError(runStderr), detail: runStderr, stdout: runStdout };
  }
  return { ok: true, stdout: runStdout, stderr: '', wrapped };
}

function childFriendlyJavaError(detail: string): string {
  // Most javac errors look like:
  //   Main.java:3: error: ';' expected
  //   Main.java:5: error: cannot find symbol
  //     symbol:   variable foo
  // Pick the first ` error:` line and drop the file/line prefix.
  const errLine = detail.split('\n').map((l) => l.trim()).find((l) => l.includes('error:'));
  if (errLine) {
    const stripped = errLine.replace(/^Main\.java:\d+:\s*error:\s*/i, '');
    if (stripped.toLowerCase().includes("';' expected")) return "There is a missing semicolon ';'.";
    if (stripped.toLowerCase().includes('cannot find symbol')) return "Java doesn't recognize one of the names — check the spelling.";
    if (stripped.toLowerCase().includes('reached end of file')) return 'A bracket or brace is unmatched.';
    return stripped.length > 100 ? stripped.slice(0, 97) + '…' : stripped;
  }
  // Runtime exception — pick the first Exception line.
  const exLine = detail.split('\n').map((l) => l.trim()).find((l) => /Exception/.test(l));
  if (exLine) return exLine.length > 120 ? exLine.slice(0, 117) + '…' : exLine;
  return detail.length > 120 ? detail.slice(0, 117) + '…' : detail;
}
