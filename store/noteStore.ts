import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { CaregiverNote, NoteAction } from '@/types';

/**
 * Caregiver Note Store
 *
 * Stores clinical notes from BCBAs, therapists, and caregivers.
 * Notes can contain actionable commands (parsed by AI) that modify
 * the child's AAC configuration — phrases, categories, ordering
 * sequences, and prediction boosts.
 *
 * CLINICAL DOCUMENTATION REQUIREMENT:
 * Per BACB Ethics Code, all modifications to a client's communication
 * system must be documented. This store serves as the audit trail.
 *
 * REAL-WORLD SAMPLES:
 *
 *   Note: "He asked for McDonald's three times today — add it to Food"
 *   Actions: [{ type: 'add_sequence', description: "Create McDonald's ordering flow under Food / Ordering", payload: { name: "McDonald's", categoryId: "food-ordering" } }]
 *
 *   Note: "Bathroom needs to be first on Help page, he's been having accidents"
 *   Actions: [{ type: 'reorder_phrase', description: 'Move "Bathroom" to position 1 on Help / Needs', payload: { phraseId: 'help-bathroom', newSortOrder: 0 } }]
 *
 *   Note: "Add 'I feel sick' and 'My stomach hurts' to Help"
 *   Actions: [
 *     { type: 'add_phrase', description: 'Add "I feel sick" to Help / Needs', payload: { categoryId: 'help-needs', text: 'I feel sick' } },
 *     { type: 'add_phrase', description: 'Add "My stomach hurts" to Help / Needs', payload: { categoryId: 'help-needs', text: 'My stomach hurts' } },
 *   ]
 *
 *   Note: "He's starting to use 'because' — add it to predictions"
 *   Actions: [{ type: 'boost_word', description: 'Boost "because" in prediction frequency', payload: { word: 'because', boostCount: 10 } }]
 *
 *   Note: "Remove Lake from Places, he doesn't go there anymore"
 *   Actions: [{ type: 'remove_phrase', description: 'Remove "Lake" from Places / Plans', payload: { phraseText: 'Lake', categoryId: 'places-plans' } }]
 *
 *   Note: "Good session today, used 15 phrases independently. Eye contact improving."
 *   Actions: [{ type: 'note_only', description: 'Clinical observation — no configuration changes', payload: {} }]
 *
 *   Note: "Create a Subway ordering flow: bread → protein → cheese → veggies → sauce"
 *   Actions: [{ type: 'add_sequence', description: 'Create Subway ordering flow', payload: {
 *     name: 'Subway', categoryId: 'food-ordering',
 *     steps: [
 *       { label: 'Bread', options: ['White', 'Wheat', 'Italian', 'Flatbread'] },
 *       { label: 'Protein', options: ['Turkey', 'Ham', 'Chicken', 'Meatball', 'Veggie'] },
 *       { label: 'Cheese', options: ['American', 'Swiss', 'Provolone', 'No cheese'] },
 *       { label: 'Veggies', options: ['Lettuce', 'Tomato', 'Onion', 'Pickles', 'Peppers'] },
 *       { label: 'Sauce', options: ['Mayo', 'Mustard', 'Ranch', 'No sauce'] },
 *     ]
 *   }}]
 */

interface NoteState {
  notes: CaregiverNote[];
  authorName: string;
  addNote: (text: string, actions?: NoteAction[]) => CaregiverNote;
  markApplied: (noteId: string) => void;
  removeNote: (noteId: string) => void;
  setAuthorName: (name: string) => void;
  getRecentNotes: (limit?: number) => CaregiverNote[];
  getActionableNotes: () => CaregiverNote[];
  searchNotes: (query: string) => CaregiverNote[];
}

export const useNoteStore = create<NoteState>()(
  persist(
    (set, get) => ({
      notes: [],
      authorName: '',

      addNote: (text, actions) => {
        const note: CaregiverNote = {
          id: crypto.randomUUID(),
          text,
          timestamp: Date.now(),
          actions: actions ?? [{ type: 'note_only', description: 'Clinical note', payload: {} }],
          applied: false,
          authorName: get().authorName || undefined,
        };
        set((s) => ({ notes: [note, ...s.notes] }));
        return note;
      },

      markApplied: (noteId) =>
        set((s) => ({
          notes: s.notes.map((n) => n.id === noteId ? { ...n, applied: true } : n),
        })),

      removeNote: (noteId) =>
        set((s) => ({ notes: s.notes.filter((n) => n.id !== noteId) })),

      setAuthorName: (name) => set({ authorName: name }),

      getRecentNotes: (limit = 50) => get().notes.slice(0, limit),

      getActionableNotes: () =>
        get().notes.filter((n) => !n.applied && n.actions.some((a) => a.type !== 'note_only')),

      searchNotes: (query) => {
        const q = query.toLowerCase();
        return get().notes.filter((n) => n.text.toLowerCase().includes(q));
      },
    }),
    { name: 'prism-aac-notes' },
  ),
);
