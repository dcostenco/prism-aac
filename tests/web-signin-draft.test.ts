import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useMessageStore } from '@/store/messageStore';
import { clearWebSignInDraft, rememberWebSignInDraft, recoverWebSignInDraft, WEB_SIGNIN_DRAFT_KEY } from '@/services/webSignInDraft';

beforeEach(() => {
  vi.useFakeTimers(); vi.setSystemTime(new Date('2026-09-07T12:00:00Z'));
  useMessageStore.setState({ text: '' }); sessionStorage.removeItem(WEB_SIGNIN_DRAFT_KEY);
});
afterEach(() => { vi.restoreAllMocks(); vi.useRealTimers(); sessionStorage.removeItem(WEB_SIGNIN_DRAFT_KEY); });

describe('temporary sign-in draft', () => {
  it('does not recreate a signed-out snapshot on pagehide, but permits a newly composed message', () => {
    useMessageStore.setState({ text: 'Previous account message' }); rememberWebSignInDraft('billing');
    clearWebSignInDraft(); rememberWebSignInDraft();
    expect(useMessageStore.getState().text).toBe('Previous account message');
    expect(sessionStorage.getItem(WEB_SIGNIN_DRAFT_KEY)).toBeNull();
    useMessageStore.setState({ text: 'New message' }); rememberWebSignInDraft();
    expect(JSON.parse(sessionStorage.getItem(WEB_SIGNIN_DRAFT_KEY)!).text).toBe('New message');
  });
  it('retires legacy plaintext copies in the encrypted native shell without restoring or recreating them', () => {
    useMessageStore.setState({ text: 'Private billing text' }); rememberWebSignInDraft('billing');
    Reflect.set(window, 'prismNativeBridge', { billingDraft: vi.fn() });
    try {
      useMessageStore.setState({ text: '' }); recoverWebSignInDraft();
      expect(useMessageStore.getState().text).toBe('');
      useMessageStore.setState({ text: 'Keep speaking' }); rememberWebSignInDraft('billing'); rememberWebSignInDraft();
      expect(sessionStorage.getItem(WEB_SIGNIN_DRAFT_KEY)).toBeNull();
      expect(useMessageStore.getState().text).toBe('Keep speaking');
    } finally { Reflect.deleteProperty(window, 'prismNativeBridge'); }
  });
  it('recovers only the current message across navigation and then removes the saved copy', () => {
    useMessageStore.getState().setTextSilent('Please help me');
    expect(rememberWebSignInDraft()).toBe(true);
    expect(JSON.parse(localStorage.getItem('prism-aac-message')!).state.text).toBeUndefined();
    useMessageStore.setState({ text: '' });
    recoverWebSignInDraft();
    expect(useMessageStore.getState().text).toBe('Please help me');
    expect(sessionStorage.getItem(WEB_SIGNIN_DRAFT_KEY)).toBeNull();
  });
  it('retires the saved message when the user saves an empty current draft', () => {
    useMessageStore.setState({ text: 'I need water' }); rememberWebSignInDraft();
    useMessageStore.setState({ text: '' }); rememberWebSignInDraft(); recoverWebSignInDraft();
    expect(useMessageStore.getState().text).toBe('');
    expect(sessionStorage.getItem(WEB_SIGNIN_DRAFT_KEY)).toBeNull();
  });
  it('does not overwrite a message composed after the saved draft', () => {
    useMessageStore.setState({ text: 'Earlier message' }); rememberWebSignInDraft();
    useMessageStore.setState({ text: 'Current message' }); recoverWebSignInDraft();
    expect(useMessageStore.getState().text).toBe('Current message');
  });
  it('does not restore expired private content', () => {
    useMessageStore.setState({ text: 'Temporary message' }); rememberWebSignInDraft();
    useMessageStore.setState({ text: '' }); vi.advanceTimersByTime(31 * 60_000); recoverWebSignInDraft();
    expect(useMessageStore.getState().text).toBe('');
    expect(sessionStorage.getItem(WEB_SIGNIN_DRAFT_KEY)).toBeNull();
  });
  it('reports unavailable tab storage without changing the current message', () => {
    useMessageStore.setState({ text: 'Keep this message' });
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('Storage unavailable'); });
    expect(rememberWebSignInDraft()).toBe(false);
    expect(useMessageStore.getState().text).toBe('Keep this message');
  });
  it('covers the one-hour checkout window without pagehide shortening or renewing it', () => {
    useMessageStore.setState({ text: 'Please keep my message' });
    rememberWebSignInDraft('billing');
    const deadline = JSON.parse(sessionStorage.getItem(WEB_SIGNIN_DRAFT_KEY)!).expiresAt;
    vi.advanceTimersByTime(10 * 60_000); rememberWebSignInDraft();
    expect(JSON.parse(sessionStorage.getItem(WEB_SIGNIN_DRAFT_KEY)!).expiresAt).toBe(deadline);
    vi.advanceTimersByTime(50 * 60_000); useMessageStore.setState({ text: '' });
    recoverWebSignInDraft();
    expect(useMessageStore.getState().text).toBe('Please keep my message');
  });
  it('expires billing drafts too and never persists a cleared message', () => {
    useMessageStore.setState({ text: 'Private message' }); rememberWebSignInDraft('billing');
    vi.advanceTimersByTime(76 * 60_000); useMessageStore.setState({ text: '' }); recoverWebSignInDraft();
    expect(useMessageStore.getState().text).toBe('');
    useMessageStore.setState({ text: 'Clear this' }); rememberWebSignInDraft('billing');
    useMessageStore.setState({ text: '' }); rememberWebSignInDraft(); recoverWebSignInDraft();
    expect(sessionStorage.getItem(WEB_SIGNIN_DRAFT_KEY)).toBeNull();
  });
});
