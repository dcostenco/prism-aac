// INI-style configuration file parser and writer for Prism AAC
// Used for portable settings export/import and template files

import { AppSettings, DEFAULT_SETTINGS, ToneStyle, SubscriptionTier } from '../types';

export function settingsToIni(settings: AppSettings, templateName?: string): string {
  const lines: string[] = [
    '; Prism AAC Configuration File',
    '; Generated: ' + new Date().toISOString(),
    '',
  ];

  if (templateName) {
    lines.push('[template]');
    lines.push(`name = ${templateName}`);
    lines.push('');
  }

  lines.push('[speech]');
  lines.push(`rate = ${settings.speechRate}`);
  lines.push(`pitch = ${settings.speechPitch}`);
  lines.push(`volume = ${settings.speechVolume}`);
  lines.push(`default_tone = ${settings.defaultTone}`);
  lines.push(`voice_id = ${settings.voiceId}`);
  lines.push('');

  lines.push('[language]');
  lines.push(`code = ${settings.language}`);
  lines.push('');

  lines.push('[accessibility]');
  lines.push(`haptic_enabled = ${settings.hapticEnabled}`);
  lines.push(`audio_feedback_enabled = ${settings.audioFeedbackEnabled}`);
  lines.push(`high_contrast_mode = ${settings.highContrastMode}`);
  lines.push(`font_size = ${settings.fontSize}`);
  lines.push('');

  lines.push('[subscription]');
  lines.push(`tier = ${settings.tier}`);
  lines.push('');

  return lines.join('\n');
}

export function iniToSettings(iniContent: string): Partial<AppSettings> {
  const result: Partial<AppSettings> = {};
  let currentSection = '';

  const lines = iniContent.split('\n');
  for (const rawLine of lines) {
    const line = rawLine.trim();

    // Skip comments and empty lines
    if (!line || line.startsWith(';') || line.startsWith('#')) continue;

    // Section header
    if (line.startsWith('[') && line.endsWith(']')) {
      currentSection = line.slice(1, -1).toLowerCase();
      continue;
    }

    // Key-value pair
    const eqIndex = line.indexOf('=');
    if (eqIndex === -1) continue;

    const key = line.slice(0, eqIndex).trim();
    const value = line.slice(eqIndex + 1).trim();

    switch (currentSection) {
      case 'speech':
        if (key === 'rate') result.speechRate = clampFloat(value, 0.1, 1.0);
        if (key === 'pitch') result.speechPitch = clampFloat(value, -50, 50);
        if (key === 'volume') result.speechVolume = clampFloat(value, 0, 1.0);
        if (key === 'default_tone') result.defaultTone = parseTone(value);
        if (key === 'voice_id') result.voiceId = value;
        break;

      case 'language':
        if (key === 'code') result.language = value;
        break;

      case 'accessibility':
        if (key === 'haptic_enabled') result.hapticEnabled = parseBool(value);
        if (key === 'audio_feedback_enabled') result.audioFeedbackEnabled = parseBool(value);
        if (key === 'high_contrast_mode') result.highContrastMode = parseBool(value);
        if (key === 'font_size') result.fontSize = parseFontSize(value);
        break;

      case 'subscription':
        if (key === 'tier') result.tier = parseTier(value);
        break;
    }
  }

  return result;
}

export function parseTemplateName(iniContent: string): string | null {
  const lines = iniContent.split('\n');
  let inTemplate = false;
  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (line === '[template]') { inTemplate = true; continue; }
    if (line.startsWith('[')) { inTemplate = false; continue; }
    if (inTemplate && line.startsWith('name')) {
      const eqIndex = line.indexOf('=');
      if (eqIndex !== -1) return line.slice(eqIndex + 1).trim();
    }
  }
  return null;
}

// ── Parsers with safe defaults ──

function clampFloat(value: string, min: number, max: number): number {
  const n = parseFloat(value);
  if (isNaN(n)) return min;
  return Math.min(max, Math.max(min, n));
}

function parseBool(value: string): boolean {
  return value.toLowerCase() === 'true' || value === '1';
}

const VALID_TONES: ToneStyle[] = [
  'cheerful', 'sad', 'angry', 'excited', 'friendly',
  'hopeful', 'calm', 'serious', 'empathetic',
];

function parseTone(value: string): ToneStyle {
  const v = value.toLowerCase() as ToneStyle;
  return VALID_TONES.includes(v) ? v : 'friendly';
}

const VALID_TIERS: SubscriptionTier[] = ['free', 'standard', 'advanced', 'enterprise'];

function parseTier(value: string): SubscriptionTier {
  const v = value.toLowerCase() as SubscriptionTier;
  return VALID_TIERS.includes(v) ? v : 'free';
}

function parseFontSize(value: string): 'normal' | 'large' | 'extra-large' {
  const v = value.toLowerCase();
  if (v === 'normal' || v === 'large' || v === 'extra-large') return v;
  return 'large';
}
