import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import PictureEditorPanel from '@/components/marketplace/panels/PictureEditorPanel';
import { useUIStore } from '@/store/uiStore';

vi.mock('@/engine/useT', () => ({
  useT: () => ({ t: (key: string) => key, ttsCode: 'en-US', rtl: false }),
}));

vi.mock('@/services/feedback', () => ({
  tapFeedback: vi.fn(),
  keyFeedback: vi.fn(),
  deleteFeedback: vi.fn(),
}));

beforeEach(() => {
  // jsdom's HTMLCanvasElement.getContext returns null by default — install
  // a mock 2D context with the methods we use so the panel can paint.
  HTMLCanvasElement.prototype.getContext = vi.fn(() => ({
    fillStyle: '',
    strokeStyle: '',
    lineWidth: 0,
    lineCap: 'butt',
    lineJoin: 'miter',
    fillRect: vi.fn(),
    beginPath: vi.fn(),
    moveTo: vi.fn(),
    lineTo: vi.fn(),
    stroke: vi.fn(),
    arc: vi.fn(),
    fill: vi.fn(),
  })) as unknown as typeof HTMLCanvasElement.prototype.getContext;

  // toDataURL returns a placeholder so the save button doesn't crash.
  HTMLCanvasElement.prototype.toDataURL = vi.fn(() => 'data:image/png;base64,XXXX');

  // Pointer capture API isn't in jsdom.
  if (!(HTMLElement.prototype as { setPointerCapture?: unknown }).setPointerCapture) {
    (HTMLElement.prototype as unknown as Record<string, unknown>).setPointerCapture = vi.fn();
    (HTMLElement.prototype as unknown as Record<string, unknown>).releasePointerCapture = vi.fn();
  }

  // Open the panel in the UI store so PictureEditorPanel renders body.
  act(() => {
    useUIStore.setState({ sidePanel: 'picture-editor' });
  });
});

afterEach(() => {
  // Restore document.createElement and any other spies between tests so
  // the save-button mock doesn't leak into subsequent renders and cause
  // infinite recursion in document.createElement when React renders.
  vi.restoreAllMocks();
});

describe('PictureEditorPanel — render gating', () => {
  it('returns null when sidePanel is not picture-editor', () => {
    act(() => { useUIStore.setState({ sidePanel: 'none' }); });
    const { container } = render(<PictureEditorPanel />);
    expect(container.firstChild).toBeNull();
  });

  it('renders the canvas + tool bar when sidePanel is picture-editor', () => {
    render(<PictureEditorPanel />);
    expect(screen.getByTestId('pe-canvas')).toBeInTheDocument();
    expect(screen.getByTestId('pe-tool-brush')).toBeInTheDocument();
    expect(screen.getByTestId('pe-tool-eraser')).toBeInTheDocument();
    expect(screen.getByTestId('pe-undo')).toBeInTheDocument();
    expect(screen.getByTestId('pe-clear')).toBeInTheDocument();
    expect(screen.getByTestId('pe-save')).toBeInTheDocument();
  });

  it('renders all 8 brush colors', () => {
    render(<PictureEditorPanel />);
    for (const hex of ['#000000', '#E53935', '#FB8C00', '#FDD835', '#43A047', '#1E88E5', '#8E24AA', '#6D4C41']) {
      expect(screen.getByTestId(`pe-color-${hex.toLowerCase()}`)).toBeInTheDocument();
    }
  });

  it('renders all 4 brush sizes', () => {
    render(<PictureEditorPanel />);
    for (const s of [4, 8, 16, 32]) {
      expect(screen.getByTestId(`pe-size-${s}`)).toBeInTheDocument();
    }
  });
});

describe('PictureEditorPanel — initial state', () => {
  it('brush is the default selected tool', () => {
    render(<PictureEditorPanel />);
    expect(screen.getByTestId('pe-tool-brush').getAttribute('aria-checked')).toBe('true');
    expect(screen.getByTestId('pe-tool-eraser').getAttribute('aria-checked')).toBe('false');
  });

  it('undo + clear are disabled when there are no strokes', () => {
    render(<PictureEditorPanel />);
    expect(screen.getByTestId('pe-undo')).toBeDisabled();
    expect(screen.getByTestId('pe-clear')).toBeDisabled();
  });
});

describe('PictureEditorPanel — tool selection', () => {
  it('selecting eraser flips aria-checked', () => {
    render(<PictureEditorPanel />);
    fireEvent.click(screen.getByTestId('pe-tool-eraser'));
    expect(screen.getByTestId('pe-tool-eraser').getAttribute('aria-checked')).toBe('true');
    expect(screen.getByTestId('pe-tool-brush').getAttribute('aria-checked')).toBe('false');
  });

  it('clicking a color forces tool back to brush', () => {
    render(<PictureEditorPanel />);
    fireEvent.click(screen.getByTestId('pe-tool-eraser'));
    fireEvent.click(screen.getByTestId('pe-color-#e53935'));
    expect(screen.getByTestId('pe-tool-brush').getAttribute('aria-checked')).toBe('true');
  });

  it('selecting a size flips its aria-checked', () => {
    render(<PictureEditorPanel />);
    fireEvent.click(screen.getByTestId('pe-size-32'));
    expect(screen.getByTestId('pe-size-32').getAttribute('aria-checked')).toBe('true');
  });
});

