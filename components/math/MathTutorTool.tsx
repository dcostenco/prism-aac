'use client';
/**
 * MathTutorTool — Phase 5C + 5D + 6 hardening.
 *
 * Hint / Check / Solve over the cell-grid expression. Streamed via
 * askAI; auto-collapses when the user types more cells.
 *
 * Phase 6 hardening (driven by user reports of "Thinking…" sticking
 * indefinitely on PROD):
 *   • Hard 15 s tutor-side timeout via Promise.race. The askAI service
 *     has its own 30+ s timeouts, but the local Ollama fallback chains
 *     them serially and a CORS-blocked Synalux POST on top of a
 *     mixed-content-blocked Ollama call could keep the overlay in
 *     "Thinking…" for ~40 s. 15 s is the user-patience floor.
 *   • Friendlier error messages — distinguish auth, network, and
 *     timeout so the child / caregiver knows what to do next.
 *   • Retry button — recovers without retyping the expression.
 *   • Always lands in a deterministic terminal state (response shown
 *     OR error shown). Never leaves loading=true after Promise.race.
 */
import { useState, useCallback, useEffect, useRef } from 'react';
import { useMathGridStore, domainForCategory, type MathDomain } from '@/store/mathGridStore';
import { useSettingsStore } from '@/store/settingsStore';
import { askAI, LANG_NAMES } from '@/services/aiService';
import { aacSpeak } from '@/services/aacSpeak';
import { tapFeedback } from '@/services/feedback';
import { evaluateExpression } from '@/services/exprEval';
import { evaluatePython, isPythonReady, debugPython, type TraceStep } from '@/services/pythonRuntime';
import { evaluateJava } from '@/services/javaRuntime';
import { serializeAsCode } from '@/services/codeSerialize';
import { parseCellKey, type Cell, type CellKey } from '@/engine/mathGrid';

type TutorMode = 'help' | 'check' | 'solve' | 'eval' | 'debug';

/** Domains where a deterministic evaluator produces a useful answer.
 *  math/physics/statistics → mathjs (instant, in-process).
 *  programming-python → Pyodide WASM (~5-15 s first load, then instant).
 *  programming-java → remote Piston API (HTTPS roundtrip, ~1-3 s).
 *  Chemistry / biology / music / etc. don't reduce to a runnable
 *  expression, so the 🧮 Eval button is hidden there and the user
 *  falls back on the AI-driven tutor. */
const EVAL_DOMAINS: ReadonlySet<MathDomain> = new Set<MathDomain>([
  'math',
  'physics',
  'statistics',
  'programming-python',
  'programming-java',
]);

/** Per-domain prompt templates. The expression placeholder `{expr}` is
 *  replaced at request time. We tell the model what subject the child
 *  is working on so it doesn't apply algebraic reasoning to a chemistry
 *  equation or mistake a Python `if` for a math conditional.
 *  `eval` and `debug` modes run locally (mathjs / Pyodide trace) and
 *  never touch a prompt — so they're excluded from the template type. */
type DomainPrompts = Record<Exclude<TutorMode, 'eval' | 'debug'>, string>;

