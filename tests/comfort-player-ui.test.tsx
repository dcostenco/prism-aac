/**
 * ComfortPlayerPanel — React component tests.
 *
 * Covers:
 *   - Render gate (sidePanel must be 'comfort-player')
 *   - Empty state rendering
 *   - Playlist item rendering with labels and sizes
 *   - Play/pause header controls
 *   - Clicking an item starts playback (setIndex)
 *   - Record button switches to record view
 *   - Upload input accepts files
 *   - Delete button removes an item
 *   - Fullscreen toggle
 *   - Close button
 *   - Clear confirmation flow (M4: in-app confirm, not window.confirm)
 *   - Aria labels for accessibility
 */
import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { render, screen, act, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom/vitest';
import ComfortPlayerPanel from '@/components/ComfortPlayerPanel';
import { useUIStore } from '@/store/uiStore';
import { useComfortPlayerStore, ComfortMediaItem } from '@/store/comfortPlayerStore';

// ── Mocks ──────────────────────────────────────────────────────────────────

vi.mock('@/services/feedback', () => ({
  tapFeedback: vi.fn(),
}));

// Mock getBlob to return a real Blob so useEffect doesn't call next() in a loop.
const getBlobMock = vi.fn().mockResolvedValue(null);
vi.mock('@/services/comfortMediaStorage', () => ({
  saveBlob: vi.fn().mockResolvedValue(undefined),
  getBlob: (...args: unknown[]) => getBlobMock(...args),
  deleteBlob: vi.fn().mockResolvedValue(undefined),
  deleteAllBlobs: vi.fn().mockResolvedValue(undefined),
}));

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

// ── Setup ──────────────────────────────────────────────────────────────────

beforeEach(() => {
  useUIStore.setState({ sidePanel: 'comfort-player' });
  useComfortPlayerStore.setState({
    items: [],
    isPlaying: false,
    currentIndex: 0,
  });
  // Default: getBlob returns null (no blob stored).
  // Tests that need playback should override this.
  getBlobMock.mockResolvedValue(null);
  vi.clearAllMocks();
});

afterEach(() => {
  vi.restoreAllMocks();
});

// ── Render gate ────────────────────────────────────────────────────────────

describe('ComfortPlayerPanel — render gate', () => {
  it('does NOT render when sidePanel !== comfort-player', () => {
    useUIStore.setState({ sidePanel: 'none' });
    const { container } = render(<ComfortPlayerPanel />);
    expect(container.innerHTML).toBe('');
  });

  it('renders when sidePanel === comfort-player', () => {
    render(<ComfortPlayerPanel />);
    expect(screen.getByRole('heading', { name: 'Comfort Player' })).toBeInTheDocument();
  });
});

// ── Empty state ────────────────────────────────────────────────────────────

describe('ComfortPlayerPanel — empty state', () => {
  it('renders empty state message when no items', () => {
    render(<ComfortPlayerPanel />);
    expect(screen.getByText(/Record voice messages/)).toBeInTheDocument();
  });

  it('does not show play/pause or fullscreen buttons when empty', () => {
    render(<ComfortPlayerPanel />);
    expect(screen.queryByLabelText('Start playback')).not.toBeInTheDocument();
    expect(screen.queryByLabelText('Pause playback')).not.toBeInTheDocument();
    expect(screen.queryByLabelText('Fullscreen playback')).not.toBeInTheDocument();
  });

  it('shows Record and Upload footer buttons', () => {
    render(<ComfortPlayerPanel />);
    // Use more specific queries to avoid matching the empty-state description text
    const recordBtn = screen.getByRole('button', { name: /Record/ });
    const uploadBtn = screen.getByRole('button', { name: /Upload/ });
    expect(recordBtn).toBeInTheDocument();
    expect(uploadBtn).toBeInTheDocument();
  });

  it('does not show Clear All button when empty', () => {
    render(<ComfortPlayerPanel />);
    expect(screen.queryByLabelText('Delete all media')).not.toBeInTheDocument();
  });
});

// ── Playlist items ─────────────────────────────────────────────────────────

describe('ComfortPlayerPanel — playlist items', () => {
  const items: ComfortMediaItem[] = [
    makeItem({ id: 'a1', label: 'Mama voice', type: 'audio', sizeBytes: 2048 }),
    makeItem({ id: 'p1', label: 'Family photo', type: 'photo', sizeBytes: 500000 }),
    makeItem({ id: 'v1', label: 'Birthday video', type: 'video', sizeBytes: 5000000 }),
  ];

  beforeEach(() => {
    useComfortPlayerStore.setState({ items, isPlaying: false, currentIndex: 0 });
  });

  it('renders all playlist items with labels', () => {
    render(<ComfortPlayerPanel />);
    expect(screen.getByText('Mama voice')).toBeInTheDocument();
    expect(screen.getByText('Family photo')).toBeInTheDocument();
    expect(screen.getByText('Birthday video')).toBeInTheDocument();
  });

  it('renders type and size info via aria-label', () => {
    render(<ComfortPlayerPanel />);
    // Each playlist item has an aria-label like "Play Mama voice, audio, 2 KB"
    expect(screen.getByLabelText(/Play Mama voice, audio, 2 KB/)).toBeInTheDocument();
    expect(screen.getByLabelText(/Play Family photo, photo, 488 KB/)).toBeInTheDocument();
    expect(screen.getByLabelText(/Play Birthday video, video, 5\.0 MB/)).toBeInTheDocument();
  });

  it('shows play button in header when items exist', () => {
    render(<ComfortPlayerPanel />);
    expect(screen.getByLabelText('Start playback')).toBeInTheDocument();
  });

  it('shows fullscreen button in header when items exist', () => {
    render(<ComfortPlayerPanel />);
    expect(screen.getByLabelText('Fullscreen playback')).toBeInTheDocument();
  });

  it('shows Delete all media button in footer when items exist', () => {
    render(<ComfortPlayerPanel />);
    expect(screen.getByLabelText('Delete all media')).toBeInTheDocument();
  });

  it('renders delete button for each item', () => {
    render(<ComfortPlayerPanel />);
    expect(screen.getByLabelText('Delete Mama voice')).toBeInTheDocument();
    expect(screen.getByLabelText('Delete Family photo')).toBeInTheDocument();
    expect(screen.getByLabelText('Delete Birthday video')).toBeInTheDocument();
  });
});

// ── Clicking playlist item ─────────────────────────────────────────────────

describe('ComfortPlayerPanel — item click starts playback', () => {
  it('clicking an item sets currentIndex and starts playing', async () => {
    // Return a real blob so the useEffect doesn't call next() in a loop
    getBlobMock.mockResolvedValue(new Blob(['test-audio'], { type: 'audio/webm' }));

    const items = [
      makeItem({ id: 'a1', label: 'Song A' }),
      makeItem({ id: 'b1', label: 'Song B' }),
    ];
    useComfortPlayerStore.setState({ items, isPlaying: false, currentIndex: 0 });

    render(<ComfortPlayerPanel />);
    const user = userEvent.setup();

    // Click on "Song B" text (inside the item div)
    await user.click(screen.getByText('Song B'));

    const state = useComfortPlayerStore.getState();
    expect(state.currentIndex).toBe(1);
    expect(state.isPlaying).toBe(true);
  });
});

// ── Play / Pause header buttons ────────────────────────────────────────────

describe('ComfortPlayerPanel — play/pause controls', () => {
  beforeEach(() => {
    useComfortPlayerStore.setState({
      items: [makeItem({ id: 'a1', label: 'Song A' })],
      isPlaying: false,
      currentIndex: 0,
    });
  });

  it('clicking play button starts playback', async () => {
    render(<ComfortPlayerPanel />);
    const user = userEvent.setup();
    await user.click(screen.getByLabelText('Start playback'));
    expect(useComfortPlayerStore.getState().isPlaying).toBe(true);
  });

  it('clicking pause button pauses playback', async () => {
    // Need a blob so the "now playing" effect doesn't loop
    getBlobMock.mockResolvedValue(new Blob(['audio'], { type: 'audio/webm' }));
    useComfortPlayerStore.setState({ isPlaying: true });
    render(<ComfortPlayerPanel />);
    const user = userEvent.setup();
    await user.click(screen.getByLabelText('Pause playback'));
    expect(useComfortPlayerStore.getState().isPlaying).toBe(false);
  });
});

// ── Record view ────────────────────────────────────────────────────────────

describe('ComfortPlayerPanel — record view', () => {
  it('clicking Record button switches to record view', async () => {
    render(<ComfortPlayerPanel />);
    const user = userEvent.setup();

    await user.click(screen.getByRole('button', { name: /Record/ }));

    expect(screen.getByText(/Tap to start recording/)).toBeInTheDocument();
  });

  it('record view shows back to playlist link', async () => {
    render(<ComfortPlayerPanel />);
    const user = userEvent.setup();

    await user.click(screen.getByRole('button', { name: /Record/ }));
    expect(screen.getByText(/Back to playlist/)).toBeInTheDocument();
  });

  it('clicking back returns to playlist view', async () => {
    render(<ComfortPlayerPanel />);
    const user = userEvent.setup();

    await user.click(screen.getByRole('button', { name: /Record/ }));
    await user.click(screen.getByText(/Back to playlist/));

    // Should see the empty state again
    expect(screen.getByText(/Record voice messages/)).toBeInTheDocument();
  });
});

// ── Upload ─────────────────────────────────────────────────────────────────

describe('ComfortPlayerPanel — file upload', () => {
  it('has a hidden file input that accepts audio, image, and video', () => {
    render(<ComfortPlayerPanel />);
    const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
    expect(fileInput).toBeTruthy();
    expect(fileInput.accept).toBe('audio/*,image/*,video/*');
    expect(fileInput.multiple).toBe(true);
    expect(fileInput.className).toContain('hidden');
  });

  it('Upload button triggers the hidden file input', async () => {
    render(<ComfortPlayerPanel />);
    const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
    const clickSpy = vi.spyOn(fileInput, 'click');

    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: /Upload/ }));

    expect(clickSpy).toHaveBeenCalled();
  });

  it('uploading an audio file adds it to the store', async () => {
    const { saveBlob } = await import('@/services/comfortMediaStorage');
    render(<ComfortPlayerPanel />);

    const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
    const file = new File(['audio-data'], 'mom-voice.webm', { type: 'audio/webm' });

    await act(async () => {
      fireEvent.change(fileInput, { target: { files: [file] } });
      await new Promise((r) => setTimeout(r, 50));
    });

    expect(saveBlob).toHaveBeenCalled();
    const state = useComfortPlayerStore.getState();
    expect(state.items).toHaveLength(1);
    expect(state.items[0].label).toBe('mom-voice');
    expect(state.items[0].type).toBe('audio');
    expect(state.items[0].mimeType).toBe('audio/webm');
  });

  it('uploading an image file classifies it as photo', async () => {
    render(<ComfortPlayerPanel />);
    const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
    const file = new File(['img-data'], 'family.jpg', { type: 'image/jpeg' });

    await act(async () => {
      fireEvent.change(fileInput, { target: { files: [file] } });
      await new Promise((r) => setTimeout(r, 50));
    });

    expect(useComfortPlayerStore.getState().items[0]?.type).toBe('photo');
  });

  it('uploading a video file classifies it as video', async () => {
    render(<ComfortPlayerPanel />);
    const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
    const file = new File(['video-data'], 'birthday.mp4', { type: 'video/mp4' });

    await act(async () => {
      fireEvent.change(fileInput, { target: { files: [file] } });
      await new Promise((r) => setTimeout(r, 50));
    });

    expect(useComfortPlayerStore.getState().items[0]?.type).toBe('video');
  });

  it('uploading multiple files adds all of them', async () => {
    render(<ComfortPlayerPanel />);
    const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
    const files = [
      new File(['a'], 'a.webm', { type: 'audio/webm' }),
      new File(['b'], 'b.jpg', { type: 'image/jpeg' }),
    ];

    await act(async () => {
      fireEvent.change(fileInput, { target: { files } });
      await new Promise((r) => setTimeout(r, 100));
    });

    expect(useComfortPlayerStore.getState().items).toHaveLength(2);
  });
});

