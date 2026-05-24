/**
 * settingsStore.migrate() — all 18 version migration guards.
 *
 * Broken migrations are silent, ship-stopping bugs: a user who upgrades the
 * app on their AAC device gets corrupt settings (wrong tracking target, camera
 * unexpectedly enabled, settings button hidden, stale PIN hash accepted) with
 * no visible error. Each test here calls the persist migrate() function
 * directly with a minimal old-version state and asserts the post-migration
 * value, isolating the specific guard under test.
 *
 * Access pattern: useSettingsStore.persist.getOptions().migrate!(state, fromVersion)
 */
import { describe, it, expect } from 'vitest';
import { useSettingsStore } from '@/store/settingsStore';
import { DEFAULT_GESTURE_CONFIG } from '@/services/gestureService';

function migrate(persisted: Record<string, unknown>, fromVersion: number): Record<string, unknown> {
  const fn = useSettingsStore.persist.getOptions().migrate!;
  return fn(persisted, fromVersion) as Record<string, unknown>;
}

// ── v1→v2: gridSize default ───────────────────────────────────────────────────

describe('settingsStore.migrate — v1 gridSize', () => {
  it('fills gridSize=6 when absent at version 1', () => {
    const result = migrate({}, 1);
    expect(result.gridSize).toBe(6);
  });

  it('preserves existing gridSize when present', () => {
    const result = migrate({ gridSize: 9 }, 1);
    expect(result.gridSize).toBe(9);
  });
});

// ── v2→v3: activeVocabSet + outputLanguage ────────────────────────────────────

describe('settingsStore.migrate — v2 activeVocabSet + outputLanguage', () => {
  it('fills activeVocabSet="all" when absent', () => {
    const result = migrate({}, 2);
    expect(result.activeVocabSet).toBe('all');
  });

  it('fills outputLanguage from language when outputLanguage absent', () => {
    const result = migrate({ language: 'fr' }, 2);
    expect(result.outputLanguage).toBe('fr');
  });

  it('fills outputLanguage="en" when both language and outputLanguage absent', () => {
    const result = migrate({}, 2);
    expect(result.outputLanguage).toBe('en');
  });

  it('preserves existing outputLanguage', () => {
    const result = migrate({ outputLanguage: 'es', language: 'fr' }, 2);
    expect(result.outputLanguage).toBe('es');
  });
});

// ── v3→v4: outputLanguage re-apply for v3 skippers ───────────────────────────

describe('settingsStore.migrate — v3 outputLanguage re-apply', () => {
  it('fills outputLanguage from language when coming from exactly v3', () => {
    const result = migrate({ language: 'de' }, 3);
    expect(result.outputLanguage).toBe('de');
  });

  it('preserves existing outputLanguage at v3', () => {
    const result = migrate({ outputLanguage: 'ru', language: 'de' }, 3);
    expect(result.outputLanguage).toBe('ru');
  });
});

// ── v4→v5: headTracking defaults ──────────────────────────────────────────────

describe('settingsStore.migrate — v4 headTracking defaults', () => {
  it('fills headTrackingEnabled=false when absent', () => {
    const result = migrate({}, 4);
    expect(result.headTrackingEnabled).toBe(false);
  });

  it('fills headTrackingDwellMs=1200 when absent', () => {
    const result = migrate({}, 4);
    expect(result.headTrackingDwellMs).toBe(1200);
  });

  it('fills headTrackingSensitivity=5 when absent', () => {
    const result = migrate({}, 4);
    expect(result.headTrackingSensitivity).toBe(5);
  });

  it('preserves existing headTracking values', () => {
    const result = migrate({ headTrackingEnabled: true, headTrackingDwellMs: 800, headTrackingSensitivity: 3 }, 4);
    expect(result.headTrackingEnabled).toBe(true);
    expect(result.headTrackingDwellMs).toBe(800);
    expect(result.headTrackingSensitivity).toBe(3);
  });
});

// ── v5→v6: showHandCalibration ────────────────────────────────────────────────

describe('settingsStore.migrate — v5 showHandCalibration', () => {
  it('fills showHandCalibration=true when absent', () => {
    const result = migrate({}, 5);
    expect(result.showHandCalibration).toBe(true);
  });

  it('preserves showHandCalibration=false when explicitly set', () => {
    const result = migrate({ showHandCalibration: false }, 5);
    expect(result.showHandCalibration).toBe(false);
  });
});

