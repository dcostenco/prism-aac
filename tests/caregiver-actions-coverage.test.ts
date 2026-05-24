/**
 * caregiverActions — paths not covered by caregiver-actions-hardening.test.ts
 *
 * The hardening suite covers remove_phrase, reorder_phrase, edit_sequence, and
 * security clamping. These tests cover the remaining action types:
 *
 *   add_phrase — most common caregiver request ("Add X to category Y").
 *   Missing category or text must fail fast, not silently add an empty phrase.
 *
 *   add_category — BCBA creates a new category (e.g. "Subway ordering").
 *   Missing name must fail. Icon defaults to 📌 when absent.
 *
 *   remove_category — BCBA removes an obsolete category. Must only remove
 *   custom categories; attempt to remove a default category returns an error
 *   (default categories have no isCustom flag, they can't be deleted).
 *
 *   boost_word — raises a word's prediction frequency. clamping: negative
 *   boost → clamped to 1; boost over 100 → clamped to 100; NaN → default 10.
 *
 *   note_only — records a clinical observation with no config change.
 *   Must return success without touching stores.
 *
 *   unknown / default — graceful failure with informative message so the
 *   caregiver knows the action was silently rejected, not lost.
 *
 *   executeAllActions — array wrapper. Aggregate results must match
 *   individual executeAction calls; one failure must not abort the rest.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { useCategoryStore } from '@/store/categoryStore';
import { usePredictionStore } from '@/store/predictionStore';
import { executeAction, executeAllActions } from '@/engine/caregiverActions';
import type { NoteAction } from '@/types';

beforeEach(() => {
  useCategoryStore.setState({
    customCategories: [],
    customPhrases: [],
    orderingSequences: [],
    seeded: false,
  });
  usePredictionStore.setState({ wordFreq: {}, bigrams: {}, trigrams: {} });
});

// ── add_phrase ────────────────────────────────────────────────────────────────

describe('CaregiverActions — add_phrase', () => {
  it('adds a phrase to the specified category', () => {
    const action: NoteAction = {
      type: 'add_phrase',
      description: 'Add to help',
      payload: { categoryId: 'help-needs', text: 'I need water' },
    };
    const result = executeAction(action);
    expect(result.success).toBe(true);
    const phrases = useCategoryStore.getState().customPhrases;
    expect(phrases.some((p) => p.text === 'I need water')).toBe(true);
  });

  it('fails when categoryId is missing', () => {
    const action: NoteAction = {
      type: 'add_phrase',
      description: '',
      payload: { categoryId: '', text: 'Some phrase' },
    };
    const result = executeAction(action);
    expect(result.success).toBe(false);
  });

  it('fails when text is missing', () => {
    const action: NoteAction = {
      type: 'add_phrase',
      description: '',
      payload: { categoryId: 'help-needs', text: '' },
    };
    const result = executeAction(action);
    expect(result.success).toBe(false);
  });

  it('clamps text to 500 chars before inserting', () => {
    const action: NoteAction = {
      type: 'add_phrase',
      description: '',
      payload: { categoryId: 'help-needs', text: 'x'.repeat(1000) },
    };
    executeAction(action);
    const added = useCategoryStore.getState().customPhrases.find((p) => p.categoryId === 'help-needs');
    expect(added).toBeDefined();
    expect(added!.text.length).toBeLessThanOrEqual(500);
  });
});

// ── add_category ──────────────────────────────────────────────────────────────

describe('CaregiverActions — add_category', () => {
  it('creates a new custom category', () => {
    const action: NoteAction = {
      type: 'add_category',
      description: '',
      payload: { name: 'Subway Order', icon: '🥖' },
    };
    const result = executeAction(action);
    expect(result.success).toBe(true);
    const cats = useCategoryStore.getState().customCategories;
    expect(cats.some((c) => c.name === 'Subway Order')).toBe(true);
  });

  it('fails when name is missing', () => {
    const action: NoteAction = {
      type: 'add_category',
      description: '',
      payload: { name: '', icon: '📌' },
    };
    const result = executeAction(action);
    expect(result.success).toBe(false);
  });

  it('defaults icon to 📌 when icon payload is empty', () => {
    const action: NoteAction = {
      type: 'add_category',
      description: '',
      payload: { name: 'New Category', icon: '' },
    };
    executeAction(action);
    const cat = useCategoryStore.getState().customCategories.find((c) => c.name === 'New Category');
    expect(cat).toBeDefined();
    expect(cat!.icon).toBe('📌');
  });
});

// ── remove_category ───────────────────────────────────────────────────────────

describe('CaregiverActions — remove_category', () => {
  it('removes an existing custom category by name', () => {
    useCategoryStore.getState().addCustomCategory('TempCategory', '⭐');
    const action: NoteAction = {
      type: 'remove_category',
      description: '',
      payload: { categoryName: 'TempCategory' },
    };
    const result = executeAction(action);
    expect(result.success).toBe(true);
    const cats = useCategoryStore.getState().customCategories;
    expect(cats.some((c) => c.name === 'TempCategory')).toBe(false);
  });

  it('fails when category name does not exist', () => {
    const action: NoteAction = {
      type: 'remove_category',
      description: '',
      payload: { categoryName: 'DoesNotExist' },
    };
    const result = executeAction(action);
    expect(result.success).toBe(false);
  });

  it('is case-insensitive for category name matching', () => {
    useCategoryStore.getState().addCustomCategory('MyCategory', '🎯');
    const action: NoteAction = {
      type: 'remove_category',
      description: '',
      payload: { categoryName: 'mycategory' },
    };
    const result = executeAction(action);
    expect(result.success).toBe(true);
  });
});

// ── boost_word ────────────────────────────────────────────────────────────────

describe('CaregiverActions — boost_word', () => {
  it('increases a word\'s count in predictionStore', () => {
    const action: NoteAction = {
      type: 'boost_word',
      description: '',
      payload: { word: 'because', boostCount: 5 },
    };
    executeAction(action);
    const freq = usePredictionStore.getState().wordFreq;
    expect(freq['because']).toBeDefined();
    expect(freq['because'].count).toBe(5);
  });

  it('adds to existing count when word is already known', () => {
    usePredictionStore.setState({ wordFreq: { because: { count: 10, lastUsed: 0 } } });
    const action: NoteAction = {
      type: 'boost_word',
      description: '',
      payload: { word: 'because', boostCount: 3 },
    };
    executeAction(action);
    expect(usePredictionStore.getState().wordFreq['because'].count).toBe(13);
  });

  it('clamps boost to minimum 1 for negative input', () => {
    const action: NoteAction = {
      type: 'boost_word',
      description: '',
      payload: { word: 'hello', boostCount: -5 },
    };
    executeAction(action);
    expect(usePredictionStore.getState().wordFreq['hello'].count).toBeGreaterThanOrEqual(1);
  });

  it('clamps boost to maximum 100', () => {
    const action: NoteAction = {
      type: 'boost_word',
      description: '',
      payload: { word: 'hello', boostCount: 500 },
    };
    executeAction(action);
    expect(usePredictionStore.getState().wordFreq['hello'].count).toBeLessThanOrEqual(100);
  });

  it('uses default boost of 10 for NaN input', () => {
    const action: NoteAction = {
      type: 'boost_word',
      description: '',
      payload: { word: 'hello', boostCount: NaN },
    };
    executeAction(action);
    expect(usePredictionStore.getState().wordFreq['hello'].count).toBe(10);
  });

  it('fails for empty word', () => {
    const action: NoteAction = {
      type: 'boost_word',
      description: '',
      payload: { word: '', boostCount: 5 },
    };
    const result = executeAction(action);
    expect(result.success).toBe(false);
  });

  it('lowercases the word key', () => {
    const action: NoteAction = {
      type: 'boost_word',
      description: '',
      payload: { word: 'BECAUSE', boostCount: 3 },
    };
    executeAction(action);
    expect(usePredictionStore.getState().wordFreq['because']).toBeDefined();
    expect(usePredictionStore.getState().wordFreq['BECAUSE']).toBeUndefined();
  });
});

// ── note_only ─────────────────────────────────────────────────────────────────

describe('CaregiverActions — note_only', () => {
  it('returns success without modifying any store', () => {
    const action: NoteAction = {
      type: 'note_only',
      description: 'Good session today',
      payload: {},
    };
    const result = executeAction(action);
    expect(result.success).toBe(true);
    // Stores remain empty
    expect(useCategoryStore.getState().customPhrases).toHaveLength(0);
  });
});

// ── default / unknown type ────────────────────────────────────────────────────

describe('CaregiverActions — unknown type', () => {
  it('returns success=false for an unrecognized action type', () => {
    const action = {
      type: 'unknown_future_type',
      description: 'Unknown',
      payload: {},
    } as unknown as NoteAction;
    const result = executeAction(action);
    expect(result.success).toBe(false);
    expect(result.message).toMatch(/Unknown action type/);
  });
});

// ── executeAllActions ─────────────────────────────────────────────────────────

describe('CaregiverActions — executeAllActions', () => {
  it('returns one result per action', () => {
    const actions: NoteAction[] = [
      { type: 'note_only', description: '', payload: {} },
      { type: 'note_only', description: '', payload: {} },
    ];
    const results = executeAllActions(actions);
    expect(results).toHaveLength(2);
  });

  it('one failing action does not prevent subsequent actions from running', () => {
    const actions: NoteAction[] = [
      { type: 'add_phrase', description: '', payload: { categoryId: '', text: '' } }, // fails
      { type: 'add_category', description: '', payload: { name: 'GoodCat', icon: '⭐' } }, // succeeds
    ];
    const results = executeAllActions(actions);
    expect(results[0].success).toBe(false);
    expect(results[1].success).toBe(true);
  });

  it('returns empty array for empty input', () => {
    expect(executeAllActions([])).toEqual([]);
  });
});
