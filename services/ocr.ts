'use client';
/**
 * ocr — extract text from an image via Tesseract.js.
 *
 * tesseract.js is dynamic-imported so the ~3 MB worker + the per-
 * language data (~10 MB for English, more for CJK) only download
 * when the user opens the OCR panel for the first time. Subsequent
 * runs in the same session reuse the worker.
 *
 * Used by the OCR Capture panel — the AAC user uploads or pastes a
 * screenshot of a worksheet, the recognized text drops into the
 * message bar, and they tap Speak to hear it. One of the secondary
 * features in the Reddit r/AAC "free Read & Write alternatives"
 * thread (May 2026) — not as critical as speak-on-sentence-end and
 * word highlight, but a useful classroom tool.
 */

export interface OcrSuccess {
  ok: true;
  text: string;
  /** Average character-level confidence (0..100). */
  confidence: number;
}

export interface OcrFailure {
  ok: false;
  error: string;
}

export type OcrResult = OcrSuccess | OcrFailure;

type TesseractWorker = {
  recognize: (image: File | Blob | string) => Promise<{
    data: { text: string; confidence: number };
  }>;
  terminate: () => Promise<void>;
};

type TesseractModule = {
  createWorker: (lang: string) => Promise<TesseractWorker>;
};

// Cap to 2 concurrent Tesseract workers — each uses ~50-100 MB WASM memory.
// Evict the LRU (first entry) when the cap is exceeded.
const MAX_OCR_WORKERS = 2;
let workerByLang = new Map<string, TesseractWorker>();
let initPromiseByLang = new Map<string, Promise<TesseractWorker>>();
let mod: TesseractModule | null = null;

async function getModule(): Promise<TesseractModule> {
  if (mod) return mod;
  mod = (await import('tesseract.js')) as unknown as TesseractModule;
  return mod;
}

async function getWorker(lang: string): Promise<TesseractWorker> {
  const cached = workerByLang.get(lang);
  if (cached) return cached;
  const inflight = initPromiseByLang.get(lang);
  if (inflight) return inflight;
  const promise = (async () => {
    const tesseract = await getModule();
    // Evict LRU worker if at capacity
    if (workerByLang.size >= MAX_OCR_WORKERS) {
      const lruKey = workerByLang.keys().next().value;
      if (lruKey !== undefined) {
        try { await workerByLang.get(lruKey)!.terminate(); } catch { /* */ }
        workerByLang.delete(lruKey);
      }
    }
    const worker = await tesseract.createWorker(lang);
    workerByLang.set(lang, worker);
    initPromiseByLang.delete(lang);
    return worker;
  })();
  initPromiseByLang.set(lang, promise);
  return promise;
}

/** Map a PrismAAC language code to a Tesseract traineddata code.
 *  Tesseract uses ISO 639-2/B (3-letter) codes; not every PrismAAC
 *  locale has a direct mapping (e.g. zh has zh-Hans / zh-Hant). */
const TESSERACT_LANG_MAP: Record<string, string> = {
  en: 'eng', es: 'spa', fr: 'fra', pt: 'por', de: 'deu',
  ro: 'ron', uk: 'ukr', ru: 'rus', ja: 'jpn', ko: 'kor',
  zh: 'chi_sim', ar: 'ara', it: 'ita', pl: 'pol', nl: 'nld',
  he: 'heb', hi: 'hin', vi: 'vie', tr: 'tur', id: 'ind',
};

export function tesseractCodeFor(lang: string): string {
  const base = (lang || 'en').toLowerCase().split(/[-_]/)[0];
  return TESSERACT_LANG_MAP[base] ?? 'eng';
}

export async function runOcr(
  image: File | Blob | string,
  lang: string = 'en',
): Promise<OcrResult> {
  if (!image) {
    return { ok: false, error: 'No image to read.' };
  }
  try {
    const worker = await getWorker(tesseractCodeFor(lang));
    const result = await worker.recognize(image);
    const text = (result.data.text || '').trim();
    if (!text) {
      return { ok: false, error: 'No readable text found in this image.' };
    }
    return { ok: true, text, confidence: Math.round(result.data.confidence) };
  } catch (e) {
    const raw = e instanceof Error ? e.message : String(e);
    return { ok: false, error: friendlyOcrError(raw) };
  }
}

