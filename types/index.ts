export interface Category {
  id: string;
  name: string;
  icon: string;
  sortOrder: number;
  isCustom: boolean;
}

export interface Phrase {
  id: string;
  categoryId: string;
  text: string;
  sortOrder: number;
  isCustom: boolean;
  usageCount: number;
}

export interface MathItem {
  id: string;
  symbol: string;
  label: string;
  ttsText: string;
  category: 'basic' | 'advanced';
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
export type SidePanelView = 'none' | 'categories' | 'category-detail' | 'ordering' | 'math';
