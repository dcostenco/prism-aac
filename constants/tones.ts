import { ToneStyle } from '../types';

export interface ToneDefinition {
  id: ToneStyle;
  label: string;
  icon: string;
  description: string;
  azureStyle: string;
}

export const TONES: ToneDefinition[] = [
  { id: 'friendly', label: 'Friendly', icon: '😊', description: 'Warm, approachable', azureStyle: 'friendly' },
  { id: 'cheerful', label: 'Cheerful', icon: '😄', description: 'Happy, positive', azureStyle: 'cheerful' },
  { id: 'calm', label: 'Calm', icon: '😌', description: 'Relaxed, peaceful', azureStyle: 'calm' },
  { id: 'serious', label: 'Serious', icon: '😐', description: 'Formal, focused', azureStyle: 'serious' },
  { id: 'excited', label: 'Excited', icon: '🤩', description: 'Enthusiastic', azureStyle: 'excited' },
  { id: 'hopeful', label: 'Hopeful', icon: '🙏', description: 'Encouraging', azureStyle: 'hopeful' },
  { id: 'empathetic', label: 'Empathetic', icon: '🤗', description: 'Understanding', azureStyle: 'empathetic' },
  { id: 'sad', label: 'Sad', icon: '😢', description: 'Emotional', azureStyle: 'sad' },
  { id: 'angry', label: 'Urgent', icon: '😤', description: 'Assertive, urgent', azureStyle: 'angry' },
];

export const DEFAULT_TONE: ToneStyle = 'friendly';

export const FREE_TIER_TONES: ToneStyle[] = [];
export const STANDARD_TIER_TONES: ToneStyle[] = ['friendly', 'cheerful', 'calm', 'serious', 'excited'];
export const ADVANCED_TIER_TONES: ToneStyle[] = TONES.map(t => t.id);
