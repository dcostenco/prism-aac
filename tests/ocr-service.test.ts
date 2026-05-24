/**
 * ocr — tesseractCodeFor() pure mapping + runOcr() with mocked Tesseract.
 *
 * ocr.ts has zero test coverage despite being used in the AAC OCR Capture
 * panel (classroom worksheet scanning → speak). The core pure function
 * tesseractCodeFor() and the runOcr() error paths are tested here without
 * loading any WASM.
 *
 * tesseract.js is mocked so the dynamic-import path never hits the real
 * 3 MB worker download. disposeOcr() is exercised for cleanup verification.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

// ── Mock tesseract.js BEFORE importing ocr.ts ─────────────────────────────────
// ocr.ts uses dynamic import('tesseract.js') inside getModule(). We need the
// alias set up in vitest.config.ts to work, but tesseract.js is not installed.
// Use vi.mock to intercept the dynamic import path.

const mockRecognize = vi.fn();
const mockTerminate = vi.fn().mockResolvedValue(undefined);

vi.mock('tesseract.js', () => ({
  createWorker: vi.fn(async (_lang: string) => ({
    recognize: mockRecognize,
    terminate: mockTerminate,
  })),
}));

import {
  tesseractCodeFor,
  runOcr,
  disposeOcr,
} from '@/services/ocr';

beforeEach(() => {
  mockRecognize.mockReset();
  mockTerminate.mockReset().mockResolvedValue(undefined);
});

// ── tesseractCodeFor — pure language code mapping ─────────────────────────────

describe('tesseractCodeFor — language code mapping', () => {
  it('maps "en" → "eng"', () => {
    expect(tesseractCodeFor('en')).toBe('eng');
  });

  it('maps "es" → "spa"', () => {
    expect(tesseractCodeFor('es')).toBe('spa');
  });

  it('maps "fr" → "fra"', () => {
    expect(tesseractCodeFor('fr')).toBe('fra');
  });

  it('maps "pt" → "por"', () => {
    expect(tesseractCodeFor('pt')).toBe('por');
  });

  it('maps "ro" → "ron"', () => {
    expect(tesseractCodeFor('ro')).toBe('ron');
  });

  it('maps "uk" → "ukr"', () => {
    expect(tesseractCodeFor('uk')).toBe('ukr');
  });

  it('maps "ja" → "jpn"', () => {
    expect(tesseractCodeFor('ja')).toBe('jpn');
  });

  it('maps "ko" → "kor"', () => {
    expect(tesseractCodeFor('ko')).toBe('kor');
  });

  it('maps "zh" → "chi_sim"', () => {
    expect(tesseractCodeFor('zh')).toBe('chi_sim');
  });

  it('maps "ar" → "ara"', () => {
    expect(tesseractCodeFor('ar')).toBe('ara');
  });

  it('maps locale tags like "en-US" → "eng" (strips region suffix)', () => {
    expect(tesseractCodeFor('en-US')).toBe('eng');
    expect(tesseractCodeFor('zh-Hans')).toBe('chi_sim');
    expect(tesseractCodeFor('pt-BR')).toBe('por');
  });

  it('falls back to "eng" for unknown codes', () => {
    expect(tesseractCodeFor('xx')).toBe('eng');
    expect(tesseractCodeFor('zzz')).toBe('eng');
  });

  it('falls back to "eng" for empty string', () => {
    expect(tesseractCodeFor('')).toBe('eng');
  });

  it('is case-insensitive (uppercase input)', () => {
    expect(tesseractCodeFor('EN')).toBe('eng');
    expect(tesseractCodeFor('FR')).toBe('fra');
  });
});

// ── runOcr — error paths + success with mocked Tesseract ─────────────────────

describe('runOcr — no-image guard', () => {
  it('returns failure when image is falsy (empty string)', async () => {
    const result = await runOcr('');
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toBeTruthy();
  });

  it('returns failure when image is null-ish (null cast as Blob)', async () => {
    const result = await runOcr(null as unknown as Blob);
    expect(result.ok).toBe(false);
  });
});

describe('runOcr — mocked Tesseract success path', () => {
  it('returns ok:true with trimmed text on successful recognition', async () => {
    mockRecognize.mockResolvedValueOnce({
      data: { text: '  Hello world  ', confidence: 87 },
    });

    const result = await runOcr(new Blob(['image data']), 'en');
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.text).toBe('Hello world');
      expect(result.confidence).toBe(87);
    }
  });

  it('returns failure when Tesseract returns empty text', async () => {
    mockRecognize.mockResolvedValueOnce({
      data: { text: '   ', confidence: 10 },
    });

    const result = await runOcr(new Blob(['img']), 'en');
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toContain('No readable text');
    }
  });

  it('returns failure with friendly error on Tesseract throw', async () => {
    mockRecognize.mockRejectedValueOnce(new Error('network timeout'));

    const result = await runOcr(new Blob(['img']), 'en');
    expect(result.ok).toBe(false);
    if (!result.ok) {
      // friendlyOcrError maps network errors to a user-readable message
      expect(result.error).toMatch(/internet|network|OCR/i);
    }
  });

  it('truncates very long raw errors to 100 chars', async () => {
    const longErr = 'x'.repeat(200);
    mockRecognize.mockRejectedValueOnce(new Error(longErr));

    const result = await runOcr(new Blob(['img']), 'en');
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.length).toBeLessThanOrEqual(103); // 100 + '…'
    }
  });
});

// ── disposeOcr — cleanup ──────────────────────────────────────────────────────

describe('disposeOcr', () => {
  it('does not throw when no workers have been created', async () => {
    await expect(disposeOcr()).resolves.toBeUndefined();
  });

  it('terminates existing workers and resets state', async () => {
    // Trigger worker creation by running OCR first
    mockRecognize.mockResolvedValueOnce({
      data: { text: 'test', confidence: 90 },
    });
    await runOcr(new Blob(['img']), 'en');

    // disposeOcr should terminate that worker
    await disposeOcr();
    expect(mockTerminate).toHaveBeenCalled();
  });

  it('is idempotent — calling twice does not throw', async () => {
    await disposeOcr();
    await expect(disposeOcr()).resolves.toBeUndefined();
  });
});
