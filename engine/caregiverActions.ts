/**
 * Caregiver Action Execution Engine
 *
 * Translates NoteAction objects into actual store mutations.
 * Each action type maps to specific store operations.
 *
 * DESIGN PRINCIPLE: Actions are always previewed before execution.
 * The caregiver sees exactly what will change and taps [Apply].
 * This prevents accidental modifications to the child's AAC system.
 *
 * ═══════════════════════════════════════════════════════════════
 * REAL-WORLD ACTION SAMPLES WITH STORE MUTATIONS:
 *
 * ── add_phrase ──────────────────────────────────────────────
 * Caregiver: "Add 'I feel sick' to Help"
 * Action: { type: 'add_phrase', payload: { categoryId: 'help-needs', text: 'I feel sick' } }
 * Mutation: categoryStore.addCustomPhrase('help-needs', 'I feel sick')
 *
 * ── remove_phrase ───────────────────────────────────────────
 * Caregiver: "Remove Lake from Places"
 * Action: { type: 'remove_phrase', payload: { phraseText: 'Lake', categoryId: 'places-plans' } }
 * Mutation: categoryStore.removeCustomPhrase(matchedId) — only custom phrases can be removed
 *           For default phrases, they get hidden via a "hidden" list instead
 *
 * ── reorder_phrase ──────────────────────────────────────────
 * Caregiver: "Move Bathroom to top of Help page"
 * Action: { type: 'reorder_phrase', payload: { phraseId: 'help-bathroom', newSortOrder: 0, categoryId: 'help-needs' } }
 * Mutation: Shifts all phrases down by 1, sets target to sortOrder 0
 *
 * ── add_category ────────────────────────────────────────────
 * Caregiver: "Create a Feelings category"
 * Action: { type: 'add_category', payload: { name: 'Feelings', icon: '😊' } }
 * Mutation: categoryStore.addCustomCategory('Feelings', '😊')
 *
 * ── add_sequence ────────────────────────────────────────────
 * Caregiver: "Add McDonald's ordering flow"
 * Action: { type: 'add_sequence', payload: { name: "McDonald's", categoryId: 'food-ordering', steps: [...] } }
 * Mutation: categoryStore.addOrderingSequence({...})
 *
 * ── remove_sequence ─────────────────────────────────────────
 * Caregiver: "Remove Chipotle, he doesn't go there anymore"
 * Action: { type: 'remove_sequence', payload: { sequenceName: 'Chipotle' } }
 * Mutation: categoryStore.removeOrderingSequence(matchedId)
 *
 * ── boost_word ──────────────────────────────────────────────
 * Caregiver: "He's starting to use 'because' a lot"
 * Action: { type: 'boost_word', payload: { word: 'because', boostCount: 10 } }
 * Mutation: predictionStore.wordFreq['because'].count += 10
 *
 * ── note_only ───────────────────────────────────────────────
 * Caregiver: "Good session, eye contact improving"
 * Action: { type: 'note_only', payload: {} }
 * Mutation: None — stored as documentation only
 * ═══════════════════════════════════════════════════════════════
 */

import { NoteAction, OrderingSequenceData } from '@/types';
import { useCategoryStore } from '@/store/categoryStore';
import { usePredictionStore } from '@/store/predictionStore';

export interface ActionResult {
  success: boolean;
  message: string;
}

