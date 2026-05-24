/**
 * noteStore — action paths not covered by note-store-hardening.test.ts
 *
 * The existing suite (note-store-hardening.test.ts) covers addNote input
 * caps, setAuthorName sanitization, and the hydration validator. These
 * tests cover the live action paths:
 *
 *   markApplied — BCBA "Apply" button marks a note's actions as executed.
 *   A broken markApplied either never marks done (caregiver re-applies
 *   accidentally) or marks the wrong note (audit trail corruption).
 *
 *   removeNote — caregiver deletes a note. A broken remove either leaks
 *   the deleted note or removes an adjacent one.
 *
 *   getRecentNotes — paginated note list in CaregiverNotes panel. A broken
 *   limit silently drops new notes or returns stale ones.
 *
 *   getActionableNotes — "pending actions" count in the caregiver dashboard.
 *   A broken filter shows 0 when actions are pending (hidden work) or shows
 *   applied notes as if they need re-running.
 *
 *   searchNotes — caregiver search bar. Empty query must return all notes;
 *   a non-empty query must filter by case-insensitive substring.
 *
 *   addNote MAX_NOTES cap — prevents unbounded localStorage growth that
 *   triggers a quota error and silently loses subsequent saves.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { useNoteStore } from '@/store/noteStore';
import type { CaregiverNote } from '@/types';

// Must match noteStore.ts MAX_NOTES constant (private — not exported)
const MAX_NOTES = 500;

// Clear store before each test
beforeEach(() => {
  useNoteStore.setState({ notes: [], authorName: '' });
});

function addTestNote(text: string, applied = false, type: 'note_only' | 'add_phrase' = 'note_only'): CaregiverNote {
  const note = useNoteStore.getState().addNote(text, [
    { type, description: 'test', payload: {} },
  ]);
  if (applied) {
    useNoteStore.getState().markApplied(note.id);
  }
  return note;
}

// ── markApplied ───────────────────────────────────────────────────────────────

describe('noteStore — markApplied', () => {
  it('sets applied=true on the targeted note', () => {
    const note = addTestNote('Good session today');
    useNoteStore.getState().markApplied(note.id);
    const found = useNoteStore.getState().notes.find(n => n.id === note.id);
    expect(found?.applied).toBe(true);
  });

  it('does not mark other notes as applied', () => {
    const note1 = addTestNote('Note one');
    const note2 = addTestNote('Note two');
    useNoteStore.getState().markApplied(note1.id);
    const found2 = useNoteStore.getState().notes.find(n => n.id === note2.id);
    expect(found2?.applied).toBe(false);
  });

  it('is idempotent — second markApplied does not throw or duplicate', () => {
    const note = addTestNote('Note');
    useNoteStore.getState().markApplied(note.id);
    useNoteStore.getState().markApplied(note.id);
    const found = useNoteStore.getState().notes.find(n => n.id === note.id);
    expect(found?.applied).toBe(true);
    expect(useNoteStore.getState().notes).toHaveLength(1);
  });

  it('no-op for unknown id — notes array unchanged', () => {
    addTestNote('Note');
    const before = useNoteStore.getState().notes.map(n => n.applied);
    useNoteStore.getState().markApplied('nonexistent-id');
    const after = useNoteStore.getState().notes.map(n => n.applied);
    expect(after).toEqual(before);
  });
});

// ── removeNote ────────────────────────────────────────────────────────────────

describe('noteStore — removeNote', () => {
  it('removes the targeted note from the array', () => {
    const note = addTestNote('Delete me');
    useNoteStore.getState().removeNote(note.id);
    expect(useNoteStore.getState().notes.find(n => n.id === note.id)).toBeUndefined();
  });

  it('does not remove adjacent notes', () => {
    const n1 = addTestNote('Keep');
    const n2 = addTestNote('Delete');
    const n3 = addTestNote('Also keep');
    useNoteStore.getState().removeNote(n2.id);
    const ids = useNoteStore.getState().notes.map(n => n.id);
    expect(ids).toContain(n1.id);
    expect(ids).toContain(n3.id);
    expect(ids).not.toContain(n2.id);
  });

  it('no-op for unknown id — notes array unchanged', () => {
    addTestNote('Note');
    const before = useNoteStore.getState().notes.length;
    useNoteStore.getState().removeNote('does-not-exist');
    expect(useNoteStore.getState().notes.length).toBe(before);
  });
});

// ── getRecentNotes ────────────────────────────────────────────────────────────

describe('noteStore — getRecentNotes', () => {
  it('returns all notes when count < limit', () => {
    addTestNote('A');
    addTestNote('B');
    expect(useNoteStore.getState().getRecentNotes()).toHaveLength(2);
  });

  it('default limit is 50 — does not return more than 50', () => {
    for (let i = 0; i < 60; i++) addTestNote(`Note ${i}`);
    expect(useNoteStore.getState().getRecentNotes()).toHaveLength(50);
  });

  it('custom limit is respected', () => {
    for (let i = 0; i < 10; i++) addTestNote(`Note ${i}`);
    expect(useNoteStore.getState().getRecentNotes(3)).toHaveLength(3);
  });

  it('returns empty array when no notes', () => {
    expect(useNoteStore.getState().getRecentNotes()).toHaveLength(0);
  });
});

// ── getActionableNotes ────────────────────────────────────────────────────────

describe('noteStore — getActionableNotes', () => {
  it('returns notes that have non-note_only actions and are not applied', () => {
    const note = useNoteStore.getState().addNote('Add phrase', [
      { type: 'add_phrase', description: 'Add word', payload: {} },
    ]);
    const actionable = useNoteStore.getState().getActionableNotes();
    expect(actionable.map(n => n.id)).toContain(note.id);
  });

  it('excludes applied notes even if they have actionable types', () => {
    const note = useNoteStore.getState().addNote('Add phrase', [
      { type: 'add_phrase', description: 'Add word', payload: {} },
    ]);
    useNoteStore.getState().markApplied(note.id);
    const actionable = useNoteStore.getState().getActionableNotes();
    expect(actionable.map(n => n.id)).not.toContain(note.id);
  });

  it('excludes note_only notes (clinical observations, no actions)', () => {
    addTestNote('Observation only'); // type defaults to note_only
    const actionable = useNoteStore.getState().getActionableNotes();
    expect(actionable).toHaveLength(0);
  });

  it('returns only the unapplied actionable subset when mixed', () => {
    const a = useNoteStore.getState().addNote('Pending', [{ type: 'add_phrase', description: '', payload: {} }]);
    const b = useNoteStore.getState().addNote('Applied', [{ type: 'add_phrase', description: '', payload: {} }]);
    const c = useNoteStore.getState().addNote('Observation', [{ type: 'note_only', description: '', payload: {} }]);
    useNoteStore.getState().markApplied(b.id);
    const ids = useNoteStore.getState().getActionableNotes().map(n => n.id);
    expect(ids).toContain(a.id);
    expect(ids).not.toContain(b.id);
    expect(ids).not.toContain(c.id);
  });
});

// ── searchNotes ───────────────────────────────────────────────────────────────

describe('noteStore — searchNotes', () => {
  it('empty query returns all notes', () => {
    addTestNote('First note');
    addTestNote('Second note');
    expect(useNoteStore.getState().searchNotes('')).toHaveLength(2);
  });

  it('matches case-insensitively', () => {
    addTestNote('He used BATHROOM three times');
    const results = useNoteStore.getState().searchNotes('bathroom');
    expect(results).toHaveLength(1);
    expect(results[0].text).toMatch(/BATHROOM/);
  });

  it('returns only matching notes', () => {
    addTestNote('Bathroom note');
    addTestNote('Lunch note');
    const results = useNoteStore.getState().searchNotes('bathroom');
    expect(results).toHaveLength(1);
  });

  it('returns empty array when query matches nothing', () => {
    addTestNote('Bathroom');
    addTestNote('Lunch');
    expect(useNoteStore.getState().searchNotes('xyznomatch')).toHaveLength(0);
  });

  it('query is capped at 200 chars — no crash on very long query', () => {
    addTestNote('Some note');
    const longQuery = 'a'.repeat(500);
    expect(() => useNoteStore.getState().searchNotes(longQuery)).not.toThrow();
  });
});

// ── addNote MAX_NOTES cap ─────────────────────────────────────────────────────

describe('noteStore — addNote MAX_NOTES cap', () => {
  it('caps the notes array at MAX_NOTES', () => {
    for (let i = 0; i < MAX_NOTES + 5; i++) {
      useNoteStore.getState().addNote(`Note ${i}`);
    }
    expect(useNoteStore.getState().notes).toHaveLength(MAX_NOTES);
  });

  it('new notes prepend to the front (most-recent first)', () => {
    addTestNote('First');
    addTestNote('Second');
    const notes = useNoteStore.getState().notes;
    expect(notes[0].text).toBe('Second'); // most recent first
    expect(notes[1].text).toBe('First');
  });

  it('returns the newly created note from addNote', () => {
    const note = useNoteStore.getState().addNote('Test note');
    expect(note).toBeDefined();
    expect(note.id).toBeDefined();
    expect(note.text).toBe('Test note');
    expect(note.applied).toBe(false);
  });
});
