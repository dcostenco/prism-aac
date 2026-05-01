export interface Category {
  id: string;
  name: string;
  icon: string;
  sortOrder: number;
  isCustom: boolean;
  nameKey?: string;
}

export interface Phrase {
  id: string;
  categoryId: string;
  text: string;
  translations?: Partial<Record<string, string>>;
  sortOrder: number;
  isCustom: boolean;
  usageCount: number;
  deletedAt?: number;
}

export type MathCategory =
  | 'basic'
  | 'digits'
  | 'algebra'
  | 'constants'
  | 'trig'
  | 'calculus'
  | 'greek'
  | 'logic-sets';

export interface MathItem {
  id: string;
  symbol: string;
  label: string;
  ttsText: string;
  category: MathCategory;
  sortOrder: number;
}

export interface OrderingSequenceData {
  id: string;
  name: string;
  categoryId: string;
  sortOrder: number;
  steps: OrderingStep[];
}

export interface OrderingStep {
  id: string;
  label: string;
  stepOrder: number;
  options: OrderingOption[];
}

export interface OrderingOption {
  id: string;
  text: string;
  sortOrder: number;
}

export interface WordFreqEntry {
  count: number;
  lastUsed: number;
  lastDecayedAt?: number;
}

export interface PredictionConfig {
  bigramWeight: number;
  frequencyWeight: number;
  recencyWeight: number;
  maxResults: number;
  recencyWindowMs: number;
}

export interface HistoryEntry {
  text: string;
  timestamp: number;
}

export type KeyboardMode = 'letters' | 'numbers' | 'symbols';
export type SidePanelView = 'none' | 'categories' | 'category-detail' | 'ordering' | 'math' | 'caregiver' | 'ai-chat' | 'schedule' | 'games' | 'marketplace';

// ── Caregiver Notes ──

export type NoteActionType =
  | 'add_phrase'        // "Add 'I feel sick' to Help"
  | 'remove_phrase'     // "Remove Lake from Places"
  | 'reorder_phrase'    // "Move Bathroom to top of Help"
  | 'add_category'      // "Create a Feelings category"
  | 'remove_category'   // "Remove the test category"
  | 'add_sequence'      // "Add McDonald's ordering flow"
  | 'edit_sequence'     // "Add milkshake to McDonald's drinks step"
  | 'remove_sequence'   // "Remove Chipotle ordering"
  | 'boost_word'        // "He uses 'because' a lot now"
  | 'note_only';        // "Good session today" — no action, just documentation

export interface NoteAction {
  type: NoteActionType;
  description: string;
  payload: Record<string, unknown>;
}

export interface CaregiverNote {
  id: string;
  text: string;
  timestamp: number;
  actions: NoteAction[];
  applied: boolean;
  authorName?: string;
}
