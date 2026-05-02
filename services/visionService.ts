'use client';

/**
 * Vision Service — Local Qwen2.5-VL-7B for scene understanding
 *
 * Used by:
 *   - emergencyService: describe what the camera sees during a crisis
 *     (the operator wants to know if there's blood, smoke, a stranger,
 *     unconsciousness, etc — things head-tracking pose data cannot tell us)
 *   - caregiverNote: parse a phone-photo of a paper schedule / handwritten
 *     phrase list / ARASAAC symbol the caregiver wants added to the AAC
 *
 * Architecture: same local-first pattern as localModel.ts — probe at boot,
 * cache the result, fall back to portal vision endpoint if local is down.
 *
 * Server: mlx_vlm.server runs on localhost:8001 with Qwen2.5-VL-7B-Instruct-4bit.
 * It speaks the OpenAI-compatible /v1/chat/completions API.
 *
 * SAFETY: vision output is NEVER the final decision-maker. It feeds text
 * context into prism-coder, which still arbitrates the actual response.
 * A vision hallucination cannot directly trigger an emergency action.
 */

const VLM_BASE = 'http://localhost:8001';
const PROBE_TIMEOUT_MS = 600;
const GENERATE_TIMEOUT_MS = 4000;

let cachedAvailable: boolean | null = null;
let probePromise: Promise<boolean> | null = null;
let lastProbeAt = 0;
const REPROBE_COOLDOWN_MS = 30_000;

async function probe(): Promise<boolean> {
  if (typeof window === 'undefined') return false;
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), PROBE_TIMEOUT_MS);
  try {
    const res = await fetch(`${VLM_BASE}/v1/models`, { signal: ctrl.signal });
    if (!res.ok) return false;
    const data = await res.json();
    const models = (data?.data ?? data?.models ?? []) as Array<{ id?: string; name?: string }>;
    return models.some((m) => {
      const name = m.id || m.name || '';
      return name.toLowerCase().includes('qwen') && name.toLowerCase().includes('vl');
    });
  } catch {
    return false;
  } finally {
    clearTimeout(timer);
  }
}

export function isVisionAvailable(): Promise<boolean> {
  if (probePromise) return probePromise;
  const now = Date.now();
  if (cachedAvailable === true) return Promise.resolve(true);
  if (cachedAvailable === false && now - lastProbeAt < REPROBE_COOLDOWN_MS) {
    return Promise.resolve(false);
  }
  lastProbeAt = now;
  probePromise = probe().then((v) => {
    cachedAvailable = v;
    if (!v) probePromise = null;
    return v;
  });
  return probePromise;
}

export interface VisionRequest {
  /** base64 data URL or remote URL */
  image: string;
  /** what to ask about the image */
  question: string;
  /** max tokens for response (default 120) */
  maxTokens?: number;
}

export interface VisionResponse {
  text: string;
  latencyMs: number;
}

/**
 * Ask a question about an image using the local VLM.
 * Returns null if the VLM isn't available or fails.
 *
 * Caller MUST treat the returned text as one input among many — never as
 * a sole decision basis for safety-critical actions.
 */
export async function askVision(req: VisionRequest): Promise<VisionResponse | null> {
  const available = await isVisionAvailable();
  if (!available) return null;

  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), GENERATE_TIMEOUT_MS);
  const t0 = Date.now();
  try {
    const res = await fetch(`${VLM_BASE}/v1/chat/completions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'mlx-community/Qwen2.5-VL-7B-Instruct-4bit',
        messages: [
          {
            role: 'user',
            content: [
              { type: 'image_url', image_url: { url: req.image } },
              { type: 'text', text: req.question },
            ],
          },
        ],
        max_tokens: req.maxTokens ?? 120,
        temperature: 0.2,
      }),
      signal: ctrl.signal,
    });
    if (!res.ok) return null;
    const data = await res.json();
    const text = (data?.choices?.[0]?.message?.content || '').trim();
    if (!text) return null;
    return { text, latencyMs: Date.now() - t0 };
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

// ── Convenience helpers wired to specific use cases ────────────────────────

/**
 * Emergency scene description. Used by emergencyService when the user
 * triggers a critical phrase — the AI describes what the device camera
 * sees so the 911 operator gets context.
 *
 * Returns null on any failure (caller must NOT block the emergency flow).
 */
export async function describeEmergencyScene(image: string): Promise<string | null> {
  const res = await askVision({
    image,
    question: 'You are helping a 911 operator. Describe what you see in 2-3 short sentences. Mention: people present, visible injuries or blood, hazards (smoke, fire, water), unconsciousness, weapons, environmental clues (indoor/outdoor, room type). Be factual and concise. If you are unsure, say so.',
    maxTokens: 150,
  });
  return res?.text ?? null;
}

/**
 * OCR / phrase extraction from a caregiver-uploaded photo.
 * Used by the caregiver-notes panel when a phone photo of a paper
 * schedule or printed phrase list is provided.
 */
export async function extractCaregiverPhrases(image: string): Promise<string[] | null> {
  const res = await askVision({
    image,
    question: 'Extract every visible AAC phrase, schedule item, or short text from this image. Return ONE phrase per line. No explanation, no numbering, no bullets. If the image contains no readable text, return the single word: NONE.',
    maxTokens: 300,
  });
  if (!res?.text) return null;
  if (res.text.trim().toUpperCase() === 'NONE') return [];
  return res.text
    .split(/\r?\n+/)
    .map((s) => s.trim().replace(/^[-*•\d.)\s]+/, '').trim())
    .filter((s) => s.length > 0);
}
