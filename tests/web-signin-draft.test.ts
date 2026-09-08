import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useMessageStore } from '@/store/messageStore';
import { rememberWebSignInDraft, recoverWebSignInDraft, WEB_SIGNIN_DRAFT_KEY } from '@/services/webSignInDraft';

beforeEach(() => {
  vi.useFakeTimers(); vi.setSystemTime(new Date('2026-09-07T12:00:00Z'));
  useMessageStore.setState({ text: '' }); sessionStorage.removeItem(WEB_SIGNIN_DRAFT_KEY);
});
afterEach(() => { vi.restoreAllMocks(); vi.useRealTimers(); sessionStorage.removeItem(WEB_SIGNIN_DRAFT_KEY); });

describe('temporary sign-in draft', () => {
  it('recovers only the current message across navigation and then removes the saved copy', () => {
    useMessageStore.getState().setTextSilent('Please help me');
    expect(rememberWebSignInDraft()).toBe(true);
    expect(JSON.parse(localStorage.getItem('prism-aac-message')!).state.text).toBeUndefined();
    useMessageStore.setState({ text: '' });
    recoverWebSignInDraft();
    expect(useMessageStore.getState().text).toBe('Please help me');
    expect(sessionStorage.getItem(WEB_SIGNIN_DRAFT_KEY)).toBeNull();
  });
  it('does not erase the saved message when an expired preview reloads with an empty in-memory store', () => {
    useMessageStore.setState({ text: 'I need water' }); rememberWebSignInDraft();
    useMessageStore.setState({ text: '' }); rememberWebSignInDraft(); recoverWebSignInDraft();
    expect(useMessageStore.getState().text).toBe('I need water');
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
});
