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
    let phase: 'getPage' | 'getTextContent' | 'mapItems' | 'cleanup' = 'getPage';
    try {
      const page = await doc.getPage(i);
      phase = 'getTextContent';
      // Some clinical PDFs (Vineland-3, Connors, BASC) ship XFA forms
      // and tagged-PDF marked content. The default getTextContent
      // options trip a `for...of` over an undefined collection inside
      // pdfjs on those — surfacing as Safari's
      // "undefined is not a function (near '...t of e...')". Passing
      // explicit options (omit normalizeWhitespace, disableNormalization
      // = true) bypasses the offending normalization path while still
      // returning items[].
      const content = await page.getTextContent({
        includeMarkedContent: false,
        disableNormalization: true,
      } as Parameters<typeof page.getTextContent>[0]);
      phase = 'mapItems';
      // pdfjs returns `content.items` as TextItem | TextMarkedContent.
      // Filter to TextItem (those with .str) so iterator-based mapping
      // can't trip on a marked-content boundary even if includeMarked
      // wasn't honoured by an older worker.
      const rawItems: unknown[] = Array.isArray(content?.items) ? content.items : [];
      const strs: string[] = [];
      for (const it of rawItems) {
        const s = (it as { str?: unknown })?.str;
        if (typeof s === 'string') strs.push(s);
      }
      text = strs.join(' ').replace(/\s+/g, ' ').trim();
      phase = 'cleanup';
      try { page.cleanup(); } catch { /* cleanup failure is non-fatal */ }
    } catch (e) {
      // Per-page failure must NOT take down the whole document. Surface
      // the failed phase + a stack frame so future regressions are
      // diagnosable instead of hidden behind the minified Safari
      // "undefined is not a function (near '...t of e...')" message.
      const msg = e instanceof Error ? e.message : 'unknown error';
      const frame = e instanceof Error && e.stack
        ? e.stack.split('\n').find((l) => /pdf\.|pdfjs|worker/i.test(l))?.trim()
        : '';
      text = `[Page ${i} could not be read at ${phase}: ${msg}${frame ? ` @ ${frame.slice(0, 80)}` : ''}]`;
    }
    pages.push({ pageNumber: i, text });
    totalChars += text.length;
  }
  doc.destroy();
  return { pages, title, totalChars };
}
