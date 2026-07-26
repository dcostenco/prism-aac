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
vi.mock('@/components/IntegrationsSettings', () => ({
  default: () => <div data-testid="integrations-settings" />,
}));

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

  it('removes a contact via inline two-step confirm', async () => {
    const user = userEvent.setup();
    render(<CaregiverContactsSettings />);
    // First click the × — should arm the confirm row, NOT remove yet.
    await user.click(screen.getByTestId('contact-remove-c1'));
    expect(useContactsStore.getState().contacts.find((c) => c.id === 'c1')).toBeDefined();
    // Confirm row appeared — clicking the "Remove?" button completes it.
    await user.click(screen.getByTestId('contact-confirm-remove-c1'));
    expect(useContactsStore.getState().contacts.find((c) => c.id === 'c1')).toBeUndefined();
  });

  it('does not remove when the user clicks cancel on the confirm row', async () => {
    const user = userEvent.setup();
    render(<CaregiverContactsSettings />);
    await user.click(screen.getByTestId('contact-remove-c1'));
    await user.click(screen.getByTestId('contact-cancel-remove-c1'));
    expect(useContactsStore.getState().contacts.find((c) => c.id === 'c1')).toBeDefined();
  });

  it('renames inline via the ✎ button — Enter commits', async () => {
    const user = userEvent.setup();
    render(<CaregiverContactsSettings />);
    await user.click(screen.getByTestId('contact-rename-c1'));
    const input = screen.getByTestId('contact-edit-c1') as HTMLInputElement;
    await user.clear(input);
    await user.type(input, 'Mama{Enter}');
    expect(useContactsStore.getState().contacts.find((c) => c.id === 'c1')?.name).toBe('Mama');
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
