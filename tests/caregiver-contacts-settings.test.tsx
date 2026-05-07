/**
 * CaregiverContactsSettings — manual add, remove, and tier-locked
 * indicator inside the Settings modal.
 */
import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom/vitest';
import CaregiverContactsSettings from '@/components/CaregiverContactsSettings';
import { useContactsStore } from '@/store/contactsStore';
import { useAuthStore } from '@/store/authStore';

vi.mock('@/services/feedback', () => ({ tapFeedback: vi.fn() }));

const syncMock = vi.fn();
vi.mock('@/services/contactsIntegrationService', () => ({
  syncContactsOnce: (...args: unknown[]) => syncMock(...args),
}));

beforeEach(() => {
  syncMock.mockReset();
  useContactsStore.setState({ contacts: [], lastSyncedAt: 0 });
  useAuthStore.setState({ profile: { email: 'a@b.c', name: 'A', plan: 'free', isPlatformAdmin: false }, loaded: true, loading: false });
});
afterEach(() => vi.clearAllMocks());

describe('CaregiverContactsSettings — manual add', () => {
  it('adds a contact when name + recipientId are filled', async () => {
    const user = userEvent.setup();
    render(<CaregiverContactsSettings />);
    await user.type(screen.getByTestId('contact-draft-name'), 'Mom');
    await user.type(screen.getByTestId('contact-draft-recipient'), 'mom@example.com');
    // default provider is mail, which is free-tier so this works for our free user
    await user.click(screen.getByTestId('contact-draft-add'));
    expect(useContactsStore.getState().contacts).toHaveLength(1);
    expect(useContactsStore.getState().contacts[0]).toMatchObject({
      name: 'Mom',
      provider: 'mail',
      recipientId: 'mom@example.com',
    });
  });

  it('Add button is disabled until both fields are filled', async () => {
    const user = userEvent.setup();
    render(<CaregiverContactsSettings />);
    const btn = screen.getByTestId('contact-draft-add') as HTMLButtonElement;
    expect(btn).toBeDisabled();
    await user.type(screen.getByTestId('contact-draft-name'), 'Mom');
    expect(btn).toBeDisabled();
    await user.type(screen.getByTestId('contact-draft-recipient'), 'mom@x.com');
    expect(btn).not.toBeDisabled();
  });
});

describe('CaregiverContactsSettings — list rendering + tier locks', () => {
  beforeEach(() => {
    useContactsStore.setState({
      contacts: [
        { id: 'c1', name: 'Mom Mail', provider: 'mail', recipientId: 'm@x', order: 0 },
        { id: 'c2', name: 'Mom TG',   provider: 'telegram', recipientId: '111', order: 1 },
      ],
      lastSyncedAt: 0,
    });
  });

  it('lists contacts and locks providers above the user plan', () => {
    render(<CaregiverContactsSettings />);
    expect(screen.getByTestId('contact-row-c1')).toBeInTheDocument();
    expect(screen.getByTestId('contact-row-c2')).toBeInTheDocument();
    // free user: telegram locked, mail not
    expect(screen.queryByTestId('tier-locked-c1')).toBeNull();
    expect(screen.getByTestId('tier-locked-c2')).toBeInTheDocument();
  });

  it('removes a contact when × is clicked and confirmed', async () => {
    const confirmSpy = vi.spyOn(globalThis, 'confirm').mockReturnValue(true);
    const user = userEvent.setup();
    render(<CaregiverContactsSettings />);
    await user.click(screen.getByTestId('contact-remove-c1'));
    expect(useContactsStore.getState().contacts.find((c) => c.id === 'c1')).toBeUndefined();
    confirmSpy.mockRestore();
  });

  it('does not remove when the user cancels the confirm prompt', async () => {
    const confirmSpy = vi.spyOn(globalThis, 'confirm').mockReturnValue(false);
    const user = userEvent.setup();
    render(<CaregiverContactsSettings />);
    await user.click(screen.getByTestId('contact-remove-c1'));
    expect(useContactsStore.getState().contacts.find((c) => c.id === 'c1')).toBeDefined();
    confirmSpy.mockRestore();
  });
});

describe('CaregiverContactsSettings — sync button', () => {
  it('shows added/updated message after a successful sync', async () => {
    syncMock.mockResolvedValueOnce({ added: 2, updated: 1 });
    const user = userEvent.setup();
    render(<CaregiverContactsSettings />);
    await user.click(screen.getByTestId('contacts-sync-btn'));
    expect(syncMock).toHaveBeenCalled();
    expect(await screen.findByTestId('contacts-sync-msg')).toHaveTextContent('+2 new, 1 updated');
  });

  it('shows "unavailable" when the sync returns null (network/404)', async () => {
    syncMock.mockResolvedValueOnce(null);
    const user = userEvent.setup();
    render(<CaregiverContactsSettings />);
    await user.click(screen.getByTestId('contacts-sync-btn'));
    expect(await screen.findByTestId('contacts-sync-msg')).toHaveTextContent(/Sync unavailable/i);
  });
});
