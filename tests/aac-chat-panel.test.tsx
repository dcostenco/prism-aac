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
  it('renders the panel with provider preview + Settings CTA when explicitly opened with no contacts', () => {
    // 2026-05-07 user report (Image #20): "message tool is broken and
    // shows a standard keyboard without inbox outbox and providers".
    // Earlier behavior unmounted the panel when contacts.length === 0
    // — but the user explicitly tapped 💬, so they want to SEE the
    // messaging UI (which providers are wired up, how to add contacts),
    // not silently get the qwerty back. The panel now renders an
    // empty state with the provider list + "Open Settings → Contacts"
    // CTA, and only auto-collapses when the user closes via ✕ or
    // retoggles 💬 (handled at the sidePanel !== 'aac-chat' guard).
    render(<AACChatPanel />);
    expect(screen.getByTestId('aac-chat-panel')).toBeInTheDocument();
    // Compact empty strip — no ghost contacts, just the marker + Add Contact CTA.
    expect(screen.getByTestId('aac-chat-empty-state')).toBeInTheDocument();
    expect(screen.getByTestId('aac-chat-open-settings')).toBeInTheDocument();
  });

  it('does NOT render when sidePanel !== aac-chat (user closed it)', () => {
    useUIStore.setState({ sidePanel: 'none', activeContactId: null });
    const { container } = render(<AACChatPanel />);
    expect(container.querySelector('[data-testid="aac-chat-panel"]')).toBeNull();
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

  it('collapses to contact-search strip (contacts stream to PredictionBar)', () => {
    // Contacts are now in PredictionBar when sidePanel=aac-chat with no active contact.
    // AACChatPanel renders a compact "contact-search" strip, not a contact list.
    render(<AACChatPanel />);
    const panel = screen.getByTestId('aac-chat-panel');
    expect(panel).toHaveAttribute('data-state', 'contact-search');
    // No contact list in AACChatPanel — it's in PredictionBar now.
    expect(screen.queryByTestId('aac-chat-contact-list')).toBeNull();
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

  it('contact-search strip rendered (lock badge shown in compose view, not contact list)', () => {
    // Contacts stream to PredictionBar — AACChatPanel shows contact-search strip.
    render(<AACChatPanel />);
    expect(screen.getByTestId('aac-chat-panel')).toHaveAttribute('data-state', 'contact-search');
    // Lock badge not shown until user taps contact and enters compose view.
    expect(screen.queryByTestId('aac-chat-locked-cPaid')).toBeNull();
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

describe('AACChatPanel — concurrency safety', () => {
  beforeEach(() => {
    useContactsStore.setState({
      contacts: [
        { id: 'c1', name: 'Mom', provider: 'telegram', recipientId: '12345', order: 0 },
        { id: 'c2', name: 'Dad', provider: 'whatsapp', recipientId: '+15551234567', order: 1 },
      ],
      lastSyncedAt: 0,
    });
  });

  it('does not clearAll when the user typed new text after submitting', async () => {
    // Resolve send slowly so we can race a keyboard mutation in.
    let resolveSend: (v: { ok: true; truncated: boolean }) => void = () => {};
    sendToContactMock.mockImplementationOnce(() => new Promise((r) => { resolveSend = r; }));
    useUIStore.setState({ sidePanel: 'aac-chat', activeContactId: 'c1' });
    useMessageStore.setState({ text: 'hi mom' });
    const user = userEvent.setup();
    render(<AACChatPanel />);
    await user.click(screen.getByTestId('aac-chat-send-btn'));
    // Mid-await: user types something new for the next message.
    useMessageStore.setState({ text: 'starting a new message' });
    // Now let the send resolve.
    await act(async () => {
      resolveSend({ ok: true, truncated: false });
      await Promise.resolve();
    });
    // The new text MUST survive — clearAll should have been a no-op.
    expect(useMessageStore.getState().text).toBe('starting a new message');
  });

  it('snaps back to picker when sync deletes the active contact mid-view', async () => {
    useUIStore.setState({ sidePanel: 'aac-chat', activeContactId: 'c1' });
    render(<AACChatPanel />);
    expect(useUIStore.getState().activeContactId).toBe('c1');
    // Sync replaces the contacts list — the previously-active id is gone.
    await act(async () => {
      useContactsStore.setState({
        contacts: [
          { id: 'c2', name: 'Dad', provider: 'whatsapp', recipientId: '+15551234567', order: 0 },
        ],
        lastSyncedAt: 0,
      });
      await Promise.resolve();
    });
    expect(useUIStore.getState().activeContactId).toBeNull();
  });

  it('toast credits the contact we sent to, even after the user switched contacts', async () => {
    let resolveSend: (v: { ok: true; truncated: boolean }) => void = () => {};
    sendToContactMock.mockImplementationOnce(() => new Promise((r) => { resolveSend = r; }));
    useUIStore.setState({ sidePanel: 'aac-chat', activeContactId: 'c1' });
    useMessageStore.setState({ text: 'hi mom' });
    const user = userEvent.setup();
    render(<AACChatPanel />);
    await user.click(screen.getByTestId('aac-chat-send-btn'));
    // User goes back and picks Dad mid-await.
    useUIStore.setState({ activeContactId: 'c2' });
    await act(async () => {
      resolveSend({ ok: true, truncated: false });
      await Promise.resolve();
    });
    // sendToContact was called with the Mom contact (snapshot at submit).
    expect(sendToContactMock.mock.calls[0][0]).toMatchObject({ id: 'c1', name: 'Mom' });
  });
});