const PROMPT_TEMPLATES: Record<MathDomain, DomainPrompts> = {
  math: {
    help:  'The child wrote this math expression: "{expr}". They need help understanding what to do next. Give a gentle hint — don\'t solve it, just guide them to the next step. Use simple words. Be encouraging. Max 2 sentences.',
    check: 'The child wrote this math expression: "{expr}". Check if this is correct. If there\'s an error, explain what went wrong gently and show how to fix it. If it\'s correct, celebrate! Use simple words. Max 2 sentences.',
    solve: 'The child wrote this math expression: "{expr}". Show the solution step by step. Use simple language a child can understand. Use math symbols. Be encouraging — say "Great job trying!" or similar. Max 4 short steps.',
  },
  chemistry: {
    help:  'The child wrote this chemistry expression: "{expr}". They are likely balancing an equation, naming a compound, or writing a reaction. Give one gentle hint about the next step (do not balance or solve). Use simple words. Max 2 sentences.',
    check: 'The child wrote this chemistry expression: "{expr}". Check it: is it balanced? Are the formulas correct? Are charges right? If something is wrong, explain gently in plain words and show how to fix it. If it is correct, celebrate. Max 2 sentences.',
    solve: 'The child wrote this chemistry expression: "{expr}". Walk through the full solution step by step (balance the equation, identify products, or compute the requested quantity). Keep each step short and use simple language a child can understand. Max 4 short steps.',
  },
  physics: {
    help:  'The child wrote this physics expression: "{expr}". They are likely working on motion, energy, forces, electricity, or waves. Give one hint that points them at the right formula or concept WITHOUT solving. Use simple words. Max 2 sentences.',
    check: 'The child wrote this physics expression: "{expr}". Check the equation: are units consistent? Are the variables used correctly? If wrong, explain gently and show the fix. If right, celebrate. Max 2 sentences.',
    solve: 'The child wrote this physics expression: "{expr}". Solve it step by step: identify the relevant law, plug in known values, and show units. Keep each step short. Max 4 short steps.',
  },
  'programming-python': {
    help:  'The child wrote this Python code: "{expr}". Help them with the next step they need (a missing colon, indentation, what comes after a `def`). Do not write the full solution. Max 2 sentences.',
    check: 'The child wrote this Python code: "{expr}". Check it: does it parse? Are indentation and colons right? Will it run? If something is wrong, explain gently in plain English. If it is right, celebrate. Max 2 sentences.',
    solve: 'The child wrote this Python code: "{expr}". Show the corrected, runnable version step by step. Use simple words to explain each step. Max 4 short steps. End with the working code.',
  },
  'programming-java': {
    help:  'The child wrote this Java code: "{expr}". Help with the next step they need (a missing semicolon, type, brace). Do not write the full solution. Max 2 sentences.',
    check: 'The child wrote this Java code: "{expr}". Check it: does it compile? Are types and semicolons correct? Will it run? If something is wrong, explain gently. If right, celebrate. Max 2 sentences.',
    solve: 'The child wrote this Java code: "{expr}". Show the corrected, compilable version step by step. Use simple words. Max 4 short steps. End with the working code.',
  },
  biology: {
    help:  'The child wrote this biology expression: "{expr}". They are likely working on DNA/RNA codons, taxonomy, genetics (Punnett square), cell organelles, or body systems. Give one hint pointing at the right concept WITHOUT solving. Max 2 sentences.',
    check: 'The child wrote this biology expression: "{expr}". Check it: are the codons valid? Is the taxonomy ordered correctly (Kingdom → Species)? Are dominant/recessive alleles labelled right? Explain gently if wrong, celebrate if right. Max 2 sentences.',
    solve: 'The child wrote this biology expression: "{expr}". Walk through the answer step by step (translate the codon, fill the Punnett square, name the organelle, etc.). Use simple language. Max 4 short steps.',
  },
  statistics: {
    help:  'The child wrote this statistics expression: "{expr}". They are likely working with mean / std dev / probability / a hypothesis test / a distribution. Give one hint about the next step or the right formula WITHOUT computing. Max 2 sentences.',
    check: 'The child wrote this statistics expression: "{expr}". Check it: are the symbols used correctly (μ vs x̄, σ vs s, population vs sample)? Are inequality bounds right? Explain gently if wrong, celebrate if right. Max 2 sentences.',
    solve: 'The child wrote this statistics expression: "{expr}". Solve it step by step: identify the statistic, plug in numbers, report the result with units. Max 4 short steps.',
  },
  music: {
    help:  'The child wrote this music notation: "{expr}". They are likely working on rhythm, key signatures, intervals, chords, or dynamics. Give one hint about what comes next WITHOUT writing the music. Max 2 sentences.',
    check: 'The child wrote this music notation: "{expr}". Check it: do the note durations add up to the time signature? Is the key signature consistent? Are dynamics in order (pp < p < mp < mf < f < ff)? Explain gently if wrong, celebrate if right. Max 2 sentences.',
    solve: 'The child wrote this music notation: "{expr}". Walk through it step by step (count beats, identify the chord, name the key). Use simple language. Max 4 short steps.',
  },
  'earth-science': {
    help:  'The child wrote this earth-science expression: "{expr}". They are likely working on weather, plate tectonics, the rock cycle, or astronomy (planets, AU, light-years). Give one hint about the next step WITHOUT solving. Max 2 sentences.',
    check: 'The child wrote this earth-science expression: "{expr}". Check it: are the planet symbols in order? Are weather symbols paired with the right phenomena? Are astronomical units (AU, ly, pc) used correctly? Explain gently if wrong, celebrate if right. Max 2 sentences.',
    solve: 'The child wrote this earth-science expression: "{expr}". Walk through the answer step by step. Use simple language. Max 4 short steps.',
  },
  history: {
    help:  'The child is studying history in the {lang} curriculum (region: {region}) and wrote: "{expr}". They are likely working on a date, era marker (BCE / CE), century, or period name from their region. Give one hint about how to read or order it WITHOUT solving, using examples relevant to their curriculum. Max 2 sentences.',
    check: 'The child is studying history in the {lang} curriculum (region: {region}) and wrote: "{expr}". Check it: is the era marker in the right place? Are dates ordered correctly on a timeline? Does the period name match the date? Explain gently if wrong, celebrate if right, using examples from their curriculum. Max 2 sentences.',
    solve: 'The child is studying history in the {lang} curriculum (region: {region}) and wrote: "{expr}". Walk through the answer step by step (compute the year, name the period, locate the event in THEIR region\'s history first, then add a world-history note). Use simple words. Max 4 short steps.',
  },
  'language-arts': {
    help:  'The child wrote this language-arts expression: "{expr}". They are likely tagging parts of speech, fixing punctuation, or marking sentence types. Give one hint about the next step WITHOUT solving. Max 2 sentences.',
    check: 'The child wrote this language-arts expression: "{expr}". Check it: are the parts-of-speech tags right (NOUN/VERB/ADJ/...)? Is the punctuation correct? Is the sentence type labeled right (declarative / interrogative / imperative / exclamatory)? Explain gently if wrong, celebrate if right. Max 2 sentences.',
    solve: 'The child wrote this language-arts expression: "{expr}". Tag every part of speech and explain why, step by step. Use simple words. Max 4 short steps.',
  },
};