// ── Delete item ────────────────────────────────────────────────────────────

describe('ComfortPlayerPanel — delete item', () => {
  it('clicking delete button removes the item from store', async () => {
    useComfortPlayerStore.setState({
      items: [
        makeItem({ id: 'a1', label: 'Song A' }),
        makeItem({ id: 'b1', label: 'Song B' }),
      ],
      isPlaying: false,
      currentIndex: 0,
    });

    render(<ComfortPlayerPanel />);
    const user = userEvent.setup();

    await user.click(screen.getByLabelText('Delete Song A'));

    expect(useComfortPlayerStore.getState().items).toHaveLength(1);
    expect(useComfortPlayerStore.getState().items[0].id).toBe('b1');
  });

  it('delete click does not propagate to item click (stopPropagation)', async () => {
    useComfortPlayerStore.setState({
      items: [makeItem({ id: 'a1', label: 'Song A' })],
      isPlaying: false,
      currentIndex: 0,
    });

    render(<ComfortPlayerPanel />);
    const user = userEvent.setup();

    await user.click(screen.getByLabelText('Delete Song A'));

    // Item was removed, playlist is now empty
    expect(useComfortPlayerStore.getState().items).toHaveLength(0);
  });
});

// ── Close button ───────────────────────────────────────────────────────────

