'use client';
/**
 * In-app Help: caregiver-facing topics, opened from the Settings header and
 * shown over Settings, never over the communication board. Topics are bundled
 * UI strings, so they work offline and in the user's language; the footer
 * links the full web guide and support.
 */
import { useMemo, useState } from 'react';
import { useT } from '@/engine/useT';
import { HELP_TOPICS, SUPPORT_EMAIL, helpBodyKey, helpTitleKey } from '@/constants/helpTopics';
import { PRISM_AAC_USER_GUIDE_URL } from '@/lib/appPaths';

export default function HelpModal({ onClose }: { onClose: () => void }) {
  const { t } = useT();
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState<string | null>(null);
  const topics = useMemo(() => {
    const needle = query.trim().toLocaleLowerCase();
    return HELP_TOPICS
      .map(topic => ({ ...topic, title: t(helpTitleKey(topic.id)), body: t(helpBodyKey(topic.id)) }))
      .filter(topic => !needle || `${topic.title}\n${topic.body}`.toLocaleLowerCase().includes(needle));
  }, [query, t]);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="help-title"
      data-testid="help-modal"
      className="modal-backdrop fixed inset-0 bg-black/60 z-[60] flex items-center justify-center p-4"
      onKeyDown={(e) => { if (e.key === 'Escape') { e.stopPropagation(); onClose(); } }}
      tabIndex={-1}
    >
      {/* Like Settings, only ✕ closes Help: dwell-click drift must not. */}
      <div className="surface-bar rounded-2xl w-full max-w-lg md:max-w-2xl max-h-[90svh] flex flex-col border border-theme shadow-2xl">
        <div className="flex items-center justify-between px-5 py-3 border-b border-theme shrink-0">
          <h2 id="help-title" className="text-primary font-bold text-lg"><span aria-hidden="true">❓</span> {t('help_title')}</h2>
          <button onClick={onClose} aria-label={t('help_close')} className="min-h-11 min-w-11 text-muted hover:text-primary text-xl px-1">✕</button>
        </div>
        <div className="px-3 pt-3 shrink-0">
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={`🔍 ${t('help_search')}`}
            aria-label={t('help_search')}
            className="w-full min-h-11 rounded-xl border border-theme surface-key px-3 text-primary text-sm"
          />
        </div>
        <div className="flex-1 overflow-y-auto p-3 space-y-2">
          {topics.length === 0 && <p className="text-muted text-sm px-2">{t('help_no_results')}</p>}
          {topics.map(topic => {
            const expanded = open === topic.id || (query.trim() !== '' && topics.length === 1);
            return (
              <section key={topic.id} className="rounded-xl border border-theme">
                <button
                  onClick={() => setOpen(expanded ? null : topic.id)}
                  aria-expanded={expanded}
                  data-testid={`help-topic-${topic.id}`}
                  className="aac-btn w-full min-h-11 flex items-center justify-between px-4 py-3 text-left text-primary font-semibold"
                >
                  <span>{topic.title}</span>
                  <span aria-hidden="true" className="text-muted">{expanded ? '▴' : '▾'}</span>
                </button>
                {expanded && (
                  <div className="px-4 pb-3 space-y-1.5 text-primary text-sm" data-testid={`help-body-${topic.id}`}>
                    {topic.body.split('\n').filter(Boolean).map((line, index) => <p key={index}>{line}</p>)}
                  </div>
                )}
              </section>
            );
          })}
        </div>
        <div className="flex flex-wrap items-center justify-between gap-2 px-5 py-3 border-t border-theme shrink-0 text-sm">
          <a href={PRISM_AAC_USER_GUIDE_URL} target="_blank" rel="noopener noreferrer" data-testid="help-full-guide"
            className="inline-flex min-h-11 items-center gap-1 font-semibold text-[#2563eb] hover:underline">
            <span aria-hidden="true">📘</span> {t('help_full_guide')} <span aria-hidden="true">↗</span>
          </a>
          <a href={`mailto:${SUPPORT_EMAIL}`} data-testid="help-support"
            className="inline-flex min-h-11 items-center gap-1 font-semibold text-[#2563eb] hover:underline">
            <span aria-hidden="true">✉</span> {t('help_support')}
          </a>
        </div>
      </div>
    </div>
  );
}
