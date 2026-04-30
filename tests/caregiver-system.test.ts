import { describe, it, expect, beforeEach } from 'vitest';
import { useNoteStore } from '@/store/noteStore';
import { useCategoryStore } from '@/store/categoryStore';
import { usePredictionStore } from '@/store/predictionStore';
import { executeAction, executeAllActions } from '@/engine/caregiverActions';
import { NoteAction } from '@/types';

beforeEach(() => {
  useNoteStore.setState({ notes: [], authorName: '' });
  useCategoryStore.setState({ customCategories: [], customPhrases: [], orderingSequences: [], seeded: false });
  usePredictionStore.setState({ wordFreq: {}, bigrams: {} });
});

describe('NoteStore — CRUD', () => {
  it('addNote creates timestamped note', () => {
    const note = useNoteStore.getState().addNote('Good session today');
    expect(note.text).toBe('Good session today');
    expect(note.timestamp).toBeGreaterThan(0);
    expect(note.actions[0].type).toBe('note_only');
    expect(useNoteStore.getState().notes).toHaveLength(1);
  });

  it('addNote with actions stores them', () => {
    const actions: NoteAction[] = [
      { type: 'add_phrase', description: 'Add phrase', payload: { categoryId: 'help-needs', text: 'I feel sick' } },
    ];
    const note = useNoteStore.getState().addNote('Add I feel sick to Help', actions);
    expect(note.actions).toHaveLength(1);
    expect(note.actions[0].type).toBe('add_phrase');
    expect(note.applied).toBe(false);
  });

  it('markApplied flags the note', () => {
    const note = useNoteStore.getState().addNote('test');
    useNoteStore.getState().markApplied(note.id);
    expect(useNoteStore.getState().notes[0].applied).toBe(true);
  });

  it('removeNote deletes it', () => {
    const note = useNoteStore.getState().addNote('test');
    useNoteStore.getState().removeNote(note.id);
    expect(useNoteStore.getState().notes).toHaveLength(0);
  });

  it('setAuthorName persists across notes', () => {
    useNoteStore.getState().setAuthorName('Dr. Smith, BCBA');
    const note = useNoteStore.getState().addNote('Observation');
    expect(note.authorName).toBe('Dr. Smith, BCBA');
  });

  it('getRecentNotes limits results', () => {
    for (let i = 0; i < 20; i++) useNoteStore.getState().addNote(`Note ${i}`);
    expect(useNoteStore.getState().getRecentNotes(5)).toHaveLength(5);
  });

  it('getActionableNotes returns only unapplied notes with actions', () => {
    useNoteStore.getState().addNote('Just a note'); // note_only
    useNoteStore.getState().addNote('Add phrase', [
      { type: 'add_phrase', description: 'test', payload: { categoryId: 'help-needs', text: 'test' } },
    ]);
    expect(useNoteStore.getState().getActionableNotes()).toHaveLength(1);
  });

  it('searchNotes finds matching text', () => {
    useNoteStore.getState().addNote('Bathroom needs to be first');
    useNoteStore.getState().addNote('Good session today');
    expect(useNoteStore.getState().searchNotes('bathroom')).toHaveLength(1);
  });
});

describe('CaregiverActions — add_phrase', () => {
  // Sample: Caregiver says "Add 'I feel sick' to Help"
  it('adds custom phrase to category', () => {
    const result = executeAction({
      type: 'add_phrase',
      description: 'Add "I feel sick" to Help / Needs',
      payload: { categoryId: 'help-needs', text: 'I feel sick' },
    });
    expect(result.success).toBe(true);
    const phrases = useCategoryStore.getState().getPhrasesForCategory('help-needs');
    expect(phrases.some(p => p.text === 'I feel sick')).toBe(true);
  });

  it('fails gracefully with missing data', () => {
    const result = executeAction({
      type: 'add_phrase', description: '', payload: { categoryId: '', text: '' },
    });
    expect(result.success).toBe(false);
  });
});

describe('CaregiverActions — add_category', () => {
  // Sample: Caregiver says "Create a Feelings category"
  it('creates custom category with icon', () => {
    const result = executeAction({
      type: 'add_category',
      description: 'Create "Feelings" category',
      payload: { name: 'Feelings', icon: '😊' },
    });
    expect(result.success).toBe(true);
    expect(useCategoryStore.getState().allCategories().some(c => c.name === 'Feelings')).toBe(true);
  });
});

describe('CaregiverActions — add_sequence', () => {
  // Sample: Caregiver says "Create a Subway ordering flow"
  it('creates ordering sequence with steps', () => {
    const result = executeAction({
      type: 'add_sequence',
      description: 'Create Subway ordering flow',
      payload: {
        name: 'Subway',
        categoryId: 'food-ordering',
        steps: [
          { label: 'Bread', options: ['White', 'Wheat', 'Italian'] },
          { label: 'Protein', options: ['Turkey', 'Ham', 'Chicken'] },
          { label: 'Finish', options: ["That's all", 'Thank you'] },
        ],
      },
    });
    expect(result.success).toBe(true);
    expect(result.message).toContain('3 steps');
    const seqs = useCategoryStore.getState().getSequencesForCategory('food-ordering');
    expect(seqs.some(s => s.name === 'Subway')).toBe(true);
    const subway = seqs.find(s => s.name === 'Subway')!;
    expect(subway.steps).toHaveLength(3);
    expect(subway.steps[0].options).toHaveLength(3);
  });
});

