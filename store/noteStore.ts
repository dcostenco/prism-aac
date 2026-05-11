import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { CaregiverNote, NoteAction } from '@/types';
import { randomId } from '@/lib/uuid';
import { sanitizeString } from '@/lib/safeStrings';
import { safeJSONStorage } from '@/lib/safeStorage';
import { useAuthStore } from '@/store/authStore';

/** Per-note text and author bounds. Notes are caregiver-typed clinical
 *  observations — well-formed entries are typically 100-300 chars. The
 *  10k cap defends against paste-accident from a clinical EHR import,
 *  not against a determined adversary; we just want render + storage
 *  to survive without the AAC user noticing a hang. */
const MAX_NOTE_TEXT_LEN = 10_000;
const MAX_AUTHOR_NAME_LEN = 80;
/** Hard cap on total notes. Per-store: matches the slice(0, 500) the
 *  addNote path already enforced; surfaced as a constant so the
 *  hydration validator caps to the same number. */
const MAX_NOTES = 500;
/** Per-note action cap. Even the most ambitious caregiver note
 *  (a complex Subway ordering flow with 5 steps) decomposes to ~10
 *  actions. 50 is paranoid headroom. */
const MAX_ACTIONS_PER_NOTE = 50;
const VALID_ACTION_TYPES = new Set<NoteAction['type']>([
  'add_phrase', 'remove_phrase', 'add_sequence', 'reorder_phrase',
  'boost_word', 'note_only',
  'add_category', 'remove_category', 'remove_sequence', 'edit_sequence',
]);

/** Drop any action that doesn't match the expected discriminated-union
 *  shape — defends against a tampered persist payload injecting an
 *  action with a payload that executeAllActions would happily run. */
function sanitizeActions(raw: unknown): NoteAction[] {
  if (!Array.isArray(raw)) return [];
  const out: NoteAction[] = [];
  for (const a of raw.slice(0, MAX_ACTIONS_PER_NOTE)) {
    if (!a || typeof a !== 'object') continue;
    const x = a as Record<string, unknown>;
    if (typeof x.type !== 'string' || !VALID_ACTION_TYPES.has(x.type as NoteAction['type'])) continue;
    if (typeof x.description !== 'string' || x.description.length > 500) continue;
    if (x.payload === null || (typeof x.payload === 'object' && !Array.isArray(x.payload))) {
      out.push({
        type: x.type as NoteAction['type'],
        description: sanitizeString(x.description, 500),
        payload: (x.payload ?? {}) as Record<string, unknown>,
      } as NoteAction);
    }
  }
  return out;
}

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
        // Cap text and author at the same bounds the hydration
        // validator uses so the row survives a rehydrate. Without
        // this cap a paste accident (10MB log dump from a clinical
        // EHR) would land in localStorage, fail the next quota write,
        // and silently lose subsequent saves.
        const cappedText = (text ?? '').slice(0, MAX_NOTE_TEXT_LEN);
        // M18: Prefer authenticated profile name to prevent attribution fraud
        const authProfile = useAuthStore.getState().profile;
        const authName = authProfile?.name;
        const authorId = authProfile?.email ?? undefined;
        const cleanAuthor = sanitizeString(authName || get().authorName, MAX_AUTHOR_NAME_LEN);
        const cleanActions = actions
          ? sanitizeActions(actions)
          : [{ type: 'note_only', description: 'Clinical note', payload: {} } as NoteAction];
        const note: CaregiverNote = {
          id: randomId(),
          text: cappedText,
          timestamp: Date.now(),
          actions: cleanActions.length > 0
            ? cleanActions
            : [{ type: 'note_only', description: 'Clinical note', payload: {} }],
          applied: false,
          authorName: cleanAuthor || undefined,
          authorId,
        };
        set((s) => ({ notes: [note, ...s.notes].slice(0, MAX_NOTES) }));
        return note;
      },

      markApplied: (noteId) =>
        set((s) => ({
          notes: s.notes.map((n) => n.id === noteId ? { ...n, applied: true } : n),
        })),

      removeNote: (noteId) =>
        set((s) => ({ notes: s.notes.filter((n) => n.id !== noteId) })),

      setAuthorName: (name) => set({ authorName: sanitizeString(name, MAX_AUTHOR_NAME_LEN) }),

      getRecentNotes: (limit = 50) => get().notes.slice(0, limit),

      getActionableNotes: () =>
        get().notes.filter((n) => !n.applied && n.actions.some((a) => a.type !== 'note_only')),

      searchNotes: (query) => {
        const q = query.slice(0, 200).toLowerCase();
        if (!q) return get().notes;
        return get().notes.filter((n) => n.text.toLowerCase().includes(q));
      },
    }),
    {
      name: 'prism-aac-notes',
      // Quota-safe storage. A single 10kB note × 500 entries = 5MB
      // potential — the same order as the localStorage cap — so a
      // chatty clinical setting can collapse the entire persist write
      // on QuotaExceededError. Default zustand persist swallows that
      // error; the caregiver hits Save and notices nothing, then the
      // session reloads and their notes are gone. On quota we shed
      // the OLDEST applied notes (already actioned, not actively
      // editable) so the unapplied work-in-progress survives.
      storage: createJSONStorage(() => safeJSONStorage({
        name: 'prism-aac-notes',
        onQuotaExceeded: () => {
          useNoteStore.setState((s) => {
            // Sort: applied first (disposable), then by oldest timestamp,
            // and drop the front half.
            const drop = [...s.notes]
              .sort((a, b) => Number(b.applied) - Number(a.applied) || a.timestamp - b.timestamp)
              .slice(0, Math.floor(MAX_NOTES / 2))
              .map((n) => n.id);
            const dropIds = new Set(drop);
            return { notes: s.notes.filter((n) => !dropIds.has(n.id)) };
          });
        },
      })),
      // Hydration validator. Caregiver notes can carry actionable
      // payloads (executeAllActions can call add_phrase / remove_phrase
      // etc.) so a tampered localStorage entry could inject hostile
      // actions that a single "Apply" click would run. We:
      //   1. Drop entries with bad shape entirely.
      //   2. Strip actions that don't match the known discriminated
      //      union — defense-in-depth alongside executeAllActions'
      //      own type checks.
      //   3. Cap to MAX_NOTES so a runaway portal/import can't blow up
      //      localStorage on rehydrate.
      merge: (persistedState, currentState) => {
        const incoming = (persistedState ?? {}) as Partial<NoteState>;
        const cleaned = (Array.isArray(incoming.notes) ? incoming.notes : [])
          .filter((n): n is CaregiverNote => {
            if (!n || typeof n !== 'object') return false;
            const x = n as unknown as Record<string, unknown>;
            if (typeof x.id !== 'string' || !x.id) return false;
            if (typeof x.text !== 'string' || x.text.length > MAX_NOTE_TEXT_LEN) return false;
            if (typeof x.timestamp !== 'number' || !Number.isFinite(x.timestamp)) return false;
            if (typeof x.applied !== 'boolean') return false;
            if (x.authorName !== undefined && (typeof x.authorName !== 'string' || x.authorName.length > MAX_AUTHOR_NAME_LEN)) return false;
            if (x.authorId !== undefined && typeof x.authorId !== 'string') return false;
            return true;
          })
          .map((n) => ({ ...n, actions: sanitizeActions(n.actions) }))
          .slice(0, MAX_NOTES);
        const author = typeof incoming.authorName === 'string'
          ? sanitizeString(incoming.authorName, MAX_AUTHOR_NAME_LEN)
          : '';
        return { ...currentState, notes: cleaned, authorName: author };
      },
    },
  ),
);
