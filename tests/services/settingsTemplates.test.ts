import { BUILT_IN_TEMPLATES, applyTemplate } from '../../services/settingsTemplates';
import { DEFAULT_SETTINGS, AppSettings } from '../../types';

describe('Settings Templates', () => {
  describe('BUILT_IN_TEMPLATES', () => {
    it('has at least 5 built-in templates', () => {
      expect(BUILT_IN_TEMPLATES.length).toBeGreaterThanOrEqual(5);
    });

    it('all templates have unique IDs', () => {
      const ids = BUILT_IN_TEMPLATES.map(t => t.id);
      expect(new Set(ids).size).toBe(ids.length);
    });

    it('all templates have non-empty names', () => {
      for (const tpl of BUILT_IN_TEMPLATES) {
        expect(tpl.name.trim().length).toBeGreaterThan(0);
      }
    });

    it('all templates have descriptions', () => {
      for (const tpl of BUILT_IN_TEMPLATES) {
        expect(tpl.description.trim().length).toBeGreaterThan(0);
      }
    });

    it('all templates have icons', () => {
      for (const tpl of BUILT_IN_TEMPLATES) {
        expect(tpl.icon.length).toBeGreaterThan(0);
      }
    });

    it('all templates are marked as built-in', () => {
      for (const tpl of BUILT_IN_TEMPLATES) {
        expect(tpl.isBuiltIn).toBe(true);
      }
    });

    it('default template has default settings', () => {
      const def = BUILT_IN_TEMPLATES.find(t => t.id === 'tpl-default');
      expect(def).toBeDefined();
      expect(def!.settings.speechRate).toBe(DEFAULT_SETTINGS.speechRate);
    });

    it('restaurant template has max volume', () => {
      const rest = BUILT_IN_TEMPLATES.find(t => t.id === 'tpl-restaurant');
      expect(rest).toBeDefined();
      expect(rest!.settings.speechVolume).toBe(1.0);
    });

    it('quiet template has low volume', () => {
      const quiet = BUILT_IN_TEMPLATES.find(t => t.id === 'tpl-quiet');
      expect(quiet).toBeDefined();
      expect(quiet!.settings.speechVolume).toBeLessThan(0.5);
    });

    it('high contrast template enables high contrast mode', () => {
      const hc = BUILT_IN_TEMPLATES.find(t => t.id === 'tpl-high-contrast');
      expect(hc).toBeDefined();
      expect(hc!.settings.highContrastMode).toBe(true);
    });
  });

  describe('applyTemplate', () => {
    it('merges template settings over current', () => {
      const template = BUILT_IN_TEMPLATES.find(t => t.id === 'tpl-school')!;
      const result = applyTemplate(DEFAULT_SETTINGS, template);
      expect(result.defaultTone).toBe('calm');
      expect(result.speechVolume).toBe(0.6);
    });

    it('preserves settings not in template', () => {
      const template = BUILT_IN_TEMPLATES.find(t => t.id === 'tpl-quiet')!;
      const current: AppSettings = { ...DEFAULT_SETTINGS, language: 'es', tier: 'standard' };
      const result = applyTemplate(current, template);
      expect(result.language).toBe('es');
      expect(result.tier).toBe('standard');
    });

    it('does not mutate original settings', () => {
      const original = { ...DEFAULT_SETTINGS };
      const template = BUILT_IN_TEMPLATES.find(t => t.id === 'tpl-restaurant')!;
      applyTemplate(original, template);
      expect(original.speechVolume).toBe(DEFAULT_SETTINGS.speechVolume);
    });
  });
});