/**
 * OCR every page of a PDF. Renders each page to an off-screen canvas
 * via pdfjs, then runs tesseract on the canvas. Used by the OCR
 * Capture panel when the user picks a .pdf file (and as the fallback
 * the PDF Reader links to when the document has no text layer —
 * e.g. handwritten / scanned classroom workflow PDFs).
 *
 * Slower than text extraction (each page is a full image-recognition
 * pass), so we log progress to the console as we go.
 */
export async function runOcrOnPdf(
  file: File,
  lang: string = 'en',
): Promise<OcrResult> {
  if (!file) return { ok: false, error: 'No PDF to read.' };
  try {
    const pdfjs = await import('pdfjs-dist');
    // Resolve the worker from the installed npm package via Next.js/Webpack
    // URL bundling. The resulting URL is content-hashed and served locally,
    // eliminating any CDN dependency or SRI risk at runtime.
    pdfjs.GlobalWorkerOptions.workerSrc = new URL(
      'pdfjs-dist/build/pdf.worker.min.mjs',
      import.meta.url,
    ).toString();
    const buf = await file.arrayBuffer();
    const doc = await pdfjs.getDocument({ data: buf }).promise;
    const lines: string[] = [];
    let totalConf = 0;
    let confSamples = 0;
    for (let i = 1; i <= doc.numPages; i++) {
      if (process.env.NODE_ENV !== 'production') console.log(`[ocr-pdf] page ${i}/${doc.numPages} rendering…`);
      const page = await doc.getPage(i);
      // Render at 2x scale so tesseract gets enough pixel density to
      // recognize handwritten + small print reliably. 1x is too low
      // for AAC-grade scanned worksheet PDFs.
      const viewport = page.getViewport({ scale: 2 });
      const canvas = document.createElement('canvas');
      canvas.width = Math.ceil(viewport.width);
      canvas.height = Math.ceil(viewport.height);
      const context = canvas.getContext('2d');
      if (!context) continue;
      await page.render({ canvasContext: context, viewport, canvas } as Parameters<typeof page.render>[0]).promise;
      page.cleanup();
      // Convert canvas to Blob for tesseract input.
      const blob: Blob | null = await new Promise((res) => canvas.toBlob((b) => res(b), 'image/png'));
      canvas.width = 0;
      canvas.height = 0;
      if (!blob) { lines.push(`[page ${i}: render failed]`); continue; }
      const out = await runOcr(blob, lang);
      if (out.ok) {
        lines.push(out.text);
        totalConf += out.confidence;
        confSamples++;
        if (process.env.NODE_ENV !== 'production') console.log(`[ocr-pdf] page ${i} → ${out.text.length} chars, conf ${out.confidence}`);
      } else {
        if (process.env.NODE_ENV !== 'production') console.log(`[ocr-pdf] page ${i} OCR failed: ${out.error}`);
      }
    }
    doc.destroy();
    const text = lines.join('\n\n').trim();
    if (!text) return { ok: false, error: 'No readable text found across all pages — try a higher-resolution scan.' };
    return {
      ok: true,
      text,
      confidence: confSamples > 0 ? Math.round(totalConf / confSamples) : 0,
    };
  } catch (e) {
    const raw = e instanceof Error ? e.message : String(e);
    return { ok: false, error: friendlyOcrError(raw) };
  }
}

/** Cleanup hook for tests / page unload. Tesseract workers hold
 *  WebAssembly memory; freeing them when nobody's using OCR is
 *  polite to the AAC user's RAM-constrained device. */
export async function disposeOcr(): Promise<void> {
  const workers = Array.from(workerByLang.values());
  workerByLang = new Map();
  initPromiseByLang = new Map();
  await Promise.all(workers.map((w) => w.terminate().catch(() => {})));
}

if (typeof window !== 'undefined') {
  window.addEventListener('pagehide', () => { disposeOcr().catch(() => {}); });
}

function friendlyOcrError(raw: string): string {
  if (/network|fetch|cdn/i.test(raw)) {
    return "Couldn't load the OCR model — check your internet connection.";
  }
  if (/memory|allocation|heap/i.test(raw)) {
    return 'Image is too large for OCR — try a smaller crop.';
  }
  return raw.length > 100 ? raw.slice(0, 97) + '…' : raw;
}
