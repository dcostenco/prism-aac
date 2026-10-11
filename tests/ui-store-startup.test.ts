import { afterEach, describe, expect, it, vi } from 'vitest';

const KEYBOARD_OPEN = 'prism-cat-kb-open';
const KEYBOARD_MAXIMIZED = 'prism-kb-max';
const SAVED_MODES = [
  { name: 'picture mode', open: 'false', maximized: 'false', typing: false },
  { name: 'typing mode', open: 'true', maximized: 'true', typing: true },
  { name: 'legacy open keyboard', open: 'true', maximized: 'false', typing: true },
  { name: 'saved closed keyboard', open: 'false', maximized: null, typing: false },
  { name: 'saved maximized keyboard', open: null, maximized: 'true', typing: true },
];

afterEach(() => { vi.restoreAllMocks(); });

async function loadWithPreferences(open: string | null, maximized: string | null) {
  vi.resetModules();
  vi.spyOn(window.localStorage, 'getItem').mockImplementation(key =>
    key === KEYBOARD_OPEN ? open : key === KEYBOARD_MAXIMIZED ? maximized : null);
  return (await import('@/store/uiStore')).useUIStore;
}

describe('AAC startup exposes picture cards while preserving saved input choices', () => {
  it('starts a first visit on the picture board and still allows keyboard entry and return', async () => {
    const store = await loadWithPreferences(null, null);
    expect(store.getState()).toMatchObject({ categoryKeyboardOpen: false, keyboardMaximized: false });
    store.getState().cycleKeyboardMode();
    expect(store.getState()).toMatchObject({ categoryKeyboardOpen: true, keyboardMaximized: true });
    store.getState().cycleKeyboardMode();
    expect(store.getState()).toMatchObject({ categoryKeyboardOpen: false, keyboardMaximized: false });
  });

  it.each(SAVED_MODES)('preserves $name on startup', async ({ open, maximized, typing }) => {
    const store = await loadWithPreferences(open, maximized);
    expect(store.getState()).toMatchObject({ categoryKeyboardOpen: typing, keyboardMaximized: typing });
  });

  it('keeps the picture board available when preference storage is unavailable', async () => {
    vi.resetModules();
    vi.spyOn(window.localStorage, 'getItem').mockImplementation(() => { throw new Error('Storage unavailable'); });
    const { useUIStore } = await import('@/store/uiStore');
    expect(useUIStore.getState()).toMatchObject({ categoryKeyboardOpen: false, keyboardMaximized: false });
  });
});
