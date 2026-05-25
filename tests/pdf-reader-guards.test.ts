/**
 * pdfReader::extractPdfText — network-free mock path
 *
 * extractPdfText calls loadPdfjs() which dynamically imports pdfjs-dist.
 * In jsdom/test env pdfjs-dist is available as a package, but running it
 * requires a Worker that doesn't exist in jsdom. We mock the entire module
 * so the function under test exercises its own logic (page iteration, text
 * extraction shape, error normalisation) without spawning a PDF worker.
 *
 * The mock provides a minimal pdfjs surface that mirrors the real shape.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock pdfjs-dist before importing extractPdfText so the dynamic import
// inside loadPdfjs() receives the stub.
vi.mock('pdfjs-dist', () => {
  const fakeTextContent = {
    items: [
      { str: 'Hello', hasEOL: false },
      { str: ' World', hasEOL: true },
    ],
  };
  const fakePage = {
    getTextContent: vi.fn().mockResolvedValue(fakeTextContent),
    getViewport: vi.fn().mockReturnValue({ width: 612, height: 792 }),
  };
  const fakeDoc = {
    numPages: 2,
    getMetadata: vi.fn().mockResolvedValue({
      info: { Title: 'Test PDF', Author: 'Tester' },
      metadata: null,
    }),
    getPage: vi.fn().mockResolvedValue(fakePage),
    destroy: vi.fn(),
  };
  return {
    getDocument: vi.fn(() => ({ promise: Promise.resolve(fakeDoc) })),
    GlobalWorkerOptions: { workerSrc: '' },
    version: '3.0.0-mock',
  };
});

import { extractPdfText } from '@/services/pdfReader';

// Create a minimal ArrayBuffer that pretends to be PDF bytes
function makeBuffer(bytes = 128): ArrayBuffer {
  return new ArrayBuffer(bytes);
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('extractPdfText', () => {
  it('resolves to an object with pages array', async () => {
    const result = await extractPdfText(makeBuffer());
    expect(result).toHaveProperty('pages');
    expect(Array.isArray(result.pages)).toBe(true);
  });

  it('returns one entry per page (2 pages in mock)', async () => {
    const result = await extractPdfText(makeBuffer());
    expect(result.pages).toHaveLength(2);
  });

  it('each page entry has a pageNumber and text field', async () => {
    const result = await extractPdfText(makeBuffer());
    for (const page of result.pages) {
      expect(typeof page.pageNumber).toBe('number');
      expect(typeof page.text).toBe('string');
    }
  });

  it('extracts text from mock page content', async () => {
    const result = await extractPdfText(makeBuffer());
    // The mock returns "Hello World" across two items
    const combined = result.pages.map(p => p.text).join(' ');
    expect(combined.length).toBeGreaterThan(0);
  });

  it('accepts ArrayBuffer input without throwing', async () => {
    await expect(extractPdfText(makeBuffer(256))).resolves.toBeDefined();
  });

  it('accepts File input without throwing', async () => {
    const file = new File([new Uint8Array(64)], 'test.pdf', { type: 'application/pdf' });
    await expect(extractPdfText(file)).resolves.toBeDefined();
  });

  it('returns totalChars field (sum of all page chars)', async () => {
    const result = await extractPdfText(makeBuffer());
    expect(typeof result.totalChars).toBe('number');
    expect(result.totalChars).toBeGreaterThan(0);
  });
});
