import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useBrowserStore } from '@/app/browser/browserStore';

// The empty-field strip above the browser keyboard should learn the sites a
// user opens. Visits were recorded only after an in-page iframe load, which
// never happens in the iOS app (sites open in a native view through the bridge)
// nor for web sites opened in a new tab, so the strip never changed.

type BridgeWindow = { prismNativeBridge?: { navigateTo?: (url: string) => void } };
const initial = useBrowserStore.getState();

beforeEach(() => {
  localStorage.clear();
  useBrowserStore.setState({ ...initial, frecency: [], history: [], historyIdx: -1, url: '', isHome: true });
});
afterEach(() => {
  delete (window as BridgeWindow).prismNativeBridge;
  vi.restoreAllMocks();
});

describe('frequent sites learn from what the user opens', () => {
  it('records a site opened through the iOS shell, which never loads it in the page', () => {
    const navigateTo = vi.fn();
    (window as BridgeWindow).prismNativeBridge = { navigateTo };
    useBrowserStore.getState().navigate('youtube.com');
    expect(navigateTo).toHaveBeenCalledWith('https://youtube.com');
    expect(useBrowserStore.getState().getSiteSuggestions('')[0]).toMatchObject({ title: 'YouTube', url: 'https://m.youtube.com' });
  });

  it('ranks repeated visits first and keeps one entry per site', () => {
    (window as BridgeWindow).prismNativeBridge = { navigateTo: vi.fn() };
    const { navigate } = useBrowserStore.getState();
    navigate('example.org');
    navigate('youtube.com');
    navigate('https://www.youtube.com/watch?v=abc');
    navigate('youtube.com');
    const suggestions = useBrowserStore.getState().getSiteSuggestions('');
    expect(suggestions[0].title).toBe('YouTube');
    expect(suggestions.filter(s => s.title === 'YouTube')).toHaveLength(1);
    expect(suggestions.map(s => s.url)).toContain('https://example.org');
    expect(JSON.parse(localStorage.getItem('prism-browser-frecency') ?? '[]')).toHaveLength(2);
  });

  // The strip shows site names, and localStorage outlives the session: keep the
  // site, never the words a person searched for or the page path they read.
  it('stores a search as the Search site and a page as its site, never the query or path', () => {
    (window as BridgeWindow).prismNativeBridge = { navigateTo: vi.fn() };
    useBrowserStore.getState().navigate('trains for kids');
    useBrowserStore.getState().navigate('https://example.org/private/report?id=42');
    const stored = localStorage.getItem('prism-browser-frecency') ?? '';
    expect(stored).not.toMatch(/trains|private|id=42/);
    expect(useBrowserStore.getState().getSiteSuggestions('').map(s => s.title)).toEqual(
      expect.arrayContaining(['Search', 'example.org']));
  });

  it('records a site opened in a new tab on the web', () => {
    vi.spyOn(window, 'open').mockReturnValue(null); // noopener always returns null
    useBrowserStore.getState().navigate('example.org');
    expect(useBrowserStore.getState().frecency.map(e => e.title)).toEqual(['example.org']);
  });
});
