/**
 * Model-management contracts use fixtures. Live generation requires
 * PRISM_LIVE_LOCAL_TESTS=1 and an explicit Ollama assignment in Prism.
 */

import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { configuredOllamaTests } from './helpers/prismLiveBackend';

const live = configuredOllamaTests();
const OLLAMA_URL = live.url;
const TAG = live.model;
if (!live.enabled) console.info(live.reason);

// Only the explicitly enabled live suites need a reachable Ollama instance.
// Request-contract fixtures below run without a server.
// The catch is load-bearing: with nothing listening, fetch REJECTS with
// ECONNREFUSED rather than resolving a non-ok response, so this top-level await
// threw at import and failed the whole file instead of skipping it.
const ollamaUp = live.enabled && await fetch(`${OLLAMA_URL}/api/tags`, { redirect: 'error', signal: AbortSignal.timeout(3000) })
  .then(r => r.ok)
  .catch(() => false);

// ── Helpers ────────────────────────────────────────────────────────────────

async function getOllamaTags(url = OLLAMA_URL): Promise<string[]> {
  const r = await fetch(`${url}/api/tags`, { redirect: 'error', signal: AbortSignal.timeout(3000) });
  if (!r.ok) return [];
  const data = await r.json() as { models?: Array<{ name: string }> };
  return (data.models ?? []).map(m => m.name);
}

async function pullModel(tag: string, url = OLLAMA_URL): Promise<boolean> {
  const r = await fetch(`${url}/api/pull`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: tag, stream: false }),
    signal: AbortSignal.timeout(300_000),
  });
  return r.ok;
}

async function deleteModel(tag: string, url = OLLAMA_URL): Promise<boolean> {
  const r = await fetch(`${url}/api/delete`, {
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

describe.skipIf(!ollamaUp)('LocalAI — configured Prism Ollama coder', () => {
  test('the configured model is already installed', async () => {
    const tags = await getOllamaTags();
    expect(tags).toContain(TAG);
  }, 5000);

  test('generates a response with v19 system prompt', async () => {
    const r = await fetch(`${OLLAMA_URL}/api/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: TAG,
        prompt: 'Load context for prism-mcp',
        system: 'When a tool is needed respond ONLY with: <|tool_call|>\n{"name":"tool_name","arguments":{}}\n<|tool_call_end|>\nTOOL ROUTING: load/fetch context for X -> session_load_context(project=X)',
        stream: false,
        keep_alive: 0,
        options: { num_predict: 100, temperature: 0 },
      }),
      signal: AbortSignal.timeout(30_000),
    });
    expect(r.ok).toBe(true);
    const data = await r.json() as { response: string };
    expect(typeof data.response).toBe('string');
    expect(data.response.length).toBeGreaterThan(0);
    console.log('Configured model response:', data.response.slice(0, 100));
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
        keep_alive: 0,
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
        keep_alive: 0,
        options: { num_predict: 200, temperature: 0 },
      }),
      signal: AbortSignal.timeout(30_000),
    });
    const data = await r.json() as { response: string };
    expect(data.response).not.toMatch(/<\|tool_call\|>/);
  }, 30_000);
});

describe('LocalAI — model management request contracts (fixtures)', () => {
  const URL = 'http://localhost:11434';
  const MODEL = 'fixture/local-model:test';
  const request = vi.fn<typeof fetch>();
  beforeEach(() => { request.mockReset(); vi.stubGlobal('fetch', request); });
  afterEach(() => vi.unstubAllGlobals());

  test('model inventory reads the supplied endpoint', async () => {
    request.mockResolvedValue(new Response(JSON.stringify({ models: [{ name: MODEL }] })));
    expect(await getOllamaTags(URL)).toEqual([MODEL]);
    expect(request).toHaveBeenCalledWith(`${URL}/api/tags`, expect.objectContaining({ redirect: 'error' }));
  });

  test('DELETE /api/delete returns ok for non-existent model (404 acceptable)', async () => {
    request.mockResolvedValue(new Response(null, { status: 404 }));
    const ok = await deleteModel(MODEL, URL);
    expect(ok).toBe(true);
    expect(request).toHaveBeenCalledWith(`${URL}/api/delete`, expect.objectContaining({ method: 'DELETE', body: JSON.stringify({ name: MODEL }) }));
  }, 5000);

  test('model pull constructs its request without downloading weights', async () => {
    request.mockResolvedValue(new Response('{}'));
    expect(await pullModel(MODEL, URL)).toBe(true);
    expect(request).toHaveBeenCalledWith(`${URL}/api/pull`, expect.objectContaining({ method: 'POST', body: JSON.stringify({ name: MODEL, stream: false }) }));
  });
});
