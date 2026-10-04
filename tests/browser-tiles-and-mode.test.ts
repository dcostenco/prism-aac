import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useBrowserStore } from '@/app/browser/browserStore';

// One stray tap removed a Home tile for good, with no confirm or restore; and
// Say mode reset to Search on every launch.

const initial = useBrowserStore.getState();
const titles = () => useBrowserStore.getState().pinnedBookmarks.map((b) => b.title);
const DEFAULT_TITLES = ['Search', 'Wikipedia', 'News', 'NPR', 'Dictionary', 'Weather'];

beforeEach(() => {
  localStorage.clear();
  useBrowserStore.setState({ ...initial, lastRemoved: null, url: '', isHome: true });
  useBrowserStore.getState().restoreDefaultBookmarks();
});

describe('removing a Home tile can be undone', () => {
  it('puts the tile back where it was', () => {
    useBrowserStore.getState().unpinBookmark('https://text.npr.org');
    expect(titles()).not.toContain('NPR');
    expect(useBrowserStore.getState().lastRemoved?.bookmark.title).toBe('NPR');
    useBrowserStore.getState().undoUnpin();
    expect(titles()).toEqual(DEFAULT_TITLES);
    expect(useBrowserStore.getState().lastRemoved).toBeNull();
    expect(JSON.parse(localStorage.getItem('prism-browser-bookmarks') ?? '[]').map((b: { title: string }) => b.title))
      .toEqual(DEFAULT_TITLES);
  });

  it('does not duplicate a tile that was pinned again meanwhile', () => {
    useBrowserStore.getState().unpinBookmark('https://weather.gov');
    useBrowserStore.setState({ url: 'https://weather.gov', isHome: false });
    useBrowserStore.getState().pinCurrentSite();
    useBrowserStore.getState().undoUnpin();
    expect(titles().filter((t) => t === 'Weather' || t === 'weather.gov')).toHaveLength(1);
  });

  it('restores the starting tiles without deleting tiles the user added', () => {
    useBrowserStore.setState({ url: 'https://example.org', isHome: false });
    useBrowserStore.getState().pinCurrentSite();
    useBrowserStore.getState().unpinBookmark('https://m.wikipedia.org');
    useBrowserStore.getState().unpinBookmark('https://weather.gov');
    useBrowserStore.getState().restoreDefaultBookmarks();
    expect(titles()).toEqual([...DEFAULT_TITLES, 'example.org']);
  });
});

describe('Say or Search is remembered', () => {
  it('survives a reload', async () => {
    useBrowserStore.getState().setSpeakMode(true);
    expect(localStorage.getItem('prism-browser-say-mode')).toBe('1');
    vi.resetModules();
    const reloaded = await import('@/app/browser/browserStore');
    expect(reloaded.useBrowserStore.getState().speakMode).toBe(true);
    reloaded.useBrowserStore.getState().setSpeakMode(false);
    vi.resetModules();
    const again = await import('@/app/browser/browserStore');
    expect(again.useBrowserStore.getState().speakMode).toBe(false);
  });
});
