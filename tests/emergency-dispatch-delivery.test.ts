/**
 * An emergency alert counts as sent by the Synalux line only when the server
 * reached someone. The server answered OK with success:false when it texted and
 * called no one — always so for the minimal payload free and signed-out users
 * send — and the app stopped there, skipping texting and calling from the device.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { flushQueuedAlerts, sendAlert } from '@/services/emergencyService';
import { stopSpeech } from '@/services/speechService';

vi.mock('@/services/speechService', () => ({ stopSpeech: vi.fn() }));

type Config = Parameters<typeof sendAlert>[1];
const config = {
  enabled: true, countdownSeconds: 5, autoCall911: false, language: 'en',
  contacts: [{ name: 'Mom', phone: '+15550001111', relationship: 'parent', contactMethod: 'sms' }],
  profile: {},
} as unknown as Config;
const alert = () => ({ id: 'alert-1', phrase: 'I need help', timestamp: Date.now(), sent: false });

const fetchMock = vi.fn();
const openMock = vi.fn();
const response = (status: number, contentType: string, read: () => Promise<unknown>) => ({
  ok: status >= 200 && status < 300, status,
  headers: { get: (name: string) => (name.toLowerCase() === 'content-type' ? contentType : null) },
  json: read,
});
const json = (status: number, body: unknown) => response(status, 'application/json', async () => body);
const opened = () => openMock.mock.calls.map(c => String(c[0]));

beforeEach(() => {
  vi.stubGlobal('fetch', fetchMock);
  vi.spyOn(window, 'open').mockImplementation(openMock as unknown as typeof window.open);
  sessionStorage.clear();
});
/** The iPhone app's bridge: it hands mail, text and call links to iOS. */
const inApp = () => { (window as unknown as { prismNativeBridge?: object }).prismNativeBridge = {}; };
afterEach(() => {
  delete (window as unknown as { prismNativeBridge?: object }).prismNativeBridge;
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  fetchMock.mockReset();
  openMock.mockReset();
});

describe('sendAlert — the Synalux line must have reached someone', () => {
  it('in the app, falls back to texting and calling from the device when the server reached no one (OK, success:false)', async () => {
    inApp();
    fetchMock.mockImplementation(async (url: string) => (String(url).endsWith('/notify')
      ? json(404, {}) : json(200, { success: false, sms_sent: 0, calls_made: 0 })));

    await expect(sendAlert(alert(), config)).resolves.toBe(true);

    expect(opened().some(u => u.startsWith('sms:+15550001111'))).toBe(true);
    expect(opened()).toContain('tel:+15550001111');
  });

  it('falls back the same way when the server answers that there was no one to reach (422)', async () => {
    fetchMock.mockImplementation(async (url: string) => (String(url).endsWith('/notify')
      ? json(404, {}) : json(422, { success: false, sms_sent: 0, calls_made: 0 })));

    await sendAlert(alert(), config);

    expect(opened()).toContain('tel:+15550001111');
  });

  it('stops at the Synalux line when it texted or called someone', async () => {
    fetchMock.mockResolvedValue(json(200, { success: true, sms_sent: 1, calls_made: 1 }));

    await expect(sendAlert(alert(), config)).resolves.toBe(true);

    expect(fetchMock).toHaveBeenCalledOnce();
    expect(openMock).not.toHaveBeenCalled();
  });

  // The server now answers 422/502 when it reached no one, so a JSON 2xx means
  // texts or calls went out. Texting and calling again would duplicate the alert.
  it('does not alert twice when a JSON success response cannot be read to the end', async () => {
    fetchMock.mockResolvedValue(response(200, 'application/json; charset=utf-8', async () => { throw new Error('body read timed out'); }));

    await expect(sendAlert(alert(), config)).resolves.toBe(true);

    expect(openMock).not.toHaveBeenCalled();
  });

  // A Wi-Fi sign-in page answers 200 to every request. That is not the server.
  it('falls back when a 200 is not the server (a Wi-Fi sign-in page)', async () => {
    fetchMock.mockImplementation(async (url: string) => (String(url).endsWith('/notify')
      ? json(404, {}) : response(200, 'text/html', async () => { throw new Error('not JSON'); })));

    await sendAlert(alert(), config);

    expect(opened()).toContain('tel:+15550001111');
  });
});

