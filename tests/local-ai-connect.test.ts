/**
 * localAiConnect — where a local Ollama is reachable and what the user should do next.
 * Pins the browser rules: Safari/WebKit (and every iOS browser) never fetches localhost from https;
 * the iOS app uses its built-in model; https pages only reach http://localhost; Chrome/Edge need the
 * local-network permission; an opaque no-cors answer means "running but refusing this site".
 */
import { describe, it, expect, vi } from 'vitest';
import {
  canProbeInBackground, checkLocalAi, detectOs, detectPlatform, isLocalUrl, LOCAL_AI_OPT_IN_KEY,
  ollamaOriginsCommand, type LocalAiWindow,
} from '@/services/localAiConnect';

const UA = {
  safariMac: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 14_4) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Safari/605.1.15',
  chromeMac: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 14_4) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36',
  edgeWin: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36 Edg/146.0.0.0',
  firefoxLinux: 'Mozilla/5.0 (X11; Linux x86_64; rv:140.0) Gecko/20100101 Firefox/140.0',
  chromeIos: 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/146.0 Mobile/15E148 Safari/604.1',
  ipadSafari: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Safari/605.1.15',
};

function win(userAgent: string, protocol = 'https:', bridge = false): LocalAiWindow {
  return {
    location: { protocol, origin: protocol === 'https:' ? 'https://synalux.ai' : 'http://localhost:3000' },
    navigator: { userAgent },
    ...(bridge ? { prismNativeBridge: {} } : {}),
  };
}

const ok = (models: string[] = []) => ({ ok: true, json: async () => ({ models: models.map((name) => ({ name })) }) }) as unknown as Response;

describe('detectPlatform', () => {
  it('recognises the iOS app by its native bridge, whatever the user agent', () => {
    expect(detectPlatform(win(UA.safariMac, 'https:', true))).toBe('ios-app');
  });
  it('treats http pages (dev, local standalone) as able to fetch directly', () => {
    expect(detectPlatform(win(UA.safariMac, 'http:'))).toBe('insecure-page');
  });
  it('classifies desktop browsers on https', () => {
    expect(detectPlatform(win(UA.safariMac))).toBe('safari');
    expect(detectPlatform(win(UA.ipadSafari))).toBe('safari');
    expect(detectPlatform(win(UA.chromeMac))).toBe('chromium');
    expect(detectPlatform(win(UA.edgeWin))).toBe('chromium');
    expect(detectPlatform(win(UA.firefoxLinux))).toBe('firefox');
  });
  it('treats Chrome on iOS as WebKit (Safari rules)', () => {
    expect(detectPlatform(win(UA.chromeIos))).toBe('safari');
  });
});

describe('helpers', () => {
  it('accepts only loopback http URLs as local', () => {
    expect(isLocalUrl('http://localhost:11434')).toBe(true);
    expect(isLocalUrl('http://127.0.0.1:11434')).toBe(true);
    expect(isLocalUrl('http://192.168.1.20:11434')).toBe(false);
    expect(isLocalUrl('https://localhost:11434')).toBe(false);
    expect(isLocalUrl('not a url')).toBe(false);
  });
  it('names the OS and gives the matching OLLAMA_ORIGINS command', () => {
    expect(detectOs(UA.chromeMac)).toBe('mac');
    expect(detectOs(UA.edgeWin)).toBe('windows');
    expect(detectOs(UA.firefoxLinux)).toBe('linux');
    expect(ollamaOriginsCommand('mac', 'https://synalux.ai')).toBe('launchctl setenv OLLAMA_ORIGINS "https://synalux.ai"');
    expect(ollamaOriginsCommand('windows', 'https://synalux.ai')).toBe('setx OLLAMA_ORIGINS "https://synalux.ai"');
    expect(ollamaOriginsCommand('linux', 'https://synalux.ai')).toContain('OLLAMA_ORIGINS=https://synalux.ai');
  });
});