describe('ComfortPlayerPanel — close button', () => {
  it('clicking close button calls closeSidePanel', async () => {
    render(<ComfortPlayerPanel />);
    const user = userEvent.setup();

    await user.click(screen.getByLabelText('Close comfort player'));

    expect(useUIStore.getState().sidePanel).toBe('none');
  });
});

// ── Fullscreen toggle ──────────────────────────────────────────────────────

describe('ComfortPlayerPanel — fullscreen', () => {
  it('clicking fullscreen button starts playback if not playing', async () => {
    useComfortPlayerStore.setState({
      items: [makeItem({ id: 'a1', label: 'Song A' })],
      isPlaying: false,
      currentIndex: 0,
    });

    render(<ComfortPlayerPanel />);
    const user = userEvent.setup();

    await user.click(screen.getByLabelText('Fullscreen playback'));

    expect(useComfortPlayerStore.getState().isPlaying).toBe(true);
  });
});

// ── Now Playing section ────────────────────────────────────────────────────

describe('ComfortPlayerPanel — now playing section', () => {
  it('does not show "Now Playing" when not playing', () => {
    useComfortPlayerStore.setState({
      items: [makeItem({ id: 'a1', label: 'Song A' })],
      isPlaying: false,
      currentIndex: 0,
    });
    render(<ComfortPlayerPanel />);
    expect(screen.queryByText('Now Playing')).not.toBeInTheDocument();
  });
});

