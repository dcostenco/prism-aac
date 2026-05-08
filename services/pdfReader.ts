'use client';
/**
 * pdfReader — extract text from a PDF file (browser-side via pdfjs).
 *
 * pdfjs-dist is dynamic-imported so the ~3 MB worker payload doesn't
 * land in the main bundle until the user opens a PDF. The worker
 * itself is loaded from the same module via the bundler's URL
 * resolution (Next.js + Webpack/Turbopack handles
 * `new URL('./worker.mjs', ...)` for npm packages).
 *
 * Used by the PDF Reader panel to feed each page into aacSpeak() so
 * the AAC user can listen to school documents instead of trying to
 * read them — one of the dealbreaker features in the Reddit r/AAC
 * "free Read & Write alternatives" thread (May 2026).
 */

export interface PdfPage {
  /** 1-based page number. */
  pageNumber: number;
  /** Plain text extracted from the page (whitespace-collapsed). */
  text: string;
}

export interface PdfExtractResult {
  pages: PdfPage[];
  /** Document metadata title — falls back to '' when unknown. */
  title: string;
  /** Document character count across all pages. */
  totalChars: number;
}

let pdfjsModule: typeof import('pdfjs-dist') | null = null;
let workerSet = false;

async function loadPdfjs(): Promise<typeof import('pdfjs-dist')> {
  if (pdfjsModule) return pdfjsModule;
  // pdfjs-dist's browser entry uses Top-Level Await for the worker,
  // which Next.js handles via a separate chunk on dynamic import.
  const mod = await import('pdfjs-dist');
  if (!workerSet) {
    // Point the worker at the CDN so we don't have to bundle it
    // manually; matches the pdfjs version exactly.
    const version = mod.version;
    mod.GlobalWorkerOptions.workerSrc =
      `https://cdn.jsdelivr.net/npm/pdfjs-dist@${version}/build/pdf.worker.min.mjs`;
    workerSet = true;
  }
  pdfjsModule = mod;
  return mod;
}

/**
 * Extract text + metadata from a PDF File (or any ArrayBuffer source).
 * Returns one entry per page so the AAC UI can let the user pick
 * which page to listen to.
 */
export async function extractPdfText(source: File | ArrayBuffer): Promise<PdfExtractResult> {
  const pdfjs = await loadPdfjs();
  const data = source instanceof File ? await source.arrayBuffer() : source;
  const doc = await pdfjs.getDocument({ data }).promise;

  let title = '';
  try {
    const meta = await doc.getMetadata();
    const info = meta.info as { Title?: string } | undefined;
    title = info?.Title?.trim() ?? '';
  } catch { /* metadata is optional */ }

  const pages: PdfPage[] = [];
  let totalChars = 0;
  for (let i = 1; i <= doc.numPages; i++) {
    const page = await doc.getPage(i);
    const content = await page.getTextContent();
    // Each item is a span; concat with single spaces, collapse runs.
    const text = content.items
      .map((it) => (it as { str?: string }).str ?? '')
      .join(' ')
      .replace(/\s+/g, ' ')
      .trim();
    pages.push({ pageNumber: i, text });
    totalChars += text.length;
    page.cleanup();
  }
  doc.destroy();
  return { pages, title, totalChars };
}
