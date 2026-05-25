/**
 * wasmTTS::speakWasm — guard paths that do NOT require WASM loaded
 *
 * speakWasm has two fast-return guards testable without any WASM:
 *   1. Empty text → returns false immediately (no audio attempted)
 *   2. config.enabled=false → returns false immediately
 *
 * These verify the function's defensive contract; the WASM synthesis
 * path itself is integration-tested separately.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { speakWasm, setWasmTTSConfig } from '@/services/wasmTTS';

// ── speakWasm — empty text guard ──────────────────────────────────────────────

describe('speakWasm — empty text guard', () => {
  it('returns false for empty string', async () => {
    const result = await speakWasm('', 'en');
    expect(result).toBe(false);
  });

  it('returns false for whitespace-only string', async () => {
    const result = await speakWasm('   ', 'en');
    expect(result).toBe(false);
  });

  it('does not throw for empty string', async () => {
    await expect(speakWasm('', 'en')).resolves.toBe(false);
  });
});

// ── speakWasm — disabled config guard ────────────────────────────────────────

describe('speakWasm — disabled config guard', () => {
  beforeEach(() => {
    setWasmTTSConfig({ enabled: false });
  });

  it('returns false immediately when wasm TTS is disabled', async () => {
    const result = await speakWasm('hello', 'en');
    expect(result).toBe(false);
  });

  it('returns false for any language when disabled', async () => {
    expect(await speakWasm('bine', 'ro')).toBe(false);
    expect(await speakWasm('hola', 'es')).toBe(false);
  });

  it('does not throw when disabled', async () => {
    await expect(speakWasm('test', 'en')).resolves.toBe(false);
  });
});
