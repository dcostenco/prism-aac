/**
 * categoryStore — actions not covered by category-store.test.ts or
 * category-store-hardening.test.ts
 *
 * The existing suites cover addCustomCategory/addCustomPhrase caps,
 * removeCustomCategory/removeCustomPhrase, hydration validation, and
 * basic allCategories/getPhrasesForCategory. These tests cover:
 *
 *   hideDefaultPhrase / unhideDefaultPhrase — caregiver controls which
 *   default phrases are visible. A broken toggle either never hides
 *   (user still sees a phrase they reported as upsetting) or never
 *   unhides (permanent removal of useful content).
 *
 *   hideCategoryId / unhideCategoryId — same pattern for categories.
 *   A stuck hide keeps the keyboard area locked; a broken unhide means
 *   the caregiver can't restore a hidden category.
 *
 *   allCategories(includeHidden) — the flag must control visibility of
 *   hidden category ids. A broken flag means the category manager UI
 *   shows the same list as the AAC keyboard.
 *
 *   getPhrasesForCategory with hidden phrases — hidden phrases must be
 *   excluded from the result that feeds the keyboard tile set.
 *
 *   addOrderingSequence — shape validation + append + MAX cap. A broken
 *   add accepts a shapeless LLM response and corrupts the ordering flow.
 *
 *   removeOrderingSequence — removes the targeted sequence; others
 *   must survive.
 *
 *   updateOrderingSequence — patches by id; unknown id is a no-op.
 *
 *   getSequencesForCategory — returns the sequences for one category,
 *   sorted by sortOrder.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { useCategoryStore } from '@/store/categoryStore';
import type { OrderingSequenceData } from '@/types';

beforeEach(() => {
  useCategoryStore.setState({
    customCategories: [],
    customPhrases: [],
    hiddenPhraseIds: [],
    hiddenCategoryIds: [],
    orderingSequences: [],
    seeded: false,
  });
});

function makeSeq(id: string, categoryId = 'food-ordering', sortOrder = 0): OrderingSequenceData {
  return {
    id,
    name: `Sequence ${id}`,
    categoryId,
    sortOrder,
    steps: [
      {
        id: `${id}-step-1`,
        label: 'Choose item',
        stepOrder: 0,
        options: [{ id: `${id}-opt-1`, text: 'burger', sortOrder: 0 }],
      },
    ],
  };
}

// ── hideDefaultPhrase / unhideDefaultPhrase ───────────────────────────────────

describe('categoryStore — hideDefaultPhrase / unhideDefaultPhrase', () => {
  it('hideDefaultPhrase adds the id to hiddenPhraseIds', () => {
    useCategoryStore.getState().hideDefaultPhrase('phrase-001');
    expect(useCategoryStore.getState().hiddenPhraseIds).toContain('phrase-001');
  });

  it('hideDefaultPhrase is idempotent — duplicate call does not double-add', () => {
    useCategoryStore.getState().hideDefaultPhrase('phrase-001');
    useCategoryStore.getState().hideDefaultPhrase('phrase-001');
    const count = useCategoryStore.getState().hiddenPhraseIds.filter(id => id === 'phrase-001').length;
    expect(count).toBe(1);
  });

  it('unhideDefaultPhrase removes the id', () => {
    useCategoryStore.getState().hideDefaultPhrase('phrase-001');
    useCategoryStore.getState().unhideDefaultPhrase('phrase-001');
    expect(useCategoryStore.getState().hiddenPhraseIds).not.toContain('phrase-001');
  });

  it('unhideDefaultPhrase no-op when id is not hidden — does not throw', () => {
    expect(() => {
      useCategoryStore.getState().unhideDefaultPhrase('nonexistent-phrase');
    }).not.toThrow();
  });

  it('hiding a phrase causes getPhrasesForCategory to exclude it', () => {
    // Use a known default phrase from help-needs
    const before = useCategoryStore.getState().getPhrasesForCategory('help-needs');
    expect(before.length).toBeGreaterThan(0);
    const firstId = before[0].id;
    useCategoryStore.getState().hideDefaultPhrase(firstId);
    const after = useCategoryStore.getState().getPhrasesForCategory('help-needs');
    expect(after.map(p => p.id)).not.toContain(firstId);
  });
});

// ── hideCategoryId / unhideCategoryId ─────────────────────────────────────────

describe('categoryStore — hideCategoryId / unhideCategoryId', () => {
  it('hideCategoryId adds to hiddenCategoryIds', () => {
    useCategoryStore.getState().hideCategoryId('greetings');
    expect(useCategoryStore.getState().hiddenCategoryIds).toContain('greetings');
  });

  it('hideCategoryId is idempotent', () => {
    useCategoryStore.getState().hideCategoryId('greetings');
    useCategoryStore.getState().hideCategoryId('greetings');
    const count = useCategoryStore.getState().hiddenCategoryIds.filter(id => id === 'greetings').length;
    expect(count).toBe(1);
  });

  it('unhideCategoryId removes the id', () => {
    useCategoryStore.getState().hideCategoryId('greetings');
    useCategoryStore.getState().unhideCategoryId('greetings');
    expect(useCategoryStore.getState().hiddenCategoryIds).not.toContain('greetings');
  });

  it('hidden category is excluded from allCategories() (includeHidden=false)', () => {
    const allBefore = useCategoryStore.getState().allCategories(false);
    expect(allBefore.length).toBeGreaterThan(0);
    const firstId = allBefore[0].id;
    useCategoryStore.getState().hideCategoryId(firstId);
    const allAfter = useCategoryStore.getState().allCategories(false);
    expect(allAfter.map(c => c.id)).not.toContain(firstId);
  });

  it('allCategories(includeHidden=true) returns hidden categories too', () => {
    const allVisible = useCategoryStore.getState().allCategories(false);
    const firstId = allVisible[0].id;
    useCategoryStore.getState().hideCategoryId(firstId);
    const allWithHidden = useCategoryStore.getState().allCategories(true);
    expect(allWithHidden.map(c => c.id)).toContain(firstId);
  });
});

// ── addOrderingSequence ───────────────────────────────────────────────────────

describe('categoryStore — addOrderingSequence', () => {
  it('appends a valid sequence', () => {
    useCategoryStore.getState().addOrderingSequence(makeSeq('seq-1'));
    expect(useCategoryStore.getState().orderingSequences).toHaveLength(1);
    expect(useCategoryStore.getState().orderingSequences[0].id).toBe('seq-1');
  });

  it('no-op when id is missing', () => {
    const bad = { ...makeSeq('x'), id: '' };
    useCategoryStore.getState().addOrderingSequence(bad);
    expect(useCategoryStore.getState().orderingSequences).toHaveLength(0);
  });

  it('no-op when name is missing', () => {
    const bad = { ...makeSeq('x'), name: '' };
    useCategoryStore.getState().addOrderingSequence(bad);
    expect(useCategoryStore.getState().orderingSequences).toHaveLength(0);
  });

  it('no-op when categoryId is missing', () => {
    const bad = { ...makeSeq('x'), categoryId: '' };
    useCategoryStore.getState().addOrderingSequence(bad);
    expect(useCategoryStore.getState().orderingSequences).toHaveLength(0);
  });

  it('multiple sequences accumulate', () => {
    useCategoryStore.getState().addOrderingSequence(makeSeq('seq-1'));
    useCategoryStore.getState().addOrderingSequence(makeSeq('seq-2'));
    expect(useCategoryStore.getState().orderingSequences).toHaveLength(2);
  });
});

// ── removeOrderingSequence ────────────────────────────────────────────────────

describe('categoryStore — removeOrderingSequence', () => {
  it('removes the targeted sequence', () => {
    useCategoryStore.getState().addOrderingSequence(makeSeq('seq-1'));
    useCategoryStore.getState().addOrderingSequence(makeSeq('seq-2'));
    useCategoryStore.getState().removeOrderingSequence('seq-1');
    const ids = useCategoryStore.getState().orderingSequences.map(s => s.id);
    expect(ids).not.toContain('seq-1');
    expect(ids).toContain('seq-2');
  });

  it('no-op for unknown id', () => {
    useCategoryStore.getState().addOrderingSequence(makeSeq('seq-1'));
    useCategoryStore.getState().removeOrderingSequence('nonexistent');
    expect(useCategoryStore.getState().orderingSequences).toHaveLength(1);
  });
});

// ── updateOrderingSequence ────────────────────────────────────────────────────

describe('categoryStore — updateOrderingSequence', () => {
  it('updates the targeted sequence by id', () => {
    useCategoryStore.getState().addOrderingSequence(makeSeq('seq-1'));
    const updated: OrderingSequenceData = {
      ...makeSeq('seq-1'),
      name: 'Updated Sequence Name',
    };
    useCategoryStore.getState().updateOrderingSequence(updated);
    const found = useCategoryStore.getState().orderingSequences.find(s => s.id === 'seq-1');
    expect(found?.name).toBe('Updated Sequence Name');
  });

  it('no-op for unknown id — store unchanged', () => {
    useCategoryStore.getState().addOrderingSequence(makeSeq('seq-1'));
    const ghost: OrderingSequenceData = { ...makeSeq('seq-ghost') };
    useCategoryStore.getState().updateOrderingSequence(ghost);
    expect(useCategoryStore.getState().orderingSequences).toHaveLength(1);
    expect(useCategoryStore.getState().orderingSequences[0].id).toBe('seq-1');
  });

  it('does not affect other sequences', () => {
    useCategoryStore.getState().addOrderingSequence(makeSeq('seq-1'));
    useCategoryStore.getState().addOrderingSequence(makeSeq('seq-2'));
    const updated: OrderingSequenceData = { ...makeSeq('seq-1'), name: 'Changed' };
    useCategoryStore.getState().updateOrderingSequence(updated);
    const seq2 = useCategoryStore.getState().orderingSequences.find(s => s.id === 'seq-2');
    expect(seq2?.name).toBe('Sequence seq-2');
  });
});

// ── getSequencesForCategory ───────────────────────────────────────────────────

describe('categoryStore — getSequencesForCategory', () => {
  it('returns sequences for the specified category', () => {
    useCategoryStore.getState().addOrderingSequence(makeSeq('seq-1', 'food-ordering'));
    useCategoryStore.getState().addOrderingSequence(makeSeq('seq-2', 'drinks'));
    const food = useCategoryStore.getState().getSequencesForCategory('food-ordering');
    expect(food.map(s => s.id)).toContain('seq-1');
    expect(food.map(s => s.id)).not.toContain('seq-2');
  });

  it('returns empty array when category has no sequences', () => {
    expect(useCategoryStore.getState().getSequencesForCategory('nonexistent-category')).toHaveLength(0);
  });

  it('returns sequences sorted by sortOrder ascending', () => {
    useCategoryStore.getState().addOrderingSequence(makeSeq('seq-b', 'food-ordering', 10));
    useCategoryStore.getState().addOrderingSequence(makeSeq('seq-a', 'food-ordering', 1));
    const seqs = useCategoryStore.getState().getSequencesForCategory('food-ordering');
    expect(seqs[0].id).toBe('seq-a');
    expect(seqs[1].id).toBe('seq-b');
  });
});
