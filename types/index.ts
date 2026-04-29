// Prism AAC — Core Type Definitions

export type SubscriptionTier = 'free' | 'standard' | 'advanced' | 'enterprise';

export type ToneStyle =
  | 'cheerful'
  | 'sad'
  | 'angry'
  | 'excited'
  | 'friendly'
  | 'hopeful'
  | 'calm'
  | 'serious'
  | 'empathetic';

export interface Category {
  id: string;
  name: string;
  icon: string;
  parentId: string | null;
  sortOrder: number;
  isCustom: boolean;
  createdAt: string;
}

export interface Phrase {
  id: string;
  categoryId: string;
  text: string;
  displayText: string | null;
  imageUri: string | null;
  ttsOverride: string | null;
  tone: ToneStyle;
  sortOrder: number;
  isCustom: boolean;
  usageCount: number;
  lastUsed: string | null;
  createdAt: string;
}

export interface OrderingSequence {
  id: string;
  name: string;
  categoryId: string | null;
  sortOrder: number;
}

export interface OrderingStep {
  id: string;
  sequenceId: string;
  label: string;
  stepOrder: number;
}

export interface OrderingOption {
  id: string;
  stepId: string;
  text: string;
  imageUri: string | null;
  sortOrder: number;
}

export interface WordFrequency {
  word: string;
  count: number;
  lastUsed: string;
}

export interface Bigram {
  word1: string;
  word2: string;
  count: number;
  lastUsed: string;
}

export interface PredictionResult {
  word: string;
  score: number;
}

export interface SpeechConfig {
  rate: number;       // 0.1 - 1.0
  pitch: number;      // -50 to +50 (percentage)
  volume: number;     // 0.0 - 1.0
  tone: ToneStyle;
  language: string;   // BCP-47 tag
  voiceId?: string;   // Azure voice identifier
}

export interface AppSettings {
  language: string;
  speechRate: number;
  speechPitch: number;
  speechVolume: number;
  defaultTone: ToneStyle;
  voiceId: string;
  hapticEnabled: boolean;
  audioFeedbackEnabled: boolean;
  highContrastMode: boolean;
  fontSize: 'normal' | 'large' | 'extra-large';
  tier: SubscriptionTier;
}

export const DEFAULT_SETTINGS: AppSettings = {
  language: 'en',
  speechRate: 0.5,
  speechPitch: 0,
  speechVolume: 1.0,
  defaultTone: 'friendly',
  voiceId: '',
  hapticEnabled: true,
  audioFeedbackEnabled: true,
  highContrastMode: false,
  fontSize: 'large',
  tier: 'free',
};

export interface TierLimits {
  maxCustomCategories: number;
  maxCustomPhrases: number;
  maxLanguages: number;
  maxOrderingSequences: number;
  hasTones: boolean;
  toneCount: number;
  hasCloudBackup: boolean;
  hasAzureVoice: boolean;
  hasMathFull: boolean;
}

export const TIER_LIMITS: Record<SubscriptionTier, TierLimits> = {
  free: {
    maxCustomCategories: 0,
    maxCustomPhrases: 50,
    maxLanguages: 1,
    maxOrderingSequences: 2,
    hasTones: false,
    toneCount: 0,
    hasCloudBackup: false,
    hasAzureVoice: false,
    hasMathFull: false,
  },
  standard: {
    maxCustomCategories: 20,
    maxCustomPhrases: 500,
    maxLanguages: 3,
    maxOrderingSequences: 10,
    hasTones: true,
    toneCount: 5,
    hasCloudBackup: true,
    hasAzureVoice: true,
    hasMathFull: true,
  },
  advanced: {
    maxCustomCategories: Infinity,
    maxCustomPhrases: Infinity,
    maxLanguages: 12,
    maxOrderingSequences: Infinity,
    hasTones: true,
    toneCount: 9,
    hasCloudBackup: true,
    hasAzureVoice: true,
    hasMathFull: true,
  },
  enterprise: {
    maxCustomCategories: Infinity,
    maxCustomPhrases: Infinity,
    maxLanguages: 12,
    maxOrderingSequences: Infinity,
    hasTones: true,
    toneCount: 9,
    hasCloudBackup: true,
    hasAzureVoice: true,
    hasMathFull: true,
  },
};

export type SupportedLanguage =
  | 'en' | 'es' | 'fr' | 'pt' | 'ro'
  | 'uk' | 'ru' | 'de' | 'ja' | 'ko'
  | 'zh' | 'ar';

export const SUPPORTED_LANGUAGES: { code: SupportedLanguage; name: string; nativeName: string; rtl: boolean }[] = [
  { code: 'en', name: 'English', nativeName: 'English', rtl: false },
  { code: 'es', name: 'Spanish', nativeName: 'Español', rtl: false },
  { code: 'fr', name: 'French', nativeName: 'Français', rtl: false },
  { code: 'pt', name: 'Portuguese', nativeName: 'Português', rtl: false },
  { code: 'ro', name: 'Romanian', nativeName: 'Română', rtl: false },
  { code: 'uk', name: 'Ukrainian', nativeName: 'Українська', rtl: false },
  { code: 'ru', name: 'Russian', nativeName: 'Русский', rtl: false },
  { code: 'de', name: 'German', nativeName: 'Deutsch', rtl: false },
  { code: 'ja', name: 'Japanese', nativeName: '日本語', rtl: false },
  { code: 'ko', name: 'Korean', nativeName: '한국어', rtl: false },
  { code: 'zh', name: 'Chinese', nativeName: '中文', rtl: false },
  { code: 'ar', name: 'Arabic', nativeName: 'العربية', rtl: true },
];
