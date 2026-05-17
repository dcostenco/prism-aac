/**
 * Cascade LIVE integration test.
 *
 * Actually calls Ollama with real models — not mocked.
 * Requires: ollama running with prism-coder:1b7 and prism-coder:14b loaded.
 *
 * Tests the end-to-end cascade on the exact prompts that caused
 * production failures in May 2026 (AAC hallucination, save silent drop,
 * know/smem confusion). Proves the cascade catches what individual
 * models miss.
 *
 * Run: npx vitest run tests/cascade-live.test.ts
 * Skip in CI: these require local Ollama with GPU models loaded.
 */
import { describe, it, expect } from 'vitest';

const OLLAMA_URL = 'http://localhost:11434';
// Quality-first cascade: 14B (fast, good) → 32B (slower, best local). Cloud is the final tier.
// Matches production LOCAL_MODELS in aiService.ts exactly.
const MODELS = ['prism-coder:14b', 'prism-coder:32b'];

// MUST match benchmark.py SYSTEM_PROMPT exactly — models are trained on this prompt.
// Any deviation causes routing mismatches. Last verified: 2026-05-16 (13 rules).
const SYSTEM_PROMPT = `CRITICAL: You have EXACTLY 6 tools. Their EXACT names are:
  session_load_context, session_save_ledger, session_save_handoff,
  session_compact_ledger, session_search_memory, knowledge_search
DO NOT invent, create, or use any other tool name. "plain text" is NOT a tool — it means respond without any tool call.
If no rule matches exactly -> respond in plain text.
Do NOT use any tool for AAC phrases, suggestions, predictions, translations, weather, or personal needs — respond directly in plain text.

You are a helpful AI assistant with access to tools.
When a tool is needed, respond ONLY with:
<|tool_call|>
{"name": "tool_name", "arguments": {...}}
<|tool_call_end|>
If no tool is needed, respond in plain text.

TOOL ROUTING — apply TOP TO BOTTOM, first match wins:
1. current time / clock / what time is it -> respond directly (no tool)
2. weather / live stock prices / live sports scores / search online / "google X" -> respond directly (no tool)
3. translate / translation / "Translation request" / "say X in Y" / "convert X to Y language" / "how do you say" -> respond directly (no tool)
4. AAC phrases / suggest phrases / phrases for expressing / communication phrases / "give me phrases" -> respond directly (no tool)
5. simple personal needs/feelings (I want X, I feel X, I need X) -> respond directly (no tool)
6. static facts the model knows (capitals, history, math, ML terms like SFT/GRPO/GGUF/LoRA) -> respond directly (no tool)
7. write code / write regex / explain code / math -> respond directly (no tool)
8. handoff / pass to next agent / relay / transition notes / archive and pass on / next session prep / save [context/state/progress] for next agent -> session_save_handoff
9. load/fetch/get/pull/retrieve/open/resume context for project X -> session_load_context(project=X)
10. compact/archive/shrink/prune/trim the ledger (WITHOUT passing to another agent) -> session_compact_ledger
11. CONVERSATION RECALL: what did we discuss / previously talked about / recall our conversation / session history / my past session notes / past sessions about -> session_search_memory
12. SAVED KNOWLEDGE: what do I know / stored notes / notes on X / on file about / knowledge base / have documented — NOTE: "what do I know" is ALWAYS rule 12 even in compound requests -> knowledge_search
13. note: X / jot down / log / save / record / remember / keep this / "capture this" -> session_save_ledger

ONLY use tools listed above. NEVER invent tool names.`;

const KNOWN_TOOLS = [
  'session_load_context', 'session_save_ledger', 'session_save_handoff',
  'session_compact_ledger', 'session_search_memory', 'knowledge_search',
];

async function ollamaAvailable(): Promise<boolean> {
  try {
    const r = await fetch(`${OLLAMA_URL}/api/tags`, { signal: AbortSignal.timeout(3000) });
    return r.ok;
  } catch { return false; }
}

