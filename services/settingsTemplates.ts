import { AppSettings, DEFAULT_SETTINGS, ToneStyle } from '../types';
import { getSetting, setSetting } from '../db/repository';

export interface SettingsTemplate {
  id: string;
  name: string;
  description: string;
  icon: string;
  settings: Partial<AppSettings>;
  isBuiltIn: boolean;
}

// ── Built-in templates ──

export const BUILT_IN_TEMPLATES: SettingsTemplate[] = [
  {
    id: 'tpl-default',
    name: 'Default',
    description: 'Standard settings for everyday use',
    icon: '⚙️',
    settings: { ...DEFAULT_SETTINGS },
    isBuiltIn: true,
  },
  {
    id: 'tpl-home',
    name: 'Home',
    description: 'Relaxed settings for home environment',
    icon: '🏠',
    settings: {
      speechRate: 0.5,
      speechVolume: 0.8,
      defaultTone: 'friendly',
      hapticEnabled: true,
      audioFeedbackEnabled: false,
      highContrastMode: false,
      fontSize: 'large',
    },
    isBuiltIn: true,
  },
  {
    id: 'tpl-school',
    name: 'School',
    description: 'Focused settings for classroom use',
    icon: '🏫',
    settings: {
      speechRate: 0.4,
      speechVolume: 0.6,
      defaultTone: 'calm',
      hapticEnabled: true,
      audioFeedbackEnabled: false,
      highContrastMode: false,
      fontSize: 'large',
    },
    isBuiltIn: true,
  },
  {
    id: 'tpl-restaurant',
    name: 'Restaurant',
    description: 'Louder, slower speech for noisy environments',
    icon: '🍽️',
    settings: {
      speechRate: 0.3,
      speechVolume: 1.0,
      defaultTone: 'friendly',
      hapticEnabled: true,
      audioFeedbackEnabled: true,
      highContrastMode: false,
      fontSize: 'extra-large',
    },
    isBuiltIn: true,
  },
  {
    id: 'tpl-quiet',
    name: 'Quiet',
    description: 'Low volume for libraries, waiting rooms',
    icon: '🤫',
    settings: {
      speechRate: 0.5,
      speechVolume: 0.3,
      defaultTone: 'calm',
      hapticEnabled: true,
      audioFeedbackEnabled: false,
      highContrastMode: false,
      fontSize: 'normal',
    },
    isBuiltIn: true,
  },
  {
    id: 'tpl-high-contrast',
    name: 'High Contrast',
    description: 'Maximum visibility with large text',
    icon: '👁️',
    settings: {
      highContrastMode: true,
      fontSize: 'extra-large',
      hapticEnabled: true,
      audioFeedbackEnabled: true,
    },
    isBuiltIn: true,
  },
];

// ── Template persistence ──

const TEMPLATES_KEY = 'custom_templates';
const ACTIVE_TEMPLATE_KEY = 'active_template';

export async function getCustomTemplates(): Promise<SettingsTemplate[]> {
  const raw = await getSetting(TEMPLATES_KEY);
  if (!raw) return [];
  try {
    return JSON.parse(raw);
  } catch {
    return [];
  }
}

export async function saveCustomTemplate(template: SettingsTemplate): Promise<void> {
  const existing = await getCustomTemplates();
  const idx = existing.findIndex(t => t.id === template.id);
  if (idx >= 0) {
    existing[idx] = template;
  } else {
    existing.push(template);
  }
  await setSetting(TEMPLATES_KEY, JSON.stringify(existing));
}

export async function deleteCustomTemplate(templateId: string): Promise<void> {
  const existing = await getCustomTemplates();
  const filtered = existing.filter(t => t.id !== templateId);
  await setSetting(TEMPLATES_KEY, JSON.stringify(filtered));
}

export async function getAllTemplates(): Promise<SettingsTemplate[]> {
  const custom = await getCustomTemplates();
  return [...BUILT_IN_TEMPLATES, ...custom];
}

export async function getActiveTemplateId(): Promise<string> {
  const id = await getSetting(ACTIVE_TEMPLATE_KEY);
  return id ?? 'tpl-default';
}

export async function setActiveTemplateId(templateId: string): Promise<void> {
  await setSetting(ACTIVE_TEMPLATE_KEY, templateId);
}

export function applyTemplate(
  currentSettings: AppSettings,
  template: SettingsTemplate
): AppSettings {
  return { ...currentSettings, ...template.settings };
}
