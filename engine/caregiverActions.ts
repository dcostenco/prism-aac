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
import { recordCaregiverGotcha } from '@/services/aacGotchaRecorder';
import { useSettingsStore } from '@/store/settingsStore';

export interface ActionResult {
  success: boolean;
  message: string;
}

export function executeAction(action: NoteAction): ActionResult {
  const catStore = useCategoryStore.getState();
  const predStore = usePredictionStore.getState();

  switch (action.type) {
    case 'add_phrase': {
      const raw = action.payload as { categoryId: string; text: string };
      const categoryId = String(raw.categoryId ?? '').slice(0, 80);
      const text = String(raw.text ?? '').slice(0, 500);
      if (!categoryId || !text) return { success: false, message: 'Missing category or text' };
      catStore.addCustomPhrase(categoryId, text);
      return { success: true, message: `Added phrase to category` };
    }

    case 'remove_phrase': {
      const { phraseText, categoryId } = action.payload as { phraseText: string; categoryId: string };
      const safePhrase = String(phraseText ?? '').slice(0, 500);
      const safeCatId = String(categoryId ?? '').slice(0, 80);
      const phrases = catStore.getPhrasesForCategory(safeCatId);
      const match = phrases.find((p) => p.text.toLowerCase() === safePhrase.toLowerCase());
      if (!match) return { success: false, message: `Phrase "${safePhrase}" not found` };
      if (match.isCustom) {
        catStore.removeCustomPhrase(match.id);
        return { success: true, message: `Removed "${safePhrase}"` };
      }
      catStore.hideDefaultPhrase(match.id);
      return { success: true, message: `Hidden "${safePhrase}" (can be restored in Settings)` };
    }

    case 'reorder_phrase': {
      const { phraseId, newSortOrder, categoryId } = action.payload as { phraseId: string; newSortOrder: number; categoryId: string };
      const safeOrder = typeof newSortOrder === 'number' && Number.isFinite(newSortOrder)
        ? Math.max(0, Math.min(Math.floor(newSortOrder), 9999)) : 0;
      const safeCategoryId = String(categoryId ?? '').slice(0, 64);
      const phrases = catStore.getPhrasesForCategory(safeCategoryId);
      const target = phrases.find((p) => p.id === phraseId);
      if (!target) return { success: false, message: 'Phrase not found' };
      if (!target.isCustom) catStore.hideDefaultPhrase(target.id);
      useCategoryStore.setState((s) => {
        const liveCount = s.customPhrases.filter((p) => !p.deletedAt).length;
        if (liveCount >= 1000) return s;  // respect MAX_CUSTOM_PHRASES cap
        return {
          customPhrases: [
            ...s.customPhrases,
            { id: crypto.randomUUID(), categoryId: safeCategoryId, text: target.text, sortOrder: safeOrder, isCustom: true, usageCount: 0 },
          ],
        };
      });
      return { success: true, message: `Moved "${target.text}" to position ${safeOrder + 1}` };
    }

    case 'add_category': {
      const rawCat = action.payload as { name: string; icon: string };
      const name = String(rawCat.name ?? '').slice(0, 80);
      const icon = String(rawCat.icon ?? '📌').slice(0, 8);
      if (!name) return { success: false, message: 'Missing category name' };
      catStore.addCustomCategory(name, icon || '📌');
      return { success: true, message: `Created category` };
    }

    case 'remove_category': {
      const { categoryName } = action.payload as { categoryName: string };
      const cats = catStore.allCategories(true);
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

      const MAX_STEPS = 20;
      const MAX_OPTIONS = 10;
      const seqName = String(name ?? '').slice(0, 80);
      const safeSteps = (steps ?? [{ label: 'Order', options: ['Option 1', 'Option 2'] }]).slice(0, MAX_STEPS).map((s: { label: string; options: string[] }) => ({
        label: String(s.label ?? '').slice(0, 80),
        options: (s.options ?? []).slice(0, MAX_OPTIONS).map((o: string) => String(o).slice(0, 200)),
      }));
      const seq: OrderingSequenceData = {
        id: crypto.randomUUID(),
        name: seqName,
        categoryId: categoryId || 'food-ordering',
        sortOrder: catStore.getSequencesForCategory(categoryId || 'food-ordering').length,
        steps: safeSteps.map((s, si) => ({
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
      return { success: true, message: `Created "${seqName}" ordering flow with ${seq.steps.length} steps` };
    }

    case 'remove_sequence': {
      const { sequenceName } = action.payload as { sequenceName: string };
      const safeName = String(sequenceName ?? '').slice(0, 80);
      const allSeqs = useCategoryStore.getState().orderingSequences;
      const match = allSeqs.find((s) => s.name.toLowerCase() === safeName.toLowerCase());
      if (!match) return { success: false, message: `Ordering flow "${safeName}" not found` };
      catStore.removeOrderingSequence(match.id);
      return { success: true, message: `Removed "${safeName}" ordering flow` };
    }

    case 'edit_sequence': {
      const { sequenceName, stepLabel, newOptions } = action.payload as {
        sequenceName: string; stepLabel: string; newOptions: string[];
      };
      const allSeqs = useCategoryStore.getState().orderingSequences;
      const seq = allSeqs.find((s) => s.name.toLowerCase() === sequenceName.toLowerCase());
      if (!seq) return { success: false, message: `Ordering flow "${sequenceName}" not found` };

      const safeNewOptions = (newOptions ?? []).slice(0, 30).map((o: unknown) => String(o ?? '').slice(0, 500)).filter(Boolean);
      const updatedSeq = { ...seq, steps: seq.steps.map((step) => {
        if (step.label.toLowerCase() === stepLabel.toLowerCase()) {
          const existingTexts = new Set(step.options.map((o) => o.text.toLowerCase()));
          const additions = safeNewOptions.filter((o) => !existingTexts.has(o.toLowerCase()));
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
      const key = String(word ?? '').toLowerCase().slice(0, 100);
      if (!key) return { success: false, message: 'Invalid word' };
      const rawBoost = typeof boostCount === 'number' && Number.isFinite(boostCount) ? boostCount : 10;
      const clampedBoost = Math.min(Math.max(1, rawBoost), 100);
      const existing = predStore.wordFreq[key];
      const newFreq = {
        ...predStore.wordFreq,
        [key]: { count: (existing?.count ?? 0) + clampedBoost, lastUsed: Date.now() },
      };
      usePredictionStore.setState({ wordFreq: newFreq });
      return { success: true, message: `Boosted "${word}" prediction frequency by ${clampedBoost}` };
    }

    case 'note_only':
      return { success: true, message: 'Note saved' };

    default:
      return { success: false, message: `Unknown action type: ${action.type}` };
  }
}

export function executeAllActions(actions: NoteAction[]): ActionResult[] {
  const results = actions.map(executeAction);

  // v14.0.0 audit-hooks integration: each successful caregiver correction
  // becomes a gotcha record in the local IndexedDB corpus. Fire-and-forget
  // (recordCaregiverGotcha never throws). After ~50 sessions the corpus
  // is large enough for the v14 gate to surface clarifying questions to
  // future caregiver-note prompts. No PHI leaves the device.
  try {
    const userLang = useSettingsStore.getState().language;
    actions.forEach((action, i) => {
      const ok = results[i]?.success ?? false;
      // Don't await — corpus persistence must never block the AAC UX.
      void recordCaregiverGotcha(action, ok, userLang);
    });
  } catch {
    // Defensive: store/idb access can throw in odd test envs. Never bubble.
  }

  return results;
}