describe('PictureEditorPanel — drawing + undo + clear', () => {
  function paintOneStroke(canvas: HTMLElement) {
    fireEvent.pointerDown(canvas, { clientX: 100, clientY: 100, pointerId: 1 });
    fireEvent.pointerMove(canvas, { clientX: 110, clientY: 105, pointerId: 1 });
    fireEvent.pointerUp(canvas, { clientX: 110, clientY: 105, pointerId: 1 });
  }

  it('a stroke enables undo + clear', () => {
    render(<PictureEditorPanel />);
    paintOneStroke(screen.getByTestId('pe-canvas'));
    expect(screen.getByTestId('pe-undo')).not.toBeDisabled();
    expect(screen.getByTestId('pe-clear')).not.toBeDisabled();
  });

  it('undo after one stroke disables undo again', () => {
    render(<PictureEditorPanel />);
    const canvas = screen.getByTestId('pe-canvas');
    paintOneStroke(canvas);
    fireEvent.click(screen.getByTestId('pe-undo'));
    expect(screen.getByTestId('pe-undo')).toBeDisabled();
  });

  it('clear after multiple strokes disables both buttons', () => {
    render(<PictureEditorPanel />);
    const canvas = screen.getByTestId('pe-canvas');
    paintOneStroke(canvas);
    paintOneStroke(canvas);
    paintOneStroke(canvas);
    fireEvent.click(screen.getByTestId('pe-clear'));
    expect(screen.getByTestId('pe-undo')).toBeDisabled();
    expect(screen.getByTestId('pe-clear')).toBeDisabled();
  });
});

describe('PictureEditorPanel — save', () => {
  it('save button calls toDataURL and triggers a download', () => {
    render(<PictureEditorPanel />);
    // Install spy AFTER render so we don't intercept React's own
    // createElement calls (which would infinite-recurse).
    const linkClicks: string[] = [];
    const originalCreate = document.createElement.bind(document);
    vi.spyOn(document, 'createElement').mockImplementation(((tag: string) => {
      const el = originalCreate(tag);
      if (tag === 'a') {
        Object.defineProperty(el, 'click', {
          configurable: true,
          value: () => linkClicks.push((el as HTMLAnchorElement).download),
        });
      }
      return el;
    }) as typeof document.createElement);

    fireEvent.change(screen.getByTestId('pe-phrase-input'), { target: { value: 'happy face' } });
    fireEvent.click(screen.getByTestId('pe-save'));
    expect(linkClicks.length).toBe(1);
    // Phrase is sanitized: non-[a-z0-9-_] → '_' (case preserved by the regex flag).
    expect(linkClicks[0]).toBe('happy_face.png');
  });

  it('save with empty phrase falls back to "pictogram.png"', () => {
    render(<PictureEditorPanel />);
    // Render finishes here; install the createElement spy AFTER render so
    // we don't intercept React's own createElement calls.
    const linkClicks: string[] = [];
    const originalCreate = document.createElement.bind(document);
    vi.spyOn(document, 'createElement').mockImplementation(((tag: string) => {
      const el = originalCreate(tag);
      if (tag === 'a') {
        Object.defineProperty(el, 'click', {
          configurable: true,
          value: () => linkClicks.push((el as HTMLAnchorElement).download),
        });
      }
      return el;
    }) as typeof document.createElement);
    fireEvent.click(screen.getByTestId('pe-save'));
    expect(linkClicks[0]).toBe('pictogram.png');
  });
});

describe('PictureEditorPanel — close', () => {
  it('close button resets sidePanel to none', () => {
    render(<PictureEditorPanel />);
    fireEvent.click(screen.getByLabelText('close_panel'));
    expect(useUIStore.getState().sidePanel).toBe('none');
  });
});

describe('uiStore.openModulePanel', () => {
  it('opens picture-editor when called with picture-editor', () => {
    act(() => { useUIStore.setState({ sidePanel: 'none' }); });
    act(() => { useUIStore.getState().openModulePanel('picture-editor'); });
    expect(useUIStore.getState().sidePanel).toBe('picture-editor');
  });

  it('ignores unknown panelId', () => {
    act(() => { useUIStore.setState({ sidePanel: 'marketplace' }); });
    act(() => { useUIStore.getState().openModulePanel('made-up-panel'); });
    expect(useUIStore.getState().sidePanel).toBe('marketplace');
  });

  it('opens music-composer when registered (Phase 5 contract)', () => {
    act(() => { useUIStore.setState({ sidePanel: 'none' }); });
    act(() => { useUIStore.getState().openModulePanel('music-composer'); });
    expect(useUIStore.getState().sidePanel).toBe('music-composer');
  });
});
