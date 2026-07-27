import { describe, it, expect, beforeEach } from 'vitest';
/**
 * v19 rewrote every persisted speechRate of 1.0 down to 0.5 to undo a legacy
 * migration. It could not tell an auto-migrated 1.0 from one the user had
 * deliberately chosen, so it silently slowed down the people who had set it
 * themselves. `speechRateUserSet` records a deliberate choice from v20 on so
 * the next corrective migration cannot repeat that.
 */
import { useSettingsStore } from '@/store/settingsStore';

beforeEach(() => {
  useSettingsStore.setState({ speechRate: 0.5, speechRateUserSet: false });
});

describe('speechRateUserSet', () => {
  it('is false by default — a default rate is not a choice', () => {
    expect(useSettingsStore.getState().speechRateUserSet).toBe(false);
  });

  it('flips to true when the rate is changed through update()', () => {
    useSettingsStore.getState().update({ speechRate: 1 });
    expect(useSettingsStore.getState().speechRate).toBe(1);
    expect(useSettingsStore.getState().speechRateUserSet).toBe(true);
  });

  it('stays false when an unrelated setting is changed', () => {
    useSettingsStore.getState().update({ speechVolume: 0.7 });
    expect(useSettingsStore.getState().speechRateUserSet).toBe(false);
  });

  it('survives a rate change that gets clamped', () => {
    useSettingsStore.getState().update({ speechRate: 99 });
    expect(useSettingsStore.getState().speechRate).toBe(4); // clamped to max
    expect(useSettingsStore.getState().speechRateUserSet).toBe(true);
  });
});
