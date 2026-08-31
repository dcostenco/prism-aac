/**
 * IntegrationsSettings — provider list, connect, reconnect, planned, error tests
 *
 * Covers: loading state, error state, connected / available / planned rows,
 * Connect button visibility, Reconnect button, refresh button, origin guard.
 *
 * listIntegrations is mocked; subscribeToIntegrationEvents is a no-op.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { act, render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import IntegrationsSettings from '@/components/IntegrationsSettings';
import type { IntegrationProvider } from '@/services/integrationsService';

// ── mocks ──────────────────────────────────────────────────────────────────────

const listIntegrationsMock = vi.fn();
const disconnectProviderMock = vi.fn();

vi.mock('@/services/integrationsService', () => ({
  listIntegrations: (...args: unknown[]) => listIntegrationsMock(...args),
  disconnectProvider: (...args: unknown[]) => disconnectProviderMock(...args),
  subscribeToIntegrationEvents: () => () => {},
}));

vi.mock('@/services/feedback', () => ({ tapFeedback: vi.fn() }));

// ── helpers ───────────────────────────────────────────────────────────────────

const makeProvider = (overrides: Partial<IntegrationProvider>): IntegrationProvider => ({
  id: 'gmail',
  label: 'Gmail',
  icon: '📧',
  kind: 'mail',
  status: 'available',
  connectUrl: 'https://synalux.ai/connect?provider=gmail',
  auth: 'oauth2',
  ...overrides,
});

beforeEach(() => {
  vi.clearAllMocks();
  listIntegrationsMock.mockResolvedValue([]);
  disconnectProviderMock.mockResolvedValue(true);
});

// ── loading state ─────────────────────────────────────────────────────────────

describe('IntegrationsSettings — loading state', () => {
  it('shows loading indicator while providers are being fetched', async () => {
    // Never resolve — stays in loading
    listIntegrationsMock.mockReturnValue(new Promise(() => {}));
    render(<IntegrationsSettings />);
    await waitFor(() => {
      expect(screen.getByTestId('integrations-loading')).toBeInTheDocument();
    });
  });

  it('loading indicator disappears after providers load', async () => {
    listIntegrationsMock.mockResolvedValue([]);
    render(<IntegrationsSettings />);
    await waitFor(() => {
      expect(screen.queryByTestId('integrations-loading')).toBeNull();
    });
  });

  it('ignores a failed provider load after unmount', async () => {
    let rejectLoad: (error: Error) => void = () => {};
    listIntegrationsMock.mockReturnValue(new Promise((_, reject) => {
      rejectLoad = reject;
    }));
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const view = render(<IntegrationsSettings />);
    await waitFor(() => {
      expect(screen.getByTestId('integrations-loading')).toBeInTheDocument();
    });

    view.unmount();
    await act(async () => {
      rejectLoad(new Error('late network failure'));
      await Promise.resolve();
    });

    expect(warnSpy).not.toHaveBeenCalled();
    warnSpy.mockRestore();
  });
});

// ── error state ───────────────────────────────────────────────────────────────

describe('IntegrationsSettings — error state', () => {
  it('shows error alert when listIntegrations throws', async () => {
    listIntegrationsMock.mockRejectedValue(new Error('network'));
    render(<IntegrationsSettings />);
    await waitFor(() => {
      expect(screen.getByRole('alert')).toBeInTheDocument();
    });
  });

  it('error alert contains expected text', async () => {
    listIntegrationsMock.mockRejectedValue(new Error('fail'));
    render(<IntegrationsSettings />);
    await waitFor(() => {
      expect(screen.getByTestId('integrations-error')).toHaveTextContent(/could not load/i);
    });
  });
});

// ── available provider ────────────────────────────────────────────────────────

describe('IntegrationsSettings — available provider', () => {
  const gmail = makeProvider({ status: 'available', kind: 'mail' });

  beforeEach(() => {
    listIntegrationsMock.mockResolvedValue([gmail]);
  });

  it('renders provider label', async () => {
    render(<IntegrationsSettings />);
    await waitFor(() => expect(screen.getByText('Gmail')).toBeInTheDocument());
  });

  it('shows Connect button for available provider', async () => {
    render(<IntegrationsSettings />);
    await waitFor(() => {
      expect(screen.getByTestId('integration-connect-gmail')).toBeInTheDocument();
    });
  });

  it('Connect button text is "Connect"', async () => {
    render(<IntegrationsSettings />);
    await waitFor(() => {
      expect(screen.getByTestId('integration-connect-gmail')).toHaveTextContent('Connect');
    });
  });

  it('Connect button is NOT disabled initially', async () => {
    render(<IntegrationsSettings />);
    await waitFor(() => {
      expect(screen.getByTestId('integration-connect-gmail')).not.toBeDisabled();
    });
  });

  it('refuses an OAuth URL on an unexpected HTTPS origin', async () => {
    listIntegrationsMock.mockResolvedValue([makeProvider({
      id: 'unexpected-origin',
      connectUrl: 'https://accounts.example.test/oauth',
    })]);
    render(<IntegrationsSettings />);
    await waitFor(() => expect(screen.getByTestId('integration-connect-unexpected-origin')).toBeInTheDocument());

    fireEvent.click(screen.getByTestId('integration-connect-unexpected-origin'));

    expect(screen.queryByTestId('integrations-status')).not.toBeInTheDocument();
  });
});

describe('IntegrationsSettings — Google data-use disclosure', () => {
  const google = makeProvider({
    id: 'google-gmail',
    label: 'Gmail',
    status: 'available',
    kind: 'mail',
    connectUrl: 'https://synalux.ai/api/auth/connect/google?scope=gmail',
  });

  beforeEach(() => {
    listIntegrationsMock.mockResolvedValue([google]);
  });

  it('shows the complete Gmail, Contacts, local-storage, deletion, and no-AI disclosure before navigation', async () => {
    render(<IntegrationsSettings />);
    await waitFor(() => expect(screen.getByTestId('integration-connect-google-gmail')).toBeInTheDocument());

    fireEvent.click(screen.getByTestId('integration-connect-google-gmail'));

    const dialog = screen.getByRole('dialog', { name: /google access requested/i });
    expect(dialog).toHaveTextContent(/send only messages you compose/i);
    expect(dialog).toHaveTextContent(/names, email addresses, and phone numbers/i);
    expect(dialog).toHaveTextContent(/recipient autocomplete and the Prism AAC contact directory/i);
    expect(dialog).toHaveTextContent(/contact photos are not requested/i);
    expect(dialog).toHaveTextContent(/every five minutes/i);
    expect(dialog).toHaveTextContent(/up to 200/i);
    expect(dialog).toHaveTextContent(/google-derived contacts are removed/i);
    expect(dialog).toHaveTextContent(/manual.*remain/i);
    expect(dialog).toHaveTextContent(/not sent to generative ai/i);
    expect(dialog).toHaveTextContent(/not used for advertising, profiling, or model training/i);
    expect(screen.queryByTestId('integrations-status')).not.toBeInTheDocument();
  });

  it('does not expose the navigation step until the caregiver confirms', async () => {
    render(<IntegrationsSettings />);
    await waitFor(() => expect(screen.getByTestId('integration-connect-google-gmail')).toBeInTheDocument());

    fireEvent.click(screen.getByTestId('integration-connect-google-gmail'));
    expect(screen.getByRole('button', { name: /continue to google/i })).toBeInTheDocument();

    vi.useFakeTimers();
    fireEvent.click(screen.getByRole('button', { name: /continue to google/i }));
    expect(screen.getByTestId('integrations-status')).toHaveTextContent(/opening gmail/i);
    vi.clearAllTimers();
    vi.useRealTimers();
  });
});

// ── connected provider ────────────────────────────────────────────────────────

describe('IntegrationsSettings — connected provider', () => {
  const connectedSlack = makeProvider({
    id: 'slack', label: 'Slack', icon: '💬',
    kind: 'chat', status: 'connected',
    connectUrl: 'https://synalux.ai/connect?provider=slack',
  });

  beforeEach(() => {
    listIntegrationsMock.mockResolvedValue([connectedSlack]);
  });

  it('shows ✓ checkmark for connected provider', async () => {
    render(<IntegrationsSettings />);
    await waitFor(() => {
      expect(screen.getByTestId('integration-connected-slack')).toBeInTheDocument();
    });
  });

  it('shows Reconnect button for connected provider with connectUrl', async () => {
    render(<IntegrationsSettings />);
    await waitFor(() => {
      expect(screen.getByTestId('integration-reconnect-slack')).toBeInTheDocument();
    });
  });

  it('does NOT show Connect (only Reconnect) for connected provider', async () => {
    render(<IntegrationsSettings />);
    await waitFor(() => expect(screen.getByTestId('integration-reconnect-slack')).toBeInTheDocument());
    expect(screen.queryByTestId('integration-connect-slack')).toBeNull();
  });

  it('offers a working disconnect action for a connected provider', async () => {
    render(<IntegrationsSettings />);
    await waitFor(() => expect(screen.getByTestId('integration-disconnect-slack')).toBeInTheDocument());

    fireEvent.click(screen.getByTestId('integration-disconnect-slack'));

    await waitFor(() => expect(disconnectProviderMock).toHaveBeenCalledWith(connectedSlack));
  });
});

// ── planned provider ──────────────────────────────────────────────────────────

describe('IntegrationsSettings — planned provider', () => {
  const imsg = makeProvider({
    id: 'imessage', label: 'iMessage', icon: '💬',
    kind: 'chat', status: 'planned', connectUrl: undefined,
    plannedNote: 'iOS only',
  });

  beforeEach(() => {
    listIntegrationsMock.mockResolvedValue([imsg]);
  });

  it('renders planned provider label', async () => {
    render(<IntegrationsSettings />);
    await waitFor(() => expect(screen.getByText('iMessage')).toBeInTheDocument());
  });

  it('shows lock icon for planned provider', async () => {
    render(<IntegrationsSettings />);
    await waitFor(() => {
      expect(screen.getByTestId('integration-planned-imessage')).toBeInTheDocument();
    });
  });

  it('does NOT show Connect button for planned provider', async () => {
    render(<IntegrationsSettings />);
    await waitFor(() => expect(screen.getByText('iMessage')).toBeInTheDocument());
    expect(screen.queryByTestId('integration-connect-imessage')).toBeNull();
  });
});

// ── refresh button ────────────────────────────────────────────────────────────

describe('IntegrationsSettings — refresh', () => {
  it('clicking refresh button calls listIntegrations again', async () => {
    listIntegrationsMock.mockResolvedValue([]);
    render(<IntegrationsSettings />);
    await waitFor(() => expect(screen.queryByTestId('integrations-loading')).toBeNull());
    fireEvent.click(screen.getByTestId('integrations-refresh'));
    await waitFor(() => expect(listIntegrationsMock).toHaveBeenCalledTimes(2));
  });
});