// ── v7→v8: right_index → right_wrist rename ──────────────────────────────────
// NOTE: When migrating from v7, both v8 (right_index→right_wrist) and v10
// (right_wrist/left_wrist→any_wrist) apply. 'right_index' therefore becomes
// 'any_wrist' after the full chain. 'left_index' is untouched by both guards.

describe('settingsStore.migrate — v8 cameraTrackingTarget rename chain', () => {
  it('right_index at v7 becomes any_wrist after full chain (v8 then v10)', () => {
    const result = migrate({ cameraTrackingTarget: 'right_index', cameraInputEnabled: false }, 7);
    expect(result.cameraTrackingTarget).toBe('any_wrist');
  });

  it('left_index at v7 is preserved through v8 and v10', () => {
    const result = migrate({ cameraTrackingTarget: 'left_index', cameraInputEnabled: false }, 7);
    expect(result.cameraTrackingTarget).toBe('left_index');
  });
});

// ── v8→v9: force cameraInputEnabled=false ────────────────────────────────────

describe('settingsStore.migrate — v9 force camera off', () => {
  it('sets cameraInputEnabled=false even when stored as true', () => {
    // This is the regression fix: v6/v7 defaulted camera to ON; v9 corrects that.
    const result = migrate({ cameraInputEnabled: true }, 8);
    expect(result.cameraInputEnabled).toBe(false);
  });

  it('cameraInputEnabled remains false when already false', () => {
    const result = migrate({ cameraInputEnabled: false }, 8);
    expect(result.cameraInputEnabled).toBe(false);
  });

  it('does not run the v9 force-off when migrating from v9', () => {
    // Users who already ran v9 must not be force-reset if they later re-enabled
    const result = migrate({ cameraInputEnabled: true }, 9);
    expect(result.cameraInputEnabled).toBe(true);
  });
});

// ── v9→v10: any_wrist upgrade ─────────────────────────────────────────────────

describe('settingsStore.migrate — v10 any_wrist upgrade', () => {
  it('upgrades right_wrist to any_wrist', () => {
    const result = migrate({ cameraTrackingTarget: 'right_wrist' }, 9);
    expect(result.cameraTrackingTarget).toBe('any_wrist');
  });

  it('upgrades left_wrist to any_wrist', () => {
    const result = migrate({ cameraTrackingTarget: 'left_wrist' }, 9);
    expect(result.cameraTrackingTarget).toBe('any_wrist');
  });

  it('preserves left_index — intentional non-wrist target kept', () => {
    const result = migrate({ cameraTrackingTarget: 'left_index' }, 9);
    expect(result.cameraTrackingTarget).toBe('left_index');
  });

  it('preserves any_wrist when already upgraded', () => {
    const result = migrate({ cameraTrackingTarget: 'any_wrist' }, 9);
    expect(result.cameraTrackingTarget).toBe('any_wrist');
  });

  it('does not upgrade when migrating from v10', () => {
    const result = migrate({ cameraTrackingTarget: 'right_wrist' }, 10);
    expect(result.cameraTrackingTarget).toBe('right_wrist');
  });
});

// ── v10→v11: toolbarConfig + installedApps defaults ──────────────────────────

describe('settingsStore.migrate — v11 toolbar defaults', () => {
  it('fills toolbarConfig with order and empty enabled when absent', () => {
    const result = migrate({}, 10);
    const tc = result.toolbarConfig as { order: string[]; enabled: Record<string, boolean> };
    expect(Array.isArray(tc.order)).toBe(true);
    expect(tc.order.length).toBeGreaterThan(0);
    expect(typeof tc.enabled).toBe('object');
  });

  it('fills installedApps=[] when absent', () => {
    const result = migrate({}, 10);
    expect(result.installedApps).toEqual([]);
  });

  it('coerces non-array installedApps to []', () => {
    const result = migrate({ installedApps: null }, 10);
    expect(result.installedApps).toEqual([]);
  });

  it('preserves existing toolbarConfig', () => {
    const existing = { order: ['categories'], enabled: { categories: true } };
    const result = migrate({ toolbarConfig: existing }, 10);
    expect(result.toolbarConfig).toEqual(existing);
  });
});