export function executeAction(action: NoteAction): ActionResult {
  const catStore = useCategoryStore.getState();
  const predStore = usePredictionStore.getState();

  switch (action.type) {
    case 'add_phrase': {
      const { categoryId, text } = action.payload as { categoryId: string; text: string };
      if (!categoryId || !text) return { success: false, message: 'Missing category or text' };
      catStore.addCustomPhrase(categoryId, text);
      return { success: true, message: `Added "${text}" to category` };
    }

    case 'remove_phrase': {
      const { phraseText, categoryId } = action.payload as { phraseText: string; categoryId: string };
      const phrases = catStore.getPhrasesForCategory(categoryId);
      const match = phrases.find((p) => p.text.toLowerCase() === phraseText.toLowerCase());
      if (!match) return { success: false, message: `Phrase "${phraseText}" not found` };
      if (match.isCustom) {
        catStore.removeCustomPhrase(match.id);
        return { success: true, message: `Removed "${phraseText}"` };
      }
      catStore.hideDefaultPhrase(match.id);
      return { success: true, message: `Hidden "${phraseText}" (can be restored in Settings)` };
    }

    case 'reorder_phrase': {
      const { phraseId, newSortOrder, categoryId } = action.payload as { phraseId: string; newSortOrder: number; categoryId: string };
      const phrases = catStore.getPhrasesForCategory(categoryId);
      const target = phrases.find((p) => p.id === phraseId);
      if (!target) return { success: false, message: 'Phrase not found' };
      if (!target.isCustom) catStore.hideDefaultPhrase(target.id);
      useCategoryStore.setState((s) => ({
        customPhrases: [
          ...s.customPhrases,
          { id: crypto.randomUUID(), categoryId, text: target.text, sortOrder: newSortOrder, isCustom: true, usageCount: 0 },
        ],
      }));
      return { success: true, message: `Moved "${target.text}" to position ${newSortOrder + 1}` };
    }

    case 'add_category': {
      const { name, icon } = action.payload as { name: string; icon: string };
      if (!name) return { success: false, message: 'Missing category name' };
      catStore.addCustomCategory(name, icon || '📌');
      return { success: true, message: `Created category "${name}"` };
    }

    case 'remove_category': {
      const { categoryName } = action.payload as { categoryName: string };
      const cats = catStore.allCategories();
      const match = cats.find((c) => c.name.toLowerCase() === categoryName.toLowerCase() && c.isCustom);
      if (!match) return { success: false, message: `"${categoryName}" is a default category and cannot be removed` };
      catStore.removeCustomCategory(match.id);
      return { success: true, message: `Removed category "${categoryName}"` };
    }

    case 'add_sequence': {
      const { name, categoryId, steps } = action.payload as {
        name: string; categoryId: string;
        steps?: Array<{ label: string; options: string[] }>;
      };
      if (!name) return { success: false, message: 'Missing sequence name' };

      const seq: OrderingSequenceData = {
        id: crypto.randomUUID(),
        name,
        categoryId: categoryId || 'food-ordering',
        sortOrder: catStore.getSequencesForCategory(categoryId || 'food-ordering').length,
        steps: (steps ?? [{ label: 'Order', options: ['Option 1', 'Option 2'] }]).map((s, si) => ({
          id: crypto.randomUUID(),
          label: s.label,
          stepOrder: si,
          options: s.options.map((o, oi) => ({
            id: crypto.randomUUID(),
            text: o,
            sortOrder: oi,
          })),
        })),
      };
      catStore.addOrderingSequence(seq);
      return { success: true, message: `Created "${name}" ordering flow with ${seq.steps.length} steps` };
    }

    case 'remove_sequence': {
      const { sequenceName } = action.payload as { sequenceName: string };
      const allSeqs = useCategoryStore.getState().orderingSequences;
      const match = allSeqs.find((s) => s.name.toLowerCase() === sequenceName.toLowerCase());
      if (!match) return { success: false, message: `Ordering flow "${sequenceName}" not found` };
      catStore.removeOrderingSequence(match.id);
      return { success: true, message: `Removed "${sequenceName}" ordering flow` };
    }

    case 'edit_sequence': {
      const { sequenceName, stepLabel, newOptions } = action.payload as {
        sequenceName: string; stepLabel: string; newOptions: string[];
      };
      const allSeqs = useCategoryStore.getState().orderingSequences;
      const seq = allSeqs.find((s) => s.name.toLowerCase() === sequenceName.toLowerCase());
      if (!seq) return { success: false, message: `Ordering flow "${sequenceName}" not found` };

      const updatedSeq = { ...seq, steps: seq.steps.map((step) => {
        if (step.label.toLowerCase() === stepLabel.toLowerCase()) {
          const existingTexts = new Set(step.options.map((o) => o.text.toLowerCase()));
          const additions = newOptions.filter((o) => !existingTexts.has(o.toLowerCase()));
          return {
            ...step,
            options: [
              ...step.options,
              ...additions.map((text, i) => ({
                id: crypto.randomUUID(),
                text,
                sortOrder: step.options.length + i,
              })),
            ],
          };
        }
        return step;
      })};
      catStore.updateOrderingSequence(updatedSeq);
      return { success: true, message: `Updated "${sequenceName}" → ${stepLabel}` };
    }

    case 'boost_word': {
      const { word, boostCount } = action.payload as { word: string; boostCount: number };
      if (!word) return { success: false, message: 'Missing word' };
      const key = word.toLowerCase();
      const existing = predStore.wordFreq[key];
      const newFreq = {
        ...predStore.wordFreq,
        [key]: { count: (existing?.count ?? 0) + (boostCount || 10), lastUsed: Date.now() },
      };
      usePredictionStore.setState({ wordFreq: newFreq });
      return { success: true, message: `Boosted "${word}" prediction frequency by ${boostCount || 10}` };
    }

    case 'note_only':
      return { success: true, message: 'Note saved' };

    default:
      return { success: false, message: `Unknown action type: ${action.type}` };
  }
}

export function executeAllActions(actions: NoteAction[]): ActionResult[] {
  return actions.map(executeAction);
}