const TUTOR_CONTEXT_BY_DOMAIN: Record<MathDomain, string> = {
  math: 'math-tutor',
  chemistry: 'chemistry-tutor',
  physics: 'physics-tutor',
  'programming-python': 'python-tutor',
  'programming-java': 'java-tutor',
  biology: 'biology-tutor',
  statistics: 'statistics-tutor',
  music: 'music-tutor',
  'earth-science': 'earth-science-tutor',
  history: 'history-tutor',
  'language-arts': 'language-arts-tutor',
};

const TUTOR_HARD_TIMEOUT_MS = 15_000;

function serializeAsExpression(cells: Map<CellKey, Cell>): string {
  if (cells.size === 0) return '';
  const byRow: Map<number, Array<{ c: number; glyph: string }>> = new Map();
  cells.forEach((cell, key) => {
    const { r, c } = parseCellKey(key);
    if (!byRow.has(r)) byRow.set(r, []);
    byRow.get(r)!.push({ c, glyph: cell.glyph });
  });
  const sortedRows = Array.from(byRow.keys()).sort((a, b) => a - b);
  return sortedRows
    .map((r) => byRow.get(r)!.sort((a, b) => a.c - b.c).map((x) => x.glyph).join(' '))
    .join(' | ');
}

/** Map the askAI error message into a child-friendly explanation. The
 *  service-layer messages are technical ("Session expired", "No AI
 *  available — check internet…"). We translate so the AAC user sees
 *  one of three categorical states with an actionable next step. */