// ── v11→v12: gestureConfig default ───────────────────────────────────────────

describe('settingsStore.migrate — v12 gestureConfig', () => {
  it('fills gestureConfig from DEFAULT_GESTURE_CONFIG when absent', () => {
    const result = migrate({}, 11);
    expect(result.gestureConfig).toEqual(DEFAULT_GESTURE_CONFIG);
  });

  it('preserves existing gestureConfig', () => {
    const custom = { swipeThreshold: 999 };
    const result = migrate({ gestureConfig: custom }, 11);
    expect(result.gestureConfig).toEqual(custom);
  });
});

// ── v12→v13: settings button force-visible ────────────────────────────────────

describe('settingsStore.migrate — v13 settings button force-visible', () => {
  it('forces toolbarConfig.enabled.settings to true when it was false', () => {
    const state = {
      toolbarConfig: {
        order: ['categories', 'settings'],
        enabled: { categories: true, settings: false },
      },
    };
    const result = migrate(state, 12);
    const tc = result.toolbarConfig as { enabled: Record<string, boolean> };
    expect(tc.enabled.settings).toBe(true);
  });

  it('leaves settings=true untouched', () => {
    const state = {
      toolbarConfig: { order: ['settings'], enabled: { settings: true } },
    };
    const result = migrate(state, 12);
    const tc = result.toolbarConfig as { enabled: Record<string, boolean> };
    expect(tc.enabled.settings).toBe(true);
  });

  it('leaves other enabled keys unchanged when fixing settings', () => {
    const state = {
      toolbarConfig: {
        order: ['categories', 'settings'],
        enabled: { categories: false, settings: false },
      },
    };
    const result = migrate(state, 12);
    const tc = result.toolbarConfig as { enabled: Record<string, boolean> };
    expect(tc.enabled.categories).toBe(false);
    expect(tc.enabled.settings).toBe(true);
  });

  it('does not modify toolbarConfig when settings key is absent', () => {
    const state = {
      toolbarConfig: { order: ['categories'], enabled: { categories: true } },
    };
    const result = migrate(state, 12);
    const tc = result.toolbarConfig as { enabled: Record<string, boolean | undefined> };
    expect(tc.enabled.settings).toBeUndefined();
  });

  it('skips the fix when migrating from v13 or above', () => {
    const state = {
      toolbarConfig: { order: ['settings'], enabled: { settings: false } },
    };
    const result = migrate(state, 13);
    const tc = result.toolbarConfig as { enabled: Record<string, boolean> };
    // v13 guard doesn't run — settings stays false
    expect(tc.enabled.settings).toBe(false);
  });
});

// ── v13→v14: voicePreferences default ────────────────────────────────────────

describe('settingsStore.migrate — v14 voicePreferences', () => {
  it('fills voicePreferences={} when absent', () => {
    const result = migrate({}, 13);
    expect(result.voicePreferences).toEqual({});
  });

  it('preserves existing voicePreferences', () => {
    const result = migrate({ voicePreferences: { en: 'voice-A' } }, 13);
    expect((result.voicePreferences as Record<string, string>).en).toBe('voice-A');
  });
});

// ── v14→v15: headTracking drift safety net ────────────────────────────────────

describe('settingsStore.migrate — v15 drift auto-disable', () => {
  it('fills headTrackingDriftAutoDisable=true when absent', () => {
    const result = migrate({}, 14);
    expect(result.headTrackingDriftAutoDisable).toBe(true);
  });

  it('fills headTrackingDriftThresholdPx=800 when absent', () => {
    const result = migrate({}, 14);
    expect(result.headTrackingDriftThresholdPx).toBe(800);
  });

  it('fills headTrackingDriftWindowMs=5000 when absent', () => {
    const result = migrate({}, 14);
    expect(result.headTrackingDriftWindowMs).toBe(5000);
  });

  it('preserves existing drift config', () => {
    const result = migrate({
      headTrackingDriftAutoDisable: false,
      headTrackingDriftThresholdPx: 400,
      headTrackingDriftWindowMs: 3000,
    }, 14);
    expect(result.headTrackingDriftAutoDisable).toBe(false);
    expect(result.headTrackingDriftThresholdPx).toBe(400);
    expect(result.headTrackingDriftWindowMs).toBe(3000);
  });
});