describe('CaregiverActions — remove_sequence', () => {
  // Sample: Caregiver says "Remove Chipotle, he doesn't go there anymore"
  it('removes ordering sequence by name', () => {
    // First seed templates so Chipotle exists
    useCategoryStore.getState().seedTemplates();
    expect(useCategoryStore.getState().getSequencesForCategory('food-ordering').length).toBeGreaterThan(0);

    const result = executeAction({
      type: 'remove_sequence',
      description: 'Remove Chipotle ordering flow',
      payload: { sequenceName: 'Chipotle' },
    });
    expect(result.success).toBe(true);
    expect(useCategoryStore.getState().getSequencesForCategory('food-ordering').some(s => s.name === 'Chipotle')).toBe(false);
  });

  it('fails for nonexistent sequence', () => {
    const result = executeAction({
      type: 'remove_sequence', description: '', payload: { sequenceName: 'Nonexistent' },
    });
    expect(result.success).toBe(false);
  });
});

describe('CaregiverActions — boost_word', () => {
  // Sample: Caregiver says "He's starting to use 'because' a lot"
  it('boosts word prediction frequency', () => {
    const result = executeAction({
      type: 'boost_word',
      description: 'Boost "because" in prediction frequency',
      payload: { word: 'because', boostCount: 10 },
    });
    expect(result.success).toBe(true);
    expect(usePredictionStore.getState().wordFreq.because.count).toBe(10);
  });

  it('accumulates with existing frequency', () => {
    usePredictionStore.setState({ wordFreq: { because: { count: 5, lastUsed: 1000 } } });
    executeAction({ type: 'boost_word', description: '', payload: { word: 'because', boostCount: 10 } });
    expect(usePredictionStore.getState().wordFreq.because.count).toBe(15);
  });
});

describe('CaregiverActions — note_only', () => {
  // Sample: Caregiver says "Good session, eye contact improving"
  it('succeeds without modifying any store', () => {
    const catsBefore = useCategoryStore.getState().allCategories().length;
    const result = executeAction({
      type: 'note_only', description: 'Clinical observation', payload: {},
    });
    expect(result.success).toBe(true);
    expect(useCategoryStore.getState().allCategories().length).toBe(catsBefore);
  });
});

describe('CaregiverActions — executeAllActions', () => {
  // Sample: Caregiver says "Add 'I feel sick' and 'My stomach hurts' to Help"
  it('executes multiple actions and returns all results', () => {
    const actions: NoteAction[] = [
      { type: 'add_phrase', description: 'Add phrase 1', payload: { categoryId: 'help-needs', text: 'I feel sick' } },
      { type: 'add_phrase', description: 'Add phrase 2', payload: { categoryId: 'help-needs', text: 'My stomach hurts' } },
    ];
    const results = executeAllActions(actions);
    expect(results).toHaveLength(2);
    expect(results.every(r => r.success)).toBe(true);
    expect(useCategoryStore.getState().getPhrasesForCategory('help-needs')).toHaveLength(10); // 8 defaults + 2 custom
  });
});

describe('CaregiverActions — Clinical safety', () => {
  it('cannot remove default phrases (only custom)', () => {
    const result = executeAction({
      type: 'remove_phrase',
      description: 'Remove "All done" from Help',
      payload: { phraseText: 'All done', categoryId: 'help-needs' },
    });
    expect(result.success).toBe(false);
    expect(result.message).toContain('default phrase');
  });

  it('cannot remove default categories', () => {
    const result = executeAction({
      type: 'remove_category',
      description: 'Remove Help / Needs',
      payload: { categoryName: 'Help / Needs' },
    });
    expect(result.success).toBe(false);
    expect(result.message).toContain('default category');
  });
});

describe('Ordering sequences — user data (not hardcoded)', () => {
  it('templates are seeded on first use', () => {
    useCategoryStore.getState().seedTemplates();
    const seqs = useCategoryStore.getState().getSequencesForCategory('food-ordering');
    expect(seqs.length).toBeGreaterThanOrEqual(2);
    expect(seqs.some(s => s.name === 'Chipotle')).toBe(true);
    expect(seqs.some(s => s.name === 'General Restaurant')).toBe(true);
  });

  it('seeding is idempotent', () => {
    useCategoryStore.getState().seedTemplates();
    useCategoryStore.getState().seedTemplates();
    const seqs = useCategoryStore.getState().getSequencesForCategory('food-ordering');
    expect(seqs).toHaveLength(2); // not 4
  });

  it('user can delete a seeded template', () => {
    useCategoryStore.getState().seedTemplates();
    const chipotle = useCategoryStore.getState().getSequencesForCategory('food-ordering').find(s => s.name === 'Chipotle')!;
    useCategoryStore.getState().removeOrderingSequence(chipotle.id);
    expect(useCategoryStore.getState().getSequencesForCategory('food-ordering').some(s => s.name === 'Chipotle')).toBe(false);
  });

  it('user can add a new restaurant alongside templates', () => {
    useCategoryStore.getState().seedTemplates();
    executeAction({
      type: 'add_sequence',
      description: "Add McDonald's",
      payload: {
        name: "McDonald's", categoryId: 'food-ordering',
        steps: [
          { label: 'Order', options: ['Big Mac', 'Nuggets', 'Fries'] },
          { label: 'Drink', options: ['Coke', 'Sprite', 'Water'] },
        ],
      },
    });
    const seqs = useCategoryStore.getState().getSequencesForCategory('food-ordering');
    expect(seqs).toHaveLength(3);
    expect(seqs.some(s => s.name === "McDonald's")).toBe(true);
  });
});