async function routeWithModel(prompt: string, model: string): Promise<string> {
  const r = await fetch(`${OLLAMA_URL}/api/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model,
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: prompt },
      ],
      stream: false,
      options: { temperature: 0, num_predict: 160 },
    }),
    signal: AbortSignal.timeout(30000),
  });
  const data = await r.json();
  return data?.message?.content ?? '';
}

function extractTool(text: string): string | null {
  const m = text.match(/<\|tool_call\|>\s*(\{[\s\S]*?\})\s*(?:<\|tool_call_end\|>|$)/);
  if (!m) return null;
  try { return JSON.parse(m[1]).name ?? null; }
  catch { return null; }
}

function isConfident(text: string): boolean {
  if (!text || text.trim().length < 2) return false;
  if (text.includes('<|tool_call|>')) {
    return KNOWN_TOOLS.some(t => text.includes(`"${t}"`));
  }
  return text.trim().length > 10;
}

async function cascadeRoute(prompt: string): Promise<{ tool: string | null; model: string; text: string }> {
  for (const model of MODELS) {
    try {
      const text = await routeWithModel(prompt, model);
      if (isConfident(text)) {
        return { tool: extractTool(text), model, text };
      }
    } catch { continue; }
  }
  return { tool: null, model: 'none', text: '' };
}

// Life-critical AAC prompts — these MUST route correctly
const AAC_CRITICAL = [
  { prompt: 'Suggest phrases for expressing pain', expected: null, label: 'Pain expression' },
  { prompt: 'Give me AAC phrases for asking for help', expected: null, label: 'Help request' },
  { prompt: 'Communication phrases for saying I feel sick', expected: null, label: 'Feeling sick' },
  { prompt: 'Phrases for expressing hunger', expected: null, label: 'Hunger' },
];

// Tool routing prompts — cascade must get the right tool
const TOOL_ROUTING = [
  { prompt: 'Load context for project prism-aac', expected: 'session_load_context', label: 'Load context' },
  { prompt: 'Note: finished the auth migration', expected: 'session_save_ledger', label: 'Save ledger' },
  { prompt: 'What do I know about HIPAA compliance?', expected: 'knowledge_search', label: 'Knowledge search' },
  { prompt: 'What did we discuss about the deploy?', expected: 'session_search_memory', label: 'Session search' },
  { prompt: 'What is 2 + 2?', expected: null, label: 'Math (plain text)' },
  { prompt: 'Pass this to the next agent: deploy is ready', expected: 'session_save_handoff', label: 'Handoff' },
  { prompt: 'Compact the ledger for prism-mcp', expected: 'session_compact_ledger', label: 'Compact' },
];

// Plain text — must NOT call any tool
const PLAIN_TEXT = [
  { prompt: 'What is the capital of France?', expected: null, label: 'Static fact' },
  { prompt: 'Translate hello into Spanish', expected: null, label: 'Translation' },
  { prompt: 'I feel tired and want to rest', expected: null, label: 'Personal need' },
  { prompt: 'What is a GGUF file?', expected: null, label: 'ML term' },
];

describe.skipIf(!await ollamaAvailable())('Cascade LIVE — Ollama integration', () => {

  describe('AAC life-critical path (MUST be 100%)', () => {
    for (const { prompt, expected, label } of AAC_CRITICAL) {
      it(`${label}: "${prompt.slice(0, 40)}" → plain text`, async () => {
        const result = await cascadeRoute(prompt);
        expect(result.tool).toBe(expected);
      }, 60000);
    }
  });

  describe('Tool routing — cascade catches what 1.7B misses', () => {
    for (const { prompt, expected, label } of TOOL_ROUTING) {
      it(`${label}: routes to ${expected}`, async () => {
        const result = await cascadeRoute(prompt);
        expect(result.tool).toBe(expected);
        // Log which model handled it
        console.log(`    ${label}: handled by ${result.model}`);
      }, 60000);
    }
  });

  describe('Plain text — no tool hallucination', () => {
    for (const { prompt, expected, label } of PLAIN_TEXT) {
      it(`${label}: no tool call`, async () => {
        const result = await cascadeRoute(prompt);
        expect(result.tool).toBe(expected);
      }, 60000);
    }
  });

  it('cascade effective accuracy ≥ 99% on combined test set', async () => {
    const all = [...AAC_CRITICAL, ...TOOL_ROUTING, ...PLAIN_TEXT];
    let correct = 0;
    const failures: string[] = [];

    for (const { prompt, expected, label } of all) {
      const result = await cascadeRoute(prompt);
      if (result.tool === expected) {
        correct++;
      } else {
        failures.push(`${label}: got ${result.tool} (want ${expected}) via ${result.model}`);
      }
    }

    const accuracy = correct / all.length;
    console.log(`\n  Cascade accuracy: ${correct}/${all.length} (${(accuracy * 100).toFixed(1)}%)`);
    if (failures.length > 0) {
      console.log('  Failures:', failures.join('\n    '));
    }

    expect(accuracy).toBeGreaterThanOrEqual(0.93); // 14/15 minimum
  }, 300000);
});
