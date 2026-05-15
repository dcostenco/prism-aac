import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, act } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';

vi.mock('@/services/sendAlertToCaregiver', async () => {
  const actual = await vi.importActual<typeof import('@/services/sendAlertToCaregiver')>(
    '@/services/sendAlertToCaregiver',
  );
  return {
    ...actual,
    sendAlertToCaregiver: vi.fn().mockResolvedValue({ ok: true, via: { id: 'p', name: 'Mom' } }),
    resolvePrimaryCaregiver: vi.fn().mockReturnValue({ id: 'p', name: 'Mom', provider: 'sms', recipientId: '+15551234567', order: 0 }),
  };
});

import AlertConfirmModal from '@/components/AlertConfirmModal';
import { useUIStore } from '@/store/uiStore';
import { sendAlertToCaregiver } from '@/services/sendAlertToCaregiver';

describe('AlertConfirmModal', () => {
  beforeEach(() => {
    useUIStore.setState({
      alertConfirmOpen: false,
      alertSendStatus: null,
      isAlertFlashing: false,
      _alertLastFiredAt: 0,
    });
    (sendAlertToCaregiver as ReturnType<typeof vi.fn>).mockClear();
    (sendAlertToCaregiver as ReturnType<typeof vi.fn>).mockResolvedValue({ ok: true, via: { id: 'p' } });
  });

  it('does not render when closed and no status', () => {
    render(<AlertConfirmModal />);
    expect(screen.queryByTestId('alert-confirm-modal')).not.toBeInTheDocument();
  });

  it('renders Send and Cancel when alertConfirmOpen is true', () => {
    useUIStore.setState({ alertConfirmOpen: true });
    render(<AlertConfirmModal />);
    expect(screen.getByTestId('alert-confirm-modal')).toBeInTheDocument();
    expect(screen.getByTestId('alert-send')).toBeInTheDocument();
    expect(screen.getByTestId('alert-cancel')).toBeInTheDocument();
  });

  it('shows the resolved caregiver name in the body', () => {
    useUIStore.setState({ alertConfirmOpen: true });
    render(<AlertConfirmModal />);
    expect(screen.getByTestId('alert-confirm-modal')).toHaveTextContent(/Mom/);
  });

  it('Cancel dismisses the modal without calling sendAlertToCaregiver', () => {
    useUIStore.setState({ alertConfirmOpen: true });
    render(<AlertConfirmModal />);
    act(() => {
      screen.getByTestId('alert-cancel').click();
    });
    expect(useUIStore.getState().alertConfirmOpen).toBe(false);
    expect(sendAlertToCaregiver).not.toHaveBeenCalled();
  });

  it('Send calls sendAlertToCaregiver and transitions to sent status', async () => {
    useUIStore.setState({ alertConfirmOpen: true });
    render(<AlertConfirmModal />);
    await act(async () => {
      screen.getByTestId('alert-send').click();
      // Flush the async dispatch
      await Promise.resolve();
      await Promise.resolve();
    });
    expect(sendAlertToCaregiver).toHaveBeenCalledTimes(1);
    expect(useUIStore.getState().alertConfirmOpen).toBe(false);
    expect(useUIStore.getState().alertSendStatus).toBe('sent');
  });

  it('surfaces failed_no_caregiver when the caregiver is missing', async () => {
    (sendAlertToCaregiver as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      ok: false,
      error: 'no_caregiver',
    });
    useUIStore.setState({ alertConfirmOpen: true });
    render(<AlertConfirmModal />);
    await act(async () => {
      screen.getByTestId('alert-send').click();
      await Promise.resolve();
      await Promise.resolve();
    });
    expect(useUIStore.getState().alertSendStatus).toBe('failed_no_caregiver');
  });
});
