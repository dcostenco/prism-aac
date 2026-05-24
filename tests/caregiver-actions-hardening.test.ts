/**
 * caregiverActions hardening — reorder_phrase, edit_sequence, custom-phrase
 * removal, and security clamping cases not covered by caregiver-system.test.ts.
 *
 * Safety-critical: caregivers modify a non-verbal child's AAC phrase set.
 * Injection via overly-long strings must be clamped; NaN/overflow sort orders
 * must not corrupt the phrase list; the 1000-phrase cap must hold under load.
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
  usePredictionStore.setState({ wordFreq: {}, bigrams: {} });
});

// ── remove_phrase (custom) ────────────────────────────────────────────────────

describe('CaregiverActions — remove_phrase custom phrase', () => {
  it('removes a custom phrase from its category', () => {
    // Use a phrase text guaranteed not to exist in DEFAULT_PHRASES
    useCategoryStore.getState().addCustomPhrase('help-needs', 'UniqueCustomPhrase_99xz');
    expect(useCategoryStore.getState().getPhrasesForCategory('help-needs').some(p => p.text === 'UniqueCustomPhrase_99xz')).toBe(true);

    const result = executeAction({
      type: 'remove_phrase',
      description: 'Remove custom phrase',
      payload: { phraseText: 'UniqueCustomPhrase_99xz', categoryId: 'help-needs' },
    });

    expect(result.success).toBe(true);
    expect(result.message).toContain('Removed');
    expect(useCategoryStore.getState().getPhrasesForCategory('help-needs').some(p => p.text === 'UniqueCustomPhrase_99xz')).toBe(false);
  });

  it('case-insensitive match removes custom phrase', () => {
    useCategoryStore.getState().addCustomPhrase('help-needs', 'MyXxPhraseHere99');
    const result = executeAction({
      type: 'remove_phrase',
      description: 'Case mismatch',
      payload: { phraseText: 'MYXXPHRASEHERE99', categoryId: 'help-needs' },
    });
    expect(result.success).toBe(true);
    expect(useCategoryStore.getState().getPhrasesForCategory('help-needs').some(p => p.text === 'MyXxPhraseHere99')).toBe(false);
  });

  it('fails when phrase not found', () => {
    const result = executeAction({
      type: 'remove_phrase',
      description: 'Remove nonexistent phrase',
      payload: { phraseText: 'this phrase does not exist xyz', categoryId: 'help-needs' },
    });
    expect(result.success).toBe(false);
    expect(result.message).toMatch(/not found/i);
  });

  it('does not remove phrases from a different category', () => {
    useCategoryStore.getState().addCustomPhrase('feelings', 'UniqueFeelings99xz');
    const result = executeAction({
      type: 'remove_phrase',
      description: 'Wrong category',
      payload: { phraseText: 'UniqueFeelings99xz', categoryId: 'help-needs' },
    });
    expect(result.success).toBe(false);
    // Phrase still exists in its correct category
    expect(useCategoryStore.getState().getPhrasesForCategory('feelings').some(p => p.text === 'UniqueFeelings99xz')).toBe(true);
  });
});

// ── reorder_phrase ────────────────────────────────────────────────────────────

describe('CaregiverActions — reorder_phrase', () => {
  let customPhraseId: string;

  beforeEach(() => {
    useCategoryStore.getState().addCustomPhrase('help-needs', 'ReorderTestPhrase99xz');
    const phrases = useCategoryStore.getState().getPhrasesForCategory('help-needs');
    const custom = phrases.find(p => p.text === 'ReorderTestPhrase99xz' && p.isCustom)!;
    customPhraseId = custom.id;
  });

  it('moves phrase to new position and reports it', () => {
    const result = executeAction({
      type: 'reorder_phrase',
      description: 'Move to top',
      payload: { phraseId: customPhraseId, newSortOrder: 0, categoryId: 'help-needs' },
    });
    expect(result.success).toBe(true);
    // message: `Moved "${target.text}" to position ${safeOrder + 1}`
    expect(result.message).toMatch(/position 1/);
  });

  it('NaN sortOrder is clamped to 0 → position 1', () => {
    const result = executeAction({
      type: 'reorder_phrase',
      description: 'NaN sortOrder',
      payload: { phraseId: customPhraseId, newSortOrder: NaN, categoryId: 'help-needs' },
    });
    expect(result.success).toBe(true);
    expect(result.message).toMatch(/position 1/);
  });

  it('negative sortOrder is clamped to 0 → position 1', () => {
    const result = executeAction({
      type: 'reorder_phrase',
      description: 'Negative sortOrder',
      payload: { phraseId: customPhraseId, newSortOrder: -999, categoryId: 'help-needs' },
    });
    expect(result.success).toBe(true);
    expect(result.message).toMatch(/position 1/);
  });

  it('sortOrder over 9999 is clamped to 9999 → position 10000', () => {
    const result = executeAction({
      type: 'reorder_phrase',
      description: 'Overflow sortOrder',
      payload: { phraseId: customPhraseId, newSortOrder: 99999, categoryId: 'help-needs' },
    });
    expect(result.success).toBe(true);
    expect(result.message).toMatch(/position 10000/);
  });

  it('fails when phraseId not found in category', () => {
    const result = executeAction({
      type: 'reorder_phrase',
      description: 'Nonexistent phrase',
      payload: { phraseId: 'does-not-exist-uuid', newSortOrder: 0, categoryId: 'help-needs' },
    });
    expect(result.success).toBe(false);
    expect(result.message).toMatch(/not found/i);
  });

  it('does not add phrase beyond 1000-phrase cap', () => {
    // Pre-fill exactly 1000 live custom phrases (none have deletedAt)
    const bigPhrases = Array.from({ length: 1000 }, (_, i) => ({
      id: `cap-${i}`,
      categoryId: 'help-needs',
      text: `Cap phrase ${i}`,
      sortOrder: i,
      isCustom: true as const,
      usageCount: 0,
    }));
    useCategoryStore.setState({ customPhrases: bigPhrases });

    const target = useCategoryStore.getState().getPhrasesForCategory('help-needs')[0];
    const countBefore = useCategoryStore.getState().customPhrases.length;

    executeAction({
      type: 'reorder_phrase',
      description: 'Reorder at cap',
      payload: { phraseId: target.id, newSortOrder: 0, categoryId: 'help-needs' },
    });

    // setState should have returned `s` unchanged (liveCount >= 1000)
    expect(useCategoryStore.getState().customPhrases.length).toBe(countBefore);
  });
});

// ── edit_sequence ─────────────────────────────────────────────────────────────

describe('CaregiverActions — edit_sequence', () => {
  beforeEach(() => {
    executeAction({
      type: 'add_sequence',
      description: 'Coffee Shop sequence',
      payload: {
        name: 'Coffee Shop',
        categoryId: 'food-ordering',
        steps: [
          { label: 'Size', options: ['Small', 'Medium', 'Large'] },
          { label: 'Drink', options: ['Coffee', 'Tea'] },
        ],
      },
    });
  });

  it('adds new options to a matching step', () => {
    const result = executeAction({
      type: 'edit_sequence',
      description: 'Add Hot Chocolate to Drink',
      payload: { sequenceName: 'Coffee Shop', stepLabel: 'Drink', newOptions: ['Hot Chocolate', 'Juice'] },
    });
    expect(result.success).toBe(true);

    const seq = useCategoryStore.getState().orderingSequences.find(s => s.name === 'Coffee Shop')!;
    const drinkTexts = seq.steps.find(s => s.label === 'Drink')!.options.map(o => o.text);
    expect(drinkTexts).toContain('Hot Chocolate');
    expect(drinkTexts).toContain('Juice');
    expect(drinkTexts).toContain('Coffee');  // original preserved
    expect(drinkTexts).toContain('Tea');      // original preserved
  });

  it('deduplicates options case-insensitively — does not re-add existing', () => {
    executeAction({
      type: 'edit_sequence',
      description: 'Try to re-add Coffee',
      payload: { sequenceName: 'Coffee Shop', stepLabel: 'Drink', newOptions: ['COFFEE', 'Latte'] },
    });

    const seq = useCategoryStore.getState().orderingSequences.find(s => s.name === 'Coffee Shop')!;
    const drinkOptions = seq.steps.find(s => s.label === 'Drink')!.options;
    const coffeeCount = drinkOptions.filter(o => o.text.toLowerCase() === 'coffee').length;
    expect(coffeeCount).toBe(1);                // no duplicate
    expect(drinkOptions.map(o => o.text)).toContain('Latte'); // new addition
  });

  it('fails when sequence name not found', () => {
    const result = executeAction({
      type: 'edit_sequence',
      description: 'Edit nonexistent sequence',
      payload: { sequenceName: 'Does Not Exist', stepLabel: 'Drink', newOptions: ['Coffee'] },
    });
    expect(result.success).toBe(false);
    expect(result.message).toMatch(/not found/i);
  });

  it('truncates newOptions to max 30 items', () => {
    // 35 unique options — only first 30 should be processed
    const manyOptions = Array.from({ length: 35 }, (_, i) => `NewItem${i}`);
    const result = executeAction({
      type: 'edit_sequence',
      description: 'Overflow options',
      payload: { sequenceName: 'Coffee Shop', stepLabel: 'Drink', newOptions: manyOptions },
    });
    expect(result.success).toBe(true);

    const seq = useCategoryStore.getState().orderingSequences.find(s => s.name === 'Coffee Shop')!;
    const drinkStep = seq.steps.find(s => s.label === 'Drink')!;
    // 2 original + at most 30 new = at most 32
    expect(drinkStep.options.length).toBeLessThanOrEqual(32);
    // But more than original 2 (some were added)
    expect(drinkStep.options.length).toBeGreaterThan(2);
  });

  it('step not matching stepLabel leaves other steps untouched', () => {
    executeAction({
      type: 'edit_sequence',
      description: 'Edit Size step',
      payload: { sequenceName: 'Coffee Shop', stepLabel: 'Size', newOptions: ['Venti'] },
    });

    const seq = useCategoryStore.getState().orderingSequences.find(s => s.name === 'Coffee Shop')!;
    const sizeTexts = seq.steps.find(s => s.label === 'Size')!.options.map(o => o.text);
    expect(sizeTexts).toContain('Venti');

    // Drink step unchanged
    const drinkTexts = seq.steps.find(s => s.label === 'Drink')!.options.map(o => o.text);
    expect(drinkTexts).toEqual(['Coffee', 'Tea']);
  });
});

// ── security: input clamping ──────────────────────────────────────────────────

describe('CaregiverActions — security: input clamping', () => {
  it('add_phrase clamps text to 500 chars', () => {
    const result = executeAction({
      type: 'add_phrase',
      description: 'Inject long text',
      payload: { categoryId: 'help-needs', text: 'x'.repeat(600) },
    });
    expect(result.success).toBe(true);
    const custom = useCategoryStore.getState().getPhrasesForCategory('help-needs').find(p => p.isCustom)!;
    expect(custom.text.length).toBe(500);
  });

  it('add_category defaults null/empty icon to 📌', () => {
    executeAction({
      type: 'add_category',
      description: 'No icon',
      payload: { name: 'Silent Category', icon: '' },
    });
    const cat = useCategoryStore.getState().allCategories().find(c => c.name === 'Silent Category')!;
    expect(cat).toBeDefined();
    expect(cat.icon).toBe('📌');
  });

  it('add_category fails when name is empty', () => {
    const result = executeAction({
      type: 'add_category',
      description: 'Empty name',
      payload: { name: '', icon: '🧪' },
    });
    expect(result.success).toBe(false);
    expect(result.message).toMatch(/missing/i);
  });

  it('boost_word NaN boostCount defaults to 10', () => {
    executeAction({
      type: 'boost_word',
      description: 'NaN boost',
      payload: { word: 'because', boostCount: NaN },
    });
    expect(usePredictionStore.getState().wordFreq['because'].count).toBe(10);
  });

  it('boost_word boostCount > 100 is clamped to 100', () => {
    executeAction({
      type: 'boost_word',
      description: 'Overflow boost',
      payload: { word: 'therefore', boostCount: 9999 },
    });
    expect(usePredictionStore.getState().wordFreq['therefore'].count).toBe(100);
  });

  it('boost_word boostCount < 1 is clamped to 1', () => {
    executeAction({
      type: 'boost_word',
      description: 'Zero boost',
      payload: { word: 'however', boostCount: 0 },
    });
    expect(usePredictionStore.getState().wordFreq['however'].count).toBe(1);
  });

  it('boost_word empty word returns failure', () => {
    const result = executeAction({
      type: 'boost_word',
      description: 'Empty word',
      payload: { word: '', boostCount: 5 },
    });
    expect(result.success).toBe(false);
    expect(result.message).toMatch(/invalid/i);
  });

  it('add_sequence truncates steps to 20', () => {
    const manySteps = Array.from({ length: 25 }, (_, i) => ({
      label: `Step ${i + 1}`,
      options: ['Option A'],
    }));
    const result = executeAction({
      type: 'add_sequence',
      description: 'Too many steps',
      payload: { name: 'Big Sequence', categoryId: 'food-ordering', steps: manySteps },
    });
    expect(result.success).toBe(true);
    const seq = useCategoryStore.getState().orderingSequences.find(s => s.name === 'Big Sequence')!;
    expect(seq.steps.length).toBe(20);
  });

  it('add_sequence truncates each step options to 10', () => {
    const result = executeAction({
      type: 'add_sequence',
      description: 'Options overflow',
      payload: {
        name: 'Many Options',
        categoryId: 'food-ordering',
        steps: [{ label: 'Choose', options: Array.from({ length: 15 }, (_, i) => `Option ${i}`) }],
      },
    });
    expect(result.success).toBe(true);
    const seq = useCategoryStore.getState().orderingSequences.find(s => s.name === 'Many Options')!;
    expect(seq.steps[0].options.length).toBe(10);
  });

  it('unknown action type returns failure', () => {
    const result = executeAction({
      type: 'unknown_future_type' as never,
      description: 'Unknown',
      payload: {},
    });
    expect(result.success).toBe(false);
    expect(result.message).toMatch(/unknown action/i);
  });
});

// ── executeAllActions batch ───────────────────────────────────────────────────

describe('CaregiverActions — executeAllActions batch behavior', () => {
  it('returns one result per action including failures', () => {
    const actions: NoteAction[] = [
      { type: 'add_phrase', description: 'a', payload: { categoryId: 'help-needs', text: 'Phrase 1' } },
      { type: 'add_phrase', description: 'b', payload: { categoryId: 'help-needs', text: '' } }, // fails: empty text
      { type: 'note_only', description: 'c', payload: {} },
    ];
    const results = executeAllActions(actions);
    expect(results).toHaveLength(3);
    expect(results[0].success).toBe(true);
    expect(results[1].success).toBe(false);
    expect(results[2].success).toBe(true);
  });

  it('continues processing after a failed action', () => {
    const actions: NoteAction[] = [
      { type: 'remove_phrase', description: 'fail', payload: { phraseText: 'nonexistent', categoryId: 'help-needs' } },
      { type: 'add_phrase', description: 'succeed', payload: { categoryId: 'help-needs', text: 'New phrase' } },
    ];
    const results = executeAllActions(actions);
    expect(results[0].success).toBe(false);
    expect(results[1].success).toBe(true);
    expect(useCategoryStore.getState().getPhrasesForCategory('help-needs').some(p => p.text === 'New phrase')).toBe(true);
  });

  it('empty actions array returns empty results', () => {
    const results = executeAllActions([]);
    expect(results).toEqual([]);
  });
});
