/**
 * settingsStore hydration validator — defends against tampered
 * localStorage injecting bogus shapes (browser extension, sibling-tab
 * on shared device, manual devtools edit). Same risk class as
 * contactsStore + scheduleStore covered in pass-3 (persist-hydration).
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { useSettingsStore, DEFAULT_TOOLBAR_ORDER } from '@/store/settingsStore';

beforeEach(() => {
  if (typeof window !== 'undefined') window.localStorage.clear();
});

function seedPersistedSettings(state: Record<string, unknown>): void {
  window.localStorage.setItem('prism-aac-settings', JSON.stringify({ state, version: 15 }));
}

describe('settingsStore — hydration validator', () => {
  it('clamps NaN/negative speechRate to a safe default', () => {
    seedPersistedSettings({ speechRate: NaN, speechVolume: -5 });
    void useSettingsStore.persist.rehydrate();
    const s = useSettingsStore.getState();
    expect(Number.isFinite(s.speechRate)).toBe(true);
    expect(s.speechRate).toBeGreaterThan(0);
    expect(s.speechVolume).toBeGreaterThanOrEqual(0);
    expect(s.speechVolume).toBeLessThanOrEqual(1);
  });

  it('rejects unknown gridSize values', () => {
    seedPersistedSettings({ gridSize: 999 });
    void useSettingsStore.persist.rehydrate();
    expect([4, 6, 9, 12, 16, 20]).toContain(useSettingsStore.getState().gridSize);
  });

  it('rejects unknown theme values', () => {
    seedPersistedSettings({ theme: 'haxor' });
    void useSettingsStore.persist.rehydrate();
    expect(['light', 'dark']).toContain(useSettingsStore.getState().theme);
  });

  it('drops non-array installedApps and replaces with []', () => {
    seedPersistedSettings({ installedApps: 'not-an-array' });
    void useSettingsStore.persist.rehydrate();
    expect(Array.isArray(useSettingsStore.getState().installedApps)).toBe(true);
    expect(useSettingsStore.getState().installedApps).toEqual([]);
  });

  it('drops non-string entries from installedApps and caps the array', () => {
    const huge = Array.from({ length: 500 }, (_, i) => `app-${i}`);
    seedPersistedSettings({ installedApps: [...huge, 42, null, { evil: true }] });
    void useSettingsStore.persist.rehydrate();
    const apps = useSettingsStore.getState().installedApps;
    expect(apps.length).toBeLessThanOrEqual(100);
    expect(apps.every((a) => typeof a === 'string')).toBe(true);
  });

  it('rejects bogus toolbarConfig.order entries while keeping known ids', () => {
    seedPersistedSettings({
      toolbarConfig: {
        order: ['categories', { evil: true }, 'unknown_id', 'sound', 42],
        enabled: { categories: true, settings: false }, // settings:false MUST be overridden
      },
    });
    void useSettingsStore.persist.rehydrate();
    const tc = useSettingsStore.getState().toolbarConfig;
    expect(tc.order).toEqual(['categories', 'sound']);
    // settings invariant — never disable-able
    expect(tc.enabled.settings).toBe(true);
  });

  it('drops non-boolean values from toolbarConfig.enabled', () => {
    seedPersistedSettings({
      toolbarConfig: {
        order: ['categories'],
        enabled: { categories: 'yes', mic: 1, settings: false },
      },
    });
    void useSettingsStore.persist.rehydrate();
    const tc = useSettingsStore.getState().toolbarConfig;
    expect(tc.enabled.categories).toBeUndefined();
    expect(tc.enabled.mic).toBeUndefined();
    expect(tc.enabled.settings).toBe(true);
  });

  it('drops non-object gestureConfig and falls back to defaults', () => {
    seedPersistedSettings({ gestureConfig: 'haxor' });
    void useSettingsStore.persist.rehydrate();
    expect(typeof useSettingsStore.getState().gestureConfig).toBe('object');
  });

  it('caps voicePreferences entry count + drops bogus values', () => {
    const huge: Record<string, unknown> = {};
    for (let i = 0; i < 100; i++) huge[`lang${i}`] = `voice-${i}`;
    huge['en'] = 42;       // bad — non-string
    huge['x'.repeat(20)] = 'voice'; // bad — key too long
    seedPersistedSettings({ voicePreferences: huge });
    void useSettingsStore.persist.rehydrate();
    const prefs = useSettingsStore.getState().voicePreferences;
    expect(Object.keys(prefs).length).toBeLessThanOrEqual(50);
    expect(typeof prefs.en !== 'number').toBe(true);
  });

  it('preserves valid toolbarConfig untouched', () => {
    seedPersistedSettings({
      toolbarConfig: {
        order: [...DEFAULT_TOOLBAR_ORDER].slice(0, 5),
        enabled: { categories: false, mic: true, settings: true },
      },
    });
    void useSettingsStore.persist.rehydrate();
    const tc = useSettingsStore.getState().toolbarConfig;
    expect(tc.order).toEqual(DEFAULT_TOOLBAR_ORDER.slice(0, 5));
    expect(tc.enabled.categories).toBe(false);
    expect(tc.enabled.mic).toBe(true);
  });
});
