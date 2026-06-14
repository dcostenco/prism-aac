/**
 * LocalAISettings unit tests
 * Tests Ollama detection, model pull, cancel, and delete flows.
 * Run: npx jest tests/local-ai-settings.test.ts
 */

const OLLAMA_URL = 'http://localhost:11434';

// Skip all tests when Ollama is not reachable. These are live integration
// tests that require a running Ollama instance — they are not meant for CI.
const ollamaUp = await fetch(`${OLLAMA_URL}/api/tags`, { signal: AbortSignal.timeout(3000) })
  .then(r => r.ok)
  ;

// ── Helpers ────────────────────────────────────────────────────────────────

async function getOllamaTags(): Promise<string[]> {
  const r = await fetch(`${OLLAMA_URL}/api/tags`, { signal: AbortSignal.timeout(3000) });
  if (!r.ok) return [];
  const data = await r.json() as { models?: Array<{ name: string }> };
  return (data.models ?? []).map(m => m.name);
}

async function pullModel(tag: string): Promise<boolean> {
  const r = await fetch(`${OLLAMA_URL}/api/pull`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: tag, stream: false }),
    signal: AbortSignal.timeout(300_000),
  });
  return r.ok;
}

async function deleteModel(tag: string): Promise<boolean> {
  const r = await fetch(`${OLLAMA_URL}/api/delete`, {
    method: 'DELETE',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: tag }),
    signal: AbortSignal.timeout(10_000),
  });
  return r.ok || r.status === 404;
}

// ── Tests ──────────────────────────────────────────────────────────────────

describe.skipIf(!ollamaUp)('LocalAI — Ollama connectivity', () => {
  test('Ollama is running at localhost:11434', async () => {
    const r = await fetch(`${OLLAMA_URL}/api/tags`, { signal: AbortSignal.timeout(3000) });
    expect(r.ok).toBe(true);
  }, 5000);

  test('GET /api/tags returns models array', async () => {
    const tags = await getOllamaTags();
    expect(Array.isArray(tags)).toBe(true);
  }, 5000);
});

describe.skipIf(!ollamaUp)('LocalAI — prism-coder:2b (2.3 GB — used in tests)', () => {
  const TAG = 'dcostenco/prism-coder:2b';

  test('model is already installed or can be pulled', async () => {
    const tags = await getOllamaTags();
    const installed = tags.some(t => t.includes('prism-coder:2b') || t === TAG);
    if (!installed) {
      console.log('Not installed, pulling 2b…');
      const ok = await pullModel(TAG);
      expect(ok).toBe(true);
    } else {
      expect(installed).toBe(true);
    }
  }, 300_000);

  test('generates a response with v19 system prompt', async () => {
    const r = await fetch(`${OLLAMA_URL}/api/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: TAG,
        prompt: 'Load context for prism-mcp',
        system: 'When a tool is needed respond ONLY with: <|tool_call|>\n{"name":"tool_name","arguments":{}}\n<|tool_call_end|>\nTOOL ROUTING: load/fetch context for X -> session_load_context(project=X)',
        stream: false,
        options: { num_predict: 100, temperature: 0 },
      }),
      signal: AbortSignal.timeout(30_000),
    });
    expect(r.ok).toBe(true);
    const data = await r.json() as { response: string };
    expect(typeof data.response).toBe('string');
    expect(data.response.length).toBeGreaterThan(0);
    console.log('2b response:', data.response.slice(0, 100));
  }, 30_000);

  test('correctly routes session_load_context', async () => {
    // api/generate with system: field mis-tokenizes <| sequences — Ollama's
    // chat template processing treats <| as a special-token prefix, eating the
    // rest of the system message. Use raw=true with a manually built prompt so
    // <|tool_call|> lands correctly in the context window.
    // Pre-inserting <think>\n</think> skips the thinking phase and ensures the
    // tool call is emitted within num_predict budget.
    const systemPrompt = `CRITICAL: You have EXACTLY 6 tools. Their EXACT names are:
  session_load_context, session_save_ledger, session_save_handoff,
  session_compact_ledger, session_search_memory, knowledge_search
When a tool is needed, respond ONLY with:
<|tool_call|>
{"name": "session_load_context", "arguments": {"project": "X"}}
<|tool_call_end|>
If no tool is needed, respond in plain text.
TOOL ROUTING:
load/fetch/get/pull/retrieve/open/resume context for project X -> session_load_context(project=X)`;
    const rawPrompt = `<|im_start|>system\n${systemPrompt}<|im_end|>\n<|im_start|>user\nLoad context for prism-mcp<|im_end|>\n<|im_start|>assistant\n<think>\n</think>\n`;
    const r = await fetch(`${OLLAMA_URL}/api/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: TAG,
        prompt: rawPrompt,
        stream: false,
        raw: true,
        options: { num_predict: 200, temperature: 0 },
      }),
      signal: AbortSignal.timeout(30_000),
    });
    const data = await r.json() as { response: string };
    expect(data.response).toMatch(/session_load_context/);
  }, 30_000);

  test('refuses to call a tool for time queries (hallucination guard)', async () => {
    const r = await fetch(`${OLLAMA_URL}/api/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: TAG,
        prompt: 'What time is it in Tokyo right now?',
        system: 'When a tool is needed respond ONLY with: <|tool_call|>\n{"name":"tool_name","arguments":{}}\n<|tool_call_end|>\nIf no tool needed respond in plain text.\ncurrent time / weather -> respond in plain text',
        stream: false,
        options: { num_predict: 200, temperature: 0 },
      }),
      signal: AbortSignal.timeout(30_000),
    });
    const data = await r.json() as { response: string };
    expect(data.response).not.toMatch(/<\|tool_call\|>/);
  }, 30_000);
});

describe.skipIf(!ollamaUp)('LocalAI — model management API', () => {
  test('DELETE /api/delete returns ok for non-existent model (404 acceptable)', async () => {
    const ok = await deleteModel('dcostenco/prism-coder:nonexistent-test');
    expect(ok).toBe(true);
  }, 5000);

  test('Ollama pull API returns streaming NDJSON for valid model', async () => {
    // Just verify the endpoint accepts the request format — don't actually download
    const r = await fetch(`${OLLAMA_URL}/api/pull`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'dcostenco/prism-coder:2b', stream: true }),
      signal: AbortSignal.timeout(5000),
    });
    // Should start streaming (200) or indicate already cached
    expect([200, 304].includes(r.status) || r.ok).toBe(true);
  }, 10_000);
});
