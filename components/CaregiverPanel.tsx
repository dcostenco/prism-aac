'use client';
import { useState, useCallback } from 'react';
import { useNoteStore } from '@/store/noteStore';
import { useUIStore } from '@/store/uiStore';
import { tapFeedback } from '@/services/feedback';
import { executeAllActions, ActionResult } from '@/engine/caregiverActions';
import { NoteAction, CaregiverNote } from '@/types';
import { parseCaregiverNote, hasApiKey } from '@/services/aiService';

/**
 * Caregiver Notes Panel
 *
 * Slides in from the left (same as categories/math).
 * Two modes:
 *   1. ADD NOTE — type a note, optionally with parsed actions
 *   2. VIEW LOG — scrollable list of all past notes with timestamps
 *
 * REAL-WORLD USAGE:
 *   BCBA opens panel → types "Move bathroom to top of help" →
 *   sees preview: [Reorder: Move "Bathroom" to position 1] →
 *   taps [Apply] → note saved with action, phrase reordered →
 *   continues session
 */

function formatTime(ts: number): string {
  const d = new Date(ts);
  return d.toLocaleString(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
}

export default function CaregiverPanel() {
  const { sidePanel, closeSidePanel } = useUIStore();
  const { notes, addNote, markApplied, removeNote, authorName, setAuthorName } = useNoteStore();
  const [input, setInput] = useState('');
  const [results, setResults] = useState<ActionResult[] | null>(null);
  const [tab, setTab] = useState<'add' | 'log'>('add');

  if (sidePanel !== 'caregiver') return null;

  const [parsing, setParsing] = useState(false);

  const handleSubmitNote = useCallback(async () => {
    if (!input.trim()) return;
    tapFeedback();

    if (hasApiKey()) {
      setParsing(true);
      try {
        const parsed = await parseCaregiverNote(input.trim());
        addNote(input.trim(), parsed.actions);
      } catch {
        addNote(input.trim());
      }
      setParsing(false);
    } else {
      addNote(input.trim());
    }
    setInput('');
    setResults(null);
  }, [input, addNote]);

  const handleApplyActions = useCallback((note: CaregiverNote) => {
    tapFeedback();
    const actionResults = executeAllActions(note.actions.filter(a => a.type !== 'note_only'));
    setResults(actionResults);
    markApplied(note.id);
  }, [markApplied]);

  const btn = 'aac-btn bg-[#2a2a3e] rounded-xl p-3 text-[#e0e0e0] font-medium select-none text-center';

  return (
    <div className="w-[320px] bg-[#16162a] border-r border-[#2a2a3e] flex flex-col shrink-0">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-[#2a2a3e]">
        <span className="text-[#888] font-semibold text-sm">Caregiver Notes</span>
        <button onClick={() => { tapFeedback(); closeSidePanel(); }} aria-label="Close panel" className="aac-btn w-11 h-11 rounded-xl bg-[#2a2a3e] text-[#aaa] text-lg flex items-center justify-center">✕</button>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-[#2a2a3e]">
        <button onClick={() => setTab('add')} className={`flex-1 py-2.5 text-sm font-semibold ${tab === 'add' ? 'text-[#4CAF50] border-b-2 border-[#4CAF50]' : 'text-[#666]'}`}>
          + Add Note
        </button>
        <button onClick={() => setTab('log')} className={`flex-1 py-2.5 text-sm font-semibold ${tab === 'log' ? 'text-[#4CAF50] border-b-2 border-[#4CAF50]' : 'text-[#666]'}`}>
          Log ({notes.length})
        </button>
      </div>

      {tab === 'add' ? (
        <div className="flex-1 flex flex-col p-3 gap-3 overflow-y-auto">
          {/* Author name */}
          <div>
            <label className="text-[#666] text-xs font-semibold block mb-1">Your name</label>
            <input
              value={authorName}
              onChange={(e) => setAuthorName(e.target.value)}
              placeholder="BCBA / Therapist / Parent"
              className="w-full bg-[#2a2a3e] rounded-lg px-3 py-2 text-[#e0e0e0] text-sm placeholder-[#555]"
            />
          </div>

          {/* Note input */}
          <div className="flex-1">
            <label className="text-[#666] text-xs font-semibold block mb-1">Note or instruction</label>
            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder={"Examples:\n• Move bathroom to top of Help\n• Add McDonald's ordering flow\n• He used 'because' 5 times today\n• Good session, 15 phrases independently"}
              className="w-full h-32 bg-[#2a2a3e] rounded-lg px-3 py-2 text-[#e0e0e0] text-sm placeholder-[#555] resize-none"
            />
          </div>

          <button onClick={handleSubmitNote} disabled={!input.trim() || parsing} className={`${btn} ${input.trim() && !parsing ? 'bg-[#4CAF50] text-white' : 'opacity-40'}`}>
            {parsing ? 'Parsing...' : hasApiKey() ? 'Save & Parse' : 'Save Note'}
          </button>

          {/* Action results feedback */}
          {results && (
            <div className="space-y-1">
              {results.map((r, i) => (
                <div key={i} className={`text-xs px-2 py-1 rounded ${r.success ? 'text-[#4CAF50] bg-[#1b3a1b]' : 'text-[#F44336] bg-[#3a1b1b]'}`}>
                  {r.success ? '✓' : '✕'} {r.message}
                </div>
              ))}
            </div>
          )}

          {/* Quick instruction hint */}
          <div className="text-[#444] text-xs leading-relaxed">
            {hasApiKey()
              ? 'AI will parse your instructions and suggest actions. You confirm before anything changes.'
              : 'Add a Gemini API key in Settings to enable AI-powered note parsing.'}
          </div>
        </div>
      ) : (
        <div className="flex-1 overflow-y-auto p-2">
          {notes.length === 0 ? (
            <p className="text-[#555] text-center py-8 text-sm">No notes yet</p>
          ) : (
            <div className="flex flex-col gap-2">
              {notes.map((note) => (
                <div key={note.id} className="bg-[#1e1e2e] rounded-xl p-3">
                  <p className="text-[#e0e0e0] text-sm">{note.text}</p>
                  <div className="flex items-center justify-between mt-2">
                    <div className="text-[#555] text-xs">
                      {note.authorName && <span className="text-[#888]">{note.authorName} · </span>}
                      {formatTime(note.timestamp)}
                    </div>
                    <div className="flex gap-1">
                      {note.actions.some(a => a.type !== 'note_only') && !note.applied && (
                        <button onClick={() => handleApplyActions(note)} className="text-[#4CAF50] text-xs font-semibold hover:underline">Apply</button>
                      )}
                      {note.applied && <span className="text-[#4CAF50] text-xs">✓ Applied</span>}
                      <button onClick={() => { tapFeedback(); removeNote(note.id); }} className="text-[#F44336] text-xs hover:underline ml-2">Delete</button>
                    </div>
                  </div>
                  {/* Show actions if any */}
                  {note.actions.filter(a => a.type !== 'note_only').length > 0 && (
                    <div className="mt-2 space-y-1">
                      {note.actions.filter(a => a.type !== 'note_only').map((a, i) => (
                        <div key={i} className="text-xs text-[#888] bg-[#2a2a3e] rounded px-2 py-1">
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
    </div>
  );
}