// ── Clear confirmation (M4) ───────────────────────────────────────────────

describe('ComfortPlayerPanel — clear confirmation flow', () => {
  beforeEach(() => {
    useComfortPlayerStore.setState({
      items: [
        makeItem({ id: 'a1', label: 'Song A' }),
        makeItem({ id: 'b1', label: 'Song B' }),
      ],
      isPlaying: false,
      currentIndex: 0,
    });
  });

  it('clicking trash shows confirmation instead of immediately clearing', async () => {
    render(<ComfortPlayerPanel />);
    const user = userEvent.setup();

    await user.click(screen.getByLabelText('Delete all media'));

    expect(screen.getByText('Delete all media?')).toBeInTheDocument();
    expect(screen.getByText('Yes, delete all')).toBeInTheDocument();
    expect(screen.getByText('Cancel')).toBeInTheDocument();
    // Items not yet deleted
    expect(useComfortPlayerStore.getState().items).toHaveLength(2);
  });

  it('clicking Cancel dismisses confirmation without clearing', async () => {
    render(<ComfortPlayerPanel />);
    const user = userEvent.setup();

    await user.click(screen.getByLabelText('Delete all media'));
    await user.click(screen.getByText('Cancel'));

    expect(screen.queryByText('Delete all media?')).not.toBeInTheDocument();
    expect(useComfortPlayerStore.getState().items).toHaveLength(2);
  });

  it('clicking "Yes, delete all" clears the playlist', async () => {
    render(<ComfortPlayerPanel />);
    const user = userEvent.setup();

    await user.click(screen.getByLabelText('Delete all media'));
    await user.click(screen.getByText('Yes, delete all'));

    expect(useComfortPlayerStore.getState().items).toHaveLength(0);
  });
});

// ── Header button aria labels ──────────────────────────────────────────────

describe('ComfortPlayerPanel — header button aria labels', () => {
  it('shows correct aria labels for accessibility', () => {
    useComfortPlayerStore.setState({
      items: [makeItem({ id: 'a1', label: 'Song A' })],
      isPlaying: false,
      currentIndex: 0,
    });
    render(<ComfortPlayerPanel />);

    expect(screen.getByLabelText('Start playback')).toBeInTheDocument();
    expect(screen.getByLabelText('Fullscreen playback')).toBeInTheDocument();
    expect(screen.getByLabelText('Close comfort player')).toBeInTheDocument();
  });

  it('aria label changes to Pause when playing', () => {
    getBlobMock.mockResolvedValue(new Blob(['audio'], { type: 'audio/webm' }));
    useComfortPlayerStore.setState({
      items: [makeItem({ id: 'a1', label: 'Song A' })],
      isPlaying: true,
      currentIndex: 0,
    });
    render(<ComfortPlayerPanel />);
    expect(screen.getByLabelText('Pause playback')).toBeInTheDocument();
    expect(screen.queryByLabelText('Start playback')).not.toBeInTheDocument();
  });
});
