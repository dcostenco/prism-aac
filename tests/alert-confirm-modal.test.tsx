/**
 * AlertConfirmModal — Send/Cancel alert confirmation dialog tests
 *
 * Covers: render gating, caregiver label, send/cancel actions,
 * status toast variants.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import AlertConfirmModal from '@/components/AlertConfirmModal';

// ── store mock ────────────────────────────────────────────────────────────────

const confirmAlertSendMock = vi.fn(async () => {});
const dismissAlertConfirmMock = vi.fn();

const uiState = {
  alertConfirmOpen: false as boolean,
  alertSendStatus: null as null | 'sending' | 'sent' | 'failed_no_caregiver' | 'failed_send',
  confirmAlertSend: confirmAlertSendMock,
  dismissAlertConfirm: dismissAlertConfirmMock,
};

vi.mock('@/store/uiStore', () => ({
  useUIStore: (sel?: (s: typeof uiState) => unknown) =>
    sel ? sel(uiState) : uiState,
}));

// ── service mocks ─────────────────────────────────────────────────────────────

const resolvePrimaryCaregiverMock = vi.fn(() => null as { name: string } | null);

vi.mock('@/services/sendAlertToCaregiver', () => ({
  resolvePrimaryCaregiver: () => resolvePrimaryCaregiverMock(),
}));

vi.mock('@/services/feedback', () => ({ tapFeedback: vi.fn() }));

vi.mock('@/engine/useT', () => ({
  useT: () => ({
    t: (k: string) => k,
    ttsCode: 'en-US',
    rtl: false,
    ready: true,
  }),
}));

// ── helpers ───────────────────────────────────────────────────────────────────

function setOpen(caregiver?: { name: string } | null) {
  uiState.alertConfirmOpen = true;
  uiState.alertSendStatus = null;
  resolvePrimaryCaregiverMock.mockReturnValue(caregiver ?? null);
}

function setStatus(status: typeof uiState.alertSendStatus) {
  uiState.alertConfirmOpen = false;
  uiState.alertSendStatus = status;
}

beforeEach(() => {
  vi.clearAllMocks();
  uiState.alertConfirmOpen = false;
  uiState.alertSendStatus = null;
});

// ── render gating ─────────────────────────────────────────────────────────────

describe('AlertConfirmModal — render gating', () => {
  it('renders nothing when open=false and status=null', () => {
    const { container } = render(<AlertConfirmModal />);
    expect(container.firstChild).toBeNull();
  });

  it('renders dialog when open=true', () => {
    setOpen();
    render(<AlertConfirmModal />);
    expect(screen.getByRole('dialog')).toBeInTheDocument();
  });

  it('renders status toast (not dialog) when open=false but status is set', () => {
    setStatus('sent');
    render(<AlertConfirmModal />);
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(screen.getByRole('status')).toBeInTheDocument();
  });
});

// ── dialog content ────────────────────────────────────────────────────────────

describe('AlertConfirmModal — dialog content', () => {
  it('shows caregiver name when resolved', () => {
    setOpen({ name: 'Mom' });
    render(<AlertConfirmModal />);
    expect(screen.getByText('Mom')).toBeInTheDocument();
  });

  it('shows fallback label when no caregiver configured', () => {
    setOpen(null);
    render(<AlertConfirmModal />);
    expect(screen.getByText('alert_no_caregiver_configured')).toBeInTheDocument();
  });

  it('dialog has aria-modal="true"', () => {
    setOpen();
    render(<AlertConfirmModal />);
    expect(screen.getByRole('dialog')).toHaveAttribute('aria-modal', 'true');
  });
});

// ── cancel action ─────────────────────────────────────────────────────────────

describe('AlertConfirmModal — cancel action', () => {
  it('Cancel button calls dismissAlertConfirm', () => {
    setOpen();
    render(<AlertConfirmModal />);
    fireEvent.click(screen.getByTestId('alert-cancel'));
    expect(dismissAlertConfirmMock).toHaveBeenCalledOnce();
  });

  it('Cancel button does not call confirmAlertSend', () => {
    setOpen();
    render(<AlertConfirmModal />);
    fireEvent.click(screen.getByTestId('alert-cancel'));
    expect(confirmAlertSendMock).not.toHaveBeenCalled();
  });
});

// ── send action ───────────────────────────────────────────────────────────────

describe('AlertConfirmModal — send action', () => {
  it('Send button calls confirmAlertSend', async () => {
    setOpen();
    render(<AlertConfirmModal />);
    await act(async () => { fireEvent.click(screen.getByTestId('alert-send')); });
    expect(confirmAlertSendMock).toHaveBeenCalledOnce();
  });

  it('Send button does not call dismissAlertConfirm', async () => {
    setOpen();
    render(<AlertConfirmModal />);
    await act(async () => { fireEvent.click(screen.getByTestId('alert-send')); });
    expect(dismissAlertConfirmMock).not.toHaveBeenCalled();
  });
});

// ── status toast ──────────────────────────────────────────────────────────────

describe('AlertConfirmModal — status toast', () => {
  it.each([
    ['sending', 'alert_status_sending'],
    ['sent', 'alert_status_sent'],
    ['failed_no_caregiver', 'alert_status_no_caregiver'],
    ['failed_send', 'alert_status_failed'],
  ] as const)('shows correct text for status=%s', (status, expectedKey) => {
    setStatus(status);
    render(<AlertConfirmModal />);
    expect(screen.getByText(expectedKey)).toBeInTheDocument();
  });
});
