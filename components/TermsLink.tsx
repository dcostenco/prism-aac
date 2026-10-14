'use client';

import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { useT } from '@/engine/useT';
import { useUIStore } from '@/store/uiStore';
import { PRISM_AAC_TERMS_PATH } from '@/lib/appPaths';

/** Read the cached document without unloading a composed AAC message. */
export default function TermsLink({ children, className = '' }: { children: ReactNode; className?: string }) {
  const [open, setOpen] = useState(false);
  const frame = useRef<HTMLIFrameElement>(null);
  const { t } = useT();
  const close = useCallback(() => {
    setOpen(false);
    const ui = useUIStore.getState();
    if (ui.showSettings) ui.toggleSettings();
  }, []);
  useEffect(() => {
    if (!open) return;
    const receive = (event: MessageEvent) => {
      if (event.origin === window.location.origin && event.source === frame.current?.contentWindow
        && event.data?.type === 'aac-terms-close') close();
    };
    window.addEventListener('message', receive);
    return () => window.removeEventListener('message', receive);
  }, [open, close]);

  return <>
    <a href={PRISM_AAC_TERMS_PATH} className={`inline-flex min-h-11 items-center ${className}`} onClick={event => {
      if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      event.preventDefault();
      setOpen(true);
    }}>{children}</a>
    {open && createPortal(<div role="dialog" aria-modal="true" aria-label={t('cloud_terms')}
      data-testid="aac-terms-reader" className="fixed inset-0 z-[100] flex flex-col bg-white text-slate-900"
      onKeyDown={event => { if (event.key === 'Escape') { event.stopPropagation(); close(); } }}>
      <div className="flex shrink-0 items-center justify-between gap-3 border-b border-slate-200 px-4 py-2"
        style={{ paddingTop: 'calc(env(safe-area-inset-top, 0px) + 0.5rem)' }}>
        <span className="font-semibold">{t('cloud_terms')}</span>
        <button type="button" autoFocus onClick={close} className="min-h-11 min-w-11 rounded-md border border-slate-300 px-4 font-semibold">{t('close')}</button>
      </div>
      <iframe ref={frame} data-aac-terms-frame="true" data-testid="aac-terms-frame" title={t('cloud_terms')}
        src={PRISM_AAC_TERMS_PATH} className="min-h-0 w-full flex-1 border-0" />
    </div>, document.body)}
  </>;
}
