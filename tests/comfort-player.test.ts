/**
 * Comfort Player — Zustand store unit tests.
 *
 * Covers the comfortPlayerStore state machine:
 *   addItem, removeItem, reorderItem, play, pause, next, setIndex, clear
 *
 * comfortMediaStorage is mocked so store tests stay isolated from IndexedDB.
 * Storage tests live in comfort-media-storage.test.ts (uses real fake-indexeddb).
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';

// Mock storage so the store's deleteBlob/deleteAllBlobs calls don't need IDB.
vi.mock('@/services/comfortMediaStorage', () => ({
  saveBlob: vi.fn().mockResolvedValue(undefined),
  getBlob: vi.fn().mockResolvedValue(null),
  deleteBlob: vi.fn().mockResolvedValue(undefined),
  deleteAllBlobs: vi.fn().mockResolvedValue(undefined),
  getBlobUrl: vi.fn().mockResolvedValue(null),
}));

import { useComfortPlayerStore, ComfortMediaItem } from '@/store/comfortPlayerStore';
import { deleteBlob as deleteBlobMock, deleteAllBlobs as deleteAllBlobsMock } from '@/services/comfortMediaStorage';

function makeItem(overrides: Partial<ComfortMediaItem> = {}): ComfortMediaItem {
  return {
    id: 'item-' + Math.random().toString(36).slice(2, 8),
    type: 'audio',
    label: 'Test recording',
    mimeType: 'audio/webm',
    sizeBytes: 1024,
    createdAt: Date.now(),
    ...overrides,
  };
}

describe('comfortPlayerStore — playlist state machine', () => {
  beforeEach(() => {
    useComfortPlayerStore.setState({
      items: [],
      isPlaying: false,
      currentIndex: 0,
    });
    vi.clearAllMocks();
  });

  // ── addItem ──

  it('addItem appends an item to the playlist', () => {
    const item = makeItem({ id: 'a1', label: 'Song A' });
    useComfortPlayerStore.getState().addItem(item);
    const { items } = useComfortPlayerStore.getState();
    expect(items).toHaveLength(1);
    expect(items[0].id).toBe('a1');
    expect(items[0].label).toBe('Song A');
  });

  it('addItem preserves existing items', () => {
    const a = makeItem({ id: 'a1' });
    const b = makeItem({ id: 'b1' });
    useComfortPlayerStore.getState().addItem(a);
    useComfortPlayerStore.getState().addItem(b);
    expect(useComfortPlayerStore.getState().items).toHaveLength(2);
    expect(useComfortPlayerStore.getState().items.map((i) => i.id)).toEqual(['a1', 'b1']);
  });

  // ── removeItem ──

  it('removeItem removes the specified item and calls deleteBlob', () => {
    const a = makeItem({ id: 'a1' });
    const b = makeItem({ id: 'b1' });
    useComfortPlayerStore.getState().addItem(a);
    useComfortPlayerStore.getState().addItem(b);
    useComfortPlayerStore.getState().removeItem('a1');
    expect(useComfortPlayerStore.getState().items).toHaveLength(1);
    expect(useComfortPlayerStore.getState().items[0].id).toBe('b1');
    expect(deleteBlobMock).toHaveBeenCalledWith('a1');
  });

  it('removeItem adjusts currentIndex when removing before it', () => {
    const a = makeItem({ id: 'a1' });
    const b = makeItem({ id: 'b1' });
    const c = makeItem({ id: 'c1' });
    useComfortPlayerStore.getState().addItem(a);
    useComfortPlayerStore.getState().addItem(b);
    useComfortPlayerStore.getState().addItem(c);
    useComfortPlayerStore.setState({ currentIndex: 2 });
    useComfortPlayerStore.getState().removeItem('a1');
    const state = useComfortPlayerStore.getState();
    expect(state.items).toHaveLength(2);
    // currentIndex = min(2, max(0, 2-1)) = min(2,1) = 1
    expect(state.currentIndex).toBe(1);
  });

  it('removeItem clamps currentIndex to last item', () => {
    const a = makeItem({ id: 'a1' });
    const b = makeItem({ id: 'b1' });
    useComfortPlayerStore.getState().addItem(a);
    useComfortPlayerStore.getState().addItem(b);
    useComfortPlayerStore.setState({ currentIndex: 1 });
    useComfortPlayerStore.getState().removeItem('b1');
    expect(useComfortPlayerStore.getState().currentIndex).toBe(0);
  });

  it('removeItem sets isPlaying=false when playlist becomes empty', () => {
    const a = makeItem({ id: 'a1' });
    useComfortPlayerStore.getState().addItem(a);
    useComfortPlayerStore.setState({ isPlaying: true });
    useComfortPlayerStore.getState().removeItem('a1');
    const state = useComfortPlayerStore.getState();
    expect(state.items).toHaveLength(0);
    expect(state.isPlaying).toBe(false);
  });

  it('removeItem preserves isPlaying when items remain', () => {
    const a = makeItem({ id: 'a1' });
    const b = makeItem({ id: 'b1' });
    useComfortPlayerStore.getState().addItem(a);
    useComfortPlayerStore.getState().addItem(b);
    useComfortPlayerStore.setState({ isPlaying: true });
    useComfortPlayerStore.getState().removeItem('a1');
    expect(useComfortPlayerStore.getState().isPlaying).toBe(true);
  });

  // ── reorderItem ──

  it('reorderItem moves item up', () => {
    const a = makeItem({ id: 'a1' });
    const b = makeItem({ id: 'b1' });
    const c = makeItem({ id: 'c1' });
    useComfortPlayerStore.getState().addItem(a);
    useComfortPlayerStore.getState().addItem(b);
    useComfortPlayerStore.getState().addItem(c);
    useComfortPlayerStore.getState().reorderItem('b1', 'up');
    expect(useComfortPlayerStore.getState().items.map((i) => i.id)).toEqual(['b1', 'a1', 'c1']);
  });

  it('reorderItem moves item down', () => {
    const a = makeItem({ id: 'a1' });
    const b = makeItem({ id: 'b1' });
    const c = makeItem({ id: 'c1' });
    useComfortPlayerStore.getState().addItem(a);
    useComfortPlayerStore.getState().addItem(b);
    useComfortPlayerStore.getState().addItem(c);
    useComfortPlayerStore.getState().reorderItem('b1', 'down');
    expect(useComfortPlayerStore.getState().items.map((i) => i.id)).toEqual(['a1', 'c1', 'b1']);
  });

  it('reorderItem does nothing when already at top', () => {
    const a = makeItem({ id: 'a1' });
    const b = makeItem({ id: 'b1' });
    useComfortPlayerStore.getState().addItem(a);
    useComfortPlayerStore.getState().addItem(b);
    useComfortPlayerStore.getState().reorderItem('a1', 'up');
    expect(useComfortPlayerStore.getState().items.map((i) => i.id)).toEqual(['a1', 'b1']);
  });

  it('reorderItem does nothing when already at bottom', () => {
    const a = makeItem({ id: 'a1' });
    const b = makeItem({ id: 'b1' });
    useComfortPlayerStore.getState().addItem(a);
    useComfortPlayerStore.getState().addItem(b);
    useComfortPlayerStore.getState().reorderItem('b1', 'down');
    expect(useComfortPlayerStore.getState().items.map((i) => i.id)).toEqual(['a1', 'b1']);
  });

  it('reorderItem does nothing for unknown id', () => {
    const a = makeItem({ id: 'a1' });
    useComfortPlayerStore.getState().addItem(a);
    useComfortPlayerStore.getState().reorderItem('nope', 'up');
    expect(useComfortPlayerStore.getState().items.map((i) => i.id)).toEqual(['a1']);
  });

  // ── play / pause ──

  it('play sets isPlaying=true when items exist', () => {
    useComfortPlayerStore.getState().addItem(makeItem());
    useComfortPlayerStore.getState().play();
    expect(useComfortPlayerStore.getState().isPlaying).toBe(true);
  });

  it('play does nothing when playlist is empty', () => {
    useComfortPlayerStore.getState().play();
    expect(useComfortPlayerStore.getState().isPlaying).toBe(false);
  });

  it('pause sets isPlaying=false', () => {
    useComfortPlayerStore.getState().addItem(makeItem());
    useComfortPlayerStore.getState().play();
    useComfortPlayerStore.getState().pause();
    expect(useComfortPlayerStore.getState().isPlaying).toBe(false);
  });

  // ── next ──

  it('next advances currentIndex by 1', () => {
    useComfortPlayerStore.getState().addItem(makeItem({ id: 'a' }));
    useComfortPlayerStore.getState().addItem(makeItem({ id: 'b' }));
    useComfortPlayerStore.getState().addItem(makeItem({ id: 'c' }));
    useComfortPlayerStore.setState({ currentIndex: 0 });
    useComfortPlayerStore.getState().next();
    expect(useComfortPlayerStore.getState().currentIndex).toBe(1);
  });

  it('next wraps around to 0 at the end of playlist', () => {
    useComfortPlayerStore.getState().addItem(makeItem({ id: 'a' }));
    useComfortPlayerStore.getState().addItem(makeItem({ id: 'b' }));
    useComfortPlayerStore.setState({ currentIndex: 1 });
    useComfortPlayerStore.getState().next();
    expect(useComfortPlayerStore.getState().currentIndex).toBe(0);
  });

  it('next returns 0 when playlist is empty', () => {
    useComfortPlayerStore.getState().next();
    expect(useComfortPlayerStore.getState().currentIndex).toBe(0);
  });

  // ── setIndex ──

  it('setIndex sets currentIndex and starts playing', () => {
    useComfortPlayerStore.getState().addItem(makeItem({ id: 'a' }));
    useComfortPlayerStore.getState().addItem(makeItem({ id: 'b' }));
    useComfortPlayerStore.getState().setIndex(1);
    expect(useComfortPlayerStore.getState().currentIndex).toBe(1);
    expect(useComfortPlayerStore.getState().isPlaying).toBe(true);
  });

  // ── clear ──

  it('clear empties the playlist and calls deleteAllBlobs', () => {
    useComfortPlayerStore.getState().addItem(makeItem({ id: 'a' }));
    useComfortPlayerStore.getState().addItem(makeItem({ id: 'b' }));
    useComfortPlayerStore.setState({ isPlaying: true, currentIndex: 1 });
    useComfortPlayerStore.getState().clear();
    const state = useComfortPlayerStore.getState();
    expect(state.items).toHaveLength(0);
    expect(state.isPlaying).toBe(false);
    expect(state.currentIndex).toBe(0);
    expect(deleteAllBlobsMock).toHaveBeenCalledOnce();
  });

  // ── Complex scenarios ──

  it('full play cycle: add 3 items, play, next through all, wraps', () => {
    const a = makeItem({ id: 'a' });
    const b = makeItem({ id: 'b' });
    const c = makeItem({ id: 'c' });
    useComfortPlayerStore.getState().addItem(a);
    useComfortPlayerStore.getState().addItem(b);
    useComfortPlayerStore.getState().addItem(c);
    useComfortPlayerStore.getState().play();

    expect(useComfortPlayerStore.getState().currentIndex).toBe(0);
    useComfortPlayerStore.getState().next();
    expect(useComfortPlayerStore.getState().currentIndex).toBe(1);
    useComfortPlayerStore.getState().next();
    expect(useComfortPlayerStore.getState().currentIndex).toBe(2);
    useComfortPlayerStore.getState().next(); // wrap
    expect(useComfortPlayerStore.getState().currentIndex).toBe(0);
    expect(useComfortPlayerStore.getState().isPlaying).toBe(true);
  });

  it('remove currently playing item adjusts index correctly', () => {
    const a = makeItem({ id: 'a' });
    const b = makeItem({ id: 'b' });
    const c = makeItem({ id: 'c' });
    useComfortPlayerStore.getState().addItem(a);
    useComfortPlayerStore.getState().addItem(b);
    useComfortPlayerStore.getState().addItem(c);
    useComfortPlayerStore.setState({ currentIndex: 1, isPlaying: true });
    useComfortPlayerStore.getState().removeItem('b');
    const state = useComfortPlayerStore.getState();
    expect(state.items.map((i) => i.id)).toEqual(['a', 'c']);
    // min(1, max(0, 1)) = 1
    expect(state.currentIndex).toBe(1);
    expect(state.isPlaying).toBe(true);
  });

  it('remove last item in list when index points to it', () => {
    const a = makeItem({ id: 'a' });
    const b = makeItem({ id: 'b' });
    useComfortPlayerStore.getState().addItem(a);
    useComfortPlayerStore.getState().addItem(b);
    useComfortPlayerStore.setState({ currentIndex: 1, isPlaying: true });
    useComfortPlayerStore.getState().removeItem('b');
    const state = useComfortPlayerStore.getState();
    expect(state.items).toHaveLength(1);
    expect(state.currentIndex).toBe(0);
    expect(state.isPlaying).toBe(true);
  });

  it('setIndex then clear resets everything', () => {
    useComfortPlayerStore.getState().addItem(makeItem({ id: 'a' }));
    useComfortPlayerStore.getState().addItem(makeItem({ id: 'b' }));
    useComfortPlayerStore.getState().setIndex(1);
    useComfortPlayerStore.getState().clear();
    expect(useComfortPlayerStore.getState().items).toHaveLength(0);
    expect(useComfortPlayerStore.getState().currentIndex).toBe(0);
    expect(useComfortPlayerStore.getState().isPlaying).toBe(false);
  });

  it('addItem preserves item metadata', () => {
    const item = makeItem({
      id: 'meta-test',
      type: 'video',
      label: 'Birthday video',
      mimeType: 'video/mp4',
      sizeBytes: 50000,
      durationMs: 30000,
      createdAt: 1700000000000,
    });
    useComfortPlayerStore.getState().addItem(item);
    const stored = useComfortPlayerStore.getState().items[0];
    expect(stored.type).toBe('video');
    expect(stored.label).toBe('Birthday video');
    expect(stored.mimeType).toBe('video/mp4');
    expect(stored.sizeBytes).toBe(50000);
    expect(stored.durationMs).toBe(30000);
    expect(stored.createdAt).toBe(1700000000000);
  });
});
