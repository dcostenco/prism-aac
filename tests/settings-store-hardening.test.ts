/**
 * settingsStore — hardening: toolbar actions, installApp / uninstallApp,
 * update() numeric clamping.
 *
 * Why these paths matter:
 *
 *   toolbarToggle — caregiver hides/shows toolbar buttons. A broken toggle
 *   on 'settings' would lock the user out of all settings (guard exists).
 *   A broken toggle on other buttons leaves a phantom icon that can't be
 *   dismissed or re-enables a button the caregiver deliberately hid.
 *
 *   toolbarMove — lets caregiver reorder buttons to put the AAC user's
 *   most-used functions first. A broken swap leaves the toolbar in a half-
 *   moved state. Boundary guards (idx < 0, target out of range) prevent
 *   index errors from corrupting the order array.
 *
 *   toolbarReset — escape hatch after botched customisation. Must restore
 *   exact defaults (order AND enabled) while preserving installedApps.
 *
 *   installApp / uninstallApp — marketplace apps. Duplicate install must
 *   be idempotent (no duplicates in the array). Uninstall of an app not
 *   installed must be a no-op.
 *
 *   update() speechRate / speechVolume clamping — slider extremes (NaN,
 *   out-of-range floats) reach update() directly. Unclamped values silently
 *   break TTS or produce 0-volume speech.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import {
  useSettingsStore,
  DEFAULT_TOOLBAR_ORDER,
  DEFAULT_TOOLBAR_ENABLED,
} from '@/store/settingsStore';

// Reset to known state before each test
beforeEach(() => {
  useSettingsStore.setState({
    speechRate: 0.5,
    speechVolume: 1.0,
    toolbarConfig: {
      order: [...DEFAULT_TOOLBAR_ORDER],
      enabled: { ...DEFAULT_TOOLBAR_ENABLED },
    },
    installedApps: [],
  });
});

// ── toolbarToggle ─────────────────────────────────────────────────────────────

describe('settingsStore — toolbarToggle', () => {
  it('toggles a button off when it was enabled', () => {
    // 'mic' is enabled by default
    useSettingsStore.getState().toolbarToggle('mic');
    const { enabled } = useSettingsStore.getState().toolbarConfig;
    expect(enabled.mic).toBe(false);
  });

  it('toggles a button on when it was disabled', () => {
    useSettingsStore.getState().toolbarToggle('mic'); // off
    useSettingsStore.getState().toolbarToggle('mic'); // back on
    const { enabled } = useSettingsStore.getState().toolbarConfig;
    expect(enabled.mic).toBe(true);
  });

  it('cannot toggle "settings" off — invariant guard', () => {
    useSettingsStore.getState().toolbarToggle('settings');
    const { enabled } = useSettingsStore.getState().toolbarConfig;
    // Guard: toolbarToggle returns {} for 'settings' — value stays true
    expect(enabled.settings).toBe(true);
  });

  it('defaults missing enabled entry to true, then toggles to false', () => {
    // 'schedule' is in order but not in DEFAULT_TOOLBAR_ENABLED → defaults to true at runtime
    useSettingsStore.setState({
      toolbarConfig: {
        order: [...DEFAULT_TOOLBAR_ORDER],
        enabled: {},  // no entries — all default to true
      },
      installedApps: [],
    });
    useSettingsStore.getState().toolbarToggle('schedule');
    // cur = undefined ?? true = true → !true = false
    const { enabled } = useSettingsStore.getState().toolbarConfig;
    expect(enabled['schedule' as keyof typeof enabled]).toBe(false);
  });

  it('does not affect other buttons when toggling one', () => {
    useSettingsStore.getState().toolbarToggle('mic');
    const { enabled } = useSettingsStore.getState().toolbarConfig;
    expect(enabled.alert).toBe(true);   // untouched
    expect(enabled.categories).toBe(true); // untouched
  });
});

// ── toolbarMove ───────────────────────────────────────────────────────────────

describe('settingsStore — toolbarMove', () => {
  it('moves a button right (direction=+1) — swaps with successor', () => {
    const order = useSettingsStore.getState().toolbarConfig.order;
    const id0 = order[0];
    const id1 = order[1];
    useSettingsStore.getState().toolbarMove(id0, 1);
    const newOrder = useSettingsStore.getState().toolbarConfig.order;
    expect(newOrder[0]).toBe(id1);
    expect(newOrder[1]).toBe(id0);
  });

  it('moves a button left (direction=-1) — swaps with predecessor', () => {
    const order = useSettingsStore.getState().toolbarConfig.order;
    const id0 = order[0];
    const id1 = order[1];
    useSettingsStore.getState().toolbarMove(id1, -1);
    const newOrder = useSettingsStore.getState().toolbarConfig.order;
    expect(newOrder[0]).toBe(id1);
    expect(newOrder[1]).toBe(id0);
  });

  it('no-op at left boundary (first button moved further left)', () => {
    const before = [...useSettingsStore.getState().toolbarConfig.order];
    useSettingsStore.getState().toolbarMove(before[0], -1);
    const after = useSettingsStore.getState().toolbarConfig.order;
    expect(after).toEqual(before);
  });

  it('no-op at right boundary (last button moved further right)', () => {
    const before = [...useSettingsStore.getState().toolbarConfig.order];
    const lastId = before[before.length - 1];
    useSettingsStore.getState().toolbarMove(lastId, 1);
    const after = useSettingsStore.getState().toolbarConfig.order;
    expect(after).toEqual(before);
  });

  it('no-op when id does not exist in order', () => {
    const before = [...useSettingsStore.getState().toolbarConfig.order];
    useSettingsStore.getState().toolbarMove('nonexistent_button' as never, 1);
    const after = useSettingsStore.getState().toolbarConfig.order;
    expect(after).toEqual(before);
  });
});

// ── toolbarReset ──────────────────────────────────────────────────────────────

describe('settingsStore — toolbarReset', () => {
  it('restores order to DEFAULT_TOOLBAR_ORDER after custom move', () => {
    const order = useSettingsStore.getState().toolbarConfig.order;
    useSettingsStore.getState().toolbarMove(order[0], 1); // dirty
    useSettingsStore.getState().toolbarReset();
    expect(useSettingsStore.getState().toolbarConfig.order).toEqual(DEFAULT_TOOLBAR_ORDER);
  });

  it('restores enabled flags to DEFAULT_TOOLBAR_ENABLED after toggling', () => {
    useSettingsStore.getState().toolbarToggle('mic'); // dirty
    useSettingsStore.getState().toolbarReset();
    const { enabled } = useSettingsStore.getState().toolbarConfig;
    expect(enabled.mic).toBe(DEFAULT_TOOLBAR_ENABLED.mic);
  });

  it('preserves installedApps (reset only touches toolbarConfig)', () => {
    useSettingsStore.setState({ installedApps: ['game-pack-1'] });
    useSettingsStore.getState().toolbarReset();
    expect(useSettingsStore.getState().installedApps).toEqual(['game-pack-1']);
  });
});

// ── installApp / uninstallApp ─────────────────────────────────────────────────

describe('settingsStore — installApp', () => {
  it('appends a new app to installedApps', () => {
    useSettingsStore.getState().installApp('game-pack-1');
    expect(useSettingsStore.getState().installedApps).toContain('game-pack-1');
  });

  it('is idempotent — duplicate install does not duplicate the entry', () => {
    useSettingsStore.getState().installApp('game-pack-1');
    useSettingsStore.getState().installApp('game-pack-1');
    const apps = useSettingsStore.getState().installedApps;
    expect(apps.filter((a) => a === 'game-pack-1')).toHaveLength(1);
  });

  it('multiple different apps accumulate correctly', () => {
    useSettingsStore.getState().installApp('app-a');
    useSettingsStore.getState().installApp('app-b');
    expect(useSettingsStore.getState().installedApps).toEqual(['app-a', 'app-b']);
  });
});

describe('settingsStore — uninstallApp', () => {
  it('removes an installed app', () => {
    useSettingsStore.getState().installApp('game-pack-1');
    useSettingsStore.getState().uninstallApp('game-pack-1');
    expect(useSettingsStore.getState().installedApps).not.toContain('game-pack-1');
  });

  it('no-op when app is not in installedApps', () => {
    useSettingsStore.getState().installApp('app-a');
    useSettingsStore.getState().uninstallApp('nonexistent');
    expect(useSettingsStore.getState().installedApps).toEqual(['app-a']);
  });

  it('removes only the targeted app, leaves others intact', () => {
    useSettingsStore.getState().installApp('app-a');
    useSettingsStore.getState().installApp('app-b');
    useSettingsStore.getState().installApp('app-c');
    useSettingsStore.getState().uninstallApp('app-b');
    expect(useSettingsStore.getState().installedApps).toEqual(['app-a', 'app-c']);
  });
});

// ── update() numeric clamping ─────────────────────────────────────────────────

describe('settingsStore — update() speechRate clamping [0.25, 4]', () => {
  it('clamps below-min (0 → 0.25)', () => {
    useSettingsStore.getState().update({ speechRate: 0 });
    expect(useSettingsStore.getState().speechRate).toBe(0.25);
  });

  it('clamps above-max (5 → 4)', () => {
    useSettingsStore.getState().update({ speechRate: 5 });
    expect(useSettingsStore.getState().speechRate).toBe(4);
  });

  it('clamps NaN to default (1)', () => {
    useSettingsStore.getState().update({ speechRate: NaN });
    expect(useSettingsStore.getState().speechRate).toBe(1);
  });

  it('passes through in-range value unchanged', () => {
    useSettingsStore.getState().update({ speechRate: 1.5 });
    expect(useSettingsStore.getState().speechRate).toBe(1.5);
  });
});

describe('settingsStore — update() speechVolume clamping [0, 1]', () => {
  it('clamps below-min (-0.1 → 0)', () => {
    useSettingsStore.getState().update({ speechVolume: -0.1 });
    expect(useSettingsStore.getState().speechVolume).toBe(0);
  });

  it('clamps above-max (1.5 → 1)', () => {
    useSettingsStore.getState().update({ speechVolume: 1.5 });
    expect(useSettingsStore.getState().speechVolume).toBe(1);
  });

  it('accepts exactly 0 (min boundary)', () => {
    useSettingsStore.getState().update({ speechVolume: 0 });
    expect(useSettingsStore.getState().speechVolume).toBe(0);
  });

  it('accepts exactly 1 (max boundary)', () => {
    useSettingsStore.getState().update({ speechVolume: 1 });
    expect(useSettingsStore.getState().speechVolume).toBe(1);
  });

  it('clamps NaN to default (1)', () => {
    useSettingsStore.getState().update({ speechVolume: NaN });
    expect(useSettingsStore.getState().speechVolume).toBe(1);
  });
});
