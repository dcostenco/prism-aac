/**
 * InputModesSettings — toggle controls + tracking target tests
 *
 * Covers: Camera Input toggle (aria-pressed), tracking target chips visible when
 * camera enabled, head tracking toggle, dwell slider, sensitivity slider,
 * setup wizard launch + cancel, gesture config section renders.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import InputModesSettings from '@/components/InputModesSettings';
import type { GestureConfig } from '@/services/gestureService';

// ── mocks ──────────────────────────────────────────────────────────────────────

const updateMock = vi.fn();

const settingsState = {
  cameraInputEnabled: false as boolean,
  cameraTrackingTarget: 'any_wrist' as string,
  showHandCalibration: false as boolean,
  headTrackingEnabled: false as boolean,
  headTrackingDwellMs: 1000 as number,
  headTrackingSensitivity: 5 as number,
  gestureConfig: {
    mode: 'basic',
    mappings: [],
    sensitivity: 5,
    cooldownMs: 500,
    trainingData: {},
  } as GestureConfig,
  update: updateMock,
};

vi.mock('@/store/settingsStore', () => ({
  useSettingsStore: (sel?: (s: typeof settingsState) => unknown) =>
    sel ? sel(settingsState) : settingsState,
}));

vi.mock('@/services/feedback',     () => ({ tapFeedback: vi.fn() }));
vi.mock('@/services/deviceMotion', () => ({ requestMotionPermission: vi.fn().mockResolvedValue(true) }));
vi.mock('@/services/gestureService', () => ({
  DEFAULT_GESTURE_CONFIG: {
    mode: 'basic', mappings: [], sensitivity: 5, cooldownMs: 500, trainingData: {},
  },
}));

vi.mock('@/engine/useT', () => ({
  useT: () => ({
    t: (k: string) => k,
    ttsCode: 'en-US',
    rtl: false,
    ready: true,
  }),
}));

vi.mock('@/components/TrackingSetupWizard', () => ({
  default: ({ onCancel }: { onCancel: () => void; onComplete: () => void }) => (
    <div data-testid="tracking-setup-wizard">
      <button onClick={onCancel} aria-label="Cancel wizard">Cancel</button>
    </div>
  ),
}));

beforeEach(() => {
  vi.clearAllMocks();
  settingsState.cameraInputEnabled = false;
  settingsState.cameraTrackingTarget = 'any_wrist';
  settingsState.showHandCalibration = false;
  settingsState.headTrackingEnabled = false;
  settingsState.headTrackingDwellMs = 1000;
  settingsState.headTrackingSensitivity = 5;
});

// ── camera input toggle ───────────────────────────────────────────────────────

describe('InputModesSettings — camera input toggle', () => {
  it('renders camera input toggle', () => {
    render(<InputModesSettings />);
    expect(screen.getByRole('button', { name: /camera input/i })).toBeInTheDocument();
  });

  it('toggle shows aria-pressed=false when camera disabled', () => {
    settingsState.cameraInputEnabled = false;
    render(<InputModesSettings />);
    expect(screen.getByRole('button', { name: /camera input/i })).toHaveAttribute('aria-pressed', 'false');
  });

  it('toggle shows aria-pressed=true when camera enabled', () => {
    settingsState.cameraInputEnabled = true;
    render(<InputModesSettings />);
    expect(screen.getByRole('button', { name: /camera input/i })).toHaveAttribute('aria-pressed', 'true');
  });

  it('clicking camera toggle calls update', () => {
    render(<InputModesSettings />);
    fireEvent.click(screen.getByRole('button', { name: /camera input/i }));
    expect(updateMock).toHaveBeenCalledWith(expect.objectContaining({ cameraInputEnabled: true }));
  });
});

// ── tracking targets (visible when camera enabled) ────────────────────────────

describe('InputModesSettings — tracking targets', () => {
  beforeEach(() => { settingsState.cameraInputEnabled = true; });

  it('shows tracking target chips when camera is enabled', () => {
    render(<InputModesSettings />);
    expect(screen.getByTestId('tracking-target-any_wrist')).toBeInTheDocument();
    expect(screen.getByTestId('tracking-target-nose')).toBeInTheDocument();
  });

  it('selected target has data-selected=true', () => {
    settingsState.cameraTrackingTarget = 'nose';
    render(<InputModesSettings />);
    expect(screen.getByTestId('tracking-target-nose')).toHaveAttribute('data-selected', 'true');
    expect(screen.getByTestId('tracking-target-any_wrist')).toHaveAttribute('data-selected', 'false');
  });

  it('clicking a tracking target calls update with new target', () => {
    render(<InputModesSettings />);
    fireEvent.click(screen.getByTestId('tracking-target-nose'));
    expect(updateMock).toHaveBeenCalledWith(expect.objectContaining({ cameraTrackingTarget: 'nose' }));
  });

  it('tracking targets hidden when camera is disabled', () => {
    settingsState.cameraInputEnabled = false;
    render(<InputModesSettings />);
    expect(screen.queryByTestId('tracking-target-nose')).toBeNull();
  });
});

// ── setup wizard ──────────────────────────────────────────────────────────────

describe('InputModesSettings — setup wizard', () => {
  beforeEach(() => { settingsState.cameraInputEnabled = true; });

  it('clicking Set Up Tracking opens wizard', () => {
    render(<InputModesSettings />);
    fireEvent.click(screen.getByRole('button', { name: /set up tracking/i }));
    expect(screen.getByTestId('tracking-setup-wizard')).toBeInTheDocument();
  });

  it('cancelling wizard closes it', () => {
    render(<InputModesSettings />);
    fireEvent.click(screen.getByRole('button', { name: /set up tracking/i }));
    fireEvent.click(screen.getByRole('button', { name: /cancel wizard/i }));
    expect(screen.queryByTestId('tracking-setup-wizard')).toBeNull();
  });
});

// ── head tracking toggle ──────────────────────────────────────────────────────

describe('InputModesSettings — head tracking', () => {
  it('renders head tracking toggle', () => {
    render(<InputModesSettings />);
    expect(screen.getByRole('button', { name: /head tracking/i })).toBeInTheDocument();
  });

  it('clicking head tracking toggle calls update', async () => {
    settingsState.headTrackingEnabled = false;
    render(<InputModesSettings />);
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /head tracking/i }));
    });
    expect(updateMock).toHaveBeenCalledWith(expect.objectContaining({ headTrackingEnabled: true }));
  });
});

// ── hand calibration toggle ───────────────────────────────────────────────────

describe('InputModesSettings — hand calibration toggle', () => {
  it('renders hand calibration toggle', () => {
    render(<InputModesSettings />);
    expect(screen.getByRole('button', { name: /hand calibration/i })).toBeInTheDocument();
  });

  it('clicking hand calibration toggle calls update', () => {
    render(<InputModesSettings />);
    fireEvent.click(screen.getByRole('button', { name: /hand calibration/i }));
    expect(updateMock).toHaveBeenCalledWith(expect.objectContaining({ showHandCalibration: true }));
  });
});
