'use client';

/**
 * Local prism-coder probe.
 *
 * Many AAC paths are too latency-sensitive to round-trip to the synalux
 * portal — typing-as-you-go correction, voice transcript cleanup, future
 * predict-on-keystroke. We'd rather use the local prism-coder:7b on
 * Ollama if it's there.
 *
 * This module probes Ollama once at app boot. If it answers, every
 * speed-critical service uses local-only routing. If it doesn't, those
 * services fall back to the portal. The decision is cached for the
 * lifetime of the page so we don't pay the probe latency on every call.
 *
 * Free vs paid is irrelevant here — local prism-coder is free for every
 * tier. Speed is the only criterion.
 */

const OLLAMA_BASE = 'http://localhost:11434';
const PROBE_TIMEOUT_MS = 600;

let probePromise: Promise<boolean> | null = null;

async function probeOllama(): Promise<boolean> {
  if (typeof window === 'undefined') return false;
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), PROBE_TIMEOUT_MS);
  try {
    const res = await fetch(`${OLLAMA_BASE}/api/tags`, { signal: ctrl.signal });
    if (!res.ok) return false;
    const data = await res.json();
    const models = (data?.models ?? []) as Array<{ name: string }>;
    return models.some((m) => m.name === 'prism-coder:7b' || m.name.startsWith('prism-coder'));
  } catch {
    return false;
  } finally {
    clearTimeout(timer);
  }
}

// Only cache positive results permanently. If probe returns false,
// allow re-probe after 30s cooldown — the local model may start later.
let lastProbeTime = 0;
const REPROBE_COOLDOWN_MS = 30_000;

export function isLocalModelAvailable(): Promise<boolean> {
  if (probePromise) return probePromise;

  const now = Date.now();
  if (cachedResult === true) return Promise.resolve(true);
  if (cachedResult === false && (now - lastProbeTime) < REPROBE_COOLDOWN_MS) {
    return Promise.resolve(false);
  }

  lastProbeTime = now;
  probePromise = probeOllama().then(v => {
    cachedResult = v;
    if (!v) probePromise = null; // allow re-probe on next call after cooldown
    return v;
  });
  return probePromise;
}

let cachedResult: boolean | null = null;

export function getLocalModelStatus(): boolean | null {
  return cachedResult;
}

export const LOCAL_OLLAMA_URL = `${OLLAMA_BASE}/api/generate`;
export const LOCAL_MODEL = 'prism-coder:7b';
