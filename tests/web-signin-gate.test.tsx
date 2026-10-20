import React from 'react';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
const mocks = vi.hoisted(() => ({ access: vi.fn(), pathname: '/', profile: null as null | { email: string }, ddAction: vi.fn() }));
vi.mock('next/navigation', () => ({ usePathname: () => mocks.pathname }));
vi.mock('@/services/webAccessService', async importOriginal => ({
  ...await importOriginal<typeof import('@/services/webAccessService')>(), fetchWebAccess: mocks.access,
}));
vi.mock('@/store/authStore', () => ({
  useAuthStore: (select: (s: { profile: typeof mocks.profile }) => unknown) => select({ profile: mocks.profile }) }));
vi.mock('@/lib/datadog', () => ({ ddAction: mocks.ddAction }));
import WebSignInGate from '@/components/WebSignInGate';
import { useSettingsStore } from '@/store/settingsStore';
import { clearVerifiedLocalAccess } from '@/services/webAccessService';
import { useMessageStore } from '@/store/messageStore';
import { rememberWebSignInDraft, WEB_SIGNIN_DRAFT_KEY } from '@/services/webSignInDraft';
import { resetMonetizationTelemetry } from '@/services/monetizationTelemetry';

const board = <button>Communication board action</button>;
async function tick(ms: number) { await act(async () => { await vi.advanceTimersByTimeAsync(ms); }); }
const noop = () => {};
const PRISM_AAC_SHELL_BRIDGE = { speak: noop, stopSpeech: noop, startVoice: noop, stopVoice: noop, emergency: noop,
  freeMemoryMB: noop, askAI: noop, openSettings: noop, requestReview: noop, signInWithApple: noop, subscription: noop };
const PRISM_AAC_BROWSER_SHELL_BRIDGE = { speak: noop, stopSpeech: noop, startVoice: noop, stopVoice: noop, emergency: noop,
  freeMemoryMB: noop, askAI: noop, openSettings: noop, requestReview: noop, navigateTo: noop, goBack: noop, goForward: noop };
type BridgeWindow = { prismNativeBridge?: Record<string, () => void> };
const nativeShells = [['Prism AAC', PRISM_AAC_SHELL_BRIDGE], ['Prism AAC Browser', PRISM_AAC_BROWSER_SHELL_BRIDGE]] as const;
const gateOutcomes = () => mocks.ddAction.mock.calls
  .filter(([name]) => name === 'aac_web_gate').map(([, ctx]) => (ctx as { outcome: string }).outcome);

beforeEach(() => {
  vi.clearAllMocks(); mocks.pathname = '/'; mocks.profile = null;
  clearVerifiedLocalAccess(); sessionStorage.removeItem(WEB_SIGNIN_DRAFT_KEY);
  useMessageStore.setState({ text: '' }); resetMonetizationTelemetry();
  vi.stubEnv('NEXT_PUBLIC_AAC_WEB_SIGNIN_GATE', '1');
  vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'setInterval', 'clearInterval', 'performance'] });
  mocks.access.mockResolvedValue({ state: 'preview', remainingMs: 600_000 });
  useSettingsStore.setState({ language: 'en' });
});
afterEach(() => { vi.useRealTimers(); vi.unstubAllEnvs(); delete (window as BridgeWindow).prismNativeBridge; });

