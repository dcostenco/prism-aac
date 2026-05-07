/**
 * AACChatPanel — picker → compose → send flow + tier gating.
 */
import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { render, screen, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom/vitest';
import AACChatPanel from '@/components/AACChatPanel';
import { useUIStore } from '@/store/uiStore';
import { useContactsStore } from '@/store/contactsStore';
import { useMessageStore } from '@/store/messageStore';
import { useAuthStore } from '@/store/authStore';

vi.mock('@/engine/useT', () => ({
  useT: () => ({ t: (k: string) => k, ttsCode: 'en-US', rtl: false, ready: true }),
}));
vi.mock('@/services/feedback', () => ({
  tapFeedback: vi.fn(),
}));

const sendToContactMock = vi.fn();
vi.mock('@/services/sendToContact', async () => {
  const actual = await vi.importActual<typeof import('@/services/sendToContact')>('@/services/sendToContact');
  return {
    ...actual,
    sendToContact: (...args: unknown[]) => sendToContactMock(...args),
  };
});

beforeEach(() => {
  sendToContactMock.mockReset();
  useUIStore.setState({ sidePanel: 'aac-chat', activeContactId: null });
  useContactsStore.setState({ contacts: [], lastSyncedAt: 0 });
  useMessageStore.setState({ text: '' });
  useAuthStore.setState({ profile: { email: 't@t', name: 'T', plan: 'standard', isPlatformAdmin: false }, loaded: true, loading: false });
});

afterEach(() => {
  vi.clearAllMocks();
});

describe('AACChatPanel — empty state', () => {
  it('shows empty hint when no contacts are configured', () => {
    render(<AACChatPanel />);
    expect(screen.getByText(/aac_chat_no_contacts|no contacts/i)).toBeInTheDocument();
  });
});

describe('AACChatPanel — picker → compose flow', () => {
  beforeEach(() => {
    useContactsStore.setState({
      contacts: [
        { id: 'c1', name: 'Mom', provider: 'telegram', recipientId: '12345', order: 0 },
        { id: 'c2', name: 'Dad', provider: 'whatsapp', recipientId: '+15551234567', order: 1 },
      ],
      lastSyncedAt: 0,
    });
  });

  it('shows the contact list and allows selecting a contact', async () => {
    const user = userEvent.setup();
    render(<AACChatPanel />);
    expect(screen.getByTestId('aac-chat-contact-list')).toBeInTheDocument();
    expect(screen.getByTestId('aac-chat-contact-c1')).toBeInTheDocument();
    expect(screen.getByTestId('aac-chat-contact-c2')).toBeInTheDocument();

    await user.click(screen.getByTestId('aac-chat-contact-c1'));
    expect(useUIStore.getState().activeContactId).toBe('c1');
  });

  it('shows compose preview when a contact is active', () => {
    useUIStore.setState({ sidePanel: 'aac-chat', activeContactId: 'c1' });
    useMessageStore.setState({ text: 'hi mom' });
    render(<AACChatPanel />);
    expect(screen.getByTestId('aac-chat-compose-preview')).toHaveTextContent('hi mom');
  });

  it('Send button is disabled when text is empty', () => {
    useUIStore.setState({ sidePanel: 'aac-chat', activeContactId: 'c1' });
    useMessageStore.setState({ text: '' });
    render(<AACChatPanel />);
    expect(screen.getByTestId('aac-chat-send-btn')).toBeDisabled();
  });

  it('calls sendToContact + clears the bar on success', async () => {
    sendToContactMock.mockResolvedValueOnce({ ok: true });
    useUIStore.setState({ sidePanel: 'aac-chat', activeContactId: 'c1' });
    useMessageStore.setState({ text: 'hi mom' });
    const user = userEvent.setup();
    render(<AACChatPanel />);
    await user.click(screen.getByTestId('aac-chat-send-btn'));
    expect(sendToContactMock).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'c1', provider: 'telegram' }),
      'hi mom',
      'standard',
    );
    expect(useMessageStore.getState().text).toBe('');
  });

  it('keeps the text in the bar on send failure (so user can retry)', async () => {
    sendToContactMock.mockResolvedValueOnce({ ok: false, error: 'HTTP 500' });
    useUIStore.setState({ sidePanel: 'aac-chat', activeContactId: 'c1' });
    useMessageStore.setState({ text: 'still here' });
    const user = userEvent.setup();
    render(<AACChatPanel />);
    await user.click(screen.getByTestId('aac-chat-send-btn'));
    expect(useMessageStore.getState().text).toBe('still here');
  });

  it('Back button returns to the picker', async () => {
    useUIStore.setState({ sidePanel: 'aac-chat', activeContactId: 'c1' });
    const user = userEvent.setup();
    render(<AACChatPanel />);
    await user.click(screen.getByLabelText(/back/i));
    expect(useUIStore.getState().activeContactId).toBeNull();
  });
});

describe('AACChatPanel — tier gating', () => {
  beforeEach(() => {
    useAuthStore.setState({ profile: { email: 't@t', name: 'T', plan: 'free', isPlatformAdmin: false }, loaded: true, loading: false });
    useContactsStore.setState({
      contacts: [
        { id: 'cFree', name: 'Mail Buddy', provider: 'mail', recipientId: 'a@b.c', order: 0 },
        { id: 'cPaid', name: 'TG Mom', provider: 'telegram', recipientId: '12345', order: 1 },
      ],
      lastSyncedAt: 0,
    });
  });

  it('renders a 🔒 badge on contacts whose provider is above the user plan', () => {
    render(<AACChatPanel />);
    // Mail is free → no lock badge
    expect(screen.queryByTestId('aac-chat-locked-cFree')).toBeNull();
    // Telegram requires standard → locked for free user
    expect(screen.getByTestId('aac-chat-locked-cPaid')).toBeInTheDocument();
  });

  it('shows tier warning banner + disables Send when active contact is locked', () => {
    useUIStore.setState({ sidePanel: 'aac-chat', activeContactId: 'cPaid' });
    useMessageStore.setState({ text: 'hi' });
    render(<AACChatPanel />);
    expect(screen.getByTestId('aac-chat-tier-warning')).toBeInTheDocument();
    expect(screen.getByTestId('aac-chat-send-btn')).toBeDisabled();
  });

  it('does NOT block Send when contact is on user plan', () => {
    useUIStore.setState({ sidePanel: 'aac-chat', activeContactId: 'cFree' });
    useMessageStore.setState({ text: 'hi' });
    render(<AACChatPanel />);
    expect(screen.queryByTestId('aac-chat-tier-warning')).toBeNull();
    expect(screen.getByTestId('aac-chat-send-btn')).not.toBeDisabled();
  });
});

describe('AACChatPanel — visibility', () => {
  it('renders nothing when sidePanel !== aac-chat', () => {
    useUIStore.setState({ sidePanel: 'none', activeContactId: null });
    const { container } = render(<AACChatPanel />);
    expect(container.firstChild).toBeNull();
  });
});
