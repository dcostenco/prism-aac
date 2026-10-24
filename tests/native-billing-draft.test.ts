import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useMessageStore } from '@/store/messageStore';
import { acknowledgeNativeBillingDraft, clearNativeBillingDraft, nativeBillingDraftGeneration, observeNativeBillingDraft,
  recoverNativeBillingDraft, saveNativeBillingDraft } from '@/services/nativeBillingDraft';

const account = '82c6813e-4bb2-4b16-baf9-b268e568eaa5';
const record = '2191f41e-1ba9-4afc-bc3c-bab5190fc10d';
const post = vi.fn();
type ReplyHost = Window & { prismBillingDraftResult: (reply: object) => void };
const reply = (request: Record<string, string>, result: object = {}) =>
  (window as ReplyHost).prismBillingDraftResult({ id: request.id, result });
let stop = () => {};
beforeEach(() => {
  vi.useFakeTimers();
  vi.stubGlobal('window', { prismNativeBridge: { billingDraft: post } });
  post.mockReset().mockImplementation((request: Record<string, string>) => reply(request));
  useMessageStore.setState({ text: '' });
  stop = observeNativeBillingDraft();
});
afterEach(() => { stop(); vi.useRealTimers(); vi.unstubAllGlobals(); });

describe('native billing handoff draft', () => {
  it('waits for native persistence acknowledgement before the handoff can proceed', async () => {
    useMessageStore.setState({ text: 'I need help' });
    post.mockReset();
    let done = false;
    const save = saveNativeBillingDraft(account).then(() => { done = true; });
    await Promise.resolve(); expect(done).toBe(false);
    const request = post.mock.calls[0][0];
    expect(request).toMatchObject({ operation: 'save', account, text: 'I need help' });
    reply(request); await save; expect(done).toBe(true);
  });
  it('retains the exact persistent record until the rendered board acknowledges recovery', async () => {
    post.mockImplementation((request: Record<string, string>) => {
      if (request.operation === 'load') reply(request, { draftID: record, text: 'I need help' });
      else { expect(useMessageStore.getState().text).toBe('I need help'); reply(request); }
    });
    await recoverNativeBillingDraft(account, nativeBillingDraftGeneration());
    expect(post).toHaveBeenCalledOnce(); // A process death here retains the Keychain record.
    expect(useMessageStore.getState().text).toBe('I need help');
    await acknowledgeNativeBillingDraft('I need help');
    expect(post).toHaveBeenLastCalledWith(expect.objectContaining({ operation: 'clear', draftID: record }));
  });
  it.each(['newer message', ''])('does not resurrect an old message after typing then changing to %s during recovery', async current => {
    post.mockImplementation((request: Record<string, string>) => { if (request.operation !== 'load') reply(request); });
    const recovery = recoverNativeBillingDraft(account, nativeBillingDraftGeneration());
    const load = post.mock.calls[0][0];
    useMessageStore.setState({ text: 'typed after launch' });
    useMessageStore.setState({ text: current });
    reply(load, { draftID: 'old', text: 'private old message' }); await recovery;
    expect(useMessageStore.getState().text).toBe(current);
  });
  it('sign-out invalidates a recovery already in flight', async () => {
    post.mockImplementation((request: Record<string, string>) => { if (request.operation !== 'load') reply(request); });
    const recovery = recoverNativeBillingDraft(account, nativeBillingDraftGeneration());
    const load = post.mock.calls[0][0];
    clearNativeBillingDraft(); reply(load, { draftID: 'old', text: 'another person' }); await recovery;
    expect(useMessageStore.getState().text).toBe('');
  });
  it('an explicit clear on an already-empty board cancels recovery intent', async () => {
    post.mockImplementation((request: Record<string, string>) => { if (request.operation !== 'load') reply(request); });
    const recovery = recoverNativeBillingDraft(account, nativeBillingDraftGeneration());
    const load = post.mock.calls[0][0];
    useMessageStore.getState().clearAll();
    reply(load, { draftID: 'old', text: 'discarded message' }); await recovery;
    expect(useMessageStore.getState().text).toBe('');
  });
  it('retains the recovered communication on deletion failure and permits retry of the exact record', async () => {
    post.mockImplementation((request: Record<string, string>) => {
      if (request.operation === 'load') reply(request, { draftID: record, text: 'private' });
      else (window as ReplyHost).prismBillingDraftResult({ id: request.id, error: 'locked' });
    });
    await recoverNativeBillingDraft(account, nativeBillingDraftGeneration());
    await expect(acknowledgeNativeBillingDraft('private')).rejects.toThrow();
    expect(useMessageStore.getState().text).toBe('private');
    post.mockImplementation((request: Record<string, string>) => reply(request));
    await acknowledgeNativeBillingDraft('private');
    expect(post).toHaveBeenLastCalledWith(expect.objectContaining({ operation: 'clear', draftID: record }));
  });
  it('does not consume a record for text the UI has not committed', async () => {
    post.mockImplementation((request: Record<string, string>) => reply(request, { draftID: record, text: 'help' }));
    await recoverNativeBillingDraft(account, nativeBillingDraftGeneration());
    await acknowledgeNativeBillingDraft('');
    expect(post).toHaveBeenCalledOnce();
    clearNativeBillingDraft();
    post.mockClear();
    await acknowledgeNativeBillingDraft('help');
    expect(post).not.toHaveBeenCalled();
  });
  it('storage timeout rejects the handoff and keeps the current message', async () => {
    useMessageStore.setState({ text: 'help' }); post.mockReset();
    const save = expect(saveNativeBillingDraft(account)).rejects.toThrow();
    await vi.advanceTimersByTimeAsync(5000); await save;
    expect(useMessageStore.getState().text).toBe('help');
  });
});
