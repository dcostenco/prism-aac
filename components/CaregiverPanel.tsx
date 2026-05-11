'use client';
import { useState, useCallback, useRef, useEffect } from 'react';
import { useNoteStore } from '@/store/noteStore';
import { useUIStore } from '@/store/uiStore';
import { tapFeedback } from '@/services/feedback';
import { executeAllActions, ActionResult } from '@/engine/caregiverActions';
import { CaregiverNote } from '@/types';
import { parseCaregiverNote } from '@/services/aiService';
import { sanitizeString } from '@/lib/safeStrings';
import { useSettingsStore } from '@/store/settingsStore';
import { useAuthStore } from '@/store/authStore';
import { useT } from '@/engine/useT';

function formatTime(ts: number, lang?: string): string {
  const d = new Date(ts);
  return d.toLocaleString(lang || undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
}

export default function CaregiverPanel() {
  const { sidePanel, closeSidePanel } = useUIStore();
  const { notes, addNote, markApplied, removeNote, authorName, setAuthorName } = useNoteStore();
  const lang = useSettingsStore((s) => s.language);
  const aiEnabled = !!useAuthStore((s) => s.profile);
  const { t } = useT();
  const [input, setInput] = useState('');
  const [results, setResults] = useState<ActionResult[] | null>(null);
  const [tab, setTab] = useState<'add' | 'log'>('add');
  const [parsing, setParsing] = useState(false);
  const mountedRef = useRef(true);
  useEffect(() => {
    mountedRef.current = true;
    return () => { mountedRef.current = false; };
  }, []);

  const handleApplyActions = useCallback(
    (note: CaregiverNote) => {
      tapFeedback();
      const actionResults = executeAllActions(note.actions.filter((a) => a.type !== 'note_only'));
      setResults(actionResults);
      markApplied(note.id);
    },
    [markApplied],
  );

  if (sidePanel !== 'caregiver') return null;

  const handleSubmitNote = async () => {
    if (!input.trim()) return;
    if (input.trim().length > 2000) return; // already capped by textarea
    tapFeedback();

    if (aiEnabled) {
      setParsing(true);
      try {
        const parsed = await parseCaregiverNote(input.trim());
        if (!mountedRef.current) return;
        addNote(input.trim(), parsed.actions);
      } catch {
        if (!mountedRef.current) return;
        addNote(input.trim());
      }
      if (!mountedRef.current) return;
      setParsing(false);
    } else {
      addNote(input.trim());
    }
    setInput('');
    setResults(null);
  };

  const btn = 'aac-btn surface-key text-primary rounded-xl p-3 font-bold text-xl md:text-2xl select-none text-center border border-theme';

  return (
    <section
      aria-label={t('caregiver_notes')}
      className="flex-[3] min-h-0 flex flex-col surface-bar border-y border-theme"
    >
      <div className="flex items-center justify-between px-4 py-3 border-b border-theme shrink-0">
        <span className="text-primary font-bold text-2xl md:text-3xl">📋 {t('caregiver_notes')}</span>
        <button onClick={() => { tapFeedback(); closeSidePanel(); }} aria-label={t('close_panel')} className="aac-btn w-12 h-12 rounded-xl surface-key text-muted text-2xl flex items-center justify-center border border-theme">✕</button>
      </div>

      <div className="flex border-b border-theme shrink-0">
        <button onClick={() => setTab('add')} className={`flex-1 py-3 text-lg md:text-xl font-bold ${tab === 'add' ? 'text-[#4CAF50] border-b-2 border-[#4CAF50]' : 'text-muted'}`}>
          + {t('add_note')}
        </button>
        <button onClick={() => setTab('log')} className={`flex-1 py-3 text-lg md:text-xl font-bold ${tab === 'log' ? 'text-[#4CAF50] border-b-2 border-[#4CAF50]' : 'text-muted'}`}>
          {t('log')} ({notes.length})
        </button>
      </div>

      {tab === 'add' ? (
        <div className="flex-1 min-h-0 flex flex-col p-4 gap-3 overflow-y-auto">
          <div>
            <label className="text-muted text-base font-bold block mb-1">{t('your_name')}</label>
            <input
              value={authorName}
              onChange={(e) => setAuthorName(sanitizeString(e.target.value, 100))}
              placeholder={t('role_placeholder')}
              maxLength={100}
              className="w-full surface-key rounded-lg px-3 py-3 text-primary text-lg border border-theme"
            />
          </div>

          <div className="flex-1 flex flex-col">
            <label className="text-muted text-base font-bold block mb-1">{t('note_instruction')}</label>
            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder={t('note_examples')}
              className="flex-1 min-h-[120px] surface-key rounded-lg px-3 py-2 text-primary text-lg resize-none border border-theme"
              maxLength={2000}
            />
          </div>

          <button onClick={handleSubmitNote} disabled={!input.trim() || parsing} className={`${btn} py-4 ${input.trim() && !parsing ? 'bg-[#4CAF50] text-white border-transparent' : 'opacity-40'}`}>
            {parsing ? t('parsing') : aiEnabled ? t('save_parse') : t('save_note')}
          </button>

          {results && (
            <div className="space-y-1">
              {results.map((r, i) => (
                <div key={i} className={`text-base px-2 py-1 rounded ${r.success ? 'text-[#2e7d32] bg-[#d4edda]' : 'text-[#c62828] bg-[#fdecea]'}`}>
                  {r.success ? '✓' : '✕'} {r.message}
                </div>
              ))}
            </div>
          )}

          <div className="text-dim text-base leading-relaxed">
            {aiEnabled
              ? t('ai_parse_help')
              : t('sign_in_parse_help')}
          </div>
        </div>
      ) : (
        <div className="flex-1 min-h-0 overflow-y-auto p-3">
          {notes.length === 0 ? (
            <p className="text-muted text-center py-8 text-xl">{t('no_notes_yet')}</p>
          ) : (
            <div className="flex flex-col gap-2">
              {notes.map((note) => (
                <div key={note.id} className="surface-key rounded-xl p-3 border border-theme">
                  <p className="text-primary text-lg">{note.text}</p>
                  <div className="flex items-center justify-between mt-2">
                    <div className="text-dim text-base">
                      {note.authorName && <span className="text-muted">{note.authorName} · </span>}
                      {formatTime(note.timestamp, lang)}
                    </div>
                    <div className="flex gap-2 items-center">
                      {note.actions.some((a) => a.type !== 'note_only') && !note.applied && (
                        <button onClick={() => handleApplyActions(note)} className="text-[#4CAF50] text-base font-bold hover:underline">{t('apply')}</button>
                      )}
                      {note.applied && <span className="text-[#4CAF50] text-base">✓ {t('applied')}</span>}
                      <button onClick={() => { tapFeedback(); removeNote(note.id); }} className="text-[#F44336] text-base hover:underline ml-2">{t('delete')}</button>
                    </div>
                  </div>
                  {note.actions.filter((a) => a.type !== 'note_only').length > 0 && (
                    <div className="mt-2 space-y-1">
                      {note.actions
                        .filter((a) => a.type !== 'note_only')
                        .map((a, i) => (
                          <div key={i} className="text-base text-muted surface-bar rounded px-2 py-1 border border-theme">
                            {a.description}
                          </div>
                        ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </section>
  );
}