describe('nonblocking web cloud-preview status', () => {
  it('does not resurrect a message cleared after expiry on focus or reload', async () => {
    const first = render(<WebSignInGate>{board}</WebSignInGate>); await tick(1);
    useMessageStore.setState({ text: 'I need help' }); await tick(600_000);
    useMessageStore.getState().clearAll();
    fireEvent(window, new Event('focus')); await tick(1);
    expect(useMessageStore.getState().text).toBe('');
    fireEvent(window, new Event('pagehide')); first.unmount();
    render(<WebSignInGate>{board}</WebSignInGate>); await tick(1);
    expect(useMessageStore.getState().text).toBe('');
  });

  it('does not hydrate a stale tab snapshot again when the account changes', async () => {
    const view = render(<WebSignInGate>{board}</WebSignInGate>); await tick(1);
    useMessageStore.setState({ text: 'I need help' }); fireEvent(window, new Event('pagehide'));
    useMessageStore.getState().clearAll(); mocks.profile = { email: 'changed@example.com' };
    view.rerender(<WebSignInGate>{board}</WebSignInGate>); await tick(1);
    expect(useMessageStore.getState().text).toBe('');
  });

  it('keeps the same free communication control mounted and focused through preview expiry', async () => {
    render(<WebSignInGate>{board}</WebSignInGate>); await tick(1);
    const action = screen.getByRole('button', { name: 'Communication board action' }); action.focus();
    useMessageStore.setState({ text: 'I need help' });
    await tick(600_000);
    expect(screen.getByRole('button', { name: 'Communication board action' })).toBe(action);
    expect(action).toHaveFocus(); expect(useMessageStore.getState().text).toBe('I need help');
    expect(screen.queryByTestId('web-signin-gate')).not.toBeInTheDocument();
    expect(screen.getByTestId('web-preview-notice')).toHaveAttribute('data-state', 'sign_in_required');
    expect(screen.getByTestId('web-preview-notice')).toHaveTextContent('Cloud preview: 0:00 remaining.');
    expect(screen.getByTestId('web-preview-warning')).toHaveTextContent('remain free');
    expect(screen.queryByRole('link')).not.toBeInTheDocument();
  });

  it('warns once at two minutes without stealing focus or announcing countdown ticks', async () => {
    render(<WebSignInGate>{board}</WebSignInGate>); await tick(1);
    const action = screen.getByRole('button', { name: 'Communication board action' }); action.focus();
    expect(screen.getByRole('timer')).toHaveAttribute('aria-live', 'off');
    await tick(479_750); expect(screen.getByTestId('web-preview-warning')).toBeEmptyDOMElement();
    await tick(250);
    const warning = screen.getByTestId('web-preview-warning');
    expect(warning).toHaveTextContent('Cloud preview ends soon. Your board and device voices stay available.');
    expect(warning).toHaveAttribute('role', 'status'); expect(action).toHaveFocus();
    const before = warning.innerHTML; await tick(5_000);
    expect(warning.innerHTML).toBe(before); expect(action).toHaveFocus();
  });

  it('warns immediately for a resumed preview under two minutes', async () => {
    mocks.access.mockResolvedValue({ state: 'preview', remainingMs: 30_000 });
    render(<WebSignInGate>{board}</WebSignInGate>); await tick(1);
    expect(screen.getByTestId('web-preview-warning')).toHaveTextContent('Cloud preview ends soon.');
  });

  it.each(['checking', 'sign_in_required', 'error'] as const)('keeps free controls available while access is %s', async state => {
    if (state === 'checking') mocks.access.mockImplementation(() => new Promise(() => {}));
    else if (state === 'error') mocks.access.mockRejectedValue(new Error('Offline'));
    else mocks.access.mockResolvedValue({ state, remainingMs: 0 });
    render(<WebSignInGate>{board}</WebSignInGate>); await tick(1);
    const action = screen.getByRole('button', { name: 'Communication board action' });
    expect(action).toBeEnabled(); fireEvent.click(action);
    expect(screen.getByTestId('web-preview-notice')).toHaveAttribute('data-state', state);
    expect(screen.getByTestId('web-preview-warning')).toHaveTextContent('remain free');
    expect(screen.queryByRole('button', { name: 'Continue to Google' })).not.toBeInTheDocument();
  });

  it.each(['/terms', '/prism-aac/terms'])('keeps %s readable without an account or network', async pathname => {
    mocks.pathname = pathname; mocks.access.mockRejectedValue(new Error('Offline'));
    render(<WebSignInGate><article>Approved AAC terms</article></WebSignInGate>); await tick(600_001);
    expect(screen.getByText('Approved AAC terms')).toBeVisible();
    expect(mocks.access).not.toHaveBeenCalled(); expect(gateOutcomes()).toEqual([]);
  });

  it('does not extend a preview when focus returns a fresh deadline', async () => {
    render(<WebSignInGate>{board}</WebSignInGate>); await tick(1); await tick(300_000);
    fireEvent(window, new Event('focus')); await tick(1); await tick(300_000);
    expect(screen.getByTestId('web-preview-notice')).toHaveAttribute('data-state', 'sign_in_required');
    expect(screen.getByText('Communication board action')).toBeVisible();
  });

  it('does not hide or remount free controls through auth, outage and cross-tab sign-out', async () => {
    render(<WebSignInGate>{board}</WebSignInGate>); await tick(1);
    const action = screen.getByRole('button', { name: 'Communication board action' }); action.focus();
    mocks.access.mockResolvedValue({ state: 'signed_in', remainingMs: 0 });
    fireEvent(window, new Event('focus')); await tick(1);
    expect(screen.queryByTestId('web-preview-notice')).not.toBeInTheDocument();
    mocks.access.mockRejectedValue(new Error('Offline'));
    fireEvent(window, new Event('focus')); await tick(1);
    act(() => clearVerifiedLocalAccess()); await tick(1);
    expect(screen.getByRole('button', { name: 'Communication board action' })).toBe(action);
    expect(action).toHaveFocus();
    expect(gateOutcomes()).toEqual(['preview', 'signed_in', 'offline_continuity', 'sign_in_required']);
  });

  it('reports an outage truthfully without denying local communication', async () => {
    mocks.access.mockRejectedValue(new Error('Offline'));
    render(<WebSignInGate>{board}</WebSignInGate>); await tick(1);
    expect(screen.getByText(/could not verify your sign-in/)).toBeVisible();
    expect(screen.getByText('Communication board action')).toBeVisible(); expect(gateOutcomes()).toEqual(['error']);
  });

  it('restores the anonymous tab draft before a pending or failed account request', async () => {
    useMessageStore.setState({ text: 'I need help' }); rememberWebSignInDraft(); useMessageStore.setState({ text: '' });
    mocks.access.mockImplementation(() => new Promise(() => {}));
    render(<WebSignInGate>{board}</WebSignInGate>); await tick(1);
    expect(useMessageStore.getState().text).toBe('I need help');
    expect(sessionStorage.getItem(WEB_SIGNIN_DRAFT_KEY)).toBeNull();
  });

  it.each(['preview', 'sign_in_required', 'signed_in', 'error'] as const)('keeps a tab-local reload draft in %s state', async state => {
    if (state === 'error') mocks.access.mockRejectedValue(new Error('Offline'));
    else mocks.access.mockResolvedValue({ state, remainingMs: state === 'preview' ? 600_000 : 0 });
    render(<WebSignInGate>{board}</WebSignInGate>); await tick(1);
    useMessageStore.setState({ text: 'I need help' }); fireEvent(window, new Event('pagehide'));
    expect(JSON.parse(sessionStorage.getItem(WEB_SIGNIN_DRAFT_KEY)!).text).toBe('I need help');
  });

  it('keeps the in-memory draft and focus when browser storage is denied', async () => {
    render(<WebSignInGate>{board}</WebSignInGate>); await tick(1);
    const action = screen.getByRole('button', { name: 'Communication board action' }); action.focus();
    useMessageStore.setState({ text: 'I need help' });
    const denied = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('denied'); });
    await tick(600_000);
    expect(action).toHaveFocus(); expect(useMessageStore.getState().text).toBe('I need help'); denied.mockRestore();
  });

  it.each(nativeShells)('keeps the app available inside %s without checking the web preview', async (_label, bridge) => {
    (window as BridgeWindow).prismNativeBridge = bridge;
    render(<WebSignInGate>{board}</WebSignInGate>); await tick(600_001);
    expect(screen.getByText('Communication board action')).toBeVisible();
    expect(mocks.access).not.toHaveBeenCalled(); expect(gateOutcomes()).toEqual([]);
    expect(screen.queryByTestId('web-preview-notice')).not.toBeInTheDocument();
  });

  it('stays silent when the gate is disabled locally', async () => {
    vi.stubEnv('NEXT_PUBLIC_AAC_WEB_SIGNIN_GATE', '0');
    render(<WebSignInGate>{board}</WebSignInGate>); await tick(600_001);
    expect(mocks.access).not.toHaveBeenCalled(); expect(gateOutcomes()).toEqual([]);
    expect(screen.getByText('Communication board action')).toBeVisible();
  });

  it('separates server-disabled rollout from sign-in', async () => {
    mocks.access.mockResolvedValue({ state: 'disabled', remainingMs: 0 });
    render(<WebSignInGate>{board}</WebSignInGate>); await tick(1);
    expect(screen.queryByTestId('web-preview-notice')).not.toBeInTheDocument(); expect(gateOutcomes()).toEqual(['disabled']);
  });

  it('never reports optimistic local continuity as a verified sign-in', async () => {
    mocks.access.mockResolvedValue({ state: 'signed_in', remainingMs: 0 });
    const first = render(<WebSignInGate>{board}</WebSignInGate>); await tick(1); first.unmount();
    mocks.access.mockImplementation(() => new Promise((_resolve, reject) => setTimeout(() => reject(new Error('Offline')), 5_000)));
    render(<WebSignInGate>{board}</WebSignInGate>); await tick(1);
    expect(gateOutcomes()).toEqual(['signed_in']); await tick(5_000);
    expect(gateOutcomes()).toEqual(['signed_in', 'offline_continuity']);
  });

  it('reports each decision once despite countdown ticks and repeated failing polls', async () => {
    render(<WebSignInGate>{board}</WebSignInGate>); await tick(1); await tick(600_000);
    expect(gateOutcomes()).toEqual(['preview', 'sign_in_required']);
    mocks.access.mockRejectedValue(new Error('Offline'));
    for (let i = 0; i < 4; i++) { fireEvent(window, new Event('focus')); await tick(1); }
    expect(gateOutcomes()).toEqual(['preview', 'sign_in_required', 'error']);
  });
});
