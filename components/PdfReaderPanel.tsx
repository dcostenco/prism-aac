'use client';
/**
 * PdfReaderPanel — open a PDF, see one tile per page, tap to speak.
 *
 * Closes the "PDF reader" line item from the Reddit r/AAC "free
 * Read & Write alternatives" thread (May 2026). No Adobe Reader, no
 * native plugin — pdfjs-dist runs entirely in the browser, the
 * extracted text is fed into the existing aacSpeak() chain so it
 * gets the same voice + tone + speakOnSentenceEnd parity as the rest
 * of the app.
 */
import { useCallback, useState } from 'react';
// (useEffect imported below alongside the TTS highlight subscriber.)
import { useUIStore } from '@/store/uiStore';
import { useSettingsStore } from '@/store/settingsStore';
import { useMessageStore } from '@/store/messageStore';
import { tapFeedback } from '@/services/feedback';
import { aacSpeak } from '@/services/aacSpeak';
import { extractPdfText, isUnreadable, type PdfPage } from '@/services/pdfReader';
import { runOcrOnPdf } from '@/services/ocr';
import { mathTextToProse, chunkForTts } from '@/services/mathProse';
import { useRef } from 'react';
import { stopSpeech } from '@/services/speechService';
import { subscribeTtsHighlight } from '@/services/ttsHighlightBus';
import { useEffect } from 'react';

interface LoadedPdf {
  title: string;
  fileName: string;
  pages: PdfPage[];
  totalChars: number;
}

