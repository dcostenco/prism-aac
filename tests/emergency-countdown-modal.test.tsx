/**
 * EmergencyCountdownModal — life-critical UI tests
 *
 * Covers: render gating by phase, severity badges, PIN-gated cancel,
 * lockout after repeated failures, dispatched/done flow.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent, act, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import EmergencyCountdownModal from '@/components/EmergencyCountdownModal';

// ── store mocks ──────────────────────────────────────────────────────────────

const mockEmergency = {
  phase: 'idle' as string,
  phrase: '',
  severity: 'standard' as string,
  countdown: 10,
  reset: vi.fn(),
};

vi.mock('@/store/emergencyStore', () => ({
  useEmergencyStore: (sel?: (s: typeof mockEmergency) => unknown) =>
    sel ? sel(mockEmergency) : mockEmergency,
}));

const mockSettings = { caregiverPinHash: '' };

vi.mock('@/store/settingsStore', () => ({
  useSettingsStore: (sel?: (s: typeof mockSettings) => unknown) =>
    sel ? sel(mockSettings) : mockSettings,
}));

// ── service mocks ────────────────────────────────────────────────────────────

const cancelEmergencyVerifiedMock = vi.fn();
vi.mock('@/services/emergencyService', () => ({
  cancelEmergencyVerified: () => cancelEmergencyVerifiedMock(),
}));

const verifyPinMock = vi.fn(async () => false);
vi.mock('@/lib/pinCrypto', () => ({
  verifyPin: (...args: unknown[]) => verifyPinMock(...args),
}));

// ── helpers ──────────────────────────────────────────────────────────────────

function setPhase(phase: string, severity = 'standard', phrase = 'Help me') {
  mockEmergency.phase = phase;
  mockEmergency.severity = severity;
  mockEmergency.phrase = phrase;
  mockSettings.caregiverPinHash = '';
}

function setWithPin(phase: string, severity: string, phrase = 'Help me') {
  mockEmergency.phase = phase;
  mockEmergency.severity = severity;
  mockEmergency.phrase = phrase;
  mockSettings.caregiverPinHash = 'abc123hash';
}

beforeEach(() => {
  vi.clearAllMocks();
  setPhase('idle');
});

// ── render gating ────────────────────────────────────────────────────────────

describe('EmergencyCountdownModal — render gating', () => {
  it('renders nothing when phase is idle', () => {
    setPhase('idle');
    const { container } = render(<EmergencyCountdownModal />);
    expect(container.firstChild).toBeNull();
  });

  it('renders nothing when phase is cancelled', () => {
    setPhase('cancelled');
    const { container } = render(<EmergencyCountdownModal />);
    expect(container.firstChild).toBeNull();
  });

  it('renders when phase is countdown', () => {
    setPhase('countdown');
    render(<EmergencyCountdownModal />);
    expect(screen.getByRole('alertdialog')).toBeInTheDocument();
  });

  it('renders when phase is dispatching', () => {
    setPhase('dispatching');
    render(<EmergencyCountdownModal />);
    expect(screen.getByRole('alertdialog')).toBeInTheDocument();
  });

  it('renders when phase is dispatched', () => {
    setPhase('dispatched');
    render(<EmergencyCountdownModal />);
    expect(screen.getByRole('alertdialog')).toBeInTheDocument();
  });
});

// ── severity labels ──────────────────────────────────────────────────────────

describe('EmergencyCountdownModal — severity labels', () => {
  it('shows 🚨 EMERGENCY for critical', () => {
    setPhase('countdown', 'critical');
    render(<EmergencyCountdownModal />);
    expect(screen.getByText(/🚨 EMERGENCY/i)).toBeInTheDocument();
  });

  it('shows ⚠️ URGENT for urgent', () => {
    setPhase('countdown', 'urgent');
    render(<EmergencyCountdownModal />);
    expect(screen.getByText(/⚠️ URGENT/i)).toBeInTheDocument();
  });

  it('shows 🏥 MEDICAL for medical', () => {
    setPhase('countdown', 'medical');
    render(<EmergencyCountdownModal />);
    expect(screen.getByText(/🏥 MEDICAL/i)).toBeInTheDocument();
  });

  it('shows 🆘 ALERT for standard', () => {
    setPhase('countdown', 'standard');
    render(<EmergencyCountdownModal />);
    expect(screen.getByText(/🆘 ALERT/i)).toBeInTheDocument();
  });

  it('displays the phrase in the modal', () => {
    setPhase('countdown', 'standard', 'I need water');
    render(<EmergencyCountdownModal />);
    expect(screen.getByText(/I need water/)).toBeInTheDocument();
  });
});

// ── countdown display ────────────────────────────────────────────────────────

describe('EmergencyCountdownModal — countdown display', () => {
  it('shows countdown number during countdown phase', () => {
    mockEmergency.countdown = 7;
    setPhase('countdown');
    render(<EmergencyCountdownModal />);
    expect(screen.getByText('7')).toBeInTheDocument();
  });

  it('shows dispatching message during dispatching phase', () => {
    setPhase('dispatching');
    render(<EmergencyCountdownModal />);
    expect(screen.getByText(/Sending alert to caregivers/i)).toBeInTheDocument();
  });

  it('shows ✓ and Alert sent during dispatched phase', () => {
    setPhase('dispatched');
    render(<EmergencyCountdownModal />);
    expect(screen.getByText('✓')).toBeInTheDocument();
    expect(screen.getByText(/Alert sent/i)).toBeInTheDocument();
  });
});

// ── cancel button gating ─────────────────────────────────────────────────────

describe('EmergencyCountdownModal — cancel button gating', () => {
  it('shows Cancel button for standard severity in countdown', () => {
    setPhase('countdown', 'standard');
    render(<EmergencyCountdownModal />);
    expect(screen.getByRole('button', { name: /cancel/i })).toBeInTheDocument();
  });

  it('shows Cancel button for urgent severity in countdown', () => {
    setPhase('countdown', 'urgent');
    render(<EmergencyCountdownModal />);
    // Cancel present even for urgent (PIN-gated separately)
    expect(screen.getByRole('button', { name: /cancel/i })).toBeInTheDocument();
  });

  it('shows Cancel button even for critical severity (PIN-gated)', () => {
    setPhase('countdown', 'critical');
    render(<EmergencyCountdownModal />);
    expect(screen.getByRole('button', { name: /cancel/i })).toBeInTheDocument();
  });

  it('shows Done button in dispatched phase', () => {
    setPhase('dispatched');
    render(<EmergencyCountdownModal />);
    expect(screen.getByRole('button', { name: /done/i })).toBeInTheDocument();
  });

  it('Done button calls reset()', () => {
    setPhase('dispatched');
    render(<EmergencyCountdownModal />);
    fireEvent.click(screen.getByRole('button', { name: /done/i }));
    expect(mockEmergency.reset).toHaveBeenCalledOnce();
  });
});

// ── cancel without PIN ───────────────────────────────────────────────────────

describe('EmergencyCountdownModal — cancel without PIN (standard severity)', () => {
  it('calls cancelEmergencyVerified directly when no PIN is required', async () => {
    setPhase('countdown', 'standard');
    render(<EmergencyCountdownModal />);
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /cancel/i }));
    });
    expect(cancelEmergencyVerifiedMock).toHaveBeenCalledOnce();
  });
});

// ── PIN-gated cancel ─────────────────────────────────────────────────────────

describe('EmergencyCountdownModal — PIN-gated cancel (urgent + caregiverPinHash)', () => {
  beforeEach(() => {
    setWithPin('countdown', 'urgent');
  });

  it('shows PIN input field when caregiverPinHash is set', () => {
    render(<EmergencyCountdownModal />);
    expect(screen.getByPlaceholderText(/Enter PIN/i)).toBeInTheDocument();
  });

  it('wrong PIN shows Incorrect PIN error, does not cancel', async () => {
    verifyPinMock.mockResolvedValueOnce(false);
    render(<EmergencyCountdownModal />);
    fireEvent.change(screen.getByPlaceholderText(/Enter PIN/i), { target: { value: '1234' } });
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /cancel/i }));
    });
    expect(cancelEmergencyVerifiedMock).not.toHaveBeenCalled();
    expect(screen.getByText(/Incorrect PIN/i)).toBeInTheDocument();
  });

  it('correct PIN calls cancelEmergencyVerified', async () => {
    verifyPinMock.mockResolvedValueOnce(true);
    render(<EmergencyCountdownModal />);
    fireEvent.change(screen.getByPlaceholderText(/Enter PIN/i), { target: { value: '4321' } });
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /cancel/i }));
    });
    expect(cancelEmergencyVerifiedMock).toHaveBeenCalledOnce();
  });

  it('3 wrong PIN attempts lock the cancel button', async () => {
    verifyPinMock.mockResolvedValue(false);
    render(<EmergencyCountdownModal />);
    const input = screen.getByPlaceholderText(/Enter PIN/i);
    const cancelBtn = screen.getByRole('button', { name: /cancel/i });

    for (let i = 0; i < 3; i++) {
      fireEvent.change(input, { target: { value: '0000' } });
      await act(async () => { fireEvent.click(cancelBtn); });
    }

    // After 3 failures the button must be disabled
    expect(cancelBtn).toBeDisabled();
    expect(screen.getByText(/Too many attempts/i)).toBeInTheDocument();
  });

  it('empty PIN input does not call verifyPin', async () => {
    render(<EmergencyCountdownModal />);
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /cancel/i }));
    });
    expect(verifyPinMock).not.toHaveBeenCalled();
    expect(cancelEmergencyVerifiedMock).not.toHaveBeenCalled();
  });
});

// ── accessibility ────────────────────────────────────────────────────────────

describe('EmergencyCountdownModal — accessibility', () => {
  it('dialog has role="alertdialog" and aria-modal="true"', () => {
    setPhase('countdown', 'standard');
    render(<EmergencyCountdownModal />);
    const dialog = screen.getByRole('alertdialog');
    expect(dialog).toHaveAttribute('aria-modal', 'true');
  });

  it('dialog aria-label includes urgency and phrase', () => {
    setPhase('countdown', 'standard', 'Water please');
    render(<EmergencyCountdownModal />);
    const dialog = screen.getByRole('alertdialog');
    expect(dialog.getAttribute('aria-label')).toMatch(/Water please/);
    expect(dialog.getAttribute('aria-label')).toMatch(/ALERT/);
  });

  it('critical sending message says Sending emergency alert', () => {
    setPhase('countdown', 'critical');
    render(<EmergencyCountdownModal />);
    expect(screen.getByText(/Sending emergency alert/i)).toBeInTheDocument();
  });
});
