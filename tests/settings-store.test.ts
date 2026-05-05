import { describe, it, expect, beforeEach } from 'vitest';
import { useSettingsStore } from '@/store/settingsStore';

beforeEach(() => {
  useSettingsStore.setState({
    speechRate: 0.5,
    speechVolume: 1.0,
    language: 'en',
    highContrast: false,
    theme: 'light',
    gridSize: 6,
  });
});

describe('SettingsStore — Default values', () => {
  it('has speechRate of 0.5', () => {
    expect(useSettingsStore.getState().speechRate).toBe(0.5);
  });

  it('has speechVolume of 1.0', () => {
    expect(useSettingsStore.getState().speechVolume).toBe(1.0);
  });

  it('has language set to en', () => {
    expect(useSettingsStore.getState().language).toBe('en');
  });

  it('has highContrast disabled', () => {
    expect(useSettingsStore.getState().highContrast).toBe(false);
  });

  it('has theme set to light', () => {
    expect(useSettingsStore.getState().theme).toBe('light');
  });

  it('has gridSize of 6', () => {
    expect(useSettingsStore.getState().gridSize).toBe(6);
  });
});

describe('SettingsStore — update()', () => {
  it('updates speechRate', () => {
    useSettingsStore.getState().update({ speechRate: 0.8 });
    expect(useSettingsStore.getState().speechRate).toBe(0.8);
  });

  it('updates speechVolume', () => {
    useSettingsStore.getState().update({ speechVolume: 0.5 });
    expect(useSettingsStore.getState().speechVolume).toBe(0.5);
  });

  it('updates language', () => {
    useSettingsStore.getState().update({ language: 'ro' });
    expect(useSettingsStore.getState().language).toBe('ro');
  });

  it('updates highContrast', () => {
    useSettingsStore.getState().update({ highContrast: true });
    expect(useSettingsStore.getState().highContrast).toBe(true);
  });

  it('updates multiple fields at once', () => {
    useSettingsStore.getState().update({ speechRate: 1.0, language: 'es' });
    const state = useSettingsStore.getState();
    expect(state.speechRate).toBe(1.0);
    expect(state.language).toBe('es');
  });

  it('does not overwrite unrelated fields', () => {
    useSettingsStore.getState().update({ speechRate: 0.9 });
    const state = useSettingsStore.getState();
    expect(state.speechVolume).toBe(1.0);
    expect(state.language).toBe('en');
    expect(state.theme).toBe('light');
  });
});

describe('SettingsStore — setTheme()', () => {
  it('sets theme to dark', () => {
    useSettingsStore.getState().setTheme('dark');
    expect(useSettingsStore.getState().theme).toBe('dark');
  });

  it('sets theme back to light', () => {
    useSettingsStore.getState().setTheme('dark');
    useSettingsStore.getState().setTheme('light');
    expect(useSettingsStore.getState().theme).toBe('light');
  });
});

describe('SettingsStore — gridSize', () => {
  it.each([4, 6, 9, 12, 16, 20] as const)('accepts gridSize %d', (size) => {
    useSettingsStore.getState().update({ gridSize: size });
    expect(useSettingsStore.getState().gridSize).toBe(size);
  });
});

describe('SettingsStore — voicePreferences (per-language voice picker)', () => {
  beforeEach(() => {
    useSettingsStore.setState({ voicePreferences: {} });
  });

  it('starts with no voice preferences (platform defaults apply)', () => {
    expect(useSettingsStore.getState().voicePreferences).toEqual({});
  });

  it('setVoiceForLang persists a voice for one language', () => {
    useSettingsStore.getState().setVoiceForLang('en', 'Ashley');
    expect(useSettingsStore.getState().voicePreferences).toEqual({ en: 'Ashley' });
  });

  it('canonicalizes regional codes to base lang (en-US → en)', () => {
    useSettingsStore.getState().setVoiceForLang('en-US', 'Sarah');
    expect(useSettingsStore.getState().voicePreferences).toEqual({ en: 'Sarah' });
  });

  it('canonicalizes underscore variants (es_MX → es)', () => {
    useSettingsStore.getState().setVoiceForLang('es_MX', 'Carmen');
    expect(useSettingsStore.getState().voicePreferences).toEqual({ es: 'Carmen' });
  });

  it('preserves choices for other languages when setting one', () => {
    useSettingsStore.getState().setVoiceForLang('en', 'Ashley');
    useSettingsStore.getState().setVoiceForLang('es', 'Diego');
    expect(useSettingsStore.getState().voicePreferences).toEqual({ en: 'Ashley', es: 'Diego' });
  });

  it('clears a language when called with undefined / empty', () => {
    useSettingsStore.getState().setVoiceForLang('en', 'Ashley');
    useSettingsStore.getState().setVoiceForLang('en', undefined);
    expect(useSettingsStore.getState().voicePreferences.en).toBeUndefined();
  });

  it('overwrites the existing voice for a language on a new pick', () => {
    useSettingsStore.getState().setVoiceForLang('en', 'Ashley');
    useSettingsStore.getState().setVoiceForLang('en', 'Dennis');
    expect(useSettingsStore.getState().voicePreferences.en).toBe('Dennis');
  });

  it('update() can also set voicePreferences directly', () => {
    useSettingsStore.getState().update({ voicePreferences: { en: 'Helia' } });
    expect(useSettingsStore.getState().voicePreferences).toEqual({ en: 'Helia' });
  });
});