// ── v15→v16: eye/gaze tracking on by default ──────────────────────────────────

describe('settingsStore.migrate — v16 eyeGaze defaults', () => {
  it('forces headTrackingEyeGaze=true regardless of prior value', () => {
    // All existing users get eye gaze on by default — opt-out in settings
    const result = migrate({ headTrackingEyeGaze: false }, 15);
    expect(result.headTrackingEyeGaze).toBe(true);
  });

  it('fills headTrackingEyeGazeWeight=0.3 when absent', () => {
    const result = migrate({}, 15);
    expect(result.headTrackingEyeGazeWeight).toBe(0.3);
  });

  it('preserves existing headTrackingEyeGazeWeight', () => {
    const result = migrate({ headTrackingEyeGazeWeight: 0.7 }, 15);
    expect(result.headTrackingEyeGazeWeight).toBe(0.7);
  });

  it('does not retroactively force eyeGaze when migrating from v16', () => {
    const result = migrate({ headTrackingEyeGaze: false }, 16);
    expect(result.headTrackingEyeGaze).toBe(false);
  });
});

// ── v16→v17: dark theme default ───────────────────────────────────────────────

describe('settingsStore.migrate — v17 dark theme default', () => {
  it('fills theme="dark" when absent', () => {
    const result = migrate({}, 16);
    expect(result.theme).toBe('dark');
  });

  it('preserves theme="light" for users who explicitly chose light', () => {
    const result = migrate({ theme: 'light' }, 16);
    expect(result.theme).toBe('light');
  });

  it('preserves theme="dark" if already set', () => {
    const result = migrate({ theme: 'dark' }, 16);
    expect(result.theme).toBe('dark');
  });
});

// ── v17→v18: announceSenderName + caregiverPinHash invalidation ───────────────

describe('settingsStore.migrate — v18 announceSenderName', () => {
  it('fills announceSenderName=false when absent', () => {
    const result = migrate({}, 17);
    expect(result.announceSenderName).toBe(false);
  });

  it('preserves announceSenderName=true when set', () => {
    const result = migrate({ announceSenderName: true }, 17);
    expect(result.announceSenderName).toBe(true);
  });
});

describe('settingsStore.migrate — v18 caregiverPinHash invalidation', () => {
  it('invalidates btoa-encoded PIN hash (base64 string, not 64 hex)', () => {
    // Old PINs were stored as btoa(pin) — e.g. btoa('1234') = 'MTIzNA=='
    const result = migrate({ caregiverPinHash: 'MTIzNA==' }, 17);
    expect(result.caregiverPinHash).toBeUndefined();
  });

  it('invalidates any non-64-hex string', () => {
    const result = migrate({ caregiverPinHash: 'dXNlcjpwYXNz' }, 17);
    expect(result.caregiverPinHash).toBeUndefined();
  });

  it('preserves a valid 64-char lowercase hex SHA-256 hash', () => {
    const validHash = 'a'.repeat(64); // 64 hex chars
    const result = migrate({ caregiverPinHash: validHash }, 17);
    expect(result.caregiverPinHash).toBe(validHash);
  });

  it('preserves a realistic SHA-256 hash string', () => {
    const sha256 = '03ac674216f3e15c761ee1a5e255f067953623c8b388b4459e13f978d7c846f4';
    const result = migrate({ caregiverPinHash: sha256 }, 17);
    expect(result.caregiverPinHash).toBe(sha256);
  });

  it('leaves caregiverPinHash=undefined untouched (no PIN set)', () => {
    const result = migrate({ caregiverPinHash: undefined }, 17);
    expect(result.caregiverPinHash).toBeUndefined();
  });

  it('leaves caregiverPinHash=null untouched (non-string)', () => {
    // null is typeof 'object', not 'string' — the guard only fires on strings
    const result = migrate({ caregiverPinHash: null }, 17);
    expect(result.caregiverPinHash).toBeNull();
  });

  it('does not run the PIN invalidation when migrating from v18', () => {
    const btoa64 = 'MTIzNA==';
    const result = migrate({ caregiverPinHash: btoa64 }, 18);
    expect(result.caregiverPinHash).toBe(btoa64);
  });
});
