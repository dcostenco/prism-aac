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
  let mod: typeof import('pdfjs-dist');
  try {
    mod = await import('pdfjs-dist');
  } catch (e) {
    throw new Error(
      `Could not load PDF reader runtime — ${e instanceof Error ? e.message : String(e)}. ` +
        'Check your internet connection and reload.',
    );
  }
  // Defensive checks: dynamic-import shape regressions on the pdfjs
  // side have produced "undefined is not a function (near '…of e…')"
  // user reports when a `for…of` walk inside pdfjs hit an undefined
  // entries collection (May 2026 user Image #28). Surfacing the
  // missing piece by name makes future failures diagnosable instead
  // of a generic JS engine message.
  if (!mod || typeof (mod as { getDocument?: unknown }).getDocument !== 'function') {
    throw new Error(
      'PDF reader runtime loaded but `getDocument` is missing — pdfjs-dist version mismatch. Reload the page.',
    );
  }
  if (!mod.GlobalWorkerOptions) {
    throw new Error(
      'PDF reader runtime missing GlobalWorkerOptions — pdfjs-dist module shape changed. Reload the page.',
    );
  }
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
    let text = '';
    try {
      const page = await doc.getPage(i);
      const content = await page.getTextContent();
      // pdfjs returns `content.items` as an array of TextItem | TextMarkedContent.
      // If pdfjs's internal extraction errored out the items array can be
      // undefined / null on some malformed PDFs (or worker-load races).
      // Fall back to empty text for that page rather than letting the
      // for-loop crash — the user still gets the rest of the document.
      const items = Array.isArray(content?.items) ? content.items : [];
      text = items
        .map((it) => (it as { str?: string }).str ?? '')
        .join(' ')
        .replace(/\s+/g, ' ')
        .trim();
      page.cleanup();
    } catch (e) {
      // Per-page failure must NOT take down the whole document — speak
      // what we have, label the bad page so the user knows where to look.
      text = `[Page ${i} could not be read: ${e instanceof Error ? e.message : 'unknown error'}]`;
    }
    pages.push({ pageNumber: i, text });
    totalChars += text.length;
  }
  doc.destroy();
  return { pages, title, totalChars };
}
