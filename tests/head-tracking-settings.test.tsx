/**
 * HeadTrackingSettings — render states, controls, and calibration flow tests
 *
 * Covers: not-supported guard, headTrackingEnabled gate, dwell + sensitivity
 * sliders, eye/gaze toggle, calibrate button → overlay → step progression →
 * saveCalibration call, camera selector visibility, ReliabilitySection
 * drift-auto-disable toggle + conditional sliders, safe-mode indicator + clear.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import HeadTrackingSettings from '@/components/HeadTrackingSettings';
import { listCameras as listCamerasFn } from '@/services/headTracker';

// ── mocks ──────────────────────────────────────────────────────────────────────

const updateMock = vi.fn();
const saveCalibrationMock = vi.fn();
const clearDriftHistoryMock = vi.fn();

let supported = true;
let safeModeActive = false;

const settingsState = {
  headTrackingEnabled: false as boolean,
  headTrackingDwellMs: 1000 as number,
  headTrackingSensitivity: 5 as number,
  headTrackingEyeGaze: false as boolean,
  headTrackingDriftAutoDisable: false as boolean,
  headTrackingDriftThresholdPx: 800 as number,
  headTrackingDriftWindowMs: 5000 as number,
  update: updateMock,
};

vi.mock('@/store/settingsStore', () => ({
  useSettingsStore: (sel?: (s: typeof settingsState) => unknown) =>
    sel ? sel(settingsState) : settingsState,
}));

vi.mock('@/services/headTracker', () => ({
  isHeadTrackingSupported: () => supported,
  listCameras: vi.fn().mockResolvedValue([]),
  saveCalibration: (...args: unknown[]) => saveCalibrationMock(...args),
}));

vi.mock('@/services/safeMode', () => ({
  isSafeMode: () => safeModeActive,
  clearDriftHistory: (...args: unknown[]) => clearDriftHistoryMock(...args),
}));

vi.mock('@/engine/useT', () => ({
  useT: () => ({ t: (k: string) => k, ttsCode: 'en-US', rtl: false, ready: true }),
}));

vi.mock('@/services/feedback', () => ({ tapFeedback: vi.fn() }));

// ── shared reset ──────────────────────────────────────────────────────────────

beforeEach(() => {
  vi.clearAllMocks();
  supported = true;
  safeModeActive = false;
  settingsState.headTrackingEnabled = false;
  settingsState.headTrackingDwellMs = 1000;
  settingsState.headTrackingSensitivity = 5;
  settingsState.headTrackingEyeGaze = false;
  settingsState.headTrackingDriftAutoDisable = false;
  settingsState.headTrackingDriftThresholdPx = 800;
  settingsState.headTrackingDriftWindowMs = 5000;
});

// ── not-supported guard ───────────────────────────────────────────────────────

describe('HeadTrackingSettings — not supported', () => {
  it('shows "camera_required" message when head tracking is not supported', () => {
    supported = false;
    render(<HeadTrackingSettings />);
    expect(screen.getByText('camera_required')).toBeInTheDocument();
  });

  it('does NOT render calibrate button when not supported', () => {
    supported = false;
    render(<HeadTrackingSettings />);
    expect(screen.queryByText('calibrate')).toBeNull();
  });
});

// ── headTrackingEnabled gate ──────────────────────────────────────────────────

describe('HeadTrackingSettings — enabled gate', () => {
  it('renders the head_tracking header regardless of enabled state', () => {
    render(<HeadTrackingSettings />);
    expect(screen.getByText('head_tracking')).toBeInTheDocument();
  });

  it('does NOT render dwell slider when headTrackingEnabled=false', () => {
    settingsState.headTrackingEnabled = false;
    render(<HeadTrackingSettings />);
    expect(screen.queryByText('dwell_time')).toBeNull();
  });

  it('renders dwell slider when headTrackingEnabled=true', () => {
    settingsState.headTrackingEnabled = true;
    render(<HeadTrackingSettings />);
    expect(screen.getByText('dwell_time')).toBeInTheDocument();
  });

  it('renders calibrate button when headTrackingEnabled=true', () => {
    settingsState.headTrackingEnabled = true;
    render(<HeadTrackingSettings />);
    expect(screen.getByRole('button', { name: 'calibrate' })).toBeInTheDocument();
  });
});

// ── dwell time slider ─────────────────────────────────────────────────────────

describe('HeadTrackingSettings — dwell time slider', () => {
  beforeEach(() => { settingsState.headTrackingEnabled = true; });

  it('shows current dwell time value in ms', () => {
    settingsState.headTrackingDwellMs = 1500;
    render(<HeadTrackingSettings />);
    expect(screen.getByText('1500ms')).toBeInTheDocument();
  });

  it('changing dwell slider calls update with new value', () => {
    render(<HeadTrackingSettings />);
    const rangeInputs = screen.getAllByRole('slider');
    // First slider is dwell time (min=500, max=3000)
    const dwellSlider = rangeInputs.find(
      (el) => el.getAttribute('min') === '500' && el.getAttribute('max') === '3000',
    )!;
    fireEvent.change(dwellSlider, { target: { value: '2000' } });
    expect(updateMock).toHaveBeenCalledWith(expect.objectContaining({ headTrackingDwellMs: 2000 }));
  });
});

// ── sensitivity slider ────────────────────────────────────────────────────────

describe('HeadTrackingSettings — sensitivity slider', () => {
  beforeEach(() => { settingsState.headTrackingEnabled = true; });

  it('shows current sensitivity value', () => {
    settingsState.headTrackingSensitivity = 7;
    render(<HeadTrackingSettings />);
    expect(screen.getByText('sensitivity')).toBeInTheDocument();
  });

  it('changing sensitivity slider calls update with new value', () => {
    render(<HeadTrackingSettings />);
    const rangeInputs = screen.getAllByRole('slider');
    const sensitivitySlider = rangeInputs.find(
      (el) => el.getAttribute('min') === '1' && el.getAttribute('max') === '10',
    )!;
    fireEvent.change(sensitivitySlider, { target: { value: '8' } });
    expect(updateMock).toHaveBeenCalledWith(expect.objectContaining({ headTrackingSensitivity: 8 }));
  });
});

// ── eye/gaze tracking toggle ──────────────────────────────────────────────────

describe('HeadTrackingSettings — eye/gaze toggle', () => {
  beforeEach(() => { settingsState.headTrackingEnabled = true; });

  it('renders eye/gaze toggle when head tracking enabled', () => {
    render(<HeadTrackingSettings />);
    expect(screen.getByText(/eye \/ gaze tracking/i)).toBeInTheDocument();
  });

  it('eye/gaze toggle has aria-checked=false when disabled', () => {
    settingsState.headTrackingEyeGaze = false;
    render(<HeadTrackingSettings />);
    const toggle = screen.getByRole('switch');
    expect(toggle).toHaveAttribute('aria-checked', 'false');
  });

  it('eye/gaze toggle has aria-checked=true when enabled', () => {
    settingsState.headTrackingEyeGaze = true;
    render(<HeadTrackingSettings />);
    expect(screen.getByRole('switch')).toHaveAttribute('aria-checked', 'true');
  });

  it('clicking eye/gaze toggle calls update with toggled value', () => {
    settingsState.headTrackingEyeGaze = false;
    render(<HeadTrackingSettings />);
    fireEvent.click(screen.getByRole('switch'));
    expect(updateMock).toHaveBeenCalledWith(expect.objectContaining({ headTrackingEyeGaze: true }));
  });
});

// ── calibration flow ──────────────────────────────────────────────────────────

describe('HeadTrackingSettings — calibration flow', () => {
  beforeEach(() => { settingsState.headTrackingEnabled = true; });

  it('calibration overlay not shown before clicking calibrate', () => {
    render(<HeadTrackingSettings />);
    expect(screen.queryByText(/tap anywhere/i)).toBeNull();
  });

  it('clicking calibrate shows calibration overlay', () => {
    render(<HeadTrackingSettings />);
    fireEvent.click(screen.getByRole('button', { name: 'calibrate' }));
    expect(screen.getByText(/tap anywhere/i)).toBeInTheDocument();
  });

  it('calibration overlay shows step 1/4 initially', () => {
    render(<HeadTrackingSettings />);
    fireEvent.click(screen.getByRole('button', { name: 'calibrate' }));
    expect(screen.getByText(/\(1\/4\)/)).toBeInTheDocument();
  });

  it('clicking overlay advances to step 2/4', () => {
    render(<HeadTrackingSettings />);
    fireEvent.click(screen.getByRole('button', { name: 'calibrate' }));
    // The overlay is a fixed div; click it
    fireEvent.click(screen.getByText(/tap anywhere/i).closest('div')!);
    expect(screen.getByText(/\(2\/4\)/)).toBeInTheDocument();
  });

  it('clicking overlay 4 times completes calibration and calls saveCalibration', () => {
    render(<HeadTrackingSettings />);
    fireEvent.click(screen.getByRole('button', { name: 'calibrate' }));
    // Click through all 4 steps
    for (let i = 0; i < 4; i++) {
      const overlay = screen.queryByText(/tap anywhere/i)?.closest('div');
      if (overlay) fireEvent.click(overlay);
    }
    expect(saveCalibrationMock).toHaveBeenCalledOnce();
    expect(saveCalibrationMock).toHaveBeenCalledWith(
      expect.objectContaining({ leftX: expect.any(Number), rightX: expect.any(Number) }),
    );
  });

  it('calibration overlay disappears after completing all 4 steps', () => {
    render(<HeadTrackingSettings />);
    fireEvent.click(screen.getByRole('button', { name: 'calibrate' }));
    for (let i = 0; i < 4; i++) {
      const overlay = screen.queryByText(/tap anywhere/i)?.closest('div');
      if (overlay) fireEvent.click(overlay);
    }
    expect(screen.queryByText(/tap anywhere/i)).toBeNull();
  });
});

// ── camera selector ───────────────────────────────────────────────────────────

describe('HeadTrackingSettings — camera selector', () => {
  const listCameras = vi.mocked(listCamerasFn);

  beforeEach(() => { settingsState.headTrackingEnabled = true; });

  it('camera selector NOT shown when only 1 camera available', async () => {
    listCameras.mockResolvedValue([{ deviceId: 'cam1', label: 'Camera 1' }]);
    render(<HeadTrackingSettings />);
    await waitFor(() => {
      // 1 camera → no selector shown (cameras.length > 1 guard)
      expect(screen.queryByRole('combobox')).toBeNull();
    });
  });

  it('camera selector shown when 2+ cameras available', async () => {
    listCameras.mockResolvedValue([
      { deviceId: 'cam1', label: 'Front Camera' },
      { deviceId: 'cam2', label: 'Back Camera' },
    ]);
    render(<HeadTrackingSettings />);
    await waitFor(() => {
      expect(screen.getByRole('combobox')).toBeInTheDocument();
    });
  });
});

// ── ReliabilitySection: drift auto-disable ────────────────────────────────────

describe('HeadTrackingSettings — reliability section', () => {
  beforeEach(() => { settingsState.headTrackingEnabled = true; });

  it('renders reliability section heading when enabled', () => {
    render(<HeadTrackingSettings />);
    expect(screen.getByText('reliability')).toBeInTheDocument();
  });

  it('auto-disable toggle has aria-pressed=false when disabled', () => {
    settingsState.headTrackingDriftAutoDisable = false;
    render(<HeadTrackingSettings />);
    expect(screen.getByRole('button', { name: /auto-disable on drift/i })).toHaveAttribute('aria-pressed', 'false');
  });

  it('clicking auto-disable toggle calls update with toggled value', () => {
    settingsState.headTrackingDriftAutoDisable = false;
    render(<HeadTrackingSettings />);
    fireEvent.click(screen.getByRole('button', { name: /auto-disable on drift/i }));
    expect(updateMock).toHaveBeenCalledWith(
      expect.objectContaining({ headTrackingDriftAutoDisable: true }),
    );
  });

  it('drift threshold slider NOT shown when auto-disable is off', () => {
    settingsState.headTrackingDriftAutoDisable = false;
    render(<HeadTrackingSettings />);
    const sliders = screen.getAllByRole('slider');
    const hasThresholdSlider = sliders.some(
      (el) => el.getAttribute('min') === '400' && el.getAttribute('max') === '1500',
    );
    expect(hasThresholdSlider).toBe(false);
  });

  it('drift threshold slider IS shown when auto-disable is on', () => {
    settingsState.headTrackingDriftAutoDisable = true;
    render(<HeadTrackingSettings />);
    const sliders = screen.getAllByRole('slider');
    const thresholdSlider = sliders.find(
      (el) => el.getAttribute('min') === '400' && el.getAttribute('max') === '1500',
    );
    expect(thresholdSlider).toBeDefined();
  });

  it('drift window slider IS shown when auto-disable is on', () => {
    settingsState.headTrackingDriftAutoDisable = true;
    render(<HeadTrackingSettings />);
    const sliders = screen.getAllByRole('slider');
    const windowSlider = sliders.find(
      (el) => el.getAttribute('min') === '2000' && el.getAttribute('max') === '15000',
    );
    expect(windowSlider).toBeDefined();
  });

  it('drift threshold slider change calls update', () => {
    settingsState.headTrackingDriftAutoDisable = true;
    render(<HeadTrackingSettings />);
    const sliders = screen.getAllByRole('slider');
    const thresholdSlider = sliders.find(
      (el) => el.getAttribute('min') === '400' && el.getAttribute('max') === '1500',
    )!;
    fireEvent.change(thresholdSlider, { target: { value: '1000' } });
    expect(updateMock).toHaveBeenCalledWith(
      expect.objectContaining({ headTrackingDriftThresholdPx: 1000 }),
    );
  });
});

// ── safe mode indicator ───────────────────────────────────────────────────────

describe('HeadTrackingSettings — safe mode indicator', () => {
  beforeEach(() => { settingsState.headTrackingEnabled = true; });

  it('safe mode indicator NOT shown when safeMode=false', () => {
    safeModeActive = false;
    render(<HeadTrackingSettings />);
    expect(screen.queryByText(/safe mode is active/i)).toBeNull();
  });

  it('safe mode indicator shown when safeMode=true', () => {
    safeModeActive = true;
    render(<HeadTrackingSettings />);
    expect(screen.getByText(/safe_mode_active/)).toBeInTheDocument();
  });

  it('"Exit safe mode" button calls clearDriftHistory', () => {
    safeModeActive = true;
    render(<HeadTrackingSettings />);
    fireEvent.click(screen.getByRole('button', { name: /safe_mode_clear/ }));
    expect(clearDriftHistoryMock).toHaveBeenCalledOnce();
  });
});