describe('flushQueuedAlerts — a delayed critical alert', () => {
  afterEach(() => localStorage.clear());

  // It is dispatched as a copy marked [DELAYED]; the queued alert itself must be
  // marked sent, or every re-drain pass of the same flush sends it again.
  it('is sent once per flush, not on every re-drain pass', async () => {
    localStorage.setItem('prism-aac-emergency-queue', JSON.stringify([{
      id: 'stale-1', phrase: 'help', timestamp: Date.now() - 31 * 60 * 1000, sent: false, severity: 'critical',
    }]));
    fetchMock.mockResolvedValue(json(200, { success: true, sms_sent: 1, calls_made: 1 }));

    await flushQueuedAlerts();

    expect(fetchMock).toHaveBeenCalledOnce();
    expect(JSON.parse(localStorage.getItem('prism-aac-emergency-queue') ?? '[]')).toEqual([]);
  });

  // A second press of the emergency button while a flush awaits the network must
  // not be erased when the flush saves the queue it read before dispatching.
  it('keeps an alert queued while the flush was waiting on the network', async () => {
    localStorage.setItem('prism-aac-emergency-queue', JSON.stringify([{
      id: 'first', phrase: 'help', timestamp: Date.now() - 31 * 60 * 1000, sent: false, severity: 'critical',
    }]));
    let release!: () => void;
    fetchMock.mockImplementationOnce(() => new Promise(r => { release = () => r(json(200, { success: true, sms_sent: 1, calls_made: 1 })); }));

    const flushing = flushQueuedAlerts();
    await vi.waitFor(() => expect(fetchMock).toHaveBeenCalledOnce());
    const queued = JSON.parse(localStorage.getItem('prism-aac-emergency-queue') ?? '[]');
    queued.push({ id: 'second', phrase: 'help again', timestamp: Date.now(), sent: false, severity: 'critical' });
    localStorage.setItem('prism-aac-emergency-queue', JSON.stringify(queued));
    let releaseSecond!: () => void;
    fetchMock.mockImplementation(() => new Promise(r => { releaseSecond = () => r(json(200, { success: true, sms_sent: 1, calls_made: 1 })); }));
    release();
    await vi.waitFor(() => {
      const ids = JSON.parse(localStorage.getItem('prism-aac-emergency-queue') ?? '[]').map((a: { id: string }) => a.id);
      expect(ids).toContain('second');
      expect(ids).not.toContain('first');
    });
    releaseSecond();
    await flushing;
  });

  // IDs are counted, not collapsed: an alert queued meanwhile that happens to
  // share an ID with one being dispatched must survive the flush.
  it('keeps an alert queued meanwhile even when it shares an ID with one being sent', async () => {
    localStorage.setItem('prism-aac-emergency-queue', JSON.stringify([{
      id: 'same', phrase: 'help', timestamp: Date.now() - 31 * 60 * 1000, sent: false, severity: 'critical',
    }]));
    let release!: () => void;
    fetchMock.mockImplementationOnce(() => new Promise(r => { release = () => r(json(200, { success: true, sms_sent: 1, calls_made: 1 })); }));

    const flushing = flushQueuedAlerts();
    await vi.waitFor(() => expect(fetchMock).toHaveBeenCalledOnce());
    const queued = JSON.parse(localStorage.getItem('prism-aac-emergency-queue') ?? '[]');
    queued.push({ id: 'same', phrase: 'help again', timestamp: Date.now(), sent: false, severity: 'critical' });
    localStorage.setItem('prism-aac-emergency-queue', JSON.stringify(queued));
    let releaseSecond!: () => void;
    fetchMock.mockImplementation(() => new Promise(r => { releaseSecond = () => r(json(200, { success: true, sms_sent: 1, calls_made: 1 })); }));
    release();
    await vi.waitFor(() => {
      const left = JSON.parse(localStorage.getItem('prism-aac-emergency-queue') ?? '[]');
      expect(left.map((a: { phrase: string }) => a.phrase)).toEqual(['help again']);
    });
    releaseSecond();
    await flushing;
  });
});