export default function PdfReaderPanel() {
  const sidePanel = useUIStore((s) => s.sidePanel);
  const close = useUIStore((s) => s.closeSidePanel);
  const language = useSettingsStore((s) => s.language);
  const { speechRate, speechVolume } = useSettingsStore();
  const activeTone = useMessageStore((s) => s.activeTone);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [doc, setDoc] = useState<LoadedPdf | null>(null);
  // Keep the original File so the OCR-this-PDF inline path can run
  // tesseract on the same bytes without making the user re-pick the
  // file from a second panel.
  const [pdfFile, setPdfFile] = useState<File | null>(null);
  const [ocrLoading, setOcrLoading] = useState(false);
  const [ocrProgress, setOcrProgress] = useState<string>('');
  const [ocrResult, setOcrResult] = useState<string | null>(null);
  // Track whether TTS is currently speaking so the Stop button shows
  // up when there's something to stop. Subscribes to the global
  // TTS highlight bus (services/ttsHighlightBus.ts) which emits
  // start / end events from every speech path (Azure + Web Speech).
  const [isSpeaking, setIsSpeaking] = useState(false);
  useEffect(() => {
    const unsub = subscribeTtsHighlight((ev) => {
      if (ev.type === 'tts-highlight-start') setIsSpeaking(true);
      else if (ev.type === 'tts-highlight-end') setIsSpeaking(false);
    });
    return unsub;
  }, []);

  const stopSpeakingOcr = useCallback(() => {
    tapFeedback();
    // Bump the queue token so any in-flight chunked playback (see
    // speakOcrResult) breaks out of its loop instead of advancing
    // to the next chunk after the current one is interrupted.
    speakSeqRef.current++;
    stopSpeech();
    setIsSpeaking(false);
  }, []);

  const onPick = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setError(null);
    setLoading(true);
    setDoc(null);
    setPdfFile(file);
    setOcrResult(null);
    try {
      const result = await extractPdfText(file);
      setDoc({
        title: result.title || file.name.replace(/\.pdf$/i, ''),
        fileName: file.name,
        pages: result.pages,
        totalChars: result.totalChars,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not read this PDF.');
    } finally {
      setLoading(false);
    }
  }, []);

  /** Run tesseract on the already-loaded PDF (rendered page-by-page
   *  to canvas via pdfjs). Replaces the cross-panel "open OCR capture
   *  and re-pick the same file" detour that the user reported as
   *  not working — the picker filtered to images only and required
   *  the user to navigate Files / Browse to find the same PDF they
   *  already opened in PdfReader. Inline OCR removes that step.
   *  Returns the OCR text on success so callers (e.g. speakAll) can
   *  chain into TTS without waiting for setState to flush. */
  const runInlineOcr = useCallback(async (): Promise<string | null> => {
    if (!pdfFile) return null;
    tapFeedback();
    setError(null);
    setOcrResult(null);
    setOcrLoading(true);
    setOcrProgress('Starting OCR…');
    try {
      // Hook into console.log so the panel can show progress without
      // adding a callback signature to runOcrOnPdf. The service
      // already logs `[ocr-pdf] page N/T → C chars` per page.
      const origLog = console.log;
      console.log = (...args: unknown[]) => {
        const s = args.map((a) => String(a)).join(' ');
        if (/\[ocr-pdf\]/.test(s)) setOcrProgress(s.replace(/^\[ocr-pdf\]\s*/, ''));
        origLog.apply(console, args);
      };
      const out = await runOcrOnPdf(pdfFile, language);
      console.log = origLog;
      if (out.ok) {
        setOcrResult(out.text);
        return out.text;
      }
      setError(out.error);
      return null;
    } catch (e) {
      setError(e instanceof Error ? e.message : 'OCR failed.');
      return null;
    } finally {
      setOcrLoading(false);
      setOcrProgress('');
    }
  }, [pdfFile, language]);

  // Chunk-queue cancellation token — incremented when user taps Stop
  // OR re-taps Speak so any in-flight queue stops feeding new chunks.
  const speakSeqRef = useRef(0);

  /** Split text into TTS-safe chunks (Inworld's /tts/public route returns
   *  HTTP 400 "Text exceeds 500 char limit" on long input — see commit
   *  f81bac3) and queue them sequentially via the tts-highlight-end bus.
   *  Cancellable: stopSpeakingOcr / re-tap bumps speakSeqRef and the
   *  loop exits before queueing the next chunk. */
  const speakChunked = useCallback(async (raw: string) => {
    const prose = mathTextToProse(raw);
    const chunks = chunkForTts(prose, 250);
    const mySeq = ++speakSeqRef.current;
    for (const chunk of chunks) {
      if (mySeq !== speakSeqRef.current) return;
      await new Promise<void>((resolve) => {
        let done = false;
        const finish = () => { if (!done) { done = true; resolve(); } };
        const unsub = subscribeTtsHighlight((ev) => {
          if (ev.type === 'tts-highlight-end') { unsub(); finish(); }
        });
        const budgetMs = Math.min(20_000, 1500 + chunk.length * 50);
        setTimeout(() => { unsub(); finish(); }, budgetMs);
        aacSpeak(chunk, speechRate, speechVolume, activeTone);
      });
    }
  }, [speechRate, speechVolume, activeTone]);

  const speakOcrResult = useCallback(async () => {
    if (!ocrResult) return;
    tapFeedback();
    await speakChunked(ocrResult);
  }, [ocrResult, speakChunked]);

  const speakPage = useCallback((page: PdfPage) => {
    tapFeedback();
    // Refuse to speak the unreadable-page sentinel string — that's
    // diagnostic UI, not content. Without this guard, tapping ▶ on an
    // error tile (or hitting Read all on a doc with errors) read
    // "Page 1 could not be read at getTextContent ..." aloud and felt
    // like a loop the user couldn't escape.
    if (!page.text || isUnreadable(page)) return;
    aacSpeak(page.text, speechRate, speechVolume, activeTone);
  }, [speechRate, speechVolume, activeTone]);

  const speakAll = useCallback(async () => {
    if (!doc || doc.pages.length === 0) return;
    tapFeedback();
    const readable = doc.pages.filter((p) => !isUnreadable(p) && p.text).map((p) => p.text);
    if (readable.length > 0) {
      // Path A: at least one page has a text layer — speak the joined
      // text via the chunked queue (long PDFs would otherwise also hit
      // the 500-char Inworld limit and fall to robotic Web Speech).
      await speakChunked(readable.join(' '));
      return;
    }
    // Path B: image-only PDF. Read all that the user just tapped means
    // "read every page out loud" — but pdfjs got 0 chars from every
    // page. Speak the OCR result if it already exists, else run OCR
    // inline first and then speak. Without this, Read all silently
    // did nothing on scanned/handwritten worksheets (user report
    // 2026-05-08 — see CHANGELOG).
    if (ocrResult) {
      await speakChunked(ocrResult);
      return;
    }
    if (pdfFile) {
      // runInlineOcr returns the freshly OCR'd text directly so we
      // don't need to wait for setOcrResult to flush back into this
      // closure (which it never would until next render).
      const text = await runInlineOcr();
      if (text) await speakChunked(text);
    }
  }, [doc, ocrResult, pdfFile, speakChunked, runInlineOcr]);

  if (sidePanel !== 'pdf-reader') return null;

  // Three layout states (mirroring the AIChatPanel pattern shipped
  // 2026-05-07 from the user's "keyboard should be full" feedback):
  //   1. No doc + no loading + no error → SLIM strip: just the
  //      header with the "+ Open PDF" button. Keyboard underneath
  //      gets its full natural height instead of being squeezed by
  //      a flex-[3] panel claiming space for a single line of intro
  //      copy.
  //   2. Has doc / loading / error → full flex-[3] panel with the
  //      page-list scroll area.
  const hasContent = !!(doc || loading || error);

  if (!hasContent) {
    return (
      <section
        aria-label="PDF reader"
        data-testid="pdf-reader-panel"
        data-state="slim"
        className="shrink-0 surface-bar border-y border-theme"
      >
        <div className="flex items-center justify-between px-3 py-2">
          <div className="flex items-center gap-2">
            <span className="text-xl">📄</span>
            <span className="font-bold">PDF Reader</span>
            <span className="text-xs text-muted hidden sm:inline">— pick a document to hear it spoken</span>
          </div>
          <div className="flex items-center gap-2">
            <label
              data-testid="pdf-reader-pick"
              className="aac-btn rounded-md px-3 py-1.5 text-sm font-bold bg-[#2196F3] text-white cursor-pointer"
            >
              ＋ Open PDF
              <input
                type="file"
                accept="application/pdf,.pdf"
                onChange={onPick}
                className="hidden"
                data-testid="pdf-reader-input"
              />
            </label>
            <button
              onClick={() => { tapFeedback(); close(); }}
              aria-label="Close PDF reader"
              className="aac-btn rounded-md px-2 py-1 text-muted text-lg"
            >×</button>
          </div>
        </div>
      </section>
    );
  }

  return (
    <section
      aria-label="PDF reader"
      data-testid="pdf-reader-panel"
      data-state="expanded"
      className="flex-[3] min-h-0 flex flex-col surface-bar border-y border-theme overflow-hidden"
    >
      <header className="flex items-center justify-between px-3 py-2 border-b border-theme shrink-0">
        <div className="flex items-center gap-2">
          <span className="text-xl">📄</span>
          <span className="font-bold">PDF Reader</span>
          {doc && <span className="text-sm text-muted">— {doc.title} ({doc.pages.length} pages)</span>}
        </div>
        <div className="flex items-center gap-2">
          {doc && (() => {
            const allUnreadable = doc.pages.length > 0 && doc.pages.every((p) => isUnreadable(p) || !p.text);
            const needsOcr = allUnreadable && !ocrResult;
            return (
              <button
                onClick={speakAll}
                disabled={ocrLoading}
                data-testid="pdf-reader-speak-all"
                title={needsOcr ? 'OCR this PDF and read it aloud' : 'Read all pages aloud'}
                className="aac-btn rounded-md px-3 py-1.5 text-sm font-bold bg-[#4CAF50] text-white disabled:opacity-50"
              >
                {needsOcr
                  ? (ocrLoading ? `🔍 ${ocrProgress || 'OCR…'}` : '🔍▶ OCR & Read all')
                  : '▶ Read all'}
              </button>
            );
          })()}
          <label
            data-testid="pdf-reader-pick"
            className="aac-btn rounded-md px-3 py-1.5 text-sm font-bold bg-[#2196F3] text-white cursor-pointer"
          >
            {doc ? '↺ Open another' : '＋ Open PDF'}
            <input
              type="file"
              accept="application/pdf,.pdf"
              onChange={onPick}
              className="hidden"
              data-testid="pdf-reader-input"
            />
          </label>
          <button
            onClick={() => { tapFeedback(); close(); }}
            aria-label="Close PDF reader"
            className="aac-btn rounded-md px-2 py-1 text-muted text-lg"
          >×</button>
        </div>
      </header>

      <div className="flex-1 overflow-y-auto p-3">
        {loading && (
          <p className="text-muted animate-pulse" data-testid="pdf-reader-loading">
            Loading PDF…
          </p>
        )}
        {error && (
          <p className="text-[#F44336]" data-testid="pdf-reader-error">⚠️ {error}</p>
        )}
        {doc && doc.pages.length === 0 && (
          <p className="text-muted" data-testid="pdf-reader-empty">
            This PDF has no readable text — it might be scanned images. Try the OCR tool instead.
          </p>
        )}
        {doc && doc.pages.length > 0 && doc.pages.every((p) => isUnreadable(p) || !p.text) && !ocrResult && (
          <div
            data-testid="pdf-reader-no-text-banner"
            className="border border-[#FF9800] bg-[#FF9800]/10 rounded-lg p-2 mb-3 flex items-center gap-2 flex-wrap"
          >
            <span className="text-xl shrink-0">📷</span>
            <p className="text-sm text-primary flex-1 min-w-[12ch]">
              <span className="font-bold">No text layer.</span>{' '}
              <span className="text-muted">Run OCR to read scanned/handwritten pages.</span>
            </p>
            <button
              onClick={runInlineOcr}
              disabled={ocrLoading || !pdfFile}
              data-testid="pdf-reader-run-ocr"
              className="aac-btn rounded-md px-3 py-1.5 text-sm font-bold bg-[#FF9800] text-white disabled:opacity-50 shrink-0"
            >
              {ocrLoading ? `🔍 ${ocrProgress || 'OCR running…'}` : '🔍 Run OCR'}
            </button>
          </div>
        )}
        {ocrResult && (
          <div
            data-testid="pdf-reader-ocr-result"
            className="border border-[#4CAF50] bg-[#4CAF50]/10 rounded-lg p-3 mb-3"
          >
            <div className="flex items-center justify-between mb-2">
              <p className="font-bold text-primary">📖 OCR result ({ocrResult.length} chars)</p>
              <div className="flex items-center gap-2">
                {isSpeaking ? (
                  <button
                    onClick={stopSpeakingOcr}
                    data-testid="pdf-reader-stop-ocr"
                    className="aac-btn rounded-md px-3 py-1.5 text-sm font-bold bg-[#F44336] text-white"
                  >
                    ■ Stop
                  </button>
                ) : (
                  <button
                    onClick={speakOcrResult}
                    data-testid="pdf-reader-speak-ocr"
                    className="aac-btn rounded-md px-3 py-1.5 text-sm font-bold bg-[#4CAF50] text-white"
                  >
                    ▶ Speak
                  </button>
                )}
              </div>
            </div>
            <p className="text-sm leading-relaxed whitespace-pre-wrap text-primary">{ocrResult}</p>
          </div>
        )}
        {doc && doc.pages.length > 0 && !(ocrResult && doc.pages.every((p) => isUnreadable(p) || !p.text)) && (
          <ul className="space-y-2" data-testid="pdf-reader-page-list">
            {doc.pages.map((page) => (
              <li
                key={page.pageNumber}
                className="border border-theme rounded-lg p-3 surface-key"
                data-testid={`pdf-reader-page-${page.pageNumber}`}
              >
                <div className="flex items-start gap-3">
                  <button
                    onClick={() => speakPage(page)}
                    aria-label={`Read page ${page.pageNumber}`}
                    disabled={isUnreadable(page) || !page.text}
                    className="aac-btn rounded-md px-3 py-1.5 text-sm font-bold bg-[#4CAF50] text-white shrink-0 disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    ▶ Page {page.pageNumber}
                  </button>
                  <p className="text-sm leading-relaxed line-clamp-3 flex-1">
                    {isUnreadable(page) ? (
                      <em className="text-muted">
                        {`(page ${page.pageNumber} couldn’t be read — image-only or unsupported encoding)`}
                      </em>
                    ) : page.text ? (
                      page.text
                    ) : (
                      <em className="text-muted">(empty page — no text layer)</em>
                    )}
                  </p>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}
