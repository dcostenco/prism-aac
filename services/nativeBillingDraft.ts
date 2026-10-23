import { useMessageStore } from '@/store/messageStore';

interface DraftResult { text?: string; draftID?: string }
interface DraftWindow extends Window {
  prismNativeBridge?: { billingDraft?: (request: Record<string, string>) => void };
  prismBillingDraftResult?: (reply: { id: string; result?: DraftResult; error?: string }) => void;
}
const MAX_TEXT_LENGTH = 4000;
const STORAGE_TIMEOUT_MS = 5000;
const STORAGE_ERROR = 'The billing draft could not be saved. Your current message is still here.';
const waiting = new Map<string, { resolve: (value: DraftResult) => void; reject: (error: Error) => void; timer: ReturnType<typeof setTimeout> }>();
let generation = 0;
let recovering = false;
let publishedDraft: { draftID: string; text: string; version: number } | null = null;

export const hasNativeBillingDraft = () => typeof window !== 'undefined'
  && typeof (window as DraftWindow).prismNativeBridge?.billingDraft === 'function';

function request(operation: string, fields: Record<string, string> = {}): Promise<DraftResult> {
  if (!hasNativeBillingDraft()) return Promise.resolve({});
  const host = window as DraftWindow;
  host.prismBillingDraftResult = reply => {
    const waiter = waiting.get(reply.id);
    if (!waiter) return;
    clearTimeout(waiter.timer); waiting.delete(reply.id);
    if (reply.error || !reply.result) waiter.reject(new Error(STORAGE_ERROR));
    else waiter.resolve(reply.result);
  };
  const id = crypto.randomUUID();
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => { waiting.delete(id); reject(new Error(STORAGE_ERROR)); }, STORAGE_TIMEOUT_MS);
    waiting.set(id, { resolve, reject, timer });
    try { host.prismNativeBridge!.billingDraft!({ ...fields, operation, id }); }
    catch { clearTimeout(timer); waiting.delete(id); reject(new Error(STORAGE_ERROR)); }
  });
}

/** Invalidates in-flight recovery synchronously, before a sign-out can finish. */
export function clearNativeBillingDraft(): void {
  generation++;
  publishedDraft = null;
  void request('clear').catch(() => { console.warn('[AAC billing] Could not clear the device billing draft'); });
}

/** Watch before any asynchronous account check, including typing then clearing. */
export function observeNativeBillingDraft(): () => void {
  return useMessageStore.subscribe((state, previous) => {
    if (!recovering && (state.text !== previous.text || state.undoStack !== previous.undoStack)) clearNativeBillingDraft();
  });
}

export async function saveNativeBillingDraft(account: string): Promise<void> {
  if (!hasNativeBillingDraft()) return;
  const text = useMessageStore.getState().text;
  const version = ++generation;
  publishedDraft = null;
  if (text.length > MAX_TEXT_LENGTH) throw new Error(STORAGE_ERROR);
  await request('save', { account, text });
  if (generation !== version || useMessageStore.getState().text !== text) {
    clearNativeBillingDraft();
    throw new Error(STORAGE_ERROR);
  }
}

export async function recoverNativeBillingDraft(account: string, version: number): Promise<void> {
  if (!hasNativeBillingDraft() || version !== generation) return;
  const result = await request('load', { account });
  if (!result.draftID) return;
  if (version !== generation || useMessageStore.getState().text || typeof result.text !== 'string'
    || result.text.length > MAX_TEXT_LENGTH) return;
  // Retain the Keychain record through publication. The mounted UI consumes
  // it only after committing this exact text, so an earlier process death
  // cannot destroy the only recoverable message.
  publishedDraft = { draftID: result.draftID, text: result.text, version };
  recovering = true;
  try { useMessageStore.getState().setTextSilent(result.text); }
  finally { recovering = false; }
}

export async function acknowledgeNativeBillingDraft(renderedText: string): Promise<void> {
  const draft = publishedDraft;
  if (!draft || draft.version !== generation || draft.text !== renderedText
    || useMessageStore.getState().text !== renderedText) return;
  await request('clear', { draftID: draft.draftID });
  // A late acknowledgement must not consume a newer handoff.
  if (publishedDraft === draft) publishedDraft = null;
}

export const nativeBillingDraftGeneration = () => generation;