describe('the emergency announcement', () => {
  // It takes over the speaker: a long ordinary message mid-way must stop, not
  // resume over the announcement with its next part.
  it('stops ordinary speech before announcing', async () => {
    fetchMock.mockResolvedValue(json(200, { success: true, sms_sent: 1, calls_made: 1 }));

    await sendAlert(alert(), config);

    expect(stopSpeech).toHaveBeenCalled();
  });
});

describe('sendAlert — calls the emergency contact, never emergency services', () => {
  afterEach(async () => {
    const { useContactsStore } = await import('@/store/contactsStore');
    useContactsStore.setState({ contacts: [] });
  });
  const offline = () => fetchMock.mockRejectedValue(new Error('offline'));
  const noContacts = { ...config, contacts: [] } as Config;

  it('with no contact anywhere, calls no one: no automatic call to 911 or any emergency number', async () => {
    offline();
    await expect(sendAlert(alert(), noContacts)).resolves.toBe(false);
    expect(opened().filter(u => u.startsWith('tel:'))).toEqual([]);
  });

  it('a stored auto-call setting is ignored: the call goes to the contact', async () => {
    offline();
    await sendAlert(alert(), { ...config, autoCall911: true } as Config);
    expect(opened().filter(u => u.startsWith('tel:'))).toEqual(['tel:+15550001111']);
  });

  it('in the app, reaches the caregivers from Settings › Contacts when no emergency contact is saved', async () => {
    offline(); inApp();
    const { useContactsStore } = await import('@/store/contactsStore');
    useContactsStore.setState({ contacts: [
      { id: 'b', name: 'Dad', provider: 'mail', recipientId: 'dad@example.invalid', order: 1 },
      { id: 'a', name: 'Mom', provider: 'sms', recipientId: '+15550002222', order: 0 },
    ] as never });
    const sent = await sendAlert(alert(), noContacts);
    expect(sent).toBe(true);
    expect(opened().some(u => u.startsWith('sms:+15550002222'))).toBe(true);
    expect(opened().some(u => u.startsWith('mailto:dad%40example.invalid'))).toBe(true);
    expect(opened().filter(u => u.startsWith('tel:'))).toEqual(['tel:+15550002222']);
  });
});

describe('triggerEmergency — when no one could be reached', () => {
  afterEach(() => { vi.useRealTimers(); localStorage.clear(); });
  it('the countdown ends on "not sent" (no contact set up), with no call placed', async () => {
    const { triggerEmergency } = await import('@/services/emergencyService');
    const { useEmergencyStore } = await import('@/store/emergencyStore');
    fetchMock.mockRejectedValue(new Error('offline'));
    Object.defineProperty(navigator, 'geolocation', { configurable: true, value: { getCurrentPosition: (_ok: unknown, fail: (e: unknown) => void) => fail(new Error('denied')) } });
    vi.stubGlobal('matchMedia', () => ({ matches: false, addEventListener() {}, removeEventListener() {} }));
    vi.useFakeTimers({ toFake: ['setInterval', 'clearInterval', 'setTimeout', 'clearTimeout', 'Date'] });
    const done = vi.fn();
    await triggerEmergency('Emergency', 'urgent', () => {}, done);
    await vi.advanceTimersByTimeAsync(12_000);
    expect(done).toHaveBeenCalledWith(false, true);
    expect(useEmergencyStore.getState()).toMatchObject({ phase: 'not_sent', notSentReason: 'no_contact' });
    expect(opened().filter(u => u.startsWith('tel:'))).toEqual([]);
    useEmergencyStore.getState().reset();
  });
});

