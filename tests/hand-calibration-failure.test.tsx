import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import HandCalibration from '@/components/HandCalibration';

const mocks = vi.hoisted(() => ({
  initHandDetector: vi.fn(),
  resetScanAccumulator: vi.fn(),
  getActiveProfile: vi.fn(),
}));

vi.mock('@/services/handProfileService', () => ({
  initHandDetector: mocks.initHandDetector,
  detectHand: vi.fn(),
  destroyHandDetector: vi.fn(),
  accumulateHandScan: vi.fn(),
  finalizeScan: vi.fn(() => ({})),
  resetScanAccumulator: mocks.resetScanAccumulator,
  saveProfile: vi.fn(),
  setActiveProfile: vi.fn(),
  getActiveProfile: mocks.getActiveProfile,
  autoTuneFromTremor: vi.fn(profile => profile),
  recordTouchSample: vi.fn(),
  enableContinuousLearning: vi.fn(),
}));

vi.mock('@/services/feedback', () => ({
  tapFeedback: vi.fn(),
  keyFeedback: vi.fn(),
}));

vi.mock('@/engine/useT', () => ({
  useT: () => ({ t: (key: string) => key }),
}));

describe('HandCalibration initialization failures', () => {
  const getUserMedia = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    mocks.initHandDetector.mockResolvedValue(false);
    Object.defineProperty(navigator, 'mediaDevices', {
      configurable: true,
      value: { getUserMedia },
    });
  });

  it('does not disguise a missing hand tracker as touch calibration with a default profile', async () => {
    render(<HandCalibration onClose={vi.fn()} />);

    fireEvent.click(screen.getByRole('button', { name: 'Start Hand Scan' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('Hand tracking could not start');
    expect(screen.getByRole('button', { name: 'Retry Hand Scan' })).toBeInTheDocument();
    expect(screen.queryByText(/Touch Calibration/)).not.toBeInTheDocument();
    expect(screen.queryByText('Tap the blue circle')).not.toBeInTheDocument();
    expect(mocks.getActiveProfile).not.toHaveBeenCalled();
    expect(getUserMedia).not.toHaveBeenCalled();
  });

  it('resets partial scan geometry before every retry', async () => {
    render(<HandCalibration onClose={vi.fn()} />);

    fireEvent.click(screen.getByRole('button', { name: 'Start Hand Scan' }));
    await screen.findByRole('button', { name: 'Retry Hand Scan' });
    fireEvent.click(screen.getByRole('button', { name: 'Retry Hand Scan' }));

    await waitFor(() => expect(mocks.initHandDetector).toHaveBeenCalledTimes(2));
    expect(mocks.resetScanAccumulator).toHaveBeenCalledTimes(2);
  });

  it('keeps camera denial recoverable instead of collecting a fake hand profile', async () => {
    mocks.initHandDetector.mockResolvedValue(true);
    getUserMedia.mockRejectedValue(new DOMException('Permission denied', 'NotAllowedError'));

    render(<HandCalibration onClose={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: 'Start Hand Scan' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('Camera access is required');
    expect(screen.getByRole('button', { name: 'Retry Hand Scan' })).toBeInTheDocument();
    expect(screen.queryByText(/Touch Calibration/)).not.toBeInTheDocument();
    expect(mocks.getActiveProfile).not.toHaveBeenCalled();
  });

  it('does not request the camera when calibration closes during detector startup', async () => {
    let resolveDetector!: (ready: boolean) => void;
    mocks.initHandDetector.mockReturnValue(new Promise(resolve => { resolveDetector = resolve; }));
    const onClose = vi.fn();

    const { unmount } = render(<HandCalibration onClose={onClose} />);
    fireEvent.click(screen.getByRole('button', { name: 'Start Hand Scan' }));
    fireEvent.click(screen.getByRole('button', { name: 'Close hand calibration' }));
    unmount();

    await act(async () => resolveDetector(true));
    expect(getUserMedia).not.toHaveBeenCalled();
  });

  it('stops a camera stream that resolves after calibration has closed', async () => {
    mocks.initHandDetector.mockResolvedValue(true);
    let resolveCamera!: (stream: MediaStream) => void;
    getUserMedia.mockReturnValue(new Promise(resolve => { resolveCamera = resolve; }));
    const stop = vi.fn();
    const stream = { getTracks: () => [{ stop }] } as unknown as MediaStream;

    const { unmount } = render(<HandCalibration onClose={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: 'Start Hand Scan' }));
    await waitFor(() => expect(getUserMedia).toHaveBeenCalledTimes(1));
    unmount();

    await act(async () => resolveCamera(stream));
    expect(stop).toHaveBeenCalledTimes(1);
  });
});