describe('checkLocalAi — no request where the answer is known', () => {
  it.each([
    ['iOS app', win(UA.safariMac, 'https:', true), 'ios-builtin'],
    ['Safari on https', win(UA.safariMac), 'browser-blocks'],
    ['Chrome on iOS', win(UA.chromeIos), 'browser-blocks'],
  ])('%s → %s without fetching', async (_label, w, state) => {
    const fetchSpy = vi.fn();
    expect((await checkLocalAi(w, 'http://localhost:11434', { fetch: fetchSpy })).state).toBe(state);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it.each([
    ['another machine’s address', 'http://192.168.1.20:11434'],
    ['a non-default port (the page policy allows only 11434)', 'http://localhost:11500'],
  ])('https page + %s → unsafe-url without fetching', async (_label, url) => {
    const fetchSpy = vi.fn();
    expect((await checkLocalAi(win(UA.chromeMac), url, { fetch: fetchSpy })).state).toBe('unsafe-url');
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('https page + 127.0.0.1:11434 is allowed like localhost', async () => {
    const fetchSpy = vi.fn().mockResolvedValue(ok([]));
    expect((await checkLocalAi(win(UA.firefoxLinux), 'http://127.0.0.1:11434', { fetch: fetchSpy })).state).toBe('connected');
  });

  it('Chrome with local network access denied → permission-denied without fetching', async () => {
    const fetchSpy = vi.fn();
    const r = await checkLocalAi(win(UA.chromeMac), 'http://localhost:11434', { fetch: fetchSpy, queryPermission: async () => 'denied' });
    expect(r.state).toBe('permission-denied');
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('Chrome with the permission not yet asked → needs-permission, and no prompt until the user presses a button', async () => {
    const fetchSpy = vi.fn();
    const r = await checkLocalAi(win(UA.chromeMac), 'http://localhost:11434', { fetch: fetchSpy, queryPermission: async () => 'prompt' });
    expect(r.state).toBe('needs-permission');
    expect(fetchSpy).not.toHaveBeenCalled();
  });
});

describe('checkLocalAi — probing', () => {
  it('connected when /api/tags answers, with the model names', async () => {
    const fetchSpy = vi.fn().mockResolvedValue(ok(['prism-coder:8b']));
    const r = await checkLocalAi(win(UA.firefoxLinux), 'http://localhost:11434/', { fetch: fetchSpy });
    expect(r).toEqual({ state: 'connected', models: ['prism-coder:8b'] });
    expect(fetchSpy).toHaveBeenCalledWith('http://localhost:11434/api/tags', expect.any(Object));
  });

  it('running but refusing this site: the CORS request fails, the opaque no-cors one succeeds', async () => {
    const fetchSpy = vi.fn()
      .mockRejectedValueOnce(new TypeError('Failed to fetch'))
      .mockResolvedValueOnce({ ok: false, type: 'opaque' } as Response);
    const r = await checkLocalAi(win(UA.chromeMac), 'http://localhost:11434', { fetch: fetchSpy, queryPermission: async () => 'granted' });
    expect(r.state).toBe('blocked-by-ollama');
    expect(fetchSpy).toHaveBeenLastCalledWith('http://localhost:11434/api/version', expect.objectContaining({ mode: 'no-cors' }));
  });

  it('not running when nothing answers', async () => {
    const fetchSpy = vi.fn().mockRejectedValue(new TypeError('Failed to fetch'));
    expect((await checkLocalAi(win(UA.firefoxLinux), 'http://localhost:11434', { fetch: fetchSpy })).state).toBe('not-running');
  });

  it('a pressed button may trigger the Chrome prompt; a dismissed prompt stays needs-permission', async () => {
    const fetchSpy = vi.fn().mockRejectedValue(new TypeError('Failed to fetch'));
    const r = await checkLocalAi(win(UA.chromeMac), 'http://localhost:11434', { fetch: fetchSpy, queryPermission: async () => 'prompt' }, true);
    expect(fetchSpy).toHaveBeenCalled();
    expect(r.state).toBe('needs-permission');
  });

  it('a prompt the user refused during the probe → permission-denied', async () => {
    const queryPermission = vi.fn().mockResolvedValueOnce('prompt').mockResolvedValueOnce('denied');
    const fetchSpy = vi.fn().mockRejectedValue(new TypeError('Failed to fetch'));
    expect((await checkLocalAi(win(UA.chromeMac), 'http://localhost:11434', { fetch: fetchSpy, queryPermission }, true)).state).toBe('permission-denied');
  });

  it('http pages may use another machine’s address (no mixed content there)', async () => {
    const fetchSpy = vi.fn().mockResolvedValue(ok([]));
    expect((await checkLocalAi(win(UA.safariMac, 'http:'), 'http://192.168.1.20:11434', { fetch: fetchSpy })).state).toBe('connected');
  });
});

describe('canProbeInBackground (services on https only after the user connected)', () => {
  const store = (v: string | null) => ({ getItem: (k: string) => (k === LOCAL_AI_OPT_IN_KEY ? v : null) });
  it('http pages: always', () => expect(canProbeInBackground(win(UA.safariMac, 'http:'), store(null))).toBe(true));
  it('https Chrome/Firefox: only with the opt-in flag', () => {
    expect(canProbeInBackground(win(UA.chromeMac), store(null))).toBe(false);
    expect(canProbeInBackground(win(UA.chromeMac), store('1'))).toBe(true);
    expect(canProbeInBackground(win(UA.firefoxLinux), store('1'))).toBe(true);
  });
  it('Safari and the iOS app: never, even with the flag', () => {
    expect(canProbeInBackground(win(UA.safariMac), store('1'))).toBe(false);
    expect(canProbeInBackground(win(UA.safariMac, 'https:', true), store('1'))).toBe(false);
  });
  it('a throwing storage (private mode) counts as not opted in', () => {
    expect(canProbeInBackground(win(UA.chromeMac), { getItem: () => { throw new Error('denied'); } })).toBe(false);
  });
});

describe('Fable review follow-ups (2026-10-02)', () => {
  it('[::1] is not offered: the page policy (connect-src) does not list it, so it would read "not running"', () => {
    expect(isLocalUrl('http://[::1]:11434')).toBe(false);
  });
  it('Chrome on iPadOS sends a desktop Mac UA but runs WebKit (AppleWebKit/605): Safari rules apply', () => {
    const ipadChromeDesktop = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Chrome/146.0 Safari/605.1.15';
    expect(detectPlatform(win(ipadChromeDesktop))).toBe('safari');
  });
});
