import { useSettingsStore } from '../../store/settingsStore';
import { DEFAULT_SETTINGS } from '../../types';

describe('SettingsStore', () => {
  beforeEach(() => {
    useSettingsStore.setState(DEFAULT_SETTINGS);
  });

  describe('update', () => {
    it('updates a single setting', () => {
      useSettingsStore.getState().update({ language: 'es' });
      expect(useSettingsStore.getState().language).toBe('es');
    });

    it('updates multiple settings at once', () => {
      useSettingsStore.getState().update({
        language: 'fr',
        speechRate: 0.8,
        highContrastMode: true,
      });
      const s = useSettingsStore.getState();
      expect(s.language).toBe('fr');
      expect(s.speechRate).toBe(0.8);
      expect(s.highContrastMode).toBe(true);
    });

    it('preserves unmodified settings', () => {
      useSettingsStore.getState().update({ language: 'de' });
      const s = useSettingsStore.getState();
      expect(s.language).toBe('de');
      expect(s.speechRate).toBe(DEFAULT_SETTINGS.speechRate);
      expect(s.hapticEnabled).toBe(DEFAULT_SETTINGS.hapticEnabled);
    });

    it('handles edge case: speechRate at minimum', () => {
      useSettingsStore.getState().update({ speechRate: 0.1 });
      expect(useSettingsStore.getState().speechRate).toBe(0.1);
    });

    it('handles edge case: speechRate at maximum', () => {
      useSettingsStore.getState().update({ speechRate: 1.0 });
      expect(useSettingsStore.getState().speechRate).toBe(1.0);
    });

    it('handles edge case: volume at zero', () => {
      useSettingsStore.getState().update({ speechVolume: 0 });
      expect(useSettingsStore.getState().speechVolume).toBe(0);
    });
  });

  describe('reset', () => {
    it('resets all settings to defaults', () => {
      useSettingsStore.getState().update({
        language: 'ja',
        speechRate: 0.9,
        highContrastMode: true,
        hapticEnabled: false,
      });
      useSettingsStore.getState().reset();
      const s = useSettingsStore.getState();
      expect(s.language).toBe(DEFAULT_SETTINGS.language);
      expect(s.speechRate).toBe(DEFAULT_SETTINGS.speechRate);
      expect(s.highContrastMode).toBe(DEFAULT_SETTINGS.highContrastMode);
      expect(s.hapticEnabled).toBe(DEFAULT_SETTINGS.hapticEnabled);
    });
  });
});
