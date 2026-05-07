/**
 * noteStore — addNote input caps + hydration validator. Notes carry
 * actionable payloads that executeAllActions can run (add_phrase,
 * remove_phrase, etc.); a tampered persist entry could inject a
 * hostile action that a single "Apply" tap would execute. The
 * validator drops bad shapes at the boundary.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { useNoteStore } from '@/store/noteStore';

beforeEach(() => {
  if (typeof window !== 'undefined') window.localStorage.clear();
  useNoteStore.setState({ notes: [], authorName: '' });
});

function seedPersistedNotes(state: Record<string, unknown>): void {
  window.localStorage.setItem('prism-aac-notes', JSON.stringify({ state, version: 0 }));
}

describe('noteStore — addNote input caps', () => {
  it('clamps oversize note text to MAX_NOTE_TEXT_LEN', () => {
    const huge = 'n'.repeat(50_000);
    const note = useNoteStore.getState().addNote(huge);
    expect(note.text.length).toBeLessThanOrEqual(10_000);
  });

  it('strips actions whose type is not in the discriminated union', () => {
    const note = useNoteStore.getState().addNote('test', [
      { type: 'add_phrase', description: 'good', payload: { categoryId: 'help' } },
      // @ts-expect-error — testing runtime guard
      { type: 'rm_-rf', description: 'evil', payload: { evil: true } },
      // @ts-expect-error — testing runtime guard
      { type: 'add_phrase', description: 'a'.repeat(5000), payload: {} }, // description too long
    ]);
    expect(note.actions.length).toBe(1);
    expect(note.actions[0].type).toBe('add_phrase');
  });

  it('falls back to note_only when all submitted actions are bogus', () => {
    const note = useNoteStore.getState().addNote('text', [
      // @ts-expect-error
      { type: 'evil', description: 'x', payload: {} },
    ]);
    expect(note.actions).toEqual([{ type: 'note_only', description: 'Clinical note', payload: {} }]);
  });
});

describe('noteStore — setAuthorName cap', () => {
  it('clamps author name length and strips control chars', () => {
    useNoteStore.getState().setAuthorName('a'.repeat(200) + '\x00\x07');
    expect(useNoteStore.getState().authorName.length).toBeLessThanOrEqual(80);
    expect(useNoteStore.getState().authorName).not.toContain('\x00');
  });
});

describe('noteStore — hydration validator', () => {
  it('drops malformed persisted notes', () => {
    seedPersistedNotes({
      notes: [
        { id: 'good', text: 'OK', timestamp: 1, actions: [], applied: false },
        { id: '', text: 'no id', timestamp: 1, actions: [], applied: false },                      // bad: empty id
        { id: 'huge', text: 'x'.repeat(50000), timestamp: 1, actions: [], applied: false },        // bad: text overflow
        { id: 'no-ts', text: 't', actions: [], applied: false },                                   // bad: no timestamp
        { id: 'bad-applied', text: 't', timestamp: 1, actions: [], applied: 'yes' },               // bad: applied not bool
        'not-object',
      ],
      authorName: 'Author',
    });
    void useNoteStore.persist.rehydrate();
    const ids = useNoteStore.getState().notes.map((n) => n.id);
    expect(ids).toContain('good');
    expect(ids).not.toContain('');
    expect(ids).not.toContain('huge');
    expect(ids).not.toContain('no-ts');
    expect(ids).not.toContain('bad-applied');
  });

  it('strips hostile action types on rehydrate', () => {
    seedPersistedNotes({
      notes: [{
        id: 'n1', text: 'OK', timestamp: 1, applied: false, actions: [
          { type: 'add_phrase', description: 'OK', payload: {} },
          { type: '__exec__', description: 'evil', payload: { cmd: 'rm -rf /' } },
        ],
      }],
      authorName: '',
    });
    void useNoteStore.persist.rehydrate();
    const note = useNoteStore.getState().notes[0];
    expect(note.actions.every((a) => ['add_phrase', 'remove_phrase', 'add_sequence', 'reorder_phrase', 'boost_word', 'note_only'].includes(a.type))).toBe(true);
  });

  it('caps notes at MAX_NOTES on rehydrate', () => {
    const huge = Array.from({ length: 1000 }, (_, i) => ({
      id: `n${i}`, text: `t${i}`, timestamp: i, applied: false, actions: [],
    }));
    seedPersistedNotes({ notes: huge, authorName: '' });
    void useNoteStore.persist.rehydrate();
    expect(useNoteStore.getState().notes.length).toBeLessThanOrEqual(500);
  });
});
