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
import english from '@/i18n/en.json';
import type { GestureConfig } from '@/services/gestureService';

// ── mocks ──────────────────────────────────────────────────────────────────────

const updateMock = vi.fn();

const settingsState = {
  cameraInputEnabled: false as boolean,
  cameraTrackingTarget: 'right_wrist' as string,
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
    t: (k: string) => english[k as keyof typeof english] ?? k,
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
  settingsState.cameraTrackingTarget = 'right_wrist';
  settingsState.showHandCalibration = false;
  settingsState.headTrackingEnabled = false;
  settingsState.headTrackingDwellMs = 1000;
  settingsState.headTrackingSensitivity = 5;
  settingsState.gestureConfig.enabled = false;
});

// ── camera input toggle ───────────────────────────────────────────────────────

describe('InputModesSettings — camera input toggle', () => {
  it('keeps native toggle targets large and separated from wrapping descriptions', () => {
    render(<InputModesSettings />);
    const toggle = screen.getByRole('button', { name: 'Camera input', exact: true });
    expect(toggle).toHaveClass('w-16', 'h-12');
    expect(toggle).toHaveClass('rounded-none');
    expect(toggle.querySelector('[aria-hidden="true"]')).toHaveClass('rounded-full', 'pointer-events-none');
    expect(toggle.closest('label')).toHaveClass('gap-8');
    expect(toggle.closest('label')?.querySelector(':scope > div')).toHaveClass('min-w-0', 'flex-1');
    fireEvent.click(toggle);
    expect(updateMock).toHaveBeenCalledExactlyOnceWith({ cameraInputEnabled: true });
  });
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

  it('offers one camera setup entry even when tracking is off without silently enabling it', () => {
    settingsState.cameraInputEnabled = false;
    render(<InputModesSettings />);
    expect(screen.getAllByTestId('camera-cursor-setup')).toHaveLength(1);
    fireEvent.click(screen.getByRole('button', { name: /set up tracking.*camera cursor/i }));
    expect(screen.getByTestId('tracking-setup-wizard')).toBeInTheDocument();
    expect(updateMock).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: /cancel wizard/i }));
    expect(screen.queryByTestId('tracking-setup-wizard')).toBeNull();
    expect(settingsState.cameraInputEnabled).toBe(false);
  });

  it('removes unsupported head tuning but preserves optional touch profiles', () => {
    settingsState.showHandCalibration = true;
    render(<InputModesSettings cameraOptions={<div data-testid="head-options" />} touchOptions={<button>Saved touch profile</button>} />);
    const group = screen.getByTestId('camera-accessibility-settings');
    expect(screen.queryByTestId('head-options')).toBeNull();
    const details = screen.getByText('Touchscreen Accuracy & Hand Profiles').closest('details')!;
    expect(group).toContainElement(details);
    expect(details).not.toHaveAttribute('open');
    expect(details).toContainElement(screen.getByText('Saved touch profile'));
    expect(screen.getAllByTestId('camera-cursor-setup')).toHaveLength(1);
  });

  it('shows tracking target chips when camera is enabled', () => {
    render(<InputModesSettings />);
    expect(screen.getByTestId('tracking-target-left_wrist')).toBeInTheDocument();
    expect(screen.getByTestId('tracking-target-right_wrist')).toBeInTheDocument();
    expect(screen.queryByTestId('tracking-target-any_wrist')).toBeNull();
    expect(screen.queryByTestId('tracking-target-nose')).toBeNull();
    expect(screen.queryByTestId('tracking-target-right_index')).toBeNull();
  });

  it('selected target has data-selected=true', () => {
    settingsState.cameraTrackingTarget = 'left_wrist';
    render(<InputModesSettings />);
    expect(screen.getByTestId('tracking-target-left_wrist')).toHaveAttribute('data-selected', 'true');
    expect(screen.getByTestId('tracking-target-right_wrist')).toHaveAttribute('data-selected', 'false');
  });

  it('clicking a tracking target calls update with new target', () => {
    render(<InputModesSettings />);
    fireEvent.click(screen.getByTestId('tracking-target-left_wrist'));
    expect(updateMock).toHaveBeenCalledWith({ cameraTrackingTarget: 'left_wrist', cameraInputEnabled: false });
  });

  it('allows explicit side selection before enabling camera input', () => {
    settingsState.cameraInputEnabled = false;
    render(<InputModesSettings />);
    expect(screen.getByTestId('tracking-target-right_wrist')).toBeInTheDocument();
  });
});

// ── setup wizard ──────────────────────────────────────────────────────────────

describe('InputModesSettings — setup wizard', () => {
  beforeEach(() => { settingsState.cameraInputEnabled = true; });

  it('does not let a legacy head flag change wrist timing controls', () => {
    settingsState.headTrackingEnabled = true;
    render(<InputModesSettings />);
    const dwell = screen.getByRole('slider', { name: /dwell time/i });
    expect(dwell).toHaveAttribute('min', '800');
    expect(screen.getAllByRole('slider', { name: /dwell time/i })).toHaveLength(1);
    expect(screen.getAllByRole('slider', { name: /sensitivity/i })).toHaveLength(1);
    fireEvent.change(dwell, { target: { value: '900' } });
    expect(updateMock).toHaveBeenCalledWith({ headTrackingDwellMs: 900 });
  });

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

  it('head tracking is disabled and cannot enable itself', async () => {
    settingsState.headTrackingEnabled = false;
    render(<InputModesSettings />);
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /head tracking/i }));
    });
    expect(screen.getByRole('button', { name: /head tracking/i })).toBeDisabled();
    expect(updateMock).not.toHaveBeenCalled();
  });
  it('legacy automatic mode requires an explicit wrist before setup or enablement', () => {
    settingsState.cameraTrackingTarget = 'any_wrist';
    settingsState.cameraInputEnabled = true;
    render(<InputModesSettings />);
    expect(screen.getByTestId('camera-cursor-setup')).toBeDisabled();
    expect(screen.getByRole('button', { name: /camera input/i })).toBeDisabled();
    expect(screen.getByRole('button', { name: /camera input/i })).toHaveAttribute('aria-pressed', 'false');
    expect(screen.getByTestId('camera-gestures-disabled')).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Switch scanning', exact: true })).not.toBeDisabled();
  });
  it('a retained enabled gesture preference is displayed as inactive, not ON', () => {
    settingsState.gestureConfig.enabled = true;
    render(<InputModesSettings />);
    expect(screen.getByTestId('gesture-recognition-details').querySelector('summary')).toHaveTextContent('off');
    expect(screen.getByRole('button', { name: 'Gesture recognition', hidden: true })).toHaveAttribute('aria-pressed', 'false');
  });
});

// ── hand calibration toggle ───────────────────────────────────────────────────

describe('InputModesSettings — hand calibration toggle', () => {
  it('renders hand calibration toggle', () => {
    render(<InputModesSettings />);
    expect(screen.getByRole('button', { name: /show touch accuracy options/i })).toBeInTheDocument();
  });

  it('clicking hand calibration toggle calls update', () => {
    render(<InputModesSettings />);
    fireEvent.click(screen.getByRole('button', { name: /show touch accuracy options/i }));
    expect(updateMock).toHaveBeenCalledWith(expect.objectContaining({ showHandCalibration: true }));
  });
});
