import { settingsToIni, iniToSettings, parseTemplateName } from '../../services/iniConfig';
import { DEFAULT_SETTINGS, AppSettings } from '../../types';

describe('INI Config', () => {
  describe('settingsToIni', () => {
    it('generates valid INI content', () => {
      const ini = settingsToIni(DEFAULT_SETTINGS);
      expect(ini).toContain('[speech]');
      expect(ini).toContain('[language]');
      expect(ini).toContain('[accessibility]');
      expect(ini).toContain('[subscription]');
    });

    it('includes speech settings', () => {
      const ini = settingsToIni(DEFAULT_SETTINGS);
      expect(ini).toContain(`rate = ${DEFAULT_SETTINGS.speechRate}`);
      expect(ini).toContain(`volume = ${DEFAULT_SETTINGS.speechVolume}`);
      expect(ini).toContain(`default_tone = ${DEFAULT_SETTINGS.defaultTone}`);
    });

    it('includes template name when provided', () => {
      const ini = settingsToIni(DEFAULT_SETTINGS, 'My Template');
      expect(ini).toContain('[template]');
      expect(ini).toContain('name = My Template');
    });

    it('omits template section when no name', () => {
      const ini = settingsToIni(DEFAULT_SETTINGS);
      expect(ini).not.toContain('[template]');
    });

    it('includes header comment', () => {
      const ini = settingsToIni(DEFAULT_SETTINGS);
      expect(ini).toContain('; Prism AAC Configuration File');
    });
  });

  describe('iniToSettings', () => {
    it('parses basic INI back to settings', () => {
      const ini = settingsToIni(DEFAULT_SETTINGS);
      const parsed = iniToSettings(ini);
      expect(parsed.speechRate).toBe(DEFAULT_SETTINGS.speechRate);
      expect(parsed.speechVolume).toBe(DEFAULT_SETTINGS.speechVolume);
      expect(parsed.language).toBe(DEFAULT_SETTINGS.language);
    });

    it('handles custom values', () => {
      const custom: AppSettings = {
        ...DEFAULT_SETTINGS,
        speechRate: 0.8,
        language: 'fr',
        highContrastMode: true,
        defaultTone: 'serious',
      };
      const ini = settingsToIni(custom);
      const parsed = iniToSettings(ini);
      expect(parsed.speechRate).toBe(0.8);
      expect(parsed.language).toBe('fr');
      expect(parsed.highContrastMode).toBe(true);
      expect(parsed.defaultTone).toBe('serious');
    });

    it('ignores comment lines', () => {
      const ini = '; comment\n# another comment\n[speech]\nrate = 0.7';
      const parsed = iniToSettings(ini);
      expect(parsed.speechRate).toBe(0.7);
    });

    it('ignores empty lines', () => {
      const ini = '\n\n[speech]\n\nrate = 0.6\n\n';
      const parsed = iniToSettings(ini);
      expect(parsed.speechRate).toBe(0.6);
    });

    it('ignores malformed lines', () => {
      const ini = '[speech]\nno_equals_here\nrate = 0.5';
      const parsed = iniToSettings(ini);
      expect(parsed.speechRate).toBe(0.5);
    });

    // Edge cases
    it('clamps speechRate to valid range', () => {
      const ini = '[speech]\nrate = 5.0';
      const parsed = iniToSettings(ini);
      expect(parsed.speechRate).toBe(1.0);
    });

    it('clamps speechRate minimum', () => {
      const ini = '[speech]\nrate = -1.0';
      const parsed = iniToSettings(ini);
      expect(parsed.speechRate).toBe(0.1);
    });

    it('handles NaN values gracefully', () => {
      const ini = '[speech]\nrate = not_a_number';
      const parsed = iniToSettings(ini);
      expect(parsed.speechRate).toBe(0.1); // falls back to min
    });

    it('defaults invalid tone to friendly', () => {
      const ini = '[speech]\ndefault_tone = invalid_tone';
      const parsed = iniToSettings(ini);
      expect(parsed.defaultTone).toBe('friendly');
    });

    it('defaults invalid tier to free', () => {
      const ini = '[subscription]\ntier = platinum';
      const parsed = iniToSettings(ini);
      expect(parsed.tier).toBe('free');
    });

    it('defaults invalid font_size to large', () => {
      const ini = '[accessibility]\nfont_size = gigantic';
      const parsed = iniToSettings(ini);
      expect(parsed.fontSize).toBe('large');
    });

    it('parses boolean values correctly', () => {
      const ini = '[accessibility]\nhaptic_enabled = true\nhigh_contrast_mode = false';
      const parsed = iniToSettings(ini);
      expect(parsed.hapticEnabled).toBe(true);
      expect(parsed.highContrastMode).toBe(false);
    });

    it('parses 1/0 as boolean', () => {
      const ini = '[accessibility]\nhaptic_enabled = 1\nhigh_contrast_mode = 0';
      const parsed = iniToSettings(ini);
      expect(parsed.hapticEnabled).toBe(true);
      expect(parsed.highContrastMode).toBe(false);
    });

    it('handles completely empty input', () => {
      const parsed = iniToSettings('');
      expect(Object.keys(parsed).length).toBe(0);
    });

    it('handles unknown sections gracefully', () => {
      const ini = '[unknown]\nfoo = bar\n[speech]\nrate = 0.5';
      const parsed = iniToSettings(ini);
      expect(parsed.speechRate).toBe(0.5);
    });

    it('clamps volume to 0-1 range', () => {
      const ini = '[speech]\nvolume = 1.5';
      const parsed = iniToSettings(ini);
      expect(parsed.speechVolume).toBe(1.0);
    });

    it('clamps pitch to -50 to +50', () => {
      const ini = '[speech]\npitch = 100';
      const parsed = iniToSettings(ini);
      expect(parsed.speechPitch).toBe(50);
    });
  });

  describe('parseTemplateName', () => {
    it('extracts template name from INI', () => {
      const ini = '[template]\nname = My Template\n[speech]\nrate = 0.5';
      expect(parseTemplateName(ini)).toBe('My Template');
    });

    it('returns null when no template section', () => {
      const ini = '[speech]\nrate = 0.5';
      expect(parseTemplateName(ini)).toBeNull();
    });

    it('returns null for empty input', () => {
      expect(parseTemplateName('')).toBeNull();
    });
  });

  describe('roundtrip', () => {
    it('settings survive INI roundtrip', () => {
      const original: AppSettings = {
        ...DEFAULT_SETTINGS,
        speechRate: 0.7,
        speechPitch: -10,
        speechVolume: 0.8,
        defaultTone: 'calm',
        language: 'ja',
        hapticEnabled: false,
        audioFeedbackEnabled: true,
        highContrastMode: true,
        fontSize: 'extra-large',
        tier: 'advanced',
      };
      const ini = settingsToIni(original);
      const parsed = iniToSettings(ini);
      expect(parsed.speechRate).toBe(original.speechRate);
      expect(parsed.speechPitch).toBe(original.speechPitch);
      expect(parsed.speechVolume).toBe(original.speechVolume);
      expect(parsed.defaultTone).toBe(original.defaultTone);
      expect(parsed.language).toBe(original.language);
      expect(parsed.hapticEnabled).toBe(original.hapticEnabled);
      expect(parsed.highContrastMode).toBe(original.highContrastMode);
      expect(parsed.fontSize).toBe(original.fontSize);
      expect(parsed.tier).toBe(original.tier);
    });
  });
});
