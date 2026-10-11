/**
 * PhraseTile — AAC vocabulary tile tests
 *
 * Covers: rendering, click handler, aria-label fallback, and which picture a
 * tile shows — the bundled symbol for a built-in phrase, the word alone (a
 * text tile) when there is none, and a generated picture only for a custom
 * phrase on a paid plan.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { act, render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import PhraseTile from '@/components/PhraseTile';

// ── service / store mocks ─────────────────────────────────────────────────────

const getPictogramUrlMock = vi.fn<(...args: unknown[]) => Promise<string | null>>(async () => null);
let pictureMode: 'symbols' | 'symbols-ai' = 'symbols';

vi.mock('@/services/pictogramService', () => ({
  getPictogramUrl: (...args: unknown[]) => getPictogramUrlMock(...args),
  pictureModeForProfile: () => pictureMode,
  typedWordPicturesEnabled: (mode: string) => mode === 'symbols-ai',
}));

let tileLanguage = 'en';
vi.mock('@/store/settingsStore', () => ({
  useSettingsStore: (sel?: (s: { language: string }) => unknown) =>
    sel ? sel({ language: tileLanguage }) : { language: tileLanguage },
}));

vi.mock('@/store/authStore', () => ({
  useAuthStore: (sel?: (s: { profile: null }) => unknown) =>
    sel ? sel({ profile: null }) : { profile: null },
}));

beforeEach(() => {
  vi.clearAllMocks();
  getPictogramUrlMock.mockResolvedValue(null);
  pictureMode = 'symbols';
});

afterEach(() => {
  vi.unstubAllGlobals();
});

const card = () => screen.getByTestId('phrase-tile-card');
const label = () => screen.getByTestId('phrase-tile-label');
const icon = () => card().querySelector<HTMLElement>('.aac-tile-icon');
const image = () => card().querySelector<HTMLImageElement>('img');

// ── rendering ─────────────────────────────────────────────────────────────────

describe('PhraseTile — rendering', () => {
  it('renders the phrase text', () => {
    render(<PhraseTile phrase="Help me" onClick={vi.fn()} />);
    expect(screen.getByText('Help me')).toBeInTheDocument();
  });

  it('uses phrase as aria-label when ariaLabel prop not provided', () => {
    render(<PhraseTile phrase="Water please" onClick={vi.fn()} />);
    expect(screen.getByRole('button', { name: 'Water please' })).toBeInTheDocument();
  });

  it('uses ariaLabel prop when provided (overrides phrase)', () => {
    render(<PhraseTile phrase="Hi" ariaLabel="Say hi" onClick={vi.fn()} />);
    expect(screen.getByRole('button', { name: 'Say hi' })).toBeInTheDocument();
  });

  it('renders as a button element', () => {
    render(<PhraseTile phrase="Go" onClick={vi.fn()} />);
    expect(screen.getByRole('button')).toBeInTheDocument();
  });

  it('uses the shared readable AAC label contract', () => {
    render(<PhraseTile phrase="Buckle" builtInPhraseId="ac-buckle" onClick={vi.fn()} />);
    expect(card()).toHaveClass('aac-phrase-tile');
    expect(label()).toHaveClass('aac-tile-label', 'aac-phrase-label');
    expect(icon()).toBeInTheDocument();
    expect(icon()).toHaveStyle({ background: 'transparent' });
  });
});

// ── click ─────────────────────────────────────────────────────────────────────

describe('PhraseTile — click handler', () => {
  it('calls onClick when tapped', () => {
    const onClick = vi.fn();
    render(<PhraseTile phrase="Go" onClick={onClick} />);
    fireEvent.click(screen.getByRole('button'));
    expect(onClick).toHaveBeenCalledOnce();
  });

  it('calls onClick not onClick of a different tile', () => {
    const onClick1 = vi.fn();
    const onClick2 = vi.fn();
    render(
      <>
        <PhraseTile phrase="Yes" onClick={onClick1} />
        <PhraseTile phrase="No" onClick={onClick2} />
      </>
    );
    fireEvent.click(screen.getByRole('button', { name: 'Yes' }));
    expect(onClick1).toHaveBeenCalledOnce();
    expect(onClick2).not.toHaveBeenCalled();
  });
});

// ── built-in phrases ──────────────────────────────────────────────────────────

describe('PhraseTile — built-in phrases', () => {
  it.each(['symbols', 'symbols-ai'] as const)('shows the bundled symbol on the %s plan, with no request', async (mode) => {
    pictureMode = mode;
    render(<PhraseTile phrase="Buckle" builtInPhraseId="ac-buckle" onClick={vi.fn()} />);
    expect(card()).toHaveAttribute('data-picture', 'symbol');
    expect(image()).toHaveAttribute('src', '/prism-aac/symbols/ac-buckle.png');
    await act(async () => {});
    expect(getPictogramUrlMock).not.toHaveBeenCalled();
  });

  it('shows the translated word over the same symbol', () => {
    render(<PhraseTile phrase="Abrochar" englishPhrase="Buckle" builtInPhraseId="ac-buckle" onClick={vi.fn()} />);
    expect(label()).toHaveTextContent('Abrochar');
    expect(image()).toHaveAttribute('src', '/prism-aac/symbols/ac-buckle.png');
  });

  it.each(['symbols', 'symbols-ai'] as const)('is a text tile without a symbol on the %s plan — never a generated picture', async (mode) => {
    pictureMode = mode;
    render(<PhraseTile phrase="Unless" builtInPhraseId="cw-unless" onClick={vi.fn()} />);
    expect(card()).toHaveAttribute('data-picture', 'text');
    expect(icon()).toBeNull();
    expect(label()).toHaveClass('aac-text-tile-label');
    await act(async () => {});
    expect(getPictogramUrlMock).not.toHaveBeenCalled();
  });

  it('lets a caregiver picture win over the bundled symbol', () => {
    render(<PhraseTile phrase="Buckle" builtInPhraseId="ac-buckle" customImageUrl="data:image/png;base64,AAAA" onClick={vi.fn()} />);
    expect(card()).toHaveAttribute('data-picture', 'custom');
    expect(image()).toHaveAttribute('src', 'data:image/png;base64,AAAA');
  });

  it('turns into a text tile when the picture fails to load', () => {
    render(<PhraseTile phrase="Buckle" builtInPhraseId="ac-buckle" onClick={vi.fn()} />);
    fireEvent.error(image()!);
    expect(card()).toHaveAttribute('data-picture', 'text');
    expect(icon()).toBeNull();
  });

  it('treats an unknown id as a custom phrase, not a built-in one', async () => {
    render(<PhraseTile phrase="Buckle" builtInPhraseId="not-a-built-in-id" onClick={vi.fn()} />);
    expect(card()).toHaveAttribute('data-picture', 'text');
    await act(async () => {});
    expect(getPictogramUrlMock).not.toHaveBeenCalled();
  });
});

// ── custom phrases ────────────────────────────────────────────────────────────

describe('PhraseTile — custom phrases', () => {
  it('is a text tile on the free plan, with no request', async () => {
    render(<PhraseTile phrase="My red bike" onClick={vi.fn()} />);
    expect(card()).toHaveAttribute('data-picture', 'text');
    await act(async () => {});
    expect(getPictogramUrlMock).not.toHaveBeenCalled();
  });

  it('shows a generated picture on a paid plan', async () => {
    pictureMode = 'symbols-ai';
    getPictogramUrlMock.mockResolvedValueOnce('blob:generated');
    render(<PhraseTile phrase="My red bike" onClick={vi.fn()} />);
    await waitFor(() => expect(image()).toHaveAttribute('src', 'blob:generated'));
    expect(card()).toHaveAttribute('data-picture', 'generated');
  });

  it('keeps the picture well while the generated picture loads', () => {
    pictureMode = 'symbols-ai';
    getPictogramUrlMock.mockReturnValueOnce(new Promise(() => {}));
    render(<PhraseTile phrase="My red bike" onClick={vi.fn()} />);
    expect(card()).toHaveAttribute('data-picture', 'pending');
    expect(icon()).toBeInTheDocument();
    expect(image()).toBeNull();
  });

  it('becomes a text tile when no picture can be generated', async () => {
    pictureMode = 'symbols-ai';
    render(<PhraseTile phrase="My red bike" onClick={vi.fn()} />);
    await waitFor(() => expect(card()).toHaveAttribute('data-picture', 'text'));
    expect(icon()).toBeNull();
  });

  it('asks with englishPhrase when provided, else the phrase', async () => {
    pictureMode = 'symbols-ai';
    render(<PhraseTile phrase="Agua fría" englishPhrase="Cold water" onClick={vi.fn()} />);
    await waitFor(() => expect(getPictogramUrlMock).toHaveBeenCalledWith('Cold water', 'en', 'symbols-ai', { text: 'Agua fría', lang: 'en' }));
    getPictogramUrlMock.mockClear();
    render(<PhraseTile phrase="Grandma" onClick={vi.fn()} />);
    await waitFor(() => expect(getPictogramUrlMock).toHaveBeenCalledWith('Grandma', 'en', 'symbols-ai', { text: 'Grandma', lang: 'en' }));
  });

  it('passes the phrase as shown and the board language, so a word listed in that language blocks the picture', async () => {
    pictureMode = 'symbols-ai';
    tileLanguage = 'sw';
    try {
      render(<PhraseTile phrase="tako" englishPhrase="buttock" onClick={vi.fn()} />);
      await waitFor(() => expect(getPictogramUrlMock).toHaveBeenCalledWith('buttock', 'en', 'symbols-ai', { text: 'tako', lang: 'sw' }));
    } finally {
      tileLanguage = 'en';
    }
  });

  it('does not ask for an off-screen picture until the tile nears the viewport', async () => {
    pictureMode = 'symbols-ai';
    let intersectionCallback:
      | ((entries: IntersectionObserverEntry[]) => void)
      | undefined;
    class MockIntersectionObserver {
      constructor(callback: (entries: IntersectionObserverEntry[]) => void) {
        intersectionCallback = callback;
      }
      observe = vi.fn();
      disconnect = vi.fn();
      unobserve = vi.fn();
      takeRecords = vi.fn(() => []);
      root = null;
      rootMargin = '120px';
      thresholds = [0];
    }
    vi.stubGlobal('IntersectionObserver', MockIntersectionObserver);

    render(<PhraseTile phrase="Dog" onClick={vi.fn()} />);
    await act(async () => {});
    expect(getPictogramUrlMock).not.toHaveBeenCalled();

    act(() => {
      intersectionCallback?.([
        { isIntersecting: true } as IntersectionObserverEntry,
      ]);
    });
    await waitFor(() => expect(getPictogramUrlMock).toHaveBeenCalledOnce());
  });
});
