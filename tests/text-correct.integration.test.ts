// @vitest-environment node
/**
 * Auto-correction integration suites — hit the real LLMs.
 *
 * Two suites:
 *   1. correctText (live portal)   — runs against synalux.ai/api/v1/text/correct
 *      (Gemini 2.5 Flash). Set RUN_LIVE_CORRECT=1.
 *   2. correctText (offline)       — runs against local Ollama prism-coder:7b
 *      (the offline fallback path). Set RUN_LOCAL_CORRECT=1, requires
 *      `ollama serve` running and `prism-coder:7b` pulled.
 *
 * Lives in its own file with `@vitest-environment node` so we get
 * undici's real network fetch (jsdom blocks localhost / requires CORS
 * preflight that Ollama doesn't pass). Skips the global jsdom setup so
 * we don't hit `window`/`speechSynthesis` mocks meant for unit tests.
 *
 * Assertions test for keyword containment, not exact equality — LLM
 * output drifts across prompt revisions and across runs at temperature
 * 0.0 occasionally. The contract we care about is "the intended
 * utterance is reconstructable from the output".
 */

import { describe, it, expect } from 'vitest';

const LIVE = process.env.RUN_LIVE_CORRECT === '1';
const LOCAL = process.env.RUN_LOCAL_CORRECT === '1';
const SYNALUX = process.env.SYNALUX_API || 'https://synalux.ai/api/v1';
const OLLAMA = process.env.OLLAMA_URL || 'http://localhost:11434';

const liveCases: Array<{ input: string; mustContain: string[] | string }> = [
  // Voice mis-segmentation — Web Speech API output for "bowl of rice"
  { input: 'bowlofrice',          mustContain: ['bowl', 'rice'] },
  { input: 'bowl ofrice',         mustContain: ['bowl', 'rice'] },
  { input: 'bowirice',            mustContain: ['bowl', 'rice'] },

  // Hurried typing — missing spaces, stray punctuation
  { input: 'bowlof,ri',           mustContain: ['bowl', 'rice'] },
  { input: 'i needhelp',          mustContain: ['need', 'help'] },
  { input: 'iwantfood',           mustContain: ['want', 'food'] },
  { input: 'pleasehelpme',        mustContain: ['please', 'help', 'me'] },
  { input: 'wherethebathroom',    mustContain: ['where', 'bathroom'] },
  { input: 'mynameisalex',        mustContain: ['name', 'alex'] },

  // Dropped letters — common motor error
  { input: 'i wnt eat',           mustContain: ['want', 'eat'] },
  // "tnk you" can land on "thank you" or the contracted "thanks" — both are
  // legitimate corrections; we just require any "thank" stem.
  { input: 'tnk you',             mustContain: ['thank'] },
  { input: 'gud morning',         mustContain: ['good', 'morning'] },

  // Transposition
  { input: 'teh book',            mustContain: 'the' },
  { input: 'rice and beasn',      mustContain: ['rice', 'beans'] },

  // Already-clean input must be returned (substantially) unchanged
  { input: 'I would like a bowl of rice', mustContain: 'bowl of rice' },
  { input: 'Hello, how are you?',         mustContain: 'are' },
];

const LOCAL_SYSTEM = `You are a fast text-cleanup engine for an AAC (augmentative and alternative communication) app used by users with motor impairments. Your only job: take possibly-malformed input and return the most likely intended utterance.

Rules:
- Fix obvious typos, missing spaces, dropped letters, transposed letters.
- Fix voice-transcript word-boundary errors (e.g. "bowlof rice" -> "bowl of rice", "i wantto eat" -> "i want to eat").
- Fix spurious commas/punctuation that came from hurried typing.
- Capitalize "I" and the first word.
- DO NOT rewrite the user's voice — keep their words and tone.
- DO NOT add new content the user did not say.
- DO NOT remove content the user did say.
- DO NOT translate.
- If the input is already well-formed, return it unchanged.
- Return ONLY the corrected text, no quotes, no explanation, no preamble.`;

describe.skipIf(!LIVE)('correctText (live portal — Gemini 2.5 Flash)', () => {
  it.each(liveCases)('"$input" → corrected utterance contains the right keywords', async ({ input, mustContain }) => {
    const res = await fetch(`${SYNALUX}/text/correct`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text: input, lang: 'en' }),
    });
    expect(res.ok).toBe(true);
    const data = await res.json();
    const corrected = (data?.corrected || '').toLowerCase();
    const required = Array.isArray(mustContain) ? mustContain : [mustContain];
    for (const word of required) {
      expect(corrected, `"${input}" → "${corrected}" missing "${word}"`).toContain(word.toLowerCase());
    }
  }, 20_000);
});

describe.skipIf(!LOCAL)('correctText (offline — prism-coder:7b)', () => {
  it.each(liveCases)('"$input" → prism-coder corrected utterance contains the right keywords', async ({ input, mustContain }) => {
    const res = await fetch(`${OLLAMA}/api/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'prism-coder:7b',
        system: LOCAL_SYSTEM,
        prompt: `Language: en. Input: "${input}"`,
        stream: false,
        options: { temperature: 0.0, num_predict: 80 },
      }),
    });
    expect(res.ok).toBe(true);
    const data = await res.json();
    const corrected = ((data?.response || '') as string).trim().toLowerCase();
    const required = Array.isArray(mustContain) ? mustContain : [mustContain];
    for (const word of required) {
      expect(corrected, `"${input}" → "${corrected}" missing "${word}"`).toContain(word.toLowerCase());
    }
  }, 60_000);
});