function friendlyError(err: unknown): { kind: 'auth' | 'network' | 'timeout' | 'other'; msg: string } {
  const raw = err instanceof Error ? err.message : '';
  if (raw === '__tutor_timeout__') return { kind: 'timeout', msg: 'The AI tutor is taking too long. Tap retry to try again.' };
  if (/expired|sign in/i.test(raw)) return { kind: 'auth', msg: 'Sign in to Synalux at synalux.ai/auth to use the tutor.' };
  if (/no ai available|failed to fetch|network|offline/i.test(raw)) {
    return { kind: 'network', msg: "Couldn't reach the tutor. Check your internet, then tap retry." };
  }
  return { kind: 'other', msg: raw || 'Could not reach the math helper right now.' };
}

const TOOL_BTN =
  'aac-btn rounded-lg px-3 py-2 text-sm font-bold border border-transparent ' +
  'flex items-center justify-center min-h-[44px] disabled:opacity-40';

export default function MathTutorTool() {
  const cells = useMathGridStore((s) => s.cells);
  const activeCategory = useMathGridStore((s) => s.activeMathCategory);
  const { speechRate, speechVolume, language, outputLanguage } = useSettingsStore();
  const historyRegion = useSettingsStore((s) => s.historyRegion);
  // Tutor responds in the user's TTS/output language, NOT the UI
  // language. They're usually the same, but when the AAC pair is set
  // to {input: en, output: ro} the child wants Romanian guidance even
  // if the toolbar is in English.
  const tutorLang = outputLanguage || language || 'en';
  const [response, setResponse] = useState<string>('');
  const [errorKind, setErrorKind] = useState<'auth' | 'network' | 'timeout' | 'other' | null>(null);
  const [mode, setMode] = useState<TutorMode | null>(null);
  const [loading, setLoading] = useState(false);
  const [traceSteps, setTraceSteps] = useState<TraceStep[]>([]);
  const lastCellCount = useRef(cells.size);
  // Used to cancel an in-flight tutor request when the user taps a
  // different mode or dismisses. The actual askAI fetch can't be
  // aborted cleanly without threading a signal through every call
  // site, but we CAN ignore late chunks via this ref.
  const requestSeqRef = useRef(0);

  useEffect(() => {
    if (cells.size > lastCellCount.current && (response || errorKind)) {
      setResponse('');
      setErrorKind(null);
      setMode(null);
    }
    lastCellCount.current = cells.size;
  }, [cells.size, response, errorKind]);

  const ask = useCallback(async (which: Exclude<TutorMode, 'eval' | 'debug'>) => {
    const expression = serializeAsExpression(cells);
    if (!expression || loading) return;
    tapFeedback();
    setMode(which);
    setLoading(true);
    setResponse('');
    setErrorKind(null);
    const mySeq = ++requestSeqRef.current;

    const domain = domainForCategory(activeCategory);
    const template = PROMPT_TEMPLATES[domain][which];
    // {expr} is mandatory; {lang} + {region} are used by the history
    // domain to anchor the model in the student's regional curriculum
    // — so 1836 in `US-TX` resolves to the Alamo, not Arkansas
    // statehood; 1759 in `CA-QC` to the Plains of Abraham.
    const langName = LANG_NAMES[tutorLang] || 'English';
    const prompt = template
      .replace('{expr}', expression)
      .replace('{lang}', tutorLang)
      .replace('{region}', historyRegion || 'unspecified')
      // Append an explicit response-language directive at the END of
      // the user message. The system prompt already says "respond in
      // {langName}", but a heavily-English user prompt was strong
      // enough to override it (May 2026 user report: RO selected, hint
      // came back in English). Repeating the directive at the tail of
      // the user message — and including the also-localized "Say:"
      // suggestion line — makes the model commit to the target lang.
      + `\n\nRespond in ${langName}. Use natural ${langName} phrasing, not a translated-from-English feel.`;
    const tutorContext = TUTOR_CONTEXT_BY_DOMAIN[domain];

    let buffer = '';
    try {
      const askPromise = askAI(prompt, tutorContext, (delta) => {
        if (mySeq !== requestSeqRef.current) return; // user moved on
        buffer += delta;
        setResponse(buffer);
      }, tutorLang);
      // Hard tutor-side timeout. askAI's internal timeouts can chain to
      // ~40s in the worst case (Synalux 30s + Ollama 10s). 15s is what
      // an AAC user will tolerate before hitting back.
      const timeoutPromise = new Promise<never>((_, reject) => {
        setTimeout(() => reject(new Error('__tutor_timeout__')), TUTOR_HARD_TIMEOUT_MS);
      });
      await Promise.race([askPromise, timeoutPromise]);
      if (mySeq !== requestSeqRef.current) return;
      setResponse(buffer);
      if (buffer) aacSpeak(buffer, speechRate, speechVolume);
    } catch (e) {
      if (mySeq !== requestSeqRef.current) return;
      const f = friendlyError(e);
      setErrorKind(f.kind);
      setResponse(`⚠️ ${f.msg}`);
    } finally {
      if (mySeq === requestSeqRef.current) setLoading(false);
    }
  }, [cells, loading, tutorLang, speechRate, speechVolume, activeCategory, historyRegion]);

  const dismiss = useCallback(() => {
    tapFeedback();
    requestSeqRef.current++; // invalidate any in-flight request
    setResponse('');
    setErrorKind(null);
    setMode(null);
    setLoading(false);
  }, []);

  // Local evaluator path — bypasses askAI entirely for math /
  // physics / statistics (mathjs, instant) and programming-python
  // (Pyodide WASM, ~5-15 s first load, then instant). Speaks the
  // result via aacSpeak so the AAC user gets the same multimodal
  // feedback as the AI tutor responses.
  const localEval = useCallback(async () => {
    const evalDomain = domainForCategory(activeCategory);
    tapFeedback();
    requestSeqRef.current++; // cancel any in-flight AI request
    setMode('eval');
    setErrorKind(null);
    if (evalDomain === 'programming-python') {
      const source = serializeAsCode(cells);
      if (!source) {
        setResponse('No Python code to run yet.');
        return;
      }
      const showLoading = !isPythonReady();
      if (showLoading) {
        setLoading(true);
        setResponse('Loading Python runtime…');
      }
      const mySeq = requestSeqRef.current;
      const result = await evaluatePython(source);
      if (mySeq !== requestSeqRef.current) return;
      setLoading(false);
      if (result.ok) {
        const out = [
          result.stdout && result.stdout.trimEnd(),
          result.value,
        ].filter(Boolean).join('\n').trim() || '(no output)';
        setResponse(out);
        aacSpeak(out.slice(0, 200), speechRate, speechVolume);
      } else {
        setErrorKind('other');
        setResponse(`⚠️ ${result.error}`);
      }
      return;
    }
    if (evalDomain === 'programming-java') {
      const source = serializeAsCode(cells);
      if (!source) {
        setResponse('No Java code to run yet.');
        return;
      }
      setLoading(true);
      setResponse('Compiling and running Java…');
      const mySeq = requestSeqRef.current;
      const result = await evaluateJava(source);
      if (mySeq !== requestSeqRef.current) return;
      setLoading(false);
      if (result.ok) {
        const out = result.stdout.trim() || '(no output)';
        setResponse(out + (result.wrapped ? '\n\n(wrapped in default Main class)' : ''));
        aacSpeak(out.slice(0, 200), speechRate, speechVolume);
      } else {
        setErrorKind('other');
        setResponse(`⚠️ ${result.error}`);
      }
      return;
    }
    // Math / physics / statistics path — synchronous mathjs.
    const expression = serializeAsExpression(cells);
    if (!expression) return;
    setLoading(false);
    const result = evaluateExpression(expression);
    if (result.ok) {
      setResponse(`= ${result.value}`);
      aacSpeak(`equals ${result.value}`, speechRate, speechVolume);
    } else {
      setErrorKind('other');
      setResponse(`⚠️ ${result.error}`);
    }
  }, [cells, speechRate, speechVolume, activeCategory]);

  // Step-debugger path — Python only. Runs the user code under
  // sys.settrace and captures per-line locals. UI shows a scrollable
  // list of (line, locals) so the AAC user can read what each line did.
  const localDebug = useCallback(async () => {
    if (domainForCategory(activeCategory) !== 'programming-python') return;
    const source = serializeAsCode(cells);
    if (!source) return;
    tapFeedback();
    requestSeqRef.current++;
    setMode('debug');
    setErrorKind(null);
    setTraceSteps([]);
    const showLoading = !isPythonReady();
    if (showLoading) {
      setLoading(true);
      setResponse('Loading Python runtime…');
    } else {
      setResponse('Tracing…');
      setLoading(true);
    }
    const mySeq = requestSeqRef.current;
    const result = await debugPython(source);
    if (mySeq !== requestSeqRef.current) return;
    setLoading(false);
    setTraceSteps(result.steps);
    if (result.ok) {
      const summary = result.steps.length === 0
        ? '(code ran without entering any line — empty body?)'
        : `Traced ${result.steps.length} step${result.steps.length === 1 ? '' : 's'}.`;
      const stdoutLine = result.stdout ? `\nstdout: ${result.stdout.trimEnd()}` : '';
      setResponse(summary + stdoutLine);
    } else {
      setErrorKind('other');
      setResponse(`⚠️ ${result.error}`);
    }
  }, [activeCategory, cells]);

  const retry = useCallback(() => {
    if (!mode) return;
    if (mode === 'eval') { void localEval(); return; }
    if (mode === 'debug') { void localDebug(); return; }
    void ask(mode);
  }, [ask, mode, localEval, localDebug]);

  const domain = domainForCategory(activeCategory);
  const evalAvailable = EVAL_DOMAINS.has(domain);
  const debugAvailable = domain === 'programming-python';

  return (
    <div data-testid="math-tutor-tool" className="relative">
      <div className="flex items-center gap-1.5">
        <button
          onClick={() => ask('help')}
          disabled={loading}
          data-testid="math-tutor-hint"
          aria-label="Get a hint"
          className={`${TOOL_BTN} bg-[#2196F3] text-white`}
        >
          💡 Hint
        </button>
        <button
          onClick={() => ask('check')}
          disabled={loading}
          data-testid="math-tutor-check"
          aria-label="Check answer"
          className={`${TOOL_BTN} bg-[#FF9800] text-white`}
        >
          ✓ Check
        </button>
        <button
          onClick={() => ask('solve')}
          disabled={loading}
          data-testid="math-tutor-solve"
          aria-label="Solve step-by-step"
          className={`${TOOL_BTN} bg-[#9C27B0] text-white`}
        >
          🎓 Solve
        </button>
        {evalAvailable && (
          <button
            onClick={localEval}
            disabled={loading}
            data-testid="math-tutor-eval"
            aria-label="Evaluate expression locally"
            className={`${TOOL_BTN} bg-[#4CAF50] text-white`}
          >
            🧮 Eval
          </button>
        )}
        {debugAvailable && (
          <button
            onClick={localDebug}
            disabled={loading}
            data-testid="math-tutor-debug"
            aria-label="Step-debug Python (sys.settrace)"
            className={`${TOOL_BTN} bg-[#E91E63] text-white`}
          >
            🐛 Debug
          </button>
        )}
      </div>

      {(loading || response) && (
        <div
          className="absolute right-0 top-full mt-2 w-[28rem] max-w-[80vw] surface-bar border border-theme rounded-xl shadow-xl z-40 p-3"
          data-testid="math-tutor-response"
          data-mode={mode ?? ''}
          data-domain={domainForCategory(activeCategory)}
          data-error-kind={errorKind ?? ''}
          data-loading={loading ? '1' : '0'}
          role="status"
          aria-live="polite"
        >
          <div className="flex items-start gap-2">
            <span className="text-2xl shrink-0">{mode === 'debug' ? '🐛' : mode === 'eval' ? '🧮' : '🤖'}</span>
            <div className="flex-1 text-primary text-sm leading-relaxed">
              {loading && !response ? (
                <span className="text-muted animate-pulse">Thinking…</span>
              ) : (
                response.split('\n').map((ln, i) => (
                  <p key={i} className={i > 0 ? 'mt-2' : ''}>{ln}</p>
                ))
              )}
            </div>
          </div>
          {mode === 'debug' && traceSteps.length > 0 && !loading && (
            <div
              className="mt-2 max-h-[40vh] overflow-y-auto border border-theme rounded-md bg-black/[0.04] dark:bg-white/[0.04] text-xs font-mono"
              data-testid="math-tutor-debug-trace"
            >
              {traceSteps.map((step, i) => (
                <div
                  key={i}
                  className="px-2 py-1 border-b border-theme/50 last:border-b-0"
                  data-testid={`math-tutor-debug-step-${i}`}
                  data-line={step.line}
                >
                  <div className="flex gap-2 items-baseline">
                    <span className="text-muted shrink-0">L{step.line}</span>
                    <span className="text-muted">→</span>
                    <span className="flex-1 break-all">
                      {Object.keys(step.locals).length === 0
                        ? <em className="text-muted">no locals yet</em>
                        : Object.entries(step.locals).map(([k, v], j) => (
                          <span key={k} className="mr-3">
                            <span className="text-[#0550ae]">{k}</span>=<span className="text-[#22863a]">{v}</span>
                            {j < Object.keys(step.locals).length - 1 ? ',' : ''}
                          </span>
                        ))
                      }
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
          {errorKind && !loading && (
            <div className="mt-2 flex items-center justify-end gap-2">
              <button
                onClick={retry}
                data-testid="math-tutor-retry"
                aria-label="Retry"
                className="aac-btn rounded-md px-3 py-1.5 text-xs font-bold bg-[#4CAF50] text-white"
              >
                ↻ Retry
              </button>
            </div>
          )}
          {/* Parse **Say:** suggestions into tappable AAC buttons */}
          {(() => {
            const sayMatch = response.match(/\*\*Say:\*\*\s*(.+)/);
            if (!sayMatch) return null;
            const options = sayMatch[1].split('|').map(s => s.trim().replace(/^[""]|[""]$/g, ''));
            return (
              <div className="mt-2 flex flex-wrap gap-2">
                {options.filter(Boolean).map((opt, i) => (
                  <button
                    key={i}
                    onClick={async () => {
                      tapFeedback();
                      aacSpeak(opt, speechRate, speechVolume);
                      // Send as follow-up to the AI tutor
                      setLoading(true);
                      setResponse('');
                      const mySeq = ++requestSeqRef.current;
                      const domain = domainForCategory(activeCategory);
                      const tutorContext = TUTOR_CONTEXT_BY_DOMAIN[domain];
                      let buf = '';
                      try {
                        await askAI(opt, tutorContext, (delta) => {
                          if (mySeq !== requestSeqRef.current) return;
                          buf += delta;
                          setResponse(buf);
                        }, tutorLang);
                        if (mySeq === requestSeqRef.current && buf) aacSpeak(buf, speechRate, speechVolume);
                      } catch { if (mySeq === requestSeqRef.current) setResponse('⚠️ Could not get a response.'); }
                      if (mySeq === requestSeqRef.current) setLoading(false);
                    }}
                    className="aac-btn rounded-xl px-4 py-2 bg-[#4CAF50] text-white font-bold text-sm"
                  >
                    🗣 {opt}
                  </button>
                ))}
              </div>
            );
          })()}
          <button
            onClick={dismiss}
            className="absolute top-1 right-2 text-muted text-xs px-1"
            aria-label="Dismiss"
            data-testid="math-tutor-dismiss"
          >
            ×
          </button>
        </div>
      )}

    </div>
  );
}