describe('sendAlert — never reports a link the browser may have blocked as sent', () => {
  it('in a browser, texting and calling links are still tried, but the alert is not counted as sent', async () => {
    fetchMock.mockRejectedValue(new Error('offline'));
    await expect(sendAlert(alert(), config)).resolves.toBe(false);
    expect(opened().some(u => u.startsWith('sms:+15550001111'))).toBe(true);
    expect(opened()).toContain('tel:+15550001111');
  });

  it('a 200 from the contacts endpoint that is not JSON (a Wi-Fi sign-in page) is not "sent"', async () => {
    fetchMock.mockImplementation(async (url: string) => (String(url).endsWith('/notify')
      ? response(200, 'text/html', async () => { throw new Error('not JSON'); }) : json(422, { success: false })));
    await expect(sendAlert(alert(), config)).resolves.toBe(false);
  });

  it('a caregiver number is used as saved: no guessed country code (3015551234 is not Greece)', async () => {
    const { caregiverEmergencyContacts } = await import('@/services/emergencyService');
    const { useContactsStore } = await import('@/store/contactsStore');
    useContactsStore.setState({ contacts: [{ id: 'a', name: 'Mom', provider: 'sms', recipientId: '3015551234', order: 0 }] as never });
    expect(caregiverEmergencyContacts()[0].phone).toBe('3015551234');
    useContactsStore.setState({ contacts: [] });
  });

  it('a retry from the queue in a browser goes to the server only: no text, call or mail links again', async () => {
    fetchMock.mockRejectedValue(new Error('offline'));
    await sendAlert(alert(), config, { retry: true });
    expect(opened()).toEqual([]);
  });

  it('in the app, a retry still opens the links, which the app hands to iOS', async () => {
    inApp();
    fetchMock.mockRejectedValue(new Error('offline'));
    await expect(sendAlert(alert(), config, { retry: true })).resolves.toBe(true);
    expect(opened()).toContain('tel:+15550001111');
  });
});

describe('sendAlert — one dispatch at a time', () => {
  it('the same alert asked for again while it is being sent shares that outcome: sent once', async () => {
    let release!: (r: unknown) => void;
    fetchMock.mockImplementationOnce(() => new Promise(r => { release = r; }));
    const first = sendAlert(alert(), config);
    const again = sendAlert(alert(), config);
    release(json(200, { success: true, sms_sent: 1, calls_made: 1 }));
    await expect(first).resolves.toBe(true);
    await expect(again).resolves.toBe(true);
    expect(fetchMock).toHaveBeenCalledOnce();
  });

  it('a different alert waits its turn and is sent on its own, never counted by the first', async () => {
    let release!: (r: unknown) => void;
    fetchMock.mockImplementationOnce(() => new Promise(r => { release = r; }));
    fetchMock.mockResolvedValueOnce(json(422, { success: false }));
    const first = sendAlert(alert(), config);
    const other = sendAlert({ ...alert(), id: 'alert-2', phrase: "I can't breathe" }, config);
    release(json(200, { success: true, sms_sent: 1, calls_made: 1 }));
    await expect(first).resolves.toBe(true);
    await expect(other).resolves.toBe(false);
    const bodies = fetchMock.mock.calls.map(c => String((c[1] as { body?: string })?.body ?? ''));
    expect(bodies.some(b => b.includes("I can't breathe"))).toBe(true);
  });
});

describe('triggerEmergency — the queue flush never sends a countdown\'s alert', () => {
  afterEach(() => { vi.useRealTimers(); localStorage.clear(); });
  it('a flush during the countdown sends nothing; the countdown sends once, when it ends', async () => {
    const { triggerEmergency, flushQueuedAlerts } = await import('@/services/emergencyService');
    const { useEmergencyStore } = await import('@/store/emergencyStore');
    fetchMock.mockResolvedValue(json(200, { success: true, sms_sent: 1, calls_made: 1 }));
    Object.defineProperty(navigator, 'geolocation', { configurable: true, value: { getCurrentPosition: (_ok: unknown, fail: (e: unknown) => void) => fail(new Error('denied')) } });
    vi.stubGlobal('matchMedia', () => ({ matches: false, addEventListener() {}, removeEventListener() {} }));
    vi.useFakeTimers({ toFake: ['setInterval', 'clearInterval', 'setTimeout', 'clearTimeout', 'Date'] });
    const done = vi.fn();
    await triggerEmergency('Emergency', 'urgent', () => {}, done);
    await vi.advanceTimersByTimeAsync(3_000);
    await expect(flushQueuedAlerts()).resolves.toBe(0);
    expect(fetchMock).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(10_000);
    expect(done).toHaveBeenCalledWith(true, false);
    expect(fetchMock).toHaveBeenCalledOnce();
    useEmergencyStore.getState().reset();
  });
});
