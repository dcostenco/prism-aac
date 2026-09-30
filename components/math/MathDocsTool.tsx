'use client';
/**
 * MathDocsTool — Phase 5B UI.
 *
 * Save / Open buttons + a small dropdown for browsing saved docs and
 * exporting portable image, PDF, and Prism Math files.
 * Wired to the local-first mathDocService — saves and lists go to
 * localStorage; portal sync arrives in a follow-up.
 *
 * Save UX:
 *   • Tapping 💾 saves the current grid under the most recent doc
 *     name (or "Untitled <n>" if it's a fresh session).
 *   • A toast confirms ("Saved as <name>").
 *
 * Open UX:
 *   • Tapping 📂 opens a small overlay with the list of saved docs
 *     (newest first), each as a click-to-load row.
 *   • Each row has an inline "×" to delete.
 *   • Tapping a row loads its body into the math grid store.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { useMathGridStore } from '@/store/mathGridStore';
import {
  saveDoc,
  loadDoc,
  listDocs,
  deleteDoc,
  pullFromPortal,
  type MathDoc,
} from '@/services/mathDocService';
import { tapFeedback, keyFeedback } from '@/services/feedback';
import {
  copyMathGridImage,
  MAX_MATH_DOCUMENT_BYTES,
  parseMathDocumentFile,
  pickMathGridFile,
  saveMathGridFile,
  saveMathGridPdf,
} from '@/services/mathExport';

const TOOL_BTN =
  'aac-btn rounded-lg px-3 py-2 text-sm font-bold border min-h-[44px] ' +
  'flex items-center justify-center';

export default function MathDocsTool() {
  const [open, setOpen] = useState(false);
  const [docs, setDocs] = useState<MathDoc[]>([]);
  const [currentSlug, setCurrentSlug] = useState<string | null>(null);
  const [currentName, setCurrentName] = useState<string>('');
  const [toast, setToast] = useState<string | null>(null);
  const [syncing, setSyncing] = useState(false);
  const restoreInputRef = useRef<HTMLInputElement>(null);

  const toSerialized = useMathGridStore((s) => s.toSerialized);
  const loadFromSerialized = useMathGridStore((s) => s.loadFromSerialized);
  const reset = useMathGridStore((s) => s.reset);

  useEffect(() => {
    setDocs(listDocs());
  }, [open]);

  // Auto-clear toast after 2.5s.
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 2500);
    return () => clearTimeout(t);
  }, [toast]);

  const handleSave = useCallback(() => {
    tapFeedback();
    const body = toSerialized();
    if (body.cells.length === 0) {
      setToast('Nothing to save — grid is empty.');
      return;
    }
    const name = currentName || `Untitled ${new Date().toLocaleDateString()}`;
    const saved = saveDoc(name, body, currentSlug ?? undefined);
    if (!saved) {
      setToast('Save failed (doc too large or storage full).');
      return;
    }
    setCurrentSlug(saved.slug);
    setCurrentName(saved.name);
    setToast(`Saved as ${saved.name}`);
    setDocs(listDocs());
  }, [toSerialized, currentName, currentSlug]);

  const handleOpen = useCallback((slug: string) => {
    keyFeedback();
    const doc = loadDoc(slug);
    if (!doc) {
      setToast('Doc not found.');
      return;
    }
    loadFromSerialized(doc.body);
    setCurrentSlug(doc.slug);
    setCurrentName(doc.name);
    setOpen(false);
    setToast(`Opened ${doc.name}`);
  }, [loadFromSerialized]);

  const handleSync = useCallback(async () => {
    if (syncing) return;
    tapFeedback();
    setSyncing(true);
    const merged = await pullFromPortal();
    setSyncing(false);
    if (merged === null) {
      setToast('Sync failed — sign in to Synalux to sync docs.');
      return;
    }
    setDocs(merged);
    setToast(`Synced ${merged.length} doc${merged.length === 1 ? '' : 's'}.`);
  }, [syncing]);

  const handleCopyImage = useCallback(async () => {
    tapFeedback();
    const body = toSerialized();
    if (body.cells.length === 0) {
      setToast('Nothing to export — grid is empty.'); // i18n-exempt
      return;
    }
    try {
      const result = await copyMathGridImage(body);
      setOpen(false);
      setToast(result === 'copied' ? 'Copied math image.' : result === 'saved' ? 'Saved math image.' : 'Downloaded math image.'); // i18n-exempt
    } catch (error) {
      if ((error as DOMException)?.name !== 'AbortError') setToast('Could not export the math image.'); // i18n-exempt
    }
  }, [toSerialized]);

  const handlePdf = useCallback(async () => {
    tapFeedback();
    const body = toSerialized();
    if (body.cells.length === 0) {
      setToast('Nothing to export — grid is empty.'); // i18n-exempt
      return;
    }
    try {
      const result = await saveMathGridPdf(body, currentName || 'prism-math');
      setOpen(false);
      setToast(result === 'saved' ? 'Saved PDF.' : 'Downloaded PDF.'); // i18n-exempt
    } catch (error) {
      if ((error as DOMException)?.name !== 'AbortError') setToast('Could not save the PDF.'); // i18n-exempt
    }
  }, [currentName, toSerialized]);

  const handleSaveFile = useCallback(async () => {
    tapFeedback();
    const body = toSerialized();
    if (body.cells.length === 0) {
      setToast('Nothing to save — grid is empty.'); // i18n-exempt
      return;
    }
    try {
      const result = await saveMathGridFile(body, currentName || 'prism-math');
      setOpen(false);
      setToast(result === 'saved' ? 'Saved math file.' : 'Downloaded math file.'); // i18n-exempt
    } catch (error) {
      if ((error as DOMException)?.name !== 'AbortError') setToast('Could not save the math file.'); // i18n-exempt
    }
  }, [currentName, toSerialized]);

  const applyRestored = useCallback((document: ReturnType<typeof parseMathDocumentFile>) => {
    if (!document) {
      setToast('That file is not a valid Prism Math document.'); // i18n-exempt
      return;
    }
    loadFromSerialized(document.body);
    setCurrentSlug(null);
    setCurrentName(document.name);
    setOpen(false);
    setToast('Restored math file.'); // i18n-exempt
  }, [loadFromSerialized]);

  const handleRestore = useCallback(async () => {
    tapFeedback();
    try {
      const document = await pickMathGridFile();
      if (document === undefined) {
        restoreInputRef.current?.click();
        return;
      }
      if (document) applyRestored(document);
    } catch (error) {
      setToast((error as Error)?.message === 'invalid-math-file' ? 'That file is not a valid Prism Math document.' : 'Could not open the math file.'); // i18n-exempt
    }
  }, [applyRestored]);

  const handleRestoreInput = useCallback(async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    if (file.size > MAX_MATH_DOCUMENT_BYTES) {
      setToast('That math file is too large.'); // i18n-exempt
      return;
    }
    try {
      applyRestored(parseMathDocumentFile(await file.text()));
    } catch {
      setToast('Could not open the math file.'); // i18n-exempt
    }
  }, [applyRestored]);

  const handleDelete = useCallback((slug: string) => {
    keyFeedback();
    if (!deleteDoc(slug)) return;
    setDocs(listDocs());
    if (slug === currentSlug) {
      setCurrentSlug(null);
      setCurrentName('');
      reset();
    }
    setToast('Deleted.');
  }, [currentSlug, reset]);

  return (
    <div className="relative" data-testid="math-docs-tool">
      <div className="flex items-center gap-1.5">
        <button
          onClick={handleSave}
          data-testid="math-docs-save"
          aria-label="Save math doc"
          className={`${TOOL_BTN} bg-[#2196F3] text-white border-transparent`}
        >
          💾 Save
        </button>
        <button
          onClick={() => { tapFeedback(); setOpen((v) => !v); }}
          data-testid="math-docs-open-toggle"
          aria-expanded={open}
          aria-label="Open saved math doc"
          className={`${TOOL_BTN} surface-key text-primary border-theme`}
        >
          📂 Open
        </button>
      </div>

      {open && (
        <div
          className="absolute right-0 top-full mt-2 w-72 max-h-72 overflow-y-auto surface-bar border border-theme rounded-xl shadow-xl z-50"
          data-testid="math-docs-list"
        >
          <div className="flex items-center justify-between px-3 pt-2">
            <p className="text-muted text-xs font-bold">SAVED DOCS</p>
            <button
              onClick={handleSync}
              disabled={syncing}
              data-testid="math-docs-sync"
              aria-label="Sync from cloud"
              className="text-muted text-xs px-2 py-0.5 rounded hover:bg-black/5 disabled:opacity-40"
            >
              {syncing ? '…' : '↻ Sync'}
            </button>
          </div>
          <div className="grid grid-cols-2 gap-2 px-3 py-2 border-b border-theme">
            <button
              type="button"
              onClick={handleCopyImage}
              data-testid="math-docs-copy-image"
              aria-label="Copy current math as an image"
              className={`${TOOL_BTN} surface-key text-primary border-theme`}
            >
              <span data-testid="math-docs-copy-image-label">🖼 Copy Image</span> {/* i18n-exempt */}
            </button>
            <button
              type="button"
              onClick={handlePdf}
              data-testid="math-docs-save-pdf"
              aria-label="Save current math as PDF"
              className={`${TOOL_BTN} surface-key text-primary border-theme`}
            >
              <span data-testid="math-docs-save-pdf-label">📄 Save PDF</span> {/* i18n-exempt */}
            </button>
            <button
              type="button"
              onClick={handleSaveFile}
              data-testid="math-docs-save-file"
              aria-label="Save math document to a file"
              className={`${TOOL_BTN} surface-key text-primary border-theme`}
            >
              <span data-testid="math-docs-save-file-label">💾 Save File</span> {/* i18n-exempt */}
            </button>
            <button
              type="button"
              onClick={handleRestore}
              data-testid="math-docs-restore-file"
              aria-label="Restore math document from a file"
              className={`${TOOL_BTN} surface-key text-primary border-theme`}
            >
              <span data-testid="math-docs-restore-file-label">📂 Restore</span> {/* i18n-exempt */}
            </button>
            <input
              ref={restoreInputRef}
              type="file"
              accept=".prism-math.json,.json,application/json"
              onChange={handleRestoreInput}
              className="hidden"
              data-testid="math-docs-restore-input"
            />
          </div>
          {docs.length === 0 ? (
            <p className="text-muted text-xs px-3 py-3">No saved docs yet.</p>
          ) : (
            <ul className="py-1">
              {docs.map((d) => (
                <li
                  key={d.slug}
                  className="flex items-center gap-2 px-3 py-2 hover:bg-black/5"
                  data-testid={`math-docs-row-${d.slug}`}
                >
                  <button
                    onClick={() => handleOpen(d.slug)}
                    data-testid={`math-docs-load-${d.slug}`}
                    className="flex-1 text-left"
                  >
                    <span className="text-primary text-sm font-bold block truncate">{d.name}</span>
                    <span className="text-muted text-[10px] block">
                      {new Date(d.updatedAt).toLocaleString()}
                    </span>
                  </button>
                  <button
                    onClick={() => handleDelete(d.slug)}
                    data-testid={`math-docs-delete-${d.slug}`}
                    aria-label={`Delete ${d.name}`}
                    className="aac-btn w-7 h-7 rounded-md bg-[#F44336] text-white text-xs"
                  >
                    ×
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {toast && (
        <div
          role="status"
          className="absolute right-0 top-full mt-2 surface-bar border border-theme rounded-lg px-3 py-1.5 text-xs text-primary shadow-lg z-50 whitespace-nowrap"
          data-testid="math-docs-toast"
        >
          {toast}
        </div>
      )}
    </div>
  );
}
